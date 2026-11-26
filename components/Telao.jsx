'use client';

import QR from './QR';
import { WordCloud, Bars, QuizOptions, Ranking } from './Viz';
import { useNow, kindLabel } from './client';

export function remainingSeconds(data, now) {
  if (!data || !data.run || !data.run.endsAt) return 0;
  const offset = (data.serverNow || data._recv || now) - (data._recv || now);
  return Math.max(0, Math.ceil((data.run.endsAt - (now + offset)) / 1000));
}

// O que aparece no projetor. Usado no telão e na prévia do painel de controle.
export default function Telao({ data, joinUrl, full = false }) {
  const now = useNow(250);
  if (!data) {
    return <div className={'telao' + (full ? ' telao-full' : '')} style={{ alignItems: 'center', justifyContent: 'center', minHeight: full ? undefined : 420 }}><span style={{ color: '#9FB3C6' }}>Carregando…</span></div>;
  }
  const { event, activity: a, run = {}, results, participants, paused, index, total } = data;
  const status = event.status;

  let body = null;
  if (status !== 'live') {
    body = <JoinSlide heading={event.title} joinUrl={joinUrl} pin={event.pin} note={status === 'ended' ? 'Evento encerrado. Obrigado pela participação!' : 'O evento vai começar em instantes.'} />;
  } else if (!a) {
    body = <p style={{ fontSize: 24 }}>Nenhuma atividade.</p>;
  } else if (a.kind === 'slide') {
    if (a.mode === 'qr') body = <JoinSlide heading={a.heading || event.title} joinUrl={joinUrl} pin={event.pin} />;
    else if (a.mode === 'image') body = <div className="slide-img">{a.imageUrl ? <img src={a.imageUrl} alt={a.title} /> : <span style={{ color: '#9FB3C6' }}>Imagem não definida</span>}</div>;
    else if (a.mode === 'youtube') {
      body = a.youtubeId
        ? <div className="slide-video"><iframe src={`https://www.youtube-nocookie.com/embed/${a.youtubeId}?rel=0&modestbranding=1&playsinline=1`} title={a.title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen /></div>
        : <span style={{ color: '#9FB3C6' }}>Link do vídeo não definido</span>;
    } else {
      body = (
        <div className="slide-white">
          <img src="/rg-academy-logo.png" alt="RG Academy" style={{ height: '6vh', width: 'auto', alignSelf: 'flex-start' }} />
          <h2 style={{ fontSize: 'clamp(28px, 6vh, 80px)', fontWeight: 800 }}>{a.heading || a.title}</h2>
          {a.text ? <p style={{ fontSize: 'clamp(16px, 2.8vh, 36px)', color: '#4A5D70', whiteSpace: 'pre-line', maxWidth: '70vw' }}>{a.text}</p> : null}
        </div>
      );
    }
  } else if (a.kind === 'cloud') {
    body = (<><h2 className="telao-q">{a.question}</h2><WordCloud words={(results && results.words) || []} scale={full ? 1.3 : 0.8} /></>);
  } else if (a.kind === 'choice') {
    body = (<><h2 className="telao-q">{a.question}</h2><Bars options={a.options} counts={(results && results.counts) || []} /></>);
  } else if (a.kind === 'quiz') {
    const phase = run.phase;
    const secs = remainingSeconds(data, now);
    const pct = a.seconds ? Math.max(0, Math.min(100, (secs / a.seconds) * 100)) : 0;
    const answered = (results && results.answered) || 0;
    if (phase === 'ready') {
      body = (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '2vh' }}>
          <span className="telao-kind">Quiz · pergunta {a.qIndex + 1} de {a.qTotal}</span>
          <h2 style={{ fontSize: 'clamp(28px, 6vh, 80px)', fontWeight: 800 }}>Prepare-se!</h2>
          <p style={{ fontSize: 'clamp(16px, 2.8vh, 34px)', color: '#C9D6E2' }}>Responda pelo celular. Quanto mais rápido acertar, mais pontos.</p>
        </div>
      );
    } else if (phase === 'rank') {
      body = (<><h2 className="telao-q">Ranking do quiz</h2><Ranking ranking={(results && results.ranking) || []} /></>);
    } else {
      const revealed = phase === 'reveal';
      body = (
        <>
          <div className="row" style={{ alignItems: 'center', flexWrap: 'nowrap' }}>
            <div style={{ flex: 1 }}>
              <span className="telao-kind">Pergunta {a.qIndex + 1} de {a.qTotal}</span>
              <h2 className="telao-q" style={{ marginTop: '1vh', marginBottom: 0 }}>{a.question}</h2>
            </div>
            {!revealed ? <div className="quiz-timer">{phase === 'closed' ? 0 : secs}</div> : null}
          </div>
          {!revealed ? <div className="timebar"><div style={{ width: (phase === 'closed' ? 0 : pct) + '%' }} /></div> : <div style={{ height: '2vh' }} />}
          <QuizOptions options={a.options} correct={revealed ? a.correct : null} counts={results && results.counts} />
          <div className="row" style={{ justifyContent: 'space-between', marginTop: '2vh', fontSize: 'clamp(14px, 2.2vh, 28px)', color: '#C9D6E2' }}>
            <span><b style={{ color: '#fff' }}>{answered}</b> responderam</span>
            <span>{phase === 'closed' ? 'Tempo esgotado' : revealed ? 'Resposta certa em verde' : 'Tempo correndo…'}</span>
          </div>
        </>
      );
    }
  }

  return (
    <div className={'telao' + (full ? ' telao-full' : '')} style={full ? null : { borderRadius: 18, minHeight: 460 }}>
      <div className="telao-head">
        <span className="telao-kind">{status === 'live' && a ? `${index + 1}/${total} · ${kindLabel(a)}` : 'RG Academy Live'}</span>
        <div style={{ flex: 1 }} />
        {paused && status === 'live' ? <span className="telao-pill" style={{ background: '#F2A93B', color: '#0B2238' }}>Respostas pausadas</span> : null}
        {status === 'live' ? <span className="telao-pill"><span className="dot-live" />AO VIVO</span> : null}
      </div>
      <div className="telao-body">{body}</div>
      <div className="telao-foot">
        {joinUrl ? <QR value={joinUrl} size={300} className="qr-mini" /> : null}
        <span>Participe pelo QR code ou com o PIN <strong>{event.pin}</strong></span>
        <div style={{ flex: 1 }} />
        <span style={{ color: '#C9D6E2' }}><b style={{ color: '#fff' }}>{participants || 0}</b> participantes</span>
      </div>
    </div>
  );
}

function JoinSlide({ heading, joinUrl, pin, note }) {
  return (
    <div className="slide-white" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '3vh 4vw' }}>
      {joinUrl ? <QR value={joinUrl} size={800} style={{ width: 'min(46vh, 38vw)', height: 'min(46vh, 38vw)' }} /> : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2vh', maxWidth: 560 }}>
        <img src="/rg-academy-logo.png" alt="RG Academy" style={{ height: '6vh', width: 'auto', alignSelf: 'flex-start' }} />
        <h2 style={{ fontSize: 'clamp(26px, 5.5vh, 72px)', fontWeight: 800 }}>{heading}</h2>
        <p style={{ fontSize: 'clamp(16px, 2.6vh, 32px)', lineHeight: 1.4, color: '#4A5D70' }}>1. Abra a câmera do celular<br />2. Aponte para o QR code<br />3. Toque no link e participe</p>
        <p style={{ fontSize: 'clamp(14px, 2.2vh, 26px)', color: '#4A5D70' }}>Sem câmera? Acesse o site e use o PIN <b style={{ color: '#0B2238', letterSpacing: '.1em' }}>{pin}</b></p>
        {note ? <p style={{ fontSize: 'clamp(14px, 2.2vh, 26px)', fontWeight: 700, color: '#2E7D1E' }}>{note}</p> : null}
      </div>
    </div>
  );
}
