import { Calendar, Plus, Users, ClipboardList, Settings, ShieldCheck } from 'lucide-react';

type View = 'calendar' | 'admin';

interface Props {
  onNewOrder: () => void;
  currentView: View;
  onViewChange: (view: View) => void;
  userRole?: string;
}

const ADMIN_ROLES = ['admin', 'superadmin', 'supervisor'];

export default function Sidebar({ onNewOrder, currentView, onViewChange, userRole }: Props) {
  const isAdmin = userRole ? ADMIN_ROLES.includes(userRole) : false;

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <ClipboardList size={24} />
        <span>FSM Bober</span>
      </div>

      <nav className="sidebar-nav">
        <button
          className={`nav-item ${currentView === 'calendar' ? 'active' : ''}`}
          title="Kalendarz"
          onClick={() => onViewChange('calendar')}
        >
          <Calendar size={20} />
          <span>Kalendarz</span>
        </button>
        <button className="nav-item" onClick={onNewOrder} title="Nowe zlecenie">
          <Plus size={20} />
          <span>Nowe zlecenie</span>
        </button>
        <button className="nav-item" title="Technicy">
          <Users size={20} />
          <span>Technicy</span>
        </button>

        {isAdmin && (
          <button
            className={`nav-item ${currentView === 'admin' ? 'active' : ''}`}
            title="Administracja"
            onClick={() => onViewChange('admin')}
          >
            <ShieldCheck size={20} />
            <span>Administracja</span>
          </button>
        )}

        <button className="nav-item" title="Ustawienia">
          <Settings size={20} />
          <span>Ustawienia</span>
        </button>
      </nav>
    </aside>
  );
}
