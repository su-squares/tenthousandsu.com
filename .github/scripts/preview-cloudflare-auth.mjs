import { appendFileSync } from "node:fs";

const url = process.env.PREVIEW_AUTH_URL;
const password = process.env.PREVIEW_AUTH_PASSWORD;
if (!url || !password) {
  console.error("Preview login is not configured.");
  process.exit(1);
}

const resp = await fetch(url, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${password}`,
    Accept: "application/json",
    "User-Agent": "wrangler/4.149.0",
  },
});
const payload = await resp.json().catch(() => ({}));
if (!resp.ok || !payload.access_token) {
  console.error("Cloudflare login refresh failed:", payload.error || resp.status);
  process.exit(1);
}

const token = payload.access_token;
console.log(`::add-mask::${token}`);
const delim = "CF_TOKEN_END";
appendFileSync(
  process.env.GITHUB_ENV,
  `CLOUDFLARE_API_TOKEN<<${delim}\n${token}\n${delim}\n`
);
