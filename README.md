# PropBank Next.js

The frontend and API run in one Next.js application. Browser requests use /api. Every specific API route is permanently native. Unmatched API paths and the unused /api root return the standard Next.js 404 response.

Firebase Auth uses propbank-7601b; Firestore data uses propbank-944fc. Existing Firebase Admin credentials, collection names, R2 configuration and public object URLs are retained. Use .env.example for configuration; never commit credentials.

Run npm run dev for development, or npm run build followed by npm start for production. Run npm run test:server for isolated contract tests, npm run audit:api for caller/route coverage, and npm run test:native-routing for built-server verification. The latter uses public database reads and anonymous mutation rejection; add --compatibility-only when running the script directly to verify local routing without live Firebase/R2 access. npm run test:group2-routing checks native routing through Playwright.

Historical migration evidence is retained under migration-audit; the current cleanup report takes precedence over earlier rollout instructions. The external backend project and its separately deployed background scheduler are outside this application cleanup.
