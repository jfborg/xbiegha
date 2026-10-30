import type { Photo, Project } from './model';
import { imageFromSource } from './model';
import { applyAdjustments } from './color';
import { readSlideshow, slideAt, slideSize } from './slideshow';

export function createSlideRenderer(project: Project, longest: number) {
  const settings = readSlideshow(project.slideshow), size = slideSize(project.ratio, longest);
  const cache = new Map<number, HTMLCanvasElement>();
  async function picture(index: number) {
    const found = cache.get(index); if (found) return found;
    const image = await imageFromSource(project.photos[index].src);
    const scale = Math.min(1, longest * 1.25 / Math.max(image.naturalWidth, image.naturalHeight));
    const prepared = document.createElement('canvas');
    prepared.width = Math.max(1, Math.round(image.naturalWidth * scale)); prepared.height = Math.max(1, Math.round(image.naturalHeight * scale));
    prepared.getContext('2d')!.drawImage(image, 0, 0, prepared.width, prepared.height);
    applyAdjustments(prepared, project.adjustments, 'editor', false);
    cache.set(index, prepared);
    if (cache.size > 3) { const oldest = cache.keys().next().value!; const old = cache.get(oldest)!; old.width = 1; old.height = 1; cache.delete(oldest); }
    return prepared;
  }
  function caption(ctx: CanvasRenderingContext2D, text: string, y: number, color: string, maxWidth: number) {
    const fontSize = Math.min(size.width, size.height) * .055;
    ctx.font = `400 ${fontSize}px "Newsreader", Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color;
    const words = text.trim().slice(0, 120).split(/\s+/), lines: string[] = []; let line = '';
    for (const word of words) { if (line && ctx.measureText(`${line} ${word}`).width > maxWidth) { lines.push(line); line = word; } else line += `${line ? ' ' : ''}${word}`; }
    if (line) lines.push(line);
    lines.slice(0,2).forEach((value,i) => ctx.fillText(value + (i === 1 && lines.length > 2 ? '…' : ''), size.width / 2, y + i * fontSize * 1.2, maxWidth));
  }
  function scene(ctx: CanvasRenderingContext2D, image: HTMLCanvasElement, photo: Photo, index: number, progress: number) {
    const { width: w, height: h } = size, postcard = settings.theme === 'postcard', clean = settings.theme === 'clean';
    const text = photo.caption || (index === 0 ? project.caption : '');
    const border = postcard ? Math.min(w,h) * .065 : clean ? Math.min(w,h) * .035 : 0;
    const rect = { x: border, y: border, w: w - border * 2, h: h - border * 2 - (postcard && text ? h * .14 : 0) };
    ctx.fillStyle = postcard ? '#f2eadc' : clean ? project.background : '#0b1826'; ctx.fillRect(0, 0, w, h);
    ctx.save(); ctx.beginPath(); ctx.rect(rect.x,rect.y,rect.w,rect.h); ctx.clip();
    const rotated = photo.rotation % 180 !== 0, iw = rotated ? image.height : image.width, ih = rotated ? image.width : image.height;
    const base = (settings.fit === 'contain' ? Math.min(rect.w/iw,rect.h/ih) : Math.max(rect.w/iw,rect.h/ih));
    // Fit-whole-photo deliberately stays still so motion cannot crop a face out of frame.
    const movement = settings.motion && settings.fit === 'cover' ? 1.03 + .065 * (index % 2 ? 1 - progress : progress) : 1;
    const scale = base * (settings.fit === 'contain' ? 1 : photo.zoom) * movement, overflowX = Math.max(0,iw*scale-rect.w)/2, overflowY = Math.max(0,ih*scale-rect.h)/2;
    ctx.translate(rect.x+rect.w/2+photo.x*overflowX,rect.y+rect.h/2+photo.y*overflowY);
    ctx.rotate(photo.rotation*Math.PI/180); ctx.scale(photo.flip?-1:1,1);
    ctx.drawImage(image,-image.width*scale/2,-image.height*scale/2,image.width*scale,image.height*scale); ctx.restore();
    if (text) {
      if (postcard) caption(ctx,text,h*.88,'#0b1826',w*.8);
      else { const gradient=ctx.createLinearGradient(0,h*.62,0,h);gradient.addColorStop(0,'#0000');gradient.addColorStop(1,'#000b');ctx.fillStyle=gradient;ctx.fillRect(0,h*.6,w,h*.4);caption(ctx,text,h*.83,'#fffdf7',w*.82); }
    }
  }
  return {
    size,
    async draw(canvas: HTMLCanvasElement, time: number) {
      if (canvas.width!==size.width || canvas.height!==size.height) { canvas.width=size.width; canvas.height=size.height; }
      const ctx=canvas.getContext('2d');if(!ctx)throw new Error('This browser could not prepare the slideshow preview.');
      const frame=slideAt(project.photos,settings,time);if(!project.photos.length){ctx.clearRect(0,0,size.width,size.height);return;}
      const current=await picture(frame.index), previous=frame.blend<1&&frame.index>0?await picture(frame.index-1):null;
      ctx.globalAlpha=1;ctx.fillStyle='#0b1826';ctx.fillRect(0,0,size.width,size.height);
      const draw=(index:number,img:HTMLCanvasElement,p:number,opacity=1,offset=0)=>{ctx.save();ctx.globalAlpha=opacity;ctx.translate(offset,0);scene(ctx,img,project.photos[index],index,p);ctx.restore();};
      const b=frame.blend*frame.blend*(3-2*frame.blend);
      if(previous&&settings.transition==='slide'){draw(frame.index-1,previous,1,1,-b*size.width);draw(frame.index,current,frame.progress,1,(1-b)*size.width);}
      else if(previous&&settings.transition==='dip'){if(b<.5)draw(frame.index-1,previous,1,1-b*2);else draw(frame.index,current,frame.progress,(b-.5)*2);}
      else {if(previous)draw(frame.index-1,previous,1);draw(frame.index,current,frame.progress,previous?b:1);}
    },
    dispose() { for(const c of cache.values()){c.width=1;c.height=1;}cache.clear(); },
  };
}
