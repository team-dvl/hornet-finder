# App icon

A Vespa velutina in a target, on the yellow of the Vedrin s'Abeille logo, with
the VSAB hive bars as a faint watermark. The dev icon is purple with a red
"DEV" band, so the dev and prod PWAs installed side by side on a phone cannot
be mistaken for one another.

| File | Role |
|---|---|
| `app-icon.py` | Generator, the single source: colours, hornet, target, DEV band |
| `app-icon.svg`, `app-icon-dev.svg` | Generated SVG sources (512 × 512), committed |
| `build.sh` | Regenerates the SVGs, then the PNG/ICO files below |
| `../scripts/app-icons.cjs` | Renders the SVGs with Chromium (run by `build.sh`) |

The hornet is traced after a photo of a pinned specimen, seen from below
(orange face, triangular eyes cut by the large mandibles, yellow tarsi), in
the photo's own coordinates; the photo itself is not in the repository.

## Rendered files (`frontend/public`)

Each exists for prod and, with a `-dev` suffix, for dev (`vite.config.ts`
picks the dev ones on the Vite dev server).

| File | Size | Shape | Used by |
|---|---|---|---|
| `icons/pwa-192x192.png`, `icons/pwa-512x512.png` | 192, 512 | rounded corners | manifest `purpose: any` (desktop install), home page (`Home.tsx`) |
| `icons/pwa-maskable-192x192.png`, `-512x512.png` | 192, 512 | full bleed | manifest `purpose: maskable` (Android crops it to the launcher's shape) |
| `apple-touch-icon.png` | 180 | full bleed, opaque | iOS home screen (iOS applies its own mask; transparent corners would turn black) |
| `favicon.ico` | 16, 32, 48 | rounded corners | browser tab |

`icons/shortcut-scan-96x96.png` (the "Scanner" shortcut) is a separate
pictogram, not generated here.

`vite.config.ts` references every icon with a hash of its content
(`?v=1a2b3c4d`), so a new icon gets a new URL: prod nginx serves images as
immutable for a year, and iOS keeps touch icons in a cache of its own. On the
dev server, the root paths Safari fetches by itself (`/apple-touch-icon.png`,
`/apple-touch-icon-precomposed.png`, `/favicon.ico`) answer with the dev icons,
otherwise an iPhone home screen gets the prod icon for the dev app.

## Constraints

- Full bleed, no transparency on the maskable and Apple icons.
- Everything that matters stays inside the maskable safe zone: the central
  circle of 80 % of the side. Only the wing tips and the target's ticks go
  beyond it; the DEV band text stays inside.
- Check the result at home-screen size (about 60 pt): the legs have a dark
  contour so the yellow tarsi stay visible on the yellow background.

## Regenerate

```bash
frontend/icons/build.sh
```

Needs `python3` and Docker (Playwright image, same version and cache as
`ui-shots.sh`). Without Docker, with a local Playwright:
`python3 frontend/icons/app-icon.py && node frontend/scripts/app-icons.cjs`
(`CHROMIUM_PATH` selects a Chromium binary if needed).
