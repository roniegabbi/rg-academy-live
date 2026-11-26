'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Telao from '@/components/Telao';
import TelaoControls from '@/components/TelaoControls';
import { api, usePoll } from '@/components/client';
import { joinUrl as makeJoinUrl } from '@/components/QR';

// Tela do projetor. Para o palestrante logado, mostra os controles de avançar/voltar.
export default function TelaoPage() {
  const { pin } = useParams();
  const { data, offline, notFound, refresh, setData } = usePoll(`/api/live/${pin}/results`, 1000, { bust: true });
  const [joinUrl, setJoinUrl] = useState('');
  const [owner, setOwner] = useState(null);

  useEffect(() => {
    setJoinUrl(makeJoinUrl(pin));
    api(`/api/live/${pin}/owner`).then((r) => { if (r.ok && r.owner) setOwner(r.eventId); });
  }, [pin]);

  const onChange = (state) => {
    // Atualiza na hora e busca os resultados da nova atividade em seguida.
    setData((d) => ({ ...(d || {}), ...state, results: null, _recv: Date.now() }));
    refresh();
  };

  if (notFound) return <div className="telao telao-full" style={{ alignItems: 'center', justifyContent: 'center' }}><p style={{ fontSize: 28 }}>Evento não encontrado.</p></div>;
  return (
    <div>
      <Telao data={data} joinUrl={joinUrl} full />
      {owner && data ? <TelaoControls eventId={owner} data={data} onChange={onChange} /> : null}
      {offline ? <div style={{ position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)', background: '#F2A93B', color: '#0B2238', padding: '6px 14px', borderRadius: 999, fontWeight: 700, zIndex: 30 }}>Reconectando…</div> : null}
    </div>
  );
}
