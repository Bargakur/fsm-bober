export interface Treatment {
  id: number;
  name: string;
  durationMinutes: number;
  category: string;
  defaultPrice: number;
  requiredSkill?: string;
}

export interface Technician {
  id: number;
  fullName: string;
  phone: string;
  homeLat: number;
  homeLng: number;
  specializations: string;
  isActive: boolean;
}

export interface Order {
  id: number;
  customerName: string;
  customerPhone: string;
  contactPhone?: string;
  address: string;
  lat: number;
  lng: number;
  treatmentId: number;
  scope?: string;
  technicianId?: number;
  scheduledDate: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: 'draft' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  paymentMethod?: string;
  price: number;
  notes?: string;
  createdByUserId?: number;
  createdBy?: { id: number; fullName: string; role: string };
  treatment?: Treatment;
  technician?: Technician;
}

export interface TechnicianSuggestion {
  technicianId: number;
  fullName: string;
  /** Najmniejsza odległość spośród punktów technika tego dnia (dom + każde zlecenie). */
  distanceKm: number;
  estimatedMinutes: number;
  availableFrom?: string;
  availableTo?: string;
  ordersToday: number;
  fitLevel: 'recommended' | 'available' | 'warning';
  /** "home" gdy najbliżej jest dom; "order" gdy któreś z zaplanowanych zleceń. */
  distanceSource: 'home' | 'order';
}

export interface CreateOrderDto {
  customerName: string;
  customerPhone: string;
  contactPhone?: string;
  address: string;
  treatmentId: number;
  scope?: string;
  scheduledDate: string;
  scheduledStart: string;
  durationOverride?: number;
  priceOverride?: number;
  paymentMethod?: string;
  notes?: string;
  lat?: number;
  lng?: number;
}

export interface CreateOrderResponse {
  order: Order;
  suggestedTechnicians: TechnicianSuggestion[];
}

export interface TechnicianAvailability {
  technicianId: number;
  startTime: string;  // "HH:mm"
  endTime: string;    // "HH:mm"
}
