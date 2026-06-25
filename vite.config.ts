import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,                // Permite usar funções como describe, it sem importar
    environment: 'jsdom',         // Simula um navegador para testar componentes
    setupFiles: './src/test/setup.ts', // Arquivo de preparação (vamos criar)
    css: true,                    // Se quiser testar estilos, deixe true
    alias: {
      '@': path.resolve(__dirname, './src'), // Ajuda a importar arquivos com @/
    },
  },
});