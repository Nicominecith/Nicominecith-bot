import { getSession } from '../lib/session.js';
import { json, userGuilds, API } from '../lib/discord.js';

export default async (req) => {
  const s = getSession(req);
  if (!s) return json({ error: 'login' }, 401);
  const g = new URL(req.url).searchParams.get('guild');
  if (!g || !(await userGuilds(s.token)).some((x) => x.id === g)) return json({ error: 'forbidden' }, 403);
  const h = { authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` };
  const [c, r] = await Promise.all([fetch(`${API}/guilds/${g}/channels`, { headers: h }), fetch(`${API}/guilds/${g}/roles`, { headers: h })]);
  const channels = c.ok ? (await c.json()).sort((a, b) => a.position - b.position).map((x) => ({ id: x.id, name: x.name, type: x.type })) : [];
  const roles = r.ok ? (await r.json()).filter((x) => x.name !== '@everyone' && !x.managed).sort((a, b) => b.position - a.position).map((x) => ({ id: x.id, name: x.name })) : [];
  return json({ channels, roles });
};
export const config = { path: '/api/meta' };
