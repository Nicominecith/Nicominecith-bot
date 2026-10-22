import { getStore } from '@netlify/blobs';
export const DEFAULTS = {
  commands: [],
  welcome: { on: false, channel: '', message: 'Willkommen {user.mention} auf {server.name}!', leave: '', dm: '', autorole: '', botrole: '' },
  logs: { channel: '' },
  automod: { invite: false, spam: false, caps: 0, mentions: 0, badwords: '', warnLimit: 3, action: 'timeout' },
  starboard: { on: false, channel: '', emoji: '⭐', threshold: 3, selfstar: false },
  tickets: { category: '', supportRole: '', logChannel: '' },
  leveling: { on: false, cooldown: 60, min: 15, max: 25, rewards: '' },
};
export async function load(g) {
  const s = (await getStore('settings').get(g, { type: 'json' })) || {};
  const d = structuredClone(DEFAULTS);
  for (const k of Object.keys(d)) d[k] = k === 'commands' ? s.commands || [] : { ...d[k], ...(s[k] || {}) };
  return d;
}
export function clean(b) {
  const d = structuredClone(DEFAULTS);
  for (const k of Object.keys(d)) {
    if (k === 'commands' || !b[k]) continue;
    for (const f of Object.keys(d[k])) {
      const v = b[k][f], t = typeof d[k][f];
      if (v === undefined) continue;
      d[k][f] = t === 'boolean' ? !!v : t === 'number' ? Number(v) || 0 : String(v).slice(0, 1800);
    }
  }
  return d;
}
