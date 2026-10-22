import http from 'node:http';
import { setupPanels, panelCmds } from './panels.js';
import { setupExtras, extraCmds } from './extras.js';
import { Client, GatewayIntentBits as I, Partials, EmbedBuilder, PermissionFlagsBits as P, SlashCommandBuilder as SB } from 'discord.js';

const { BOT_TOKEN, SITE_URL, BOT_API_KEY, PORT } = process.env;
const H = { authorization: `Bearer ${BOT_API_KEY}`, 'content-type': 'application/json' };
const api = (path, body) => fetch(`${SITE_URL}/api/bot/${path}`, body ? { method: 'POST', headers: H, body: JSON.stringify(body) } : { headers: H }).then((r) => r.json());

const client = new Client({
  intents: [I.Guilds, I.GuildMembers, I.GuildMessages, I.MessageContent, I.GuildMessageReactions],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User],
});

const cache = new Map();
setupPanels(client, (g) => cfg(g));
setupExtras(client, (g) => cfg(g), api);
async function cfg(g) {
  const c = cache.get(g);
  if (c && Date.now() - c.t < 60000) return c.v;
  try { const v = await api(`settings?guild=${g}`); cache.set(g, { t: Date.now(), v }); return v; } catch { return c?.v || {}; }
}
const fmt = (s, m) => String(s).replaceAll('{user.mention}', `<@${m.id}>`).replaceAll('{user.name}', m.user.username).replaceAll('{user.id}', m.id)
  .replaceAll('{server.name}', m.guild.name).replaceAll('{server.member_count}', m.guild.memberCount);
const chan = (g, id) => (id ? g.channels.cache.get(id) : null);
async function log(g, c, e) { const ch = chan(g, c.logs?.channel); if (ch?.isTextBased()) ch.send({ embeds: [e.setTimestamp()] }).catch(() => {}); }

// ---------- Mitglieder ----------
client.on('guildMemberAdd', async (m) => {
  const c = await cfg(m.guild.id), w = c.welcome || {};
  if (w.on) {
    const ch = chan(m.guild, w.channel);
    if (ch && w.message) ch.send(fmt(w.message, m)).catch(() => {});
    if (w.dm) m.send(fmt(w.dm, m)).catch(() => {});
    const role = m.user.bot ? w.botrole : w.autorole;
    if (role) m.roles.add(role).catch(() => {});
  }
  log(m.guild, c, new EmbedBuilder().setColor(0x57f287).setTitle('Mitglied beigetreten').setDescription(`${m.user.tag} (${m.id})`));
});
client.on('guildMemberRemove', async (m) => {
  const c = await cfg(m.guild.id), w = c.welcome || {};
  if (w.on && w.leave) chan(m.guild, w.channel)?.send(fmt(w.leave, m)).catch(() => {});
  log(m.guild, c, new EmbedBuilder().setColor(0xed4245).setTitle('Mitglied gegangen').setDescription(`${m.user.tag} (${m.id})`));
});

// ---------- Logs ----------
client.on('messageDelete', async (msg) => {
  if (!msg.guild || msg.author?.bot) return;
  log(msg.guild, await cfg(msg.guild.id), new EmbedBuilder().setColor(0xed4245).setTitle('Nachricht gelöscht')
    .setDescription(`${msg.author ? msg.author.tag : 'Unbekannt'} in <#${msg.channelId}>\n${(msg.content || '(kein Text)').slice(0, 1500)}`));
});
client.on('messageUpdate', async (o, n) => {
  if (!n.guild || n.author?.bot || o.content === n.content) return;
  log(n.guild, await cfg(n.guild.id), new EmbedBuilder().setColor(0xfee75c).setTitle('Nachricht bearbeitet')
    .setDescription(`${n.author?.tag} in <#${n.channelId}>\n**Vorher:** ${(o.content || '?').slice(0, 900)}\n**Nachher:** ${(n.content || '?').slice(0, 900)}`));
});

// ---------- Warns / Strafen ----------
async function addWarn(g, user, mod, reason) {
  const d = await api(`warns?guild=${g.id}`, { user, mod, reason });
  return (d[user] || []).length;
}
async function punish(m, c, n, reason) {
  const a = c.automod || {};
  if (n < (a.warnLimit || 3)) return;
  if (a.action === 'ban') m.ban({ reason }).catch(() => {});
  else if (a.action === 'kick') m.kick(reason).catch(() => {});
  else m.timeout(10 * 60 * 1000, reason).catch(() => {});
}

// ---------- AutoMod + Leveling ----------
const spam = new Map(), xpCool = new Map(), xpCache = new Map(), pending = new Map();
client.on('messageCreate', async (msg) => {
  if (!msg.guild || msg.author.bot || !msg.member) return;
  const c = await cfg(msg.guild.id), a = c.automod || {};
  if (!msg.member.permissions.has(P.ManageMessages)) {
    const t = msg.content || '';
    let why = null;
    if (a.invite && /(discord\.gg|discord(app)?\.com\/invite)\//i.test(t)) why = 'Invite-Link';
    else if (a.caps > 0 && t.length >= 8 && (t.replace(/[^A-ZÄÖÜ]/g, '').length / t.replace(/[^A-Za-zÄÖÜäöü]/g, '').length) * 100 >= a.caps) why = 'Zu viele Großbuchstaben';
    else if (a.mentions > 0 && msg.mentions.users.size >= a.mentions) why = 'Mass-Mention';
    else if (a.badwords && a.badwords.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean).some((w) => t.toLowerCase().includes(w))) why = 'Verbotenes Wort';
    else if (a.spam) {
      const k = msg.guild.id + msg.author.id, arr = (spam.get(k) || []).filter((x) => Date.now() - x < 5000);
      arr.push(Date.now()); spam.set(k, arr);
      if (arr.length >= 5) why = 'Spam';
    }
    if (why) {
      msg.delete().catch(() => {});
      msg.channel.send(`${msg.author}, ${why} ist hier nicht erlaubt.`).then((x) => setTimeout(() => x.delete().catch(() => {}), 5000)).catch(() => {});
      const n = await addWarn(msg.guild, msg.author.id, client.user.id, `AutoMod: ${why}`);
      log(msg.guild, c, new EmbedBuilder().setColor(0xe67e22).setTitle('AutoMod').setDescription(`${msg.author.tag}: ${why} (Warn ${n})`));
      return punish(msg.member, c, n, `AutoMod: ${why}`);
    }
  }
  const l = c.leveling;
  if (!l?.on) return;
  const k = msg.guild.id + msg.author.id;
  if (Date.now() - (xpCool.get(k) || 0) < l.cooldown * 1000) return;
  xpCool.set(k, Date.now());
  if (!xpCache.has(msg.guild.id)) xpCache.set(msg.guild.id, await api(`xp?guild=${msg.guild.id}`));
  const tbl = xpCache.get(msg.guild.id), gain = l.min + Math.floor(Math.random() * Math.max(1, l.max - l.min + 1));
  const old = tbl[msg.author.id]?.xp || 0, now = old + gain;
  tbl[msg.author.id] = { xp: now, name: msg.author.username };
  const p = pending.get(msg.guild.id) || {};
  p[msg.author.id] = { xp: (p[msg.author.id]?.xp || 0) + gain, name: msg.author.username };
  pending.set(msg.guild.id, p);
  const lv = (x) => Math.floor(Math.sqrt(x / 100));
  if (lv(now) > lv(old)) {
    msg.channel.send(`🎉 ${msg.author} ist jetzt Level **${lv(now)}**!`).catch(() => {});
    for (const r of (l.rewards || '').split(',')) {
      const [lvl, role] = r.split(':').map((x) => x?.trim());
      if (role && lv(now) >= Number(lvl)) msg.member.roles.add(role).catch(() => {});
    }
  }
});
setInterval(async () => {
  for (const [g, inc] of pending) { pending.delete(g); api(`xp?guild=${g}`, { inc }).catch(() => {}); }
}, 60000);

// ---------- Slash-Befehle ----------
const user = (b) => b.addUserOption((o) => o.setName('user').setDescription('Mitglied').setRequired(true));
const cmds = [
  user(new SB().setName('ban').setDescription('Mitglied bannen').setDefaultMemberPermissions(P.BanMembers)).addStringOption((o) => o.setName('grund').setDescription('Grund')),
  user(new SB().setName('kick').setDescription('Mitglied kicken').setDefaultMemberPermissions(P.KickMembers)).addStringOption((o) => o.setName('grund').setDescription('Grund')),
  user(new SB().setName('timeout').setDescription('Mitglied stummschalten').setDefaultMemberPermissions(P.ModerateMembers)).addIntegerOption((o) => o.setName('minuten').setDescription('Minuten').setRequired(true)),
  user(new SB().setName('warn').setDescription('Mitglied verwarnen').setDefaultMemberPermissions(P.ModerateMembers)).addStringOption((o) => o.setName('grund').setDescription('Grund').setRequired(true)),
  user(new SB().setName('warns').setDescription('Verwarnungen anzeigen').setDefaultMemberPermissions(P.ModerateMembers)),
  new SB().setName('purge').setDescription('Nachrichten löschen').setDefaultMemberPermissions(P.ManageMessages).addIntegerOption((o) => o.setName('anzahl').setDescription('1-100').setRequired(true).setMinValue(1).setMaxValue(100)),
  new SB().setName('rank').setDescription('Dein Level anzeigen'),
].map((c) => c.toJSON());

client.on('interactionCreate', async (i) => {
  if (!i.isChatInputCommand() || !i.guild || ['rolepanel', 'ticketpanel', 'giveaway', 'poll'].includes(i.commandName)) return;
  const g = i.guild, n = i.commandName, u = i.options.getUser('user'), reason = i.options.getString('grund') || 'Kein Grund';
  const ok = (t, eph = true) => i.reply({ content: t, ephemeral: eph, allowedMentions: { parse: [] } });
  try {
    if (n === 'ping') return ok('🏓 Pong!', false);
    if (n === 'info') return ok('🤖 **Nicominecith Bot** – kostenlos, mit Dashboard.', false);
    if (n === 'ban') { await g.members.ban(u, { reason }); return ok(`🔨 ${u.tag} gebannt.`, false); }
    if (n === 'kick') { await (await g.members.fetch(u.id)).kick(reason); return ok(`👢 ${u.tag} gekickt.`, false); }
    if (n === 'timeout') { await (await g.members.fetch(u.id)).timeout(i.options.getInteger('minuten') * 60000); return ok(`🔇 ${u.tag} stummgeschaltet.`, false); }
    if (n === 'warn') {
      const c = await cfg(g.id), cnt = await addWarn(g, u.id, i.user.id, reason);
      await ok(`⚠️ ${u.tag} verwarnt (Warn ${cnt}).`, false);
      return punish(await g.members.fetch(u.id), c, cnt, reason);
    }
    if (n === 'warns') {
      const w = (await api(`warns?guild=${g.id}`))[u.id] || [];
      return ok(w.length ? w.map((x, k) => `${k + 1}. ${x.reason} (<t:${Math.floor(x.t / 1000)}:d>)`).join('\n') : 'Keine Verwarnungen.');
    }
    if (n === 'purge') { const d = await i.channel.bulkDelete(i.options.getInteger('anzahl'), true); return ok(`🧹 ${d.size} Nachrichten gelöscht.`); }
    if (n === 'rank') {
      const d = (await api(`xp?guild=${g.id}`))[i.user.id]?.xp || 0;
      return ok(`Level **${Math.floor(Math.sqrt(d / 100))}** · ${d} XP`);
    }
    const cmd = (await cfg(g.id)).commands?.find((x) => x.name === n);
    return ok(cmd ? cmd.response : 'Unbekannter Befehl.', false);
  } catch (e) { return (i.replied ? i.followUp : i.reply).call(i, { content: 'Fehler: fehlende Rechte?', ephemeral: true }).catch(() => {}); }
});

client.once('ready', async () => {
  await client.application.commands.set([...cmds, ...panelCmds, ...extraCmds]);
  console.log(`Online als ${client.user.tag}`);
});
http.createServer((_, r) => r.end('ok')).listen(PORT || 3000);
client.login(BOT_TOKEN);
