# RedirectWise

Track redirects, uncover hidden ad/tracking hops, and review the full redirect journey with a popup, live sidepanel, and persistent history dashboard.

<p>
  <a href="https://chromewebstore.google.com/detail/redirectwise/mhahonijegjclaecmoinjomidmhhleln">
    <img src="website/assets/Google_Chrome.svg" alt="Google Chrome" width="18" align="center" />
    Chrome Web Store
  </a>
  &nbsp;&nbsp;&nbsp;
  <a href="https://microsoftedge.microsoft.com/addons/detail/mdgmnjiooaiahcnkinkgdgibhmjklaid">
    <img src="website/assets/Microsoft_Edge.svg" alt="Microsoft Edge" width="18" align="center" />
    Microsoft Edge Add-ons
  </a>
</p>

Latest tagged release: `v1.4.2`

## Features

- `Popup redirect inspector` for the current tab with a full hop-by-hop path view
- `Realtime sidepanel monitor` that keeps tracking redirects continuously while you browse
- `Accurate timing insights` with per-hop duration, inter-hop gap timing, and user-friendly time formatting
- `SEO chain score` with grades, issues, and recommendations
- `Persistent history dashboard` with search, sort, filters, favorites, and notes-ready metadata
- `Export tools` for text, CSV, individual PDFs, and bulk PDF history export
- `Header inspection` for response headers, IP addresses, caching, content, and security details
- `HSTS detection` for browser-enforced HTTPS upgrades
- `Dark mode` across popup, sidepanel, and dashboard
- `Session persistence` so redirect data survives popup closes and short-lived extension UI reloads
- `Internationalization` with 18 locales

## Release Highlights

- `v1.4.x`
  Added full i18n coverage, expanded language support to 18 locales, improved dashboard refresh behavior, fixed history persistence, and polished redirect timing/gap display.
- `v1.3.0`
  Improved SEO scoring and analysis quality.
- `v1.2.0`
  Optimized performance, synchronized redirect recording, improved sidepanel auto-scroll, and redesigned dashboard settings around chain score controls.
- `v1.1.0`
  Improved scoring logic and UI polish.
- `v1.0.x`
  Added the extension badge, enhanced URL/header details, moved PDF export to `pdf-lib`, and shipped the website/docs assets.

## Supported Locales

`en`, `es`, `fr`, `de`, `it`, `pt_BR`, `ru`, `ja`, `ko`, `zh_CN`, `ar`, `hi`, `tr`, `nl`, `pl`, `vi`, `sv`, `id`

## Tech Stack

- `Framework:` WXT
- `UI:` React 18 + TypeScript
- `Styling:` Tailwind CSS v4
- `Icons:` Lucide React
- `PDF Export:` pdf-lib
- `Utilities:` date-fns, uuid
- `Build:` Vite + Terser

## Development

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
npm install
npm run dev
```

### Build

```bash
# Chrome / Chromium
npm run build

# Microsoft Edge
npm run build:edge

# Firefox
npm run build:firefox

# All configured browser builds
npm run build:all
```

### Package

```bash
# Chrome / Chromium
npm run zip

# Microsoft Edge
npm run zip:edge

# Firefox
npm run zip:firefox

# All configured browser packages
npm run zip:all
```

## Browser Notes

- `Chrome / Chromium browsers:` primary target
- `Microsoft Edge:` supported via dedicated build/package commands
- `Firefox:` build scripts are available in the repo

## Project Structure

```text
redirectwise/
├── entrypoints/
│   ├── background.ts
│   ├── popup/
│   ├── sidepanel/
│   └── dashboard/
├── components/
├── utils/
├── types/
├── public/
│   ├── _locales/
│   └── icons/
├── assets/
├── website/
├── wxt.config.ts
└── package.json
```

## How It Works

1. `Background service worker`
   Captures main-frame navigations with `webRequest` and `webNavigation`, records redirect hops, headers, IPs, status codes, and timing metadata, then broadcasts live updates to the UI.
2. `Popup`
   Shows the current tab’s redirect journey, chain score, copy/export actions, and detailed per-hop inspection.
3. `Sidepanel`
   Acts as a continuous live monitor so you can keep browsing and watch redirect activity update in real time.
4. `Dashboard`
   Stores and reviews redirect history with filters, favorites, analytics, and PDF export.

## License

Distributed under the MIT License. See `LICENSE` for more information.
