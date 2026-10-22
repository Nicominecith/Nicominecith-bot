# Nicominecith Bot – Dashboard (Netlify, kostenlos)

## Einrichtung
1. https://discord.com/developers/applications → New Application "Nicominecith Bot".
2. Bot-Tab: Token kopieren. General Information: Application ID + Public Key kopieren.
3. OAuth2 → Client Secret kopieren. Redirects: `https://DEINE-SEITE.netlify.app/api/callback` hinzufügen.
4. Netlify → Projekt erstellen (Ordner/GitHub), Environment Variables setzen:
   DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_PUBLIC_KEY, DISCORD_BOT_TOKEN,
   SESSION_SECRET (zufälliger langer Text), SITE_URL (https://DEINE-SEITE.netlify.app, ohne / am Ende)
5. Discord Developer Portal → General Information → "Interactions Endpoint URL":
   `https://DEINE-SEITE.netlify.app/api/interactions`
6. Seite öffnen → Mit Discord anmelden → Bot einladen → Befehle anlegen.

## Wichtig
Netlify kann keinen dauerhaft laufenden Bot hosten. Dieser Bot nutzt Slash-Befehle über Webhooks
(läuft komplett kostenlos). Moderation, Willkommensnachrichten, Logs und Reaction-Roles brauchen
eine dauerhafte Gateway-Verbindung – dafür bräuchte man zusätzlich einen kostenlosen Dauer-Host.

## Gateway-Bot (Ordner bot/) – Moderation, Logs, Willkommen, AutoMod, Leveling
Zusätzliche Netlify-Variable: `BOT_API_KEY` (langer Zufallstext, gleicher Wert wie beim Bot).
1. Developer Portal → Bot → "Server Members Intent" und "Message Content Intent" aktivieren.
2. "Interactions Endpoint URL" im Developer Portal **leeren** (der laufende Bot übernimmt die Befehle).
3. Bot starten: `cd bot && npm install && BOT_TOKEN=... SITE_URL=https://DEINE-SEITE.netlify.app BOT_API_KEY=... node index.js`
4. Kostenlos hosten: eigener PC/Handy (Termux), Oracle Cloud "Always Free" VM, oder ein Free-Tier (Koyeb o. ä.; Free-Tiers ändern sich).
5. Bot-Einladung mit Rechten: Rollen verwalten, Mitglieder kicken/bannen/timeouten, Nachrichten verwalten.
Reaction Roles: `/rolepanel` (Button-Rollen, Modus Toggle/Single). Tickets: `/ticketpanel`, Kategorie/Support-Rolle/Transkript-Kanal im Dashboard-Tab "Tickets".
Giveaways: `/giveaway start|end`. Umfragen: `/poll`. Starboard: Tab "Starboard" im Dashboard.
Noch nicht enthalten: Embed-Builder, Feeds, Voice-XP, Rank-Cards, Case-IDs, Sticky Roles, TagScript.
