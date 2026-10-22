import crypto from 'node:crypto';
import { getStore } from '@netlify/blobs';

const SPKI = '302a300506032b6570032100';
function valid(req, body) {
  const sig = req.headers.get('x-signature-ed25519'), ts = req.headers.get('x-signature-timestamp');
  if (!sig || !ts) return false;
  try {
    const key = crypto.createPublicKey({ key: Buffer.from(SPKI + process.env.DISCORD_PUBLIC_KEY, 'hex'), format: 'der', type: 'spki' });
    return crypto.verify(null, Buffer.from(ts + body), key, Buffer.from(sig, 'hex'));
  } catch { return false; }
}
const reply = (content) => new Response(JSON.stringify({ type: 4, data: { content, allowed_mentions: { parse: [] } } }), { headers: { 'content-type': 'application/json' } });

export default async (req) => {
  const body = await req.text();
  if (!valid(req, body)) return new Response('invalid signature', { status: 401 });
  const i = JSON.parse(body);
  if (i.type === 1) return new Response(JSON.stringify({ type: 1 }), { headers: { 'content-type': 'application/json' } });
  if (i.type === 2) {
    const name = i.data.name;
    if (name === 'ping') return reply('🏓 Pong! Nicominecith Bot ist online.');
    if (name === 'info') return reply('🤖 **Nicominecith Bot** – kostenlos, mit Dashboard. Eigene Befehle stellst du im Dashboard ein.');
    const cfg = i.guild_id ? await getStore('settings').get(i.guild_id, { type: 'json' }) : null;
    const cmd = cfg?.commands?.find((c) => c.name === name);
    return reply(cmd ? cmd.response : 'Unbekannter Befehl.');
  }
  return new Response('ok');
};
export const config = { path: '/api/interactions' };
