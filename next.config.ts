import type { NextConfig } from "next";
import path from "node:path";

/**
 * Sent on every response. The app is never meant to be embedded, so framing is
 * refused outright (clickjacking), MIME sniffing is off, cross-site requests
 * see only the origin, and device APIs the product never uses are denied.
 * HSTS is added by the hosting platform. A script-src policy is deliberately
 * not set here: Next.js inlines bootstrap scripts, so it needs per-request
 * nonces from middleware rather than a static header.
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  // Pin the workspace root to this project (a stray lockfile lives one level up).
  turbopack: { root: path.join(__dirname) },
  // Produces the minimal server bundle copied by the production Dockerfile.
  output: "standalone",
  // Do not advertise the framework in a response header.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
