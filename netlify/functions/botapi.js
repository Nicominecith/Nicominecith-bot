import { getStore } from '@netlify/blobs';
import { json } from '../lib/discord.js';
import { load } from '../lib/settings.js';

export default async (req) => {
  if (!process.env.BOT_API_KEY || req.headers.get('authorization') !== `Bearer ${process.env.BOT_API_KEY}`) return json({ error: 'auth' }, 401);
  const u = new URL(req.url), g = u.searchParams.get('guild'), k = u.pathname.split('/').pop();
  if (!g) return json({ error: 'guild' }, 400);
  if (k === 'settings') return json(await load(g));
  if (!['xp', 'warns', 'giveaways', 'polls', 'stars'].includes(k)) return json({ error: 'unknown' }, 404);
  const store = getStore(k);
  const d = (await store.get(g, { type: 'json' })) || {};
  if (req.method === 'POST') {
    const b = await req.json();
    if (k === 'xp') for (const [id, v] of Object.entries(b.inc || {})) d[id] = { xp: (d[id]?.xp || 0) + v.xp, name: v.name };
    else if (k !== 'warns') { Object.assign(d, b.set || {}); if (b.del) delete d[b.del]; }
    else (d[b.user] ??= []).push({ reason: String(b.reason || '').slice(0, 300), mod: b.mod, t: Date.now() });
    await store.setJSON(g, d);
  }
  return json(d);
};
export const config = { path: ['/api/bot/settings', '/api/bot/xp', '/api/bot/warns', '/api/bot/giveaways', '/api/bot/polls', '/api/bot/stars'] };
