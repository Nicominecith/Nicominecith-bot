import { getStore } from '@netlify/blobs';
import { json } from '../lib/discord.js';
export default async (req) => {
  const g = new URL(req.url).searchParams.get('guild');
  if (!g) return json([], 400);
  const d = (await getStore('xp').get(g, { type: 'json' })) || {};
  return json(Object.values(d).sort((a, b) => b.xp - a.xp).slice(0, 50).map((x) => ({ name: x.name, xp: x.xp, level: Math.floor(Math.sqrt(x.xp / 100)) })));
};
export const config = { path: '/api/leaderboard' };
