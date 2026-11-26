'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Telao from '@/components/Telao';
import TelaoControls from '@/components/TelaoControls';
import { api, usePoll } from '@/components/client';
import { joinUrl as makeJoinUrl } from '@/components/QR';

// Tela do projetor: exclusiva do palestrante dono do evento (login obrigatório).
export default function TelaoPage() {
  const { pin } = useParams();
  const [joinUrl, setJoinUrl] = useState('');
  const [eventId, setEventId] = useState(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setJoinUrl(makeJoinUrl(pin));
    api(`/api/live/${pin}/owner`).then((r) => {
      if (r.ok && r.owner) setEventId(r.eventId);
      setChecked(true);
    });
  }, [pin]);

  const { data, offline, refresh, setData } = usePoll(eventId ? `/api/events/${eventId}/live` : null, 1000);

  const onChange = (state) => {
    setData((d) => ({ ...(d || {}), ...state, results: null, _recv: Date.now() }));
    refresh();
  };

  if (!checked) return <div className="telao telao-full" />;
  if (!eventId) {
    return (
      <div className="telao telao-full" style={{ alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 20, padding: 24 }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#7FD35F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></svg>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>Tela do projetor protegida</h1>
        <p style={{ fontSize: 18, color: '#C9D6E2', maxWidth: 520 }}>Esta tela é exclusiva do palestrante do evento. Entre no painel e abra pelo botão “Abrir tela do projetor”.</p>
        <a className="btn btn-primary btn-lg" href={`/login?next=${encodeURIComponent(`/telao/${pin}`)}`}>Entrar como palestrante</a>
      </div>
    );
  }
  return (
    <div>
      <Telao data={data} joinUrl={joinUrl} full />
      {data ? <TelaoControls eventId={eventId} data={data} onChange={onChange} /> : null}
      {offline ? <div style={{ position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)', background: '#F2A93B', color: '#0B2238', padding: '6px 14px', borderRadius: 999, fontWeight: 700, zIndex: 30 }}>Reconectando…</div> : null}
    </div>
  );
}
