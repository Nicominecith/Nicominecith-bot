const API = 'https://discord.com/api/v10';
export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

export async function userGuilds(token) {
  const r = await fetch(`${API}/users/@me/guilds`, { headers: { authorization: `Bearer ${token}` } });
  if (!r.ok) return [];
  const all = await r.json();
  return all.filter((g) => g.owner || (BigInt(g.permissions) & 0x20n) || (BigInt(g.permissions) & 0x8n));
}
export async function botGuildIds() {
  const r = await fetch(`${API}/users/@me/guilds?limit=200`, { headers: { authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` } });
  return r.ok ? new Set((await r.json()).map((g) => g.id)) : new Set();
}
export async function registerCommands(guildId, commands) {
  return fetch(`${API}/applications/${process.env.DISCORD_CLIENT_ID}/guilds/${guildId}/commands`, {
    method: 'PUT',
    headers: { authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(commands),
  });
}
export { API };
