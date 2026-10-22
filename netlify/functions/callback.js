import { makeCookie } from '../lib/session.js';
import { API } from '../lib/discord.js';

export default async (req) => {
  const code = new URL(req.url).searchParams.get('code');
  if (!code) return Response.redirect(process.env.SITE_URL, 302);
  const t = await fetch(`${API}/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${process.env.SITE_URL}/api/callback`,
    }),
  });
  if (!t.ok) return new Response('Login fehlgeschlagen', { status: 400 });
  const { access_token } = await t.json();
  const u = await (await fetch(`${API}/users/@me`, { headers: { authorization: `Bearer ${access_token}` } })).json();
  return new Response(null, {
    status: 302,
    headers: { location: '/', 'set-cookie': makeCookie({ id: u.id, name: u.global_name || u.username, avatar: u.avatar, token: access_token }) },
  });
};
export const config = { path: '/api/callback' };
