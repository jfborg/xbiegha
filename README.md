# Xbiegha

A personal photo studio for collages, passport photo preparation, and everyday editing. React, TypeScript, Vite, and the browser Canvas API. Designed for **xbiegha.com**, hosted on Vercel.

## Features

- Collages with 1–8 photos, three responsive arrangements, four aspect ratios, custom backgrounds, spacing, rounded corners, and captions.
- Photo cropping, repositioning, zoom, rotation, mirroring, exposure, contrast, saturation, warmth, fade, vignette, and six original colour presets.
- Malta, UK and US **printed** passport photo sizing, manual positioning guides and a pre-export checklist. Exports 300-DPI JPEGs and physically sized 4 × 6 inch PDF print sheets.
- PNG, JPEG and WebP exports up to 3,600 pixels on the long edge, without watermarks.
- Undo/redo, browser-local IndexedDB project saving, editable `.xbiegha` backups, and restore/import.
- Responsive desktop and mobile interface, self-hosted fonts, accessible labels, keyboard shortcuts, reduced-motion support, and a custom SVG logo.

## Privacy and storage

Image processing happens on the device. No application server, accounts, image uploads, analytics, AI API keys, or paid processing services are required. Vercel serves the app and bundled demonstration assets. Imported images and saved projects remain in this browser’s IndexedDB. Browser storage is not a backup: clearing site data removes projects. Use **Save project** for an independent editable backup.

## Run

Use Node.js 24 and pnpm 11.25.0:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

```sh
pnpm test
pnpm build
pnpm preview
```

Vercel framework: **Vite**. Build: `pnpm build`. Output: `dist`. Production branch: `main`. No environment variables required. Connect this repository to Vercel for deployment on push.

## Passport photos

This is a photo positioning and print-size tool, not an automated biometric compliance service. Guides do not detect a face or certify acceptance. It intentionally does not apply editing filters in passport mode. Use a recent, unaltered original against the background required by the issuing authority. The bundled sample portrait is for demonstrating the tools only and is not an example of a compliant passport photo. Check whether your application accepts supplied printed photos; Malta normally captures adult passport photographs at its office. Online application requirements differ from printed-photo requirements.

- [Malta: Identità](https://identita.gov.mt/frequently-asked-questions/passport/)
- [United Kingdom: printed passport photos](https://www.gov.uk/photos-for-passports/photo-requirements)
- [United States: passport photos](https://travel.state.gov/en/passports/apply/help/photos.html)

Print PDF sheets on 4 × 6 inch photographic paper at **100% / Actual size**, with scaling and fit-to-page disabled. JPEG exports contain 300-DPI JFIF metadata. Document acceptance remains with the issuing authority.

## File support

JPEG, PNG, WebP and AVIF, up to 35 MB / 50 megapixels per image. HEIC should be exported to JPEG using Photos before importing. Colour adjustments are browser-side RGB operations; this is not a colour-managed professional RAW editor. Upscaling does not restore missing source detail. Collages contain up to 8 images; editing and passport mode use one image.

## Design assets

Custom Xbiegha logo: `public/logo.svg`. Fonts: DM Sans and Newsreader, distributed through Fontsource under their included open font licences. Bundled demonstration photographs are from Unsplash and governed by the [Unsplash licence](https://unsplash.com/license):

- `photo-1533105079780-92b9be482077` — coast
- `photo-1516483638261-f4dbaf036963` — coastal village
- `photo-1476514525535-07fb3b4ae5f1` — lake
- `photo-1500534623283-312aade485b7` — landscape
- `photo-1494790108377-be9c29b29330` — portrait

No subscription-app source code, logos, templates, or paid assets are included.
