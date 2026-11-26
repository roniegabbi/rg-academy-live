'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Topbar from '@/components/Topbar';
import { api, kindLabel, letters } from '@/components/client';
import { compressImage, uploadImage, pdfToImages } from '@/components/media';
import AiPanel from '@/components/AiPanel';

const ADD = [
  { kind: 'slide', label: 'Slide', desc: 'Texto, imagem ou vídeo' },
  { kind: 'cloud', label: 'Mapa de palavras', desc: 'O público responde com palavras' },
  { kind: 'choice', label: 'Múltipla escolha', desc: 'Gráfico ao vivo no telão' },
  { kind: 'quiz', label: 'Quiz competitivo', desc: 'Perguntas com tempo e ranking' }
];

function autoTitle(kind, c) {
  if (kind === 'slide') {
    if (c.mode === 'qr') return 'QR code para participar';
    return (c.heading || '').trim() || ({ cover: 'Capa', image: 'Imagem', youtube: 'Vídeo', text: 'Slide' }[c.mode] || 'Slide');
  }
  if (kind === 'cloud' || kind === 'choice') return (c.question || '').trim() || (kind === 'cloud' ? 'Mapa de palavras' : 'Múltipla escolha');
  if (kind === 'quiz') {
    const n = (c.questions || []).length;
    const first = ((c.questions || [])[0] || {}).text || '';
    return n > 1 ? `Quiz · ${n} perguntas` : (first.trim() || 'Quiz');
  }
  return 'Atividade';
}

export default function Editor() {
  const { id } = useParams();
  const [ev, setEv] = useState(null);
  const [acts, setActs] = useState([]);
  const [sel, setSel] = useState(null);
  const [draft, setDraft] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const pdfRef = useRef(null);

  const load = async (keepSel) => {
    const r = await api(`/api/events/${id}`);
    if (!r.ok) { setErr(r.error); return; }
    setEv(r.event);
    setActs(r.activities);
    const pick = r.activities.find((a) => a.id === keepSel) || r.activities[0] || null;
    if (pick) { setSel(pick.id); setDraft(JSON.parse(JSON.stringify(pick.config || {}))); setDirty(false); }
  };
  useEffect(() => { load(); }, [id]);

  const current = useMemo(() => acts.find((a) => a.id === sel) || null, [acts, sel]);

  const choose = (a) => {
    if (dirty && !window.confirm('Há alterações não salvas nesta atividade. Descartar?')) return;
    setSel(a.id);
    setDraft(JSON.parse(JSON.stringify(a.config || {})));
    setDirty(false);
    setMsg(''); setErr('');
  };
  const upd = (patch) => { setDraft((d) => ({ ...d, ...patch })); setDirty(true); };

  const save = async () => {
    if (!current) return;
    setBusy('save');
    const r = await api(`/api/activities/${current.id}`, { method: 'PATCH', body: { config: draft, title: autoTitle(current.kind, draft) } });
    setBusy('');
    if (!r.ok) { setErr(r.error); return; }
    setActs(acts.map((a) => (a.id === current.id ? r.activity : a)));
    setDraft(JSON.parse(JSON.stringify(r.activity.config)));
    setDirty(false);
    setMsg('Atividade salva.');
    setTimeout(() => setMsg(''), 2500);
  };

  const add = async (kind) => {
    if (dirty && !window.confirm('Há alterações não salvas. Descartar?')) return;
    const r = await api(`/api/events/${id}/activities`, { method: 'POST', body: { kind } });
    if (r.ok) await load(r.activities[0].id);
  };
  const dup = async () => {
    const r = await api(`/api/activities/${current.id}`, { method: 'POST' });
    if (r.ok) await load(r.id);
  };
  const del = async () => {
    if (!window.confirm(`Excluir "${current.title}"? As respostas dela também serão apagadas.`)) return;
    await api(`/api/activities/${current.id}`, { method: 'DELETE' });
    setDirty(false);
    await load();
  };
  const move = async (dir) => {
    const i = acts.findIndex((a) => a.id === sel);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= acts.length) return;
    const next = acts.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setActs(next);
    await api(`/api/events/${id}/activities`, { method: 'PUT', body: { order: next.map((a) => a.id) } });
  };

  const saveEvent = async (patch) => {
    setEv({ ...ev, ...(patch.title !== undefined ? { title: patch.title } : {}), ...(patch.requireName !== undefined ? { require_name: patch.requireName } : {}) });
    await api(`/api/events/${id}`, { method: 'PATCH', body: patch });
  };

  const importPdf = async (file) => {
    if (!file) return;
    setErr('');
    try {
      setBusy('pdf');
      const blobs = await pdfToImages(file, setMsg);
      const items = [];
      for (let i = 0; i < blobs.length; i++) {
        setMsg(`Enviando página ${i + 1} de ${blobs.length}…`);
        const url = await uploadImage(blobs[i]);
        items.push({ kind: 'slide', title: `${file.name.replace(/\.pdf$/i, '')} · pág. ${i + 1}`, config: { mode: 'image', imageUrl: url, heading: '' } });
      }
      const r = await api(`/api/events/${id}/activities`, { method: 'POST', body: { items } });
      if (!r.ok) throw new Error(r.error);
      setMsg(`${items.length} páginas importadas como slides.`);
      await load(r.activities[0].id);
    } catch (e) {
      setErr('Não foi possível importar o PDF: ' + (e.message || 'erro desconhecido'));
      setMsg('');
    } finally {
      setBusy('');
      if (pdfRef.current) pdfRef.current.value = '';
    }
  };

  if (err && !ev) return (<><Topbar /><main className="container"><div className="alert">{err}</div></main></>);
  if (!ev) return (<><Topbar /><main className="container"><p className="muted">Carregando…</p></main></>);

  return (
    <>
      <Topbar>
        <Link href="/painel" className="btn btn-sm btn-ghost">← Meus eventos</Link>
      </Topbar>
      <main className="container stack" style={{ gap: 18 }}>
        <section className="card row" style={{ gap: 16, alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: '1 1 320px' }}>
            <label htmlFor="ev-title">Nome do evento</label>
            <input id="ev-title" className="input" defaultValue={ev.title} maxLength={140} onBlur={(e) => e.target.value.trim() && e.target.value !== ev.title && saveEvent({ title: e.target.value })} />
          </div>
          <div className="stack" style={{ gap: 2 }}>
            <span className="hint">PIN</span>
            <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: '.12em' }}>{ev.pin}</span>
          </div>
          <label className="check" style={{ minHeight: 44 }}>
            <input type="checkbox" checked={!!ev.require_name} onChange={(e) => saveEvent({ requireName: e.target.checked })} />
            Exigir nome do participante
          </label>
          <div className="row" style={{ gap: 8 }}>
            <Link className="btn btn-primary" href={`/painel/${id}/controle`}>Apresentar evento</Link>
            <Link className="btn" href={`/painel/${id}/relatorio`}>Relatório</Link>
          </div>
        </section>

        <div className="layout-2">
          <aside className="side card stack" style={{ gap: 8 }}>
            <span className="eyebrow">Sequência do evento</span>
            {acts.map((a, i) => (
              <button key={a.id} className={'act-item' + (a.id === sel ? ' on' : '')} onClick={() => choose(a)}>
                <span className="act-num">{i + 1}</span>
                <span className="act-meta"><span className="k">{kindLabel(a)}</span><span className="t">{a.title}</span></span>
              </button>
            ))}
            {!acts.length ? <p className="muted">Nenhuma atividade. Adicione abaixo.</p> : null}
            <span className="eyebrow" style={{ marginTop: 10 }}>Adicionar atividade</span>
            <div className="add-grid">
              {ADD.map((x) => (
                <button key={x.kind} className="add-btn" onClick={() => add(x.kind)}><b>+ {x.label}</b><span>{x.desc}</span></button>
              ))}
            </div>
            <label className="add-btn" style={{ cursor: busy ? 'wait' : 'pointer' }}>
              <b>+ Importar apresentação em PDF</b><span>Cada página vira um slide</span>
              <input ref={pdfRef} type="file" accept="application/pdf" style={{ display: 'none' }} disabled={!!busy} onChange={(e) => importPdf(e.target.files[0])} />
            </label>
          </aside>

          <section className="main card stack" style={{ gap: 16 }}>
            {msg ? <div className="ok-box" role="status">{msg}</div> : null}
            {err ? <div className="alert" role="alert">{err}</div> : null}
            {current && draft ? (
              <>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div className="stack" style={{ gap: 2 }}>
                    <span className="eyebrow">Atividade {acts.findIndex((a) => a.id === sel) + 1} · {kindLabel({ kind: current.kind, config: draft })}</span>
                    <h2 style={{ fontSize: 22, fontWeight: 800 }}>{autoTitle(current.kind, draft)}</h2>
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    <button className="btn btn-sm icon-btn" onClick={() => move(-1)} aria-label="Mover para cima">↑</button>
                    <button className="btn btn-sm icon-btn" onClick={() => move(1)} aria-label="Mover para baixo">↓</button>
                    <button className="btn btn-sm" onClick={dup}>Duplicar</button>
                    <button className="btn btn-sm btn-danger" onClick={del}>Excluir</button>
                  </div>
                </div>

                {current.kind === 'slide' ? <SlideForm c={draft} upd={upd} setErr={setErr} /> : null}
                {current.kind === 'cloud' ? <CloudForm c={draft} upd={upd} /> : null}
                {current.kind === 'choice' ? <ChoiceForm c={draft} upd={upd} /> : null}
                {current.kind === 'quiz' ? <QuizForm c={draft} upd={upd} /> : null}

                <div className="row" style={{ justifyContent: 'flex-end', borderTop: '1px solid var(--line)', paddingTop: 14 }}>
                  {dirty ? <span className="hint">Alterações não salvas</span> : null}
                  <button className="btn btn-primary" onClick={save} disabled={!dirty || busy === 'save'}>{busy === 'save' ? 'Salvando…' : 'Salvar atividade'}</button>
                </div>
              </>
            ) : <p className="muted">Selecione ou adicione uma atividade.</p>}
          </section>
        </div>
      </main>
    </>
  );
}

function SlideForm({ c, upd, setErr }) {
  const [up, setUp] = useState(false);
  const onImage = async (file) => {
    if (!file) return;
    setUp(true);
    try {
      const blob = await compressImage(file);
      const url = await uploadImage(blob);
      upd({ imageUrl: url });
    } catch (e) {
      setErr(e.message);
    } finally {
      setUp(false);
    }
  };
  const modes = [['cover', 'Capa'], ['qr', 'QR code'], ['text', 'Texto'], ['image', 'Imagem'], ['youtube', 'Vídeo do YouTube']];
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="field">
        <span className="label">Tipo de slide</span>
        <div className="row" style={{ gap: 8 }}>
          {modes.map(([m, l]) => (
            <button key={m} type="button" className={'btn btn-sm' + ((c.mode || 'text') === m ? ' btn-dark' : '')} onClick={() => upd({ mode: m })} aria-pressed={(c.mode || 'text') === m}>{l}</button>
          ))}
        </div>
      </div>
      {c.mode === 'cover' ? (
        <div className="stack" style={{ gap: 12 }}>
          <div className="field"><label htmlFor="cv-e">Chamada acima do título</label><input id="cv-e" className="input" placeholder="Ex.: Workshop, Palestra, Treinamento" value={c.eyebrow || ''} maxLength={40} onChange={(e) => upd({ eyebrow: e.target.value })} /></div>
          <div className="field"><label htmlFor="cv-h">Título</label><input id="cv-h" className="input" value={c.heading || ''} maxLength={140} onChange={(e) => upd({ heading: e.target.value })} /><span className="hint">A segunda metade do título aparece em verde.</span></div>
          <div className="field"><label htmlFor="cv-t">Subtítulo</label><input id="cv-t" className="input" value={c.text || ''} maxLength={160} onChange={(e) => upd({ text: e.target.value })} /></div>
          <div className="field"><label htmlFor="cv-b">Palavra gigante ao fundo</label><input id="cv-b" className="input" placeholder="Ex.: INSPIRA" value={c.bgWord || ''} maxLength={16} onChange={(e) => upd({ bgWord: e.target.value })} /></div>
          <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
            <div className="field" style={{ flex: '1 1 180px' }}><label htmlFor="cv-p">Palestrante</label><input id="cv-p" className="input" value={c.presenter || ''} maxLength={80} onChange={(e) => upd({ presenter: e.target.value })} /></div>
            <div className="field" style={{ flex: '1 1 180px' }}><label htmlFor="cv-d">Data</label><input id="cv-d" className="input" placeholder="Ex.: 27 de novembro de 2026" value={c.date || ''} maxLength={60} onChange={(e) => upd({ date: e.target.value })} /></div>
            <div className="field" style={{ flex: '1 1 180px' }}><label htmlFor="cv-l">Local ou empresa</label><input id="cv-l" className="input" value={c.place || ''} maxLength={80} onChange={(e) => upd({ place: e.target.value })} /></div>
          </div>
        </div>
      ) : null}
      {c.mode === 'text' || !c.mode ? (
        <div className="field"><label htmlFor="s-h">Título</label><input id="s-h" className="input" value={c.heading || ''} maxLength={140} onChange={(e) => upd({ heading: e.target.value })} /></div>
      ) : null}
      {c.mode === 'qr' ? <p className="hint">Mostra no telão “Leia o QR code e participe”, com o QR grande, o endereço e o PIN.</p> : null}
      {(c.mode === 'text' || !c.mode) ? (
        <div className="field"><label htmlFor="s-t">Texto</label><textarea id="s-t" className="textarea" value={c.text || ''} maxLength={1000} onChange={(e) => upd({ text: e.target.value })} /><span className="hint">{(c.text || '').length} / 1000</span></div>
      ) : null}
      {c.mode === 'image' ? (
        <div className="stack" style={{ gap: 10 }}>
          {c.imageUrl ? <img src={c.imageUrl} alt="Prévia do slide" style={{ maxHeight: 320, objectFit: 'contain', borderRadius: 10, border: '1px solid var(--line)', alignSelf: 'flex-start' }} /> : null}
          <label className="btn" style={{ alignSelf: 'flex-start' }}>
            {up ? 'Enviando…' : c.imageUrl ? 'Trocar imagem' : 'Escolher imagem (JPG, PNG)'}
            <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={(e) => onImage(e.target.files[0])} />
          </label>
          <span className="hint">Dica: no Canva, baixe cada página como PNG ou importe a apresentação inteira em PDF.</span>
        </div>
      ) : null}
      {c.mode === 'youtube' ? (
        <div className="field"><label htmlFor="s-y">Link do vídeo do YouTube</label><input id="s-y" className="input" placeholder="https://www.youtube.com/watch?v=…" value={c.youtubeUrl || ''} onChange={(e) => upd({ youtubeUrl: e.target.value })} /><span className="hint">O vídeo toca no telão. O palestrante dá o play na tela do projetor.</span></div>
      ) : null}
    </div>
  );
}

function CloudForm({ c, upd }) {
  const [ai, setAi] = useState(false);
  return (
    <div className="stack" style={{ gap: 14 }}>
      {ai ? <AiPanel kind="cloud" onCloud={(q) => upd({ question: q })} onClose={() => setAi(false)} /> : <button className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setAi(true)}>✨ Sugerir pergunta com IA</button>}
      <div className="field"><label htmlFor="c-q">Pergunta para o público</label><input id="c-q" className="input" value={c.question || ''} maxLength={140} onChange={(e) => upd({ question: e.target.value })} /><span className="hint">{(c.question || '').length} / 140 · cada pessoa pode enviar até 3 palavras.</span></div>
      <label className="check"><input type="checkbox" checked={c.allowEmoji !== false} onChange={(e) => upd({ allowEmoji: e.target.checked })} />Permitir emojis (até 5 por pessoa: 👏 ❤️ 🔥 💡 🚀…)</label>
    </div>
  );
}

function ChoiceForm({ c, upd }) {
  const opts = c.options || [];
  const setOpt = (i, v) => upd({ options: opts.map((o, j) => (j === i ? v : o)) });
  const [ai, setAi] = useState(false);
  return (
    <div className="stack" style={{ gap: 14 }}>
      {ai ? <AiPanel kind="choice" onPoll={(p) => upd({ question: p.question, options: p.options })} onClose={() => setAi(false)} /> : <button className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setAi(true)}>✨ Sugerir enquete com IA</button>}
      <div className="field"><label htmlFor="m-q">Pergunta</label><input id="m-q" className="input" value={c.question || ''} maxLength={140} onChange={(e) => upd({ question: e.target.value })} /></div>
      <div className="field">
        <span className="label">Alternativas (mínimo 2, máximo 10)</span>
        {opts.map((o, i) => (
          <div className="opt-edit" key={i}>
            <span className="opt-letter" style={{ width: 34, height: 34, fontSize: 15 }}>{letters(i)}</span>
            <input className="input" value={o} maxLength={80} onChange={(e) => setOpt(i, e.target.value)} aria-label={`Alternativa ${letters(i)}`} />
            <button className="btn btn-sm icon-btn btn-danger" onClick={() => upd({ options: opts.filter((_, j) => j !== i) })} disabled={opts.length <= 2} aria-label={`Remover alternativa ${letters(i)}`}>×</button>
          </div>
        ))}
        {opts.length < 10 ? <button className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => upd({ options: [...opts, ''] })}>+ Adicionar alternativa</button> : null}
      </div>
      <label className="check"><input type="checkbox" checked={!!c.multi} onChange={(e) => upd({ multi: e.target.checked, maxSelect: e.target.checked ? Math.min(2, opts.length) : 1 })} />Permitir escolher mais de uma opção</label>
      {c.multi ? (
        <div className="field" style={{ maxWidth: 260 }}><label htmlFor="m-max">Máximo de opções por pessoa</label><input id="m-max" type="number" min={1} max={opts.length} className="input" value={c.maxSelect || 2} onChange={(e) => upd({ maxSelect: e.target.value })} /></div>
      ) : null}
    </div>
  );
}

function QuizForm({ c, upd }) {
  const qs = c.questions || [];
  const setQ = (i, patch) => upd({ questions: qs.map((q, j) => (j === i ? { ...q, ...patch } : q)) });
  const addQ = () => upd({ questions: [...qs, { text: '', options: ['', '', '', ''], correct: 0, seconds: (qs[qs.length - 1] && qs[qs.length - 1].seconds) || 15 }] });
  const allSame = qs.length && qs.every((q) => Number(q.seconds || 15) === Number(qs[0].seconds || 15));
  const [ai, setAi] = useState(false);
  const fromAi = (generated, mode) => {
    const filled = qs.filter((q) => (q.text || '').trim() && q.text !== 'Nova pergunta do quiz');
    upd({ questions: mode === 'append' ? [...filled, ...generated] : generated });
  };
  return (
    <div className="stack" style={{ gap: 14 }}>
      {ai ? <AiPanel kind="quiz" onQuiz={fromAi} onClose={() => setAi(false)} /> : <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} onClick={() => setAi(true)}>✨ Criar quiz com IA</button>}
      <div className="row" style={{ gap: 10, justifyContent: 'space-between' }}>
        <p className="hint" style={{ flex: '1 1 300px' }}>Acertos valem de 500 a 1.000 pontos: quanto mais rápido, mais pontos. O ranking soma todas as perguntas deste quiz. Você pode revelar a resposta antes do tempo acabar.</p>
        <label className="row" style={{ gap: 8, fontSize: 14, fontWeight: 600 }}>Tempo para todas as perguntas
          <select className="select" style={{ width: 110, padding: '8px 10px' }} value={allSame ? Number(qs[0].seconds || 15) : ''} onChange={(e) => e.target.value && upd({ questions: qs.map((q) => ({ ...q, seconds: Number(e.target.value) })) })}>
            {!allSame ? <option value="">Variado</option> : null}
            {[5, 10, 15, 20, 30, 45, 60].map((s) => <option key={s} value={s}>{s}s</option>)}
          </select>
        </label>
      </div>
      {qs.map((q, i) => {
        const opts = [0, 1, 2, 3].map((k) => (q.options || [])[k] || '');
        return (
          <div className="qbox" key={i}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="eyebrow">Pergunta {i + 1}</span>
              <div className="row" style={{ gap: 6 }}>
                <label className="row" style={{ gap: 6, fontSize: 14 }}>Tempo
                  <select className="select" style={{ width: 96, padding: '6px 8px' }} value={q.seconds || 15} onChange={(e) => setQ(i, { seconds: Number(e.target.value) })}>
                    {[5, 10, 15, 20, 30, 45, 60].map((s) => <option key={s} value={s}>{s}s</option>)}
                  </select>
                </label>
                <button className="btn btn-sm btn-danger" onClick={() => upd({ questions: qs.filter((_, j) => j !== i) })} disabled={qs.length <= 1}>Remover</button>
              </div>
            </div>
            <input className="input" placeholder="Enunciado da pergunta" value={q.text || ''} maxLength={200} onChange={(e) => setQ(i, { text: e.target.value })} aria-label={`Enunciado da pergunta ${i + 1}`} />
            {opts.map((o, k) => (
              <div className="opt-edit" key={k}>
                <label className="check" style={{ gap: 6 }} title="Marcar como resposta certa">
                  <input type="radio" name={`correct-${i}`} checked={Number(q.correct) === k} onChange={() => setQ(i, { correct: k })} aria-label={`Resposta certa: ${letters(k)}`} />
                </label>
                <span className="opt-letter" style={{ width: 34, height: 34, fontSize: 15 }}>{letters(k)}</span>
                <input className="input" value={o} maxLength={80} placeholder={k < 2 ? 'Obrigatória' : 'Opcional'} onChange={(e) => { const next = opts.slice(); next[k] = e.target.value; setQ(i, { options: next }); }} aria-label={`Alternativa ${letters(k)} da pergunta ${i + 1}`} />
              </div>
            ))}
            <span className="hint">Marque o círculo da alternativa correta.</span>
          </div>
        );
      })}
      <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={addQ}>+ Adicionar pergunta</button>
    </div>
  );
}
