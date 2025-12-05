# RedirectWise

A modern Chrome extension to track and analyze HTTP redirect chains for any URL.

## ✨ Features

### Core Features

- 🔄 **Track Redirects** - Automatically captures all HTTP redirects (301, 302, 307, 308, etc.)
- 📊 **Visual Path Display** - Clean UI showing the complete redirect chain
- 📋 **Export Options** - Copy redirect path as plain text or CSV
- 🔍 **Header Inspection** - View full response headers for each redirect
- 🛡️ **HSTS Detection** - Identifies browser-cached HSTS redirects
- 🌐 **Cross-browser** - Works on Chrome, Edge, Firefox (with WXT)

### Advanced Features (Unique to RedirectWise!)

- 📈 **Chain Health Score** - SEO rating (A-F) with detailed analysis
- ⏱️ **Redirect Timing** - See how long each redirect takes
- 📝 **Persistent History** - Browse past redirect chains anytime
- 🗂️ **History Dashboard** - Full CRUD management of saved redirects
- 📄 **Beautiful PDF Export** - Share professional reports with clients
- 🌙 **Dark Mode** - Easy on the eyes
- ⭐ **Favorites** - Mark important redirect chains
- 🔍 **Search & Filter** - Find specific entries quickly
- 📊 **Statistics** - Overview of your redirect tracking activity

## Tech Stack

- **Framework**: WXT (Web Extension Tools)
- **UI**: React 18 + TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **PDF**: jsPDF + jsPDF-AutoTable
- **State**: Zustand
- **Build**: Vite

## Development

### Prerequisites

- Node.js 18+
- npm or pnpm

### Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

This will:

1. Build the extension
2. Watch for changes
3. Open the browser with the extension loaded

### Build for Production

```bash
# Build for Chrome (also works for Brave, Opera, Vivaldi)
npm run build

# Build for Firefox
npm run build:firefox

# Build for Microsoft Edge
npm run build:edge

# Build all browsers at once
npm run build:all
```

### Create ZIP for Distribution

```bash
# Package for Chrome Web Store (also works for Brave, Opera, Vivaldi)
npm run zip

# Package for Firefox Add-ons
npm run zip:firefox

# Package for Microsoft Edge Add-ons
npm run zip:edge

# Package all browsers at once
npm run zip:all
```

### Browser Compatibility

| Browser        | Build Command           | Store              |
| -------------- | ----------------------- | ------------------ |
| Chrome         | `npm run build`         | Chrome Web Store   |
| Microsoft Edge | `npm run build:edge`    | Edge Add-ons       |
| Firefox        | `npm run build:firefox` | Firefox Add-ons    |
| Brave          | `npm run build`         | Chrome Web Store\* |
| Opera          | `npm run build`         | Chrome Web Store\* |
| Vivaldi        | `npm run build`         | Chrome Web Store\* |

\*Chromium-based browsers use the same build as Chrome.

> **Note:** Safari requires a separate native wrapper and Apple Developer account. Not currently supported.

## Project Structure

```
redirectwise/
├── entrypoints/
│   ├── popup/              # Popup UI (React)
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── index.html
│   │   └── style.css
│   ├── dashboard/          # Full-page dashboard
│   │   ├── Dashboard.tsx
│   │   ├── main.tsx
│   │   ├── index.html
│   │   └── style.css
│   └── background.ts       # Service worker
├── components/             # React components
│   ├── Header.tsx
│   ├── ChainScoreCard.tsx
│   ├── RedirectPath.tsx
│   ├── RedirectItemCard.tsx
│   ├── HeadersList.tsx
│   ├── CopyButtons.tsx
│   └── EmptyState.tsx
├── utils/                  # Utilities
│   ├── storage.ts          # Chrome storage helpers
│   └── pdf-export.ts       # PDF generation
├── types/                  # TypeScript types
│   └── redirect.ts
├── public/
│   └── icons/              # Extension icons
├── wxt.config.ts           # WXT configuration
├── tailwind.config.js
└── package.json
```

## How It Works

1. **Background Script** (`background.ts`)

   - Listens to `webRequest.onHeadersReceived` events
   - Tracks redirect chains per tab with timing
   - Stores path data in memory and saves to history
   - Calculates chain health score

2. **Popup** (`popup/`)

   - Queries background script for current tab's path
   - Displays chain health score and issues
   - Renders the redirect chain visually
   - Provides copy and export functionality

3. **Dashboard** (`dashboard/`)
   - Full-page history management
   - Search, filter, and sort entries
   - Export individual or bulk PDFs
   - Dark mode support
