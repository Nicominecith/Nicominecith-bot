import { getSession } from '../lib/session.js';
import { json } from '../lib/discord.js';
export default async (req) => {
  const s = getSession(req);
  const base = { clientId: process.env.DISCORD_CLIENT_ID };
  return s ? json({ ...base, user: { id: s.id, name: s.name, avatar: s.avatar } }) : json(base, 401);
};
export const config = { path: '/api/me' };
