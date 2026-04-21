import type { Order, Treatment, Technician, CreateOrderDto, CreateOrderResponse } from '../types';

// W produkcji (Railway) VITE_API_URL = "https://fsm-api.up.railway.app"
// Lokalnie puste → używa "/api" (proxy przez Vite)
const BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

let _token: string | null = null;
let _onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  _token = token;
}

export function setOnUnauthorized(callback: () => void) {
  _onUnauthorized = callback;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (_token) {
    headers['Authorization'] = `Bearer ${_token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { ...headers, ...(options?.headers || {}) },
  });

  if (res.status === 401 && _token) {
    // Tylko wyloguj jeśli mieliśmy token (wygasł) — nie przy braku tokena
    _onUnauthorized?.();
    throw new Error('Sesja wygasła — zaloguj się ponownie');
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

export async function getOrders(date: string): Promise<Order[]> {
  return request(`/orders?date=${date}`);
}

export async function createOrder(dto: CreateOrderDto): Promise<CreateOrderResponse> {
  return request('/orders', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function assignTechnician(orderId: number, technicianId: number): Promise<Order> {
  return request(`/orders/${orderId}/assign`, {
    method: 'PUT',
    body: JSON.stringify({ technicianId }),
  });
}

export async function getTreatments(): Promise<Treatment[]> {
  return request('/treatments');
}

export async function getTechnicians(): Promise<Technician[]> {
  return request('/technicians');
}
