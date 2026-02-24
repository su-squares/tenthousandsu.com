import { extractScheme } from "../../js/link-utils.js";

function getWindowOrigin() {
  if (typeof window === "undefined" || !window.location) return "https://tenthousandsu.com";
  return window.location.origin;
}

function resolveOrigin(baseurl) {
  const fallback = getWindowOrigin();
  if (!baseurl) return fallback;

  try {
    return new URL(baseurl, fallback).origin;
  } catch {
    return fallback;
  }
}

function looksLikeUriLabel(label) {
  if (!label || typeof label !== "string") return false;
  const trimmed = label.trim();
  if (!trimmed) return false;

  if (extractScheme(trimmed)) return true;

  if (/^www\./i.test(trimmed)) return true;

  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(trimmed)) return true;

  if (/[-_.~a-z0-9]+:\/\/\S+/i.test(trimmed)) return true;

  return false;
}

export function isMintInternalLink(href, baseurl) {
  if (!href || typeof href !== "string") return false;

  const origin = resolveOrigin(baseurl);

  try {
    const resolved = new URL(href, origin);
    return resolved.origin === origin && (resolved.pathname === "/buy" || resolved.pathname.startsWith("/buy/"));
  } catch {
    return false;
  }
}

export function shouldHideUriLabel(label, destinationHref, baseurl) {
  if (isMintInternalLink(destinationHref, baseurl)) return false;

  const labelString = typeof label === "string" ? label.trim() : "";
  if (!labelString) return false;

  const destinationString =
    typeof destinationHref === "string" ? destinationHref.trim() : "";

  if (
    destinationString &&
    labelString.replace(/\/+$/, "").toLowerCase() ===
      destinationString.replace(/\/+$/, "").toLowerCase()
  ) {
    return true;
  }

  return looksLikeUriLabel(labelString);
}
