import type { Order, Technician } from '../types';

/**
 * Promień (km), w którym technik pokazuje się na widoku kalendarza
 * w trybie "Nowe zlecenie". Dobrane empirycznie — sensowny zasięg dnia roboczego
 * dla mobilnej brygady w Polsce. Krótszy = ryzyko ukrycia dobrego kandydata,
 * dłuższy = zatłoczona kolumna techników bez sensu.
 */
export const CALENDAR_RADIUS_KM = 250;

/** Haversine — odległość po wielkim okręgu w km między dwoma punktami GPS. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface CalendarFilter {
  treatmentId: number;
  requiredSkill?: string;
  lat: number;
  lng: number;
}

/**
 * Decyduje, którzy technicy mają się pokazać jako kolumny kalendarza po wciśnięciu
 * "Nowe zlecenie".
 *
 * Reguły:
 * 1. Jeśli zabieg wymaga skilla, którego technik nie ma — odpada.
 * 2. Technik trafia do widoku, gdy MIN dystansu od adresu nowego zlecenia do dowolnego
 *    z punktów `{dom technika} ∪ {każde jego zlecenie z bieżącego widoku kalendarza}`
 *    mieści się w `CALENDAR_RADIUS_KM`.
 *
 * Zsynchronizowane z backendowym `SuggestionService.GetSuggestionsAsync` —
 * obie warstwy patrzą na ten sam zbiór punktów. Inaczej powstawała sytuacja:
 * technik z domem w Szczecinie, ale z zaplanowanym zleceniem koło Suwałk,
 * był sugerowany przez backend, a jednocześnie ukryty na widoku kalendarza.
 *
 * @param orders — zlecenia widoczne aktualnie w kalendarzu (już przefiltrowane po dacie).
 */
export function filterTechniciansForOrder(
  technicians: Technician[],
  orders: Order[],
  filter: CalendarFilter,
): Technician[] {
  const skill = filter.requiredSkill?.trim();

  return technicians.filter((t) => {
    if (skill) {
      const specs = t.specializations?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
      if (!specs.includes(skill)) return false;
    }

    const homeDist = haversineKm(filter.lat, filter.lng, t.homeLat, t.homeLng);
    if (homeDist <= CALENDAR_RADIUS_KM) return true;

    // Dom za daleko — sprawdź jeszcze, czy technik nie jest dziś gdzieś w okolicy.
    for (const o of orders) {
      if (o.technicianId !== t.id) continue;
      const d = haversineKm(filter.lat, filter.lng, o.lat, o.lng);
      if (d <= CALENDAR_RADIUS_KM) return true;
    }
    return false;
  });
}
