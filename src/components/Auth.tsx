import { useState } from 'react';
import { authErrorFr, supabase } from '../lib/supabase';

/** Connexion ou création de compte (e-mail + mot de passe) : les batailles sont stockées par joueur. */
export function Auth() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null); setInfo(null);
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(authErrorFr(error.message));
    } else {
      const { data, error } = await supabase.auth.signUp({
        email, password, options: { emailRedirectTo: location.origin },
      });
      if (error) setError(authErrorFr(error.message));
      // Sans session, Supabase attend la confirmation de l'adresse
      else if (!data.session) setInfo('Compte créé. Clique sur le lien reçu par e-mail pour le confirmer, puis connecte-toi.');
    }
    setBusy(false);
  };

  return (
    <div className="home">
      <header className="setup-head">
        <div className="eyebrow">Warhammer 40,000 · 11e édition</div>
        <h1>Deploy</h1>
      </header>
      <form className="auth-form" onSubmit={submit}>
        <div className="segmented">
          <button type="button" className={mode === 'login' ? 'on' : ''} onClick={() => { setMode('login'); setError(null); }}>Connexion</button>
          <button type="button" className={mode === 'signup' ? 'on' : ''} onClick={() => { setMode('signup'); setError(null); }}>Créer un compte</button>
        </div>
        <label className="field">
          <span>E-mail</span>
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>Mot de passe</span>
          <input
            type="password" required minLength={6}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password} onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="warning">{error}</p>}
        {info && <p className="note left">{info}</p>}
        <button className="btn primary wide" disabled={busy}>
          {busy ? '…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
        </button>
      </form>
    </div>
  );
}
