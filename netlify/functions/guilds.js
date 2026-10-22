import { getSession } from '../lib/session.js';
import { json, userGuilds, botGuildIds } from '../lib/discord.js';
export default async (req) => {
  const s = getSession(req);
  if (!s) return json({ error: 'login' }, 401);
  const [mine, bot] = await Promise.all([userGuilds(s.token), botGuildIds()]);
  return json(mine.map((g) => ({ id: g.id, name: g.name, icon: g.icon, botIn: bot.has(g.id) })));
};
export const config = { path: '/api/guilds' };
