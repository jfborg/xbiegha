# Xbieha improvement backlog

Audit date: 2 November 2026. Audited commit: `3383c8d` on `main` of github.com/jfborg/xbiegha ("Offer a native save-location chooser for finished videos"). The local working copy under `outputs/xbiegha` was byte-identical to that commit at audit time.

This file is a hand-off for a future implementation pass. Each item states what was found, why it matters, how to fix it, and how to verify the fix. Items are ordered by value. None of them is a correctness bug in the current build; they are robustness, scale, tooling and polish improvements. Read "Constraints and verification" at the end before changing anything.

## Verified facts about the current build

- `node --test tests/*.test.mjs` on Node 24.19.0: 46 tests, 46 pass.
- `tsc -b`: no errors.
- Production bundle (`dist/`): one eager JavaScript chunk of about 376 KB plus 94 KB of CSS. The vision (MediaPipe + ONNX Runtime), mediabunny, pdf-lib and VideoStudio chunks are all lazy-loaded. Keep it that way.
- Live site https://xbieha.com serves the CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy and nosniff headers from `vercel.json`, plus Vercel's own HSTS. The old domain `xbiegha.com` 308-redirects to the new one except `/recover/`, which still serves the recovery page. `/robots.txt` returns 404.
- Static files under `public/` (including the ~40 MB of vision models and WASM) are served with `cache-control: public, max-age=0, must-revalidate` and an ETag, so repeat visits revalidate rather than re-download.

---

## 1. Stop loading every saved photo into memory at startup

**Severity: high (scalability / mobile stability).**

**Finding.** `src/storage.ts` `listProjects()` does `getAll()` on the `projects` store and returns full `Project` objects, each of which carries every photo as a base64 data URL (up to 8 photos × 35 MB per collage, up to 30 resized slides per slideshow, plus a soundtrack data URL of up to 28 MB in `slideshow.audio.src`). `src/App.tsx` calls `refresh()` on mount and whenever the user opens "My projects", so the whole library is deserialised and held in React state just to render thumbnails, mode and date in the gallery. With a dozen projects this is hundreds of megabytes on a phone and a likely tab crash.

**Fix.**

1. In `src/storage.ts`:
   - Add `export type ProjectSummary = Omit<Project, 'photos' | 'slideshow'> & { photoCount: number }` (or keep the `Project` type and return `photos: []`; the summary type is cleaner).
   - Rewrite `listProjects()` to iterate with `openCursor()` and push only `{ ...rest, photoCount: photos.length }` without `photos` and without `slideshow.audio`. A cursor still deserialises each record, but one at a time, so peak memory is one project instead of all of them.
   - Add `export async function loadProject(id: string): Promise<Project | undefined>` using `get(id)`.
2. In `src/App.tsx`:
   - `projects` state becomes `ProjectSummary[]`.
   - `showProjectGrid` currently calls `openProject(p)` with the gallery item. Replace with an async `openSaved(id)` that calls `loadProject(id)`, shows the `busy` pill while loading, then calls `openProject(full)`; notify on failure.
   - The autosave effect does `setProjects(p => [saved, ...p.filter(...)])` with the full project. Insert a summary instead (strip `photos` and `slideshow.audio`).
   - `openProject()` saves the previous project and then inserts `previous` into `projects`; strip it to a summary there too. It also reads `projects.find(...)?.thumbnail`, which still works on summaries.
   - The autosave guard `projects.some(p => p.id === project.id)` still works.
3. `public/recover/recover.js` reads the same database from the old domain and only needs `name`, `photos.length`, `mode`, `updated`; it already uses `getAll()` and produces a backup per project, which needs the full data, so leave it alone.

**Verify.** Create 5+ collages, reload, open "My projects": gallery shows thumbnails; opening a card restores the full project with all photos; autosave keeps the gallery order by recency; deleting still works; the recovery page on the old domain still lists and downloads projects. No existing test covers storage (needs IndexedDB); do not add a fake IndexedDB dependency just for this, verify in the browser.

---

## 2. Add a top-level React error boundary

**Severity: medium (robustness).**

**Finding.** `src/main.tsx` renders `<App/>` directly. Any uncaught render error blanks the page with no explanation and no way back. Autosave runs 900 ms after each change, so data loss is small, but the user sees nothing.

**Fix.** Add `src/ErrorBoundary.tsx` (class component with `getDerivedStateFromError` and `componentDidCatch` logging `console.error`). Wrap `<App/>` in `main.tsx`. The fallback should match the studio's voice and tokens (see `src/styles.css`, cream background `#f8f4ee`, navy `#0b1826`, copper `#bb8460`): a short heading, one sentence saying saved projects are still in this browser, a "Reload the studio" button (`location.reload()`), and links to `/privacy.html` and `/terms.html`. No network calls, no telemetry; the privacy notice promises none.

**Verify.** Temporarily throw inside a component, confirm the fallback renders and Reload restores the app; remove the throw.

---

## 3. One Unicode-aware file-name helper instead of four ASCII copies

**Severity: medium (UX for non-Latin names, duplication).**

**Finding.** The same sanitiser appears in four places with slightly different behaviour:

- `src/App.tsx` function `safeName` (bottom of file): `name.trim().replace(/[^a-zA-Z0-9 _-]/g,'').replace(/\s+/g,'-').slice(0,70) || 'xbieha-image'`.
- `src/SaveToPhotos.tsx`, inside the `prepareImageExport` effect: identical regex, fallback `'xbieha-image'`.
- `src/SlideshowStudio.tsx`, inside `SlideExport.generate()`: identical regex, fallback `'xbieha-slideshow'`.
- `public/recover/recover.js`: identical regex, fallback `'project'`.
- `src/VideoStudio.tsx`, inside `VideoExport.render()`: a different, Unicode-aware rule `replace(/[^\p{L}\p{N} _.-]/gu, '-').slice(0, 80)`.

The ASCII versions delete every non-ASCII character, so a project named in Arabic, Greek, Maltese with accents, or any other non-Latin script exports as `xbieha-image.jpg`. The video editor already handles this correctly.

**Fix.**

1. Add `src/fileName.ts`:
   ```ts
   // Shared by image, backup, slideshow and video exports. Keeps letters and digits
   // from any script, drops characters that are unsafe on Windows/macOS/iOS file systems.
   export function fileName(name: string, fallback: string) {
     return name.normalize('NFC').replace(/[^\p{L}\p{N} _-]/gu, '').trim().replace(/\s+/g, '-').slice(0, 70) || fallback;
   }
   ```
   Do not allow `.` (avoids trailing-dot names on Windows and double extensions); the allowlist already excludes `<>:"/\|?*` and control characters.
2. Replace the four TypeScript copies with calls to `fileName(...)` (keep each call's existing fallback). `src/fileName.ts` must not import anything, so the Node test runner can load it (see constraints).
3. `public/recover/recover.js` is plain JavaScript served statically and cannot import the TS module; update its regex and `normalize('NFC')` to match the helper exactly, with a comment pointing at `src/fileName.ts`.
4. Add `tests/fileName.test.mjs` covering: Arabic and accented names survive; spaces collapse to hyphens; path separators, quotes and emoji are removed; empty input yields the fallback; length is capped at 70.

**Verify.** `node --test tests/*.test.mjs`; export an image from a project named `صيف ٢٠٢٦` and confirm the downloaded file keeps the name.

---

## 4. Continuous integration on GitHub

**Severity: medium (process).**

**Finding.** The repository has no `.github/` directory. Tests and the type check only run when someone runs them locally. Vercel builds on push but does not run tests.

**Fix.** Add `.github/workflows/ci.yml`:

- Trigger on `push` to `main` and on `pull_request`.
- `actions/checkout`, then `corepack enable` so pnpm comes from the `packageManager` field (`pnpm@11.25.0`), then `actions/setup-node` with `node-version: 24` and `cache: pnpm`.
- Steps: `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm exec tsc -b`, `pnpm build`.
- `pnpm build` runs `scripts/prepare-vision.mjs`, which downloads two pinned model files (about 4 MB) from Google Storage and GitHub and verifies SHA-256. Optionally cache `public/vision/*.task` and `public/vision/*.onnx` with `actions/cache` keyed on `hashFiles('scripts/vision-models.json')`.
- Add a status badge to the README.

**Verify.** The first workflow run on `main` is green.

---

## 5. Pin the toolchain in the repo, not just in the README

**Severity: low.**

**Finding.** `README.md` says "Use Node.js 24 and pnpm 11.25.0". `package.json` pins `packageManager` but has no `engines` field, and there is no `.node-version` or `.nvmrc`. The tests import `.ts` files directly and rely on Node's built-in type stripping, which requires Node 22.6+ with a flag or Node 23.6+ by default, so an older Node fails with an unhelpful error.

**Fix.** Add `"engines": { "node": ">=24" }` to `package.json` and a `.node-version` file containing `24`. Mention both in the README "Run" section.

---

## 6. Social preview, Twitter card and robots.txt

**Severity: low (discoverability).**

**Finding.** `index.html` has `og:title`, `og:description`, `og:url`, `og:site_name` and `og:type` but no `og:image`, so shared links show no picture. There is no Twitter card. `/robots.txt` is a 404 on the live site.

**Fix.**

- Add to `index.html`: `og:image` pointing at an absolute URL, `og:image:width`/`og:image:height`, `og:image:alt`, `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`. Quickest option is the existing `/icon-512.png` (512 × 512, `twitter:card` = `summary`). Better option: add a 1200 × 630 `public/social-card.png` built from the logo and palette and use `summary_large_image`.
- Add `public/robots.txt`:
  ```
  User-agent: *
  Allow: /
  Disallow: /recover/
  ```
  (`/recover/index.html` already carries `noindex`.)

---

## 7. Minor code-quality items (safe, small)

- `src/App.tsx`, the keyboard-shortcut `useEffect` (handles ⌘Z / ⌘S) has no dependency array, so it re-subscribes on every render. Same for the keyboard effect near the end of `VideoStudio` in `src/VideoStudio.tsx`. Either give them correct dependency arrays or keep the latest handlers in a ref and subscribe once.
- `src/App.tsx` `importBackup()` validates most fields but not `photo.flip` (should be a boolean), `p.look` (should be `{ id: string; amount: number }` with a known id, or absent) or a stray `thumbnail` string in the backup (should be dropped; `createBackup` never writes one but a hand-edited file could). Add those checks next to the existing ones.
- `src/App.tsx` `Modal` focus-trap selector `button:not(:disabled), input, select, a[href], [tabindex="0"]` does not exclude disabled inputs/selects; use `:not(:disabled)` on those too.
- `src/ExportPreview.tsx`, `src/SaveToPhotos.tsx` and the slideshow export each render the project independently when the export dialog opens. This is intentional (Safari user-activation rules for Save to Photos) and documented in comments; do not "optimise" it away without re-testing on iPhone.

---

## 8. Documentation

Update `README.md` when the above lands: gallery loading behaviour, error boundary, shared file-name rule (and that non-Latin names are preserved), CI badge and commands, `engines`/`.node-version`.

---

## Deferred: needs a decision or a dedicated pass

These were considered and deliberately not included above.

**Dependency upgrades.** Latest versions at audit time versus `package.json`:

| Package | In repo | Latest |
| --- | --- | --- |
| vite | ^7.1.12 | 8.3.5 |
| @vitejs/plugin-react | ^5.0.4 | 6.2.1 |
| typescript | ^5.9.3 | 7.0.2 |
| react / react-dom | ^19.2.0 | 19.3.1 |
| lucide-react | ^0.468.0 | 1.66.0 |
| mediabunny | 1.63.0 (exact) | 1.65.0 |
| onnxruntime-web | 1.25.1 (exact) | 1.31.1 |
| @mediapipe/tasks-vision | 0.10.35 (exact) | 1.2.0 |
| @framefind/core | 0.4.1 | 0.4.1 |
| pdf-lib | ^1.17.1 | 1.17.1 |

Do these in their own pass with the browser test page `tests/video-browser.html` and a real passport-photo check on iPhone Safari and desktop Chrome. Watch-outs: `scripts/prepare-vision.mjs` copies WASM files by exact name from `@mediapipe/tasks-vision/wasm` and `onnxruntime-web/wasm`; an ORT or MediaPipe bump can rename those files and must be reflected there and in `public/vision/README.md`. `vite.config.ts` aliases `onnxruntime-web` to `onnxruntime-web/wasm` and sets custom `resolve.conditions`; re-check after a Vite major. MediaPipe 0.10 → 1.x is a major API change for `FaceLandmarker`/`FilesetResolver` in `src/vision.ts`. The MIT/Apache licence files in `public/vision/` must match the shipped versions.

**Reformatting the source.** `src/App.tsx` is ~59 KB in 185 lines; most files use very long single-line statements. Running Prettier would make diffs reviewable but produces a whole-repository change. Owner's call.

**Long cache lifetime for `/vision/*` and `/samples/*`.** Currently `max-age=0, must-revalidate` (one conditional request per file per visit). A `vercel.json` header rule such as `Cache-Control: public, max-age=604800, stale-while-revalidate=86400` for `/vision/(.*)` would remove those requests. Trade-off: the file names are not content-hashed, so after a model or WASM upgrade some browsers would use stale files for up to a week unless the folder is versioned (for example `/vision/v2/`).

**Cross-origin isolation (COOP/COEP).** Would let ONNX Runtime use multi-threaded WASM. Everything is self-hosted so it should work, but it must be tested against `URL.createObjectURL` video playback and the Web Share flows before shipping.

**Offline / service worker.** Natural fit for an on-device app, but caching ~40 MB of models and handling updates safely is its own project.

**LICENSE.** The public repository has no licence file, which means "all rights reserved" by default. Decide whether that is intended.

---

## Constraints and verification

- **Node test runner and `.ts` imports.** Tests import source files directly (for example `../src/looks.ts`). Node resolves these with type stripping and requires explicit file extensions on relative imports in any module the tests reach at runtime. That is why `src/looks.ts` imports `./model.ts` and `src/compliance.ts` imports `./passport.ts` with extensions, while type-only imports can stay extensionless (they are erased). New modules that tests touch must follow the same rule, and `tsconfig.json` already has `allowImportingTsExtensions`.
- **Lazy loading is a feature.** Keep `vision.ts`, `slideshowExport.ts`, `pdf-lib` and `VideoStudio` behind dynamic imports.
- **Privacy promises.** `public/privacy.html` and the README state there is no analytics, no telemetry and no uploads. Do not add any network call, including error reporting.
- **Document-photo guards.** Nothing in this backlog touches `src/compliance.ts`, `src/passport.ts`, `src/visionRules.ts` or the export locks; keep it that way unless a requirement changes, and keep the versioned terms id (`terms-2026-10-30`) in sync with `public/terms.html`.
- **Before and after every change:**
  ```sh
  pnpm install --frozen-lockfile
  pnpm test
  pnpm exec tsc -b
  pnpm build
  ```
  plus a manual pass through collage, editor, passport (with the sample portrait, which must still be blocked from export), slideshow export and video export in Chrome and Safari.
- **Keep the GitHub repository and the local `outputs/xbiegha` folder identical.** The local folder is not a git checkout. Either work in a proper clone and copy the result back, or run `git init`, add `origin https://github.com/jfborg/xbiegha.git`, `git fetch origin`, `git reset origin/main` (files already match, so the tree is clean), then commit and push from there. Vercel deploys `main` automatically; confirm the deployment at https://xbieha.com afterwards.
