import { Output, BufferTarget, Mp4OutputFormat, CanvasSource, AudioBufferSource, Quality, Input, BlobSource, ALL_FORMATS, CanvasSink, AudioBufferSink } from 'mediabunny';
import { readVideo, VideoEngine, exportVideoEdit } from '../src/videoEngine';
import { videoTimeline } from '../src/videoModel';
import type { VideoEdit, Transition } from '../src/videoModel';
const result=document.querySelector('pre')!;
function log(s:string){result.textContent+='\n'+s;}
async function fixture(){
 const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;
 const ctx=canvas.getContext('2d')!,target=new BufferTarget(),output=new Output({target,format:new Mp4OutputFormat({fastStart:'in-memory'})});
 const video=new CanvasSource(canvas,{codec:'avc',quality:new Quality({bitrate:1e6}),keyFrameInterval:1}),audio=new AudioBufferSource({codec:'aac',quality:new Quality({bitrate:128000})});output.addVideoTrack(video,{frameRate:30});output.addAudioTrack(audio);await output.start();
 for(let n=0;n<270;n++) {const t=n/30,i=Math.floor(t/3);ctx.fillStyle=['#dc302f','#219653','#266ddd'][i];ctx.fillRect(0,0,640,360);ctx.fillStyle='white';ctx.font='bold 42px sans-serif';ctx.fillText(['FIRST · RED','SECOND · GREEN','THIRD · BLUE'][i],35,170);ctx.font='24px sans-serif';ctx.fillText(t.toFixed(2)+' seconds',35,215);ctx.fillRect(35+t*50,260,18,18);await video.add(t,1/30);if(n%30===0){const b=new AudioBuffer({numberOfChannels:2,length:48000,sampleRate:48000});for(let c=0;c<2;c++){const d=b.getChannelData(c);for(let j=0;j<d.length;j++)d[j]=.3*Math.sin(2*Math.PI*[440,660,880][i]*(t+j/48000));}await audio.add(b);}}
 video.close();audio.close();await output.finalize();return new File([target.buffer!],'Studio test — three scenes.mp4',{type:'video/mp4'});
}
function download(file:Blob,name:string){const a=document.createElement('a');a.href=URL.createObjectURL(file);a.download=name;a.click();}
function pixel(canvas:HTMLCanvasElement){return Array.from(canvas.getContext('2d')!.getImageData(10,10,1,1).data).slice(0,3);}
function frequency(buffer:AudioBuffer){const x=buffer.getChannelData(0);let n=0;for(let i=1;i<x.length;i++)if(x[i-1]<0&&x[i]>=0)n++;return n/buffer.duration;}
function check(ok:boolean,desc:string){if(!ok)throw new Error(desc);log('PASS '+desc);}
document.querySelector('#fixture')!.addEventListener('click',async()=>{try{result.textContent='Creating fixture…';const f=await fixture();download(f,f.name);document.querySelector('video')!.src=URL.createObjectURL(f);log('Fixture ready: 9 seconds, red/green/blue, changing tones.');}catch(e){log('FAIL '+e);}});
document.querySelector('#test')!.addEventListener('click',async()=>{try{
 result.textContent='Testing…';const file=await fixture(),asset=await readVideo(file);check(asset.audio&&Math.abs(asset.duration-9)<.1,'source duration and audio read');
 for(const transition of ['cut','dissolve','black','slide','wipe'] as Transition[]){
 const edit:VideoEdit={name:'Test',ratio:'16:9',fit:'contain',clips:[{id:'blue',assetId:asset.id,name:'Blue',in:6,out:8,transition,transitionSeconds:.5,volume:1},{id:'red',assetId:asset.id,name:'Red',in:0,out:2,transition:'cut',transitionSeconds:.5,volume:1}]};
 const engine=new VideoEngine(edit,[asset],320),canvas=document.createElement('canvas');await engine.draw(canvas,.5);const a=pixel(canvas);check(a[2]>a[0]*2,transition+': reordered movie starts blue');
 await engine.draw(canvas,3);const b=pixel(canvas);check(b[0]>b[2]*2,transition+': movie ends red');
 const mid=transition==='cut'?2:1.75;await engine.draw(canvas,mid);const m=pixel(canvas);if(transition==='black')check(Math.max(...m)<8,'fade to black midpoint');if(transition==='dissolve')check(m[0]>80&&m[2]>70,'dissolve midpoint blends frames');
 const audio=await engine.audioChunk(.25,.5);let rms=0;for(const v of audio.getChannelData(0))rms+=v*v;check(Math.sqrt(rms/audio.length)>.15,transition+': source audio preserved');check(Math.abs(frequency(audio)-880)<15,transition+': reordered audio starts with the blue tone');const tailAudio=await engine.audioChunk(3,.25);check(Math.abs(frequency(tailAudio)-440)<15,transition+': audio ends with the red tone');await engine.dispose();
 const blob=await exportVideoEdit(edit,[asset],320,'mp4',true,new AbortController().signal,()=>{});const input=new Input({source:new BlobSource(blob),formats:ALL_FORMATS});const duration=await input.computeDuration();check(Math.abs(duration-(transition==='cut'?4:3.5))<.1,transition+': exported duration '+duration.toFixed(3));const vt=await input.getPrimaryVideoTrack(),at=await input.getPrimaryAudioTrack();check(!!vt&&!!at,transition+': export contains video and audio');const first=await new CanvasSink(vt!,{width:320}).getCanvas(.25);canvas.width=first!.canvas.width;canvas.height=first!.canvas.height;canvas.getContext('2d')!.drawImage(first!.canvas,0,0);const px=pixel(canvas);check(px[2]>px[0]*2,transition+': encoded output starts with blue clip');const snd=await new AudioBufferSink(at!).getBuffer(.5);check(!!snd,'encoded audio decodes');input.dispose();
 }
 const edit:VideoEdit={name:'Cancel',ratio:'1:1',fit:'contain',clips:[{id:'one',assetId:asset.id,name:'Clip',in:0,out:3,transition:'cut',transitionSeconds:.5,volume:1}]};const controller=new AbortController();controller.abort();let cancelled=false;try{await exportVideoEdit(edit,[asset],320,'mp4',true,controller.signal,()=>{});}catch{cancelled=true;}check(cancelled,'cancellation stops export');const webm=await exportVideoEdit(edit,[asset],320,'webm',false,new AbortController().signal,()=>{});const webmInput=new Input({source:new BlobSource(webm),formats:ALL_FORMATS});check(!await webmInput.getPrimaryAudioTrack(),'sound-disabled WebM has no audio track');check(Math.abs(await webmInput.computeDuration()-3)<.1,'WebM duration is correct');webmInput.dispose();URL.revokeObjectURL(asset.url);log('ALL BROWSER CHECKS PASSED');
}catch(e){log('FAIL '+(e instanceof Error?e.stack:e));}});
