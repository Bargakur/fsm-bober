import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { Order, Technician } from '../types';
import { getOrders, getTechnicians } from '../services/api';

interface Props {
  onDateSelect: (date: string) => void;
  onOrderClick: (order: Order) => void;
  refreshKey: number;
}

const STATUS_COLORS: Record<string, string> = {
  draft:       '#94a3b8',
  assigned:    '#3b82f6',
  in_progress: '#f59e0b',
  completed:   '#22c55e',
  cancelled:   '#ef4444',
};

const TECH_COLORS = [
  '#3b82f6', '#8b5cf6', '#06b6d4', '#10b981',
  '#f59e0b', '#ef4444', '#ec4899', '#6366f1',
];

export default function Calendar({ onDateSelect, onOrderClick, refreshKey }: Props) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [visibleTechIds, setVisibleTechIds] = useState<Set<number>>(new Set());
  const [showUnassigned, setShowUnassigned] = useState(true);

  // Przechowujemy zakres dat jako string, żeby uniknąć pętli
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null);
  const lastRangeKey = useRef('');

  useEffect(() => {
    getTechnicians().then(techs => {
      setTechnicians(techs);
      setVisibleTechIds(new Set(techs.map(t => t.id)));
    }).catch(() => {});
  }, []);

  const loadOrders = useCallback(async (startStr: string, endStr: string) => {
    const start = new Date(startStr);
    const end = new Date(endStr);
    const allOrders: Order[] = [];
    const d = new Date(start);

    while (d < end) {
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      try {
        const dayOrders = await getOrders(dateStr);
        allOrders.push(...dayOrders);
      } catch {
        // brak danych na ten dzień
      }
      d.setDate(d.getDate() + 1);
    }
    setOrders(allOrders);
  }, []);

  // Ładuj zlecenia gdy zmieni się zakres dat LUB refreshKey
  useEffect(() => {
    if (dateRange) {
      loadOrders(dateRange.start, dateRange.end);
    }
  }, [dateRange, refreshKey, loadOrders]);

  const handleDatesSet = useCallback((info: { startStr: string; endStr: string }) => {
    const key = `${info.startStr}|${info.endStr}`;
    if (key !== lastRangeKey.current) {
      lastRangeKey.current = key;
      setDateRange({ start: info.startStr, end: info.endStr });
    }
  }, []);

  const toggleTech = (id: number) => {
    setVisibleTechIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (visibleTechIds.size === technicians.length) {
      setVisibleTechIds(new Set());
    } else {
      setVisibleTechIds(new Set(technicians.map(t => t.id)));
    }
  };

  const getTechColor = useCallback((techId: number) => {
    const idx = technicians.findIndex(t => t.id === techId);
    return TECH_COLORS[idx % TECH_COLORS.length];
  }, [technicians]);

  const filteredOrders = orders.filter(o => {
    if (!o.technicianId) return showUnassigned;
    return visibleTechIds.has(o.technicianId);
  });

  const events = useMemo(() => filteredOrders.map(o => ({
    id: String(o.id),
    title: `${o.treatment?.name || 'Zabieg'} — ${o.customerName || 'Klient'}${o.technician ? ` [${o.technician.fullName.split(' ')[0]}]` : ''}`,
    start: `${o.scheduledDate}T${o.scheduledStart}`,
    end: `${o.scheduledDate}T${o.scheduledEnd}`,
    backgroundColor: o.technicianId ? getTechColor(o.technicianId) : STATUS_COLORS[o.status] || '#94a3b8',
    borderColor: 'transparent',
    extendedProps: { order: o },
  })), [filteredOrders, getTechColor]);

  return (
    <div className="calendar-with-filters">
      {/* Panel techników */}
      <div className="tech-filter-panel">
        <div className="tech-filter-header">
          <span className="tech-filter-title">Technicy</span>
          <button className="tech-toggle-all" onClick={toggleAll}>
            {visibleTechIds.size === technicians.length ? 'Odznacz' : 'Zaznacz'} wszystkich
          </button>
        </div>

        <label className="tech-filter-item">
          <input
            type="checkbox"
            checked={showUnassigned}
            onChange={() => setShowUnassigned(!showUnassigned)}
          />
          <span className="tech-color-dot" style={{ background: '#94a3b8' }} />
          <span className="tech-filter-name">Nieprzypisane</span>
        </label>

        {technicians.map(t => (
          <label key={t.id} className="tech-filter-item">
            <input
              type="checkbox"
              checked={visibleTechIds.has(t.id)}
              onChange={() => toggleTech(t.id)}
            />
            <span className="tech-color-dot" style={{ background: getTechColor(t.id) }} />
            <span className="tech-filter-name">{t.fullName}</span>
          </label>
        ))}
      </div>

      {/* Kalendarz */}
      <div className="calendar-wrap" style={{ flex: 1 }}>
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          locale="pl"
          firstDay={1}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'timeGridDay,timeGridWeek,dayGridMonth'
          }}
          slotMinTime="06:00:00"
          slotMaxTime="20:00:00"
          slotDuration="00:30:00"
          allDaySlot={false}
          height="auto"
          events={events}
          selectable={true}
          select={(info) => onDateSelect(info.startStr)}
          eventClick={(info) => {
            const order = info.event.extendedProps.order as Order;
            onOrderClick(order);
          }}
          datesSet={handleDatesSet}
        />
      </div>
    </div>
  );
}
