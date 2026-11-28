import { db } from '@/lib/db';
import { error } from '@/lib/http';
import { ownedEvent } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function cell(v) {
  const s = v == null ? '' : String(v);
  const safe = /^[=+\-@]/.test(s) ? "'" + s : s; // evita fórmulas maliciosas no Excel
  return '"' + safe.replace(/"/g, '""') + '"';
}

// Planilha (CSV, abre no Excel) com todas as respostas do evento.
export async function GET(req, { params }) {
  const { id } = await params;
  const o = await ownedEvent(req, id);
  if (!o.event) return error('Evento não encontrado', o.status);
  const sql = db();
  const rows = await sql`
    SELECT a.position, a.kind, a.title, a.config, r.q_index, r.text_value, r.options, r.correct, r.points, r.created_at, p.name
    FROM responses r JOIN activities a ON a.id = r.activity_id JOIN participants p ON p.id = r.participant_id
    WHERE r.event_id = ${id} ORDER BY a.position, r.q_index, r.created_at`;
  const kindName = { cloud: 'Mapa de palavras', choice: 'Múltipla escolha', quiz: 'Quiz', raffle: 'Sorteio', scale: 'Escala 0 a 10', rating: 'Avaliação' };
  const lines = [['Atividade', 'Tipo', 'Pergunta', 'Participante', 'Resposta', 'Acertou', 'Pontos', 'Data/hora'].map(cell).join(';')];
  for (const r of rows) {
    const c = r.config || {};
    let question = c.question || r.title;
    let answer = r.text_value || '';
    if (r.kind === 'choice') answer = (r.options || []).map((i) => (c.options || [])[i]).filter(Boolean).join(' | ');
    if (r.kind === 'scale') answer = String((r.options || [])[0] ?? '');
    if (r.kind === 'rating') answer = `${(r.options || [])[0] || ''} estrela(s)${r.text_value ? ' — ' + r.text_value : ''}`;
    if (r.kind === 'quiz') {
      const q = (c.questions || [])[r.q_index] || {};
      question = q.text || question;
      answer = (r.options || []).map((i) => (q.options || [])[i]).filter(Boolean).join(' | ');
    }
    const when = new Date(r.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    lines.push([`${r.position + 1}. ${r.title}`, kindName[r.kind] || r.kind, question, r.name || 'Anônimo', answer, r.kind === 'quiz' ? (r.correct ? 'Sim' : 'Não') : '', r.kind === 'quiz' ? r.points : '', when].map(cell).join(';'));
  }
  const qs = await sql`SELECT a.position, a.title, a.kind, q.author, q.text, q.status, q.likes, q.created_at FROM questions q JOIN activities a ON a.id = q.activity_id WHERE q.event_id = ${id} ORDER BY a.position, q.likes DESC, q.id`;
  const stName = { pending: 'Não aprovada', approved: 'Aprovada', answered: 'Respondida', hidden: 'Oculta' };
  for (const q of qs) {
    const when = new Date(q.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    lines.push([`${q.position + 1}. ${q.title}`, q.kind === 'wall' ? 'Mural' : 'Perguntas ao palestrante', q.text, q.author || 'Anônimo', `${stName[q.status] || q.status} · ${q.likes} curtida(s)`, '', '', when].map(cell).join(';'));
  }
  const body = '﻿' + lines.join('\r\n');
  const fname = 'respostas-' + o.event.title.normalize('NFD').replace(/[^\w]+/g, '-').toLowerCase().slice(0, 50) + '.csv';
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fname}"`,
      'Cache-Control': 'no-store'
    }
  });
}
