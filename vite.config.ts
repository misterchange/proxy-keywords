import { defineConfig } from 'vite'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.config'

/*
 * Dev and build must not share an output directory. CRXJS writes an unpacked
 * extension in dev too, but its service worker is a stub importing from the
 * dev server — so when the dev server stops, an extension loaded from that
 * folder dies with "Service worker registration failed. Status code: 3".
 * That cost two debugging sessions on Proxy Director before the cause was
 * found; separating the directories removes the failure mode outright.
 */
export default defineConfig(({ command }) => ({
  plugins: [crx({ manifest })],
  build: {
    outDir: command === 'serve' ? 'dist-dev' : 'dist',
    target: 'es2022',
    rollupOptions: { input: { sidepanel: 'src/sidepanel/index.html' } },
  },
  server: { port: 5220, strictPort: true, hmr: { port: 5220 } },
}))
