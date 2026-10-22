import { env } from "../config/env.js";

// Hosts that are safe to reflect as CORS origins outside production.
function isDevFriendlyHost(hostname) {
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") return true;
  // Private LAN ranges (RFC 1918)
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  // Common tunnel hosts
  if (
    hostname.endsWith(".ngrok-free.app") ||
    hostname.endsWith(".ngrok-free.dev") ||
    hostname.endsWith(".ngrok.app") ||
    hostname.endsWith(".ngrok.io") ||
    hostname.endsWith(".loca.lt") ||
    hostname.endsWith(".trycloudflare.com")
  ) {
    return true;
  }
  return false;
}

// Extra origins from CLIENT_ORIGINS=http://a,http://b (optional).
function extraOrigins() {
  const raw = process.env.CLIENT_ORIGINS || "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((value) => {
      try {
        return new URL(value).origin;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

/**
 * cors `origin` option: reflect allowed request origins so credentials work
 * from localhost, LAN IPs, and tunnels (ngrok) in development.
 */
export function resolveCorsOrigin(requestOrigin, callback) {
  if (!requestOrigin) {
    callback(null, true);
    return;
  }

  if (requestOrigin === env.CLIENT_URL) {
    callback(null, true);
    return;
  }

  if (extraOrigins().includes(requestOrigin)) {
    callback(null, true);
    return;
  }

  if (!env.isProduction) {
    try {
      const { hostname } = new URL(requestOrigin);
      if (isDevFriendlyHost(hostname)) {
        callback(null, true);
        return;
      }
    } catch {
      // fall through
    }
  }

  callback(new Error(`Origin ${requestOrigin} not allowed by CORS`));
}
