import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const extraAllowedHosts = ((((globalThis as any).process?.env?.VITE_ALLOWED_HOSTS as string | undefined) ?? '')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean));

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    allowedHosts: ['sui-shot.onrender.com', '.onrender.com', ...extraAllowedHosts],
  },
});
