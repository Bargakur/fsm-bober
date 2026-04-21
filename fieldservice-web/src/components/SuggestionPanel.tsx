import { useState } from 'react';
import { MapPin, Clock, CheckCircle, AlertTriangle, User } from 'lucide-react';
import type { Order, TechnicianSuggestion } from '../types';
import { assignTechnician } from '../services/api';

interface Props {
  order: Order;
  suggestions: TechnicianSuggestion[];
  onAssigned: () => void;
  onClose: () => void;
}

export default function SuggestionPanel({ order, suggestions, onAssigned, onClose }: Props) {
  const [assigning, setAssigning] = useState<number | null>(null);

  const handleAssign = async (technicianId: number) => {
    setAssigning(technicianId);
    try {
      await assignTechnician(order.id, technicianId);
      onAssigned();
    } catch (err) {
      console.error('Assignment failed:', err);
    } finally {
      setAssigning(null);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Przypisz technika</h2>
            <p className="modal-subtitle">
              {order.treatment?.name} — {order.customerName}
              · {order.scheduledDate} {order.scheduledStart}
            </p>
          </div>
        </div>

        <div className="suggestions-list">
          {suggestions.length === 0 && (
            <div className="empty-state">
              Brak dostępnych techników na ten termin
            </div>
          )}

          {suggestions.map((s) => (
            <div
              key={s.technicianId}
              className={`suggestion-card suggestion-${s.fitLevel}`}
            >
              <div className="suggestion-main">
                <div className="suggestion-name">
                  {s.fitLevel === 'recommended' && <CheckCircle size={16} className="icon-success" />}
                  {s.fitLevel === 'warning' && <AlertTriangle size={16} className="icon-warning" />}
                  {s.fitLevel === 'available' && <User size={16} className="icon-neutral" />}
                  <span>{s.fullName}</span>
                </div>
                <div className="suggestion-details">
                  <span className="detail">
                    <MapPin size={14} />
                    {s.distanceKm} km
                  </span>
                  <span className="detail">
                    <Clock size={14} />
                    ~{s.estimatedMinutes} min dojazdu
                  </span>
                  {s.availableFrom && s.availableTo && (
                    <span className="detail">
                      Dostępny {s.availableFrom.substring(0, 5)}–{s.availableTo.substring(0, 5)}
                    </span>
                  )}
                  <span className="detail">
                    {s.ordersToday} zlec. dziś
                  </span>
                </div>
              </div>
              <button
                className="btn btn-assign"
                onClick={() => handleAssign(s.technicianId)}
                disabled={assigning !== null}
              >
                {assigning === s.technicianId ? 'Przypisuję...' : 'Wybierz'}
              </button>
            </div>
          ))}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Zamknij</button>
        </div>
      </div>
    </div>
  );
}
