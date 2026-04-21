import { Calendar, Plus, Users, ClipboardList, Settings } from 'lucide-react';

interface Props {
  onNewOrder: () => void;
}

export default function Sidebar({ onNewOrder }: Props) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <ClipboardList size={24} />
        <span>FieldService</span>
      </div>

      <nav className="sidebar-nav">
        <button className="nav-item active" title="Kalendarz">
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
        <button className="nav-item" title="Ustawienia">
          <Settings size={20} />
          <span>Ustawienia</span>
        </button>
      </nav>
    </aside>
  );
}
