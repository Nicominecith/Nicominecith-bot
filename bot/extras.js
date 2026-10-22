import { ActionRowBuilder as Row, ButtonBuilder as Btn, ButtonStyle as BS, EmbedBuilder, PermissionFlagsBits as P, SlashCommandBuilder as SB } from 'discord.js';

export const extraCmds = [
  new SB().setName('giveaway').setDescription('Gewinnspiele').setDefaultMemberPermissions(P.ManageGuild)
    .addSubcommand((s) => s.setName('start').setDescription('Gewinnspiel starten')
      .addStringOption((o) => o.setName('preis').setDescription('Preis').setRequired(true))
      .addIntegerOption((o) => o.setName('minuten').setDescription('Dauer in Minuten').setRequired(true).setMinValue(1).setMaxValue(43200))
      .addIntegerOption((o) => o.setName('gewinner').setDescription('Anzahl Gewinner').setMinValue(1).setMaxValue(10))
      .addRoleOption((o) => o.setName('rolle').setDescription('Benötigte Rolle')))
    .addSubcommand((s) => s.setName('end').setDescription('Gewinnspiel jetzt beenden')
      .addStringOption((o) => o.setName('nachricht').setDescription('Nachrichten-ID des Gewinnspiels').setRequired(true))),
  new SB().setName('poll').setDescription('Umfrage erstellen')
    .addStringOption((o) => o.setName('frage').setDescription('Frage').setRequired(true))
    .addStringOption((o) => o.setName('optionen').setDescription('2-5 Optionen, mit Komma getrennt').setRequired(true)),
].map((c) => c.toJSON());

const gwEmbed = (g) => new EmbedBuilder().setColor(g.ended ? 0x747f8d : 0xeb459e).setTitle(`🎉 ${g.prize}`).setDescription(g.ended
  ? `Beendet · Gewinner: ${g.winnerIds?.length ? g.winnerIds.map((w) => `<@${w}>`).join(', ') : 'niemand'}`
  : `Endet <t:${Math.floor(g.end / 1000)}:R>\nGewinner: **${g.winners}**${g.role ? `\nBenötigt: <@&${g.role}>` : ''}\nTeilnehmer: **${g.entrants.length}**`);

const pollEmbed = (p) => {
  const counts = p.options.map((_, k) => Object.values(p.votes).filter((v) => v === k).length), total = counts.reduce((a, b) => a + b, 0);
  return new EmbedBuilder().setColor(0x5865f2).setTitle(`📊 ${p.question}`).setFooter({ text: `${total} Stimmen` })
    .setDescription(p.options.map((o, k) => { const pc = total ? Math.round((counts[k] / total) * 100) : 0; return `**${o}**\n${'█'.repeat(Math.round(pc / 10))}${'░'.repeat(10 - Math.round(pc / 10))} ${counts[k]} (${pc}%)`; }).join('\n\n'));
};

export function setupExtras(client, cfg, api) {
  const data = { giveaways: new Map(), polls: new Map() }, stars = new Map();
  const persist = (kind, o) => api(`${kind}?guild=${o.guild}`, { set: { [o.id]: o } }).catch(() => {});

  client.once('ready', async () => {
    for (const g of client.guilds.cache.values()) for (const kind of ['giveaways', 'polls']) {
      try { for (const o of Object.values(await api(`${kind}?guild=${g.id}`))) data[kind].set(o.id, o); } catch {}
    }
  });

  async function endGiveaway(g) {
    g.ended = true;
    g.winnerIds = [...g.entrants].sort(() => Math.random() - 0.5).slice(0, g.winners);
    persist('giveaways', g);
    const ch = client.channels.cache.get(g.channel);
    (await ch?.messages.fetch(g.id).catch(() => null))?.edit({ embeds: [gwEmbed(g)], components: [] });
    ch?.send(g.winnerIds.length ? `🎉 Glückwunsch ${g.winnerIds.map((w) => `<@${w}>`).join(', ')}! Ihr habt **${g.prize}** gewonnen.` : `Niemand hat bei **${g.prize}** teilgenommen.`).catch(() => {});
  }
  setInterval(() => { for (const g of data.giveaways.values()) if (!g.ended && g.end <= Date.now()) endGiveaway(g); }, 15000);

  client.on('interactionCreate', async (i) => {
    try {
      if (!i.guild) return;
      if (i.isChatInputCommand() && i.commandName === 'giveaway') {
        if (i.options.getSubcommand() === 'end') {
          const g = data.giveaways.get(i.options.getString('nachricht'));
          if (!g || g.ended || g.guild !== i.guild.id) return i.reply({ content: 'Kein laufendes Gewinnspiel mit dieser ID.', ephemeral: true });
          await endGiveaway(g); return i.reply({ content: '✅ Beendet.', ephemeral: true });
        }
        const g = { guild: i.guild.id, channel: i.channelId, prize: i.options.getString('preis').slice(0, 200), end: Date.now() + i.options.getInteger('minuten') * 60000,
          winners: i.options.getInteger('gewinner') || 1, role: i.options.getRole('rolle')?.id || '', entrants: [], ended: false };
        const m = await i.channel.send({ embeds: [gwEmbed(g)], components: [new Row().addComponents(new Btn().setCustomId('gw:join').setLabel('Teilnehmen').setEmoji('🎉').setStyle(BS.Primary))] });
        g.id = m.id; data.giveaways.set(g.id, g); persist('giveaways', g);
        return i.reply({ content: `✅ Gestartet (ID: ${m.id})`, ephemeral: true });
      }
      if (i.isChatInputCommand() && i.commandName === 'poll') {
        const options = i.options.getString('optionen').split(',').map((x) => x.trim().slice(0, 80)).filter(Boolean).slice(0, 5);
        if (options.length < 2) return i.reply({ content: 'Mindestens 2 Optionen, mit Komma getrennt.', ephemeral: true });
        const p = { guild: i.guild.id, question: i.options.getString('frage').slice(0, 200), options, votes: {} };
        const m = await i.channel.send({ embeds: [pollEmbed(p)], components: [new Row().addComponents(options.map((o, k) => new Btn().setCustomId(`pl:${k}`).setLabel(o).setStyle(BS.Secondary)))] });
        p.id = m.id; data.polls.set(p.id, p); persist('polls', p);
        return i.reply({ content: '✅ Umfrage erstellt.', ephemeral: true });
      }
      if (!i.isButton()) return;
      const [t, a] = i.customId.split(':');
      if (t === 'gw') {
        const g = data.giveaways.get(i.message.id);
        if (!g || g.ended) return i.reply({ content: 'Dieses Gewinnspiel ist beendet.', ephemeral: true });
        if (g.role && !i.member.roles.cache.has(g.role)) return i.reply({ content: `Du brauchst die Rolle <@&${g.role}>.`, ephemeral: true, allowedMentions: { parse: [] } });
        g.entrants = g.entrants.includes(i.user.id) ? g.entrants.filter((x) => x !== i.user.id) : [...g.entrants, i.user.id];
        persist('giveaways', g);
        return i.update({ embeds: [gwEmbed(g)] });
      }
      if (t === 'pl') {
        const p = data.polls.get(i.message.id);
        if (!p) return i.reply({ content: 'Umfrage nicht mehr aktiv.', ephemeral: true });
        if (p.votes[i.user.id] === Number(a)) delete p.votes[i.user.id]; else p.votes[i.user.id] = Number(a);
        persist('polls', p);
        return i.update({ embeds: [pollEmbed(p)] });
      }
    } catch { if (!i.replied && !i.deferred) i.reply({ content: 'Fehler.', ephemeral: true }).catch(() => {}); }
  });

  // ---------- Starboard ----------
  async function starsOf(g) { if (!stars.has(g)) stars.set(g, await api(`stars?guild=${g}`).catch(() => ({}))); return stars.get(g); }
  async function star(r, u) {
    try {
      if (r.partial) r = await r.fetch();
      if (r.message.partial) await r.message.fetch();
      const m = r.message;
      if (!m.guild || u.bot) return;
      const c = (await cfg(m.guild.id)).starboard;
      if (!c?.on || !c.channel || (r.emoji.name !== c.emoji && r.emoji.toString() !== c.emoji)) return;
      if (m.channel.nsfw || m.channelId === c.channel) return;
      let n = r.count;
      if (!c.selfstar && (await r.users.fetch()).has(m.author.id)) n--;
      const s = await starsOf(m.guild.id), ch = m.guild.channels.cache.get(c.channel), ex = s[m.id], text = `${c.emoji} **${n}** | <#${m.channelId}>`;
      if (!ch) return;
      if (n >= (Number(c.threshold) || 3)) {
        if (ex) return void (await ch.messages.fetch(ex).catch(() => null))?.edit({ content: text });
        const img = [...m.attachments.values()].find((a) => a.contentType?.startsWith('image/'));
        const e = new EmbedBuilder().setColor(0xffac33).setAuthor({ name: m.author.tag, iconURL: m.author.displayAvatarURL() })
          .setDescription(`${m.content || '\u200b'}\n\n[Zur Nachricht](${m.url})`).setTimestamp(m.createdAt);
        if (img) e.setImage(img.url);
        const sm = await ch.send({ content: text, embeds: [e] });
        s[m.id] = sm.id; api(`stars?guild=${m.guild.id}`, { set: { [m.id]: sm.id } }).catch(() => {});
      } else if (ex) {
        (await ch.messages.fetch(ex).catch(() => null))?.delete().catch(() => {});
        delete s[m.id]; api(`stars?guild=${m.guild.id}`, { del: m.id }).catch(() => {});
      }
    } catch {}
  }
  client.on('messageReactionAdd', star);
  client.on('messageReactionRemove', star);
}
