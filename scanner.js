// Live barcode scanning: native BarcodeDetector where available (Android Chrome), ZXing everywhere else (iPhone).
const FORMATS=['ean_13','ean_8','upc_a','upc_e','code_128'];
let native=null;
async function getNative(){
  if(native!==null)return native;
  try{if('BarcodeDetector' in window){const sup=await BarcodeDetector.getSupportedFormats();const f=FORMATS.filter(x=>sup.includes(x));native=f.length?new BarcodeDetector({formats:f}):false}else native=false}catch(e){native=false}
  return native;
}
let zx=null;
function zxing(){
  if(zx)return zx;const Z=window.ZXing;if(!Z)return null;
  const hints=new Map();hints.set(Z.DecodeHintType.POSSIBLE_FORMATS,[Z.BarcodeFormat.EAN_13,Z.BarcodeFormat.EAN_8,Z.BarcodeFormat.UPC_A,Z.BarcodeFormat.UPC_E,Z.BarcodeFormat.CODE_128]);
  hints.set(Z.DecodeHintType.TRY_HARDER,true);
  const r=new Z.MultiFormatReader();r.setHints(hints);
  return zx={Z,r};
}
function zxDecodeCanvas(c){
  const z=zxing();if(!z)return null;
  try{const src=new z.Z.HTMLCanvasElementLuminanceSource(c);const bmp=new z.Z.BinaryBitmap(new z.Z.HybridBinarizer(src));return z.r.decode(bmp).getText()}catch(e){return null}
  finally{try{z.r.reset()}catch(e){}}
}
const valid=s=>/^\d{8,14}$/.test(s)?s:(s&&s.length>=4?s:null);

export async function startScan(video,onCode){
  const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});
  video.srcObject=stream;video.setAttribute('playsinline','');video.muted=true;await video.play();
  const det=await getNative();
  const c=document.createElement('canvas'),x=c.getContext('2d',{willReadFrequently:true});
  let on=true,busy=false;
  const tick=async()=>{
    if(!on)return;
    if(!busy&&video.readyState>=2){busy=true;
      try{
        let code=null;
        if(det){const r=await det.detect(video);code=r[0]&&r[0].rawValue}
        else{const vw=video.videoWidth,vh=video.videoHeight,cw=Math.min(800,vw),s=cw/vw;
          // centre band where people hold the barcode
          const bh=vh*.5;c.width=cw;c.height=Math.round(bh*s);x.drawImage(video,0,(vh-bh)/2,vw,bh,0,0,c.width,c.height);code=zxDecodeCanvas(c)}
        code=valid(code);
        if(code&&on){on=false;stop();onCode(code);return}
      }catch(e){}
      busy=false}
    setTimeout(tick,det?120:220);
  };
  tick();
  function stop(){on=false;stream.getTracks().forEach(t=>t.stop());video.srcObject=null}
  return stop;
}

export async function decodeImage(file){
  const bmp=await createImageBitmap(file);
  const det=await getNative();
  if(det){try{const r=await det.detect(bmp);if(r[0])return valid(r[0].rawValue)}catch(e){}}
  const c=document.createElement('canvas'),s=Math.min(1,1400/bmp.width);c.width=Math.round(bmp.width*s);c.height=Math.round(bmp.height*s);
  c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);
  return valid(zxDecodeCanvas(c));
}
