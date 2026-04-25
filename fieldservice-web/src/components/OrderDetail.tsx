import { X, MapPin, Clock, User, CreditCard, FileText, Phone, ClipboardList } from 'lucide-react';
import type { Order } from '../types';

interface Props {
  order: Order;
  onClose: () => void;
  onAssign: (order: Order) => void;
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Szkic',
  assigned: 'Przypisane',
  in_progress: 'W trakcie',
  completed: 'Zakończone',
  cancelled: 'Anulowane',
};

export default function OrderDetail({ order, onClose, onAssign }: Props) {
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
          <button className="btn btn-secondary" onClick={onClose}>Zamknij</button>
          {order.status === 'draft' && (
            <button className="btn btn-primary" onClick={() => onAssign(order)}>
              Przypisz technika
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
