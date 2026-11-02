import { useState } from 'react';
import { asset, missionFor, useStore } from '../store';

export function MissionOverlay({ onClose }: { onClose: () => void }) {
  const { mine, opp } = useStore();
  const [whose, setWhose] = useState<'me' | 'opp'>('me');
  const [back, setBack] = useState(false);
  if (!mine || !opp) return null;
  const mission = whose === 'me' ? missionFor(mine, opp) : missionFor(opp, mine);
  const img = back && mission.back ? mission.back : mission.image;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="mission-view" onClick={(e) => e.stopPropagation()}>
        <div className="mission-tools">
          <div className="segmented small">
            <button className={whose === 'me' ? 'on' : ''} onClick={() => { setWhose('me'); setBack(false); }}>Ma mission</button>
            <button className={whose === 'opp' ? 'on' : ''} onClick={() => { setWhose('opp'); setBack(false); }}>Adversaire</button>
          </div>
          {mission.back && (
            <button className="btn ghost small" onClick={() => setBack(!back)}>
              ↻ {back ? 'Recto' : 'Verso'}
            </button>
          )}
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">✕</button>
        </div>
        {img && <img key={img} className="mission-card" src={asset(img)} alt={mission.name} />}
      </div>
    </div>
  );
}
