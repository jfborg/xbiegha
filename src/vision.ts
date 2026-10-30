import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { GlassesDetector } from '@framefind/core';
import { renderProject } from './render';
import type { Project } from './model';
import { documentSpec } from './passport';
import { visionFindings } from './visionRules';
import type { VisionFinding } from './visionRules';
import { assessmentKey } from './compliance';
export type Assessment = { key: string; findings: VisionFinding[]; estimatedFrame?: { crown: number; chin: number; eyes: number; faceLeft: number; faceRight: number }; error?: string };
let engine: Promise<{ face: FaceLandmarker; glasses: GlassesDetector }> | undefined;
let queue: Promise<unknown> = Promise.resolve();
function loadEngine() {
  if (!engine) engine = (async () => {
    const files = await FilesetResolver.forVisionTasks('/vision/mediapipe');
    const face = await FaceLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: '/vision/face_landmarker.task', delegate: 'CPU' }, runningMode: 'IMAGE', numFaces: 3, outputFaceBlendshapes: true, outputFacialTransformationMatrixes: true, minFaceDetectionConfidence: .6, minFacePresenceConfidence: .6 });
    const glasses = new GlassesDetector({ modelUrl: '/vision/glasses.onnx', wasmPaths: `${location.origin}/vision/onnx/`, autoLandmarks: false, smoothingWindow: 1, preferGpu: false });
    try { await glasses.load(); return { face, glasses }; } catch (error) { face.close(); throw error; }
  })().catch(error => { engine = undefined; throw error; });
  return engine;
}
async function run(project: Project): Promise<Assessment> {
  const key = assessmentKey(project), { face, glasses } = await loadEngine();
  const canvas = document.createElement('canvas');
  await renderProject(canvas, project, 900, true);
  const result = face.detect(canvas), points = result.faceLandmarks[0];
  const spec = documentSpec(project.country);
  if (result.faceLandmarks.length !== 1 || !points) return { key, findings: visionFindings({ faces: result.faceLandmarks.length }) };
  glasses.resetHistory();
  let probability: number | undefined;
  try { probability = (await glasses.detectFromCanvas(canvas, points)).probability; } catch { /* A missing detector is an explicit review result, never a pass. */ }
  const scores = Object.fromEntries((result.faceBlendshapes[0]?.categories || []).map(c => [c.categoryName, c.score]));
  const left = points[33], right = points[263];
  const roll = Math.atan2((right.y - left.y) * canvas.height, (right.x - left.x) * canvas.width) * 180 / Math.PI;
  const matrix = result.facialTransformationMatrixes[0]?.data;
  const yaw = matrix ? Math.asin(Math.max(-1, Math.min(1, -matrix[2]))) * 180 / Math.PI : 0;
  const pitch = matrix ? Math.atan2(matrix[6], matrix[10]) * 180 / Math.PI : 0;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const {data} = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const samples: number[] = [], chromas: number[] = [];
  for (let y = Math.round(canvas.height * .04); y < canvas.height * .18; y += 3) for (let x = Math.round(canvas.width * .03); x < canvas.width * .97; x += 3) {
    if (x > canvas.width * .15 && x < canvas.width * .85) continue;
    const i = (y * canvas.width + x) * 4, r = data[i], g = data[i + 1], b = data[i + 2];
    samples.push(.2126 * r + .7152 * g + .0722 * b); chromas.push(Math.max(r,g,b) - Math.min(r,g,b));
  }
  const mean = samples.reduce((a,b) => a+b,0) / samples.length;
  const spread = Math.sqrt(samples.reduce((a,b) => a + (b-mean)**2,0) / samples.length);
  let lap = 0, count = 0, colour = 0;
  const grey = (x: number, y: number) => { const i = (y * canvas.width + x) * 4; return (data[i] + data[i+1] + data[i+2]) / 3; };
  const xmin = Math.max(1, Math.round(points[234].x * canvas.width)), xmax = Math.min(canvas.width - 2, Math.round(points[454].x * canvas.width));
  for (let y = Math.max(1, Math.round(points[10].y * canvas.height)); y < Math.min(canvas.height-2, points[152].y * canvas.height); y += 2) for (let x = xmin; x < xmax; x += 2) { const l = 4*grey(x,y) - grey(x-1,y) - grey(x+1,y) - grey(x,y-1) - grey(x,y+1); lap += l*l; const i=(y*canvas.width+x)*4; colour += Math.max(data[i],data[i+1],data[i+2])-Math.min(data[i],data[i+1],data[i+2]); count++; }
  // The mesh ends at the forehead, not the crown. This is a visual starting point only.
  const forehead = points[10].y, chin = points[152].y;
  const estimatedFrame = { crown: Math.max(1, (forehead - (chin-forehead)*.12)*100), chin: Math.min(99,chin*100), eyes: (left.y+right.y)*50, faceLeft: points[234].x*100, faceRight: points[454].x*100 };
  return { key, estimatedFrame, findings: visionFindings({ faces: 1, glasses: probability, roll, yaw, pitch, smile: Math.max(scores.mouthSmileLeft || 0, scores.mouthSmileRight || 0), mouthOpen: scores.jawOpen || 0, blink: Math.max(scores.eyeBlinkLeft || 0, scores.eyeBlinkRight || 0), backgroundMean: mean, backgroundSpread: spread, backgroundChroma: chromas.reduce((a,b)=>a+b,0)/chromas.length, sharpness: lap / Math.max(count,1), colourChroma: colour / Math.max(count,1) }, spec.glasses, spec.backgroundTone) };
}
export function assessPhoto(project: Project) { const pending = queue.then(() => run(project)); queue = pending.catch(() => undefined); return pending; }
