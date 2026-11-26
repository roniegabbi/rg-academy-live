import { db } from '@/lib/db';
import { json, error, readJson } from '@/lib/http';
import { ownedEvent } from '@/lib/auth';
import { initialRun, quizQuestions, publicState } from '@/lib/live';
import { validateForLive } from '@/lib/activity';

export const dynamic = 'force-dynamic';

// Painel de controle ao vivo: iniciar, avançar, pausar, quiz, encerrar.
export async function POST(req, { params }) {
  const { id } = await params;
  const o = await ownedEvent(req, id);
  if (!o.event) return error('Evento não encontrado', o.status);
  const body = await readJson(req);
  const action = String(body.action || '');
  const sql = db();
  const acts = await sql`SELECT id, position, kind, title, config FROM activities WHERE event_id = ${id} ORDER BY position, created_at`;
  const ev = o.event;
  let index = Math.min(Math.max(0, ev.current_index || 0), Math.max(0, acts.length - 1));
  let run = ev.run || {};
  let paused = ev.paused;
  let status = ev.status;

  const goTo = (i) => {
    index = Math.min(Math.max(0, i), Math.max(0, acts.length - 1));
    run = initialRun(acts[index]);
    paused = false;
  };

  switch (action) {
    case 'start': {
      if (!acts.length) return error('Adicione pelo menos uma atividade antes de iniciar.');
      for (const a of acts) {
        const msg = validateForLive(a.kind, a.config || {});
        if (msg) return error(`"${a.title}": ${msg}`);
      }
      status = 'live';
      goTo(ev.status === 'live' ? index : 0);
      await sql`UPDATE events SET status = 'live', started_at = coalesce(started_at, now()), ended_at = NULL WHERE id = ${id}`;
      break;
    }
    case 'end':
      status = 'ended';
      await sql`UPDATE events SET status = 'ended', ended_at = now() WHERE id = ${id}`;
      break;
    case 'goto': goTo(parseInt(body.index, 10) || 0); break;
    case 'next': goTo(index + 1); break;
    case 'prev': goTo(index - 1); break;
    case 'pause': paused = true; break;
    case 'resume': paused = false; break;
    case 'quizStart': {
      const act = acts[index];
      if (!act || act.kind !== 'quiz') return error('A atividade atual não é um quiz.');
      const q = quizQuestions(act)[run.qIndex || 0];
      if (!q) return error('Pergunta não encontrada.');
      const now = Date.now();
      run = { qIndex: run.qIndex || 0, phase: 'question', startedAt: now, endsAt: now + (Number(q.seconds) || 20) * 1000 };
      paused = false;
      break;
    }
    case 'quizReveal': run = { ...run, phase: 'reveal' }; break;
    case 'quizRank': run = { ...run, phase: 'rank' }; break;
    case 'quizNext': {
      const act = acts[index];
      const total = quizQuestions(act).length;
      if ((run.qIndex || 0) + 1 >= total) return error('Esta foi a última pergunta do quiz.');
      run = { qIndex: (run.qIndex || 0) + 1, phase: 'ready' };
      break;
    }
    case 'clearActivity': {
      const act = acts[index];
      if (act) await sql`DELETE FROM responses WHERE activity_id = ${act.id}`;
      if (act && act.kind === 'quiz') run = initialRun(act);
      break;
    }
    case 'hideWord':
    case 'showWord': {
      const act = acts[index];
      if (!act || act.kind !== 'cloud') return error('A atividade atual não é um mapa de palavras.');
      const word = String(body.word || '').slice(0, 25);
      const cur = (act.config && act.config.hidden) || [];
      const low = word.toLocaleLowerCase('pt-BR');
      const hidden = action === 'hideWord'
        ? [...cur.filter((w) => w.toLocaleLowerCase('pt-BR') !== low), word].slice(-200)
        : cur.filter((w) => w.toLocaleLowerCase('pt-BR') !== low);
      const cfg = { ...(act.config || {}), hidden };
      await sql`UPDATE activities SET config = ${JSON.stringify(cfg)}::jsonb WHERE id = ${act.id}`;
      act.config = cfg;
      break;
    }
    case 'clearEvent':
      await sql`DELETE FROM responses WHERE event_id = ${id}`;
      await sql`DELETE FROM participants WHERE event_id = ${id}`;
      status = 'draft';
      goTo(0);
      await sql`UPDATE events SET status = 'draft', started_at = NULL, ended_at = NULL WHERE id = ${id}`;
      break;
    default:
      return error('Ação desconhecida.');
  }

  const rows = await sql`UPDATE events SET current_index = ${index}, paused = ${paused}, run = ${JSON.stringify(run)}::jsonb, updated_at = now() WHERE id = ${id} RETURNING *`;
  const updated = rows[0];
  updated.status = status;
  return json({ ok: true, state: publicState(updated, acts) });
}
