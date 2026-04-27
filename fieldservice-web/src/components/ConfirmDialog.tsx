import { AlertTriangle } from 'lucide-react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

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
  // Esc → cancel, Enter → confirm. Pomijamy gdy busy — nie chcemy zostawić wiszącego
  // requestu ani odpalić drugiego przez przypadkowy double-tap Entera.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (busy) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel, onConfirm]);

  if (!open) return null;

  // Portal do <body>, żeby zdarzenia nie bublowały do żadnego rodzica (np. OrderDetail
  // overlay z `onClick={onClose}`). Bez tego klik na overlay confirma zamykał także
  // outer modal — confirm znikał razem ze swoim hostem i delete nigdy się nie kończył.
  return createPortal(
    <div
      className="modal-overlay"
      onClick={(e) => {
        // Defensywnie: nawet w portalu zatrzymujemy propagację — gdyby ktoś w przyszłości
        // umieścił globalny listener na document.
        e.stopPropagation();
        if (!busy) onCancel();
      }}
      // z-index z .modal-overlay = 1000; ten dialog jest często otwierany NA innym modalu
      // (np. OrderDetail). Lekki bump żeby leżeć ZAWSZE wyżej.
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
    </div>,
    document.body,
  );
}
