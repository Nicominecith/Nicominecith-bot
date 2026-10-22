import crypto from 'node:crypto';
const mac = (b) => crypto.createHmac('sha256', process.env.SESSION_SECRET).update(b).digest('base64url');

export function makeCookie(data) {
  const b = Buffer.from(JSON.stringify({ ...data, exp: Date.now() + 6 * 3600 * 1000 })).toString('base64url');
  return `nb=${b}.${mac(b)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=21600`;
}
export const clearCookie = 'nb=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';

export function getSession(req) {
  const c = (req.headers.get('cookie') || '').split(/;\s*/).find((x) => x.startsWith('nb='));
  if (!c) return null;
  const [b, s] = c.slice(3).split('.');
  if (!b || !s) return null;
  const e = mac(b);
  if (s.length !== e.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(e))) return null;
  try {
    const o = JSON.parse(Buffer.from(b, 'base64url').toString());
    return o.exp > Date.now() ? o : null;
  } catch { return null; }
}
