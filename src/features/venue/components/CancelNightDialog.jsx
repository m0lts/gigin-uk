import { useState } from 'react';
import { cancelNightSummary } from '../gigs/utils/nightCancel';

export function CancelNightDialog({ accepted = 0, waiting = 0, busy = false, onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  return (
    <div
      className="modal cancel-gig"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-night-title"
    >
      <div className="modal-content" onClick={(event) => event.stopPropagation()}>
        <h3 id="cancel-night-title">Cancel night?</h3>
        <p>{cancelNightSummary(accepted, waiting)}</p>
        <label style={{ display: 'block', marginTop: '1rem' }}>
          Shown to artists in the email
          <textarea
            value={reason}
            rows={3}
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
            style={{ display: 'block', width: '100%', marginTop: '0.35rem' }}
          />
        </label>
        <div className="two-buttons" style={{ marginTop: '1rem' }}>
          <button type="button" className="btn tertiary" onClick={onClose} disabled={busy}>
            Keep night
          </button>
          <button
            type="button"
            className="btn danger"
            disabled={busy}
            onClick={() => onConfirm(reason.trim())}
          >
            Cancel night
          </button>
        </div>
      </div>
    </div>
  );
}
