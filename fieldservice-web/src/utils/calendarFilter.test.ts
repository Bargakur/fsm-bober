import { describe, it, expect } from 'vitest';
import { filterTechniciansForOrder, haversineKm, CALENDAR_RADIUS_KM } from './calendarFilter';
import type { Order, Technician } from '../types';

// ---- Punkty referencyjne (Polska) ----
const SZCZECIN: [number, number] = [53.4285, 14.5528];
const SUWALKI: [number, number] = [54.0995, 22.9296];   // ~700 km od Szczecina
const WARSZAWA: [number, number] = [52.2297, 21.0122];
const KRAKOW: [number, number] = [50.0647, 19.9450];

function makeTech(id: number, fullName: string, [lat, lng]: [number, number], specs = ''): Technician {
  return {
    id,
    fullName,
    phone: '',
    homeLat: lat,
    homeLng: lng,
    specializations: specs,
    isActive: true,
  };
}

function makeOrder(id: number, technicianId: number | undefined, [lat, lng]: [number, number]): Order {
  return {
    id,
    customerName: `Klient #${id}`,
    customerPhone: '',
    address: 'addr',
    lat,
    lng,
    treatmentId: 1,
    technicianId,
    scheduledDate: '2026-05-01',
    scheduledStart: '10:00',
    scheduledEnd: '12:00',
    status: 'assigned',
    price: 100,
  };
}

describe('haversineKm', () => {
  it('returns 0 for the same point', () => {
    expect(haversineKm(52.2297, 21.0122, 52.2297, 21.0122)).toBeCloseTo(0, 5);
  });

  it('Warszawa → Kraków ≈ 252 km (sanity)', () => {
    const d = haversineKm(...WARSZAWA, ...KRAKOW);
    expect(d).toBeGreaterThan(245);
    expect(d).toBeLessThan(260);
  });

  it('Szczecin → Suwałki ≈ 555 km great-circle (sanity, real-world bug scenario)', () => {
    // Drogowo to ~700 km, ale po wielkim okręgu (haversine) wychodzi ~555 km.
    // I tak grubo powyżej promienia 250 km — scenariusz bugu reprodukowalny.
    const d = haversineKm(...SZCZECIN, ...SUWALKI);
    expect(d).toBeGreaterThan(540);
    expect(d).toBeLessThan(575);
    expect(d).toBeGreaterThan(CALENDAR_RADIUS_KM);
  });

  it('is symmetric', () => {
    const a = haversineKm(...SZCZECIN, ...WARSZAWA);
    const b = haversineKm(...WARSZAWA, ...SZCZECIN);
    expect(a).toBeCloseTo(b, 6);
  });
});

describe('filterTechniciansForOrder — skill filter', () => {
  it('drops technician without required skill', () => {
    const techs = [
      makeTech(1, 'Z osami', SZCZECIN, 'drabina,osy'),
      makeTech(2, 'Bez os', SZCZECIN, 'drabina'),
    ];
    const out = filterTechniciansForOrder(techs, [], {
      treatmentId: 1, requiredSkill: 'osy', lat: SZCZECIN[0], lng: SZCZECIN[1],
    });
    expect(out.map((t) => t.id)).toEqual([1]);
  });

  it('treats empty/whitespace requiredSkill as no skill filter', () => {
    const techs = [makeTech(1, 'T', SZCZECIN, 'drabina')];
    const out = filterTechniciansForOrder(techs, [], {
      treatmentId: 1, requiredSkill: '   ', lat: SZCZECIN[0], lng: SZCZECIN[1],
    });
    expect(out).toHaveLength(1);
  });

  it('skill check trims whitespace inside specializations list', () => {
    const techs = [makeTech(1, 'T', SZCZECIN, ' drabina ,  osy ')];
    const out = filterTechniciansForOrder(techs, [], {
      treatmentId: 1, requiredSkill: 'osy', lat: SZCZECIN[0], lng: SZCZECIN[1],
    });
    expect(out).toHaveLength(1);
  });
});

describe('filterTechniciansForOrder — distance from home', () => {
  it('includes technician whose home is within radius', () => {
    const techs = [makeTech(1, 'Lokalny', WARSZAWA)];
    const out = filterTechniciansForOrder(techs, [], {
      treatmentId: 1, lat: WARSZAWA[0], lng: WARSZAWA[1],
    });
    expect(out).toHaveLength(1);
  });

  it('drops technician whose home is far AND has no orders', () => {
    const techs = [makeTech(1, 'Daleki', SZCZECIN)];
    const out = filterTechniciansForOrder(techs, [], {
      treatmentId: 1, lat: SUWALKI[0], lng: SUWALKI[1],
    });
    expect(out).toHaveLength(0);
  });

  it('drops technician at exactly radius+1 km', () => {
    // Punkt ~251 km od Warszawy w kierunku Krakowa — daleko jak Kraków
    const techs = [makeTech(1, 'Edge', KRAKOW)];
    // dystans Warszawa↔Kraków to ~252 km (powyżej 250)
    expect(haversineKm(...WARSZAWA, ...KRAKOW)).toBeGreaterThan(CALENDAR_RADIUS_KM);
    const out = filterTechniciansForOrder(techs, [], {
      treatmentId: 1, lat: WARSZAWA[0], lng: WARSZAWA[1],
    });
    expect(out).toHaveLength(0);
  });
});

describe('filterTechniciansForOrder — distance from existing order (REGRESSION: Suwałki/Szczecin)', () => {
  it('includes Szczecin-based technician who has an order near Suwałki when creating order in Suwałki', () => {
    // To jest dokładny scenariusz z bug reportu:
    // - technik mieszka w Szczecinie
    // - ma już zlecenie zaplanowane na ten dzień gdzieś koło Suwałk
    // - handlowiec klika "Nowe zlecenie" w okolicach Suwałk
    // → technik MUSI się pojawić w widoku kalendarza, bo jest dziś w okolicy.
    const tech = makeTech(1, 'Szczecin → Suwałki', SZCZECIN);
    const existingOrder = makeOrder(100, 1, SUWALKI);

    const out = filterTechniciansForOrder([tech], [existingOrder], {
      treatmentId: 1, lat: SUWALKI[0], lng: SUWALKI[1],
    });

    expect(out).toHaveLength(1);
    expect(out[0].id).toBe(1);
  });

  it('uses minimum across home + all today orders, not just home', () => {
    // Technik z domem daleko, ALE ze zleceniem 2 km od adresu → bierzemy
    const tech = makeTech(1, 'T', KRAKOW); // dom: ~252 km
    const closeOrder = makeOrder(200, 1, [WARSZAWA[0] + 0.02, WARSZAWA[1]]); // ~2 km

    const out = filterTechniciansForOrder([tech], [closeOrder], {
      treatmentId: 1, lat: WARSZAWA[0], lng: WARSZAWA[1],
    });

    expect(out).toHaveLength(1);
  });

  it('ignores orders belonging to a DIFFERENT technician', () => {
    // Tech 1 daleko (Szczecin), tech 2 ma zlecenie w Suwałkach.
    // Tech 1 NIE może wpaść do widoku tylko dlatego, że ktoś inny ma zlecenie tam.
    const tech1 = makeTech(1, 'Szczecin', SZCZECIN);
    const tech2 = makeTech(2, 'Inny', WARSZAWA);
    const tech2Order = makeOrder(100, 2, SUWALKI);

    const out = filterTechniciansForOrder([tech1, tech2], [tech2Order], {
      treatmentId: 1, lat: SUWALKI[0], lng: SUWALKI[1],
    });

    expect(out.map((t) => t.id)).not.toContain(1);
  });

  it('ignores unassigned orders (technicianId undefined)', () => {
    // Nieprzypisane zlecenie obok klienta nie powinno wciągać technika z drugiego końca kraju.
    const tech = makeTech(1, 'Szczecin', SZCZECIN);
    const unassigned = makeOrder(100, undefined, SUWALKI);

    const out = filterTechniciansForOrder([tech], [unassigned], {
      treatmentId: 1, lat: SUWALKI[0], lng: SUWALKI[1],
    });

    expect(out).toHaveLength(0);
  });

  it('combines skill filter with order-based distance: skill must still match', () => {
    // Technik ma blisko zlecenie, ale nie ma wymaganego skilla → nadal odpada.
    const tech = makeTech(1, 'Bez skilla', SZCZECIN, 'drabina');
    const closeOrder = makeOrder(100, 1, SUWALKI);

    const out = filterTechniciansForOrder([tech], [closeOrder], {
      treatmentId: 1, requiredSkill: 'osy', lat: SUWALKI[0], lng: SUWALKI[1],
    });

    expect(out).toHaveLength(0);
  });
});

describe('filterTechniciansForOrder — edge cases', () => {
  it('returns empty when given no technicians', () => {
    expect(
      filterTechniciansForOrder([], [], { treatmentId: 1, lat: 0, lng: 0 }),
    ).toEqual([]);
  });

  it('handles technician with one near order and one far order — near wins', () => {
    const tech = makeTech(1, 'T', KRAKOW);
    const farOrder = makeOrder(100, 1, KRAKOW);                              // ~0 km od domu, ~252 od WWA
    const nearOrder = makeOrder(101, 1, [WARSZAWA[0] + 0.01, WARSZAWA[1]]);  // ~1 km od WWA
    const out = filterTechniciansForOrder([tech], [farOrder, nearOrder], {
      treatmentId: 1, lat: WARSZAWA[0], lng: WARSZAWA[1],
    });
    expect(out).toHaveLength(1);
  });
});
