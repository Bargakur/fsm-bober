import { describe, it, expect, vi, type Mock } from 'vitest';
import { DayDataCache, type DayLoader } from './dayDataCache';
import type { Order, TechnicianAvailability } from '../types';

function makeOrder(id: number, scheduledDate: string): Order {
  return {
    id,
    customerName: `Klient #${id}`,
    customerPhone: '',
    address: 'addr',
    lat: 52.2297,
    lng: 21.0122,
    treatmentId: 1,
    scheduledDate,
    scheduledStart: '10:00',
    scheduledEnd: '12:00',
    status: 'assigned',
    price: 100,
  };
}

function makeAvail(technicianId: number): TechnicianAvailability {
  return { technicianId, startTime: '08:00', endTime: '16:00' };
}

type GetOrdersMock = Mock<[date: string], Promise<Order[]>>;
type GetAvailMock = Mock<[date: string], Promise<TechnicianAvailability[]>>;

/** Helper: tworzy DayLoader z policzalnymi mocks i wstrzykiwalnymi danymi per-data. */
function mockLoader(
  ordersByDate: Record<string, Order[]> = {},
  availabilityByDate: Record<string, TechnicianAvailability[]> = {},
): DayLoader & { getOrdersMock: GetOrdersMock; getAvailMock: GetAvailMock } {
  const getOrdersMock: GetOrdersMock = vi.fn(async (date: string) => ordersByDate[date] ?? []);
  const getAvailMock: GetAvailMock = vi.fn(async (date: string) => availabilityByDate[date] ?? []);
  return {
    getOrders: getOrdersMock,
    getBulkAvailability: getAvailMock,
    getOrdersMock,
    getAvailMock,
  };
}

describe('DayDataCache.load', () => {
  it('fetches and caches data for a new date', async () => {
    const loader = mockLoader(
      { '2026-05-01': [makeOrder(1, '2026-05-01')] },
      { '2026-05-01': [makeAvail(10)] },
    );
    const cache = new DayDataCache(loader);

    const data = await cache.load('2026-05-01');

    expect(data.orders).toHaveLength(1);
    expect(data.orders[0].id).toBe(1);
    expect(data.availability).toEqual([makeAvail(10)]);
    expect(cache.size).toBe(1);
    expect(cache.has('2026-05-01')).toBe(true);
  });

  it('returns cached data on second call without re-fetching', async () => {
    const loader = mockLoader();
    const cache = new DayDataCache(loader);

    await cache.load('2026-05-01');
    await cache.load('2026-05-01');
    await cache.load('2026-05-01');

    expect(loader.getOrdersMock).toHaveBeenCalledTimes(1);
    expect(loader.getAvailMock).toHaveBeenCalledTimes(1);
  });

  it('returns identical reference for same date — React can bail out of re-render', async () => {
    const loader = mockLoader(
      { '2026-05-01': [makeOrder(1, '2026-05-01')] },
      { '2026-05-01': [makeAvail(10)] },
    );
    const cache = new DayDataCache(loader);

    const a = await cache.load('2026-05-01');
    const b = await cache.load('2026-05-01');

    expect(a).toBe(b); // referential equality
    expect(a.orders).toBe(b.orders);
    expect(a.availability).toBe(b.availability);
  });

  it('dedups concurrent loads for the same date — single in-flight request', async () => {
    const loader = mockLoader();
    const cache = new DayDataCache(loader);

    // Wystartuj 5 równoczesnych ładowań tej samej daty
    const promises = Array.from({ length: 5 }, () => cache.load('2026-05-01'));
    expect(cache.pendingSize).toBe(1); // jedno żądanie w locie, nie pięć

    const results = await Promise.all(promises);

    expect(loader.getOrdersMock).toHaveBeenCalledTimes(1);
    expect(loader.getAvailMock).toHaveBeenCalledTimes(1);
    // Wszystkie zwróciły ten sam obiekt
    for (const r of results) expect(r).toBe(results[0]);
    expect(cache.pendingSize).toBe(0);
  });

  it('fetches independently for different dates', async () => {
    const loader = mockLoader(
      {
        '2026-05-01': [makeOrder(1, '2026-05-01')],
        '2026-05-02': [makeOrder(2, '2026-05-02')],
      },
      {},
    );
    const cache = new DayDataCache(loader);

    const [d1, d2] = await Promise.all([cache.load('2026-05-01'), cache.load('2026-05-02')]);

    expect(d1.orders[0].id).toBe(1);
    expect(d2.orders[0].id).toBe(2);
    expect(cache.size).toBe(2);
    expect(loader.getOrdersMock).toHaveBeenCalledTimes(2);
  });
});

describe('DayDataCache failure handling', () => {
  it('does not poison cache when fetch fails — next load retries', async () => {
    let attempt = 0;
    const loader: DayLoader = {
      getOrders: vi.fn(async () => {
        attempt++;
        if (attempt === 1) throw new Error('network');
        return [makeOrder(1, '2026-05-01')];
      }),
      getBulkAvailability: vi.fn(async () => []),
    };
    const cache = new DayDataCache(loader);

    await expect(cache.load('2026-05-01')).rejects.toThrow('network');
    expect(cache.size).toBe(0);
    expect(cache.pendingSize).toBe(0);

    // Druga próba zaczyna od zera i sukces
    const data = await cache.load('2026-05-01');
    expect(data.orders).toHaveLength(1);
    expect(attempt).toBe(2);
  });

  it('all concurrent callers reject on shared failed promise', async () => {
    const loader: DayLoader = {
      getOrders: vi.fn(async () => {
        throw new Error('boom');
      }),
      getBulkAvailability: vi.fn(async () => []),
    };
    const cache = new DayDataCache(loader);

    const a = cache.load('2026-05-01');
    const b = cache.load('2026-05-01');

    await expect(a).rejects.toThrow('boom');
    await expect(b).rejects.toThrow('boom');
    // Dedup zadziałał — loader wołany tylko raz, mimo że dwóch callerów
    expect(loader.getOrders).toHaveBeenCalledTimes(1);
  });
});

describe('DayDataCache.has / .get', () => {
  it('has() returns false before load completes', async () => {
    let resolveOrders: (v: Order[]) => void = () => {};
    const loader: DayLoader = {
      getOrders: vi.fn(() => new Promise<Order[]>((r) => { resolveOrders = r; })),
      getBulkAvailability: vi.fn(async () => []),
    };
    const cache = new DayDataCache(loader);

    const p = cache.load('2026-05-01');
    expect(cache.has('2026-05-01')).toBe(false);
    expect(cache.get('2026-05-01')).toBeUndefined();

    resolveOrders([]);
    await p;

    expect(cache.has('2026-05-01')).toBe(true);
    expect(cache.get('2026-05-01')).toBeDefined();
  });

  it('get() returns the same object as load()', async () => {
    const loader = mockLoader();
    const cache = new DayDataCache(loader);
    const loaded = await cache.load('2026-05-01');
    expect(cache.get('2026-05-01')).toBe(loaded);
  });
});

describe('DayDataCache.clear', () => {
  it('removes all resolved entries', async () => {
    const loader = mockLoader();
    const cache = new DayDataCache(loader);
    await cache.load('2026-05-01');
    await cache.load('2026-05-02');
    expect(cache.size).toBe(2);

    cache.clear();

    expect(cache.size).toBe(0);
    expect(cache.has('2026-05-01')).toBe(false);
    expect(cache.has('2026-05-02')).toBe(false);
  });

  it('clear() during in-flight: resolved orphan does NOT pollute fresh cache', async () => {
    // Note: clear() nie przerywa już startujących HTTP-ów (nie ma AbortControllera),
    // tylko zapomina o nich. Po clear() kolejny load() musi zacząć od zera —
    // nawet jeśli stary in-flight properly zarezolwuje "po fakcie".
    const resolvers: Array<(v: Order[]) => void> = [];
    const loader: DayLoader = {
      getOrders: vi.fn(() => new Promise<Order[]>((r) => { resolvers.push(r); })),
      getBulkAvailability: vi.fn(async () => []),
    };
    const cache = new DayDataCache(loader);

    const first = cache.load('2026-05-01');
    expect(cache.pendingSize).toBe(1);

    cache.clear();
    expect(cache.pendingSize).toBe(0);

    // Stary loader nadal jest in-flight pod spodem. Wystartuj drugi load.
    const second = cache.load('2026-05-01');
    expect(loader.getOrders).toHaveBeenCalledTimes(2);

    // Rozwiąż OBA — najpierw stary (sierota: nie powinien lądować w cache),
    // potem nowy (kanoniczny dla cache).
    resolvers[0]([makeOrder(99, '2026-05-01')]);
    resolvers[1]([makeOrder(42, '2026-05-01')]);

    await first;
    const result = await second;

    // Świeży load wygrywa — w cache ma być id=42, nie 99.
    expect(result.orders[0].id).toBe(42);
    expect(cache.get('2026-05-01')!.orders[0].id).toBe(42);
  });

  it('forces fresh fetch after clear', async () => {
    const loader = mockLoader();
    const cache = new DayDataCache(loader);

    await cache.load('2026-05-01');
    cache.clear();
    await cache.load('2026-05-01');

    expect(loader.getOrdersMock).toHaveBeenCalledTimes(2);
    expect(loader.getAvailMock).toHaveBeenCalledTimes(2);
  });
});

describe('DayDataCache prefetch use-case', () => {
  it('prefetching multiple days then loading current = no extra requests', async () => {
    const loader = mockLoader();
    const cache = new DayDataCache(loader);

    // Symuluj efekt z ResourceCalendar: prefetch okolicznych dni + load aktualnego
    const days = ['2026-04-30', '2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04'];
    await Promise.all(days.map((d) => cache.load(d)));
    expect(loader.getOrdersMock).toHaveBeenCalledTimes(5);

    // Użytkownik klika "next" → jest w cache, instant
    const sameData = cache.get('2026-05-02');
    expect(sameData).toBeDefined();

    await cache.load('2026-05-02');
    // Liczba wywołań loadera się NIE zmieniła
    expect(loader.getOrdersMock).toHaveBeenCalledTimes(5);
  });
});
