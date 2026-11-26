import { cachedJson, error } from '@/lib/http';
import { loadEventByPin, publicState } from '@/lib/live';

export const dynamic = 'force-dynamic';

// Estado atual do evento. Cacheado 1s na CDN: 500 celulares = ~1 consulta/s.
export async function GET(req, { params }) {
  const { pin } = await params;
  const data = await loadEventByPin(pin);
  if (!data) return error('Evento não encontrado. Confira o PIN.', 404);
  return cachedJson(publicState(data.ev, data.acts), 1);
}
