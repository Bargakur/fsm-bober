import { useState, useEffect } from 'react';
import { UserPlus, Pencil, Trash2, X, Check, RotateCcw } from 'lucide-react';
import { getTechnicians, createTechnician, updateTechnician, deleteTechnician } from '../services/api';
import type { Technician } from '../types';
import type { CreateTechnicianDto } from '../services/api';

const EMPTY_FORM: CreateTechnicianDto = {
  fullName: '',
  phone: '',
  homeLat: 52.2297,
  homeLng: 21.0122,
  skills: '',
};

export default function AdminPanel() {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<CreateTechnicianDto>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadTechnicians = async () => {
    try {
      setLoading(true);
      const data = await getTechnicians(true); // include inactive
      setTechnicians(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTechnicians(); }, []);

  // Auto-hide success message
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const openNewForm = () => {
    setForm(EMPTY_FORM);
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
      skills: tech.skills,
    });
    setEditingId(tech.id);
    setShowForm(true);
    setError('');
  };

  const handleSave = async () => {
    if (!form.fullName.trim() || !form.phone.trim()) {
      setError('Imię i telefon są wymagane');
      return;
    }

    setSaving(true);
    setError('');

    try {
      if (editingId) {
        await updateTechnician(editingId, form);
        setSuccess('Technik zaktualizowany');
      } else {
        await createTechnician(form);
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
                <label>Umiejętności</label>
                <input
                  type="text"
                  value={form.skills}
                  onChange={e => setForm({ ...form, skills: e.target.value })}
                  placeholder="np. ddd,dezynsekcja"
                />
                <span className="field-hint">Oddzielone przecinkami. Dostępne: ddd, dezynsekcja</span>
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

      {/* Tabela techników */}
      {loading ? (
        <div className="admin-loading">Ładowanie...</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Imię i nazwisko</th>
                <th>Telefon</th>
                <th>Umiejętności</th>
                <th>Lokalizacja</th>
                <th>Status</th>
                <th>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {technicians.map(tech => (
                <tr key={tech.id} className={!tech.isActive ? 'row-inactive' : ''}>
                  <td className="td-name">{tech.fullName}</td>
                  <td>{tech.phone}</td>
                  <td>
                    <div className="skill-tags">
                      {tech.skills.split(',').filter(Boolean).map(s => (
                        <span key={s} className="skill-tag">{s.trim()}</span>
                      ))}
                    </div>
                  </td>
                  <td className="td-coords">
                    {tech.homeLat.toFixed(4)}, {tech.homeLng.toFixed(4)}
                  </td>
                  <td>
                    <span className={`status-badge ${tech.isActive ? 'status-active' : 'status-inactive'}`}>
                      {tech.isActive ? 'Aktywny' : 'Nieaktywny'}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn-icon"
                        title="Edytuj"
                        onClick={() => openEditForm(tech)}
                      >
                        <Pencil size={16} />
                      </button>

                      {tech.isActive ? (
                        deletingId === tech.id ? (
                          <div className="confirm-delete">
                            <span className="confirm-text">Usunąć?</span>
                            <button
                              className="btn-icon btn-icon-danger"
                              title="Potwierdź"
                              onClick={() => handleDelete(tech.id)}
                            >
                              <Check size={16} />
                            </button>
                            <button
                              className="btn-icon"
                              title="Anuluj"
                              onClick={() => setDeletingId(null)}
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <button
                            className="btn-icon btn-icon-danger"
                            title="Dezaktywuj"
                            onClick={() => setDeletingId(tech.id)}
                          >
                            <Trash2 size={16} />
                          </button>
                        )
                      ) : (
                        <button
                          className="btn-icon btn-icon-success"
                          title="Aktywuj ponownie"
                          onClick={() => handleReactivate(tech)}
                        >
                          <RotateCcw size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
