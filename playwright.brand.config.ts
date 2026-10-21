import {defineConfig} from '@playwright/test';
import acceptance from './playwright.acceptance.config';
export default defineConfig({...acceptance,testMatch:['brand-lock.spec.ts','brand-navigation.spec.ts'],outputDir:'.brand-browser-results'});
