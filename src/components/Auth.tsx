import { useState } from 'react';
import { authErrorFr, supabase } from '../lib/supabase';

type Mode = 'login' | 'signup' | 'forgot';

/** Connexion ou création de compte (e-mail + mot de passe) : les batailles sont stockées par joueur. */
export function Auth() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const switchTo = (m: Mode) => { setMode(m); setError(null); setInfo(null); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null); setInfo(null);
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(authErrorFr(error.message));
    } else if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email, password, options: { emailRedirectTo: location.origin },
      });
      if (error) setError(authErrorFr(error.message));
      // Sans session, Supabase attend la confirmation de l'adresse
      else if (!data.session) setInfo('Compte créé. Clique sur le lien reçu par e-mail pour le confirmer, puis connecte-toi.');
    } else {
      // Le lien reçu ramène sur l'app, qui affiche alors l'écran « nouveau mot de passe » (cf. App)
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: location.origin });
      if (error) setError(authErrorFr(error.message));
      else setInfo("Si un compte existe avec cette adresse, un lien pour choisir un nouveau mot de passe vient d'être envoyé.");
    }
    setBusy(false);
  };

  return (
    <div className="home">
      <header className="setup-head">
        <div className="eyebrow">Warhammer 40,000 · 11e édition</div>
        <h1>Deploy5</h1>
      </header>
      <form className="auth-form" onSubmit={submit}>
        {mode === 'forgot' ? (
          <div className="auth-title">Mot de passe oublié</div>
        ) : (
          <div className="segmented">
            <button type="button" className={mode === 'login' ? 'on' : ''} onClick={() => switchTo('login')}>Connexion</button>
            <button type="button" className={mode === 'signup' ? 'on' : ''} onClick={() => switchTo('signup')}>Créer un compte</button>
          </div>
        )}
        <label className="field">
          <span>E-mail</span>
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {mode !== 'forgot' && (
          <label className="field">
            <span>Mot de passe</span>
            <input
              type="password" required minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password} onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        )}
        {error && <p className="warning">{error}</p>}
        {info && <p className="note left">{info}</p>}
        <button className="btn primary wide" disabled={busy}>
          {busy ? '…' : mode === 'login' ? 'Se connecter' : mode === 'signup' ? 'Créer mon compte' : 'Envoyer le lien'}
        </button>
        {mode === 'login' && <button type="button" className="link-btn" onClick={() => switchTo('forgot')}>Mot de passe oublié ?</button>}
        {mode === 'forgot' && <button type="button" className="link-btn" onClick={() => switchTo('login')}>‹ Retour à la connexion</button>}
      </form>
    </div>
  );
}

/** Affiché après un clic sur le lien « mot de passe oublié » : la session de récupération permet de le changer. */
export function NewPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setError(authErrorFr(error.message));
    else onDone();
  };

  return (
    <div className="home">
      <header className="setup-head">
        <div className="eyebrow">Warhammer 40,000 · 11e édition</div>
        <h1>Deploy5</h1>
      </header>
      <form className="auth-form" onSubmit={submit}>
        <div className="auth-title">Nouveau mot de passe</div>
        <label className="field">
          <span>Mot de passe</span>
          <input type="password" required minLength={6} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="warning">{error}</p>}
        <button className="btn primary wide" disabled={busy}>{busy ? '…' : 'Enregistrer'}</button>
      </form>
    </div>
  );
}
