import { clearCookie } from '../lib/session.js';
export default async () => new Response(null, { status: 302, headers: { location: '/', 'set-cookie': clearCookie } });
export const config = { path: '/api/logout' };
