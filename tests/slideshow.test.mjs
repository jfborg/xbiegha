import test from 'node:test';
import assert from 'node:assert/strict';
import { slideshowDefaults as base, timeline, slideAt, slideSize, musicPosition, musicGain, readSlideshow, MAX_SLIDES } from '../src/slideshow.ts';

test('a 30-photo story never exceeds five minutes; per-photo timings survive reordering',()=>{
 const photos=[{duration:2},{duration:7},{duration:1.5}];
 assert.deepEqual(timeline(photos,base).map(x=>[x.start,x.end]),[[0,2],[2,9],[9,10.5]]);
 assert.deepEqual(timeline([photos[1],photos[0]],base).map(x=>x.duration),[7,2]);
 assert.equal(timeline(Array.from({length:MAX_SLIDES},()=>({duration:20})),base).at(-1).end,300);
});
test('transitions change exactly at boundaries, finish within short slides, and retain final frame',()=>{
 const photos=[{duration:2},{duration:1}];
 assert.equal(slideAt(photos,base,1.999).index,0);
 assert.equal(slideAt(photos,base,2).blend,0);
 assert.equal(slideAt(photos,base,2.5).blend,1);
 assert.equal(slideAt(photos,base,3).index,1);
 assert.equal(slideAt(photos,base,9).progress,1);
 assert.equal(slideAt(photos,{...base,transition:'cut'},2).blend,1);
 assert.equal(slideAt([],base,0).total,0);
});
test('all formats have encoder-safe even dimensions',()=>{
 assert.deepEqual(slideSize('16:9',1920),{width:1920,height:1080});
 assert.deepEqual(slideSize('9:16',1280),{width:720,height:1280});
 assert.deepEqual(slideSize('4:5',1920),{width:1536,height:1920});
 assert.deepEqual(slideSize('1:1',1280),{width:1280,height:1280});
});
test('music loops only the chosen portion or becomes silent after its end',()=>{
 const settings={...base,audio:{src:'data:audio/wav;base64,AAAA',name:'Test',duration:10},audioStart:4};
 assert.equal(musicPosition(0,settings),4);
 assert.equal(musicPosition(7,settings),5);
 assert.equal(musicPosition(7,{...settings,loopAudio:false}),null);
 assert.equal(musicPosition(1,base),null);
 assert.equal(musicGain(0,12,.65),0);
 assert.equal(musicGain(1,12,.65),.65);
 assert.equal(musicGain(12,12,.65),0);
});
test('backups reject external soundtracks and invalid timing or style',()=>{
 assert.deepEqual(readSlideshow(undefined),base);
 for (const value of [{seconds:NaN},{seconds:0},{volume:2},{transition:'unknown'},{motion:'true'},{audio:{src:'https://example.com/music.mp3',name:'x',duration:10}},{audio:{src:'data:audio/wav;base64,AAAA',name:'x',duration:601}}]) assert.throws(()=>readSlideshow(value));
 assert.equal(readSlideshow({audio:{src:'data:audio/wav;base64,AAAA',name:'x',duration:10}}).audio.duration,10);
});
