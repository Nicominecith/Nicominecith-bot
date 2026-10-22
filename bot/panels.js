import { ActionRowBuilder as Row, ButtonBuilder as Btn, ButtonStyle as BS, EmbedBuilder, ChannelType, PermissionFlagsBits as P, SlashCommandBuilder as SB, AttachmentBuilder } from 'discord.js';

export const panelCmds = [
  new SB().setName('rolepanel').setDescription('Rollen-Panel mit Buttons erstellen').setDefaultMemberPermissions(P.ManageRoles)
    .addStringOption((o) => o.setName('rollen').setDescription('Name:RollenID, Name:RollenID (max. 20)').setRequired(true))
    .addStringOption((o) => o.setName('titel').setDescription('Titel des Panels'))
    .addStringOption((o) => o.setName('modus').setDescription('Wie Rollen vergeben werden').addChoices({ name: 'Toggle (beliebig viele)', value: 't' }, { name: 'Single (nur eine)', value: 's' })),
  new SB().setName('ticketpanel').setDescription('Ticket-Panel erstellen').setDefaultMemberPermissions(P.ManageGuild)
    .addStringOption((o) => o.setName('titel').setDescription('Titel des Panels')),
].map((c) => c.toJSON());

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

async function transcript(channel) {
  let all = [], before;
  for (let n = 0; n < 5; n++) {
    const b = await channel.messages.fetch({ limit: 100, before });
    if (!b.size) break;
    all.push(...b.values()); before = b.last().id;
  }
  all.reverse();
  const rows = all.map((m) => `<p><b>${esc(m.author.tag)}</b> <small>${m.createdAt.toISOString()}</small><br>${esc(m.content)}${[...m.attachments.values()].map((a) => `<br><a href="${esc(a.url)}">${esc(a.name)}</a>`).join('')}</p>`).join('');
  return Buffer.from(`<!DOCTYPE html><meta charset="utf-8"><title>${esc(channel.name)}</title><body style="font-family:sans-serif;background:#313338;color:#eee;max-width:800px;margin:auto"><h2>#${esc(channel.name)}</h2>${rows}</body>`);
}

export function setupPanels(client, cfg) {
  client.on('interactionCreate', async (i) => {
    try {
      if (!i.guild) return;
      if (i.isChatInputCommand() && i.commandName === 'rolepanel') {
        const roles = i.options.getString('rollen').split(',').slice(0, 20).map((x) => { const k = x.lastIndexOf(':'); return [x.slice(0, k).trim().slice(0, 80), x.slice(k + 1).trim()]; })
          .filter(([n, id]) => n && /^\d{15,25}$/.test(id));
        if (!roles.length) return i.reply({ content: 'Format: `Name:RollenID, Name:RollenID`', ephemeral: true });
        const mode = i.options.getString('modus') || 't', rows = [];
        for (let k = 0; k < roles.length; k += 5) rows.push(new Row().addComponents(roles.slice(k, k + 5).map(([n, id]) => new Btn().setCustomId(`rr:${mode}:${id}`).setLabel(n).setStyle(BS.Secondary))));
        await i.channel.send({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle(i.options.getString('titel') || 'Rollen').setDescription(mode === 's' ? 'Wähle eine Rolle.' : 'Klicke, um Rollen zu erhalten oder zu entfernen.')], components: rows });
        return i.reply({ content: '✅ Panel erstellt.', ephemeral: true });
      }
      if (i.isChatInputCommand() && i.commandName === 'ticketpanel') {
        await i.channel.send({ embeds: [new EmbedBuilder().setColor(0x57f287).setTitle(i.options.getString('titel') || '🎫 Support').setDescription('Klicke auf den Button, um ein Ticket zu öffnen.')],
          components: [new Row().addComponents(new Btn().setCustomId('tk:open').setLabel('Ticket erstellen').setEmoji('🎫').setStyle(BS.Success))] });
        return i.reply({ content: '✅ Panel erstellt.', ephemeral: true });
      }
      if (!i.isButton()) return;
      const [t, a, b] = i.customId.split(':');

      if (t === 'rr') {
        const m = i.member;
        if (a === 's') {
          const others = i.message.components.flatMap((r) => r.components).map((c) => c.customId.split(':')[2]).filter((x) => x !== b);
          await m.roles.remove(others.filter((x) => m.roles.cache.has(x)));
        }
        const has = m.roles.cache.has(b);
        await (has ? m.roles.remove(b) : m.roles.add(b));
        return i.reply({ content: has ? `➖ <@&${b}> entfernt.` : `➕ <@&${b}> erhalten.`, ephemeral: true, allowedMentions: { parse: [] } });
      }

      if (t === 'tk') {
        const c = (await cfg(i.guild.id)).tickets || {};
        const staff = (m) => m.permissions.has(P.ManageChannels) || (c.supportRole && m.roles.cache.has(c.supportRole));
        if (a === 'open') {
          const ex = i.guild.channels.cache.find((ch) => ch.topic === `ticket:${i.user.id}`);
          if (ex) return i.reply({ content: `Du hast schon ein Ticket: ${ex}`, ephemeral: true });
          const allow = [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles];
          const ch = await i.guild.channels.create({
            name: `ticket-${i.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 90) || 'ticket',
            type: ChannelType.GuildText, topic: `ticket:${i.user.id}`, parent: c.category || null,
            permissionOverwrites: [
              { id: i.guild.id, deny: [P.ViewChannel] },
              { id: i.user.id, allow },
              { id: client.user.id, allow: [...allow, P.ManageChannels] },
              ...(c.supportRole ? [{ id: c.supportRole, allow }] : []),
            ],
          });
          await ch.send({ content: `${i.user}${c.supportRole ? ` <@&${c.supportRole}>` : ''}`,
            embeds: [new EmbedBuilder().setColor(0x57f287).setTitle('🎫 Ticket').setDescription('Beschreibe dein Anliegen. Ein Teammitglied meldet sich bald.')],
            components: [new Row().addComponents(new Btn().setCustomId('tk:claim').setLabel('Übernehmen').setStyle(BS.Primary), new Btn().setCustomId('tk:close').setLabel('Schließen').setStyle(BS.Danger))] });
          return i.reply({ content: `✅ Ticket erstellt: ${ch}`, ephemeral: true });
        }
        if (a === 'claim') {
          if (!staff(i.member)) return i.reply({ content: 'Nur das Team kann Tickets übernehmen.', ephemeral: true });
          return i.reply({ content: `🙋 ${i.user} hat das Ticket übernommen.`, allowedMentions: { parse: [] } });
        }
        if (a === 'close') {
          const owner = i.channel.topic?.replace('ticket:', '');
          if (!staff(i.member) && i.user.id !== owner) return i.reply({ content: 'Keine Berechtigung.', ephemeral: true });
          await i.reply('🔒 Ticket wird in 5 Sekunden geschlossen…');
          const file = () => new AttachmentBuilder(buf, { name: `transcript-${i.channel.name}.html` });
          const buf = await transcript(i.channel);
          const log = c.logChannel && i.guild.channels.cache.get(c.logChannel);
          if (log) log.send({ content: `Ticket **${i.channel.name}** geschlossen von ${i.user.tag}`, files: [file()] }).catch(() => {});
          const u = owner && (await client.users.fetch(owner).catch(() => null));
          if (u) u.send({ content: `Transkript deines Tickets auf **${i.guild.name}**:`, files: [file()] }).catch(() => {});
          return setTimeout(() => i.channel.delete().catch(() => {}), 5000);
        }
      }
    } catch (e) {
      if (!i.replied && !i.deferred) i.reply({ content: 'Fehler: fehlende Rechte oder falsche Einstellung?', ephemeral: true }).catch(() => {});
    }
  });
}
