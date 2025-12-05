# RedirectWise - AI Coding Instructions

## Project Overview

RedirectWise is a cross-browser extension (Chrome, Edge, Firefox) that tracks HTTP redirect chains and provides SEO analysis. Built with WXT framework, React 18, TypeScript, and Tailwind CSS.

## Architecture

### Entry Points (`entrypoints/`)

- **`background.ts`** - Service worker that intercepts `webRequest` and `webNavigation` events. Stores redirect paths per-tab in a `Map<number, TabRedirectPath>`. Handles message passing to popup.
- **`popup/`** - Extension popup UI. Communicates with background via `chrome.runtime.sendMessage()`.
- **`dashboard/`** - Full-page history management UI opened via `chrome.runtime.getURL('/dashboard.html')`.

### Data Flow

1. Background intercepts requests via `chrome.webRequest.onHeadersReceived`
2. Redirect items stored in memory (`tabPaths` Map)
3. On navigation complete, saved to `chrome.storage.local` via `utils/storage.ts`
4. Popup/Dashboard fetch data via message passing or direct storage access

### Key Types (`types/redirect.ts`)

- **`RedirectItem`** - Single redirect hop with URL, status, headers, timing
- **`HistoryEntry`** - Saved chain with `ChainScore`, metadata, favorites
- **`ChainScore`** - SEO grade (A-F) with issues/recommendations

## Development Commands

```bash
npm run dev           # Dev server with hot reload
npm run dev:firefox   # Firefox development
npm run build         # Production build (Chrome)
npm run build:all     # Build for all browsers
npm run zip           # Create distribution package
```

## Code Patterns

### Component Props Pattern

All components accept `darkMode?: boolean` prop and use `clsx()` for conditional classes:

```tsx
export default function Component({ data, darkMode = false }: Props) {
  return <div className={clsx('base-class', darkMode ? 'dark-variant' : 'light-variant')} />;
}
```

### Storage Access

Always use async storage utilities from `utils/storage.ts`:

```typescript
import { getHistory, saveHistoryEntry, getSettings } from '../utils/storage';
```

### Background Message Protocol

Messages use `{ name: string, tabId?: number, ... }` format:

```typescript
// From popup/dashboard
chrome.runtime.sendMessage({ name: 'getTabPath', tabId: tab.id });
// Background always returns true to keep channel open for async
```

### Chain Score Calculation

SEO scoring in `calculateChainScore()` deducts points for:

- Each redirect: -10 points
- > 3 redirects: -15 additional
- 302/307 temporary: -5 each
- Client-side redirects: -15 each
- HTTP (non-HTTPS): -10

## File Conventions

- Components in `components/` are reusable across popup and dashboard
- Chrome API types from `@types/chrome`
- Icons exclusively from `lucide-react`
- Date formatting via `date-fns`
- PDF generation uses `jspdf` + `jspdf-autotable`

## WXT-Specific Notes

- `defineBackground()` wrapper required for background scripts
- Manifest configured in `wxt.config.ts`, not separate manifest.json
- Uses `@wxt-dev/module-react` for React integration
- Build outputs go to `.output/` directory
