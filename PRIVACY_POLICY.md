# Privacy Policy — Elysium Screenshot

**Last updated:** April 2026

## Overview

Elysium Screenshot is a browser extension that captures, annotates, and exports screenshots entirely within your browser. **We do not collect, transmit, or store any user data**.

## Data Collection

**None.** Elysium Screenshot collects zero user data. Specifically:

- ❌ No analytics or usage telemetry
- ❌ No tracking pixels or advertising identifiers
- ❌ No personal information collection
- ❌ No browsing history collection
- ❌ No cookies or session tokens
- ❌ No outbound network requests of any kind

## Data Storage

All data created by the extension — including screenshots, annotations, history, and settings — is stored **exclusively on your local machine** using standard browser storage APIs:

- **Screenshots:** Stored temporarily in IndexedDB for editor loading, then discarded.
- **History thumbnails:** Stored in `chrome.storage.local` (limited to 50 entries, JPEG-compressed thumbnails only).
- **Settings:** Stored in `chrome.storage.sync` to persist across browser sessions.

No data ever leaves your browser.

## Permissions

Elysium requests the following browser permissions, each with a clear justification:

| Permission | Purpose |
|---|---|
| `activeTab` | Access the current tab to capture its visible content |
| `tabs` | Query tab metadata (URL, title) for filename generation |
| `scripting` | Inject overlay scripts for region/element selection and full-page scroll capture |
| `downloads` | Save exported screenshots to your local Downloads folder |
| `storage` | Persist user settings and screenshot history locally |
| `contextMenus` | Add "Capture" options to the right-click context menu |
| `notifications` | Display capture-complete notifications |
| `host_permissions: <all_urls>` | Required to inject capture scripts on any webpage |

## Third-Party Services

Elysium Screenshot does **not** integrate with any third-party services, APIs, or cloud infrastructure. The extension is entirely self-contained.

## Open Source Transparency

The complete source code is publicly available at [github.com/rps321321/elysium-screenshot](https://github.com/rps321321/elysium-screenshot) for independent security review.

## Contact

For privacy-related inquiries, please open an issue on the [GitHub repository](https://github.com/rps321321/elysium-screenshot/issues).
