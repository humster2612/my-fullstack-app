// import { defineConfig } from 'vite'
// import react from '@vitejs/plugin-react'

// export default defineConfig({
//   plugins: [react()],
//   server: {
//     proxy: { '/api': { target: 'http://localhost:4000', changeOrigin: true } }
//   },
//   base: '/my-fullstack-app/'   // ← ТОЛЬКО слэш + имя репозитория + слэш
// })

// client/vite.config.ts
// client/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Конфиг как функция: Vite сам передаёт сюда mode ("development" | "production")
export default defineConfig(({ mode }) => ({
  // В деве base = "/", в проде — "/my-fullstack-app/"
  base: mode === "production" ? "/my-fullstack-app/" : "/",
  plugins: [react()],
}));