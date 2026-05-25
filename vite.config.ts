import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    ssr: {
      // Força o Vite a processar esses pacotes para resolver módulos virtuais
      noExternal: ['@tanstack/react-start', '@tanstack/react-router', '@tanstack/start'],
    },
    optimizeDeps: {
      exclude: ['@tanstack/react-start'],
    },
  },
});