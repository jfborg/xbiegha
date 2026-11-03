# Xbieha

[![CI](https://github.com/jfborg/xbiegha/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/jfborg/xbiegha/actions/workflows/ci.yml)

A personal photo studio for collages, passport photo preparation, everyday editing, and slideshows. React, TypeScript, Vite, and the browser Canvas API. Designed for **xbieha.com**, hosted on Vercel.

## Features

- Slideshow studio: up to 30 photos, per-photo timing (1–10 seconds), captions, reorder, four transitions, gentle motion, three visual themes, 30 colour looks, and 16:9 / 9:16 / 1:1 / 4:5 formats. Import your own soundtrack (20 MB / 10 minutes), set its start and volume, and loop it to fit with automatic fades.
- On-device 30 fps video export at 1920px or 1280px long edge. Mediabunny/WebCodecs is loaded only for music import or video export. MP4 (H.264/AAC) and WebM (VP8/Opus) are offered only when this browser can encode the selected video/audio combination. A prepared file opens native sharing from a direct user gesture; iPhone Save Video availability depends on browser and format. Download is explicitly labelled as Files / Downloads.

- Collages with 1–8 photos, three responsive arrangements, four aspect ratios, custom backgrounds, spacing, rounded corners, and captions. A visible Reorder photos control opens an arrangement list: use arrows on phones or drag on desktop; crops stay with each photo and undo/redo is supported.
- Photo cropping, repositioning, zoom, rotation, mirroring, exposure, contrast, saturation, warmth, fade, vignette, and 30 original looks across Everyday, Sunlit, Film, Cool, Moody and Black & White. Search, full-strength canvas previews, adjustable intensity, tint and stable film grain are included.
- 20 document/submission profiles across 14 countries and territories, including UAE passport, Emirates ID, Dubai/RTA, Abu Dhabi/TAMM and other emirates/MOI driving routes. Printed and digital contracts are separate.
- Automatic on-device face, glasses, expression, pose, eye, colour, background and detail screening after import/capture and crop changes. Failures lock document exports; uncertain findings require explicit personal review.
- Measured head/crown/chin guides, source-resolution and recency checks, explicit application upload limits, exact JPEG pixel dimensions and physically sized 4 × 6 inch PDF sheets.
- Versioned terms and photo limitations, privacy notice, contextual warnings and a required document-export acknowledgement.
- PNG, JPEG and WebP exports up to 3,600 pixels on the long edge, without watermarks.
- Save to Photos opens a full-resolution image with iPhone touch-and-hold instructions. Choose Save to Photos / Add to Photos / Save Image from the native image menu. Optional sharing is separate; Download image file is explicitly labelled as a Files / Downloads destination. Both routes use the same export validation.
- Undo/redo, browser-local IndexedDB project saving, editable `.xbieha` backups, and restore/import (including legacy `.xbiegha` files).
- Responsive desktop and mobile interface, self-hosted fonts, accessible labels, keyboard shortcuts, reduced-motion support, and a custom SVG logo.

## Privacy and storage

Image, slideshow and audio processing happens on the device. Slideshow imports are resized to at most 2560px on the long edge to keep local storage and rendering practical; original files are untouched. Imported soundtrack data is included in local projects and editable backups. No application server, accounts, image uploads, analytics, AI API keys, or paid processing services are required. Vercel serves the app and bundled demonstration assets. Imported images and saved projects remain in this browser’s IndexedDB. Browser storage is not a backup: clearing site data removes projects. Use **Download backup** for an independent editable backup. Save to Photos prepares a local image for the browser’s native image menu. If you choose More sharing options, the finished image is handed to your device’s sharing interface; any destination you choose handles it independently.

## Saved-project gallery and recovery

The gallery keeps lightweight project summaries: the saved thumbnail, name, mode, date and photo count. IndexedDB records are read one at a time with a cursor; full photo and slideshow/soundtrack payloads are not retained in gallery state. Opening a card loads that one full project on demand, shows a loading indicator and reports a missing or unreadable project. Autosave and tool switching also insert summaries, preserving recent-first ordering. The database name and saved-project format are unchanged; old-domain recovery still reads full records to make editable backups.

A top-level React error boundary replaces an unexpected rendering failure with a branded recovery screen, a **Reload the studio** button and privacy/terms links. Saved projects remain in the browser; unsaved changes are not guaranteed. Error details go only to the local browser console, with no reporting service or telemetry.

## Export names and backup validation

Image, editable-backup, slideshow and video exports share `src/fileName.ts`. Names are normalized to NFC and preserve Unicode letters and digits, including Arabic, Greek and accented Maltese. Leading/trailing spaces are removed, repeated spaces become hyphens, and names are limited to 70 characters before the extension. Underscores and hyphens are retained; dots, path separators, quotes, emoji and other unsupported characters are removed. Empty results use each export's existing fallback. The static recovery page mirrors this rule because it cannot import TypeScript. For example, `صيف ٢٠٢٦` exports as `صيف-٢٠٢٦.png` when PNG is selected.

Imported backups require a boolean photo flip and, when present, a known look id with a finite strength from 0–100. Legacy backups without look metadata remain supported. Supplied thumbnails are discarded and regenerated locally. Photo and video keyboard listeners subscribe once while using the current handlers; modal tab navigation skips disabled inputs and selects. The separate image/export renders remain intentional for Safari's user-activation rules.

## Run

Use Node.js 24 and pnpm 11.25.0. `.node-version` selects Node 24, `package.json` declares `engines.node >=24`, and its `packageManager` field pins pnpm. The Node test runner uses built-in TypeScript stripping, so older Node versions are not supported:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

```sh
pnpm test
pnpm exec tsc -b
pnpm build
pnpm preview
```

GitHub CI runs the frozen install, tests, explicit type check and production build on every push to `main` and every pull request. The badge above links to its results. CI enables Corepack before Node setup so pnpm comes from `packageManager`; no deployment credentials are needed. The build downloads only the existing pinned vision models and checks their SHA-256 hashes.

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

Custom Xbieha logo: `public/logo.svg`. Fonts: DM Sans and Newsreader, distributed through Fontsource under their included open font licences. Bundled demonstration photographs are from Unsplash and governed by the [Unsplash licence](https://unsplash.com/license):

- `photo-1533105079780-92b9be482077` — coast
- `photo-1516483638261-f4dbaf036963` — coastal village
- `photo-1476514525535-07fb3b4ae5f1` — lake
- `photo-1500534623283-312aade485b7` — landscape
- `photo-1494790108377-be9c29b29330` — portrait

No subscription-app source code, logos, templates, or paid assets are included.

## Studio UI refresh (30 October 2026)

The interface uses Portico Events’ published palette: navy `#0b1826`, copper `#bb8460`, light copper `#e2ad85`, cream `#f5d4b5` and paper `#f2eadc`. Small copper text uses a darker shade for contrast on light backgrounds. The Xbieha symbol remains its own mark.

The responsive studio keeps all seven navigation choices labelled on phones, provides a direct Controls shortcut, and makes editable backups available in the controls footer. Collage replacement updates only the selected photo; the other images and order are preserved. Spacing controls now show percentages of canvas width, matching the renderer’s scaling.

Document review prioritises detected problems, groups clear findings behind an expandable summary, keeps the chosen authority route visible, and groups measurements and human confirmations with progress counts. No official requirements, export guards, or legal acknowledgements were removed. Brand colours are for the interface and optional collage backgrounds, never document-photo background replacement.

## Looks library and photo-library saving

All 30 looks are original parameter recipes. The gallery, working canvas, saved thumbnails and exports share one renderer. Intensity ranges from 0–100%; choosing Original resets colour while keeping the crop and layout. Tint and deterministic grain supplement the original six adjustments. Legacy six-field projects and backups remain supported; look identity and strength travel with new backups. Passport mode bypasses all colour effects.

The photo-library action displays an actual full-resolution JPEG/PNG image with a data URL, separate from file downloading. Native touch-and-hold and sharing menus depend on the device/browser. Xbieha does not claim the image was saved or write directly into a photo library. If an embedded browser omits saving, use Safari. Physical iPhone end-to-end verification is still needed.

## Domain migration

The public brand and canonical address are Xbieha at https://xbieha.com. The existing GitHub repository and Vercel project retain their original internal names. Old-domain requests permanently redirect to the same path at the new domain, except `/recover/`, a read-only local-project recovery utility. Projects are browser-origin scoped: users download backups on https://xbiegha.com/recover/ in their original browser and import them on Xbieha. No photos or projects are uploaded by this flow. The IndexedDB name `xbiegha-studio` stays unchanged for compatibility.

The custom X symbol is configured as an SVG favicon, 192px and 512px install icons (including a maskable icon), and a 180px Apple touch icon.


## Video editor

Open `/?tool=video`, the Video editor sidebar item, or its studio card. This standalone tool is lazy loaded and does not change the existing photo/slideshow project format. It cuts and trims original footage, orders and duplicates clips, removes unwanted parts, and applies a straight cut, cross dissolve, fade through black, slide left or wipe right per join. Overlap is capped to half of both neighbouring clips so three clips never overlap. Source audio follows trim/order/volume and transition envelopes. Preview and export share the same media engine. Original file timestamps and rotation metadata are respected.

After **Create video**, **Save video…** opens a native file chooser with the suggested movie name where the browser supports it. Otherwise it opens the device’s file-sharing menu, like the other studio tools; available destinations depend on the device and video format. Cancelling keeps the prepared video available. **Download video file** is a separate fallback using the browser’s normal download location. Save failures never silently download the movie.

The current draft and original source File objects save in the separate `xbieha-video` IndexedDB database. New movie replaces the draft after confirmation. Undo/redo is session-local; source files are retained for undo until New movie. Browser eviction or storage exhaustion can prevent recovery, and the interface reports save failures. No source video or audio leaves the device.

Limits: 12 source files, 500 MB each, 1 GB combined; 40 clips; source duration up to 60 minutes; finished movie up to 10 minutes. A long source can be imported and trimmed, while export stays disabled until the movie fits. MP4/H.264/AAC and WebM/VP8/Opus availability is detected locally. Output is 30 fps at a longest edge of 1280 or 1920 pixels, with original, landscape, portrait or square framing. Videos are re-encoded; HDR colour and specialist multichannel audio are not production mastering features. Preview/export need a current browser with supported WebCodecs.

`public/video-icon.svg` is a custom navy/copper film-and-cut symbol. It is integrated into the editor and navigation, has 192px/512px install PNGs and a 180px Apple touch icon, and is configured in the tool-specific `video.webmanifest`. The main install manifest offers a Video editor shortcut.

Verification: `tests/video.test.mjs` covers cut boundaries, overlap duration, audio gain envelopes, clip reordering and output dimensions. The development-only `tests/video-browser.html` generates known video/audio scenes, checks all five transitions, decodes actual MP4 exports, and verifies cancellation. It is not copied to the production build.

## Improvement pass verification — 3 November 2026

Implemented backlog items 1–8 in their stated order from commit `3383c8d`; the starting local source matched that commit. The audited backlog is retained in `IMPROVEMENT-BACKLOG.md`.

- Baseline: 46 tests passed. Final implementation: 52 tests passed, including five Unicode filename cases and invalid/legacy look metadata coverage. `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm exec tsc -b` and `pnpm build` passed on Node 24.22.1 / pnpm 11.25.0. The passing checks after each item provided the baseline for the next item; all were repeated before the documentation commit.
- Chrome: created five sample collages, reloaded the gallery, checked thumbnails, restored all three photos, edited an older project to the top and deleted one test project. Confirmed the error fallback with a temporary render throw, then removed it and reloaded successfully. Photo editor and video undo used the latest edit state. Invalid flip/unknown-look imports were rejected and a valid backup restored.
- Chrome and desktop Safari: exercised collage, photo editor and passport sample; document JPEG, print-sheet and Photos exports remained blocked. Both browsers rendered a four-photo 12-second 1080p MP4 slideshow and an eight-second 720p MP4 video from the existing local verification fixture, with completed export previews and download actions. Safari's full-resolution Save to Photos view was checked.
- The in-app browser confirmed actual downloaded files named `صيف-٢٠٢٦.png` and the old-domain `A-slower-kind-of-summer.xbieha` recovery backup. Old-domain recovery also listed saved projects in Chrome. Native camera-roll insertion on a physical iPhone remains outside this desktop pass.
- Production output retains separate lazy chunks for the vision checker, slideshow encoder, video editor, media engine and PDF library. No dependencies, lockfile, cache/cross-origin headers, document-photo rules, export guards or terms version were changed. No telemetry, upload or service-worker code was added.

Implementation choices: social previews use the existing 512px branded icon with a summary card, one of item 6's specified options. CI actions are pinned to official release commit hashes. Browser checks were performed on the affected flows during the work and across all tools at the end, rather than repeating every tool before and after each small item. GitHub CI and the production build identity must also be checked after pushing; the CI badge links to the current result.
