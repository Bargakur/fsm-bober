import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Treatment, Technician, CreateOrderDto, CreateOrderResponse } from '../types';
import { getTreatments, getTechnicians, createOrder, assignTechnician } from '../services/api';
import AddressInput from './AddressInput';

interface Props {
  initialDate?: string;
  initialTechnicianId?: number;
  initialAddress?: string;
  initialLat?: number;
  initialLng?: number;
  initialTreatmentId?: number;
  onClose: () => void;
  onCreated: (response: CreateOrderResponse) => void;
}

export default function OrderForm({ initialDate, initialTechnicianId, initialAddress, initialLat, initialLng, initialTreatmentId, onClose, onCreated }: Props) {
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<number | undefined>(initialTechnicianId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    customerName: '',
    customerPhone: '',
    contactPhone: '',
    address: initialAddress || '',
    addressLat: initialLat ?? null as number | null,
    addressLng: initialLng ?? null as number | null,
    treatmentId: initialTreatmentId || 0,
    scope: '',
    duration: '',
    price: '',
    scheduledDate: initialDate?.split('T')[0] || new Date().toISOString().split('T')[0],
    scheduledStart: initialDate?.split('T')[1]?.substring(0, 5) || '09:00',
    paymentMethod: 'transfer',
    notes: '',
  });

  useEffect(() => {
    getTreatments().then(setTreatments).catch(() => {});
    getTechnicians().then(setTechnicians).catch(() => {});
  }, []);

  const set = (field: string, value: string | number) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    if (!form.customerName || !form.customerPhone || !form.address || !form.treatmentId || !form.duration || !form.price) {
      setError('Wypełnij wymagane pola: imię, telefon, adres, rodzaj zabiegu, czas, cena');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const dto: CreateOrderDto = {
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        contactPhone: form.contactPhone || undefined,
        address: form.address,
        treatmentId: form.treatmentId,
        scope: form.scope || undefined,
        durationOverride: Number(form.duration),
        priceOverride: Number(form.price),
        scheduledDate: form.scheduledDate,
        scheduledStart: form.scheduledStart + ':00',
        paymentMethod: form.paymentMethod,
        notes: form.notes || undefined,
        lat: form.addressLat ?? undefined,
        lng: form.addressLng ?? undefined,
      };

      const response = await createOrder(dto);
      if (selectedTechnicianId) {
        await assignTechnician(response.order.id, selectedTechnicianId);
        response.order.technicianId = selectedTechnicianId;
        response.order.status = 'assigned';
      }
      onCreated(response);
    } catch (err: any) {
      setError(err.message || 'Błąd tworzenia zlecenia');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Nowe zlecenie</h2>
          <button className="btn-icon" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="form-grid">
          {/* --- Dane klienta --- */}
          <div className="form-section-label">Dane klienta</div>

          <div className="field">
            <label>Imię i nazwisko *</label>
            <input
              type="text"
              placeholder="Jan Kowalski"
              value={form.customerName}
              onChange={e => set('customerName', e.target.value)}
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label>Telefon *</label>
              <input
                type="tel"
                placeholder="+48 500 100 200"
                value={form.customerPhone}
                onChange={e => set('customerPhone', e.target.value)}
              />
            </div>
            <div className="field">
              <label>Tel. kontaktowy (jeśli inny)</label>
              <input
                type="tel"
                placeholder="Opcjonalnie"
                value={form.contactPhone}
                onChange={e => set('contactPhone', e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label>Adres zabiegu *</label>
            <AddressInput
              value={form.address}
              lat={form.addressLat}
              lng={form.addressLng}
              onChange={(address, lat, lng) =>
                setForm(prev => ({ ...prev, address, addressLat: lat, addressLng: lng }))
              }
            />
          </div>

          {/* --- Zabieg --- */}
          <div className="form-section-label">Zabieg</div>

          <div className="field">
            <label>Rodzaj zabiegu *</label>
            <select
              value={form.treatmentId}
              onChange={e => {
                const id = Number(e.target.value);
                setForm(prev => ({
                  ...prev,
                  treatmentId: id,
                }));
              }}
            >
              <option value={0}>— Wybierz zabieg —</option>
              {treatments.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field-row">
            <div className="field">
              <label>Czas trwania (min) *</label>
              <input
                type="number"
                min="15"
                step="15"
                placeholder="np. 60"
                value={form.duration}
                onChange={e => set('duration', e.target.value)}
              />
            </div>
            <div className="field">
              <label>Cena (zł) *</label>
              <input
                type="number"
                min="0"
                step="50"
                placeholder="np. 350"
                value={form.price}
                onChange={e => set('price', e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label>Zakres zabiegu</label>
            <textarea
              value={form.scope}
              onChange={e => set('scope', e.target.value)}
              rows={2}
              placeholder="Np. Mieszkanie 3-pokojowe, 65m², kuchnia i łazienka"
            />
          </div>

          {/* --- Technik --- */}
          <div className="form-section-label">Technik</div>

          <div className="field">
            <label>Przypisany technik</label>
            <select
              value={selectedTechnicianId ?? 0}
              onChange={e => {
                const val = Number(e.target.value);
                setSelectedTechnicianId(val || undefined);
              }}
            >
              <option value={0}>— Bez przypisania (szkic) —</option>
              {technicians.map(t => (
                <option key={t.id} value={t.id}>{t.fullName}</option>
              ))}
            </select>
          </div>

          {/* --- Termin --- */}
          <div className="form-section-label">Termin</div>

          <div className="field-row">
            <div className="field">
              <label>Data *</label>
              <input
                type="date"
                value={form.scheduledDate}
                onChange={e => set('scheduledDate', e.target.value)}
              />
            </div>
            <div className="field">
              <label>Godzina rozpoczęcia *</label>
              <input
                type="time"
                value={form.scheduledStart}
                onChange={e => set('scheduledStart', e.target.value)}
              />
            </div>
          </div>

          {/* --- Płatność i uwagi --- */}
          <div className="field">
            <label>Forma płatności</label>
            <select
              value={form.paymentMethod}
              onChange={e => set('paymentMethod', e.target.value)}
            >
              <option value="transfer">Przelew</option>
              <option value="cash">Gotówka</option>
              <option value="card">Karta</option>
            </select>
          </div>

          <div className="field">
            <label>Uwagi dla technika</label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={2}
              placeholder="Opcjonalne uwagi..."
            />
          </div>
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Anuluj</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Tworzenie...' : 'Utwórz zlecenie'}
          </button>
        </div>
      </div>
    </div>
  );
}
