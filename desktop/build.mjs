import { packager } from '@electron/packager';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { tmpdir } from 'node:os';

if (process.platform !== 'darwin') throw new Error('Build the Mac app on macOS.');
const here = path.dirname(fileURLToPath(import.meta.url));
const staging = path.join(here, 'staging'), icons = path.join(here, 'icons');
await rm(staging, { recursive: true, force: true });
await mkdir(staging, { recursive: true });
await mkdir(path.join(icons, 'Xbieha.iconset'), { recursive: true });
for (const file of ['main.cjs', 'preload.cjs', 'library.cjs']) await cp(path.join(here, file), path.join(staging, file));
await cp(path.join(here, '..', 'dist'), path.join(staging, 'web'), { recursive: true });
await cp(path.join(here, 'privacy-mac.html'), path.join(staging, 'web', 'privacy.html'));
await writeFile(path.join(staging, 'package.json'), JSON.stringify({ name: 'xbieha', productName: 'Xbieha', version: '1.0.0', main: 'main.cjs', description: 'Your personal creative studio, saved on your Mac.' }));
execFileSync('swift', [path.join(here, 'icon.swift'), path.join(icons, 'icon-1024.png')], { stdio: 'inherit' });
for (const size of [16, 32, 128, 256, 512]) for (const retina of [false, true]) {
  const pixels = size * (retina ? 2 : 1);
  execFileSync('sips', ['-z', String(pixels), String(pixels), path.join(icons, 'icon-1024.png'), '--out', path.join(icons, 'Xbieha.iconset', `icon_${size}x${size}${retina ? '@2x' : ''}.png`)], { stdio: 'ignore' });
}
execFileSync('iconutil', ['-c', 'icns', path.join(icons, 'Xbieha.iconset'), '-o', path.join(icons, 'Xbieha.icns')]);
const results = await packager({ dir: staging, name: 'Xbieha', platform: 'darwin', arch: process.arch, electronVersion: '45.2.1', appBundleId: 'com.xbieha.studio', appCategoryType: 'public.app-category.photography', icon: path.join(icons, 'Xbieha.icns'), out: path.join(tmpdir(), 'xbieha-mac-build'), overwrite: true, asar: true, prune: false,
  extendInfo: { NSHumanReadableCopyright: 'Xbieha — Your personal creative studio', LSMinimumSystemVersion: '12.0' },
  osxSign: { identity: '-', identityValidation: false, optionsForFile: () => ({ entitlements: path.join(here, 'entitlements.plist'), hardenedRuntime: true }) },
});
for (const result of results) console.log(`Mac app: ${path.join(result, 'Xbieha.app')}`);
