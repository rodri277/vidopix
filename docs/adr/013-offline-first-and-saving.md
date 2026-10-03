# ADR 013: Offline first, with layered protection against losing work

- Status: Accepted
- Phase: 4

## Context

Vidopix has no server, so the browser is the only place the work lives. Accidentally reloading, closing the tab or losing the connection must never cost a drawing.

## Decision

- **Autosave to IndexedDB** a short moment (600 ms) after every change, and whenever the page is hidden. The status bar shows `Saved`, `Saving…`, `Unsaved changes` or an error. The last open project is reopened on the next visit.
- **A synchronous emergency copy in `localStorage`** when the page is hidden or closing. IndexedDB writes are asynchronous and the browser may stop the page before one finishes, which an E2E test reproduced (reloading right after a change lost it). `localStorage.setItem` finishes before the page goes. On the next start the copy is restored and moved into IndexedDB. It is skipped above 2 MB, where the normal save is the protection.
- The code the save needs is loaded at start-up, because a first save that began while the page was closing could not download it.
- **Recent projects** are kept as a light summary (name, size, thumbnail) apart from the data, so listing them never loads pixels.
- **Installable and offline** with `vite-plugin-pwa`: a service worker precaches the whole editor (about 700 kB), including the on-demand chunks and the Latin fonts. Fonts for other scripts are cached when first used.
- **Updates are never applied by surprise.** A new version waits, and the status bar offers `Reload to update`; before reloading the page saves the drawing.
- The service worker and manifest are served with `no-cache` so a deployment is noticed on the next visit.

## Alternatives considered

- **`beforeunload` with IndexedDB only.** Not reliable, as the test showed.
- **Applying updates automatically.** Simpler, but a reload in the middle of a stroke is exactly what this ADR exists to prevent.

## Consequences

- Two stores can hold the same project for a moment; the emergency copy always wins and is deleted after a successful IndexedDB write.
- A drawing too large for the 20 MB limit shows an error instead of failing silently.
