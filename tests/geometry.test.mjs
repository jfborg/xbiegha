import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutRects, outputSize, sheetPositions, coverSize } from '../src/geometry.ts';

test('every collage layout fits the canvas, without overlapping photos', () => {
  for (const count of [1,2,3,4,5,6,7,8]) for (const layout of ['grid','hero','strips']) for (const ratio of [1,.8,1.5,9/16]) {
    const width = 1000, height = width / ratio;
    const rects = layoutRects(count,width,height,24,12,layout);
    assert.equal(rects.length,count);
    for (const r of rects) { assert.ok(r.w>0 && r.h>0); assert.ok(r.x>=0 && r.y>=0 && r.x+r.w<=width+.001 && r.y+r.h<=height+.001); }
    for (let i=0;i<rects.length;i++) for(let j=i+1;j<rects.length;j++) { const a=rects[i],b=rects[j]; assert.ok(a.x+a.w<=b.x+.001 || b.x+b.w<=a.x+.001 || a.y+a.h<=b.y+.001 || b.y+b.h<=a.y+.001); }
  }
});
test('passport exports use physical dimensions at 300 DPI', () => { assert.deepEqual(outputSize('passport',1,2400,35,45),{width:413,height:531}); assert.deepEqual(outputSize('passport',1,2400,50.8,50.8),{width:600,height:600}); });
test('4 × 6 inch sheets fit six 35 × 45 photos or two US photos at actual size', () => {
  for (const [w,h,count] of [[35,45,6],[50.8,50.8,2]]) { const positions = sheetPositions(w,h); assert.equal(positions.length,count); for(const p of positions) { assert.ok(p.x>=3 && p.y>=3 && p.x+w<=152.4-3+.001 && p.y+h<=101.6-3+.001); } }
});
test('cover crops fill the frame, including rotated source dimensions', () => { for(const [iw,ih,rw,rh] of [[1200,800,400,500],[800,1200,500,400],[1000,1000,500,500]]) { const s=coverSize(iw,ih,rw,rh,1); assert.ok(s.width>=rw && s.height>=rh); assert.ok(Math.abs(s.width/s.height-iw/ih)<.00001); } });
test('export sizes preserve the chosen shape', () => { assert.deepEqual(outputSize('editor',1.5,2400),{width:2400,height:1600}); assert.deepEqual(outputSize('editor',.8,2400),{width:1920,height:2400}); });
