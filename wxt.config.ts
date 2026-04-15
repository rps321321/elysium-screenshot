import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Elysium Screenshot',
    description: 'The best free screenshot extension. Full-page capture, region select, element capture, annotation tools, blur, and more. 100% free, no paywalls, no account required.',
    version: '1.0.4',
    permissions: ['activeTab', 'tabs', 'downloads', 'storage', 'contextMenus', 'scripting', 'notifications'],
    host_permissions: ['<all_urls>'],
    commands: {
      'capture-visible': {
        suggested_key: { default: 'Alt+Shift+S' },
        description: 'Capture visible area',
      },
      'capture-fullpage': {
        suggested_key: { default: 'Alt+Shift+F' },
        description: 'Capture full page',
      },
      'capture-region': {
        suggested_key: { default: 'Alt+Shift+R' },
        description: 'Capture selected region',
      },
      'capture-element': {
        suggested_key: { default: 'Alt+Shift+E' },
        description: 'Capture DOM element',
      },
    },
    icons: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },
    browser_specific_settings: {
      gecko: {
        id: 'elysium-screenshot@rps321321.github.io',
        strict_min_version: '109.0',
        data_collection_permissions: {
          required: ['none']
        }
      }
    }
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
