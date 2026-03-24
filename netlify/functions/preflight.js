// ══════════════════════════════════════════════════════════
// INVITATIONS — ARTWORK PREFLIGHT CHECK
// No native dependencies — pure Node.js file byte inspection
// ══════════════════════════════════════════════════════════

const https = require('https');

const SUPABASE_URL = 'https://jvcpzmumkyjdyibmwlsd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_-9PtQ9cNyzpuR3XithsFgQ_vTYQbbmt';

const FALLBACK = {
  minDpi:300, warnDpi:150, maxFileMb:200, warnFileMb:50, bleedMm:3,
  automatedTypes:['jpg','jpeg','png','tif','tiff'],
  manualTypes:['pdf','ai','eps','svg'],
};

const KNOWN_SIZES = [
  {name:'A6 (standard)',w:148,h:105},{name:'A5',w:210,h:148},
  {name:'DL',w:210,h:99},{name:'Square 130mm',w:130,h:130},
  {name:'Square 148mm',w:148,h:148},{name:'Square 160mm',w:160,h:160},
  {name:'A4',w:297,h:210},
];

async function getThresholds() {
  return new Promise(resolve => {
    const req = https.get(
      `${SUPABASE_URL}/rest/v1/pricing_config?id=eq.1&select=config`,
      {headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`}},
      res => {
        let data='';
        res.on('data',c=>data+=c);
        res.on('end',()=>{
          try { const pf=JSON.parse(data)?.[0]?.config?.preflight; resolve(pf?{...FALLBACK,...pf}:FALLBACK); }
          catch{resolve(FALLBACK);}
        });
      }
    );
    req.on('error',()=>resolve(FALLBACK));
    req.setTimeout(3000,()=>{req.destroy();resolve(FALLBACK);});
  });
}

function parseMultipart(event) {
  const ct = event.headers['content-type']||event.headers['Content-Type']||'';
  const bm = ct.match(/boundary=([^\s;]+)/);
  if (!bm) throw new Error('No boundary');
  const boundary = bm[1];
  const body = Buffer.from(event.body, event.isBase64Encoded?'base64':'binary');
  const bBuf = Buffer.from('--'+boundary);
  const parts=[];
  let start=0;
  for(let i=0;i<body.length;i++){
    if(body.slice(i,i+bBuf.length).equals(bBuf)){
      if(start>0) parts.push(body.slice(start,i-2));
      start=i+bBuf.length+2;
    }
  }
  for(const part of parts){
    const he=part.indexOf('\r\n\r\n');
    if(he===-1) continue;
    const hs=part.slice(0,he).toString();
    const fd=part.slice(he+4);
    if(hs.includes('filename=')){
      const fn=hs.match(/filename="([^"]+)"/);
      return {buffer:fd,filename:fn?fn[1]:'file',fileSizeBytes:fd.length};
    }
  }
  throw new Error('No file found');
}

// ── BYTE-LEVEL IMAGE ANALYSIS ─────────────────────────
function r16BE(b,o){return(b[o]<<8)|b[o+1];}
function r16LE(b,o){return b[o]|(b[o+1]<<8);}
function r32BE(b,o){return((b[o]<<24)|(b[o+1]<<16)|(b[o+2]<<8)|b[o+3])>>>0;}
function r32LE(b,o){return(b[o]|(b[o+1]<<8)|(b[o+2]<<16)|(b[o+3]<<24))>>>0;}

function analyseJpeg(buf) {
  let w=0,h=0,dpi=null,channels=3;
  let i=2;
  while(i<buf.length-3){
    if(buf[i]!==0xFF) break;
    const mk=buf[i+1];
    if(mk===0xD9||mk===0xDA) break;
    const sl=r16BE(buf,i+2);
    // APP0 JFIF
    if(mk===0xE0&&sl>=14){
      const unit=buf[i+9],xd=r16BE(buf,i+10),yd=r16BE(buf,i+12);
      if(unit===1) dpi=Math.max(xd,yd);
      if(unit===2) dpi=Math.round(Math.max(xd,yd)*2.54);
    }
    // SOF
    if((mk>=0xC0&&mk<=0xC3)||(mk>=0xC5&&mk<=0xC7)){
      h=r16BE(buf,i+5);w=r16BE(buf,i+7);channels=buf[i+9];
    }
    i+=2+sl;
  }
  const space=channels===1?'grey':channels===4?'cmyk':'srgb';
  return{width:w,height:h,dpi:dpi&&dpi>0?dpi:null,space,format:'jpeg'};
}

function analysePng(buf) {
  if(buf.length<33) return null;
  const w=r32BE(buf,16),h=r32BE(buf,20),ct=buf[25];
  let dpi=null;
  for(let i=8;i<buf.length-16;i++){
    if(buf.toString('ascii',i+4,i+8)==='pHYs'){
      const ppuX=r32BE(buf,i+8),unit=buf[i+16];
      if(unit===1&&ppuX>0) dpi=Math.round(ppuX/39.3701);
      break;
    }
  }
  const sm={0:'grey',2:'srgb',3:'srgb',4:'grey',6:'srgb'};
  return{width:w,height:h,dpi,space:sm[ct]||'srgb',format:'png'};
}

function analyseTiff(buf) {
  const le=buf[0]===0x49;
  const r16=le?r16LE:r16BE,r32=le?r32LE:r32BE;
  const ifdOff=r32(buf,4);
  if(ifdOff+2>buf.length) return null;
  const n=r16(buf,ifdOff);
  let w=0,h=0,dpi=null,photo=2;
  for(let e=0;e<n;e++){
    const o=ifdOff+2+e*12;
    if(o+12>buf.length) break;
    const tag=r16(buf,o),type=r16(buf,o+2),val=r32(buf,o+8);
    if(tag===256)w=val;
    if(tag===257)h=val;
    if(tag===262)photo=val;
    if((tag===282||tag===283)&&type===5&&!dpi){
      try{const num=r32(buf,val),den=r32(buf,val+4);if(den>0)dpi=Math.round(num/den);}catch{}
    }
  }
  const sm={1:'grey',2:'srgb',5:'cmyk',6:'srgb'};
  return{width:w,height:h,dpi:dpi&&dpi>0?dpi:null,space:sm[photo]||'srgb',format:'tiff'};
}

function detectAndAnalyse(buf) {
  if(buf[0]===0xFF&&buf[1]===0xD8&&buf[2]===0xFF) return analyseJpeg(buf);
  if(buf[0]===0x89&&buf[1]===0x50&&buf[2]===0x4E&&buf[3]===0x47) return analysePng(buf);
  if((buf[0]===0x49&&buf[1]===0x49)||(buf[0]===0x4D&&buf[1]===0x4D)) return analyseTiff(buf);
  return null;
}

function pxToMm(px,dpi){return(px/dpi)*25.4;}

function closestSize(wMm,hMm,tol=12){
  let best=null,bestD=Infinity;
  for(const s of KNOWN_SIZES){
    for(const[w,h]of[[s.w,s.h],[s.h,s.w]]){
      const d=Math.abs(wMm-w)+Math.abs(hMm-h);
      if(d<bestD){bestD=d;best={...s};}
    }
  }
  return bestD<=tol?best:null;
}

function respond(checks,headers){
  return{statusCode:200,headers,body:JSON.stringify({
    checks,
    summary:{
      errors:checks.filter(c=>c.status==='err').length,
      warnings:checks.filter(c=>c.status==='warn').length,
      passed:checks.filter(c=>c.status==='ok').length,
    }
  })};
}

exports.handler = async event => {
  const headers={'Access-Control-Allow-Origin':'*','Content-Type':'application/json'};
  if(event.httpMethod==='OPTIONS') return{statusCode:200,headers,body:''};
  if(event.httpMethod!=='POST') return{statusCode:405,headers,body:JSON.stringify({error:'Method not allowed'})};

  try {
    const T=await getThresholds();
    const{buffer,filename,fileSizeBytes}=parseMultipart(event);
    const ext=(filename||'').split('.').pop().toLowerCase();
    const fileSizeMB=(fileSizeBytes/1024/1024).toFixed(2);
    const checks=[];

    // FILE SIZE
    if(fileSizeMB>T.maxFileMb){
      checks.push({status:'err',label:'File Size',val:fileSizeMB+' MB',note:`Exceeds the ${T.maxFileMb}MB limit. Please compress before uploading.`});
      return respond(checks,headers);
    } else if(fileSizeMB>T.warnFileMb){
      checks.push({status:'warn',label:'File Size',val:fileSizeMB+' MB',note:`Large file (${fileSizeMB}MB) — received but may cause delays.`});
    } else {
      checks.push({status:'ok',label:'File Size',val:fileSizeMB+' MB',note:'File size is within acceptable limits.'});
    }

    // FILE TYPE
    const isImage=T.automatedTypes.includes(ext);
    const isVector=T.manualTypes.includes(ext);

    if(!isImage&&!isVector){
      checks.push({status:'err',label:'File Type',val:ext.toUpperCase(),note:'Unsupported file type. Please upload PDF, AI, EPS, JPG, PNG or TIFF.'});
      return respond(checks,headers);
    }

    if(isVector){
      checks.push({status:'ok',label:'File Type',val:ext.toUpperCase(),note:ext==='pdf'?'PDF received — our preferred format for best print quality.':`${ext.toUpperCase()} received — vector files produce excellent print results.`});
      checks.push({status:'info',label:'Colour Mode',val:'Please verify',note:'Ensure your file is CMYK. RGB will be converted before printing which can cause colour shifts.'});
      checks.push({status:'info',label:'Bleed',val:`${T.bleedMm}mm required`,note:`Please confirm ${T.bleedMm}mm bleed is included on all sides. Our team will verify during pre-press.`});
      checks.push({status:'info',label:'Fonts',val:'Please verify',note:'Please embed all fonts or convert to outlines before uploading.'});
      checks.push({status:'info',label:'Manual Review',val:'',note:'Our studio team will perform a full pre-press check before anything goes to print.'});
      return respond(checks,headers);
    }

    // IMAGE ANALYSIS
    const meta=detectAndAnalyse(buffer);
    if(!meta){
      checks.push({status:'err',label:'File Read',val:'',note:'Could not read the file. It may be corrupted. Please try re-saving and uploading again.'});
      return respond(checks,headers);
    }

    const{width,height,dpi,space,format}=meta;
    const fmtLabel={jpeg:'JPEG',png:'PNG',tiff:'TIFF'}[format]||ext.toUpperCase();
    checks.push({status:'ok',label:'File Type',val:fmtLabel,note:format==='tiff'?'TIFF — excellent for professional print, full quality preserved.':format==='png'?'PNG received. Ensure 300dpi at final print size.':'JPEG received. Ensure the file has not been heavily compressed.'});

    // RESOLUTION
    if(!dpi){
      const minPx=Math.round(100*T.minDpi/25.4);
      if(width<minPx&&height<minPx){
        checks.push({status:'err',label:'Resolution',val:`${width}×${height}px`,note:`No DPI metadata and pixel dimensions appear low. Please re-export at ${T.minDpi}dpi.`});
      } else {
        checks.push({status:'warn',label:'Resolution',val:`${width}×${height}px`,note:`No DPI metadata embedded. Pixel count looks reasonable but please export at a confirmed ${T.minDpi}dpi.`});
      }
    } else if(dpi<T.warnDpi){
      checks.push({status:'err',label:'Resolution',val:`${dpi}dpi`,note:`${dpi}dpi is well below the ${T.minDpi}dpi minimum. The print will appear blurry. Please re-export at ${T.minDpi}dpi.`});
    } else if(dpi<T.minDpi){
      checks.push({status:'warn',label:'Resolution',val:`${dpi}dpi`,note:`${dpi}dpi is below our ${T.minDpi}dpi minimum. Print may appear slightly soft. Re-exporting at ${T.minDpi}dpi is recommended.`});
    } else {
      checks.push({status:'ok',label:'Resolution',val:`${dpi}dpi`,note:`${dpi}dpi — above the ${T.minDpi}dpi minimum for sharp professional print.`});
    }

    // DIMENSIONS + BLEED
    const effDpi=dpi||T.minDpi;
    const wMm=pxToMm(width,effDpi),hMm=pxToMm(height,effDpi);
    const match=closestSize(wMm,hMm);
    if(match){
      const expW=match.w+T.bleedMm*2,expH=match.h+T.bleedMm*2;
      const hasBleed=wMm>=expW-1&&hMm>=expH-1;
      checks.push({status:'ok',label:'Dimensions',val:`${Math.round(wMm)}×${Math.round(hMm)}mm`,note:`Matches ${match.name}${hasBleed?' with bleed — excellent.':'.'}`});
      if(hasBleed){
        checks.push({status:'ok',label:'Bleed',val:`${T.bleedMm}mm detected`,note:`${T.bleedMm}mm bleed included on all sides — no white edges after trimming.`});
      } else {
        checks.push({status:'warn',label:'Bleed',val:`${T.bleedMm}mm required`,note:`File appears to be at trim size without bleed. Please add ${T.bleedMm}mm — file should be ${Math.round(expW)}×${Math.round(expH)}mm.`});
      }
    } else if(wMm<40||hMm<40){
      checks.push({status:'err',label:'Dimensions',val:`${Math.round(wMm)}×${Math.round(hMm)}mm`,note:'Dimensions appear very small. Please check you are uploading the full-size artwork.'});
    } else {
      checks.push({status:'info',label:'Dimensions',val:`${Math.round(wMm)}×${Math.round(hMm)}mm`,note:'Custom dimensions — please confirm this matches your intended print size.'});
      checks.push({status:'info',label:'Bleed',val:`${T.bleedMm}mm required`,note:`Please ensure ${T.bleedMm}mm bleed is included on all sides.`});
    }

    // COLOUR MODE
    const cm={
      cmyk:{status:'ok',  val:'CMYK',      note:'CMYK colour mode — ideal for print. Colours will reproduce accurately.'},
      grey:{status:'ok',  val:'Greyscale', note:'Greyscale — correct for black and white designs.'},
      srgb:{status:'warn',val:'RGB',       note:'RGB colour mode. We will convert to CMYK before printing — this can cause slight colour shifts, particularly with vivid greens and oranges.'},
      p3:  {status:'warn',val:'Display P3',note:'Wide-gamut P3 colour space. Will be converted to CMYK — some colours may shift noticeably.'},
    }[space]||{status:'info',val:space||'Unknown',note:'Colour space could not be determined. Our team will verify before printing.'};
    checks.push({status:cm.status,label:'Colour Mode',val:cm.val,note:cm.note});

    return respond(checks,headers);

  } catch(err){
    console.error('Preflight error:',err);
    return{statusCode:200,headers,body:JSON.stringify({
      checks:[{status:'info',label:'Manual Review',val:'',note:'Your file has been received. Our team will check it before printing.'}],
      summary:{errors:0,warnings:0,passed:0}
    })};
  }
};
