import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import sites from './src/config/sites.json';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
    environment: 'node',
    env: { NEXT_PUBLIC_SWAPIC_ENV: 'e2e', NEXT_PUBLIC_SWAPIC_SITE: JSON.stringify(sites.e2e) },
  },
});
