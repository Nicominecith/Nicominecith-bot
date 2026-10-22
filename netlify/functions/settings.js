import { getStore } from '@netlify/blobs';
import { getSession } from '../lib/session.js';
import { json, userGuilds, registerCommands } from '../lib/discord.js';
import { load, clean } from '../lib/settings.js';

const RESERVED = ['ping', 'info', 'ban', 'kick', 'timeout', 'warn', 'warns', 'purge', 'rank', 'rolepanel', 'ticketpanel', 'giveaway', 'poll'];

export default async (req) => {
  const s = getSession(req);
  if (!s) return json({ error: 'login' }, 401);
  const guild = new URL(req.url).searchParams.get('guild');
  if (!guild || !(await userGuilds(s.token)).some((g) => g.id === guild)) return json({ error: 'forbidden' }, 403);
  if (req.method !== 'POST') return json(await load(guild));

  const body = await req.json();
  const seen = new Set();
  const commands = (body.commands || []).slice(0, 20).map((c) => ({
    name: String(c.name || '').toLowerCase().trim(),
    response: String(c.response || '').slice(0, 1800),
  })).filter((c) => /^[a-z0-9_-]{1,32}$/.test(c.name) && c.response && !RESERVED.includes(c.name) && !seen.has(c.name) && seen.add(c.name));
  const data = { ...clean(body), commands };
  await getStore('settings').setJSON(guild, data);
  const r = await registerCommands(guild, [
    { name: 'ping', description: 'Zeigt ob der Bot online ist', type: 1 },
    { name: 'info', description: 'Infos zum Nicominecith Bot', type: 1 },
    ...commands.map((c) => ({ name: c.name, description: 'Eigener Befehl', type: 1 })),
  ]);
  return json({ ok: r.ok, ...data });
};
export const config = { path: '/api/settings' };
