import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// У розробці запити до API, фото і прев'ю йдуть на бек (backend/, порт 3000)
const API = process.env.API_URL || 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': API,
      '/uploads': API,
      '/thumbs': API,
    },
  },
});
