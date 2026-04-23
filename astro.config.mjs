// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  // Configuración híbrida para soporte de SQLite
  output: 'static', // Usar modo estático por defecto
  
  vite: {
    optimizeDeps: {
      exclude: ['better-sqlite3'], // Excluir del bundling del cliente
    },
    define: {
      global: 'globalThis', // Compatibilidad con sql.js
    },
    // Configuración adicional para sql.js WebAssembly
    server: {
      fs: {
        allow: ['..'] // Permitir acceso a archivos fuera del directorio raíz
      }
    }
  },
  
  // Configuración para desarrollo
  devToolbar: {
    enabled: false // Deshabilitar toolbar en desarrollo para mejor rendimiento
  }
});
