import {COUNTRIES,detectCountry,money as fmtMoney,parseQty,fmtAmt,guessType,guessShape,SHAPES,lookupProduct,here,nearbyStores,recipesFor,recipeDetail} from './data.js';
import {startScan,decodeImage} from './scanner.js';

/* ================= state ================= */
const KEY='larder.v2',DAY=864e5;
const blank=()=>({v:2,country:detectCountry(),onboarded:false,store:null,stores:[],locs:[],auto:null,showAv:true,products:{},pending:[],collected:[],purchases:[],home:[]});
function load(){try{const r=localStorage.getItem(KEY);if(r)return Object.assign(blank(),JSON.parse(r))}catch(e){}return blank()}
let S=load();
function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}

/* ================= helpers ================= */
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const money=n=>fmtMoney(n,S.country);
const now=()=>Date.now();
const P=code=>code?S.products[code]:null;
const title=p=>p?[p.brand,p.name].filter(Boolean).join(' '):'';
const keyOf=x=>x.code||('n:'+String(x.name||'').toLowerCase().trim());
const nameOf=x=>{const p=P(x.code);return p?title(p):x.name};
const nameHtml=x=>{const p=P(x.code);return p?`${esc(title(p))}${p.label?` <em>${esc(p.label)}</em>`:''}`:esc(x.name)};
const days=t=>Math.round((new Date(t).setHours(0,0,0,0)-new Date().setHours(0,0,0,0))/DAY);
const expTxt=t=>{if(!t)return 'No expiry date';const d=days(t);return d<0?`Expired ${-d} day${d===-1?'':'s'} ago`:d===0?'Expires today':d===1?'Expires tomorrow':d>90?'Expires '+new Date(t).toLocaleDateString(undefined,{month:'short',year:'numeric'}):`Expires in ${d} days`};
const ago=t=>{const d=-days(t);return d<=0?'today':d===1?'yesterday':d<30?d+' days ago':new Date(t).toLocaleDateString(undefined,{day:'numeric',month:'short'})};
const dstr=t=>new Date(t).toLocaleDateString(undefined,{day:'numeric',month:'short'});
const dkey=t=>{const d=new Date(t);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const rv=i=>`data-rv style="--i:${i}"`;
const COLORS={milk:'#f1ece2',cream:'#f4eee3',yogurt:'#f5f0e8',juice:'#f0a640',orange:'#f0a640',oil:'#c9a43a','olive oil':'#b9a032',water:'#cfe6f2',soda:'#5a2e1c',cola:'#4a2416',coffee:'#6b4430',tea:'#a8703c',spinach:'#6fa860',lettuce:'#8cbf6e',rice:'#efe9dc',sugar:'#f3efe7',salt:'#f3f1ee',flour:'#f3eee4',pasta:'#e2c27a',penne:'#e2c27a',spaghetti:'#e2c27a',noodle:'#e8cf8a',cereal:'#d9b77a',oats:'#dcc392',bread:'#c9955c',egg:'#e8d3b4',cheese:'#efc25a',cheddar:'#efb64a',butter:'#f3dc8a',tomato:'#c8432f',honey:'#e0a42c',jam:'#9c2a3d',chocolate:'#5b3423',beans:'#8a5a3c',chips:'#e8c069',ketchup:'#b5281e',chicken:'#f0c9b0',beef:'#a8443a'};
const colorOf=t=>COLORS[t]||'#cdb3c1';

/* thumbnails for lists */
const SH={carton:['M22 36 L40 16 L58 36 L58 112 Q58 116 54 116 L26 116 Q22 116 22 112 Z',36,116],jug:['M32 16 h16 v12 q18 6 18 24 v60 q0 4 -4 4 h-44 q-4 0 -4 -4 v-60 q0 -18 18 -24 Z',30,116],bottle:['M35 6 h10 v20 q12 8 12 24 v62 q0 4 -4 4 h-26 q-4 0 -4 -4 v-62 q0 -16 12 -24 Z',30,116],tub:['M12 44 h56 l-5 68 q-1 4 -5 4 h-36 q-4 0 -5 -4 Z',44,116],jar:['M18 34 h44 v6 q4 4 4 10 v60 q0 6 -6 6 h-40 q-6 0 -6 -6 v-60 q0 -6 4 -10 Z',40,116],box:['M18 28 h44 v84 q0 4 -4 4 h-36 q-4 0 -4 -4 Z',28,116],bag:['M18 26 q22 -10 44 0 l5 84 q0 6 -6 6 h-42 q-6 0 -6 -6 Z',22,116],can:['M20 34 q20 -8 40 0 v76 q-20 8 -40 0 Z',30,116]};
let vid=0;
function vessel(shape,lvl,color){
  const [d,t,b]=SH[shape]||SH.bag,id='v'+(++vid),y=t+(1-Math.max(0,Math.min(1,lvl)))*(b-t);
  return `<svg viewBox="0 0 80 124" aria-hidden="true"><defs><clipPath id="${id}"><path d="${d}"/></clipPath><linearGradient id="${id}g" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".14"/></linearGradient></defs>
  <ellipse cx="40" cy="119" rx="26" ry="3.5" fill="#3b1d2c" opacity=".12"/><path d="${d}" fill="var(--g2)"/>
  <g clip-path="url(#${id})"><rect x="0" y="${y}" width="80" height="${124-y}" fill="${color}"/><rect x="0" y="${y}" width="80" height="2" fill="#fff" opacity=".5"/><rect width="80" height="124" fill="url(#${id}g)"/><rect x="25" y="${t+6}" width="2.6" height="${(b-t)*.55}" rx="1.3" fill="#fff" opacity=".7"/></g>
  <path d="${d}" fill="none" stroke="currentColor" stroke-opacity=".3" stroke-width="1.2"/></svg>`;
}

/* ================= purchases & prices (real records only) ================= */
const priced=k=>S.purchases.filter(p=>keyOf(p)===k&&p.price!=null).sort((a,b)=>b.t-a.t);
const lastPaid=k=>priced(k)[0]||null;
const lastBought=k=>S.purchases.filter(p=>keyOf(p)===k&&p.store).sort((a,b)=>b.t-a.t)[0]||null;
function spent(from,to){return S.purchases.filter(p=>p.t>=from&&p.t<to&&p.price!=null).reduce((s,p)=>s+p.price*p.qty,0)}
function savedSince(from){let s=0;const last={};[...S.purchases].filter(p=>p.price!=null).sort((a,b)=>a.t-b.t).forEach(p=>{const k=keyOf(p);if(last[k]!=null&&p.price<last[k]&&p.t>=from)s+=(last[k]-p.price)*p.qty;last[k]=p.price});return s}
const monthStart=(o=0)=>{const d=new Date();return new Date(d.getFullYear(),d.getMonth()-o,1).getTime()};

function insights(code,shelf,store){
  const p=P(code),out=[];if(!p)return out;
  const home=S.home.filter(h=>h.rem>0&&(h.code===code||(p.type&&h.type===p.type)));
  const best=home.sort((a,b)=>b.rem/b.total-a.rem/a.total)[0];
  if(best&&best.rem/best.total>=.5)out.push({c:'warn',dup:1,h:'You already have this at home',t:`About ${Math.round(best.rem/best.total*100)}% of ${esc(best.code?title(P(best.code)):best.name)} is left, in ${esc(best.loc)}.`});
  const hist=priced(code),lp=hist[0];
  if(shelf>0&&lp){
    if(shelf<lp.price-.004)out.push({c:'good',h:`You save ${money(lp.price-shelf)} vs last time`,t:`You paid ${money(lp.price)}${lp.store?' at '+esc(lp.store):''} on ${dstr(lp.t)}.`,stock:1});
    else if(shelf>lp.price+.004)out.push({c:'',h:`${money(shelf-lp.price)} more than last time`,t:`You paid ${money(lp.price)}${lp.store?' at '+esc(lp.store):''} on ${dstr(lp.t)}.`});
  }
  if(shelf>0){const cheaper=hist.filter(h=>h.store&&h.store!==store&&h.price<shelf-.004).sort((a,b)=>a.price-b.price)[0];
    if(cheaper&&cheaper!==lp)out.push({c:'',h:`You've paid less at ${esc(cheaper.store)}`,t:`${money(cheaper.price)} on ${dstr(cheaper.t)}, vs ${money(shelf)} here.`})}
  if(shelf>0&&p.size&&p.brand){
    let bestV=null;
    Object.values(S.products).forEach(q=>{if(q.code===code||q.brand!==p.brand||q.type!==p.type||!q.size||q.unit!==p.unit)return;
      const h=priced(q.code)[0];if(!h)return;const n=Math.ceil(p.size/q.size-1e-9),cost=n*h.price;
      if(cost<shelf-.004&&(!bestV||cost<bestV.cost))bestV={n,cost,q,h}});
    if(bestV)out.push({c:'good',h:`Better value: save ${money(shelf-bestV.cost)}`,t:`${bestV.n>1?bestV.n+' × ':''}${esc(title(bestV.q))} ${esc(bestV.q.label||'')} cost ${money(bestV.cost)}${bestV.h.store?' at '+esc(bestV.h.store):''} (${dstr(bestV.h.t)}), vs ${money(shelf)} for this.`});
  }
  const n60=S.purchases.filter(x=>x.code===code&&x.t>now()-60*DAY).reduce((s,x)=>s+x.qty,0);
  if(n60>=3){const avg=hist.length?hist.reduce((s,x)=>s+x.price,0)/hist.length:null;
    const k=Math.min(4,Math.ceil(n60/4));
    out.push({c:shelf>0&&avg&&shelf<avg-.004?'good':'',h:`You've bought this ${n60} times in 60 days`,t:shelf>0&&avg&&shelf<avg-.004?`It's below your average of ${money(avg)} today. Getting ${k} now saves trips.`:`Getting ${k} at a time would save trips.`,stock:k});
  }
  return out;
}

/* ================= shell ================= */
let tab=location.hash.slice(1)||'list',seg='pending',undoFn=null,tt=0,stopCam=null,viewer=null;
if(!['list','home','scan','recipes','receipts','savings'].includes(tab))tab='list';
const scanState={code:null,loading:false,err:null,shelf:'',notFound:false};

function header(){const s=savedSince(monthStart());$('savepill').textContent=`${money(s)} saved`}
function go(t){if(t!==tab){if(stopCam){stopCam();stopCam=null}tab=t;history.replaceState(null,'','#'+t)}render(true);$('main').scrollTop=0}
function render(anim){
  header();
  document.querySelectorAll('#nav button').forEach(b=>{b.dataset.t===tab?b.setAttribute('aria-current','page'):b.removeAttribute('aria-current')});
  const m=$('main');
  m.innerHTML=({list:vList,home:vHome,scan:vScan,recipes:vRecipes,receipts:vReceipts,savings:vSavings})[tab]();
  if(anim){m.classList.remove('enter');void m.offsetWidth;m.classList.add('enter');clearTimeout(m._t);m._t=setTimeout(()=>m.classList.remove('enter'),1400)}
  if(tab==='recipes')loadRecipes();
  if(tab==='receipts')loadReceiptThumbs();
  save();
}
function open(h,onClose){closeViewer();$('panel').innerHTML=h;$('sheet').hidden=false;$('sheet')._close=onClose||null}
function close(){closeViewer();$('sheet').hidden=true;const f=$('sheet')._close;$('sheet')._close=null;f&&f()}
function closeViewer(){if(viewer){viewer.dispose();viewer=null}}
function toast(m,u){$('tmsg').textContent=m;undoFn=u||null;$('tundo').hidden=!u;$('toast').hidden=false;clearTimeout(tt);tt=setTimeout(()=>$('toast').hidden=true,u?6000:3200)}

/* ================= LIST ================= */
function vList(){
  let h='',i=0;
  const soon=S.home.filter(x=>x.exp&&days(x.exp)<=3&&days(x.exp)>=0&&x.rem/x.total>=.3).sort((a,b)=>a.exp-b.exp)[0];
  h+=`<div ${rv(i++)}><h1>Groceries</h1><p class="lede">${S.pending.length?`${S.pending.length} to get`:'Nothing pending'}${S.collected.length?` · ${S.collected.length} in the basket`:''}</p></div>`;
  if(soon)h+=`<div class="note warn glass" ${rv(i++)}><strong>${esc(soon.code?title(P(soon.code)):soon.name)}: ${esc(expTxt(soon.exp).toLowerCase())}</strong>${Math.round(soon.rem/soon.total*100)}% is still left. <button class="link" data-go="recipes">Recipes to use it up</button></div>`;
  h+=`<div class="seg glass" role="group" aria-label="Lists" ${rv(i++)}><button data-seg="pending" aria-pressed="${seg==='pending'}">Pending · ${S.pending.length}</button><button data-seg="collected" aria-pressed="${seg==='collected'}">Collected · ${S.collected.length}</button></div>`;
  if(seg==='pending'){
    h+=`<form class="add" id="addf" ${rv(i++)}><input type="text" id="addin" placeholder="Add an item, e.g. milk" autocomplete="off" aria-label="Item name"><button class="btn">Add</button></form>`;
    let total=0,unpriced=0;
    const rows=S.pending.map(x=>{const k=keyOf(x),lp=lastPaid(k),lb=lastBought(k);if(lp)total+=lp.price*x.qty;else unpriced++;
      return `<div class="row"><button class="check" data-collect="${x.id}" aria-label="Mark ${esc(nameOf(x))} collected"></button><div><div class="nm">${nameHtml(x)}</div>
      <div class="sub">${lp?`Last paid ${money(lp.price)}${lp.store?' at '+esc(lp.store):''}, ${ago(lp.t)}`:'No price yet'}</div>${S.showAv&&lb&&lb.store&&(!lp||lb.store!==lp.store)?`<div class="sub">Last bought at ${esc(lb.store)}, ${ago(lb.t)}</div>`:''}${!x.code?'<div class="sub">Scan it in the store to get the exact product</div>':''}</div>
      <div class="ctl"><div class="step"><button data-q="${x.id}" data-d="-1" aria-label="Fewer">−</button><span>${x.qty}</span><button data-q="${x.id}" data-d="1" aria-label="More">+</button></div><button class="x" data-delp="${x.id}" aria-label="Delete ${esc(nameOf(x))}">✕</button></div></div>`}).join('');
    h+=`<div class="card glass" style="margin-top:12px" ${rv(i++)}>${rows||`<div class="empty"><div class="big">Your list is clear</div>Type what you need above, or scan a barcode.</div>`}
      ${S.pending.length?`<div class="total"><span class="small">Based on what you last paid${unpriced?` · ${unpriced} item${unpriced>1?'s':''} without a price`:''}</span><b>${money(total)}</b></div>`:''}</div>`;
  }else{
    let tot=0,np=0;
    const rows=S.collected.map(x=>{if(x.price!=null)tot+=x.price*x.qty;else np++;return `<div class="row"><span class="check on" aria-hidden="true">✓</span><div><div class="nm">${nameHtml(x)}</div><div class="sub">${x.store?esc(x.store)+' · ':''}${x.price!=null?money(x.price)+(x.qty>1?' × '+x.qty:''):'No price entered'}</div>
      <button class="link" style="font-size:14px;margin-top:4px" data-away="${x.id}">Put away at home</button></div>
      <div class="ctl"><div class="step"><button data-qc="${x.id}" data-d="-1" aria-label="Fewer">−</button><span>${x.qty}</span><button data-qc="${x.id}" data-d="1" aria-label="More">+</button></div><button class="x" data-delc="${x.id}" aria-label="Move back to Pending">✕</button></div></div>`}).join('');
    h+=`<div class="card glass" ${rv(i++)}>${rows||`<div class="empty"><div class="big">Basket's empty</div>Tick items on Pending as you pick them up.</div>`}
      ${S.collected.length?`<div class="total"><span class="small">Collected total${np?` · ${np} without a price`:''}</span><b>${money(tot)}</b></div>`:''}</div>`;
    if(S.collected.length)h+=`<div class="acts2" ${rv(i++)}><button class="btn" data-awayall>Put everything away</button></div><p class="small" ${rv(i++)}>Removing an item here sends it back to Pending. Removing one from Pending deletes it.</p>`;
  }
  return h;
}
function addPending(v){
  v=v.trim();if(!v)return;
  const hit=Object.values(S.products).find(p=>title(p).toLowerCase()===v.toLowerCase());
  const same=S.pending.find(x=>hit?x.code===hit.code:(!x.code&&x.name.toLowerCase()===v.toLowerCase()));
  if(same)same.qty++;else S.pending.unshift(hit?{id:uid(),code:hit.code,qty:1}:{id:uid(),name:v[0].toUpperCase()+v.slice(1),qty:1});
}

/* store picker shared by sheets */
function storeField(id,val){
  const names=[...new Set([...(S.stores||[]).map(s=>s.name),...S.purchases.map(p=>p.store).filter(Boolean)])];
  return `<div class="field">Store<input type="text" id="${id}" list="${id}-dl" value="${esc(val||'')}" placeholder="Any store, big or small" autocomplete="off"><datalist id="${id}-dl">${names.map(n=>`<option value="${esc(n)}">`).join('')}</datalist>
   <div class="chips" id="${id}-near">${names.slice(0,4).map(n=>`<button type="button" data-setstore="${esc(n)}" data-target="${id}">${esc(n)}</button>`).join('')}<button type="button" data-near="${id}">Find stores near me</button></div></div>`;
}
async function findNear(target){
  const box=$(target+'-near');if(!box)return;box.innerHTML='<span class="small"><span class="spin"></span> Finding every shop near you…</span>';
  try{const pos=await here();const list=await nearbyStores(pos);
    if(!$(target+'-near'))return;
    box.innerHTML=list.length?list.slice(0,24).map(s=>`<button type="button" data-setstore="${esc(s.name)}" data-osm="${esc(s.id)}" data-target="${target}">${esc(s.name)}<span class="small">&nbsp;· ${s.m<1000?s.m+' m':(s.m/1000).toFixed(1)+' km'}${s.kind?' · '+esc(s.kind):''}</span></button>`).join(''):'<span class="small">No shops found within 3 km on OpenStreetMap. Type the name instead.</span>';
    box._list=list;
  }catch(e){box.innerHTML=`<span class="small">${e&&e.code===1?'Location permission was declined.':'Couldn\'t search right now.'} Type the store name instead.</span>`}
}
function rememberStore(name,osm){if(!name)return;S.store=name;if(!S.stores.some(s=>s.name===name))S.stores.unshift({name,id:osm||null});S.stores=S.stores.slice(0,30)}

function collectSheet(id){
  const x=S.pending.find(y=>y.id===id);if(!x)return;const lp=lastPaid(keyOf(x));
  open(`<h1>Got it</h1><p class="nm">${nameHtml(x)}</p><form id="colf">${storeField('cs',S.store)}
   <div class="two"><div class="field">Price each<input type="number" id="cp" step="0.01" min="0" inputmode="decimal" placeholder="${lp?'Last '+money(lp.price):'Shelf price'}"></div><div class="field">Quantity<input type="number" id="cq" min="1" value="${x.qty}" inputmode="numeric"></div></div>
   <p class="small">Leave the price empty if you don't want to record it. Prices are never guessed.</p>
   <div class="acts2"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn ok">Move to Collected</button></div></form>`);
  $('colf').onsubmit=e=>{e.preventDefault();const pr=$('cp').value===''?null:+$('cp').value;doCollect(x,$('cs').value.trim()||null,pr,Math.max(1,+$('cq').value||1));close()};
}
function doCollect(x,store,price,qty){
  if(store)rememberStore(store);
  const pur={id:uid(),code:x.code||null,name:x.code?null:x.name,t:now(),store,price,qty};S.purchases.push(pur);
  S.pending=S.pending.filter(y=>y.id!==x.id);
  S.collected.unshift({id:uid(),code:x.code||null,name:x.name||null,qty,store,price,pid:pur.id});
  render();toast(`Collected ${qty>1?qty+' × ':''}${x.code?title(P(x.code)):x.name}`);
}
const LOCS=['Fridge · top shelf','Fridge · middle shelf','Fridge · door','Fridge · crisper drawer','Freezer','Pantry · top shelf','Kitchen cabinet','Counter'];
function awaySheet(ids){
  const items=ids.map(id=>S.collected.find(y=>y.id===id)).filter(Boolean);if(!items.length)return;
  const x=items[0],p=P(x.code),cold=p&&/refrig|fridge|chill|°c|°f|cold/i.test(p.storage||'');
  const needSize=!p||!p.size;
  open(`<h1>Put it away</h1><p class="nm">${nameHtml(x)}${items.length>1?` <span class="small">and ${items.length-1} more</span>`:''}</p><form id="awf">
   <div class="field">Where are you keeping it?<input type="text" id="al" value="${esc(S.lastLoc&&!cold?S.lastLoc:cold?'Fridge · top shelf':'')}" placeholder="e.g. Fridge · door" required><div class="chips">${[...new Set([...S.locs,...LOCS])].slice(0,12).map(l=>`<button type="button" data-loc="${esc(l)}">${esc(l)}</button>`).join('')}</div></div>
   ${items.length===1?`<div class="field">Expiry date on the package<input type="date" id="ae"><span class="small" style="font-weight:500">Leave empty if there's no date printed.</span></div>`:''}
   ${items.length===1&&needSize?`<div class="two"><div class="field">Size of one<input type="number" id="asz" min="0.1" step="any" required inputmode="decimal"></div><div class="field">Unit<select id="au"><option>ml</option><option>g</option><option>pcs</option></select></div></div>`:''}
   ${p&&p.storage?`<p class="small">Label says: ${esc(p.storage)}</p>`:''}
   <div class="acts2"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn">Save at home</button></div></form>`);
  $('awf').onsubmit=e=>{e.preventDefault();const loc=$('al').value.trim();S.lastLoc=loc;if(!S.locs.includes(loc)&&!LOCS.includes(loc))S.locs.unshift(loc);
    let skipped=0;
    items.forEach(it=>{const q=P(it.code);let size=q&&q.size,unit=q&&q.unit;
      if(items.length===1&&$('asz')){size=+$('asz').value;unit=$('au').value;if(q){q.size=size;q.unit=unit}}
      if(!size){skipped++;return}
      const exp=items.length===1&&$('ae')&&$('ae').value?new Date($('ae').value+'T12:00').getTime():null;
      for(let k=0;k<it.qty;k++)S.home.unshift({id:uid(),code:it.code,name:it.code?null:it.name,type:q?q.type:guessType(it.name),shape:q?q.shape:guessShape(guessType(it.name)),total:size,rem:size,unit,loc,exp,added:now(),logs:[]});
      S.collected=S.collected.filter(y=>y.id!==it.id)});
    close();render();toast(skipped?`Saved. ${skipped} item${skipped>1?'s need':' needs'} a size, open them one by one.`:`Saved in ${loc}`)};
}

/* ================= AT HOME ================= */
function rateOf(it){const used=it.logs.reduce((s,l)=>s+l.a,0);if(!used||it.logs.length<1)return 0;const span=Math.max(1,(now()-Math.min(it.added,...it.logs.map(l=>l.t)))/DAY);return used/span}
function runsOut(it){const r=rateOf(it);return r&&it.logs.length>=2?Math.max(0,Math.round(it.rem/r)):null}
const label=it=>it.code?title(P(it.code)):it.name;
function vHome(){
  let h='',i=0;const q=(S.q||'').toLowerCase().trim();
  h+=`<div ${rv(i++)}><h1>At home</h1><p class="lede">${S.home.length?`${S.home.length} item${S.home.length>1?'s':''} tracked`:'Nothing tracked yet'}</p></div>`;
  h+=`<input type="search" id="q" placeholder="Where's my…" aria-label="Find an item at home" value="${esc(S.q||'')}" ${rv(i++)}>`;
  const list=S.home.filter(x=>!q||(label(x)+' '+x.loc+' '+x.type).toLowerCase().includes(q)).sort((a,b)=>(a.exp||9e15)-(b.exp||9e15));
  if(q&&list.length)h+=`<div class="note good" style="margin-top:12px" ${rv(i++)}><strong>${esc(label(list[0]))}</strong>is in ${esc(list[0].loc)}.</div>`;
  h+=`<div style="margin-top:12px">`;
  if(!list.length)h+=`<div class="card glass empty" ${rv(i++)}><div class="big">${q?'Not found':'Nothing here yet'}</div>${q?`No item matches “${esc(q)}”.`:'Collect items at the store, then tap “Put away at home”.'}</div>`;
  h+=list.map(x=>{const f=x.rem/x.total,used=Math.round((1-f)*100),ro=runsOut(x),ll=x.logs[x.logs.length-1],d=x.exp?days(x.exp):null;
    return `<button class="item glass" data-det="${x.id}" ${rv(i++)}>${vessel(x.shape,f,colorOf(x.type))}<div><div class="nm">${esc(label(x))}</div>
      <div class="sub">${used}% used · ${fmtAmt(x.rem,x.unit)} left · ${esc(x.loc)}</div><div class="meter"><i style="width:${Math.round(f*100)}%"></i></div>
      <div class="meta"><span class="chip ${d!=null&&d<=3?'warn':''}">${esc(expTxt(x.exp))}</span>${ro!=null?`<span class="chip">≈${ro} day${ro===1?'':'s'} left (estimate)</span>`:''}${ll?`<span class="chip good">Used ${fmtAmt(ll.a,x.unit)} ${ago(ll.t)}</span>`:''}</div></div></button>`}).join('');
  h+='</div>';
  const acts=S.home.flatMap(x=>x.logs.map(l=>({x,l}))).sort((a,b)=>b.l.t-a.l.t).slice(0,8);
  if(acts.length&&!q)h+=`<h2 ${rv(i++)}>Recent use</h2><div class="card glass" ${rv(i++)}>${acts.map(({x,l})=>`<div class="row" style="grid-template-columns:minmax(0,1fr) auto"><div><div class="nm" style="font-size:15px">${esc(label(x))}</div><div class="sub">${new Date(l.t).toLocaleString(undefined,{weekday:'short',hour:'numeric',minute:'2-digit'})}${l.note?' · '+esc(l.note):''}</div></div><span class="chip">−${fmtAmt(l.a,x.unit)}</span></div>`).join('')}</div>`;
  return h;
}

async function detail(id){
  const it=S.home.find(x=>x.id===id);if(!it)return;const p=P(it.code),f=it.rem/it.total;
  open(`<div class="viewer" id="vw"><div class="hud"><div class="big" id="vpct"></div><div class="muted" id="vleft"></div></div><div class="hint">Drag to turn · pinch to zoom</div></div><div id="dbody"></div>`);
  drawDetail(it);
  try{const mv=(await import('./viewer.js')).mountViewer;if($('vw')&&!$('sheet').hidden){closeViewer();viewer=mountViewer_(mv,it,p)}}catch(e){$('vw')&&($('vw').insertAdjacentHTML('beforeend',`<div style="position:absolute;inset:60px 0 30px;display:grid;place-items:center">${vessel(it.shape,f,colorOf(it.type))}</div>`))}
}
function drawDetail(it){
  const p=P(it.code);
  $('vpct').textContent=Math.round((1-it.rem/it.total)*100)+'% used';$('vleft').textContent=`${fmtAmt(it.rem,it.unit)} of ${fmtAmt(it.total,it.unit)} left`;
  const pre=it.unit==='ml'?[[30,'Splash, 30 ml'],[250,'A glass, 250 ml'],[500,'500 ml']]:it.unit==='pcs'?[[1,'1'],[2,'2'],[3,'3']]:[[50,'50 g'],[100,'100 g'],[250,'250 g']];
  const step=it.unit==='pcs'?1:Math.max(1,Math.round(it.total/200)),start=Math.min(pre[1][0],it.rem);
  $('dbody').innerHTML=`<div class="pname">${esc(label(it))}</div><div class="sub">${p&&p.label?esc(p.label)+' · ':''}${esc(it.loc)} · ${esc(expTxt(it.exp))}</div>
   <h2>Log use</h2><div class="card glass">${it.rem>0?`<div class="big" id="la" style="font-size:36px">${fmtAmt(start,it.unit)}</div>
     <input type="range" id="lr" min="${step}" max="${it.rem}" step="${step}" value="${start}" aria-label="Amount used">
     <div class="chips" style="margin:4px 0 12px">${pre.filter(([v])=>v<=it.rem).map(([v,l])=>`<button type="button" data-amt="${v}">${l}</button>`).join('')}<button type="button" data-amt="${it.rem}">All of it</button></div>
     <button class="btn" style="width:100%" id="lsave">Log it</button>`:'<p class="muted">This one is finished.</p>'}</div>
   ${it.logs.length?`<h2>History</h2><div class="card glass">${[...it.logs].reverse().slice(0,12).map((l,ix)=>`<div class="row" style="grid-template-columns:minmax(0,1fr) auto auto"><span>${new Date(l.t).toLocaleString(undefined,{weekday:'short',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'})}${l.note?`<span class="src">${esc(l.note)}</span>`:''}</span><span class="chip">−${fmtAmt(l.a,it.unit)}</span>${ix===0?`<button class="x" data-unlog="${it.id}" aria-label="Undo last use">↶</button>`:'<span></span>'}</div>`).join('')}</div>`:''}
   ${infoTable(it.code,it)}
   <h2>Edit</h2><form id="edf" class="card glass"><div class="field">Where it's kept<input type="text" id="el" value="${esc(it.loc)}"></div>
   <div class="two"><div class="field">Expiry date<input type="date" id="ee" value="${it.exp?dkey(it.exp):''}"></div><div class="field">Container<select id="es">${SHAPES.map(s=>`<option ${s===it.shape?'selected':''}>${s}</option>`).join('')}</select></div></div>
   <div class="acts2"><button class="btn ghost" type="button" data-finish="${it.id}">It's finished</button><button class="btn">Save changes</button></div></form>`;
  $('edf').onsubmit=e=>{e.preventDefault();it.loc=$('el').value.trim()||it.loc;it.exp=$('ee').value?new Date($('ee').value+'T12:00').getTime():null;const sh=$('es').value!==it.shape;it.shape=$('es').value;if(it.code&&P(it.code))P(it.code).shape=it.shape;save();render();if(sh)detail(it.id);else{drawDetail(it);toast('Saved')}};
  const lr=$('lr');if(lr){const sync=()=>$('la').textContent=fmtAmt(+lr.value,it.unit);lr.oninput=sync;
    $('dbody').querySelectorAll('[data-amt]').forEach(b=>b.onclick=()=>{lr.value=b.dataset.amt;sync()});
    $('lsave').onclick=()=>{use(it,+lr.value);render();if(it.rem>0)refreshDetail(it)}}
}
function refreshDetail(it){if($('dbody')){drawDetail(it);viewer&&viewer.setLevel(it.rem/it.total)}}
function mountViewer_(mv,it,p){return mv($('vw'),{shape:it.shape,level:it.rem/it.total,color:colorOf(it.type),brand:p&&p.brand,name:p?p.name:it.name,label:p&&p.label,image:p&&p.image})}
function use(it,a,note){a=Math.min(a,it.rem);if(a<=0)return;it.rem=Math.round((it.rem-a)*100)/100;it.logs.push({t:now(),a,note:note||null});save();if(it.rem<=0)finished(it);else toast(`Logged ${fmtAmt(a,it.unit)} · ${fmtAmt(it.rem,it.unit)} left`)}
function finished(it){
  S.home=S.home.filter(x=>x.id!==it.id);save();
  const name=label(it),addBack=()=>{if(!S.pending.some(x=>keyOf(x)===keyOf(it)))S.pending.unshift(it.code?{id:uid(),code:it.code,qty:1}:{id:uid(),name:it.name,qty:1})};
  if(S.auto===true){addBack();render();toast(name+' finished · added to Pending');return}
  setTimeout(()=>{open(`<h1>${esc(name)} is finished</h1><p class="lede">Add it back to your Pending list?</p><div class="acts2"><button class="btn ghost" data-close>Not now</button><button class="btn ok" id="fy">Add to Pending</button></div><p style="margin-top:16px"><button class="link" id="fa">Always add finished items automatically</button></p>`);
    $('fy').onclick=()=>{addBack();close();render();toast('Added to Pending')};
    $('fa').onclick=()=>{S.auto=true;addBack();close();render();toast('Finished items will be added automatically')}},60);
}

function infoTable(code,it){
  const p=P(code),L=(k,v,s)=>`<tr><td>${k}</td><td>${v}${s?`<span class="src">${s}</span>`:''}</td></tr>`;
  const src=p?(p.src==='Open Food Facts'?'Package label, via Open Food Facts':'Added by you'):'';
  let r='';
  if(p){r+=L('Product',esc(title(p))+(p.label?' · '+esc(p.label):''),src)+L('Barcode',esc(p.code),'Package');
    r+=L('Recommended storage',p.storage?esc(p.storage):`No official info on file <button class="link" data-addstorage="${esc(p.code)}">Add from label</button>`,p.storage?(p.storageSrc||src):'');
    if(p.nutriscore)r+=L('Nutri-Score',`<span class="ns" style="background:${{A:'#1e8f4e',B:'#60ac0e',C:'#c9a40a',D:'#e07b16',E:'#d6331f'}[p.nutriscore]}">${p.nutriscore}</span>`,src);
    r+=L('Allergens',p.allergens&&p.allergens.length?esc(p.allergens.join(', ')):'None listed',src);
    if(p.traces&&p.traces.length)r+=L('May contain',esc(p.traces.join(', ')),src);
    if(p.nutrition&&p.nutrition.length)r+=L('Per 100 g / 100 ml',p.nutrition.map(([a,b])=>`${esc(a)}: ${esc(b)}`).join('<br>'),src);
    if(p.ingredients)r+=L('Ingredients',`<details><summary>Show</summary>${esc(p.ingredients)}</details>`,src);
    if(p.categories&&p.categories.length)r+=L('Category',esc(p.categories.join(' · ')),src);}
  if(it){const ro=runsOut(it);r+=L('Where you kept it',esc(it.loc),'You')+L('Expiry date',it.exp?new Date(it.exp).toLocaleDateString(undefined,{day:'numeric',month:'long',year:'numeric'}):'Not entered','From your package')+L('Put away',new Date(it.added).toLocaleDateString(undefined,{day:'numeric',month:'short'}),'You')+L('Runs out',ro!=null?`In about ${ro} days at your pace`:'Log use twice to see a forecast',ro!=null?'Estimate from your usage':'')}
  const k=code||(it&&keyOf(it));const lp=k&&lastPaid(k);if(lp)r+=L('Last bought',`${money(lp.price)}${lp.store?' at '+esc(lp.store):''}, ${dstr(lp.t)}`,'Your receipts');
  return r?`<h2>Everything about it</h2><div class="card glass"><table>${r}</table></div>`:'';
}

/* ================= SCAN ================= */
function vScan(){
  let h='',i=0;
  h+=`<div ${rv(i++)}><h1>Scan</h1><p class="lede">Point the camera at a barcode.</p></div>`;
  h+=`<div class="scan glass" id="scanbox" ${rv(i++)}><video id="vid" playsinline muted></video><div class="idle" id="idle"><svg width="74" height="50" viewBox="0 0 84 56" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 16V4h12M68 4h12v12M80 40v12H68M16 52H4V40"/><path d="M22 14v28M28 14v28M33 14v28M40 14v28M45 14v28M52 14v28M58 14v28" stroke-width="2.4"/></svg>
     <button class="btn" id="camgo">Start camera</button><button class="link" id="photo">Or use a photo</button></div></div>`;
  h+=`<form class="add" id="bcf" style="margin-top:12px" ${rv(i++)}><input type="text" id="bcin" inputmode="numeric" placeholder="Type a barcode number" aria-label="Barcode number"><button class="btn ghost">Look up</button></form>`;
  h+=`<div id="res">${resultHtml()}</div>`;
  return h;
}
function resultHtml(){
  const s=scanState;if(!s.code)return '';
  if(s.loading)return `<div class="card glass" style="margin-top:14px"><span class="spin"></span>&nbsp; Looking up ${esc(s.code)}…</div>`;
  const p=P(s.code);
  if(!p)return `<div class="card glass" style="margin-top:14px"><h2 style="margin-top:0">${s.err?'Can\'t reach the product database':'Not in the database yet'}</h2><p class="muted">${s.err?'Check your connection and try again, or add it yourself.':'Barcode '+esc(s.code)+' isn\'t on Open Food Facts. Add it once and it\'s saved.'}</p>
    ${s.err?`<button class="btn ghost" data-retry style="margin-bottom:12px">Try again</button>`:''}
    <form id="newp"><div class="two"><div class="field">Brand<input type="text" id="np-b" required></div><div class="field">Product<input type="text" id="np-n" required></div></div>
    <div class="two"><div class="field">Size<input type="number" id="np-s" min="0.1" step="any" required inputmode="decimal"></div><div class="field">Unit<select id="np-u"><option>ml</option><option>g</option><option>pcs</option></select></div></div>
    <div class="field">Storage, as printed on the label<input type="text" id="np-st" placeholder="e.g. Keep refrigerated"></div><button class="btn" style="width:100%">Save product</button></form></div>`;
  return `<div class="card glass" style="margin-top:14px"><div class="prod"><div class="ph">${p.image?`<img src="${esc(p.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:vessel(p.shape,1,colorOf(p.type))}</div><div><div class="pname">${esc(title(p))}</div><div class="sub">${esc(p.label||'Size unknown')} · ${esc(p.code)}</div></div></div>
    <div style="margin-top:14px">${storeField('ss',S.store)}<div class="field">Price on the shelf<input type="number" id="shelf" step="0.01" min="0" inputmode="decimal" value="${esc(s.shelf)}" placeholder="Optional, to compare with what you paid"></div></div></div>
    <div id="insbox">${insHtml()}</div>
    ${infoTable(s.code,null)}`;
}
function insHtml(){
  const s=scanState,shelf=parseFloat(s.shelf),ins=insights(s.code,shelf>0?shelf:null,($('ss')&&$('ss').value.trim())||S.store),dup=ins.some(n=>n.dup),stock=ins.find(n=>n.stock>1);
  return `${ins.map(n=>`<div class="note ${n.c||'glass'}"><strong>${n.h}</strong>${n.t}</div>`).join('')}
    <div class="acts2">${dup?`<button class="btn ghost" data-skip>Skip it</button><button class="btn" data-buy="1">Buy anyway</button>`:`<button class="btn ghost" data-topend>Add to Pending</button><button class="btn" data-buy="1">Collect now</button>`}</div>
    ${stock?`<div class="acts2"><button class="btn ok" data-buy="${stock.stock}">Collect ${stock.stock}</button></div>`:''}`;
}
function drawRes(){const r=$('res');if(r)r.innerHTML=resultHtml()}
async function lookup(code){
  code=String(code).trim().replace(/\s/g,'');if(!code)return;
  if(stopCam){stopCam();stopCam=null}
  Object.assign(scanState,{code,loading:!P(code),err:null,shelf:''});
  if(tab!=='scan'){tab='scan';history.replaceState(null,'','#scan');render(true)}else drawRes();
  if(navigator.vibrate)navigator.vibrate(30);
  if(!P(code)){try{const p=await lookupProduct(code);if(p)S.products[code]=p}catch(e){scanState.err=true}scanState.loading=false;save();drawRes()}
  const r=$('res');r&&r.scrollIntoView({behavior:'smooth',block:'start'});
}
async function camera(){
  const v=$('vid'),idle=$('idle');if(!v)return;
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){idle.insertAdjacentHTML('beforeend','<p class="small">This browser can\'t open the camera here. Use a photo instead.</p>');return}
  try{idle.style.display='none';$('scanbox').insertAdjacentHTML('beforeend','<div class="frame"></div><div class="laser"></div>');
    stopCam=await startScan(v,c=>{stopCam=null;lookup(c)});
  }catch(e){idle.style.display='';$('scanbox').querySelectorAll('.frame,.laser').forEach(n=>n.remove());idle.insertAdjacentHTML('beforeend',`<p class="small">${e&&e.name==='NotAllowedError'?'Camera permission was declined. Allow it in your browser settings, or use a photo.':'Couldn\'t start the camera. Use a photo instead.'}</p>`)}
}
function collectScanned(n){
  const code=scanState.code,p=P(code),shelf=parseFloat(scanState.shelf),store=($('ss')&&$('ss').value.trim())||S.store;
  const g=S.pending.find(x=>x.code===code)||S.pending.find(x=>!x.code&&p.type&&x.name.toLowerCase().includes(p.type));
  const x=g?{...g,code}:{id:'_',code,qty:n};
  doCollect(x,store||null,shelf>0?shelf:null,n);scanState.code=null;drawRes();
}

/* ================= RECIPES ================= */
let recCache={},recState={key:null,items:null,err:null};
function homeKeys(){const m={};S.home.filter(x=>x.rem>0).forEach(x=>{(m[x.type]=m[x.type]||[]).push(x)});return m}
function expiringTypes(){return S.home.filter(x=>x.rem>0&&x.exp&&days(x.exp)<=4&&days(x.exp)>=0&&x.rem/x.total>=.3).sort((a,b)=>a.exp-b.exp)}
function vRecipes(){
  let h='',i=0;const ex=expiringTypes();
  h+=`<div ${rv(i++)}><h1>Use it up</h1><p class="lede">${ex.length?'Recipes built around what\'s about to expire.':'Recipes from what you have at home.'}</p></div>`;
  if(ex.length)h+=`<div class="note warn" ${rv(i++)}><strong>Expiring soon, mostly unused</strong>${ex.slice(0,4).map(x=>`${esc(label(x))} (${Math.round(x.rem/x.total*100)}% left, ${esc(expTxt(x.exp).toLowerCase())})`).join(', ')}</div>`;
  if(!S.home.length)return h+`<div class="card glass empty" ${rv(i++)}><div class="big">Nothing at home yet</div>Put groceries away and recipes will appear here.</div>`;
  h+=`<div id="recs" ${rv(i++)}><div class="card glass"><span class="spin"></span>&nbsp; Finding recipes…</div></div><p class="small" ${rv(i++)}>Recipes from TheMealDB.</p>`;
  return h;
}
function matchIng(name,hk){const n=name.toLowerCase();for(const t in hk){if(n.includes(t)||(t.endsWith('s')&&n.includes(t.slice(0,-1)))||(n.split(' ').pop()===t+'s'))return t}return null}
async function loadRecipes(){
  const box=$('recs');if(!box)return;const hk=homeKeys(),ex=expiringTypes();
  const targets=[...new Set([...ex.map(x=>x.type),...Object.keys(hk).sort((a,b)=>hk[b].length-hk[a].length)])].slice(0,3);
  const key=targets.join('|')+'#'+Object.keys(hk).join(',');
  try{
    let list=[];
    for(const t of targets){if(!recCache[t])recCache[t]=await recipesFor(t);recCache[t].slice(0,5).forEach(r=>{if(!list.some(y=>y.id===r.id))list.push({...r,for:t})})}
    if(!$('recs'))return;
    if(!list.length){box.innerHTML='<div class="card glass empty"><div class="big">No matches yet</div>No published recipes use these items. Try again after your next shop.</div>';return}
    const det=(await Promise.all(list.slice(0,8).map(r=>recipeDetail(r.id).catch(()=>null)))).filter(Boolean);
    const exT=new Set(ex.map(x=>x.type));
    const scored=det.map(d=>{const ings=d.ings.map(g=>({...g,have:matchIng(g.name,hk)}));const have=ings.filter(g=>g.have).length,useExp=ings.filter(g=>g.have&&exT.has(g.have)).length;return {...d,ings,have,score:useExp*10+have/ings.length*5}}).sort((a,b)=>b.score-a.score);
    recState.items=scored;
    if(!$('recs'))return;
    box.innerHTML=scored.map((r,ix)=>`<div class="recipe glass"><img src="${esc(r.thumb)}/preview" alt="" loading="lazy"><div><div class="nm">${esc(r.name)}</div><div class="sub">${esc([r.area,r.category].filter(Boolean).join(' · '))} · You have ${r.have} of ${r.ings.length}</div>
      <div class="ing">${r.ings.slice(0,8).map(g=>`<span class="${g.have?(exT.has(g.have)?'exp':''):'miss'}">${esc(g.name)}</span>`).join('')}${r.ings.length>8?`<span class="miss">+${r.ings.length-8}</span>`:''}</div>
      <div class="acts2"><button class="btn sm ghost" data-rview="${ix}">View</button><button class="btn sm" data-rmade="${ix}">I made this</button></div></div></div>`).join('');
  }catch(e){if($('recs'))box.innerHTML='<div class="card glass empty"><div class="big">Offline</div>Couldn\'t reach the recipe service. Check your connection.</div>'}
}
function recipeView(ix){const r=recState.items[ix];if(!r)return;
  open(`<img class="thumbimg" src="${esc(r.thumb)}" alt="" style="margin-top:0"><h1>${esc(r.name)}</h1><p class="muted">${esc([r.area,r.category].filter(Boolean).join(' · '))}</p>
   <h2>Ingredients</h2><div class="card glass">${r.ings.map(g=>`<div class="row" style="grid-template-columns:minmax(0,1fr) auto"><span>${esc(g.name)}${g.measure?` <span class="small">· ${esc(g.measure)}</span>`:''}</span>${g.have?'<span class="chip good">At home</span>':'<span class="chip">Need</span>'}</div>`).join('')}</div>
   <div class="acts2"><button class="btn ghost" data-rmiss="${ix}">Add missing to Pending</button><button class="btn" data-rmade="${ix}">I made this</button></div>
   <h2>Method</h2><div class="steps">${r.steps.split(/\r?\n+/).filter(s=>s.trim()).map(s=>`<p>${esc(s)}</p>`).join('')}</div>${r.source?`<p><a class="link" href="${esc(r.source)}" target="_blank" rel="noopener">Original recipe</a></p>`:''}`)}
function madeSheet(ix){const r=recState.items[ix],hk=homeKeys();const used=[...new Set(r.ings.map(g=>g.have).filter(Boolean))].map(t=>hk[t].sort((a,b)=>(a.exp||9e15)-(b.exp||9e15))[0]);
  open(`<h1>How much did you use?</h1><p class="lede">${esc(r.name)}. Set what came out of each item. Nothing is deducted until you save.</p><form id="mf">${used.map(it=>`<div class="card glass"><div class="nm">${esc(label(it))}</div><div class="sub">${fmtAmt(it.rem,it.unit)} left</div>
    <div class="big" style="font-size:28px" id="mo-${it.id}">${fmtAmt(0,it.unit)}</div><input type="range" data-mr="${it.id}" min="0" max="${it.rem}" step="${it.unit==='pcs'?1:Math.max(1,Math.round(it.total/200))}" value="0" aria-label="Amount of ${esc(label(it))}"></div>`).join('')||'<p class="muted">None of these ingredients are tracked at home.</p>'}
    <div class="acts2"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn">Save</button></div></form>`);
  $('panel').querySelectorAll('[data-mr]').forEach(s=>s.oninput=()=>{const it=S.home.find(x=>x.id===s.dataset.mr);$('mo-'+it.id).textContent=fmtAmt(+s.value,it.unit)});
  $('mf').onsubmit=e=>{e.preventDefault();let n=0;$('panel').querySelectorAll('[data-mr]').forEach(s=>{const it=S.home.find(x=>x.id===s.dataset.mr);if(it&&+s.value>0){use(it,+s.value,r.name);n++}});if(!$('sheet').hidden&&$('mf'))close();render();toast(n?`Logged ${n} ingredient${n>1?'s':''} from ${r.name}`:'Nothing logged')}}

/* ================= RECEIPTS ================= */
const DB='larder-photos';
function idb(){return new Promise((ok,no)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore('p');r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}
async function putPhoto(k,blob){const d=await idb();return new Promise((ok,no)=>{const t=d.transaction('p','readwrite');t.objectStore('p').put(blob,k);t.oncomplete=ok;t.onerror=()=>no(t.error)})}
async function getPhoto(k){const d=await idb();return new Promise(ok=>{const q=d.transaction('p').objectStore('p').get(k);q.onsuccess=()=>ok(q.result||null);q.onerror=()=>ok(null)})}
const tripKey=(t,store)=>dkey(t)+'|'+(store||'');
function vReceipts(){
  let h='',i=0;const m0=monthStart(),mt=spent(m0,now()+DAY);
  const ps=[...S.purchases].sort((a,b)=>b.t-a.t);
  h+=`<div ${rv(i++)}><h1>Receipts</h1><p class="lede">${money(mt)} this month</p></div>`;
  if(!ps.length)return h+`<div class="card glass empty" ${rv(i++)}><div class="big">No purchases yet</div>Everything you collect shows up here, day by day.</div>`;
  const days_={};ps.forEach(p=>{const d=dkey(p.t);(days_[d]=days_[d]||[]).push(p)});
  Object.entries(days_).slice(0,60).forEach(([d,list])=>{
    const dt=new Date(d+'T12:00'),tot=list.reduce((s,p)=>s+(p.price!=null?p.price*p.qty:0),0);
    h+=`<div class="day" ${rv(i++)}><b>${days(dt)===0?'Today':days(dt)===-1?'Yesterday':dt.toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'short'})}</b><span class="muted">${money(tot)}</span></div>`;
    const trips={};list.forEach(p=>{(trips[p.store||'']=trips[p.store||'']||[]).push(p)});
    Object.entries(trips).forEach(([st,items])=>{const tk=tripKey(items[0].t,st),sub=items.reduce((s,p)=>s+(p.price!=null?p.price*p.qty:0),0),np=items.filter(p=>p.price==null).length;
      h+=`<div class="card glass trip" ${rv(i++)}><div class="head"><div><div class="nm">${esc(st||'Store not entered')}</div><div class="sub">${new Date(Math.min(...items.map(p=>p.t))).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})} · ${items.length} item${items.length>1?'s':''}</div></div><button class="btn sm ghost" data-rphoto="${esc(tk)}">Receipt photo</button></div>
        ${items.map(p=>`<div class="line"><span>${p.qty>1?p.qty+' × ':''}${esc(p.code?title(P(p.code)):p.name)}</span><span>${p.price!=null?money(p.price*p.qty):'<span class="small">no price</span>'}</span><button class="x" data-delpur="${p.id}" aria-label="Remove from receipts">✕</button></div>`).join('')}
        <div class="total" style="border:0"><span class="small">Total${np?` · ${np} without a price`:''}</span><b style="font-size:22px">${money(sub)}</b></div><div data-thumb="${esc(tk)}"></div></div>`});
  });
  return h;
}
async function loadReceiptThumbs(){for(const el of document.querySelectorAll('[data-thumb]')){try{const b=await getPhoto(el.dataset.thumb);if(b&&el.isConnected){el.innerHTML=`<img class="thumbimg" alt="Receipt photo" src="${URL.createObjectURL(b)}">`;const bt=el.parentElement.querySelector('[data-rphoto]');if(bt)bt.textContent='Replace photo'}}catch(e){return}}}

/* ================= SAVINGS ================= */
function vSavings(){
  let h='',i=0;const sm=savedSince(monthStart()),all=savedSince(0);
  h+=`<div ${rv(i++)}><p class="lede" style="margin:0">Saved this month</p><div class="big">${money(sm)}</div><p class="muted">${money(all)} in total, from paying less than the time before. Only real prices you recorded count.</p></div>`;
  const m=[5,4,3,2,1,0].map(o=>({o,l:new Date(monthStart(o)).toLocaleDateString(undefined,{month:'short'}),v:spent(monthStart(o),o?monthStart(o-1):now()+DAY)}));
  const mx=Math.max(...m.map(x=>x.v),1);
  h+=`<h2 ${rv(i++)}>Spending by month</h2><div class="card glass bars" ${rv(i++)}>${m.map(x=>`<div class="barr"><span>${x.l}</span><i class="${x.o?'':'now'}" style="width:${Math.max(1.5,x.v/mx*100)}%"></i><span>${money(x.v)}</span></div>`).join('')}</div>`;
  const keys=[...new Set(S.purchases.map(keyOf))];
  const changes=keys.map(k=>{const h=priced(k);return h.length>=2&&Math.abs(h[0].price-h[1].price)>.004?{k,a:h[1],b:h[0]}:null}).filter(Boolean);
  h+=`<h2 ${rv(i++)}>Price changes</h2><div class="card glass" ${rv(i++)}>${changes.length?changes.map(c=>`<div class="row" style="grid-template-columns:minmax(0,1fr) auto"><div><div class="nm" style="font-size:15px">${esc(c.b.code?title(P(c.b.code)):c.b.name)}</div><div class="sub">${money(c.a.price)} → ${money(c.b.price)}${c.b.store?' at '+esc(c.b.store):''}, ${dstr(c.b.t)}</div></div><span class="chip ${c.b.price<c.a.price?'good':'warn'}">${c.b.price<c.a.price?'−':'+'}${money(Math.abs(c.b.price-c.a.price))}</span></div>`).join(''):'<p class="muted" style="margin:0">Buy something twice with a price and changes show up here.</p>'}</div>`;
  const habits=keys.map(k=>{const all=S.purchases.filter(p=>keyOf(p)===k&&p.t>now()-60*DAY);const n=all.reduce((s,p)=>s+p.qty,0);const pr=priced(k);const cheap=[...pr].sort((a,b)=>a.price-b.price)[0];return {k,n,p:all[0],avg:pr.length?pr.reduce((s,x)=>s+x.price,0)/pr.length:null,cheap}}).filter(x=>x.n>=2).sort((a,b)=>b.n-a.n).slice(0,10);
  h+=`<h2 ${rv(i++)}>Your habits, last 60 days</h2><div class="card glass" ${rv(i++)}>${habits.length?habits.map(x=>`<div class="row" style="grid-template-columns:minmax(0,1fr) auto"><div><div class="nm" style="font-size:15px">${esc(x.p.code?title(P(x.p.code)):x.p.name)}</div><div class="sub">${x.avg!=null?'Average '+money(x.avg):'No prices yet'}${x.cheap?` · cheapest ${money(x.cheap.price)}${x.cheap.store?' at '+esc(x.cheap.store):''}`:''}</div></div><span class="chip">${x.n}×</span></div>`).join(''):'<p class="muted" style="margin:0">Habits appear once you buy something more than once.</p>'}</div>`;
  return h;
}

/* ================= settings & onboarding ================= */
function settings(){
  open(`<h1>Settings</h1><div class="field">Country<select id="sc">${Object.entries(COUNTRIES).sort((a,b)=>a[1][0].localeCompare(b[1][0])).map(([k,v])=>`<option value="${k}" ${k===S.country?'selected':''}>${esc(v[0])} (${v[1]})</option>`).join('')}</select></div>
   <div class="card glass"><label class="row" style="grid-template-columns:minmax(0,1fr) auto"><span>Add finished items to Pending automatically</span><input type="checkbox" id="sa" ${S.auto?'checked':''} style="width:24px;height:24px"></label>
   <label class="row" style="grid-template-columns:minmax(0,1fr) auto"><span>Show where you last bought items</span><input type="checkbox" id="sv" ${S.showAv?'checked':''} style="width:24px;height:24px"></label></div>
   <h2>Your stores</h2><div class="card glass">${S.stores.length?S.stores.map((s,ix)=>`<div class="row" style="grid-template-columns:minmax(0,1fr) auto"><span>${esc(s.name)}</span><button class="x" data-delstore="${ix}" aria-label="Remove ${esc(s.name)}">✕</button></div>`).join(''):'<p class="muted" style="margin:0">Stores you shop at appear here.</p>'}</div>
   <h2>Your data</h2><p class="muted">Everything stays on this phone.</p><div class="acts2"><button class="btn ghost" id="sx">Copy backup</button><button class="btn ghost" id="serase">Erase everything</button></div>
   <p class="small" style="margin-top:18px">Product info from Open Food Facts · Stores from OpenStreetMap · Recipes from TheMealDB</p>`);
  $('sc').onchange=()=>{S.country=$('sc').value;render()};$('sa').onchange=()=>{S.auto=$('sa').checked;save()};$('sv').onchange=()=>{S.showAv=$('sv').checked;render()};
  $('sx').onclick=async()=>{try{await navigator.clipboard.writeText(JSON.stringify(S));toast('Backup copied')}catch(e){toast('Couldn\'t copy on this browser')}};
  $('serase').onclick=()=>{const b=$('serase');if(b.dataset.sure){const c=S.country;S=blank();S.country=c;S.onboarded=true;close();render(true);toast('Everything erased')}else{b.dataset.sure=1;b.textContent='Tap again to erase';b.style.color='var(--amber)'}};
}
function onboard(){
  open(`<h1>Welcome to Larder</h1><p class="lede">Your list at the store, and everything you have at home, in one calm place.</p>
   <div class="field">Where do you shop?<select id="oc">${Object.entries(COUNTRIES).sort((a,b)=>a[1][0].localeCompare(b[1][0])).map(([k,v])=>`<option value="${k}" ${k===S.country?'selected':''}>${esc(v[0])}</option>`).join('')}</select></div>
   <div class="field">What do you need? One per line<textarea id="oi" rows="4" placeholder="Milk&#10;Eggs&#10;Bread"></textarea></div>
   <button class="btn" style="width:100%" id="ogo">Start</button>`,()=>{S.onboarded=true;save()});
  $('ogo').onclick=()=>{S.country=$('oc').value;$('oi').value.split('\n').forEach(addPending);S.onboarded=true;close();render(true)};
}

/* ================= events ================= */
$('nav').onclick=e=>{const b=e.target.closest('button');if(b)go(b.dataset.t)};
$('savepill').onclick=()=>go('savings');
$('gear').onclick=settings;
$('scrim').onclick=close;
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('sheet').hidden)close()});
$('tundo').onclick=()=>{if(undoFn){undoFn();undoFn=null;render()}$('toast').hidden=true};
$('file').onchange=async()=>{const f=$('file').files[0];$('file').value='';if(!f)return;toast('Reading barcode…');try{const c=await decodeImage(f);if(c){$('toast').hidden=true;lookup(c)}else toast('No barcode found. Try closer, in good light.')}catch(e){toast('Couldn\'t read that photo')}};
let photoKey=null;
$('rfile').onchange=async()=>{const f=$('rfile').files[0];$('rfile').value='';if(!f||!photoKey)return;try{await putPhoto(photoKey,f);render();toast('Receipt photo saved')}catch(e){toast('Couldn\'t save the photo')}};
document.addEventListener('submit',e=>{
  const id=e.target.id;
  if(id==='addf'){e.preventDefault();addPending($('addin').value);render();$('addin').focus()}
  if(id==='bcf'){e.preventDefault();lookup($('bcin').value)}
  if(id==='newp'){e.preventDefault();const name=$('np-n').value.trim(),size=+$('np-s').value,unit=$('np-u').value,type=guessType(name);
    S.products[scanState.code]={code:scanState.code,brand:$('np-b').value.trim(),name,label:size+' '+unit,size,unit,image:null,type,shape:guessShape(type,[],[],size,unit),storage:$('np-st').value.trim()||null,storageSrc:'Typed from the label by you',allergens:[],traces:[],ingredients:null,nutrition:[],nutriscore:null,categories:[],src:'You'};
    scanState.err=null;save();drawRes();toast('Product saved')}
});
document.addEventListener('input',e=>{
  if(e.target.id==='q'){S.q=e.target.value;const pos=e.target.selectionStart;render();const q=$('q');q.focus();try{q.setSelectionRange(pos,pos)}catch(_){}}
  if(e.target.id==='shelf'){scanState.shelf=e.target.value;const b=$('insbox');if(b)b.innerHTML=insHtml()}
});
document.addEventListener('change',e=>{if(e.target.id==='ss'){const v=e.target.value.trim();if(v){rememberStore(v);save();const b=$('insbox');if(b)b.innerHTML=insHtml()}}});
document.addEventListener('click',e=>{
  const t=e.target.closest('button,[data-go]');if(!t)return;const d=t.dataset;
  if('close' in d)close();
  if(d.go)go(d.go);
  if(d.seg){seg=d.seg;render()}
  if(d.collect)collectSheet(d.collect);
  if(d.q){const x=S.pending.find(y=>y.id===d.q);if(x){x.qty=Math.max(1,x.qty+ +d.d);render()}}
  if(d.qc){const x=S.collected.find(y=>y.id===d.qc);if(x){x.qty=Math.max(1,x.qty+ +d.d);const pu=S.purchases.find(p=>p.id===x.pid);if(pu)pu.qty=x.qty;render()}}
  if(d.delp){const i=S.pending.findIndex(y=>y.id===d.delp),x=S.pending[i];S.pending.splice(i,1);render();toast('Deleted',()=>S.pending.splice(i,0,x))}
  if(d.delc){const x=S.collected.find(y=>y.id===d.delc);S.collected=S.collected.filter(y=>y!==x);S.purchases=S.purchases.filter(p=>p.id!==x.pid);S.pending.unshift({id:uid(),code:x.code,name:x.name,qty:x.qty});render();toast('Moved back to Pending')}
  if(d.away)awaySheet([d.away]);
  if('awayall' in d){const known=S.collected.filter(x=>P(x.code)&&P(x.code).size).map(x=>x.id);awaySheet(known.length?known:[S.collected[0].id])}
  if(d.loc){$('al').value=d.loc}
  if(d.setstore){const inp=$(d.target);if(inp){inp.value=d.setstore;rememberStore(d.setstore,d.osm);if(d.target==='ss'){save();const b=$('insbox');if(b)b.innerHTML=insHtml()}}}
  if(d.near){findNear(d.near)}
  if(d.det)detail(d.det);
  if(d.unlog){const it=S.home.find(x=>x.id===d.unlog);const l=it&&it.logs.pop();if(l){it.rem=Math.min(it.total,it.rem+l.a);save();render();refreshDetail(it);toast('Undone')}}
  if(d.finish){const it=S.home.find(x=>x.id===d.finish);if(it){close();finished(it)}}
  if(d.addstorage){const p=P(d.addstorage);open(`<h1>Storage from the label</h1><p class="lede">Type exactly what the package says.</p><form id="stf"><div class="field">Label text<input type="text" id="stt" placeholder="e.g. Refrigerate after opening" required></div><button class="btn" style="width:100%">Save</button></form>`);$('stf').onsubmit=ev=>{ev.preventDefault();p.storage=$('stt').value.trim();p.storageSrc='Typed from the label by you';save();close();render();toast('Saved')}}
  if(t.id==='camgo')camera();
  if(t.id==='photo')$('file').click();
  if('retry' in d)lookup(scanState.code);
  if(d.buy){collectScanned(+d.buy)}
  if('skip' in d){scanState.code=null;drawRes();toast('Skipped. You have enough at home')}
  if('topend' in d){const code=scanState.code,p=P(code);const g=S.pending.find(x=>!x.code&&p.type&&x.name.toLowerCase().includes(p.type));if(g){g.code=code;delete g.name}else if(!S.pending.some(x=>x.code===code))S.pending.unshift({id:uid(),code,qty:1});scanState.code=null;save();drawRes();toast('Added to Pending')}
  if(d.rview)recipeView(+d.rview);
  if(d.rmade){madeSheet(+d.rmade)}
  if(d.rmiss){const r=recState.items[+d.rmiss];r.ings.filter(g=>!g.have).forEach(g=>addPending(g.name));close();render();toast('Missing ingredients added to Pending')}
  if(d.rphoto){photoKey=d.rphoto;$('rfile').click()}
  if(d.delpur){const i=S.purchases.findIndex(p=>p.id===d.delpur),p=S.purchases[i];S.purchases.splice(i,1);render();toast('Removed from receipts',()=>S.purchases.splice(i,0,p))}
  if(d.delstore){S.stores.splice(+d.delstore,1);save();settings()}
});
window.addEventListener('hashchange',()=>{const t=location.hash.slice(1);if(t&&t!==tab&&['list','home','scan','recipes','receipts','savings'].includes(t))go(t)});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&stopCam){stopCam();stopCam=null;if(tab==='scan')render()}});

render(true);
if(!S.onboarded)setTimeout(onboard,500);
if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('sw.js').catch(()=>{});
