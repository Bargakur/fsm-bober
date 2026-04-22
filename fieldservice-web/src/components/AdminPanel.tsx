import { useState, useEffect } from 'react';
import { UserPlus, Pencil, Trash2, X, Check, RotateCcw, ChevronDown, ChevronRight, Phone, MapPin, Wrench } from 'lucide-react';
import { getTechnicians, createTechnician, updateTechnician, deleteTechnician } from '../services/api';
import type { Technician } from '../types';
import type { CreateTechnicianDto } from '../services/api';

const SPECIALIZATION_OPTIONS = ['drabina', 'osy', 'szerszenie'] as const;

const EMPTY_FORM: CreateTechnicianDto = {
  fullName: '',
  phone: '',
  homeLat: 52.2297,
  homeLng: 21.0122,
  specializations: '',
};

export default function AdminPanel() {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Expanded row
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<CreateTechnicianDto>(EMPTY_FORM);
  const [selectedSpecs, setSelectedSpecs] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadTechnicians = async () => {
    try {
      setLoading(true);
      const data = await getTechnicians(true);
      setTechnicians(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTechnicians(); }, []);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
    setDeletingId(null);
  };

  const openNewForm = () => {
    setForm(EMPTY_FORM);
    setSelectedSpecs([]);
    setEditingId(null);
    setShowForm(true);
    setError('');
  };

  const openEditForm = (tech: Technician) => {
    setForm({
      fullName: tech.fullName,
      phone: tech.phone,
      homeLat: tech.homeLat,
      homeLng: tech.homeLng,
      specializations: tech.specializations,
    });
    setSelectedSpecs(tech.specializations ? tech.specializations.split(',').filter(Boolean) : []);
    setEditingId(tech.id);
    setShowForm(true);
    setError('');
  };

  const toggleSpec = (spec: string) => {
    setSelectedSpecs(prev =>
      prev.includes(spec) ? prev.filter(s => s !== spec) : [...prev, spec]
    );
  };

  const handleSave = async () => {
    if (!form.fullName.trim() || !form.phone.trim()) {
      setError('Imię i telefon są wymagane');
      return;
    }

    setSaving(true);
    setError('');

    const payload = { ...form, specializations: selectedSpecs.join(',') };

    try {
      if (editingId) {
        await updateTechnician(editingId, payload);
        setSuccess('Technik zaktualizowany');
      } else {
        await createTechnician(payload);
        setSuccess('Technik dodany');
      }
      setShowForm(false);
      setEditingId(null);
      await loadTechnicians();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteTechnician(id);
      setDeletingId(null);
      setExpandedId(null);
      setSuccess('Technik dezaktywowany');
      await loadTechnicians();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleReactivate = async (tech: Technician) => {
    try {
      await updateTechnician(tech.id, { isActive: true });
      setSuccess(`${tech.fullName} ponownie aktywny`);
      await loadTechnicians();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <div>
          <h2>Zarządzanie technikami</h2>
          <p className="admin-subtitle">Dodawaj, edytuj i zarządzaj technikami w systemie</p>
        </div>
        <button className="btn btn-primary" onClick={openNewForm}>
          <UserPlus size={16} />
          Dodaj technika
        </button>
      </div>

      {error && <div className="admin-alert admin-alert-error">{error}</div>}
      {success && <div className="admin-alert admin-alert-success">{success}</div>}

      {/* Modal — formularz dodawania/edycji */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingId ? 'Edytuj technika' : 'Nowy technik'}</h2>
              <button className="btn-icon" onClick={() => setShowForm(false)}><X size={18} /></button>
            </div>

            <div className="form-grid">
              <div className="field">
                <label>Imię i nazwisko</label>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={e => setForm({ ...form, fullName: e.target.value })}
                  placeholder="np. Jan Kowalski"
                  autoFocus
                />
              </div>

              <div className="field">
                <label>Telefon</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  placeholder="np. +48 600 100 200"
                />
              </div>

              <div className="field">
                <label>Co robi</label>
                <div className="spec-checkboxes">
                  {SPECIALIZATION_OPTIONS.map(spec => (
                    <label key={spec} className="spec-checkbox-item">
                      <input
                        type="checkbox"
                        checked={selectedSpecs.includes(spec)}
                        onChange={() => toggleSpec(spec)}
                      />
                      <span className="spec-checkbox-label">{spec}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-section-label">Lokalizacja domu (GPS)</div>
              <div className="field-row">
                <div className="field">
                  <label>Szerokość (lat)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={form.homeLat}
                    onChange={e => setForm({ ...form, homeLat: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="field">
                  <label>Długość (lng)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={form.homeLng}
                    onChange={e => setForm({ ...form, homeLng: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Anuluj</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Zapisywanie...' : (editingId ? 'Zapisz zmiany' : 'Dodaj technika')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista techników */}
      {loading ? (
        <div className="admin-loading">Ładowanie...</div>
      ) : (
        <div className="tech-list">
          {technicians.map(tech => {
            const isExpanded = expandedId === tech.id;
            const specs = tech.specializations?.split(',').filter(Boolean) || [];

            return (
              <div
                key={tech.id}
                className={`tech-card ${!tech.isActive ? 'tech-card-inactive' : ''} ${isExpanded ? 'tech-card-expanded' : ''}`}
              >
                {/* Kompaktowy wiersz — imię + telefon */}
                <div className="tech-card-header" onClick={() => toggleExpand(tech.id)}>
                  <div className="tech-card-chevron">
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </div>
                  <div className="tech-card-summary">
                    <span className="tech-card-name">{tech.fullName}</span>
                    {!tech.isActive && <span className="tech-card-badge-inactive">nieaktywny</span>}
                  </div>
                  <span className="tech-card-phone">{tech.phone}</span>
                </div>

                {/* Rozwinięte szczegóły */}
                {isExpanded && (
                  <div className="tech-card-details">
                    <div className="tech-detail-grid">
                      <div className="tech-detail-item">
                        <Wrench size={14} />
                        <div>
                          <span className="tech-detail-label">Co robi</span>
                          <div className="tech-detail-value">
                            {specs.length > 0 ? (
                              <div className="skill-tags">
                                {specs.map(s => <span key={s} className="skill-tag">{s}</span>)}
                              </div>
                            ) : (
                              <span className="text-muted">Nie ustawiono</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="tech-detail-item">
                        <MapPin size={14} />
                        <div>
                          <span className="tech-detail-label">Lokalizacja domu</span>
                          <span className="tech-detail-value tech-detail-coords">
                            {tech.homeLat.toFixed(4)}, {tech.homeLng.toFixed(4)}
                          </span>
                        </div>
                      </div>

                      <div className="tech-detail-item">
                        <Phone size={14} />
                        <div>
                          <span className="tech-detail-label">Telefon</span>
                          <span className="tech-detail-value">{tech.phone}</span>
                        </div>
                      </div>
                    </div>

                    <div className="tech-card-actions">
                      <button className="btn btn-secondary btn-sm" onClick={() => openEditForm(tech)}>
                        <Pencil size={14} />
                        Edytuj
                      </button>

                      {tech.isActive ? (
                        deletingId === tech.id ? (
                          <div className="confirm-delete">
                            <span className="confirm-text">Na pewno dezaktywować?</span>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(tech.id)}>
                              <Check size={14} />
                              Tak
                            </button>
                            <button className="btn btn-secondary btn-sm" onClick={() => setDeletingId(null)}>
                              Nie
                            </button>
                          </div>
                        ) : (
                          <button className="btn btn-danger-outline btn-sm" onClick={() => setDeletingId(tech.id)}>
                            <Trash2 size={14} />
                            Dezaktywuj
                          </button>
                        )
                      ) : (
                        <button className="btn btn-success-outline btn-sm" onClick={() => handleReactivate(tech)}>
                          <RotateCcw size={14} />
                          Aktywuj ponownie
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
