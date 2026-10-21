import {defineConfig} from '@playwright/test';
import acceptance from './playwright.acceptance.config';
export default defineConfig({...acceptance,testMatch:['routes.spec.ts','parity.spec.ts','functional-audit.spec.ts'],outputDir:'.functional-browser-results'});
