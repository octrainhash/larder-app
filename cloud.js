// Everything that talks to the Larder server (Supabase). The app works without it.
import {CONFIG} from './config.js';

let sb = null;
export const enabled = () => !!(CONFIG.supabaseUrl && CONFIG.supabaseKey && window.supabase);
export function client() {
  if (!sb && enabled()) sb = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey, {auth: {persistSession: true, detectSessionInUrl: true, flowType: 'pkce'}});
  return sb;
}
export async function currentUser() {
  const c = client(); if (!c) return null;
  const {data} = await c.auth.getSession();
  return data.session?.user || null;
}
export function onAuth(cb) { const c = client(); if (c) c.auth.onAuthStateChange((_e, s) => setTimeout(() => cb(s?.user || null), 0)); }
export async function signIn(email) {
  const {error} = await client().auth.signInWithOtp({email, options: {emailRedirectTo: location.origin + location.pathname}});
  if (error) throw error;
}
export async function signOut() { await client().auth.signOut(); }

/* ---- sync ---- */
export async function pull(uid) {
  const {data, error} = await client().from('user_state').select('state,updated_at').eq('user_id', uid).maybeSingle();
  if (error) throw error;
  return data;
}
let t = null;
export function pushState(uid, state) {
  clearTimeout(t);
  t = setTimeout(() => { client().from('user_state').upsert({user_id: uid, state, updated_at: new Date().toISOString()}).then(() => {}); }, 1500);
}
export async function getProfile(uid) {
  const {data} = await client().from('profiles').select('*').eq('user_id', uid).maybeSingle();
  return data;
}
export async function saveProfile(uid, p) {
  const {error} = await client().from('profiles').upsert({user_id: uid, ...p, updated_at: new Date().toISOString()});
  if (error) throw error;
}

/* ---- shared prices, stock and products ---- */
export async function report(r) {
  const u = await currentUser(); if (!u) return false;
  const {error} = await client().from('reports').insert({...r, reported_by: u.id});
  return !error;
}
export async function reportsFor(code, country) {
  const c = client(); if (!c) return [];
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const {data} = await c.from('reports').select('id,store_name,store_osm,lat,lon,price,currency,in_stock,created_at')
    .eq('code', code).eq('country', country).gte('created_at', since).order('created_at', {ascending: false}).limit(80);
  return data || [];
}
export async function sharedProduct(code) {
  const c = client(); if (!c) return null;
  const {data} = await c.from('shared_products').select('data').eq('code', code).maybeSingle();
  return data ? data.data : null;
}
export async function shareProduct(code, prod) {
  const u = await currentUser(); if (!u) return false;
  const {error} = await client().from('shared_products').upsert({code, data: prod, added_by: u.id}, {onConflict: 'code', ignoreDuplicates: true});
  return !error;
}

/* ---- push notifications ---- */
function key(b) { const p = '='.repeat((4 - b.length % 4) % 4), s = atob((b + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(s, c => c.charCodeAt(0)); }
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
export const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
export async function enablePush(uid) {
  if (!pushSupported()) throw new Error(isIOS() && !standalone() ? 'ios-home' : 'unsupported');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('denied');
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({userVisibleOnly: true, applicationServerKey: key(CONFIG.vapidPublicKey)});
  const j = sub.toJSON();
  const {error} = await client().from('push_subs').upsert({endpoint: j.endpoint, user_id: uid, p256dh: j.keys.p256dh, auth: j.keys.auth});
  if (error) throw error;
}
export async function disablePush() {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription();
  if (sub) { await client().from('push_subs').delete().eq('endpoint', sub.endpoint); await sub.unsubscribe(); }
}
export async function testNotify() {
  const {data, error} = await client().functions.invoke('notify', {body: {test: true}});
  if (error) throw error;
  return data;
}
