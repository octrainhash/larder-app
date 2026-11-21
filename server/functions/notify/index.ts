// Larder reminders: push notifications and emails.
// Runs every hour (see cron.sql). Each person gets alerts once a day, around 9am their time.
// Also answers {"test":true} from a signed-in user with a test notification.
import {createClient} from 'npm:@supabase/supabase-js@2.45.4';
import webpush from 'npm:web-push@3.6.7';

const env = (k: string) => Deno.env.get(k) ?? '';
const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {auth: {persistSession: false}});
webpush.setVapidDetails(env('VAPID_SUBJECT') || 'mailto:hello@example.com', env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'));
const APP_URL = env('APP_URL') || 'https://octrainhash.github.io/larder-app/';
const cors = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info'};
const DAY = 864e5;

type Alert = {key: string; title: string; body: string};

function name(state: any, item: any) {
  const p = item.code && state.products?.[item.code];
  return p ? [p.brand, p.name].filter(Boolean).join(' ') : item.name;
}
function daysUntil(t: number, tz: string) {
  const f = (d: Date) => new Date(d.toLocaleString('en-US', {timeZone: tz || 'UTC'})).setHours(0, 0, 0, 0);
  return Math.round((f(new Date(t)) - f(new Date())) / DAY);
}

async function alertsFor(userId: string, state: any, tz: string): Promise<Alert[]> {
  const out: Alert[] = [];
  for (const it of state.home ?? []) {
    if (!it || it.rem <= 0) continue;
    if (it.exp) {
      const d = daysUntil(it.exp, tz), left = it.rem / it.total;
      if (d >= 0 && d <= 1 && left >= 0.3) out.push({key: `exp:${it.id}:${new Date(it.exp).toISOString().slice(0, 10)}`, title: `${name(state, it)} ${d === 0 ? 'expires today' : 'expires tomorrow'}`, body: `${Math.round(left * 100)}% is still left. Open Larder for recipes to use it up.`});
    }
    const logs = it.logs ?? [];
    if (logs.length >= 2) {
      const used = logs.reduce((s: number, l: any) => s + l.a, 0);
      const span = Math.max(1, (Date.now() - Math.min(it.added, ...logs.map((l: any) => l.t))) / DAY);
      const daysLeft = it.rem / (used / span);
      if (daysLeft <= 2) out.push({key: `out:${it.id}`, title: `Running low on ${name(state, it)}`, body: `About ${Math.max(0, Math.round(daysLeft))} day(s) left at your pace (estimate). Add it to your list?`});
    }
  }
  // price drops seen by other shoppers in the last day, for things this person buys
  const lastPaid: Record<string, number> = {};
  for (const p of [...(state.purchases ?? [])].sort((a: any, b: any) => a.t - b.t)) if (p.code && p.price != null) lastPaid[p.code] = p.price;
  const codes = Object.keys(lastPaid);
  if (codes.length) {
    const {data} = await db.from('reports').select('id,code,store_name,price,currency,created_at')
      .in('code', codes.slice(0, 200)).gte('created_at', new Date(Date.now() - DAY).toISOString()).not('price', 'is', null).neq('reported_by', userId);
    for (const r of data ?? []) {
      if (r.price < lastPaid[r.code] - 0.004) {
        const p = state.products?.[r.code];
        out.push({key: `drop:${r.id}`, title: `Price drop: ${p ? [p.brand, p.name].filter(Boolean).join(' ') : r.code}`, body: `${r.price} ${r.currency ?? ''} at ${r.store_name}, vs ${lastPaid[r.code]} you last paid. Seen by a shopper.`});
      }
    }
  }
  return out;
}

async function push(userId: string, title: string, body: string) {
  const {data: subs} = await db.from('push_subs').select('*').eq('user_id', userId);
  let sent = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification({endpoint: s.endpoint, keys: {p256dh: s.p256dh, auth: s.auth}}, JSON.stringify({title, body, url: APP_URL}));
      sent++;
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) await db.from('push_subs').delete().eq('endpoint', s.endpoint);
    }
  }
  return sent;
}

async function email(to: string, subject: string, alerts: Alert[]) {
  if (!env('RESEND_API_KEY') || !to) return false;
  const html = `<div style="font-family:Georgia,serif;color:#1d1419;max-width:520px;margin:auto;padding:24px">
    <h1 style="font-weight:600;font-size:28px;margin:0 0 16px">Larder</h1>
    ${alerts.map(a => `<div style="background:#f7f0f2;border-radius:16px;padding:14px 16px;margin:0 0 10px;font-family:Helvetica,Arial,sans-serif"><strong>${a.title}</strong><br><span style="color:#6f6268">${a.body}</span></div>`).join('')}
    <p style="font-family:Helvetica,Arial,sans-serif"><a href="${APP_URL}" style="color:#3b1d2c">Open Larder</a></p>
    <p style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#8a7a82">You get this because email reminders are on in Larder settings.</p></div>`;
  const r = await fetch('https://api.resend.com/emails', {method: 'POST', headers: {Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({from: env('EMAIL_FROM') || 'Larder <onboarding@resend.dev>', to: [to], subject, html})});
  return r.ok;
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', {headers: cors});
  const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), {status, headers: {...cors, 'Content-Type': 'application/json'}});

  // A signed-in user asking for a test notification
  const body = await req.json().catch(() => ({}));
  if (body?.test) {
    const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '');
    const {data: {user}} = await db.auth.getUser(token);
    if (!user) return json({error: 'Sign in first'}, 401);
    const {data: prof} = await db.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
    const a: Alert = {key: 'test', title: 'Larder notifications are on', body: "This is what a reminder looks like. We'll only send ones that matter."};
    const pushed = prof?.notify_push ? await push(user.id, a.title, a.body) : 0;
    const mailed = prof?.notify_email ? await email(prof.email ?? user.email ?? '', 'Larder: test reminder', [a]) : false;
    return json({pushed, mailed});
  }

  // The hourly run
  if (req.headers.get('x-cron-secret') !== env('CRON_SECRET') || !env('CRON_SECRET')) return json({error: 'forbidden'}, 403);
  const {data: profs} = await db.from('profiles').select('*').or('notify_push.eq.true,notify_email.eq.true');
  let users = 0;
  for (const prof of profs ?? []) {
    const hour = +new Date().toLocaleString('en-US', {timeZone: prof.tz || 'UTC', hour: 'numeric', hour12: false});
    if (hour !== 9 && !body?.force) continue;
    const {data: st} = await db.from('user_state').select('state').eq('user_id', prof.user_id).maybeSingle();
    if (!st) continue;
    const all = await alertsFor(prof.user_id, st.state, prof.tz);
    if (!all.length) continue;
    const {data: done} = await db.from('notif_log').select('key').eq('user_id', prof.user_id).in('key', all.map(a => a.key));
    const fresh = all.filter(a => !(done ?? []).some((d: any) => d.key === a.key));
    if (!fresh.length) continue;
    const title = fresh.length === 1 ? fresh[0].title : `${fresh.length} things in your larder need you`;
    const text = fresh.length === 1 ? fresh[0].body : fresh.map(a => a.title).join(' · ');
    if (prof.notify_push) await push(prof.user_id, title, text);
    if (prof.notify_email) await email(prof.email, title, fresh);
    await db.from('notif_log').insert(fresh.map(a => ({user_id: prof.user_id, key: a.key})));
    users++;
  }
  return json({users});
});
