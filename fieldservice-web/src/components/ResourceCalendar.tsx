import { useEffect, useState, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Order, Technician, TechnicianAvailability } from '../types';
import { getOrders, getTechnicians, getBulkAvailability } from '../services/api';

export interface CalendarFilter {
  treatmentId: number;
  requiredSkill?: string;
  lat: number;
  lng: number;
}

/** Haversine — odległość w km między dwoma punktami GPS */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const CITIES: [string, number, number][] = [
  ['Warszawa', 52.2297, 21.0122],
  ['Kraków', 50.0647, 19.9450],
  ['Wrocław', 51.1079, 17.0385],
  ['Poznań', 52.4064, 16.9252],
  ['Gdańsk', 54.3520, 18.6466],
  ['Łódź', 51.7592, 19.4560],
  ['Szczecin', 53.4285, 14.5528],
  ['Lublin', 51.2465, 22.5684],
  ['Katowice', 50.2649, 19.0238],
  ['Bydgoszcz', 53.1235, 18.0084],
  ['Białystok', 53.1325, 23.1688],
  ['Rzeszów', 50.0412, 21.9991],
  ['Olsztyn', 53.7784, 20.4801],
  ['Kielce', 50.8661, 20.6286],
  ['Radom', 51.4027, 21.1471],
  ['Toruń', 53.0138, 18.5984],
  ['Opole', 50.6751, 17.9213],
  ['Zielona Góra', 51.9356, 15.5062],
  ['Gorzów Wlkp.', 52.7325, 15.2369],
];

function nearestCity(lat: number, lng: number): string {
  let best = CITIES[0][0];
  let bestDist = Infinity;
  for (const [name, cLat, cLng] of CITIES) {
    const d = (lat - cLat) ** 2 + (lng - cLng) ** 2;
    if (d < bestDist) { bestDist = d; best = name; }
  }
  return best;
}

interface Props {
  onDateSelect: (date: string, technicianId?: number) => void;
  onOrderClick: (order: Order) => void;
  refreshKey: number;
  filter?: CalendarFilter;
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

export default function ResourceCalendar({ onDateSelect, onOrderClick, refreshKey, filter }: Props) {
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

  // Filtruj techników wg prefiltra (specjalizacja + odległość 250km)
  const visibleTechnicians = useMemo(() => {
    if (!filter) return technicians;
    return technicians.filter(t => {
      // Sprawdź specjalizację
      if (filter.requiredSkill) {
        const specs = t.specializations?.split(',').map(s => s.trim()).filter(Boolean) || [];
        if (!specs.includes(filter.requiredSkill)) return false;
      }
      // Sprawdź odległość (z domu)
      const dist = haversineKm(filter.lat, filter.lng, t.homeLat, t.homeLng);
      if (dist > 250) return false;
      return true;
    });
  }, [technicians, filter]);

  // Grupuj zlecenia wg technika (+ nieprzypisane)
  const ordersByTech = useMemo(() => {
    const map = new Map<number | null, Order[]>();
    // Inicjalizuj dla każdego technika
    map.set(null, []); // nieprzypisane
    visibleTechnicians.forEach(t => map.set(t.id, []));
    // Rozłóż zlecenia
    orders.forEach(o => {
      const key = o.technicianId ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(o);
    });
    return map;
  }, [orders, visibleTechnicians]);

  // Kolumny: nieprzypisane + technicy
  const columns: { id: number | null; name: string; city?: string; color: string }[] = useMemo(() => {
    const cols: { id: number | null; name: string; city?: string; color: string }[] = [];

    // Nieprzypisane — tylko jeśli są takie zlecenia
    const unassigned = ordersByTech.get(null) || [];
    if (unassigned.length > 0) {
      cols.push({ id: null, name: 'Nieprzypisane', color: '#94a3b8' });
    }

    visibleTechnicians.forEach((t, i) => {
      cols.push({ id: t.id, name: t.fullName, city: nearestCity(t.homeLat, t.homeLng), color: TECH_COLORS[i % TECH_COLORS.length] });
    });

    return cols;
  }, [visibleTechnicians, ordersByTech]);

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
              {col.city && <span className="rc-col-city">{col.city}</span>}
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
