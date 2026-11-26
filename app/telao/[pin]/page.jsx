'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Telao from '@/components/Telao';
import { usePoll } from '@/components/client';
import { joinUrl as makeJoinUrl } from '@/components/QR';

// Tela do projetor: abrir em tela cheia (F11) no notebook ligado ao telão.
export default function TelaoPage() {
  const { pin } = useParams();
  const { data, offline, notFound } = usePoll(`/api/live/${pin}/results`, 1000, { bust: true });
  const [joinUrl, setJoinUrl] = useState('');
  useEffect(() => { setJoinUrl(makeJoinUrl(pin)); }, [pin]);

  const goFull = () => {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(() => {});
  };

  if (notFound) return <div className="telao telao-full" style={{ alignItems: 'center', justifyContent: 'center' }}><p style={{ fontSize: 28 }}>Evento não encontrado.</p></div>;
  return (
    <div onDoubleClick={goFull} title="Clique duas vezes para tela cheia">
      <Telao data={data} joinUrl={joinUrl} full />
      {offline ? <div style={{ position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)', background: '#F2A93B', color: '#0B2238', padding: '6px 14px', borderRadius: 999, fontWeight: 700 }}>Reconectando…</div> : null}
    </div>
  );
}
