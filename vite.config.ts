import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite'; // For Tailwind 4
// import electron from 'vite-plugin-electron'; // Revert to default import
import * as electronPlugin from 'vite-plugin-electron';
import tsconfigPaths from 'vite-tsconfig-paths';
import type { Plugin } from 'vite';

// Type for onstart options if needed by vite-plugin-electron
interface ElectronOnStartOptions {
  reload: () => void;
  // Add other properties if defined by the plugin's onstart options
}

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
// const electronCallable = typeof electron === 'function' ? electron : (electron as any).default;
const electron = typeof electronPlugin === 'function'
    ? electronPlugin
    : (electronPlugin as { default?: unknown }).default ?? electronPlugin;

const electronCallable = typeof electron === 'function' ? electron : () => { console.error("vite-plugin-electron is not callable"); return []; };

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // For Tailwind CSS v4 and above, this is often enough
    tsconfigPaths(),
    electronCallable([
      {
        // Main process entry file
        entry: 'electron/main.ts'
      },
      {
        // Preload script entry file
        entry: 'electron/preload.ts',
        onstart(options: ElectronOnStartOptions) {
          // Notify the Renderer-Process to reload the page when the Preload-Scripts build is complete.
          // Based on browser-link-3, options.reload() should handle this.
          if (options && typeof options.reload === 'function') {
            options.reload();
          } else {
            console.warn('vite-plugin-electron: options.reload is not available in onstart for preload.');
          }
        },
        // rely on vite-plugin-electron default build for preload
      },
      // You can add more entry points if needed (e.g., other preload scripts)
    ]) as Plugin[],
  ],
  // Define the output directory for the renderer build
  build: {
    outDir: 'dist', // Renderer output (HTML, JS, CSS) goes here
    emptyOutDir: true, // Clean the output directory before building
    // Rollup options for the renderer build if needed
    // rollupOptions: {
    //   input: {
    //     // Default is index.html at the root
    //   }
    // },
  },
  // Optional: Configure server port if needed
  server: {
    port: 0, // Use a random available port
    strictPort: false, // Allow fallback to random port
  },
  // Ensure publicDir is set if you have assets in 'public/'
  publicDir: 'public',
}); 