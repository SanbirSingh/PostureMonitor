import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
   base: './', // Critical for Electron file paths
  optimizeDeps: {
    exclude: ['@mediapipe/pose'], // Required for MediaPipe
  },
})
