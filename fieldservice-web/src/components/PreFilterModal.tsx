import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Treatment } from '../types';
import { getTreatments } from '../services/api';
import AddressInput from './AddressInput';

export interface PreFilterResult {
  address: string;
  lat: number;
  lng: number;
  treatmentId: number;
  treatment: Treatment;
}

interface Props {
  onFilter: (result: PreFilterResult) => void;
  onClose: () => void;
}

export default function PreFilterModal({ onFilter, onClose }: Props) {
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [treatmentId, setTreatmentId] = useState(0);

  useEffect(() => {
    getTreatments().then(setTreatments).catch(() => {});
  }, []);

  const selectedTreatment = treatments.find(t => t.id === treatmentId);
  const canSubmit = address && lat !== null && lng !== null && treatmentId > 0 && selectedTreatment;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onFilter({
      address,
      lat: lat!,
      lng: lng!,
      treatmentId,
      treatment: selectedTreatment!,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Nowe zlecenie</h2>
          <button className="btn-icon" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="form-grid">
          <div className="field">
            <label>Adres zabiegu *</label>
            <AddressInput
              value={address}
              lat={lat}
              lng={lng}
              onChange={(addr, newLat, newLng) => {
                setAddress(addr);
                setLat(newLat);
                setLng(newLng);
              }}
            />
          </div>

          <div className="field">
            <label>Rodzaj zabiegu *</label>
            <select
              value={treatmentId}
              onChange={e => setTreatmentId(Number(e.target.value))}
            >
              <option value={0}>— Wybierz zabieg —</option>
              {treatments.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Anuluj</button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            Pokaż dostępnych techników
          </button>
        </div>
      </div>
    </div>
  );
}
