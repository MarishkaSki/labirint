// Regenerate texture assets. The root site is already ready to deploy.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const inputs = path.join(__dirname, '../assets/textures');
const generated = path.join(__dirname, '../static/generated');

// ---- relief ----
const relief = (() => {
// Offline only. Derivatives use metres per texel, so relief does not disappear
// when an atlas tile or a repeating texture has a different pixel resolution.

const HEIGHT_RANGE = .16;

function smooth(values, width, height, bounds, repeat) {
  const output = new Float32Array(values.length);
  for (const { x, y, w, h } of bounds) {
    const at = (px, py) => {
      px = repeat ? x + ((px-x)%w+w)%w : Math.max(x, Math.min(x+w-1,px));
      py = repeat ? y + ((py-y)%h+h)%h : Math.max(y, Math.min(y+h-1,py));
      return values[py*width+px];
    };
    for(let py=y;py<y+h;py++)for(let px=x;px<x+w;px++){
      output[py*width+px]=(at(px-1,py-1)+2*at(px,py-1)+at(px+1,py-1)
        +2*at(px-1,py)+4*at(px,py)+2*at(px+1,py)
        +at(px-1,py+1)+2*at(px,py+1)+at(px+1,py+1))/16;
    }
  }
  return output;
}

function heightFromAlbedo(image, relief, size=512) {
  const canvas=createCanvas(size,size),g=canvas.getContext('2d');g.drawImage(image,0,0,size,size);
  const pixels=g.getImageData(0,0,size,size),bounds=[{x:0,y:0,w:size,h:size}];
  let luma=new Float32Array(size*size);
  for(let i=0;i<luma.length;i++)luma[i]=(pixels.data[i*4]*.2126+pixels.data[i*4+1]*.7152+pixels.data[i*4+2]*.0722)/255;
  // Remove pigment/grain noise before deriving broad stone bevels and tile lips.
  luma=smooth(smooth(luma,size,size,bounds,true),size,size,bounds,true);
  const sorted=Float32Array.from(luma).sort(),low=sorted[Math.floor(sorted.length*.10)],high=sorted[Math.floor(sorted.length*.80)];
  for(let i=0;i<luma.length;i++){
    const t=Math.max(0,Math.min(1,(luma[i]-low)/Math.max(high-low,.001)));
    const height=.075+relief*t*t*(3-2*t);
    const value=Math.round(height/HEIGHT_RANGE*255);
    pixels.data[i*4]=pixels.data[i*4+1]=pixels.data[i*4+2]=value;pixels.data[i*4+3]=255;
  }
  g.putImageData(pixels,0,0);return canvas;
}

function normalFromHeight(heightCanvas, { widthMetres=1.8, heightMetres=1.8, patches, repeat=true }={}) {
  const width=heightCanvas.width,height=heightCanvas.height;
  const source=heightCanvas.getContext('2d').getImageData(0,0,width,height).data;
  const regions=patches||[{x:0,y:0,w:width,h:height,stepX:widthMetres/width,stepY:heightMetres/height}];
  let values=new Float32Array(width*height);
  for(let i=0;i<values.length;i++)values[i]=source[i*4]/255*HEIGHT_RANGE;
  // A small bevel keeps openings from becoming one-pixel normal-map spikes.
  values=smooth(values,width,height,regions,repeat);
  const canvas=createCanvas(width,height),g=canvas.getContext('2d'),pixels=g.createImageData(width,height);
  for(let i=0;i<pixels.data.length;i+=4){pixels.data[i]=pixels.data[i+1]=128;pixels.data[i+2]=pixels.data[i+3]=255;}
  for(const {x,y,w,h,stepX,stepY} of regions){
    const at=(px,py)=>{
      px=repeat?x+((px-x)%w+w)%w:Math.max(x,Math.min(x+w-1,px));
      py=repeat?y+((py-y)%h+h)%h:Math.max(y,Math.min(y+h-1,py));
      return values[py*width+px];
    };
    for(let py=y;py<y+h;py++)for(let px=x;px<x+w;px++){
      const nx=(at(px-1,py)-at(px+1,py))/(2*stepX);
      // Image rows run downward; tangent-space V runs upward (OpenGL +Y).
      const ny=(at(px,py+1)-at(px,py-1))/(2*stepY);
      const length=Math.hypot(nx,ny,1),i=(py*width+px)*4;
      pixels.data[i]=(nx/length*.5+.5)*255;pixels.data[i+1]=(ny/length*.5+.5)*255;
      pixels.data[i+2]=(1/length*.5+.5)*255;pixels.data[i+3]=255;
    }
  }
  g.putImageData(pixels,0,0);return canvas;
}
return {heightFromAlbedo,normalFromHeight};

})();
const {heightFromAlbedo,normalFromHeight}=relief;

// ---- layout ----
const layout = (() => {



const key = (width, height) => `${width.toFixed(3)}:${height.toFixed(3)}`;

function gameVariants() {
  // Use the actual game catalogue, so baking cannot silently use different sizes.
  const source = fs.readFileSync(path.join(__dirname, '../static/game.js'), 'utf8');
  const start = source.indexOf('      const variants = [');
  const end = source.indexOf('      const bodyColors =', start);
  return vm.runInNewContext(source.slice(start, end) + '\n[...variants,...highVariants]');
}

function pack(entries, width, height) {
  let free = [{x:0,y:0,w:width,h:height}];
  const placed = entries.map(e=>({...e}));
  for (const entry of [...placed].sort((a,b)=>Math.max(b.w,b.h)-Math.max(a.w,a.h)||b.w*b.h-a.w*a.h)) {
    const fits = free.filter(r=>r.w>=entry.w&&r.h>=entry.h).sort((a,b)=>
      Math.min(a.w-entry.w,a.h-entry.h)-Math.min(b.w-entry.w,b.h-entry.h)||
      Math.max(a.w-entry.w,a.h-entry.h)-Math.max(b.w-entry.w,b.h-entry.h));
    if (!fits.length) return null;
    entry.x=fits[0].x;entry.y=fits[0].y;
    const next=[];
    for(const r of free){
      if(entry.x>=r.x+r.w||entry.x+entry.w<=r.x||entry.y>=r.y+r.h||entry.y+entry.h<=r.y){next.push(r);continue;}
      if(entry.x>r.x)next.push({...r,w:entry.x-r.x});
      if(entry.x+entry.w<r.x+r.w)next.push({x:entry.x+entry.w,y:r.y,w:r.x+r.w-entry.x-entry.w,h:r.h});
      if(entry.y>r.y)next.push({...r,h:entry.y-r.y});
      if(entry.y+entry.h<r.y+r.h)next.push({x:r.x,y:entry.y+entry.h,w:r.w,h:r.y+r.h-entry.y-entry.h});
    }
    free=next.filter((r,i)=>!next.some((s,j)=>i!==j&&s.x<=r.x&&s.y<=r.y&&s.x+s.w>=r.x+r.w&&s.y+s.h>=r.y+r.h&&(j<i||s.w*s.h>r.w*r.h)));
  }
  return placed;
}

function makeLayout(pixelsPerMetre=124, wooden=false) {
  const pad=6,dimensions=new Map();
  for(const v of gameVariants())for(const scale of [v.sx,v.sz]){
    if(wooden && v.floors!==1)continue;
    if(!Number.isInteger(v.floors)||v.floors<1)throw new Error('Every ordinary house variant needs an explicit floor count');
    const widthMetres=1.8*scale,heightMetres=v.sy;
    dimensions.set(key(widthMetres,heightMetres),{widthMetres,heightMetres,floors:v.floors});
  }
  const entries=[];
  for(const [faceKey,d] of dimensions)for(let kind=0;kind<(wooden?8:4);kind++)entries.push({
    ...d,faceKey,kind,id:entries.length,
    hasDoor:kind%4===0,
    windowFloors:Array.from({length:d.floors},(_,floor)=>floor).filter(floor=>kind%4!==2&&(kind%4===0||floor%2===(kind%4===1?1:0))),
    w:Math.ceil(d.widthMetres*pixelsPerMetre)+2*pad,
    h:Math.ceil(d.heightMetres*pixelsPerMetre)+2*pad,
  });
  for(const [width,height] of [[2048,1024],[1024,2048],[2048,2048]]){
    const faces=pack(entries,width,height);
    if(!faces)continue;
    const tiles={},rects=[];
    for(const f of faces){
      (tiles[f.faceKey]||=[])[f.kind]=f.id;
      rects[f.id]=[(f.x+pad)/width,1-(f.y+pad+f.heightMetres*pixelsPerMetre)/height,
        f.widthMetres*pixelsPerMetre/width,f.heightMetres*pixelsPerMetre/height];
    }
    return {width,height,pad,pixelsPerMetre,floorPitch:.80,faces,tiles,rects};
  }
  throw new Error('Facade atlas does not fit');
}
return {makeLayout,gameVariants,key};

})();
const {makeLayout,gameVariants,key}=layout;

// ---- wood ----
const wood = (() => {
// Offline, seamless physical relief. Logs and straw retain their world scale.


function surface(straw=false, variant=0) {
  if(straw)return thatch(variant);
  const size=512,color=createCanvas(size,size),height=createCanvas(size,size);
  const c=color.getContext('2d'),h=height.getContext('2d');
  const cp=c.createImageData(size,size),hp=h.createImageData(size,size);
  const tau=Math.PI*2;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
    const u=x/size,v=y/size;
    const row=(v*12)%1;
    const round=Math.sqrt(Math.max(0,1-Math.pow(row*2-1,2)));
    const log=Math.floor(v*12);
    const knotX=((log*0.6180339+.23)%1);
    const dx=Math.min(Math.abs(u-knotX),1-Math.abs(u-knotX));
    const knotDist=Math.hypot(dx*7,(row-.46)*1.4);
    const knotBend=Math.exp(-knotDist*3);
    const grain=Math.sin(tau*(v*173+Math.sin(u*tau*2+log)*.27+knotBend*1.8));
    const fine=Math.sin(tau*(u*83+v*5))*Math.sin(tau*(v*127-u*11));
    const knot=Math.sin(knotDist*44)*Math.exp(-knotDist*4);
    let light,relief,base;
    if(straw){
      const strand=Math.sin(tau*(u*111+Math.sin(v*tau*3)*.12));
      const bundles=Math.sin(tau*u*13)*.5+.5;
      const course=(v*6)%1;
      light=.78+.16*strand+.12*bundles+.045*fine-.19*Math.exp(-course*32);
      relief=.09+.006*strand+.008*bundles+.017*Math.min(1,course*14);
      base=[171,137,76];
    }else{
      const variation=.055*Math.sin(log*18.3)+.035*Math.sin(u*tau*3+log);
      light=.51+.44*round+.055*grain+.12*knot+.018*fine+variation;
      relief=.045+.065*round+.0015*grain+.001*fine+.002*knot;
      base=[146,106,65];
    }
    const i=(y*size+x)*4;
    for(let k=0;k<3;k++){cp.data[i+k]=base[k]*light;hp.data[i+k]=relief/.16*255;}
    cp.data[i+3]=hp.data[i+3]=255;
  }
  c.putImageData(cp,0,0);h.putImageData(hp,0,0);
  return {color,height,normal:normalFromHeight(height,{widthMetres:straw?.9:1.8,heightMetres:straw?.9:1.8})};
}
function thatch(variant=0) {
  const size=512,color=createCanvas(size,size),height=createCanvas(size,size);
  const c=color.getContext('2d'),h=height.getContext('2d');
  let seed=73819;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const noise=(x,y,nx,ny)=>{
    const hash=(a,b)=>{let n=Math.imul(((a%nx)+nx)%nx+1,374761393)^Math.imul(((b%ny)+ny)%ny+1,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
    const ax=Math.floor(x),ay=Math.floor(y),fx=x-ax,fy=y-ay;
    const sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
    return (hash(ax,ay)*(1-sx)+hash(ax+1,ay)*sx)*(1-sy)+(hash(ax,ay+1)*(1-sx)+hash(ax+1,ay+1)*sx)*sy;
  };
  const cp=c.createImageData(size,size),hp=h.createImageData(size,size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
    const u=x/size,v=y/size;
    const clump=noise(u*17,v*5,17,5),weather=noise(u*5,v*7,5,7);
    const fibers=noise(u*190+noise(u*9,v*4,9,4)*1.3,v*12,190,12);
    // Small independent, seamless bends give neighbouring crests different
    // inclinations while retaining their depth and overall downhill direction.
    // A smooth periodic lean avoids the sharp return near texture seams.
    const lean=(noise(u*4+variant*1.37,0,4,1)-.5)*.09*Math.sin(v*Math.PI*2);
    const waveU=u+variant*.173+lean+.018*(noise(u*5+variant*1.71,v*2+variant*.63,5,2)-.5);
    const wavePhase=waveU*4+.12*Math.sin(waveU*Math.PI*2)+.06*Math.sin(waveU*Math.PI*4);
    const wave=.5-.5*Math.cos(wavePhase*Math.PI*2);
    const broad=.5-.5*Math.cos(waveU*Math.PI*4);
    const light=.69+.23*clump+.11*weather+.13*fibers;
    const i=(y*size+x)*4;
    [172,145,99].forEach((base,k)=>cp.data[i+k]=base*light);
    const elevation=(.045+.0325*wave+.006*broad+.004*fibers)/.16*255;
    hp.data[i]=hp.data[i+1]=hp.data[i+2]=elevation;cp.data[i+3]=hp.data[i+3]=255;
  }
  c.putImageData(cp,0,0);
  // Fine stems must add to the bundle height, never overwrite its broad relief.
  h.fillStyle='rgb(128,128,128)';h.fillRect(0,0,size,size);
  // Individual weathered stems: varied thickness, bends, broken tips and nodes.
  // Wrapped copies make both the colour and physical height tile seamlessly.
  for(let stem=0;stem<2400;stem++) {
    const x=random()*size,y=random()*size,len=18+random()*108;
    const bend=(random()-.5)*7,width=.45+random()*.9,tone=random();
    const tint=[139+tone*65,112+tone*66,69+tone*57].map(Math.round);
    const elevation=143+random()*20;
    for(const dx of [-size,0,size])for(const dy of [-size,0,size]) {
      for(const [g,stroke] of [[c,`rgb(${tint})`],[h,`rgb(${elevation},${elevation},${elevation})`]]) {
        g.strokeStyle=stroke;g.lineWidth=width;g.lineCap='round';g.beginPath();
        g.moveTo(x+dx,y+dy);g.quadraticCurveTo(x+dx+bend,y+dy+len*.5,x+dx+bend*.6,y+dy+len);g.stroke();
      }
      if(stem%4===0){
        c.strokeStyle='rgba(73,57,34,.35)';c.lineWidth=.6;c.beginPath();
        c.moveTo(x+dx+bend*.4-width,y+dy+len*.6);c.lineTo(x+dx+bend*.4+width,y+dy+len*.6+1);c.stroke();
      }
    }
  }
  const detail=h.getImageData(0,0,size,size);
  for(let i=0;i<detail.data.length;i+=4){
    const elevation=hp.data[i]+(detail.data[i]-128)*.22;
    detail.data[i]=detail.data[i+1]=detail.data[i+2]=elevation;
  }
  h.putImageData(detail,0,0);
  return {color,height,normal:normalFromHeight(height,{widthMetres:.9,heightMetres:.9})};
}
return {surface};

})();
const {surface}=wood;

// ---- atlas ----
const atlas = (() => {
// Offline facade recipe. Shared paths keep height/roughness/emission aligned.


const document={createElement:()=>createCanvas(1,1)};
const REFERENCE_PIXELS_PER_METRE=244/1.8;
  function canvas(width, height) {
    const c = document.createElement("canvas");
    c.width = width; c.height = height;
    return c;
  }
  function arch(g, x, y, w, h) {
    const r = w / 2;
    g.beginPath();
    g.moveTo(x, y + h);
    g.lineTo(x, y + r);
    g.arc(x + r, y + r, r, Math.PI, Math.PI * 2);
    g.lineTo(x + w, y + h);
    g.closePath();
  }
  function makeAtlases(stone, stoneHeight, layout, wooden = false) {
    const openingPath = wooden ? (g,x,y,w,h) => { g.beginPath(); g.rect(x,y,w,h); } : arch;
    const {width:atlasW,height:atlasH,pad:PAD,pixelsPerMetre}=layout;
    const color = canvas(atlasW,atlasH), height = canvas(atlasW,atlasH), rough = canvas(atlasW,atlasH), emission = canvas(atlasW,atlasH);
    const c = color.getContext("2d"), h = height.getContext("2d", { willReadFrequently: true });
    const r = rough.getContext("2d"), e = emission.getContext("2d");
    e.fillStyle = "black"; e.fillRect(0, 0, atlasW, atlasH);
    c.fillStyle = "#a59880"; c.fillRect(0,0,atlasW,atlasH);
    r.fillStyle = "#ededed"; r.fillRect(0,0,atlasW,atlasH);
    const contexts = [c, h, r, e];
    for (const face of layout.faces) {
      const kind=face.kind%4,logOffset=wooden && face.kind>=4 ? .075*REFERENCE_PIXELS_PER_METRE : 0,ox=face.x+PAD,oy=face.y+PAD;
      const w=face.widthMetres*REFERENCE_PIXELS_PER_METRE,logicalH=face.heightMetres*REFERENCE_PIXELS_PER_METRE;
      const pixelScale=pixelsPerMetre/REFERENCE_PIXELS_PER_METRE;
      // Same isotropic scale for every wall, including the two different widths
      // of rectangular houses. Only the canvas extent changes, never its motifs.
      for (const g of contexts) { g.save(); g.translate(ox, oy); g.scale(pixelScale,pixelScale); g.beginPath();g.rect(0,0,w,logicalH);g.clip(); }
      const imageW=1.8*REFERENCE_PIXELS_PER_METRE,imageH=imageW*stone.height/stone.width;
      for (let x=0;x<w;x+=imageW)for(let y=logicalH-logOffset;y>-imageH;y-=imageH)c.drawImage(stone,x,y,imageW,imageH);
      h.fillStyle = "#999999"; h.fillRect(0, 0, w, logicalH);
      r.fillStyle = "#ededed"; r.fillRect(0, 0, w, logicalH);
      // Broad stone relief uses the exact same placement as the color map.
      // Windows/doors below have explicit recesses, independent of their color.
      for (let x=0;x<w;x+=imageW)for(let y=logicalH-logOffset;y>-imageH;y-=imageH)h.drawImage(stoneHeight,x,y,imageW,imageH);

      function rect(x, y, rw, rh, tint, relief = "#bcbcbc", roughness = "#dfdfdf") {
        c.fillStyle = tint; c.fillRect(x, y, rw, rh);
        h.fillStyle = relief; h.fillRect(x, y, rw, rh);
        r.fillStyle = roughness; r.fillRect(x, y, rw, rh);
      }
      // Quoins and a continuous stone plinth define edges without polygons.
      for (let y = 0, row = 0; !wooden && y < logicalH; y += 23, row++) {
        const qw = row % 2 ? 13 : 20;
        for (const x of [0, w - qw]) {
          rect(x, y + 1, qw, 21, row % 2 ? "#baaa8a" : "#c8b99a");
          c.strokeStyle = "#897c65"; c.lineWidth = 0.7; c.strokeRect(x, y + 1, qw, 21);
          rect(x + 1, y + 2, qw - 2, 1, "#e0cfab", "#c8c8c8");
        }
      }
      rect(0, logicalH - 9, w, 9, "#83785e", "#b8b8b8");
      rect(0, logicalH - 10, w, 2, "#c4b18d", "#c9c9c9");
      rect(0, 0, w, 6, "#b4a17e", "#bababa");
      rect(0, 6, w, 2, "#75664c", "#909090");

      if (wooden) {
        // The perpendicular wall's end grain alternates with this wall's logs.
        // Bake colour, bevel height and cracks together; no corner geometry.
        const pitch=.15*REFERENCE_PIXELS_PER_METRE;
        const radius=.068*REFERENCE_PIXELS_PER_METRE;
        const phase=face.kind>=4 ? 0 : pitch/2;
        // Keep the complete cut face inside the wall, including its saddle joint.
        for(let row=0;row<6;row++) {
          const cy=logicalH-pitch/2-phase-row*pitch;
          if(cy-radius<0 || cy+radius>logicalH)continue;
          for(const side of [-1,1]) {
            const margin=radius+3.5;
            const cx=side<0 ? margin : w-margin;
            const seed=row*1.73+(side+1)*2.14;
            function outline(g,inset=0,dy=0) {
              g.beginPath();
              for(let k=0;k<48;k++) {
                const angle=k*Math.PI/24;
                const rad=(radius-inset)*(1+.018*Math.sin(angle*3+seed)+.012*Math.sin(angle*7+seed));
                const x=cx+Math.cos(angle)*rad,y=cy+dy+Math.sin(angle)*rad;
                if(k===0)g.moveTo(x,y);else g.lineTo(x,y);
              }
              g.closePath();
            }
            // Rounded saddle recess: a soft outer bevel and a narrow dark
            // contact at the cut, following the log instead of a straight notch.
            for(let bevel=6;bevel>=0;bevel--) {
              const spread=.5+bevel*.4;
              outline(c,-spread,.3);
              c.fillStyle="rgba(49,34,21,.10)";c.fill();
              outline(h,-spread);
              h.fillStyle=`rgba(92,92,92,${.08+(6-bevel)*.025})`;h.fill();
            }
            for(let step=0;step<5;step++) {
              outline(h,step*.23);const level=151+step*5;
              h.fillStyle=`rgb(${level},${level},${level})`;h.fill();
            }
            outline(c);c.fillStyle="#795535";c.fill();
            outline(c,.7);c.fillStyle=row%2 ? "#a58054" : "#ad875b";c.fill();
            outline(r);r.fillStyle="#dedede";r.fill();
            c.save();outline(c,.7);c.clip();
            // Off-centre, uneven annual growth, with fine pores, not alternating fills.
            for(let ring=1;ring<8;ring++) {
              c.beginPath();
              for(let k=0;k<=64;k++) {
                const angle=k*Math.PI/32;
                const rad=ring*1.32*(1+.055*Math.sin(angle*3+seed)+.035*Math.sin(angle*7+ring));
                const x=cx-.8+Math.cos(angle)*rad,y=cy+.5+Math.sin(angle)*rad*.95;
                if(k===0)c.moveTo(x,y);else c.lineTo(x,y);
              }
              c.strokeStyle=ring%3===0 ? "rgba(83,55,30,.42)" : "rgba(96,66,37,.28)";
              c.lineWidth=ring%3===0?.45:.3;c.stroke();
            }
            for(let pore=0;pore<65;pore++) {
              const x=cx+Math.sin(pore*127.1+seed)*radius;
              const y=cy+Math.sin(pore*311.7+seed)*radius;
              c.fillStyle=pore%2 ? "rgba(57,38,20,.13)" : "rgba(220,189,140,.16)";
              c.fillRect(x,y,.27,.5);
            }
            c.restore();
            for(const [g,tint] of [[c,"rgba(65,43,25,.65)"],[h,"#a3a3a3"]]) {
              g.strokeStyle=tint;g.lineWidth=.35;g.beginPath();
              const angle=seed+.5;
              g.moveTo(cx+Math.cos(angle)*radius*.45,cy+Math.sin(angle)*radius*.45);
              g.lineTo(cx+Math.cos(angle+.09)*radius*.88,cy+Math.sin(angle+.09)*radius*.88);g.stroke();
            }
          }
        }
      }

      function opening(x, y, ow, oh, door) {
        // Stone voussoirs, inner reveal, oak/glass and leadwork share paths
        // across albedo, height, roughness and emissive maps.
        for (const [g, fill] of [[c, wooden ? "#af8552" : "#d1bd94"], [h, "#c6c6c6"], [r, "#dddddd"]]) {
          openingPath(g, x - 5, y - 5, ow + 10, oh + 8); g.fillStyle = fill; g.fill();
        }
        for (const [g, fill] of [[c, "#322b23"], [h, "#565656"], [r, "#969696"]]) {
          openingPath(g, x, y, ow, oh); g.fillStyle = fill; g.fill();
        }
        c.strokeStyle = "#8d7a59"; c.lineWidth = 1;
        const cx = x + ow / 2, cy = y + ow / 2;
        for (let a = Math.PI; !wooden && a <= Math.PI * 2 + 0.01; a += Math.PI / 7) {
          c.beginPath(); c.moveTo(cx + Math.cos(a) * ow / 2, cy + Math.sin(a) * ow / 2);
          c.lineTo(cx + Math.cos(a) * (ow / 2 + 5), cy + Math.sin(a) * (ow / 2 + 5)); c.stroke();
        }
        for (const g of contexts) { g.save(); openingPath(g, x + 2, y + 3, ow - 4, oh - 3); g.clip(); }
        if (door) {
          const grad = c.createLinearGradient(x, 0, x + ow, 0);
          grad.addColorStop(0, "#3b3023"); grad.addColorStop(0.4, "#79603a"); grad.addColorStop(1, "#4b3925");
          c.fillStyle = grad; c.fillRect(x, y, ow, oh);
          h.fillStyle = "#868686"; h.fillRect(x, y, ow, oh);
          r.fillStyle = "#bdbdbd"; r.fillRect(x, y, ow, oh);
          for (let px = x + 5; px < x + ow; px += 6) {
            rect(px, y, 1, oh, "#352b20", "#747474");
            c.strokeStyle = "rgba(210,173,102,.22)"; c.beginPath();
            c.moveTo(px + 2, y); c.bezierCurveTo(px - 1, y + oh * .3, px + 4, y + oh * .7, px + 1, y + oh); c.stroke();
          }
          for (const yy of [y + oh * .43, y + oh * .82]) {
            rect(x + 3, yy, ow - 6, 3, "#2e302c", "#a6a6a6", "#787878");
            for (const px of [x + 6, x + ow - 6]) rect(px, yy + 1, 1.5, 1.5, "#b19a63", "#b8b8b8");
          }
          c.strokeStyle = "#b8a06c"; c.lineWidth = 1.7;
          c.beginPath(); c.arc(x + ow * .76, y + oh * .61, 2.5, 0, Math.PI * 2); c.stroke();
          h.strokeStyle = "#c0c0c0"; h.lineWidth = 2;
          h.beginPath(); h.arc(x + ow * .76, y + oh * .61, 2.5, 0, Math.PI * 2); h.stroke();
        } else {
          const grad = c.createLinearGradient(0, y, 0, y + oh);
          grad.addColorStop(0, "#333c35"); grad.addColorStop(1, "#6b6950");
          c.fillStyle = grad; c.fillRect(x, y, ow, oh);
          h.fillStyle = "#505050"; h.fillRect(x, y, ow, oh);
          r.fillStyle = "#666666"; r.fillRect(x, y, ow, oh);
          e.fillStyle = "#ffb955"; e.fillRect(x, y, ow, oh);
          // Diamond leaded glass: geometry-free, also masked out of emission.
          for (const slope of (wooden ? [] : [-1, 1])) for (let k = -oh; k < ow + oh; k += 9) {
            for (const [g, tint] of [[c, "#242921"], [h, "#777777"], [e, "#000000"]]) {
              g.strokeStyle = tint; g.lineWidth = 1; g.beginPath();
              g.moveTo(x + k, y); g.lineTo(x + k + slope * oh, y + oh); g.stroke();
            }
          }
          if (wooden) {
            rect(x, y + oh/2 - 1, ow, 2, "#b48a51", "#b4b4b4");
            e.fillStyle="black"; e.fillRect(x,y+oh/2-1,ow,2);
          }
          rect(x + ow / 2 - 1.5, y, 3, oh, wooden ? "#b48a51" : "#b2a17d", "#b4b4b4");
          e.fillStyle = "black"; e.fillRect(x + ow / 2 - 1.5, y, 3, oh);
        }
        for (const g of contexts) g.restore();
        rect(x - 7, y + oh, ow + 14, 3, wooden ? "#b28a56" : "#d6c29a", "#d0d0d0");
        rect(x - 5, y + oh + 3, ow + 10, 2, "#75664d", "#aaaaaa");
      }
      if (kind !== 2) {
        const entrance = face.hasDoor;
        if (entrance) opening(Math.max(50,w*.27)-22, logicalH - 87, 44, 78, true);
        for (const floor of face.windowFloors) {
          const baseY = logicalH - 14 - floor * (layout.floorPitch*REFERENCE_PIXELS_PER_METRE);
          const xs = entrance && floor === 0 ? [w * .72] : (kind === 3 ? [w * .32, w * .69] : [w * .5]);
          for (const x of xs) opening(x - 16, baseY - 75, 32, 44, false);
        }
      }
      for (const g of contexts) g.restore();
      // Extruded edge gutters keep mipmaps from pulling neighbouring facades.
      const pw=face.w-2*PAD,ph=face.h-2*PAD;
      for (const g of contexts) {
        const image = g.canvas;
        g.drawImage(image, ox, oy, pw, 1, ox, oy - PAD, pw, PAD);
        g.drawImage(image, ox, oy + ph - 1, pw, 1, ox, oy + ph, pw, PAD);
        g.drawImage(image, ox, oy - PAD, 1, face.h, ox - PAD, oy - PAD, PAD, face.h);
        g.drawImage(image, ox + pw - 1, oy - PAD, 1, face.h, ox + pw, oy - PAD, PAD, face.h);
      }
    }
    const patches=layout.faces.map(f=>({x:f.x,y:f.y,w:f.w,h:f.h,stepX:1/pixelsPerMetre,stepY:1/pixelsPerMetre}));
    const normal=normalFromHeight(height,{patches,repeat:false});
    return { color, normal, rough, emission };
  }


return {makeAtlases};

})();
const {makeAtlases}=atlas;

async function bakeHouses() {

  const stone=await loadImage(path.join(inputs,'medieval-limestone.png'));
  const roof=await loadImage(path.join(inputs,'medieval-terracotta.png'));
  const stoneHeight=heightFromAlbedo(stone,.025),roofHeight=heightFromAlbedo(roof,.032);
  const layout=makeLayout();
  const atlases=makeAtlases(stone,stoneHeight,layout);
  const stoneColor=createCanvas(512,512);stoneColor.getContext('2d').drawImage(stone,0,0,512,512);
  const roofColor=createCanvas(512,512);roofColor.getContext('2d').drawImage(roof,0,0,512,512);
  const images={...atlases,stoneColor,stoneNormal:normalFromHeight(stoneHeight),roofColor,roofNormal:normalFromHeight(roofHeight)};

  const logs=surface(),straw=surface(true);
  const woodLayout=makeLayout(124,true);
  const wooden=makeAtlases(logs.color,logs.height,woodLayout,true);
  for(const [key,value] of Object.entries({...wooden,stoneColor:logs.color,stoneNormal:logs.normal,roofColor:straw.color,roofNormal:straw.normal})) images['wood_'+key]=value;
  for(let variant=1;variant<3;variant++) images["wood_roofNormal"+variant]=surface(true,variant).normal;
  const bundle={};
  for(const [name,c] of Object.entries(images)){
    // Albedo JPEG is small; data/normal maps stay lossless PNG.
    const isColor=['color','roofColor','stoneColor'].includes(name.replace('wood_',''));
    const mime=isColor?'image/jpeg':'image/png';
    const bytes=isColor?c.toBuffer(mime,90):c.toBuffer(mime);
    bundle[name]=`data:${mime};base64,${bytes.toString('base64')}`;
  }
  // Data URLs work in file:// previews without tainting Canvas or CORS requests.
  fs.writeFileSync(path.join(generated,'house-textures.js'),'// Generated by tools/build.cjs\nwindow.HOUSE_TEXTURE_DATA = '+JSON.stringify(bundle)+';\nwindow.HOUSE_FACADE_LAYOUT = '+JSON.stringify(layout)+';\nwindow.WOOD_FACADE_LAYOUT = '+JSON.stringify(woodLayout)+';\n');
  console.log(`Metric facade atlas: ${layout.width} x ${layout.height}, ${layout.faces.length} faces, ${layout.pixelsPerMetre} pixels/metre.`);
  console.log('Baked facade, stone and terracotta maps:',Object.keys(bundle).join(', '));

}

async function bakeFoliage() {
  const out = generated;
  const source = await loadImage(path.join(inputs, 'hedge-leaves-source.png'));
  const canvas = createCanvas(1024, 1024);
  canvas.getContext('2d').drawImage(source, 0, 0, 1024, 1024);
  const bytes = canvas.toBuffer('image/jpeg', 90);
  fs.writeFileSync(path.join(out, 'hedge-leaves.jpg'), bytes);
  const height = createCanvas(1024, 1024), h = height.getContext('2d');
  h.fillStyle = '#808080'; h.fillRect(0, 0, 1024, 1024);
  let seed = 72391;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 2600; i++) {
    const x = random() * 1024, y = random() * 1024, radius = 5 + random() * 19;
    const level = random() > .5 ? 146 : 110;
    for (const dx of [-1024, 0, 1024]) for (const dy of [-1024, 0, 1024]) {
      const px = x + dx, py = y + dy;
      if (px + radius < 0 || px - radius > 1024 || py + radius < 0 || py - radius > 1024) continue;
      const gradient = h.createRadialGradient(px, py, 0, px, py, radius);
      gradient.addColorStop(0, `rgba(${level},${level},${level},.55)`);
      gradient.addColorStop(1, `rgba(${level},${level},${level},0)`);
      h.fillStyle = gradient; h.fillRect(px-radius, py-radius, radius*2, radius*2);
    }
  }
  const normal = normalFromHeight(height, {widthMetres:.65, heightMetres:.65});
  const normalBytes = normal.toBuffer('image/png');
  fs.writeFileSync(path.join(out, 'hedge-leaves-normal.png'), normalBytes);
  fs.writeFileSync(path.join(out, 'foliage-texture.js'),
    '// Generated by tools/build.cjs. Do not edit. CC0 photo by para / paramecij; see ../vendor/hedge-leaves-license.txt\nwindow.HEDGE_TEXTURE_DATA = ' +
    JSON.stringify('data:image/jpeg;base64,' + bytes.toString('base64')) + ';\nwindow.HEDGE_NORMAL_DATA = ' +
    JSON.stringify('data:image/png;base64,' + normalBytes.toString('base64')) + ';\n');
  console.log(`Foliage photo: 1024 x 1024, ${bytes.length} bytes.`);

}

async function build() {
  fs.mkdirSync(generated, {recursive:true});
  await bakeHouses();
  await bakeFoliage();
  fs.copyFileSync(path.join(inputs, 'hedge-leaves-license.txt'), path.join(__dirname, '../static/vendor/hedge-leaves-license.txt'));
  console.log('Textures ready: static/generated/. Deploy index.html and static/.');
}
module.exports = {makeLayout,gameVariants,key,normalFromHeight,heightFromAlbedo};
if (require.main === module) build().catch(error => { console.error(error); process.exitCode = 1; });
