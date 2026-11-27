import { cachedJson, error } from '@/lib/http';
import { db } from '@/lib/db';
import { loadEventByPin, publicState, activityResults, raffleWinners } from '@/lib/live';

export const dynamic = 'force-dynamic';

// Estado atual do evento. Cacheado 1s na CDN: 500 celulares = ~1 consulta/s.
export async function GET(req, { params }) {
  const { pin } = await params;
  const data = await loadEventByPin(pin);
  if (!data) return error('Evento não encontrado. Confira o PIN.', 404);
  const state = publicState(data.ev, data.acts);
  const act = data.acts[state.index];
  if (data.ev.status === 'live' && act) {
    // Gráfico ao vivo no celular de quem já votou.
    if (act.kind === 'choice' && !(act.config && act.config.showResults === false)) {
      const r = await activityResults(act, {});
      state.results = { counts: r.counts, voters: r.voters };
    }
    if (act.kind === 'raffle') state.winners = await raffleWinners(act.id);
    // Perguntas aprovadas, para o público ler e curtir.
    if (act.kind === 'qa') {
      state.questions = await db()`SELECT id::text AS id, author, text, likes, status FROM questions WHERE activity_id = ${act.id} AND status IN ('approved', 'answered') ORDER BY (status = 'answered') ASC, likes DESC, id ASC LIMIT 40`;
    }
  }
  return cachedJson(state, 1);
}
