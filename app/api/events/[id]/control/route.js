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
      await sql`UPDATE events SET status = 'ended', ended_at = now(), qr_overlay = false WHERE id = ${id}`;
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
    case 'quizReveal':
      if (!['question', 'closed', 'reveal', 'rank'].includes(run.phase)) return error('Inicie a pergunta antes de revelar a resposta.');
      run = { ...run, phase: 'reveal' };
      break;
    case 'quizRank':
      if (!['question', 'closed', 'reveal', 'rank'].includes(run.phase)) return error('Inicie a pergunta antes de mostrar o ranking.');
      run = { ...run, phase: 'rank' };
      break;
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
      if (act && (act.kind === 'qa' || act.kind === 'wall')) await sql`DELETE FROM questions WHERE activity_id = ${act.id}`;
      if (act && ['quiz', 'qa', 'wall', 'raffle', 'timer'].includes(act.kind)) run = initialRun(act);
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
    case 'qaApprove':
    case 'qaHide':
    case 'qaAnswered':
    case 'qaHighlight': {
      const act = acts[index];
      if (!act || !['qa', 'wall'].includes(act.kind)) return error('A atividade atual não é de perguntas nem mural.');
      const qid = String(body.questionId || '');
      if (action === 'qaHighlight' && !qid) { run = { ...run, highlight: null }; break; }
      if (!/^\d{1,18}$/.test(qid)) return error('Pergunta inválida.');
      const st = { qaApprove: 'approved', qaHide: 'hidden', qaAnswered: 'answered', qaHighlight: 'approved' }[action];
      const upd = await sql`UPDATE questions SET status = ${st} WHERE id = ${qid}::bigint AND activity_id = ${act.id} RETURNING id::text AS id`;
      if (!upd.length) return error('Pergunta não encontrada.');
      if (action === 'qaHighlight') run = { ...run, highlight: qid };
      else if (run.highlight === qid) run = { ...run, highlight: null };
      break;
    }
    case 'raffleDraw': {
      const act = acts[index];
      if (!act || act.kind !== 'raffle') return error('A atividade atual não é um sorteio.');
      const onlyNamed = !(act.config && act.config.onlyNamed === false);
      // Sorteia entre quem ainda não ganhou (os ganhadores ficam gravados como respostas da atividade).
      // Sorteio por participação: cada resposta/pergunta no evento vale mais uma "chance".
      const weighted = !!(act.config && act.config.weighted);
      const pick = await sql`SELECT p.id FROM participants p
        WHERE p.event_id = ${id} AND (${!onlyNamed} OR length(trim(p.name)) >= 2)
          AND NOT EXISTS (SELECT 1 FROM responses r WHERE r.activity_id = ${act.id} AND r.participant_id = p.id)
        ORDER BY CASE WHEN ${weighted} THEN -ln(1 - random()) / (1
            + (SELECT count(*) FROM responses r2 JOIN activities a2 ON a2.id = r2.activity_id WHERE r2.participant_id = p.id AND a2.kind <> 'raffle')
            + (SELECT count(*) FROM questions q2 WHERE q2.participant_id = p.id)) ELSE random() END
        LIMIT 1`;
      if (!pick.length) return error(onlyNamed ? 'Não há mais participantes com nome para sortear.' : 'Não há mais participantes para sortear.');
      await sql`INSERT INTO responses (event_id, activity_id, participant_id, text_value) VALUES (${id}, ${act.id}, ${pick[0].id}, 'Sorteado')`;
      run = { drawnAt: Date.now() };
      break;
    }
    case 'raffleReset': {
      const act = acts[index];
      if (!act || act.kind !== 'raffle') return error('A atividade atual não é um sorteio.');
      await sql`DELETE FROM responses WHERE activity_id = ${act.id}`;
      run = {};
      break;
    }
    case 'qrShow':
    case 'qrHide':
      // QR por cima do telão, sem mudar a atividade: quem caiu ou chegou atrasado entra e o evento segue do mesmo ponto.
      await sql`UPDATE events SET qr_overlay = ${action === 'qrShow'} WHERE id = ${id}`;
      break;
    case 'timerStart':
    case 'timerPause':
    case 'timerReset':
    case 'timerAdd': {
      const act = acts[index];
      if (!act || act.kind !== 'timer') return error('A atividade atual não é um cronômetro.');
      const now = Date.now();
      const left = run.state === 'running' ? Math.max(0, (run.endsAt || now) - now) : (run.left != null ? run.left : initialRun(act).left);
      if (action === 'timerStart') run = left > 0 ? { state: 'running', endsAt: now + left, left } : run;
      if (action === 'timerPause') run = { state: 'paused', left, endsAt: null };
      if (action === 'timerReset') run = initialRun(act);
      if (action === 'timerAdd') {
        const plus = Math.max(-600000, Math.min(600000, (parseInt(body.seconds, 10) || 60) * 1000));
        const nl = Math.max(0, left + plus);
        run = run.state === 'running' ? { state: 'running', endsAt: now + nl, left: nl } : { ...run, state: run.state === 'done' ? 'paused' : (run.state || 'ready'), left: nl };
      }
      break;
    }
    case 'clearEvent':
      await sql`DELETE FROM responses WHERE event_id = ${id}`;
      await sql`DELETE FROM questions WHERE event_id = ${id}`;
      await sql`DELETE FROM reactions WHERE event_id = ${id}`;
      await sql`DELETE FROM participants WHERE event_id = ${id}`;
      status = 'draft';
      goTo(0);
      paused = false;
      await sql`UPDATE events SET status = 'draft', started_at = NULL, ended_at = NULL, qr_overlay = false WHERE id = ${id}`;
      break;
    default:
      return error('Ação desconhecida.');
  }

  // Voltou para um quiz que já tinha respostas (ex.: apertou ← sem querer)?
  // Retoma da última pergunta respondida, mostrando o ranking, em vez de recomeçar da 1.
  if (['goto', 'next', 'prev', 'start'].includes(action) && acts[index] && acts[index].kind === 'quiz') {
    const last = await sql`SELECT max(q_index)::int AS m FROM responses WHERE activity_id = ${acts[index].id}`;
    if (last[0].m != null) run = { qIndex: Math.min(last[0].m, Math.max(0, quizQuestions(acts[index]).length - 1)), phase: 'rank' };
  }

  const rows = await sql`UPDATE events SET current_index = ${index}, paused = ${paused}, run = ${JSON.stringify(run)}::jsonb, updated_at = now() WHERE id = ${id} RETURNING *`;
  const updated = rows[0];
  updated.status = status;
  return json({ ok: true, state: publicState(updated, acts) });
}
