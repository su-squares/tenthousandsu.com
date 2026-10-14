// Holds the Cloudflare OAuth login for both preview deploys.
// Cloudflare rotates the refresh token on every use. This object is the only
// writer, so the two sites cannot invalidate each other.

const OAUTH_URL = "https://dash.cloudflare.com/oauth2/token";
const CLIENT_ID = "54d11594-84e4-41aa-b438-e81b8fa78ee7";
const SKEW_MS = 5 * 60 * 1000;
const STATE_KEY = "state";

export function authorized(header, expected) {
  const prefix = "Bearer ";
  if (!expected || !header.startsWith(prefix)) return false;
  const got = header.slice(prefix.length);
  if (got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export function accessStillValid(state, now) {
  if (!state?.access_token || !state?.expiration_time) return false;
  const expiresAt = Date.parse(state.expiration_time);
  return Number.isFinite(expiresAt) && expiresAt - now > SKEW_MS;
}

export function applyRefresh(previous, payload, now) {
  if (!payload.access_token) {
    const error = new Error(payload.error || "no access token");
    error.code = payload.error || "no_access_token";
    throw error;
  }
  const expiresIn = Number(payload.expires_in);
  const expiration = Number.isFinite(expiresIn)
    ? new Date(now + expiresIn * 1000).toISOString()
    : new Date(now + 50 * 60 * 1000).toISOString();
  return {
    refresh_token: payload.refresh_token || previous.refresh_token,
    access_token: payload.access_token,
    expiration_time: expiration,
  };
}

function fail(error, status) {
  return Response.json({ error }, { status });
}

async function refreshGrant(refreshToken) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: CLIENT_ID,
    refresh_token: refreshToken,
  });
  const resp = await fetch(OAUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "User-Agent": "wrangler/4.149.0",
    },
    body,
  });
  const payload = await resp.json().catch(() => ({}));
  if (!resp.ok || !payload.access_token) {
    const error = new Error(payload.error || String(resp.status));
    error.code = payload.error || String(resp.status);
    throw error;
  }
  return payload;
}

export class PreviewAuth {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.tail = Promise.resolve();
  }

  fetch(request) {
    const run = this.tail.then(() => this.#handle(request));
    this.tail = run.then(
      () => {},
      () => {}
    );
    return run;
  }

  async #handle(request) {
    const path = new URL(request.url).pathname;
    if (path === "/seed") return this.#seed(request);
    if (path === "/token") return this.#issue();
    return fail("not_found", 404);
  }

  async #seed(request) {
    const existing = await this.ctx.storage.get(STATE_KEY);
    if (existing?.refresh_token) return fail("already_seeded", 409);
    const text = await request.text();
    if (text.length > 500) return fail("bad_request", 400);
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      return fail("bad_request", 400);
    }
    if (typeof body.refresh_token !== "string" || body.refresh_token.length < 20) {
      return fail("bad_request", 400);
    }
    await this.ctx.storage.put(STATE_KEY, {
      refresh_token: body.refresh_token,
      access_token: "",
      expiration_time: new Date(0).toISOString(),
    });
    return new Response(null, { status: 204 });
  }

  async #issue() {
    const state = await this.ctx.storage.get(STATE_KEY);
    if (!state?.refresh_token) return fail("not_seeded", 503);
    const now = Date.now();
    if (accessStillValid(state, now)) {
      return Response.json({
        access_token: state.access_token,
        expiration_time: state.expiration_time,
      });
    }
    let payload;
    try {
      payload = await refreshGrant(state.refresh_token);
    } catch (error) {
      return fail(error.code || "refresh_failed", 502);
    }
    const next = applyRefresh(state, payload, Date.now());
    await this.ctx.storage.put(STATE_KEY, next);
    return Response.json({
      access_token: next.access_token,
      expiration_time: next.expiration_time,
    });
  }
}

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return fail("not_found", 404);
    const header = request.headers.get("Authorization") || "";
    if (!authorized(header, env.PREVIEW_AUTH_PASSWORD || "")) return fail("unauthorized", 401);
    const stub = env.AUTH.get(env.AUTH.idFromName("preview"));
    return stub.fetch(request);
  },
};
