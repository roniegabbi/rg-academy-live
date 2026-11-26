'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

function nextUrl() {
  if (typeof window === 'undefined') return '/painel';
  const n = new URLSearchParams(window.location.search).get('next') || '';
  return n.startsWith('/') && !n.startsWith('//') ? n : '/painel';
}
import { api } from '@/components/client';

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', password: '', code: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const r = await api(mode === 'login' ? '/api/auth/login' : '/api/auth/signup', { method: 'POST', body: f });
    setBusy(false);
    if (r.ok) router.replace(nextUrl());
    else setErr(r.error);
  };

  return (
    <main style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <form onSubmit={submit} className="card stack" style={{ width: '100%', maxWidth: 420, gap: 16, padding: 28 }}>
        <img src="/rg-academy-logo.png" alt="RG Academy — Educação Corporativa" style={{ width: 220, height: 'auto' }} />
        <div className="stack" style={{ gap: 4 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800 }}>{mode === 'login' ? 'Painel do palestrante' : 'Criar conta de palestrante'}</h1>
          <p className="muted">{mode === 'login' ? 'Entre com seu e-mail e senha.' : 'Use o código de convite da RG Academy.'}</p>
        </div>
        {mode === 'signup' ? (
          <div className="field"><label htmlFor="name">Nome</label><input id="name" className="input" value={f.name} onChange={set('name')} autoComplete="name" required /></div>
        ) : null}
        <div className="field"><label htmlFor="email">E-mail</label><input id="email" type="email" className="input" value={f.email} onChange={set('email')} autoComplete="email" required /></div>
        <div className="field"><label htmlFor="password">Senha</label><input id="password" type="password" className="input" value={f.password} onChange={set('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'signup' ? 8 : undefined} required /></div>
        {mode === 'signup' ? (
          <div className="field"><label htmlFor="code">Código de convite</label><input id="code" className="input" value={f.code} onChange={set('code')} autoComplete="off" required /></div>
        ) : null}
        {err ? <div className="alert" role="alert">{err}</div> : null}
        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}</button>
        <button type="button" className="btn btn-ghost" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setErr(''); }}>
          {mode === 'login' ? 'Primeiro acesso? Criar conta' : 'Já tenho conta · entrar'}
        </button>
      </form>
    </main>
  );
}
