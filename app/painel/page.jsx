'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Topbar from '@/components/Topbar';
import { api } from '@/components/client';

const STATUS = { draft: ['Rascunho', ''], live: ['Ao vivo', 'tag-live'], ended: ['Encerrado', 'tag-ended'] };

export default function Painel() {
  const router = useRouter();
  const [events, setEvents] = useState(null);
  const [title, setTitle] = useState('');
  const [err, setErr] = useState('');
  const [ending, setEnding] = useState('');

  const load = () => api('/api/events').then((r) => { if (r.ok) setEvents(r.events); });
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    const r = await api('/api/events', { method: 'POST', body: { title } });
    if (r.ok) router.push(`/painel/${r.id}`);
    else setErr(r.error);
  };
  const duplicate = async (id) => {
    const r = await api(`/api/events/${id}/duplicate`, { method: 'POST' });
    if (r.ok) router.push(`/painel/${r.id}`);
  };
  const end = async (ev) => {
    if (!window.confirm(`Encerrar o evento "${ev.title}"? O telão mostra a tela de agradecimento e o QR code para de aceitar novas entradas. As respostas ficam guardadas para o relatório.`)) return;
    setEnding(ev.id);
    setErr('');
    const r = await api(`/api/events/${ev.id}/control`, { method: 'POST', body: { action: 'end' } });
    setEnding('');
    if (!r.ok) { setErr(r.error); return; }
    setEvents((list) => list.map((x) => (x.id === ev.id ? { ...x, status: 'ended' } : x)));
  };
  const remove = async (ev) => {
    if (!window.confirm(`Excluir o evento "${ev.title}" e todas as respostas? Não dá para desfazer.`)) return;
    await api(`/api/events/${ev.id}`, { method: 'DELETE' });
    load();
  };

  return (
    <>
      <Topbar />
      <main className="container stack" style={{ gap: 20 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="stack" style={{ gap: 4 }}>
            <h1 style={{ fontSize: 28, fontWeight: 800 }}>Meus eventos</h1>
            <p className="muted">Monte a sequência de atividades e conduza o evento ao vivo.</p>
          </div>
        </div>

        <form onSubmit={create} className="card row" style={{ gap: 12 }}>
          <div className="field" style={{ flex: '1 1 320px' }}>
            <label htmlFor="new-title">Novo evento</label>
            <input id="new-title" className="input" placeholder="Ex.: Workshop Liderança que inspira" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} />
          </div>
          <button className="btn btn-primary" style={{ alignSelf: 'flex-end' }}>Criar evento</button>
          {err ? <div className="alert" style={{ width: '100%' }}>{err}</div> : null}
        </form>

        <section className="card">
          {err && events ? <div className="alert" role="alert" style={{ marginBottom: 12 }}>{err}</div> : null}
          {events === null ? <p className="muted">Carregando…</p> : events.length === 0 ? (
            <p className="muted">Nenhum evento ainda. Crie o primeiro acima.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Evento</th><th>PIN</th><th>Atividades</th><th>Participantes</th><th>Situação</th><th></th></tr></thead>
                <tbody>
                  {events.map((ev) => (
                    <tr key={ev.id}>
                      <td><Link href={`/painel/${ev.id}`} style={{ fontWeight: 700, color: 'var(--ink)' }}>{ev.title}</Link><div className="hint">Criado em {new Date(ev.created_at).toLocaleDateString('pt-BR')}</div></td>
                      <td style={{ fontWeight: 700, letterSpacing: '.08em' }}>{ev.pin}</td>
                      <td>{ev.activities}</td>
                      <td>{ev.participants}</td>
                      <td><span className={'tag ' + STATUS[ev.status][1]}>{STATUS[ev.status][0]}</span></td>
                      <td>
                        <div className="row" style={{ justifyContent: 'flex-end', gap: 6, flexWrap: 'nowrap' }}>
                          <Link className="btn btn-sm btn-dark" href={`/painel/${ev.id}/controle`}>Apresentar</Link>
                          {ev.status === 'live' ? (
                            <button className="btn btn-sm" style={{ background: 'var(--amber)', borderColor: 'var(--amber)', color: 'var(--navy)' }} onClick={() => end(ev)} disabled={ending === ev.id} aria-label={`Encerrar ${ev.title}`}>
                              {ending === ev.id ? 'Encerrando…' : 'Encerrar'}
                            </button>
                          ) : null}
                          <Link className="btn btn-sm" href={`/painel/${ev.id}`}>Editar</Link>
                          <Link className="btn btn-sm" href={`/painel/${ev.id}/relatorio`}>Relatório</Link>
                          <button className="btn btn-sm" onClick={() => duplicate(ev.id)}>Duplicar</button>
                          <button className="btn btn-sm btn-danger" onClick={() => remove(ev)} aria-label={`Excluir ${ev.title}`}>Excluir</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
