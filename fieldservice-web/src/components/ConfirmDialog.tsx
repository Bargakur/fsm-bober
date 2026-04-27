import { AlertTriangle } from 'lucide-react';
import { useEffect } from 'react';

/**
 * Reusable confirmation dialog — modal w stylu reszty aplikacji.
 *
 * Uzasadnienie: dla destruktywnych akcji (delete) inline confirm "Na pewno?" w wierszu
 * (jak w AdminPanel) jest OK przy liście, ale w detalu zlecenia user już patrzy na
 * pełnoekranowy modal. Drugi modal nad nim wymusza świadomy klik i ucina przypadkowe
 * trafienia w "Usuń" przy szybkim scrollu.
 *
 * Zachowanie:
 * - ESC zamyka (jeśli nie `busy`).
 * - Kliknięcie w overlay zamyka (jeśli nie `busy`).
 * - `busy` blokuje przyciski podczas wywołania backendu — zapobiega double-clickom.
 * - `destructive` przełącza wariant przycisku potwierdzenia na czerwony (btn-danger).
 */
interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Potwierdź',
  cancelLabel = 'Anuluj',
  destructive = false,
  busy = false,
  error = null,
  onConfirm,
  onCancel,
}: Props) {
  // Esc → cancel. Pomijamy gdy busy, żeby nie zostawić wiszącego requestu bez UI feedbacku.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      onClick={() => { if (!busy) onCancel(); }}
      // z-index z .modal-overlay = 1000; ten dialog jest często otwierany NA innym modalu
      // (np. OrderDetail). Lekki bump żeby nie kombinować z porting kolejności DOM.
      style={{ zIndex: 1100 }}
    >
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 420 }}
      >
        <div className="modal-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {destructive && <AlertTriangle size={18} style={{ color: 'var(--danger)' }} />}
            {title}
          </h2>
        </div>

        <div style={{ padding: '4px 24px 8px', fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}>
          {message}
        </div>

        {error && (
          <div style={{ padding: '8px 24px', fontSize: 13, color: 'var(--danger)' }}>
            {error}
          </div>
        )}

        <div className="modal-footer">
          <button
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            className={destructive ? 'btn btn-danger' : 'btn btn-primary'}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Czekaj…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
