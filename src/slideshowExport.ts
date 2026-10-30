import { AudioBufferSource, BufferTarget, CanvasSource, Mp4OutputFormat, Output, Quality, WebMOutputFormat, canEncodeAudio, canEncodeVideo } from 'mediabunny';
import type { Project } from './model';
import { createSlideRenderer } from './slideshowRender';
import { musicGain, musicPosition, readSlideshow, slideSize, timeline } from './slideshow';

export type VideoFormat = 'mp4' | 'webm';
export async function supportedVideoFormats(ratio: string, longest: number, audio: boolean) {
  const size=slideSize(ratio,longest), options={...size,frameRate:30,quality:new Quality({bitrate:longest>1280?8e6:4e6})};
  const [avc,vp8,aac,opus]=await Promise.all([canEncodeVideo('avc',options),canEncodeVideo('vp8',options),audio?canEncodeAudio('aac',{sampleRate:48000,numberOfChannels:2}):true,audio?canEncodeAudio('opus',{sampleRate:48000,numberOfChannels:2}):true]);
  return {mp4:avc&&aac,webm:vp8&&opus};
}
export async function decodeMusic(src: string) {
  const comma=src.indexOf(','); if(comma<0||!src.startsWith('data:audio/'))throw new Error('This soundtrack could not be read.');
  const binary=atob(src.slice(comma+1)), bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  try { return await new OfflineAudioContext(2,1,48000).decodeAudioData(bytes.buffer); }
  catch { throw new Error('This browser cannot open that soundtrack. Try an MP3, M4A or WAV file.'); }
}
export async function readMusic(file: File) {
  if(file.size>20*1024*1024)throw new Error('Choose a soundtrack smaller than 20 MB.');
  const types:Record<string,string>={mp3:'audio/mpeg',m4a:'audio/mp4',wav:'audio/wav',ogg:'audio/ogg',aac:'audio/aac',webm:'audio/webm'};
  const type=types[file.name.split('.').pop()?.toLowerCase()||''];if(!type)throw new Error('Choose an MP3, M4A, WAV, OGG, AAC or WebM audio file.');
  const src=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Could not read the soundtrack.'));reader.readAsDataURL(new Blob([file],{type}));});
  const decoded=await decodeMusic(src); if(!decoded.duration||decoded.duration>600)throw new Error('Choose a soundtrack up to 10 minutes long.');
  return {src,name:file.name.slice(0,200),duration:decoded.duration};
}
export async function exportSlideshow(project: Project, longest: number, format: VideoFormat, signal: AbortSignal, progress: (value:number)=>void) {
  const settings=readSlideshow(project.slideshow), total=timeline(project.photos,settings).at(-1)?.end||0;
  if(!total)throw new Error('Add a photo before exporting.');
  const supported=await supportedVideoFormats(project.ratio,longest,!!settings.audio);
  if(!supported[format])throw new Error(`This browser cannot export ${format.toUpperCase()} with these settings. Try 720p, another available format, or a current Safari or Chrome browser.`);
  signal.throwIfAborted(); await document.fonts.ready;
  const canvas=document.createElement('canvas'),renderer=createSlideRenderer(project,longest);
  canvas.width=renderer.size.width;canvas.height=renderer.size.height;
  const target=new BufferTarget(),output=new Output({format:format==='mp4'?new Mp4OutputFormat({fastStart:'in-memory'}):new WebMOutputFormat(),target});
  const video=new CanvasSource(canvas,{codec:format==='mp4'?'avc':'vp8',quality:new Quality({bitrate:longest>1280?8e6:4e6}),keyFrameInterval:2});
  output.addVideoTrack(video,{frameRate:30});
  const audio=settings.audio?new AudioBufferSource({codec:format==='mp4'?'aac':'opus',quality:new Quality({bitrate:128000})}):null;
  if(audio)output.addAudioTrack(audio);
  try {
    const decoded=settings.audio?await decodeMusic(settings.audio.src):null;signal.throwIfAborted();
    if (decoded && settings.audio) settings.audio = {...settings.audio,duration:decoded.duration};
    await output.start();
    const frames=Math.ceil(total*30);
    // Encode audio in small, matching chunks; never allocate a full-length PCM soundtrack.
    for(let frame=0;frame<frames;frame++) {
      signal.throwIfAborted();const time=frame/30;
      await renderer.draw(canvas,time);await video.add(time,Math.min(1/30,total-time));
      if(audio&&decoded&&frame%30===0) {
        const length=Math.round(Math.min(1,total-time)*48000), chunk=new AudioBuffer({numberOfChannels:2,length,sampleRate:48000});
        for(let c=0;c<2;c++){const dest=chunk.getChannelData(c),source=decoded.getChannelData(Math.min(c,decoded.numberOfChannels-1));for(let i=0;i<length;i++){const t=time+i/48000,pos=musicPosition(t,settings);dest[i]=pos===null?0:source[Math.min(source.length-1,Math.floor(pos*decoded.sampleRate))]*musicGain(t,total,settings.volume);}}
        await audio.add(chunk);
      }
      if(frame%15===0){progress(frame/frames*.95);await new Promise<void>(resolve=>setTimeout(resolve,0));}
    }
    video.close();audio?.close();signal.throwIfAborted();progress(.97);await output.finalize();signal.throwIfAborted();
    if(!target.buffer)throw new Error('The video could not be finished. Try 720p or a shorter slideshow.');
    progress(1);return new Blob([target.buffer],{type:format==='mp4'?'video/mp4':'video/webm'});
  } catch(error){await output.cancel().catch(()=>{});throw error;}
  finally{renderer.dispose();canvas.width=1;canvas.height=1;}
}
