// Interactive 3D container: drag to rotate, pinch or scroll to zoom. Liquid level shows what is left.
import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';

const LATHE={
  bottle:{p:[[0,0],[.40,0],[.44,.05],[.44,1.22],[.38,1.42],[.21,1.6],[.15,1.7],[.15,1.9],[0,1.9]],max:1.66,cap:[.17,.17,.22,1.9]},
  jug:{p:[[0,0],[.6,0],[.65,.06],[.65,1.42],[.52,1.68],[.24,1.8],[.24,1.92],[0,1.92]],max:1.72,cap:[.26,.26,.16,1.92]},
  tub:{p:[[0,0],[.52,0],[.55,.04],[.68,1.26],[0,1.26]],max:1.22,cap:[.72,.72,.1,1.26]},
  jar:{p:[[0,0],[.54,0],[.6,.07],[.6,1.3],[.48,1.44],[.48,1.56],[0,1.56]],max:1.36,cap:[.52,.52,.16,1.56]},
  can:{p:[[0,0],[.5,0],[.54,.05],[.54,1.48],[.5,1.54],[0,1.54]],max:1.48,cap:null}
};
const BOXY={carton:{w:.92,d:.92,h:1.6,max:1.55},box:{w:1.2,d:.5,h:1.7,max:1.66},bag:{w:1.08,d:.34,h:1.66,max:1.55}};

function rAt(p,y){for(let i=1;i<p.length;i++){const a=p[i-1],b=p[i];if(y>=a[1]&&y<=b[1]&&b[1]>a[1]){const t=(y-a[1])/(b[1]-a[1]);return a[0]+(b[0]-a[0])*t}}return p[p.length-2][0]}
function liquidLathe(def,lvl){
  const y0=.05,yl=Math.max(y0+.01,y0+(def.max-y0)*lvl),pts=[new THREE.Vector2(0,y0)];
  for(let y=y0;y<yl;y+=.03)pts.push(new THREE.Vector2(rAt(def.p,y)*.93,y));
  pts.push(new THREE.Vector2(rAt(def.p,yl)*.93,yl),new THREE.Vector2(0,yl));
  return new THREE.LatheGeometry(pts,72);
}
function roundedRect(w,h,r){const s=new THREE.Shape(),x=-w/2;s.moveTo(x+r,0);s.lineTo(x+w-r,0);s.quadraticCurveTo(x+w,0,x+w,r);s.lineTo(x+w,h-r);s.quadraticCurveTo(x+w,h,x+w-r,h);s.lineTo(x+r,h);s.quadraticCurveTo(x,h,x,h-r);s.lineTo(x,r);s.quadraticCurveTo(x,0,x+r,0);return s}
function cartonGeo(w,d,h){const s=new THREE.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(w/2,h);s.lineTo(0,h+.36);s.lineTo(-w/2,h);s.closePath();const g=new THREE.ExtrudeGeometry(s,{depth:d,bevelEnabled:false});g.translate(0,0,-d/2);return g}

function labelCanvas(info,img){
  const c=document.createElement('canvas');c.width=1024;c.height=420;const x=c.getContext('2d');
  x.fillStyle='#fbf6f8';x.fillRect(0,0,1024,420);
  x.fillStyle='#3b1d2c';x.fillRect(0,0,1024,14);x.fillRect(0,406,1024,14);
  let tx=70;
  if(img){const s=Math.min(300/img.width,330/img.height),w=img.width*s,h=img.height*s;x.drawImage(img,60+(300-w)/2,45+(330-h)/2,w,h);tx=400}
  x.fillStyle='#7a5a68';x.font='600 46px Manrope, sans-serif';x.fillText((info.brand||'').slice(0,26),tx,120);
  x.fillStyle='#1d1419';x.font='600 74px "Cormorant Garamond", serif';
  const words=(info.name||'').split(' ');let line='',y=210;
  for(const w of words){const t=line?line+' '+w:w;if(x.measureText(t).width>1024-tx-50&&line){x.fillText(line,tx,y);y+=78;line=w;if(y>300)break}else line=t}
  if(y<=300)x.fillText(line,tx,y);
  x.fillStyle='#7a5a68';x.font='500 42px Manrope, sans-serif';x.fillText(info.label||'',tx,365);
  return c;
}

export function mountViewer(el,item){
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
  el.appendChild(renderer.domElement);
  const scene=new THREE.Scene(),cam=new THREE.PerspectiveCamera(34,1,.1,100);
  cam.position.set(2.7,2.1,4.6);
  const ctl=new OrbitControls(cam,renderer.domElement);
  ctl.target.set(0,.95,0);ctl.enableDamping=true;ctl.enablePan=false;ctl.minDistance=2.2;ctl.maxDistance=7.5;ctl.autoRotate=!reduce;ctl.autoRotateSpeed=1.2;
  ctl.addEventListener('start',()=>ctl.autoRotate=false);
  scene.add(new THREE.HemisphereLight(0xffffff,0x4a2a3a,1.25));
  const key=new THREE.DirectionalLight(0xffffff,2.2);key.position.set(3,5,4);scene.add(key);
  const rim=new THREE.DirectionalLight(0xffd9e6,1.1);rim.position.set(-4,2.5,-3);scene.add(rim);

  // soft floor shadow
  const sc=document.createElement('canvas');sc.width=sc.height=128;const sx=sc.getContext('2d'),gr=sx.createRadialGradient(64,64,0,64,64,64);
  gr.addColorStop(0,'rgba(40,10,25,.35)');gr.addColorStop(1,'rgba(40,10,25,0)');sx.fillStyle=gr;sx.fillRect(0,0,128,128);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(2.6,2.6),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(sc),transparent:true,depthWrite:false}));
  floor.rotation.x=-Math.PI/2;floor.position.y=-.001;scene.add(floor);

  const glass=new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:.05,metalness:0,transparent:true,opacity:.2,clearcoat:1,clearcoatRoughness:.05,side:THREE.DoubleSide,depthWrite:false});
  const liquidMat=new THREE.MeshStandardMaterial({color:new THREE.Color(item.color||'#e8dccd'),roughness:.4,metalness:0,transparent:true,opacity:.95});
  const capMat=new THREE.MeshStandardMaterial({color:0x3b1d2c,roughness:.35,metalness:.3});
  const group=new THREE.Group();scene.add(group);
  const shape=LATHE[item.shape]?item.shape:(BOXY[item.shape]?item.shape:'bag');
  let liquid,level=0,labelMat=null;
  if(LATHE[shape]){
    const def=LATHE[shape];
    group.add(new THREE.Mesh(new THREE.LatheGeometry(def.p.map(([r,y])=>new THREE.Vector2(r,y)),72),glass));
    liquid=new THREE.Mesh(liquidLathe(def,.01),liquidMat);group.add(liquid);
    if(def.cap){const [a,b,h,y]=def.cap;const cap=new THREE.Mesh(new THREE.CylinderGeometry(a,b,h,48),capMat);cap.position.y=y+h/2;group.add(cap)}
    const lr=rAt(def.p,def.max*.45)+.012;
    labelMat=new THREE.MeshStandardMaterial({transparent:true,opacity:.96,side:THREE.DoubleSide,roughness:.6});
    const band=new THREE.Mesh(new THREE.CylinderGeometry(lr,lr,Math.min(.62,def.max*.42),64,1,true,-Math.PI*.42,Math.PI*.84),labelMat);
    band.position.y=def.max*.42;group.add(band);
    group.userData.setL=l=>{liquid.geometry.dispose();liquid.geometry=liquidLathe(def,l)};
  }else{
    const b=BOXY[shape];
    const body=shape==='carton'?cartonGeo(b.w,b.d,b.h):shape==='bag'?(()=>{const g=new THREE.ExtrudeGeometry(roundedRect(b.w,b.h,.16),{depth:b.d,bevelEnabled:true,bevelThickness:.1,bevelSize:.06,bevelSegments:6,curveSegments:10});g.translate(0,0,-b.d/2);return g})():new THREE.BoxGeometry(b.w,b.h,b.d).translate(0,b.h/2,0);
    group.add(new THREE.Mesh(body,glass));
    const lg=new THREE.BoxGeometry(b.w*.92,1,b.d*.9).translate(0,.5,0);
    liquid=new THREE.Mesh(lg,liquidMat);liquid.position.y=.04;liquid.scale.y=.01;group.add(liquid);
    if(shape==='carton'){const fin=new THREE.Mesh(new THREE.BoxGeometry(.03,.08,b.d),glass);fin.position.y=b.h+.4;group.add(fin);
      const sp=new THREE.Mesh(new THREE.CylinderGeometry(.11,.11,.08,32),capMat);sp.position.set(.2,b.h+.2,.2);sp.rotation.z=-.62;group.add(sp)}
    labelMat=new THREE.MeshStandardMaterial({transparent:true,opacity:.96,roughness:.6});
    const lw=b.w*.94,lh=Math.min(.62,lw*.41);
    const pl=new THREE.Mesh(new THREE.PlaneGeometry(lw,lh),labelMat);pl.position.set(0,b.h*.42,b.d/2+(shape==='bag'?.11:.005));group.add(pl);
    group.userData.setL=l=>{liquid.scale.y=Math.max(.01,(b.max-.04)*l)};
  }
  const setTex=img=>{const t=new THREE.CanvasTexture(labelCanvas(item,img));t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;if(labelMat.map)labelMat.map.dispose();labelMat.map=t;labelMat.needsUpdate=true};
  setTex(null);
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>alive&&setTex(null));
  if(item.image){const im=new Image();im.crossOrigin='anonymous';im.onload=()=>alive&&setTex(im);im.src=item.image}

  let alive=true,anim=null;
  function size(){const w=el.clientWidth,h=el.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix()}
  const ro=new ResizeObserver(size);ro.observe(el);size();
  function setLevel(l,animate=true){
    l=Math.max(0,Math.min(1,l));
    if(!animate||reduce){level=l;group.userData.setL(l);return}
    const from=level,t0=performance.now(),dur=1100;anim=now=>{const k=Math.min(1,(now-t0)/dur),e=1-(1-k)**3;level=from+(l-from)*e;group.userData.setL(level);if(k>=1)anim=null};
  }
  function loop(now){if(!alive)return;if(anim)anim(now);ctl.update();renderer.render(scene,cam);requestAnimationFrame(loop)}
  requestAnimationFrame(loop);
  setLevel(item.level??1,true);
  return {setLevel,dispose(){alive=false;ro.disconnect();ctl.dispose();scene.traverse(o=>{o.geometry&&o.geometry.dispose();if(o.material){o.material.map&&o.material.map.dispose();o.material.dispose()}});renderer.dispose();renderer.domElement.remove()}};
}
