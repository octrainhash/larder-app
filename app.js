import {parseQty,fmtAmt,guessType,guessShape,SHAPES,lookupProduct} from './data.js';
import {startScan,decodeImage} from './scanner.js';
import * as cloud from './cloud.js';

/* ================= state ================= */
const KEY='flogger.v1',OLD='larder.v2',DAY=864e5;
const blank=()=>({v:3,onboarded:false,list:[],cart:[],home:[],products:{},recent:[],hints:{},auto:null,scanMode:'multi',place:'fridge',cat:'all'});
function migrate(o){
  const S=blank();S.onboarded=!!o.onboarded;S.products=o.products||{};S.auto=o.auto??null;
  S.list=(o.pending||[]).map(x=>({id:x.id,code:x.code||null,name:x.name||null,qty:x.qty||1}));
  S.cart=(o.collected||[]).map(x=>({id:x.id,code:x.code||null,name:x.name||null,qty:x.qty||1}));
  S.home=(o.home||[]).map(h=>{const type=h.type||'item',cat=catOf(type),loc=(h.loc||'').toLowerCase();
    return {...h,cat,place:loc.includes('freez')?'freezer':loc.includes('fridge')?'fridge':loc?'pantry':placeFor(cat,type)}});
  return S;
}
function load(){try{const r=localStorage.getItem(KEY);if(r)return Object.assign(blank(),JSON.parse(r));const o=localStorage.getItem(OLD);if(o)return migrate(JSON.parse(o))}catch(e){}return blank()}
let ME=null;
function save(){S.updatedAt=Date.now();try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}if(ME&&S.syncUser===ME.id)cloud.pushState(ME.id,S)}

/* ================= helpers ================= */
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const now=()=>Date.now();
const P=code=>code?S.products[code]:null;
const title=p=>p?[p.brand,p.name].filter(Boolean).join(' '):'';
const nameOf=x=>{const p=P(x.code);return p?title(p):(x.name||'Item')};
const keyOf=x=>x.code||('n:'+String(x.name||'').toLowerCase().trim());
const typeOf=x=>{const p=P(x.code);return x.type||(p&&p.type)||guessType(x.name||'')};
const days=t=>Math.round((new Date(t).setHours(0,0,0,0)-new Date().setHours(0,0,0,0))/DAY);
const dkey=t=>{const d=new Date(t);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const cap=s=>s?s[0].toUpperCase()+s.slice(1):s;
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ================= icons & pictures ================= */
const I={
 list:'<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
 cart:'<path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6.2"/><circle cx="9.5" cy="20.5" r="1.3"/><circle cx="17.5" cy="20.5" r="1.3"/>',
 home:'<path d="M3 11l9-7 9 7M5 10v10h14V10"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',minus:'<path d="M5 12h14"/>',
 trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
 check:'<path d="M5 12.5l4.5 4.5L19 7"/>',close:'<path d="M6 6l12 12M18 6L6 18"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',warn:'<path d="M12 3l10 18H2zM12 10v4M12 17.5h.01"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',camera:'<path d="M4 8h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="13" r="3.5"/>',
 back:'<path d="M15 5l-7 7 7 7"/>',
 fridge:'<rect x="6" y="2.5" width="12" height="19" rx="2"/><path d="M6 10h12M9 5.5v2M9 13v3"/>',
 freezer:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M12 7.5v9M8.2 9.7l7.6 4.6M8.2 14.3l7.6-4.6"/>',
 pantry:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 9h16M4 15h16M8 6h2M14 12h2M9 18h2"/>',
 dairy:'<path d="M8 3h8v3l2 3v12H6V9l2-3z"/><path d="M6 9h12"/>',
 meat:'<path d="M14.5 4.5a5 5 0 0 1 5 5c0 3.5-3.5 6-7 5.5l-3.6 3.6a2.2 2.2 0 1 1-3-3l3.6-3.6c-.5-3.5 1.5-7.5 5-7.5z"/>',
 produce:'<path d="M12 8c-2-2.2-7-1.6-7 3.5 0 4 3 9 5 9 .9 0 1.2-.5 2-.5s1.1.5 2 .5c2 0 5-5 5-9 0-5.1-5-5.7-7-3.5z"/><path d="M12 8c0-2 .8-3.6 3-4.5"/>',
 bakery:'<path d="M5 11a3.5 3.5 0 0 1 0-7h14a3.5 3.5 0 0 1 0 7v9H5z"/><path d="M9 7.5v3M13 7.5v3"/>',
 snacks:'<circle cx="12" cy="12" r="8.5"/><path d="M9 9h.01M14.5 9.5h.01M9.5 14.5h.01M15 15h.01M12 12h.01"/>',
 drinks:'<path d="M10 2.5h4v3.5l2 3v12.5H8V9l2-3z"/><path d="M8 13h8"/>',
 frozen:'<path d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5"/>',
 grains:'<path d="M7 8h10v12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1z"/><path d="M8 4h8v4H8zM7 13h10"/>',
 jars:'<path d="M6 5.5C6 4.4 8.7 3.5 12 3.5s6 .9 6 2v13c0 1.1-2.7 2-6 2s-6-.9-6-2z"/><path d="M6 5.5c0 1.1 2.7 2 6 2s6-.9 6-2M6 12c0 1.1 2.7 2 6 2s6-.9 6-2"/>',
 other:'<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>',
 all:'<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
 scan:'<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M8 8v8M11 8v8M14 8v8M17 8v8"/>',
 photo:'<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/>',
 keys:'<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>'
};
const ic=(n,c='i')=>`<svg class="${c}" viewBox="0 0 24 24" aria-hidden="true">${I[n]||I.other}</svg>`;

const CATS=[['dairy','Dairy & eggs','#E3EEF9'],['meat','Meat & fish','#FBDCCB'],['produce','Fruit & veg','#D5F0E6'],['bakery','Bread','#F6E7CF'],['snacks','Snacks','#FFF1C2'],['drinks','Drinks','#DCEFFA'],['frozen','Frozen','#E2E6FA'],['grains','Pasta & grains','#EFE8DA'],['jars','Cans & jars','#F1E2EE'],['other','Other','#ECEEF1']];
const CAT=Object.fromEntries(CATS.map(c=>[c[0],{name:c[1],tint:c[2]}]));
const T2C={milk:'dairy',cream:'dairy',yogurt:'dairy',cheese:'dairy',cheddar:'dairy',mozzarella:'dairy',butter:'dairy',egg:'dairy',
 chicken:'meat',beef:'meat',pork:'meat',fish:'meat',salmon:'meat',tuna:'jars',
 spinach:'produce',lettuce:'produce',apple:'produce',banana:'produce',orange:'produce',lemon:'produce',potato:'produce',onion:'produce',garlic:'produce',carrot:'produce',tomato:'produce',
 bread:'bakery',tortilla:'bakery',chips:'snacks',biscuit:'snacks',cookie:'snacks',crackers:'snacks',chocolate:'snacks',
 juice:'drinks',water:'drinks',soda:'drinks',cola:'drinks',coffee:'drinks',tea:'drinks','ice cream':'frozen',frozen:'frozen',
 rice:'grains',pasta:'grains',spaghetti:'grains',penne:'grains',noodle:'grains',flour:'grains',sugar:'grains',oats:'grains',cereal:'grains',salt:'grains',pepper:'grains',
 beans:'jars',lentils:'jars',chickpeas:'jars',ketchup:'jars',mayonnaise:'jars',mustard:'jars',jam:'jars',honey:'jars',oil:'jars','olive oil':'jars',vinegar:'jars'};
function catOf(type){return T2C[type]||(type&&T2C[type.replace(/s$/,'')])||'other'}
const COOL=new Set(['dairy','meat']);
function placeFor(cat,type){if(cat==='frozen')return 'freezer';if(COOL.has(cat))return 'fridge';if(cat==='produce')return ['potato','onion','garlic','banana'].includes(type)?'pantry':'fridge';return 'pantry'}
const PLACES=[['fridge','Fridge'],['freezer','Freezer'],['pantry','Pantry']];
const PL=Object.fromEntries(PLACES);
const catIcon=(c,size)=>`<span class="ci" style="background:${(CAT[c]||CAT.other).tint}${size?';width:'+size+'px;height:'+size+'px':''}">${ic(c)}</span>`;

function art(kind){
  const s='stroke="#14171C" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"';
  if(kind==='fridge')return `<svg class="art" viewBox="0 0 120 100" aria-hidden="true"><ellipse cx="60" cy="96" rx="34" ry="3" fill="#14171C" opacity=".12"/><rect x="32" y="5" width="56" height="88" rx="9" fill="#CDE8F8" ${s}/><path d="M32 37h56" ${s}/><path d="M78 16v12M78 46v20" stroke="#14171C" stroke-width="4" stroke-linecap="round"/><rect x="40" y="46" width="14" height="10" rx="2" fill="#E69F00" ${s} stroke-width="1.8"/><circle cx="46" cy="20" r="4" fill="#009E73" ${s} stroke-width="1.8"/></svg>`;
  if(kind==='freezer')return `<svg class="art" viewBox="0 0 120 100" aria-hidden="true"><ellipse cx="60" cy="96" rx="36" ry="3" fill="#14171C" opacity=".12"/><rect x="28" y="8" width="64" height="85" rx="9" fill="#BCD6EE" ${s}/><path d="M28 36h64M28 64h64" ${s}/><path d="M52 50h16M52 78h16" stroke="#14171C" stroke-width="4" stroke-linecap="round"/><g ${s} stroke-width="2.2"><path d="M60 13v18M52 17.5l16 9M52 26.5l16-9"/></g></svg>`;
  if(kind==='pantry')return `<svg class="art" viewBox="0 0 120 100" aria-hidden="true"><ellipse cx="60" cy="96" rx="42" ry="3" fill="#14171C" opacity=".12"/><rect x="18" y="6" width="84" height="87" rx="7" fill="#FBE6BB" ${s}/><path d="M18 34h84M18 63h84" ${s}/><g ${s} stroke-width="1.8"><rect x="28" y="17" width="12" height="17" rx="3" fill="#E69F00"/><rect x="45" y="13" width="10" height="21" rx="2" fill="#F0E4E9"/><rect x="62" y="20" width="14" height="14" rx="2" fill="#009E73"/><rect x="82" y="15" width="10" height="19" rx="3" fill="#CC79A7"/><rect x="30" y="46" width="16" height="17" rx="2" fill="#56B4E9"/><rect x="52" y="43" width="12" height="20" rx="3" fill="#D55E00"/><rect x="70" y="49" width="20" height="14" rx="3" fill="#F0E442"/><rect x="30" y="74" width="24" height="12" rx="3" fill="#EFE8DA"/><rect x="62" y="70" width="12" height="16" rx="3" fill="#0072B2"/></g></svg>`;
  if(kind==='list')return `<svg class="art" viewBox="0 0 150 120" aria-hidden="true"><rect x="40" y="10" width="70" height="100" rx="8" fill="#fff" ${s}/><rect x="60" y="4" width="30" height="12" rx="4" fill="#E69F00" ${s}/><g ${s}><circle cx="55" cy="40" r="5" fill="#D5F0E6"/><path d="M66 40h30"/><circle cx="55" cy="60" r="5" fill="#fff"/><path d="M66 60h30"/><circle cx="55" cy="80" r="5" fill="#fff"/><path d="M66 80h22"/></g></svg>`;
  if(kind==='cart')return `<svg class="art" viewBox="0 0 150 120" aria-hidden="true"><g ${s}><path d="M20 22h14l12 56h62l12-42H40" fill="none"/><path d="M42 36h78l-10 38H50z" fill="#E3EEF9"/><rect x="58" y="16" width="16" height="26" rx="3" fill="#D5F0E6"/><rect x="78" y="22" width="20" height="20" rx="3" fill="#FFE9B8"/><circle cx="56" cy="94" r="7" fill="#fff"/><circle cx="100" cy="94" r="7" fill="#fff"/></g></svg>`;
  if(kind==='home')return `<svg class="art" viewBox="0 0 150 120" aria-hidden="true"><g transform="translate(15 10)">${art('fridge').replace(/<svg[^>]*>|<\/svg>/g,'')}</g></svg>`;
  return '';
}
const SH={carton:['M22 36 L40 16 L58 36 L58 112 Q58 116 54 116 L26 116 Q22 116 22 112 Z',36,116],jug:['M32 16 h16 v12 q18 6 18 24 v60 q0 4 -4 4 h-44 q-4 0 -4 -4 v-60 q0 -18 18 -24 Z',30,116],bottle:['M35 6 h10 v20 q12 8 12 24 v62 q0 4 -4 4 h-26 q-4 0 -4 -4 v-62 q0 -16 12 -24 Z',30,116],tub:['M12 44 h56 l-5 68 q-1 4 -5 4 h-36 q-4 0 -5 -4 Z',44,116],jar:['M18 34 h44 v6 q4 4 4 10 v60 q0 6 -6 6 h-40 q-6 0 -6 -6 v-60 q0 -6 4 -10 Z',40,116],box:['M18 28 h44 v84 q0 4 -4 4 h-36 q-4 0 -4 -4 Z',28,116],bag:['M18 26 q22 -10 44 0 l5 84 q0 6 -6 6 h-42 q-6 0 -6 -6 Z',22,116],can:['M20 34 q20 -8 40 0 v76 q-20 8 -40 0 Z',30,116]};
const FILLS={dairy:'#F2EEE6',meat:'#E9A38A',produce:'#7FBF6A',bakery:'#D9A066',snacks:'#F0C44C',drinks:'#E69F00',frozen:'#9CC3EA',grains:'#E8D39A',jars:'#C2452D',other:'#B9A7C9'};
const TFILL={milk:'#F2EEE6',yogurt:'#F5F1EA',egg:'#E8CFA9',juice:'#F0A640',orange:'#F0A640',oil:'#C9A43A','olive oil':'#B59A2C',water:'#BFE3F5',coffee:'#7A4E35',tea:'#B07A45',tomato:'#C8432F',ketchup:'#B5281E','ice cream':'#F6D9E4',rice:'#F1ECDF',cheese:'#F0C25A',cheddar:'#EDB54A',butter:'#F3DC8A',chocolate:'#6B3E2A'};
let vid=0;
function vessel(shape,lvl,color,key){
  const [d,t,b]=SH[shape]||SH.bag,id='v'+(key||('x'+(++vid))),y=t+(1-Math.max(0,Math.min(1,lvl)))*(b-t);
  return `<svg viewBox="0 0 80 124" aria-hidden="true"><defs><clipPath id="${id}"><path d="${d}"/></clipPath></defs><ellipse cx="40" cy="119" rx="26" ry="3.5" fill="#14171C" opacity=".12"/><path d="${d}" fill="#F4F5F7"/>
  <g clip-path="url(#${id})"><rect x="0" y="${y}" width="80" height="${124-y}" fill="${color}"/><rect x="0" y="${y}" width="80" height="2.5" fill="#14171C" opacity=".35"/><rect x="24" y="${t+6}" width="3" height="${(b-t)*.5}" rx="1.5" fill="#fff" opacity=".8"/></g>
  <path d="${d}" fill="none" stroke="#14171C" stroke-width="2.2"/></svg>`;
}
const fillOf=h=>TFILL[h.type]||FILLS[h.cat]||FILLS.other;

/* ================= categorising products ================= */
function enrich(p){if(!p)return p;if(!p.cat)p.cat=catOf(p.type);return p}
function entry(code,name){const p=P(code);const type=p?p.type:guessType(name||'');return {code:code||null,name:p?null:name,type,cat:p?enrich(p).cat:catOf(type)}}
function remember(x){const k=keyOf(x);S.recent=[{code:x.code||null,name:x.code?null:x.name,type:typeOf(x)},...S.recent.filter(r=>keyOf(r)!==k)].slice(0,24)}

/* ================= rendering ================= */
let page=0;const fresh=new Set();const haptic=(n=12)=>{try{navigator.vibrate&&navigator.vibrate(n)}catch(e){}};
const lastN={};
function tabs(){
  const lab=[['list','List',S.list.length],['cart','In cart',S.cart.length],['home','At home',S.home.length]];
  lab.forEach(([k,l,n],i)=>{const b=$('t-'+k),grew=lastN[k]!=null&&n>lastN[k];const html=`${ic(k)}${l}${n?`<span class="n${grew?' pulse':''}">${n}</span>`:''}`;if(b._h!==html.replace(' pulse','')||grew){b.innerHTML=html;b._h=html.replace(' pulse','')}lastN[k]=n;b.setAttribute('aria-selected',String(i===page))});
}
const shownHints=new Set();
function hint(k,title,text){if(S.hints[k])return '';const first=!shownHints.has(k);shownHints.add(k);return `<div class="hint${first?' pop':''}" role="note"><div><b>${title}</b>${text}</div><button data-hint="${k}" aria-label="Got it">${ic('close')}</button></div>`}
function demoBar(){return S.home.concat(S.list,S.cart).some(x=>x.demo)?`<div class="demo"><span>These are sample items</span><button class="btn ghost" data-cleardemo>Clear them</button></div>`:''}

function rowHtml(x,where){
  const p=P(x.code),cat=x.cat||(p&&enrich(p).cat)||catOf(typeOf(x));
  return `<div class="row${fresh.has(x.id)?' in':''}" data-row="${x.id}">
    <button class="chk${where==='cart'?' on':''}" data-${where==='cart'?'uncart':'tocart'}="${x.id}" aria-label="${where==='cart'?'Put back on list':'Got it, move to cart'}: ${esc(nameOf(x))}">${where==='cart'?ic('check'):''}</button>
    <button class="tap" data-qty="${where}:${x.id}">${catIcon(cat)}<span class="nm">${esc(nameOf(x))}</span>${x.qty>1?`<span class="qty" style="flex:none;margin-left:-4px">×${x.qty}</span>`:''}</button>
    <button class="del" data-del="${where}:${x.id}" aria-label="Delete ${esc(nameOf(x))}">${ic('trash')}</button></div>`;
}
function vList(){
  let h=demoBar()+hint('list','Tick it when it\'s in your cart','Tap the circle next to an item. Swipe left to see your cart.');
  h+=`<form class="add" id="addf"><input type="text" id="addin" placeholder="Add an item" autocomplete="off" enterkeyhint="done" aria-label="Add an item"><button class="btn sq" aria-label="Add">${ic('plus')}</button></form>`;
  const inList=new Set(S.list.map(keyOf));
  const quick=S.recent.filter(r=>!inList.has(keyOf(r))).slice(0,10);
  if(quick.length)h+=`<div class="quick" aria-label="Add again">${quick.map(r=>`<button data-quick="${esc(keyOf(r))}">${catIcon(catOf(r.type||guessType(r.name||'')))}${esc(nameOf(r))}</button>`).join('')}</div>`;
  if(!S.list.length)return h+`<div class="card empty">${art('list')}<b>Your list is empty</b><span class="soft">Type what you need above, or tap Scan.</span></div>`;
  return h+`<div class="card rows">${S.list.map(x=>rowHtml(x,'list')).join('')}</div>`;
}
function vCart(){
  let h=demoBar();
  if(!S.cart.length)return h+`<div class="card empty">${art('cart')}<b>Nothing in your cart yet</b><span class="soft">On your list, tap the circle as you pick things up.</span></div>`;
  h+=hint('cart','Home from the shops?','Tap "Put it all away" at the bottom and choose fridge, freezer or pantry for each item.');
  h+=`<div class="card rows">${S.cart.map(x=>rowHtml(x,'cart')).join('')}</div>`;
  return h;
}
function levelTxt(h){const f=h.rem/h.total;return h.unit==='%'?`${Math.round(f*100)}% left`:`${Math.round(f*100)}% left · ${fmtAmt(h.rem,h.unit)}`}
function expChip(h){if(!h.exp)return '';const d=days(h.exp);
  if(d<0)return `<span class="chip bad">${ic('warn')}Expired</span>`;
  if(d<=3)return `<span class="chip warn">${ic('clock')}${d===0?'Today':d===1?'Tomorrow':d+' days'}</span>`;
  return `<span class="chip">${ic('clock')}${new Date(h.exp).toLocaleDateString(undefined,{day:'numeric',month:'short'})}</span>`}
function vHome(){
  let h=demoBar()+hint('home','Find anything at home','Pick Fridge, Freezer or Pantry, then a food type. Tap an item to say how much is left.');
  const soon=S.home.filter(x=>x.exp&&days(x.exp)<=2&&x.rem/x.total>=.2).sort((a,b)=>a.exp-b.exp);
  if(soon.length)h+=`<button class="banner" data-open="${soon[0].id}">${ic('clock')}<span><b>${esc(nameOf(soon[0]))} ${days(soon[0].exp)<0?'has expired':days(soon[0].exp)===0?'expires today':days(soon[0].exp)===1?'expires tomorrow':'expires in '+days(soon[0].exp)+' days'}</b>${soon.length>1?`and ${soon.length-1} more soon`:'Use it up soon'}</span></button>`;
  h+=`<div class="places" role="group" aria-label="Where">${PLACES.map(([k,l])=>{const n=S.home.filter(x=>x.place===k).length;return `<button class="tile" data-place="${k}" aria-pressed="${S.place===k}">${art(k)}<span>${l}</span><span class="c">${n} item${n===1?'':'s'}</span></button>`}).join('')}</div>`;
  const here=S.home.filter(x=>x.place===S.place);
  const cats=CATS.filter(c=>here.some(x=>x.cat===c[0]));
  if(S.cat!=='all'&&!cats.some(c=>c[0]===S.cat))S.cat='all';
  if(cats.length>1)h+=`<div class="cats" role="group" aria-label="Food type"><button data-cat="all" aria-pressed="${S.cat==='all'}">${`<span class="ci" style="background:#ECEEF1">${ic('all')}</span>`}All</button>${cats.map(c=>`<button data-cat="${c[0]}" aria-pressed="${S.cat===c[0]}">${catIcon(c[0])}${c[1]}</button>`).join('')}</div>`;
  const shown=here.filter(x=>S.cat==='all'||x.cat===S.cat).sort((a,b)=>(a.exp||9e15)-(b.exp||9e15));
  if(!shown.length)return h+`<div class="card empty">${art(S.place)}<b>Your ${PL[S.place].toLowerCase()} is empty</b><span class="soft">Things you put away will show up here.</span></div>`;
  h+=`<div class="grid">${shown.map(x=>`<div class="item${fresh.has(x.id)?' in':''}" data-item="${x.id}"><button class="open" data-open="${x.id}" aria-label="${esc(nameOf(x))}, ${esc(levelTxt(x))}"><span class="pic">${vessel(x.shape,x.rem/x.total,fillOf(x),x.id)}</span><span class="nm">${esc(nameOf(x))}</span><span class="lvl">${Math.round(x.rem/x.total*100)}% left</span><span class="meter"><i style="width:${Math.round(x.rem/x.total*100)}%"></i></span></button><div class="foot">${expChip(x)||'<span></span>'}<button class="del" data-del="home:${x.id}" aria-label="Delete ${esc(nameOf(x))}">${ic('trash')}</button></div></div>`).join('')}</div>`;
  h+=`<form class="add" id="findf" style="margin-top:18px"><input type="search" id="findin" placeholder="Where's my…" aria-label="Find an item at home"><button class="btn sq ghost" aria-label="Find">${ic('search')}</button></form>`;
  return h;
}
function render(){
  tabs();
  // the screen you're looking at updates now; the other two right after, so taps feel instant
  const pages=[['p-list',vList],['p-cart',vCart],['p-home',vHome]];
  const draw=([id,fn],i)=>{const el=$(id),h=fn();if(el._h!==h){const top=el.scrollTop,f=document.activeElement,fid=f&&el.contains(f)&&f.id;el.innerHTML=h;el._h=h;el.scrollTop=top;if(fid&&$(fid)&&pages.indexOf(pages.find(p=>p[0]===id))===page)$(fid).focus({preventScroll:true})}};
  draw(pages[page]);
  const rest=pages.filter((_,i)=>i!==page),keep=new Set(fresh);
  clearTimeout(render._t);render._t=setTimeout(()=>{keep.forEach(x=>fresh.add(x));rest.forEach(draw);fresh.clear()},60);
  fresh.clear();dock();
  save();
}

/* ================= pager ================= */
const pager=$('pager');
function dock(){const show=page===1&&S.cart.length>0;$('dockput').hidden=!show;$('dock').classList.toggle('two',show)}
function onScroll(){const w=pager.clientWidth||1,f=pager.scrollLeft/w;$('bar').style.transform=`translateX(${f*100}%)`;const p=Math.round(f);if(p!==page){page=p;const ae=document.activeElement;if(ae&&ae.closest&&ae.closest('.page')&&ae.closest('.page')!==pager.children[p])ae.blur();tabs();dock();if(render._t){clearTimeout(render._t);render._t=0;render()}}}
pager.addEventListener('scroll',onScroll,{passive:true});
function goPage(i,smooth=true){pager.scrollTo({left:i*pager.clientWidth,behavior:smooth&&!reduce?'smooth':'auto'})}
$('tabs').addEventListener('click',e=>{const b=e.target.closest('[data-p]');if(b)goPage(+b.dataset.p)});
window.addEventListener('resize',()=>goPage(page,false));

/* ================= sheets & toast ================= */
let viewer=null,onClose=null,undoFn=null,tt=0;
function open(h,{full=false,close}={}){clearTimeout(closeT);$('toast').hidden=true;$('toast').classList.add('top');if(closing){closing=false;$('sheet').classList.remove('leaving')}closeViewer();const p=$('panel');p.style.transform='';p.style.transition='';p.className='panel'+(full?' full':'');p.innerHTML=(full?'':'<div class="grab"></div>')+`<button class="shut" data-close aria-label="Close">${ic('close')}</button>`+h;$('sheet').hidden=false;onClose=close||null;p.scrollTop=0}
let closing=false,closeT=0;
function close(){if(closing||$('sheet').hidden)return;closing=true;$('toast').hidden=true;closeViewer();stopScanner();const p=$('panel'),done=()=>{if(!closing)return;$('sheet').hidden=true;$('sheet').classList.remove('leaving');p.style.transform='';p.style.transition='';closing=false;const f=onClose;onClose=null;f&&f()};
  if(reduce)return done();$('sheet').classList.add('leaving');p.style.transition='transform .26s cubic-bezier(.4,0,1,1)';p.style.transform='translateY(105%)';closeT=setTimeout(done,240)}
{ // swipe down on a panel to close it
  const p=$('panel');let y0=null,dy=0,t0=0;
  p.addEventListener('touchstart',e=>{if(e.target.closest('.viewer,input,select,.scanv,.cats,.quick'))return;if(p.scrollTop>0)return;y0=e.touches[0].clientY;dy=0;t0=Date.now();p.style.transition='none'},{passive:true});
  p.addEventListener('touchmove',e=>{if(y0==null)return;dy=e.touches[0].clientY-y0;if(dy>0&&p.scrollTop<=0){p.style.transform=`translateY(${dy}px)`}else{dy=0;p.style.transform=''}},{passive:true});
  p.addEventListener('touchend',()=>{if(y0==null)return;const fast=dy>60&&Date.now()-t0<250;y0=null;if(dy>130||fast){close()}else{p.style.transition='transform .3s cubic-bezier(.2,.9,.3,1.2)';p.style.transform=''}});
}
function closeViewer(){if(viewer){viewer.dispose();viewer=null}}
function toast(m,u){$('tmsg').textContent=m;undoFn=u||null;$('tundo').hidden=!u;const t=$('toast');t.classList.toggle('top',!$('sheet').hidden);t.hidden=false;t.style.animation='none';void t.offsetWidth;t.style.animation='';clearTimeout(tt);tt=setTimeout(()=>$('toast').hidden=true,u?6000:(t.classList.contains('top')?2200:2800))}
const sheetOpen=()=>!$('sheet').hidden;

/* ================= list & cart actions ================= */
function addToList(name,code){
  const e=code?entry(code):entry(null,name);
  const same=S.list.find(x=>keyOf(x)===keyOf(e));
  if(same){same.qty++;fresh.add(same.id)}else{const n={id:uid(),...e,qty:1};S.list.unshift(n);fresh.add(n.id)}haptic(10);
  remember(e);
}
const busy=new Set();
function animateOut(id,cls,done){if(busy.has(id))return;busy.add(id);const fin=()=>{busy.delete(id);done()};const el=document.querySelector(`[data-row="${id}"],[data-item="${id}"]`);if(!el||reduce)return fin();el.classList.add(cls);setTimeout(fin,260)}
function fly(fromEl,toTab){
  if(reduce||!fromEl)return;const a=fromEl.getBoundingClientRect(),b=$(toTab).getBoundingClientRect();
  const g=document.createElement('div');g.className='flyer';g.innerHTML=fromEl.innerHTML;document.body.appendChild(g);
  g.style.left=a.left+'px';g.style.top=a.top+'px';
  const dx=b.left+b.width/2-(a.left+a.width/2),dy=b.top+b.height/2-(a.top+a.height/2);
  g.animate([{transform:'translate(0,0) scale(1)',opacity:1},{transform:`translate(${dx*.6}px,${dy*.5-40}px) scale(.8)`,opacity:1,offset:.55},{transform:`translate(${dx}px,${dy}px) scale(.3)`,opacity:.2}],{duration:620,easing:'cubic-bezier(.3,.7,.4,1)'}).onfinish=()=>g.remove();
}
function moveToCart(id){if(busy.has(id))return;const i=S.list.findIndex(x=>x.id===id);if(i<0)return;const x=S.list[i];haptic(15);
  const row=document.querySelector(`[data-row="${id}"] .tap`);fly(row,'t-cart');
  animateOut(id,'out',()=>{const j=S.list.indexOf(x);if(j<0)return;S.list.splice(j,1);S.cart.unshift(x);fresh.add(x.id);render();toast(`${nameOf(x)} is in your cart`,()=>{S.cart=S.cart.filter(y=>y!==x);S.list.splice(i,0,x);fresh.add(x.id)})})}
function backToList(id){if(busy.has(id))return;const i=S.cart.findIndex(x=>x.id===id);if(i<0)return;const x=S.cart[i];haptic(12);fly(document.querySelector(`[data-row="${id}"] .tap`),'t-list');
  animateOut(id,'gone',()=>{const j=S.cart.indexOf(x);if(j<0)return;S.cart.splice(j,1);S.list.unshift(x);fresh.add(x.id);render();toast(`${nameOf(x)} is back on your list`)})}
function del(where,id){if(busy.has(id))return;const arr=S[where],i=arr.findIndex(x=>x.id===id);if(i<0)return;const x=arr[i];haptic(20);
  animateOut(id,'gone',()=>{const j=arr.indexOf(x);if(j<0)return;arr.splice(j,1);render();toast(`Deleted ${nameOf(x)}`,()=>{arr.splice(i,0,x);fresh.add(x.id)})})}
function qtySheet(where,id){const x=S[where].find(y=>y.id===id);if(!x)return;
  open(`<h1>${esc(nameOf(x))}</h1><div style="display:flex;align-items:center;justify-content:center;gap:22px;margin:18px 0 22px"><button class="btn ghost sq" data-q="-1" aria-label="Fewer">${ic('minus')}</button><span id="qv" style="font-size:48px;font-weight:700;min-width:60px;text-align:center">${x.qty}</span><button class="btn ghost sq" data-q="1" aria-label="More">${ic('plus')}</button></div>
   <div class="acts"><button class="btn ghost" data-del="${where}:${x.id}" data-andclose>${ic('trash')}Delete</button><button class="btn" data-close>Done</button></div>`);
  $('panel').querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{x.qty=Math.max(1,x.qty+ +b.dataset.q);$('qv').textContent=x.qty;render()});
}

/* ================= put away ================= */
function putAwaySheet(items){
  if(!items.length)return;
  const rows=items.map(it=>{const t=typeOf(it),c=it.cat||catOf(t);return {...it,type:t,cat:c,place:placeFor(c,t),exp:''}});
  open(`<h1>Where does it go?</h1><p class="soft" style="margin:0 2px 14px">We guessed for you. Tap to change.</p><div id="aw">${rows.map((r,i)=>`<div class="away"><div class="top2">${catIcon(r.cat)}<span class="nm">${esc(nameOf(r))}${r.qty>1?`<span class="qty">×${r.qty}</span>`:''}</span></div>
     <div class="pick" role="group" aria-label="Where to keep ${esc(nameOf(r))}">${PLACES.map(([k,l])=>`<button data-aw="${i}:${k}" aria-pressed="${r.place===k}">${ic(k)}${l}</button>`).join('')}</div>
     <label class="exp">${ic('clock')}<span>Expiry<br><span class="small">if printed</span></span><input type="date" data-awexp="${i}" aria-label="Expiry date for ${esc(nameOf(r))}"></label></div>`).join('')}</div>
   <button class="btn go wide" id="awgo">${ic('check')}Put away</button>`);
  $('panel').querySelectorAll('[data-aw]').forEach(b=>b.onclick=()=>{const [i,k]=b.dataset.aw.split(':');rows[+i].place=k;b.parentElement.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)))});
  $('panel').querySelectorAll('[data-awexp]').forEach(inp=>inp.onchange=()=>rows[+inp.dataset.awexp].exp=inp.value);
  $('awgo').onclick=()=>{
    rows.forEach(r=>{const p=P(r.code),q=Math.max(1,r.qty||1);
      const sized=p&&p.size&&p.unit,base={code:r.code||null,name:r.code?null:r.name,type:r.type,cat:r.cat,place:r.place,shape:(p&&p.shape)||guessShape(r.type,[],[],0,''),exp:r.exp?new Date(r.exp+'T12:00').getTime():null,added:now(),logs:[],demo:!!r.demo};
      if(sized)for(let k=0;k<q;k++){const n={id:uid(),...base,total:p.size,rem:p.size,unit:p.unit};S.home.unshift(n);fresh.add(n.id)}
      else{const n={id:uid(),...base,total:q>1?q:100,rem:q>1?q:100,unit:q>1?'pcs':'%'};S.home.unshift(n);fresh.add(n.id)}
      if(r.from==='cart')S.cart=S.cart.filter(y=>y.id!==r.id);remember(r)});
    haptic(25);const first=rows[0].place;S.place=first;S.cat='all';close();render();goPage(2);toast(rows.length===1?`Put away in the ${PL[first].toLowerCase()}`:`${rows.length} items put away`)};
}

/* ================= item detail ================= */
const LEVELS=[[1,'Full'],[.75,'¾'],[.5,'Half'],[.25,'¼'],[0,'Empty']];
function levelArt(f){return `<svg viewBox="0 0 24 34" aria-hidden="true"><rect x="4" y="2" width="16" height="30" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><rect x="6" y="${4+26*(1-f)}" width="12" height="${26*f}" rx="1.5" fill="currentColor"/></svg>`}
async function detail(id){
  const it=S.home.find(x=>x.id===id);if(!it)return;
  open(`<div class="viewer" id="vw"><span class="hint2">Drag to turn · pinch to zoom</span></div><div id="dbody"></div>`);
  drawDetail(it);
  await new Promise(r=>setTimeout(r,reduce?0:300));if(!$('vw'))return;
  try{const mv=(await import('./viewer.js')).mountViewer;const p=P(it.code);if($('vw')&&sheetOpen()){closeViewer();viewer=mv($('vw'),{shape:it.shape,level:it.rem/it.total,color:fillOf(it),brand:p&&p.brand,name:nameOf(it),label:p&&p.label,image:p&&p.image})}}
  catch(e){const v=$('vw');if(v)v.insertAdjacentHTML('beforeend',`<div style="position:absolute;inset:16px;display:grid;place-items:center">${vessel(it.shape,it.rem/it.total,fillOf(it))}</div>`)}
}
function drawDetail(it){
  const f=it.rem/it.total,near=LEVELS.reduce((a,b)=>Math.abs(b[0]-f)<Math.abs(a[0]-f)?b:a)[0],p=P(it.code);
  $('dbody').innerHTML=`<h1 style="margin-top:12px">${esc(nameOf(it))}</h1><p class="soft" style="margin:-6px 2px 14px;font-size:20px"><b style="color:var(--ink)">${Math.round(f*100)}% left</b>${it.unit!=='%'?' · '+fmtAmt(it.rem,it.unit):''}</p>
   <div class="field">How much is left?<div class="left" role="group">${LEVELS.map(([v,l])=>`<button data-lvl="${v}" aria-pressed="${v===near}">${levelArt(v)}${l}</button>`).join('')}</div></div>
   <div class="field">Where is it?<div class="pick" role="group">${PLACES.map(([k,l])=>`<button data-mv="${k}" aria-pressed="${it.place===k}">${ic(k)}${l}</button>`).join('')}</div></div>
   <label class="field">Expiry date<input type="date" id="dexp" value="${it.exp?dkey(it.exp):''}"></label>
   <details><summary>Food type: ${esc(CAT[it.cat].name)}</summary><div class="cats" style="flex-wrap:wrap;margin:0;padding:0">${CATS.map(c=>`<button data-setcat="${c[0]}" aria-pressed="${it.cat===c[0]}">${catIcon(c[0])}${c[1]}</button>`).join('')}</div></details>
   ${it.logs.length?`<details><summary>Usage history</summary><table>${[...it.logs].reverse().slice(0,10).map(l=>`<tr><td>${new Date(l.t).toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short'})}</td><td>Used ${it.unit==='%'?Math.round(l.a)+'%':fmtAmt(l.a,it.unit)}</td></tr>`).join('')}</table></details>`:''}
   ${p?`<details><summary>About this product</summary><table>${[['Brand',p.brand],['Size',p.label],['Barcode',p.code],['Storage (label)',p.storage],['Allergens',(p.allergens||[]).join(', ')]].filter(r=>r[1]).map(r=>`<tr><td>${r[0]}</td><td>${esc(r[1])}</td></tr>`).join('')}</table><p class="small">From the package label, via Open Food Facts.</p></details>`:''}
   <div class="acts" style="margin-top:16px"><button class="btn ghost" data-del="home:${it.id}" data-andclose>${ic('trash')}Delete</button><button class="btn" data-close>Done</button></div>`;
  $('dexp').onchange=e=>{it.exp=e.target.value?new Date(e.target.value+'T12:00').getTime():null;render();toast('Expiry date saved')};
}
function setLevel(it,v){haptic(10);
  const target=Math.round(it.total*v*100)/100,used=it.rem-target;
  if(used>0)it.logs.push({t:now(),a:used});
  it.rem=target;if(viewer)viewer.setLevel(v);
  if(it.rem<=0){render();close();finished(it);return}
  drawDetail(it);render();
}
function finished(it){
  S.home=S.home.filter(x=>x.id!==it.id);
  const back=()=>{if(!S.list.some(x=>keyOf(x)===keyOf(it)))S.list.unshift({id:uid(),code:it.code,name:it.name,type:it.type,cat:it.cat,qty:1})};
  if(S.auto===true){back();render();toast(`${nameOf(it)} is finished, added to your list`);return}
  render();
  open(`<div style="text-align:center;padding-top:8px">${catIcon(it.cat,72)}</div><h1 style="text-align:center">${esc(nameOf(it))} is finished</h1><p class="soft" style="text-align:center;margin-top:-4px">Add it to your list?</p>
   <div class="acts"><button class="btn ghost" data-close>No</button><button class="btn go" id="fy">${ic('plus')}Add to list</button></div>
   <button class="btn ghost wide" id="fa" style="margin-top:10px;font-size:16px">Always add finished items</button>`);
  $('fy').onclick=()=>{back();close();render();toast('Added to your list')};
  $('fa').onclick=()=>{S.auto=true;back();close();render();toast('Finished items will go on your list')};
}

/* ================= scanner ================= */
const SC={tray:[],stop:null,from:0,single:null};
function stopScanner(){if(SC.stop){try{SC.stop()}catch(e){}SC.stop=null}}
function scanSheet(){
  SC.tray=[];SC.single=null;SC.from=page;
  open(`<h1>Scan</h1><div class="mode" role="group" aria-label="Scan mode"><button data-mode="multi" aria-pressed="${S.scanMode!=='one'}">Scan many</button><button data-mode="one" aria-pressed="${S.scanMode==='one'}">One at a time</button></div>
   <div class="scanv" id="scanv"><video id="vid" playsinline muted></video><div class="idle" id="idle"><span class="spin"></span>Opening camera…</div></div>
   <div class="acts" style="margin-top:8px"><button class="btn ghost" id="sphoto">${ic('photo')}Photo</button><button class="btn ghost" id="stype">${ic('keys')}Type number</button></div>
   <div id="sres"></div>`,{full:true});
  $('sphoto').onclick=()=>$('file').click();
  $('stype').onclick=()=>{const r=$('sres');if($('typef'))return;r.insertAdjacentHTML('afterbegin',`<form class="add" id="typef" style="margin-top:12px"><input type="text" id="typein" inputmode="numeric" placeholder="Barcode number" aria-label="Barcode number"><button class="btn sq">${ic('check')}</button></form>`);$('typein').focus();
    $('typef').onsubmit=e=>{e.preventDefault();const v=$('typein').value.replace(/\D/g,'');if(v){gotCode(v);$('typein').value=''}}};
  drawTray();startCam();
}
async function startCam(){
  const v=$('vid'),idle=$('idle');if(!v)return;stopScanner();
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){idle.innerHTML='Camera not available here. Use Photo or Type number.';return}
  try{SC.stop=await startScan(v,c=>gotCode(c),{multi:S.scanMode!=='one'});idle.style.display='none';if(!$('scanv').querySelector('.frame'))$('scanv').insertAdjacentHTML('beforeend','<div class="frame"></div>')}
  catch(e){idle.style.display='';idle.innerHTML=e&&e.name==='NotAllowedError'?'Camera permission is off. Allow it in your browser settings, or use Photo.':'Couldn\'t open the camera. Use Photo or Type number.'}
}
async function ensureProduct(code){
  if(P(code))return P(code);
  try{let p=await lookupProduct(code);if(!p)p=await cloud.sharedProduct(code).catch(()=>null);if(p){S.products[code]=enrich(p);save();return p}return null}
  catch(e){const sp=await cloud.sharedProduct(code).catch(()=>null);if(sp){S.products[code]=enrich(sp);save();return sp}throw e}
}
function gotCode(code){
  if(navigator.vibrate)navigator.vibrate(40);
  const sv=$('scanv');if(sv){sv.classList.remove('flash');void sv.offsetWidth;sv.classList.add('flash')}
  let t=SC.tray.find(x=>x.code===code);
  if(t)t.qty++;else{t={code,qty:1,st:P(code)?'ok':'loading'};SC.tray.unshift(t)}
  if(S.scanMode==='one'){stopScanner();SC.single=t}
  drawTray();
  if(t.st==='loading')ensureProduct(code).then(p=>{t.st=p?'ok':'unknown';drawTray()}).catch(()=>{t.st='unknown';drawTray()});
}
function trayName(t){const p=P(t.code);return p?title(p):t.name||null}
function drawTray(){
  const r=$('sres');if(!r)return;const typeForm=$('typef')?$('typef').outerHTML:'';
  const items=S.scanMode==='one'&&SC.single?[SC.single]:SC.tray;
  if(!items.length){r.innerHTML=typeForm+`<p class="soft" style="text-align:center;margin-top:18px">${S.scanMode==='one'?'Point at a barcode.':'Scan as many items as you like. They collect here.'}</p>`;bindType();return}
  const order=[[0,'list','Add to list'],[1,'cart','Add to cart'],[2,'home','Put away']];
  order.sort((a,b)=>(a[0]===SC.from?-1:0)-(b[0]===SC.from?-1:0));
  r.innerHTML=typeForm+`<h2>${S.scanMode==='one'?'Scanned':`Scanned · ${items.reduce((s,t)=>s+t.qty,0)}`}</h2><div class="card rows tray">${items.map((t,i)=>{const n=trayName(t),c=n?(P(t.code)?enrich(P(t.code)).cat:catOf(guessType(n))):'other';
      return `<div class="row" style="grid-template-columns:minmax(0,1fr) auto"><div class="tap">${catIcon(c)}<span class="nm">${t.st==='loading'?'<span class="spin"></span> Looking up…':n?esc(n):'Unknown item'}${t.qty>1?`<span class="qty">×${t.qty}</span>`:''}${t.st==='unknown'&&!n?`<span class="small" style="display:block;overflow-wrap:anywhere">${esc(t.code)}</span><button class="btn ghost" style="min-height:44px;font-size:16px;padding:0 14px;margin-top:6px" data-nameit="${i}">Name it</button>`:''}</span></div>
      <button class="del" data-untray="${i}" aria-label="Remove">${ic('trash')}</button></div>`}).join('')}</div>
    <div style="display:grid;gap:10px;margin-top:14px">${order.map(([p,k,l],j)=>`<button class="btn ${j===0?(k==='home'?'go':''):'ghost'} wide" data-send="${k}">${ic(k)}${l}</button>`).join('')}</div>`;
  bindType();
}
function bindType(){const f=$('typef');if(f)f.onsubmit=e=>{e.preventDefault();const v=$('typein').value.replace(/\D/g,'');if(v){gotCode(v);const i=$('typein');if(i)i.value=''}}}
function sendTray(where){
  const items=(S.scanMode==='one'&&SC.single?[SC.single]:SC.tray).filter(t=>t.st!=='loading');
  if(!items.length)return;
  const ents=items.map(t=>({...entry(P(t.code)?t.code:null,trayName(t)||'Item'),code:P(t.code)?t.code:null,qty:t.qty}));
  if(where==='home'){const rows=ents.map(e=>({...e,id:uid()}));stopScanner();putAwaySheet(rows);return}
  ents.forEach(e=>{const arr=where==='list'?S.list:S.cart;const same=arr.find(x=>keyOf(x)===keyOf(e));if(same){same.qty+=e.qty;fresh.add(same.id)}else{const n={id:uid(),...e};arr.unshift(n);fresh.add(n.id)}remember(e);if(where==='cart'){const i=S.list.findIndex(x=>keyOf(x)===keyOf(e)||(!x.code&&e.type&&String(x.name||'').toLowerCase().includes(e.type)));if(i>=0)S.list.splice(i,1)}});
  render();toast(`${ents.length} item${ents.length>1?'s':''} added to your ${where==='list'?'list':'cart'}`);
  if(S.scanMode==='one'){SC.tray=SC.tray.filter(t=>t!==SC.single);SC.single=null;drawTray();startCam()}else{close();goPage(where==='list'?0:1)}
}
function nameIt(i){const t=(S.scanMode==='one'&&SC.single?[SC.single]:SC.tray)[i];if(!t)return;
  const r=$('sres');r.insertAdjacentHTML('afterbegin',`<form class="add" id="nmf" style="margin-top:12px"><input type="text" id="nmin" placeholder="What is it? e.g. Basmati rice" aria-label="Product name"><button class="btn sq">${ic('check')}</button></form>`);$('nmin').focus();
  $('nmf').onsubmit=e=>{e.preventDefault();const v=$('nmin').value.trim();if(!v)return;const type=guessType(v);
    S.products[t.code]=enrich({code:t.code,name:v,brand:'',label:'',size:null,unit:null,image:null,type,shape:guessShape(type,[],[],0,''),storage:null,allergens:[],src:'You'});t.st='ok';save();
    if(ME)cloud.shareProduct(t.code,{...S.products[t.code],src:'Shared by a shopper'});$('nmf').remove();drawTray()}}

/* ================= first run & demo ================= */
const SLIDES=[['list','Your list','Write what you need. Tick it off as it goes in your cart.'],['cart','Your cart','See what you\'ve already picked up, so nothing gets bought twice.'],['home','At home','Know what\'s in the fridge, freezer and pantry, how much is left and when it expires.']];
function welcome(i=0){
  if(i<SLIDES.length){const [a,t,x]=SLIDES[i];
    open(`<div class="slides">${art(a)}<h1>${t}</h1><p class="soft" style="font-size:20px;margin:0 8px">${x}</p><div class="dots">${SLIDES.concat([0]).map((_,j)=>`<i class="${j===i?'on':''}"></i>`).join('')}</div>
      <div class="acts"><button class="btn ghost" id="wskip">Skip</button><button class="btn" id="wnext">Next</button></div></div>`,{full:true,close:()=>{S.onboarded=true;save()}});
    $('wnext').onclick=()=>welcome(i+1);$('wskip').onclick=()=>welcome(SLIDES.length);return}
  open(`<div class="slides"><svg class="art" viewBox="0 0 150 120" aria-hidden="true"><g transform="translate(-28 12) scale(.8)">${art('fridge').replace(/<svg[^>]*>|<\/svg>/g,'')}</g><g transform="translate(55 12) scale(.8)">${art('pantry').replace(/<svg[^>]*>|<\/svg>/g,'')}</g></svg><h1>Want a quick look?</h1><p class="soft" style="font-size:20px;margin:0 8px">We can fill the app with sample groceries so you can try it. Clear them any time.</p>
    <div style="display:grid;gap:10px;margin-top:20px"><button class="btn go wide" id="wdemo">Show me with sample items</button><button class="btn ghost wide" id="wempty">Start with an empty list</button></div></div>`,{full:true,close:()=>{S.onboarded=true;save()}});
  $('wdemo').onclick=()=>{loadDemo();S.onboarded=true;S.hints={};close();render();goPage(0,false)};
  $('wempty').onclick=()=>{S.onboarded=true;close();render();goPage(0,false);setTimeout(()=>$('addin')&&$('addin').focus(),300)};
}
function loadDemo(){
  const d=(n,type,place,shape,total,unit,left,exp,used)=>({id:uid(),code:null,name:n,type,cat:catOf(type),place,shape,total,rem:Math.round(total*left),unit,exp:exp==null?null:now()+exp*DAY,added:now()-6*DAY,logs:used?[{t:now()-3*DAY,a:total*used/2},{t:now()-DAY,a:total*used/2}]:[],demo:true});
  S.home=[d('Milk','milk','fridge','carton',1000,'ml',.7,4,.3),d('Eggs','egg','fridge','box',12,'pcs',7/12,16,5/12),d('Greek yogurt','yogurt','fridge','tub',500,'g',.6,1,.2),d('Baby spinach','spinach','fridge','bag',100,'%',.6,2,.4),d('Cheddar','cheddar','fridge','box',100,'%',.5,20,0),
    d('Chicken breasts','chicken','freezer','bag',100,'%',1,60,0),d('Frozen peas','frozen','freezer','bag',100,'%',.5,120,.5),d('Vanilla ice cream','ice cream','freezer','tub',100,'%',.3,90,.7),
    d('Penne pasta','penne','pantry','box',500,'g',.8,300,.2),d('Basmati rice','rice','pantry','bag',100,'%',.4,200,.6),d('Olive oil','olive oil','pantry','bottle',500,'ml',.55,240,.45),d('Chopped tomatoes','tomato','pantry','can',100,'%',1,400,0),d('Sourdough bread','bread','pantry','bag',100,'%',.3,1,.7),d('Crisps','chips','pantry','bag',100,'%',.2,30,.8)]
    .map(h=>{if(h.name==='Chopped tomatoes'){h.cat='jars'}return h}).concat(S.home.filter(h=>!h.demo));
  const l=(n,q=1)=>({id:uid(),...entry(null,n),qty:q,demo:true});
  S.list=[l('Bananas',6),l('Butter'),l('Coffee'),l('Tomatoes',4),l('Orange juice')].concat(S.list.filter(x=>!x.demo));
  S.cart=[l('Bread'),l('Cheddar cheese')].concat(S.cart.filter(x=>!x.demo));
  ['Milk','Eggs','Bread','Bananas','Pasta','Rice','Coffee','Butter'].forEach(n=>remember(entry(null,n)));
  S.place='fridge';S.cat='all';
}
function clearDemo(){S.home=S.home.filter(x=>!x.demo);S.list=S.list.filter(x=>!x.demo);S.cart=S.cart.filter(x=>!x.demo);render();toast('Sample items cleared')}

/* ================= settings & account ================= */
let prof=null;
function settings(){
  open(`<h1>Settings</h1>
   <div class="set"><span><b>Add finished items to my list</b><br><span class="small">Without asking</span></span><input type="checkbox" id="sa" ${S.auto?'checked':''}></div>
   <h2>Account and reminders</h2><div id="acct">${acctHtml()}</div>
   <h2>Help</h2><div style="display:grid;gap:10px"><button class="btn ghost wide" id="stour">Show the welcome tour</button><button class="btn ghost wide" id="sdemo">Load sample items</button></div>
   <h2>Your data</h2><p class="soft" style="margin-top:0">${ME?'Saved on this phone and synced to your account.':'Saved on this phone.'}</p><button class="btn ghost wide" id="serase">Erase everything</button>
   <p class="small" style="margin-top:18px">Product details from Open Food Facts.</p>`);
  bindAcct();
  $('sa').onchange=e=>{S.auto=e.target.checked;save()};
  $('stour').onclick=()=>{S.hints={};welcome(0)};
  $('sdemo').onclick=()=>{loadDemo();close();render();goPage(0);toast('Sample items added')};
  $('serase').onclick=()=>{const b=$('serase');if(b.dataset.sure){S=Object.assign(blank(),{onboarded:true});close();render();goPage(0,false);toast('Everything erased')}else{b.dataset.sure=1;b.textContent='Tap again to erase everything';b.style.borderColor='var(--red)'}};
}
function acctHtml(){
  if(!cloud.enabled())return '<p class="soft">Sign-in isn\'t available right now.</p>';
  if(!ME)return `<form id="sif"><label class="field">Email<input type="email" id="sie" required autocomplete="email" placeholder="you@example.com"></label><button class="btn wide">Email me a sign-in link</button><p class="small">Sign in to keep your lists on all your devices and get expiry reminders.</p></form>`;
  const ios=cloud.isIOS()&&!cloud.standalone();
  return `<div class="set"><span><b>${esc(ME.email)}</b><br><span class="small">Signed in</span></span><button class="btn ghost" id="sout" style="min-height:48px">Sign out</button></div>
   <div class="set"><span><b>Notifications</b><br><span class="small">${ios?'First add Flogger to your Home Screen and open it from there':'When food is about to expire'}</span></span><input type="checkbox" id="npush" ${prof&&prof.notify_push?'checked':''} ${ios?'disabled':''}></div>
   <div class="set"><span><b>Email reminders</b><br><span class="small">The same reminders by email</span></span><input type="checkbox" id="nmail" ${prof&&prof.notify_email?'checked':''}></div>
   ${prof&&(prof.notify_push||prof.notify_email)?'<button class="btn ghost wide" id="ntest" style="margin-top:10px">Send me a test</button>':''}`;
}
function bindAcct(){
  const re=()=>{const a=$('acct');if(a){a.innerHTML=acctHtml();bindAcct()}};
  const f=$('sif');if(f)f.onsubmit=async e=>{e.preventDefault();const b=f.querySelector('.btn');b.disabled=true;b.textContent='Sending…';try{await cloud.signIn($('sie').value.trim());$('acct').innerHTML=`<p><b>Check your email.</b><br><span class="soft">Open the link on this phone to sign in.</span></p>`}catch(err){b.disabled=false;b.textContent='Email me a sign-in link';toast('Couldn\'t send the link')}};
  if($('sout'))$('sout').onclick=async()=>{await cloud.disablePush().catch(()=>{});await cloud.signOut();ME=null;prof=null;S.syncUser=null;save();re();toast('Signed out')};
  if($('npush'))$('npush').onchange=async e=>{const on=e.target.checked;try{if(on)await cloud.enablePush(ME.id);else await cloud.disablePush();prof={...(prof||{}),notify_push:on};await cloud.saveProfile(ME.id,{notify_push:on});toast(on?'Notifications on':'Notifications off')}catch(err){e.target.checked=false;toast(err.message==='denied'?'Notifications are blocked in your settings':'This browser can\'t do notifications')}re()};
  if($('nmail'))$('nmail').onchange=async e=>{const on=e.target.checked;try{prof={...(prof||{}),notify_email:on};await cloud.saveProfile(ME.id,{notify_email:on,email:ME.email});toast(on?'Email reminders on':'Email reminders off')}catch(err){e.target.checked=!on;toast('Couldn\'t save')}re()};
  if($('ntest'))$('ntest').onclick=async()=>{try{const r=await cloud.testNotify();toast(r.pushed||r.mailed?'Test sent':'Nothing sent. Check the settings above.')}catch(e){toast('Couldn\'t send the test')}};
}
async function onSignedIn(u){
  let remote=null;try{remote=await cloud.pull(u.id)}catch(e){}
  if(remote&&remote.state&&remote.state.v!==3)remote.state=migrate(remote.state);
  const localHas=S.list.length+S.home.length+S.cart.length>0;
  const adopt=()=>{S=Object.assign(blank(),remote.state,{onboarded:true});S.syncUser=u.id;render()};
  const mine=()=>{S.syncUser=u.id;save()};
  if(remote&&S.syncUser!==u.id&&localHas){
    open(`<h1>Keep which groceries?</h1><p class="soft">This phone and your account both have items.</p><div class="acts"><button class="btn ghost" id="kp">This phone</button><button class="btn" id="ka">My account</button></div>`,{close:()=>{if(S.syncUser!==u.id)mine()}});
    $('kp').onclick=()=>{mine();close()};$('ka').onclick=()=>{adopt();close()};
  }else if(remote&&(S.syncUser!==u.id||new Date(remote.updated_at).getTime()>(S.updatedAt||0)))adopt();
  else mine();
  try{prof=await cloud.getProfile(u.id);await cloud.saveProfile(u.id,{email:u.email,tz:Intl.DateTimeFormat().resolvedOptions().timeZone})}catch(e){}
}

/* ================= events ================= */
$('fab').onclick=scanSheet;
$('dockput').onclick=()=>putAwaySheet(S.cart.map(x=>({...x,from:'cart'})));
$('gear').onclick=settings;
$('scrim').onclick=close;
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&sheetOpen())close()});
$('tundo').onclick=()=>{if(undoFn){undoFn();undoFn=null;render()}$('toast').hidden=true};
$('file').onchange=async()=>{const f=$('file').files[0];$('file').value='';if(!f)return;toast('Reading barcode…');try{const c=await decodeImage(f);if(c){$('toast').hidden=true;if(!sheetOpen()||!$('sres'))scanSheet();gotCode(c)}else toast('No barcode found. Try closer, in good light.')}catch(e){toast('Couldn\'t read that photo')}};
document.addEventListener('submit',e=>{
  if(e.target.id==='addf'){e.preventDefault();const v=$('addin').value.trim();if(!v)return;addToList(v);render();const i=$('addin');i.focus({preventScroll:true})}
  if(e.target.id==='findf'){e.preventDefault();const q=$('findin').value.toLowerCase().trim();if(!q)return;const hit=S.home.find(x=>(nameOf(x)+' '+x.type).toLowerCase().includes(q));
    if(hit){S.place=hit.place;S.cat='all';render();toast(`${nameOf(hit)} is in the ${PL[hit.place].toLowerCase()}`);setTimeout(()=>{const el=document.querySelector(`[data-item="${hit.id}"]`);if(el){el.scrollIntoView({block:'center',behavior:reduce?'auto':'smooth'});el.style.outline='4px solid var(--ink)';setTimeout(()=>el.style.outline='',1800)}},60)}
    else toast(`No “${q}” at home`)}
});
document.addEventListener('click',e=>{
  const t=e.target.closest('button');if(!t)return;const d=t.dataset;
  if(d.tocart)moveToCart(d.tocart);
  if(d.uncart)backToList(d.uncart);
  if(d.del){const [w,id]=d.del.split(':');if('andclose' in d)close();del(w,id)}
  if('close' in d&&!d.del)close();
  if(d.qty){const [w,id]=d.qty.split(':');qtySheet(w,id)}
  if(d.quick){const r=S.recent.find(x=>keyOf(x)===d.quick);if(r){if(r.code)addToList(null,r.code);else addToList(r.name);render()}}
  if('putaway' in d)putAwaySheet(S.cart.map(x=>({...x,from:'cart'})));
  if(d.place){if(S.place!==d.place)haptic(8);S.place=d.place;S.cat='all';render();const g=document.querySelector('#p-home .grid');if(g&&!reduce)g.animate([{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'none'}],{duration:280,easing:'ease-out'})}
  if(d.cat){S.cat=d.cat;render();const g=document.querySelector('#p-home .grid');if(g&&!reduce)g.animate([{opacity:0},{opacity:1}],{duration:220,easing:'ease-out'})}
  if(d.open)detail(d.open);
  if(d.lvl){const it=curItem();if(it)setLevel(it,+d.lvl)}
  if(d.mv){const it=curItem();if(it){it.place=d.mv;drawDetail(it);render();toast(`Moved to the ${PL[d.mv].toLowerCase()}`)}}
  if(d.setcat){const it=curItem();if(it){it.cat=d.setcat;drawDetail(it);render()}}
  if(d.hint){S.hints[d.hint]=1;render()}
  if('cleardemo' in d)clearDemo();
  if(d.mode){S.scanMode=d.mode;save();t.parentElement.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===t)));SC.single=null;drawTray();startCam()}
  if(d.untray){const arr=S.scanMode==='one'&&SC.single?[SC.single]:SC.tray;const x=arr[+d.untray];SC.tray=SC.tray.filter(y=>y!==x);if(SC.single===x){SC.single=null;startCam()}drawTray()}
  if(d.send)sendTray(d.send);
  if(d.nameit)nameIt(+d.nameit);
});
function curItem(){const b=document.querySelector('#dbody [data-del^="home:"]');return b&&S.home.find(x=>x.id===b.dataset.del.split(':')[1])}
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopScanner();else if(sheetOpen()&&$('vid')&&!SC.stop&&!(S.scanMode==='one'&&SC.single))startCam()});

/* ================= start ================= */
let S=load();
render();
requestAnimationFrame(()=>{onScroll()});
if(!S.onboarded)setTimeout(()=>welcome(0),350);
(window.requestIdleCallback||(f=>setTimeout(f,2500)))(()=>import('./viewer.js').catch(()=>{}));
if(cloud.enabled()){cloud.onAuth(async u=>{const was=ME&&ME.id;ME=u;if(u&&u.id!==was){await onSignedIn(u);if(/[?&]code=/.test(location.search))history.replaceState(null,'',location.pathname);toast('Signed in')}render()})}
if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('sw.js').catch(()=>{});
