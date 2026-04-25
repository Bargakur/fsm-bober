import { useEffect, useState, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Order, Technician, TechnicianAvailability } from '../types';
import { getOrders, getTechnicians, getBulkAvailability } from '../services/api';

interface Props {
  onDateSelect: (date: string, technicianId?: number) => void;
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

const SLOT_HEIGHT = 24; // px per 15min slot
const START_HOUR = 6;
const END_HOUR = 20;
const TOTAL_SLOTS = (END_HOUR - START_HOUR) * 4; // 15-min slots

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDatePL(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const days = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
  const months = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca',
    'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function timeToSlotOffset(time: string): number {
  const mins = timeToMinutes(time);
  return ((mins - START_HOUR * 60) / 15) * SLOT_HEIGHT;
}

function timeDurationPx(start: string, end: string): number {
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  return ((e - s) / 15) * SLOT_HEIGHT;
}

/** Oblicz pozycje kolumn dla nakładających się zleceń */
function layoutOverlapping(orders: Order[]): Map<number, { col: number; totalCols: number }> {
  const sorted = [...orders].sort((a, b) =>
    timeToMinutes(a.scheduledStart) - timeToMinutes(b.scheduledStart)
  );

  // Grupuj w klastry nakładających się zleceń
  const clusters: Order[][] = [];
  for (const order of sorted) {
    const start = timeToMinutes(order.scheduledStart);
    let placed = false;
    for (const cluster of clusters) {
      const clusterEnd = Math.max(...cluster.map(o => timeToMinutes(o.scheduledEnd)));
      if (start < clusterEnd) {
        cluster.push(order);
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push([order]);
  }

  const result = new Map<number, { col: number; totalCols: number }>();

  for (const cluster of clusters) {
    // Greedy column assignment wewnątrz klastra
    const cols: Order[][] = [];
    for (const order of cluster) {
      const start = timeToMinutes(order.scheduledStart);
      let placed = false;
      for (let c = 0; c < cols.length; c++) {
        const lastInCol = cols[c][cols[c].length - 1];
        if (timeToMinutes(lastInCol.scheduledEnd) <= start) {
          cols[c].push(order);
          result.set(order.id, { col: c, totalCols: 0 });
          placed = true;
          break;
        }
      }
      if (!placed) {
        result.set(order.id, { col: cols.length, totalCols: 0 });
        cols.push([order]);
      }
    }
    // Ustaw totalCols dla całego klastra
    for (const order of cluster) {
      const r = result.get(order.id)!;
      r.totalCols = cols.length;
    }
  }

  return result;
}

export default function ResourceCalendar({ onDateSelect, onOrderClick, refreshKey }: Props) {
  const [date, setDate] = useState(todayStr());
  const [orders, setOrders] = useState<Order[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [availability, setAvailability] = useState<TechnicianAvailability[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getTechnicians().then(setTechnicians).catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersData, availData] = await Promise.all([
        getOrders(date),
        getBulkAvailability(date),
      ]);
      setOrders(ordersData);
      setAvailability(availData);
    } catch {
      setOrders([]);
      setAvailability([]);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshKey]);

  // Mapa dostępności per technik
  const availByTech = useMemo(() => {
    const map = new Map<number, TechnicianAvailability>();
    availability.forEach(a => map.set(a.technicianId, a));
    return map;
  }, [availability]);

  const isToday = date === todayStr();

  // Grupuj zlecenia wg technika (+ nieprzypisane)
  const ordersByTech = useMemo(() => {
    const map = new Map<number | null, Order[]>();
    // Inicjalizuj dla każdego technika
    map.set(null, []); // nieprzypisane
    technicians.forEach(t => map.set(t.id, []));
    // Rozłóż zlecenia
    orders.forEach(o => {
      const key = o.technicianId ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(o);
    });
    return map;
  }, [orders, technicians]);

  // Kolumny: nieprzypisane + technicy
  const columns: { id: number | null; name: string; color: string }[] = useMemo(() => {
    const cols: { id: number | null; name: string; color: string }[] = [];

    // Nieprzypisane — tylko jeśli są takie zlecenia
    const unassigned = ordersByTech.get(null) || [];
    if (unassigned.length > 0) {
      cols.push({ id: null, name: 'Nieprzypisane', color: '#94a3b8' });
    }

    technicians.forEach((t, i) => {
      cols.push({ id: t.id, name: t.fullName, color: TECH_COLORS[i % TECH_COLORS.length] });
    });

    return cols;
  }, [technicians, ordersByTech]);

  // Generuj sloty czasowe
  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let h = START_HOUR; h < END_HOUR; h++) {
      slots.push(`${String(h).padStart(2, '0')}:00`);
      slots.push(`${String(h).padStart(2, '0')}:15`);
      slots.push(`${String(h).padStart(2, '0')}:30`);
      slots.push(`${String(h).padStart(2, '0')}:45`);
    }
    return slots;
  }, []);

  const handleColumnClick = (colId: number | null, slotTime: string) => {
    onDateSelect(`${date}T${slotTime}:00`, colId ?? undefined);
  };

  return (
    <div className="rc-wrap">
      {/* Nagłówek z nawigacją dnia */}
      <div className="rc-header">
        <button className="rc-nav-btn" onClick={() => setDate(addDays(date, -1))}>
          <ChevronLeft size={20} />
        </button>
        <div className="rc-date">
          {isToday && <span className="rc-today-badge">Dziś</span>}
          <span className="rc-date-text">{formatDatePL(date)}</span>
        </div>
        <button className="rc-nav-btn" onClick={() => setDate(addDays(date, 1))}>
          <ChevronRight size={20} />
        </button>
        {!isToday && (
          <button className="rc-nav-today" onClick={() => setDate(todayStr())}>
            Dziś
          </button>
        )}
      </div>

      {/* Siatka */}
      <div className="rc-grid-container">
        <div className="rc-grid" style={{ gridTemplateColumns: `60px repeat(${columns.length}, 1fr)` }}>
          {/* Header row — nazwy techników */}
          <div className="rc-corner" />
          {columns.map(col => (
            <div
              key={col.id ?? 'none'}
              className="rc-col-header"
              style={{ borderBottom: `3px solid ${col.color}` }}
            >
              <span className="rc-col-name">{col.name}</span>
              <span className="rc-col-count">
                {(ordersByTech.get(col.id) || []).length} zlec.
              </span>
            </div>
          ))}

          {/* Time column + technician columns */}
          <div className="rc-time-col">
            {timeSlots.map((slot, i) => (
              <div
                key={slot}
                className={`rc-time-cell ${i % 4 === 0 ? 'rc-time-hour' : i % 2 === 0 ? 'rc-time-half' : 'rc-time-quarter'}`}
                style={{ height: SLOT_HEIGHT }}
              >
                {i % 4 === 0 ? slot : ''}
              </div>
            ))}
          </div>

          {columns.map(col => {
            const avail = col.id != null ? availByTech.get(col.id) : null;
            const availTop = avail ? timeToSlotOffset(avail.startTime) : 0;
            const availHeight = avail ? timeDurationPx(avail.startTime, avail.endTime) : 0;

            return (
            <div key={col.id ?? 'none'} className="rc-tech-col">
              {/* Zielony blok dostępności */}
              {avail && availHeight > 0 && (
                <div
                  className="rc-availability"
                  style={{ top: availTop, height: availHeight }}
                />
              )}

              {/* Siatka godzinowa */}
              {timeSlots.map((slot, i) => (
                <div
                  key={slot}
                  className={`rc-slot ${i % 4 === 0 ? 'rc-slot-hour' : i % 2 === 0 ? 'rc-slot-half' : 'rc-slot-quarter'}`}
                  style={{ height: SLOT_HEIGHT }}
                  onClick={() => handleColumnClick(col.id, slot)}
                />
              ))}

              {/* Bloki zleceń (z obsługą nakładania) */}
              {(() => {
                const colOrders = ordersByTech.get(col.id) || [];
                const layout = layoutOverlapping(colOrders);

                return colOrders.map(order => {
                  const top = timeToSlotOffset(order.scheduledStart);
                  const height = Math.max(timeDurationPx(order.scheduledStart, order.scheduledEnd), SLOT_HEIGHT / 2);
                  const bgColor = col.id != null ? col.color : STATUS_COLORS[order.status] || '#94a3b8';
                  const pos = layout.get(order.id) || { col: 0, totalCols: 1 };
                  const widthPct = 100 / pos.totalCols;
                  const leftPct = pos.col * widthPct;

                  return (
                    <div
                      key={order.id}
                      className="rc-event"
                      style={{
                        top,
                        height,
                        backgroundColor: bgColor,
                        left: `calc(${leftPct}% + 2px)`,
                        width: `calc(${widthPct}% - 4px)`,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOrderClick(order);
                      }}
                    >
                      <div className="rc-event-time">
                        {order.scheduledStart?.substring(0, 5)} – {order.scheduledEnd?.substring(0, 5)}
                      </div>
                      <div className="rc-event-title">
                        {order.treatment?.name || 'Zabieg'}
                      </div>
                      <div className="rc-event-customer">
                        {order.customerName}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
