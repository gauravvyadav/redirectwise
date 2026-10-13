<p align="center">
  <img src="public/icons/logo.svg" width="64" height="64" alt="RedirectWise Logo" />
</p>

<h1 align="center">RedirectWise</h1>

<p align="center">
  <b>Track redirects, uncover hidden ad/tracking hops, and review the full redirect journey with a popup, live sidepanel, and persistent history dashboard.</b>
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/redirectwise/mhahonijegjclaecmoinjomidmhhleln" style="text-decoration: none;">
    <img src="assets/chrome-webstore.png" height="40" alt="Chrome Web Store" />
  </a>
  &nbsp;
  <a href="https://microsoftedge.microsoft.com/addons/detail/mdgmnjiooaiahcnkinkgdgibhmjklaid" style="text-decoration: none;">
    <img src="assets/English_Get it from Microsoft Edge.png" height="40" alt="Edge Addons" />
  </a>
</p>

<p align="center">
  🌐 <b>Web:</b> <a href="https://redirectwise.gauravlabs.com/">https://redirectwise.gauravlabs.com</a>
</p>

<p align="center">
  Latest tagged release: <code>v2.0.0</code>
</p>

---

## Features

- `Popup redirect inspector` for the current tab with a full hop-by-hop path view
- `Realtime sidepanel monitor` that keeps tracking redirects continuously while you browse
- `Accurate timing insights` with per-hop duration, inter-hop gap timing, and user-friendly time formatting
- `Persistent history dashboard` with search, sort, filters, favorites, and notes-ready metadata
- `Export tools` for text, CSV, individual PDFs, and bulk PDF history export
- `Header inspection` for response headers, IP addresses, caching, content, and security details
- `HSTS detection` for browser-enforced HTTPS upgrades
- `Dark mode` across popup, sidepanel, and dashboard
- `Session persistence` so redirect data survives popup closes and short-lived extension UI reloads
- `Cross-tab journey tracking` so tabs opened from ads/links inherit the opener chain with a new-tab-from marker
- `Internationalization` with 18 locales

## Release Highlights

- `v2.0.0`
  Complete Swiss Modernist architectural redesign across Extension and Marketing Web surfaces. Flat geometry logo icon with zero shadow, unified design token variables (`--paper`, `--ink`, `--brand`, `--line`), 1px hairline drafting grids, zero-flash dark mode theme system, dual-store availability (Google Chrome & Microsoft Edge), and Gauravlabs design language alignment.
  Tracking hardening: redirect chains survive client-side (ad/JS/meta) redirects, page refreshes, and plain link clicks; new-tab ad flows inherit the opener chain; history merge and cross-tab sidepanel tracing fixed.
- `v1.5.0`
  Added PNG image export, redesigned popup actions layout, custom delete confirmation dialog, synced brand name (RedirectWise) and slogan (URL Redirect Checker) across all locales, and removed all SEO-related feature text.
- `v1.4.x`
  Added full i18n coverage, expanded language support to 18 locales, improved dashboard refresh behavior, fixed history persistence, and polished redirect timing/gap display.
- `v1.2.0`
  Optimized performance, synchronized redirect recording, and improved sidepanel auto-scroll.
- `v1.1.0`
  Improved UI polish.
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
   Captures main-frame navigations with `webRequest` and `webNavigation`, records redirect hops, headers, IPs, status codes, and timing metadata, then broadcasts live updates to the UI. Same-tab navigations chain into one journey; new tabs inherit their opener's chain.
2. `Popup`
   Shows the current tab’s redirect journey, copy/export actions, and detailed per-hop inspection.
3. `Sidepanel`
   Acts as a continuous live monitor so you can keep browsing and watch redirect activity update in real time.
4. `Dashboard`
   Stores and reviews redirect history with filters, favorites, analytics, and PDF export.

## License

Distributed under the MIT License. See `LICENSE` for more information.
