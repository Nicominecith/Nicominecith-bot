export default async () => {
  const p = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: `${process.env.SITE_URL}/api/callback`,
    response_type: 'code',
    scope: 'identify guilds',
  });
  return Response.redirect(`https://discord.com/api/oauth2/authorize?${p}`, 302);
};
export const config = { path: '/api/login' };
