import { useState } from 'react';
import { ARMY_COLORS, bodiesOf, deployableUnits, DISPO_ABBR, findUnit, layoutLabel, missionFor, useStore } from '../store';
import { boardCaptureBlob, downloadBoardCapture, type CaptureContent } from '../lib/capture';
import { MAGO_UPLOAD, MAGO_URL } from '../lib/magoLink';
import { track } from '../lib/track';

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();

export function SaveModal({ onClose }: { onClose: () => void }) {
  const { currentId, currentName, mine, opp, layout, saveBattle, user, magoToken } = useStore();
  const [name, setName] = useState(currentName);
  const [capturing, setCapturing] = useState(false);
  const [sent, setSent] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const ok = name.trim().length > 0;
  const save = (asCopy = false) => {
    if (!ok) return;
    saveBattle(name.trim(), asCopy);
    onClose();
  };

  // Titre, sous-titre, noms des unités posées et réserves (unités pas encore sur la table) de chaque camp
  const captureInput = () => {
    const mission = missionFor(mine!, opp!).name;
    const title = name.trim() || mission;
    const subtitle = `${mission} · ${DISPO_ABBR[mine!]} vs ${DISPO_ABBR[opp!]} · ${layoutLabel(layout!)}`;
    const s = useStore.getState();
    const units = Object.entries(s.placed).flatMap(([id, ps]) => {
      const info = findUnit(s, id);
      if (!info) return [];
      const bodies = bodiesOf(s, id, ps);
      return [{ name: info.unit.name, color: ARMY_COLORS[s.colors[info.side]].fill, models: bodies.map((b) => ({ x: b.x, y: b.y, r: b.r })) }];
    });
    const reserves = (['me', 'opp'] as const)
      .filter((side) => s.armies[side])
      .map((side) => ({
        color: ARMY_COLORS[s.colors[side]].fill,
        units: deployableUnits(s.armies[side]!.army, s).filter((u) => !s.placed[u.id]).map((u) => ({ name: u.name, count: u.models.length })),
      }));
    const content: CaptureContent = { units, reserves };
    return { title, subtitle, content };
  };

  const capture = async () => {
    const svg = document.querySelector<SVGSVGElement>('svg.board');
    if (!svg) return;
    setCapturing(true);
    track('capture');
    const { title, subtitle, content } = captureInput();
    try {
      await downloadBoardCapture(svg, title, subtitle, `deploy5-${slug(title)}.png`, content);
    } finally {
      setCapturing(false);
    }
  };

  // Bataille ouverte depuis Mago-stat : l'image du déploiement lui est envoyée (appel API avec le jeton du lien)
  const sendToMago = async () => {
    const svg = document.querySelector<SVGSVGElement>('svg.board');
    if (!svg || !magoToken || sent === 'sending') return;
    setSent('sending');
    track('mago_send');
    const { title, subtitle, content } = captureInput();
    try {
      const image = await boardCaptureBlob(svg, title, subtitle, content, 'image/webp');
      const form = new FormData();
      form.append('token', magoToken);
      form.append('image', image, image.type === 'image/webp' ? 'deploy5.webp' : 'deploy5.png');
      const res = await fetch(MAGO_UPLOAD, { method: 'POST', body: form });
      setSent(res.ok ? 'sent' : 'error');
    } catch {
      setSent('error');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal save-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); if (magoToken) void sendToMago(); else save(); }}
      >
        <header className="modal-head">
          <h2>{magoToken ? 'Envoyer à Mago-stat' : 'Sauvegarder'}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fermer">✕</button>
        </header>
        <label className="field">
          <span>Nom de la bataille</span>
          <div className="field-row">
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Tournoi Lyon R2" maxLength={60} />
            <span className="bdispo">{DISPO_ABBR[mine!]} vs {DISPO_ABBR[opp!]}</span>
          </div>
        </label>
        {magoToken ? (
          <p className={`note left${sent === 'error' ? ' mago-error' : ''}`}>
            {sent === 'sent' ? <>Image envoyée à Mago-stat. <a href={`${MAGO_URL}/matrix`}>Retour à Mago-stat</a></>
              : sent === 'error' ? "Échec de l'envoi à Mago-stat. Réessaie dans un instant."
              : "L'image du déploiement (table, noms des unités et réserves) est envoyée à Mago-stat."}
          </p>
        ) : (
          <p className="note left">Listes, carte et placements sont enregistrés {user ? 'dans ton compte' : 'sur cet appareil (sans compte)'}.</p>
        )}
        <div className="modal-actions">
          <button type="button" className="btn ghost capture-btn" disabled={capturing} onClick={capture} title="Image PNG de la table avec les unités placées">
            {capturing ? '…' : '⤓ Télécharger une capture'}
          </button>
          {magoToken ? (
            <button type="submit" className="btn primary" disabled={sent === 'sending'}>
              {sent === 'sending' ? 'Envoi…' : 'Envoyer à Mago-stat'}
            </button>
          ) : (
            <>
              {currentId && <button type="button" className="btn ghost" disabled={!ok} onClick={() => save(true)}>Nouvelle copie</button>}
              <button type="submit" className="btn primary" disabled={!ok}>{currentId ? 'Mettre à jour' : 'Enregistrer'}</button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
