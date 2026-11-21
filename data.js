// Data sources: Open Food Facts (products), OpenStreetMap Overpass (stores), TheMealDB (recipes).
// Nothing here invents numbers: missing data comes back as null.

export const COUNTRIES = {
  US:['United States','USD'],CA:['Canada','CAD'],MX:['Mexico','MXN'],GT:['Guatemala','GTQ'],BZ:['Belize','BZD'],SV:['El Salvador','USD'],
  HN:['Honduras','HNL'],NI:['Nicaragua','NIO'],CR:['Costa Rica','CRC'],PA:['Panama','USD'],CU:['Cuba','CUP'],DO:['Dominican Republic','DOP'],
  JM:['Jamaica','JMD'],HT:['Haiti','HTG'],TT:['Trinidad and Tobago','TTD'],BS:['Bahamas','BSD'],BB:['Barbados','BBD'],PR:['Puerto Rico','USD'],
  CO:['Colombia','COP'],VE:['Venezuela','VES'],EC:['Ecuador','USD'],PE:['Peru','PEN'],BO:['Bolivia','BOB'],BR:['Brazil','BRL'],
  PY:['Paraguay','PYG'],UY:['Uruguay','UYU'],AR:['Argentina','ARS'],CL:['Chile','CLP'],GY:['Guyana','GYD'],SR:['Suriname','SRD'],
  GB:['United Kingdom','GBP'],IE:['Ireland','EUR'],FR:['France','EUR'],DE:['Germany','EUR'],ES:['Spain','EUR'],PT:['Portugal','EUR'],
  IT:['Italy','EUR'],NL:['Netherlands','EUR'],BE:['Belgium','EUR'],LU:['Luxembourg','EUR'],AT:['Austria','EUR'],CH:['Switzerland','CHF'],
  LI:['Liechtenstein','CHF'],MC:['Monaco','EUR'],DK:['Denmark','DKK'],NO:['Norway','NOK'],SE:['Sweden','SEK'],FI:['Finland','EUR'],
  IS:['Iceland','ISK'],PL:['Poland','PLN'],CZ:['Czechia','CZK'],SK:['Slovakia','EUR'],HU:['Hungary','HUF'],RO:['Romania','RON'],
  BG:['Bulgaria','EUR'],HR:['Croatia','EUR'],SI:['Slovenia','EUR'],RS:['Serbia','RSD'],BA:['Bosnia and Herzegovina','BAM'],ME:['Montenegro','EUR'],
  MK:['North Macedonia','MKD'],AL:['Albania','ALL'],GR:['Greece','EUR'],CY:['Cyprus','EUR'],MT:['Malta','EUR'],EE:['Estonia','EUR'],
  LV:['Latvia','EUR'],LT:['Lithuania','EUR'],UA:['Ukraine','UAH'],MD:['Moldova','MDL']
};

export function detectCountry(){
  const tags=[...(navigator.languages||[]),navigator.language||''];
  for(const t of tags){const m=/[-_]([A-Z]{2})$/i.exec(t);if(m&&COUNTRIES[m[1].toUpperCase()])return m[1].toUpperCase()}
  return 'US';
}

const fmtCache={};
export function money(n,country){
  if(n==null||isNaN(n))return '—';
  const c=(COUNTRIES[country]||COUNTRIES.US)[1];
  if(!fmtCache[c])fmtCache[c]=new Intl.NumberFormat(undefined,{style:'currency',currency:c});
  return fmtCache[c].format(n);
}

/* ---------- quantities ---------- */
const UNIT={ml:['ml',1],cl:['ml',10],dl:['ml',100],l:['ml',1000],lt:['ml',1000],ltr:['ml',1000],litre:['ml',1000],liter:['ml',1000],'fl oz':['ml',29.5735],floz:['ml',29.5735],
  g:['g',1],gr:['g',1],gram:['g',1],grams:['g',1],kg:['g',1000],oz:['g',28.3495],lb:['g',453.592],lbs:['g',453.592],
  pcs:['pcs',1],pc:['pcs',1],x:['pcs',1],ct:['pcs',1],count:['pcs',1],eggs:['pcs',1],pack:['pcs',1],units:['pcs',1]};
export function parseQty(str,num,unit){
  if(num&&unit){const u=UNIT[String(unit).toLowerCase()];if(u)return {size:+num*u[1],unit:u[0]}}
  if(!str)return null;
  const s=String(str).toLowerCase().replace(',', '.');
  const multi=/(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(fl\s?oz|ml|cl|dl|l|g|kg|oz|lb)\b/.exec(s);
  if(multi){const u=UNIT[multi[3].replace(/\s/,' ')]||UNIT[multi[3].replace(/\s/,'')];if(u)return {size:+multi[1]*+multi[2]*u[1],unit:u[0]}}
  const m=/(\d+(?:\.\d+)?)\s*(fl\s?oz|ml|cl|dl|ltr|litre|liter|lt|l|grams|gram|gr|g|kg|oz|lbs|lb|pcs|pc|ct|count|eggs|units|pack)\b/.exec(s);
  if(m){const k=m[2].replace(/\s+/,' ');const u=UNIT[k]||UNIT[k.replace(' ','')];if(u)return {size:+m[1]*u[1],unit:u[0]}}
  const n=/^\s*(\d+)\s*$/.exec(s);if(n)return {size:+n[1],unit:'pcs'};
  return null;
}
export function fmtAmt(v,u){
  if(v==null)return '—';v=Math.max(0,v);
  if(u==='pcs')return (Math.round(v*10)/10)+' pcs';
  if(v>=1000)return (Math.round(v/100)/10)+(u==='ml'?' L':' kg');
  return Math.round(v)+' '+u;
}

/* ---------- product type and shape ---------- */
const TYPES=['milk','egg','spinach','yogurt','yoghurt','cheddar','mozzarella','cheese','butter','cream','bread','tortilla','rice','pasta','spaghetti','penne','noodle','flour','sugar','olive oil','oil','vinegar',
 'tomato','chicken','beef','pork','fish','tuna','salmon','apple','banana','orange','lemon','potato','onion','garlic','carrot','lettuce','juice','water','coffee','tea','cereal','oats','honey','jam',
 'chocolate','beans','lentils','chickpeas','salt','pepper','ketchup','mayonnaise','mustard','soda','cola','biscuit','cookie','crackers','chips','ice cream','frozen'];
export function guessType(name,cats){
  const hay=' '+String(name||'').toLowerCase()+' ';
  for(const t of TYPES)if(hay.includes(' '+t))return t==='yoghurt'?'yogurt':t;
  const c=(cats||[]).map(x=>x.replace(/^\w\w:/,'').replace(/-/g,' ')).join(' | ');
  for(const t of TYPES)if(c.includes(t))return t==='yoghurt'?'yogurt':t;
  const w=String(name||'').trim().split(/\s+/).pop();return (w||'item').toLowerCase();
}
export const SHAPES=['carton','jug','bottle','tub','jar','can','box','bag'];
export function guessShape(type,cats,pack,size,unit){
  const t=' '+[type,(cats||[]).join(' '),(pack||[]).join(' ')].join(' ').toLowerCase();
  const has=w=>t.includes(w);
  if(has('can')&&(has('canned')||has('en:can')||has('metal')))return 'can';
  if(has('egg'))return 'box';
  if(has('milk')||has('cream')||has('juice'))return unit==='ml'&&size>=1500?'jug':'carton';
  if(has('oil')||has('vinegar')||has('sauce')||has('water')||has('soda')||has('beverage')||has('ketchup'))return 'bottle';
  if(has('yogurt')||has('ice cream')||has('butter')||has('spread')||has('margarine'))return 'tub';
  if(has('jam')||has('honey')||has('pickle')||has('mayonnaise')||has('mustard')||has('jar'))return 'jar';
  if(has('pasta')||has('cereal')||has('tea')||has('cracker')||has('biscuit')||has('cookie'))return 'box';
  return 'bag';
}

/* ---------- Open Food Facts ---------- */
const OFF_FIELDS='code,product_name,product_name_en,generic_name,brands,quantity,product_quantity,product_quantity_unit,image_front_url,image_front_small_url,categories_tags,allergens_tags,traces_tags,conservation_conditions,conservation_conditions_en,packaging_tags,ingredients_text,ingredients_text_en,nutriments,nutriscore_grade,labels';
export async function lookupProduct(code){
  const r=await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`);
  if(r.status===404)return null;
  if(!r.ok)throw new Error('lookup failed');
  const j=await r.json();
  if(j.status!==1||!j.product)return null;
  const p=j.product,name=p.product_name_en||p.product_name||p.generic_name||'';
  const q=parseQty(p.quantity,p.product_quantity,p.product_quantity_unit);
  const type=guessType(name,p.categories_tags);
  const nm=p.nutriments||{};
  const nut=[['Energy','energy-kcal_100g','kcal'],['Fat','fat_100g','g'],['Saturated fat','saturated-fat_100g','g'],['Carbohydrates','carbohydrates_100g','g'],['Sugars','sugars_100g','g'],['Protein','proteins_100g','g'],['Salt','salt_100g','g'],['Fibre','fiber_100g','g']]
    .filter(([, k])=>nm[k]!=null).map(([l,k,u])=>[l,Math.round(nm[k]*10)/10+' '+u]);
  const clean=a=>(a||[]).map(x=>x.replace(/^\w\w:/,'').replace(/-/g,' ')).filter(Boolean);
  return {
    code:String(code),name:name.trim()||'Unnamed product',brand:(p.brands||'').split(',')[0].trim(),label:p.quantity||'',
    size:q?q.size:null,unit:q?q.unit:null,image:p.image_front_url||p.image_front_small_url||null,
    type,shape:guessShape(type,p.categories_tags,p.packaging_tags,q&&q.size,q&&q.unit),
    storage:(p.conservation_conditions_en||p.conservation_conditions||'').trim()||null,
    allergens:clean(p.allergens_tags),traces:clean(p.traces_tags),
    ingredients:(p.ingredients_text_en||p.ingredients_text||'').trim()||null,nutrition:nut,
    nutriscore:p.nutriscore_grade&&/^[a-e]$/.test(p.nutriscore_grade)?p.nutriscore_grade.toUpperCase():null,
    categories:clean(p.categories_tags).slice(-3),src:'Open Food Facts'
  };
}

/* ---------- OpenStreetMap stores ---------- */
const SHOP_KINDS='supermarket|convenience|grocery|greengrocer|butcher|bakery|deli|department_store|wholesale|general|health_food|organic|frozen_food|dairy|seafood|farm|variety_store|kiosk|cheese|spices|pastry|beverages|food';
export function here(){
  return new Promise((ok,no)=>{if(!navigator.geolocation)return no(new Error('No location on this device'));
    navigator.geolocation.getCurrentPosition(p=>ok({lat:p.coords.latitude,lon:p.coords.longitude}),e=>no(e),{enableHighAccuracy:false,timeout:12000,maximumAge:300000})});
}
function dist(a,b,c,d){const R=6371e3,r=x=>x*Math.PI/180,x=r(c-a),y=r(d-b),h=Math.sin(x/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(y/2)**2;return 2*R*Math.asin(Math.sqrt(h))}
export async function nearbyStores(pos,radius=3000){
  const q=`[out:json][timeout:25];nwr["shop"~"^(${SHOP_KINDS})$"](around:${radius},${pos.lat},${pos.lon});out center 150;`;
  const r=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',body:'data='+encodeURIComponent(q),headers:{'Content-Type':'application/x-www-form-urlencoded'}});
  if(!r.ok)throw new Error('store search failed');
  const j=await r.json();
  const seen=new Set();
  return j.elements.map(e=>{const t=e.tags||{},lat=e.lat??e.center?.lat,lon=e.lon??e.center?.lon;
      const name=t.name||t.brand;if(!name||lat==null)return null;
      return {id:'osm:'+e.type+'/'+e.id,name,brand:t.brand||null,kind:(t.shop||'').replace(/_/g,' '),street:[t['addr:housenumber'],t['addr:street']].filter(Boolean).join(' ')||null,lat,lon,m:Math.round(dist(pos.lat,pos.lon,lat,lon))}})
    .filter(Boolean).sort((a,b)=>a.m-b.m).filter(s=>{const k=s.name+'|'+Math.round(s.lat*1e3)+Math.round(s.lon*1e3);if(seen.has(k))return false;seen.add(k);return true});
}

/* ---------- TheMealDB recipes ---------- */
const MEAL='https://www.themealdb.com/api/json/v1/1/';
const ING_ALIAS={egg:'eggs',yogurt:'greek yogurt',cheddar:'cheddar cheese',tomato:'tomatoes',noodle:'noodles',bean:'beans','olive oil':'olive oil',potato:'potatoes',onion:'onion',carrot:'carrots',bread:'bread',cheese:'cheese'};
export async function recipesFor(type){
  const tries=[...new Set([ING_ALIAS[type],type,type.endsWith('s')?type.slice(0,-1):type+'s'].filter(Boolean))];
  for(const t of tries){
    const r=await fetch(MEAL+'filter.php?i='+encodeURIComponent(t.replace(/ /g,'_')));
    if(!r.ok)continue;const j=await r.json();
    if(j.meals&&j.meals.length)return j.meals.map(m=>({id:m.idMeal,name:m.strMeal,thumb:m.strMealThumb}));
  }
  return [];
}
const mealCache={};
export async function recipeDetail(id){
  if(mealCache[id])return mealCache[id];
  const r=await fetch(MEAL+'lookup.php?i='+encodeURIComponent(id));if(!r.ok)throw new Error('recipe failed');
  const m=(await r.json()).meals?.[0];if(!m)return null;
  const ings=[];for(let i=1;i<=20;i++){const n=(m['strIngredient'+i]||'').trim();if(n)ings.push({name:n,measure:(m['strMeasure'+i]||'').trim()})}
  return mealCache[id]={id,name:m.strMeal,thumb:m.strMealThumb,area:m.strArea,category:m.strCategory,steps:m.strInstructions||'',source:m.strSource||null,ings};
}
