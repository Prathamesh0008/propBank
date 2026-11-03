import type { NextConfig } from 'next';
import { networkInterfaces } from 'node:os';
const config: NextConfig = {
  // Allow this PC's LAN addresses to load development assets and hot updates.
  allowedDevOrigins: Object.values(networkInterfaces()).flatMap(addresses =>
    (addresses || []).filter(address => address.family === 'IPv4' && !address.internal)
      .map(address => address.address)),
  turbopack: { root: process.cwd() },
  // Integration tests run alongside the user's dev server with an isolated build directory.
  distDir: process.env.PROPBANK_TEST_DIST_DIR || '.next',
  // Go's /properties/search/ and /properties/tenant/ redirect to trailing slashes.
  // Avoid a Go-adds-slash / Next-removes-slash redirect loop through /api.
  skipTrailingSlashRedirect: true,
};
export default config;
