// Photo analysis stays local. Only pinned public model assets are fetched at build time.
import { readFile, mkdir, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname,'..'), target = resolve(root,'public/vision');
const models = JSON.parse(await readFile(resolve(import.meta.dirname,'vision-models.json'),'utf8'));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
await mkdir(resolve(target,'mediapipe'),{recursive:true});
await mkdir(resolve(target,'onnx'),{recursive:true});
await Promise.all(models.map(async model => {
  const destination=resolve(target,model.file);
  try { if(digest(await readFile(destination))===model.sha256) return; } catch {}
  const response=await fetch(model.url,{signal:AbortSignal.timeout(120000)});
  if(!response.ok) throw new Error(`Model download failed: ${model.file} (${response.status})`);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(digest(bytes)!==model.sha256) throw new Error(`Model checksum mismatch: ${model.file}. Review the upstream asset before updating the pinned hash.`);
  await writeFile(destination,bytes);
}));
const mediapipe = dirname(require.resolve('@mediapipe/tasks-vision'));
for(const name of ['vision_wasm_internal.js','vision_wasm_internal.wasm','vision_wasm_nosimd_internal.js','vision_wasm_nosimd_internal.wasm']) await copyFile(resolve(mediapipe,'wasm',name),resolve(target,'mediapipe',name));
const onnx = dirname(require.resolve('onnxruntime-web/wasm'));
for(const name of ['ort-wasm-simd-threaded.mjs','ort-wasm-simd-threaded.wasm']) await copyFile(resolve(onnx,name),resolve(target,'onnx',name));
console.log('Local photo-checker assets ready (verified model checksums).');
