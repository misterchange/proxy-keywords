import { defineManifest } from '@crxjs/vite-plugin'

/**
 * MV3 manifest.
 *
 * No `<all_urls>` and no declared content script. Google Autocomplete is a
 * plain GET from the worker. Ahrefs needs its page: `scripting` plus the one
 * host lets the worker inject a script into the Ahrefs tab it opened itself,
 * and nowhere else. The extension never reads the user's other browsing.
 *
 * That is worth protecting as sources are added. A keyword tool asking to read
 * every site is indistinguishable, to a Chrome Web Store reviewer, from
 * something else entirely.
 */
export default defineManifest({
  manifest_version: 3,
  name: 'Proxy Keywords',
  version: '0.1.0',
  description: 'Type a keyword, pick a country, get keyword ideas with volume and KD as an Excel file.',

  permissions: ['storage', 'sidePanel', 'scripting'],
  host_permissions: ['https://suggestqueries.google.com/*', 'https://ahrefs.com/*'],

  background: { service_worker: 'src/background/index.ts', type: 'module' },
  side_panel: { default_path: 'src/sidepanel/index.html' },
  action: { default_title: 'Proxy Keywords' },
})
