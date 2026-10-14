import { defineManifest } from '@crxjs/vite-plugin'

/**
 * MV3 manifest.
 *
 * No `<all_urls>` and no content script. The one source this build ships —
 * Google Autocomplete — is a plain GET the service worker makes itself, so the
 * extension never touches a page the user is looking at and never reads their
 * browsing. `host_permissions` is a single endpoint.
 *
 * That is worth protecting as sources are added. A keyword tool asking to read
 * every site is indistinguishable, to a Chrome Web Store reviewer, from
 * something else entirely.
 */
export default defineManifest({
  manifest_version: 3,
  name: 'Proxy Keywords',
  version: '0.1.0',
  description: 'Upload a sheet of seed keywords, get the long tail for a country.',

  permissions: ['storage', 'sidePanel'],
  host_permissions: ['https://suggestqueries.google.com/*'],

  background: { service_worker: 'src/background/index.ts', type: 'module' },
  side_panel: { default_path: 'src/sidepanel/index.html' },
  action: { default_title: 'Proxy Keywords' },
})
