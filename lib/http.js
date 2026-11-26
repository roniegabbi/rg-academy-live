export function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json; charset=utf-8');
  if (!headers.has('Cache-Control')) headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(data), { status: init.status || 200, headers });
}

export function error(message, status = 400) {
  return json({ ok: false, error: message }, { status });
}

// Cache curto na CDN da Vercel: centenas de celulares pedindo o mesmo estado
// geram no máximo ~1 consulta ao banco por segundo.
export function cachedJson(data, seconds = 1) {
  return json(data, {
    headers: {
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'CDN-Cache-Control': `public, s-maxage=${seconds}, stale-while-revalidate=${seconds}`,
      'Vercel-CDN-Cache-Control': `public, s-maxage=${seconds}, stale-while-revalidate=${seconds}`
    }
  });
}

export async function readJson(req) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

export function getCookie(req, name) {
  const raw = req.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

export function isUuid(v) {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}
