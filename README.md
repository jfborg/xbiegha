# Xbiegha

A personal photo studio for collages, passport photo preparation, and everyday editing. React, TypeScript, Vite, and the browser Canvas API. Designed for **xbiegha.com**, hosted on Vercel.

## Features

- Collages with 1–8 photos, three responsive arrangements, four aspect ratios, custom backgrounds, spacing, rounded corners, and captions.
- Photo cropping, repositioning, zoom, rotation, mirroring, exposure, contrast, saturation, warmth, fade, vignette, and six original colour presets.
- 20 document/submission profiles across 14 countries and territories, including UAE passport, Emirates ID, Dubai/RTA, Abu Dhabi/TAMM and other emirates/MOI driving routes. Printed and digital contracts are separate.
- Automatic on-device face, glasses, expression, pose, eye, colour, background and detail screening after import/capture and crop changes. Failures lock document exports; uncertain findings require explicit personal review.
- Measured head/crown/chin guides, source-resolution and recency checks, explicit application upload limits, exact JPEG pixel dimensions and physically sized 4 × 6 inch PDF sheets.
- Versioned terms and photo limitations, privacy notice, contextual warnings and a required document-export acknowledgement.
- PNG, JPEG and WebP exports up to 3,600 pixels on the long edge, without watermarks.
- Save to Photos opens the device share sheet with the finished JPEG or PNG. On iPhone, choose Save Image / Save to Photos. Unsupported browsers offer a full-resolution image to touch and hold or save, alongside the normal download.
- Undo/redo, browser-local IndexedDB project saving, editable `.xbiegha` backups, and restore/import.
- Responsive desktop and mobile interface, self-hosted fonts, accessible labels, keyboard shortcuts, reduced-motion support, and a custom SVG logo.

## Privacy and storage

Image processing happens on the device. No application server, accounts, image uploads, analytics, AI API keys, or paid processing services are required. Vercel serves the app and bundled demonstration assets. Imported images and saved projects remain in this browser’s IndexedDB. Browser storage is not a backup: clearing site data removes projects. Use **Download backup** for an independent editable backup. If you choose Save to Photos, the finished image is handed to your device’s sharing interface; any destination you choose handles it independently.

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

The checker is an aid, not an official acceptance guarantee. It estimates visible features and can miss defects or produce false warnings. The receiving authority decides acceptance. Identity, original capture date, authorised photography, exceptions, paper and endorsements require user/authority verification. The bundled portrait is deliberately a non-compliant demonstration and cannot be exported as a document photo.

Profiles cover standard adults (18+); child/baby exports are blocked. Sources and their review date are included in each profile in `src/passport.ts`. Medical-exemption cases must be handled with the authority. UAE digital and driving routes require dimensions and limits copied from the current application; the app does not invent a universal contract where the public authority guidance does not establish one.

Print routes normally export at 600 DPI (an app quality choice, not a universal official minimum); the Netherlands requires at least 400 DPI. Digital profiles use their actual required pixels. Print PDF sheets at **100% / Actual size**, with scaling disabled, and follow the route's printing conditions. Some authorities require live capture or professional/authorised photography, which this app cannot replace.

The browser downloads about 40 MB of self-hosted code/models on first document-photo use; inference has no per-photo fee. The heavy checker is lazy-loaded. Build-time downloads verify pinned SHA-256 hashes; see `scripts/vision-models.json` and `public/vision/README.md`. Model assets and WASM files are generated, not checked into Git.

## Legal notices

`public/terms.html` and `public/privacy.html` describe the actual local-processing architecture, official-rule and model limitations, non-affiliation, printing/storage risks, and mandatory-rights carve-outs. Export acknowledgement is versioned and held only in page memory; it is not a server-side evidence ledger. Operator identity/contact details were intentionally omitted at the owner's request. That omission and the applicable service/hosting arrangements need to be resolved before claiming a complete public-facing legal/privacy compliance package. Disclaimers do not prevent claims or replace an operator-specific legal review.

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

## Studio UI refresh (30 October 2026)

The interface uses Portico Events’ published palette: navy `#0b1826`, copper `#bb8460`, light copper `#e2ad85`, cream `#f5d4b5` and paper `#f2eadc`. Small copper text uses a darker shade for contrast on light backgrounds. The Xbiegha symbol remains its own mark.

The responsive studio keeps all five navigation choices labelled on phones, provides a direct Controls shortcut, and makes editable backups available in the controls footer. Collage replacement updates only the selected photo; the other images and order are preserved. Spacing controls now show percentages of canvas width, matching the renderer’s scaling.

Document review prioritises detected problems, groups clear findings behind an expandable summary, keeps the chosen authority route visible, and groups measurements and human confirmations with progress counts. No official requirements, export guards, or legal acknowledgements were removed. Brand colours are for the interface and optional collage backgrounds, never document-photo background replacement.
