import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Keep in sync with the Content-Security-Policy header in the root vercel.json.
// Applying it to `vite preview` makes the E2E run exercise the production policy.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "worker-src 'self' blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join('; ');

export default defineConfig({
  plugins: [react()],
  build: { target: 'es2023', sourcemap: true, assetsInlineLimit: 0 },
  preview: { headers: { 'Content-Security-Policy': contentSecurityPolicy } },
});
