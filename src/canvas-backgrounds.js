// Procedural, resolution-independent artwork, shared by 2D and WebGL.
export const CANVAS_BACKGROUNDS = [
  { id: 'light', zh: '日间', en: 'Daylight', color: '#ffffff', dark: false },
  { id: 'dark', zh: '夜间', en: 'Night', color: '#000000', dark: true },
  { id: 'stardust', zh: '紫色星尘', en: 'Violet stardust', color: '#171127', dark: true },
  { id: 'paper', zh: '暖纸', en: 'Warm paper', color: '#faf6ed', dark: false },
  { id: 'rose', zh: '柔粉', en: 'Soft rose', color: '#fff5f8', dark: false },
  { id: 'lavender', zh: '淡紫轨迹', en: 'Lavender orbits', color: '#f5f3fb', dark: false },
  { id: 'lagoon', zh: '青绿薄雾', en: 'Lagoon mist', color: '#f0f8f5', dark: false },
  { id: 'cosmos', zh: '深空', en: 'Deep cosmos', color: '#080e1c', dark: true }
];
export const backgroundPreset = id => CANVAS_BACKGROUNDS.find(p => p.id === id) || CANVAS_BACKGROUNDS[0];
const cache = new Map();
export function backgroundArtwork(id, width, height) {
  const w = Math.max(1, Math.round(width)), h = Math.max(1, Math.round(height));
  const key = `${id}:${w}:${h}`;
  if (cache.has(key)) return cache.get(key);
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const preset = backgroundPreset(id);
  ctx.fillStyle = preset.color; ctx.fillRect(0, 0, w, h);
  const glow = (x, y, r, color) => {
    const g = ctx.createRadialGradient(x*w, y*h, 0, x*w, y*h, r*Math.max(w,h));
    g.addColorStop(0, color); g.addColorStop(1, `${color.slice(0,7)}00`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  };
  if (id === 'stardust' || id === 'cosmos') {
    glow(.2, .25, .65, id === 'stardust' ? '#703dc845' : '#17467d33');
    glow(.82, .8, .5, id === 'stardust' ? '#c1489628' : '#52267528');
    let seed = 2718;
    const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i=0; i<200; i++) {
      const x=rand()*w, y=rand()*h, r=(.3+rand()*.85)*Math.max(.55, w/1400);
      ctx.fillStyle=`rgba(220,213,255,${.15+rand()*.45})`;
      ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
      if (i%23===0) glow(x/w,y/h,.012,'#c2acff18');
    }
  } else if (id === 'rose') {
    glow(.02,.25,.55,'#f5bcd575'); glow(.92,.92,.65,'#e3c8f078'); glow(.9,.02,.35,'#ffdec780');
    ctx.strokeStyle='#d987af25';ctx.lineWidth=Math.max(.7,w/1500);
    for(let i=0;i<5;i++) {
      ctx.beginPath();ctx.ellipse(w*.12,h*.24,w*(.12+i*.027),h*(.14+i*.025),-.5,0,Math.PI*2);ctx.stroke();
    }
    ctx.fillStyle='#cd87b627';
    for(let i=0;i<18;i++){ctx.beginPath();ctx.ellipse(w*(.72+(i%6)*.044),h*(.68+Math.floor(i/6)*.09),w*.003,h*.008,-.6,0,Math.PI*2);ctx.fill();}
  } else if (id === 'lagoon') {
    glow(.12,.92,.65,'#a3d9cc70'); glow(.95,.12,.7,'#c1dae970');
    ctx.strokeStyle='#6eaba02a';ctx.lineWidth=Math.max(.7,w/1500);
    for(let i=0;i<9;i++){ctx.beginPath();ctx.moveTo(-w*.05,h*(.55+i*.042));ctx.bezierCurveTo(w*.3,h*(.15+i*.045),w*.5,h*(1+i*.032),w*1.05,h*(.5+i*.036));ctx.stroke();}
  } else if (id === 'paper') {
    glow(.8,.3,.8,'#eeddb454');
    ctx.strokeStyle='#bba88712'; ctx.lineWidth=.65;
    const gap=Math.max(12,w/60);
    for(let y=gap;y<h;y+=gap) { ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke(); }
    ctx.strokeStyle='#bba8870e';
    for(let x=gap;x<w;x+=gap){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
    ctx.strokeStyle='#ad936328';ctx.lineWidth=Math.max(.8,w/1400);
    for(const [x,y] of [[.08,.1],[.92,.1],[.08,.9],[.92,.9]]) {ctx.beginPath();ctx.moveTo(w*(x-.008),h*y);ctx.lineTo(w*(x+.008),h*y);ctx.moveTo(w*x,h*(y-.012));ctx.lineTo(w*x,h*(y+.012));ctx.stroke();}
  } else if (id === 'lavender') {
    glow(.15,.15,.7,'#d4c8f650'); glow(.9,.9,.6,'#eacfe64d');
    ctx.strokeStyle='#8b78b314'; ctx.lineWidth=Math.max(.6,w/1600);
    for(let i=0;i<6;i++) {ctx.beginPath();ctx.ellipse(.85*w,.2*h,w*(.24+i*.035),h*(.31+i*.045),-.5,0,Math.PI*2);ctx.stroke();}
    const points=[[.07,.72],[.16,.62],[.28,.76],[.21,.9],[.07,.72]];
    ctx.strokeStyle='#9275c42c';ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x*w,y*h):ctx.moveTo(x*w,y*h));ctx.stroke();
    for(const [x,y] of points.slice(0,-1)){ctx.fillStyle='#f5f3fb';ctx.beginPath();ctx.arc(x*w,y*h,Math.max(2,w*.005),0,Math.PI*2);ctx.fill();ctx.stroke();}
  }
  // Bound retained raster memory when the window is repeatedly resized.
  let retainedPixels = w*h;
  for (const value of cache.values()) retainedPixels += value.width*value.height;
  while (cache.size && (retainedPixels > 16000000 || cache.size >= 18)) {
    const oldest = cache.keys().next().value, value = cache.get(oldest);
    retainedPixels -= value.width*value.height; cache.delete(oldest);
  }
  cache.set(key, canvas); return canvas;
}
