import type { Order, TechnicianAvailability } from '../types';

export interface DayData {
  orders: Order[];
  availability: TechnicianAvailability[];
}

/**
 * Wstrzykiwane fetchery — produkcyjnie `services/api`, w testach mocki.
 * Trzymamy interfejs minimalny, żeby cache nie wiedział nic o transporcie HTTP.
 */
export interface DayLoader {
  getOrders: (date: string) => Promise<Order[]>;
  getBulkAvailability: (date: string) => Promise<TechnicianAvailability[]>;
}

/**
 * Cache dziennych danych kalendarza (zlecenia + dostępność).
 *
 * Problem, który rozwiązuje: `ResourceCalendar` re-fetchował na każdą zmianę dnia,
 * przez co przeskoki o jeden dzień powodowały migający spinner i czekanie na sieć.
 *
 * Założenia:
 * - Klucz cache to string daty `YYYY-MM-DD` (zgodnie z formatem używanym w API).
 * - Trzymamy cały dzień jako `{orders, availability}` — i tak ładowane są razem.
 * - Dedup równoległych żądań tego samego dnia (jedno `Promise` w `inFlight`).
 * - Failure NIE pollutuje cache — kolejna próba odpala fresh request.
 * - Cache jest in-memory per instancja komponentu (`useRef`), więc znika przy reloadzie.
 *   To wystarcza na "kliknięcie do tyłu / do przodu instant", a dane i tak chcemy świeże po F5.
 *
 * Co cache NIE robi: TTL, persistance, częściowa inwalidacja per-tech.
 * Inwalidacja jest gruboziarnista — `clear()` całość — wywoływana na `refreshKey` w komponencie.
 */
export class DayDataCache {
  private resolved = new Map<string, DayData>();
  private inFlight = new Map<string, Promise<DayData>>();
  /** Bumpowane przez `clear()` — promise startujący przed bumpem nie pisze do nowego cache. */
  private generation = 0;

  constructor(private readonly loader: DayLoader) {}

  /** Czy dla danej daty mamy już rozwiązane (zfetchowane) dane. */
  has(date: string): boolean {
    return this.resolved.has(date);
  }

  /** Synchronously zwraca dane jeśli są w cache. Do natychmiastowego renderu. */
  get(date: string): DayData | undefined {
    return this.resolved.get(date);
  }

  /**
   * Asynchronously zwraca dane — z cache lub fetchuje. Dedup po promise:
   * dwa równoległe `load()` tej samej daty wywołają loader tylko raz.
   */
  load(date: string): Promise<DayData> {
    const cached = this.resolved.get(date);
    if (cached) return Promise.resolve(cached);

    const pending = this.inFlight.get(date);
    if (pending) return pending;

    // "Stempel czasowy" ważny dla TEJ próby — jeśli ktoś zawoła clear() w międzyczasie,
    // to nasz callback nie powinien zaśmiecać świeżego cache.
    const myGen = this.generation;

    const promise = Promise.all([
      this.loader.getOrders(date),
      this.loader.getBulkAvailability(date),
    ])
      .then(([orders, availability]) => {
        const data: DayData = { orders, availability };
        if (this.generation === myGen) {
          this.resolved.set(date, data);
          this.inFlight.delete(date);
        }
        // Caller dostaje dane — to było jego żądanie. Tylko cache zostaje "sieroty".
        return data;
      })
      .catch((err) => {
        if (this.generation === myGen) {
          this.inFlight.delete(date);
        }
        throw err;
      });

    this.inFlight.set(date, promise);
    return promise;
  }

  /**
   * Czyści wszystko — wywoływane gdy refreshKey wskazuje, że dane są nieaktualne.
   * Bumpuje generation, więc in-flight żądania nie wpadną do nowego cache.
   */
  clear(): void {
    this.resolved.clear();
    this.inFlight.clear();
    this.generation++;
  }

  /** Liczność rozwiązanego cache — przydatne w testach. */
  get size(): number {
    return this.resolved.size;
  }

  /** Ile żądań aktualnie leci — przydatne w testach. */
  get pendingSize(): number {
    return this.inFlight.size;
  }
}
