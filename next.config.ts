import type { NextConfig } from 'next';
const config: NextConfig = {
  turbopack: { root: process.cwd() },
  // Integration tests run alongside the user's dev server with an isolated build directory.
  distDir: process.env.PROPBANK_TEST_DIST_DIR || '.next',
  // Go's /properties/search/ and /properties/tenant/ redirect to trailing slashes.
  // Avoid a Go-adds-slash / Next-removes-slash redirect loop through /api.
  skipTrailingSlashRedirect: true,
};
export default config;
