import { useState } from 'react';
import { X, MapPin, Clock, User, CreditCard, FileText, Phone, ClipboardList, Trash2 } from 'lucide-react';
import type { Order } from '../types';
import { deleteOrder } from '../services/api';
import ConfirmDialog from './ConfirmDialog';

interface Props {
  order: Order;
  onClose: () => void;
  onAssign: (order: Order) => void;
  /** Wywoływane po pomyślnym usunięciu — App.tsx zamyka modal i bumpuje refreshKey. */
  onDeleted: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Szkic',
  assigned: 'Przypisane',
  in_progress: 'W trakcie',
  completed: 'Zakończone',
  cancelled: 'Anulowane',
};

export default function OrderDetail({ order, onClose, onAssign, onDeleted }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Backend blokuje completed (409). UI powinno też ukryć przycisk, żeby user nie próbował
  // i nie widział czerwonego banera "Conflict". Anulowanie idzie osobnym flow (nie tutaj).
  const canDelete = order.status !== 'completed';

  const handleConfirmDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteOrder(order.id);
      // Zamknięcie dialogu + parent decyduje co dalej (zamknij modal + odśwież kalendarz).
      setConfirmOpen(false);
      onDeleted();
    } catch (err) {
      // Backend zwraca 409 dla completed — gdyby ktoś obszedł canDelete, pokaż komunikat.
      const msg = err instanceof Error ? err.message : 'Nieznany błąd';
      setDeleteError(msg);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Zlecenie #{order.id}</h2>
          <button className="btn-icon" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="detail-grid">
          <div className="detail-row">
            <span className={`status-badge status-${order.status}`}>
              {STATUS_LABELS[order.status] || order.status}
            </span>
          </div>

          <div className="detail-row">
            <User size={16} />
            <div>
              <strong>{order.customerName}</strong>
              <span className="detail-sub">{order.customerPhone}</span>
              {order.contactPhone && (
                <span className="detail-sub">Kontakt na miejscu: {order.contactPhone}</span>
              )}
            </div>
          </div>

          <div className="detail-row">
            <MapPin size={16} />
            <div>
              <a
                href={order.lat && order.lng
                  ? `https://www.google.com/maps?q=${order.lat},${order.lng}`
                  : `https://www.google.com/maps?q=${encodeURIComponent(order.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="detail-map-link"
              >
                {order.address}
              </a>
            </div>
          </div>

          <div className="detail-row">
            <FileText size={16} />
            <div>
              <strong>{order.treatment?.name}</strong>
              <span className="detail-sub">
                {order.treatment?.durationMinutes} min · {order.price} zł
              </span>
            </div>
          </div>

          {order.scope && (
            <div className="detail-row">
              <ClipboardList size={16} />
              <div>
                <strong>Zakres</strong>
                <span className="detail-sub">{order.scope}</span>
              </div>
            </div>
          )}

          <div className="detail-row">
            <Clock size={16} />
            <div>
              <strong>{order.scheduledDate}</strong>
              <span className="detail-sub">
                {order.scheduledStart?.substring(0, 5)} – {order.scheduledEnd?.substring(0, 5)}
              </span>
            </div>
          </div>

          <div className="detail-row">
            <Phone size={16} />
            <div>
              {order.technician
                ? <strong>{order.technician.fullName}</strong>
                : <em className="text-muted">Brak przypisanego technika</em>}
            </div>
          </div>

          {order.paymentMethod && (
            <div className="detail-row">
              <CreditCard size={16} />
              <span>{order.paymentMethod === 'transfer' ? 'Przelew' :
                     order.paymentMethod === 'cash' ? 'Gotówka' : 'Karta'}</span>
            </div>
          )}

          {order.createdBy && (
            <div className="detail-row">
              <User size={16} />
              <div>
                <strong>Zapisał/a</strong>
                <span className="detail-sub">{order.createdBy.fullName}</span>
              </div>
            </div>
          )}

          {order.notes && (
            <div className="detail-notes">
              <strong>Uwagi:</strong>
              <p>{order.notes}</p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {canDelete && (
            <button
              className="btn btn-danger-outline"
              onClick={() => setConfirmOpen(true)}
              // Wyrównanie do lewej — separator wizualny od pozytywnych akcji po prawej.
              style={{ marginRight: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Trash2 size={16} />
              Usuń
            </button>
          )}
          <button className="btn btn-secondary" onClick={onClose}>Zamknij</button>
          {order.status === 'draft' && (
            <button className="btn btn-primary" onClick={() => onAssign(order)}>
              Przypisz technika
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Usunąć zlecenie?"
        message={`Zlecenie #${order.id} (${order.customerName}) zostanie trwale usunięte wraz z protokołem i płatnością. Tej operacji nie można cofnąć.`}
        confirmLabel="Usuń"
        cancelLabel="Anuluj"
        destructive
        busy={deleting}
        error={deleteError}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          if (deleting) return;
          setConfirmOpen(false);
          setDeleteError(null);
        }}
      />
    </div>
  );
}
