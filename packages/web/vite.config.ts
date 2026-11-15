/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Node >= 25 expone un `localStorage` global propio que tapa al de jsdom; se desactiva si la bandera existe.
const webstorageFlag = '--no-experimental-webstorage';
const execArgv = process.allowedNodeEnvironmentFlags.has(webstorageFlag) ? [webstorageFlag] : [];

export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}'], poolOptions: { forks: { execArgv }, threads: { execArgv } } },
});
