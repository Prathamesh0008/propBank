import {defineConfig} from '@playwright/test';
import acceptance from './playwright.acceptance.config';
export default defineConfig({...acceptance,testMatch:['storage-security.spec.ts'],outputDir:'.storage-security-browser-results'});
