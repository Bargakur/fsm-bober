import { useState, useEffect } from 'react';
import ResourceCalendar from './components/ResourceCalendar';
import Sidebar from './components/Sidebar';
import OrderForm from './components/OrderForm';
import OrderDetail from './components/OrderDetail';
import SuggestionPanel from './components/SuggestionPanel';
import LoginScreen from './components/LoginScreen';
import type { UserInfo } from './components/LoginScreen';
import { ROLE_LABELS } from './components/LoginScreen';
import { setAuthToken, setOnUnauthorized } from './services/api';
import type { Order, TechnicianSuggestion, CreateOrderResponse } from './types';

export default function App() {
  const [token, setToken] = useState<string | null>(() => {
    const t = sessionStorage.getItem('fsm_token');
    if (t) setAuthToken(t); // ustawia token SYNCHRONICZNIE przed pierwszym renderem
    return t;
  });
  const [user, setUser] = useState<UserInfo | null>(() => {
    const s = sessionStorage.getItem('fsm_user');
    return s ? JSON.parse(s) : null;
  });

  // Modal states
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | undefined>();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [pendingAssignment, setPendingAssignment] = useState<{
    order: Order;
    suggestions: TechnicianSuggestion[];
  } | null>(null);

  // Calendar refresh trigger
  const [refreshKey, setRefreshKey] = useState(0);

  // Set auth token on mount / change
  useEffect(() => {
    setAuthToken(token);
    setOnUnauthorized(() => handleLogout());
  }, [token]);

  const handleLogin = (newToken: string, newUser: UserInfo) => {
    setAuthToken(newToken); // ustawia ZANIM React re-renderuje kalendarz
    setToken(newToken);
    setUser(newUser);
    sessionStorage.setItem('fsm_token', newToken);
    sessionStorage.setItem('fsm_user', JSON.stringify(newUser));
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    sessionStorage.removeItem('fsm_token');
    sessionStorage.removeItem('fsm_user');
  };

  // Not logged in — show login screen
  if (!token || !user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  const handleDateSelect = (dateStr: string) => {
    setSelectedDate(dateStr);
    setShowOrderForm(true);
  };

  const handleNewOrder = () => {
    setSelectedDate(undefined);
    setShowOrderForm(true);
  };

  const handleOrderCreated = (response: CreateOrderResponse) => {
    setShowOrderForm(false);
    setRefreshKey(k => k + 1);
    setPendingAssignment({
      order: response.order,
      suggestions: response.suggestedTechnicians,
    });
  };

  const handleOrderClick = (order: Order) => {
    setSelectedOrder(order);
  };

  const handleAssignFromDetail = (order: Order) => {
    setSelectedOrder(null);
    setPendingAssignment({ order, suggestions: [] });
  };

  const handleAssigned = () => {
    setPendingAssignment(null);
    setRefreshKey(k => k + 1);
  };

  return (
    <div className="app">
      <Sidebar onNewOrder={handleNewOrder} />

      <main className="main">
        <header className="topbar">
          <h1>Kalendarz zleceń</h1>
          <div className="topbar-right">
            <div className="topbar-user">
              <span className="topbar-user-name">{user.fullName}</span>
              <span className="topbar-user-role">{ROLE_LABELS[user.role] || user.role}</span>
            </div>
            <button className="btn btn-secondary" onClick={handleLogout}>Wyloguj</button>
            <button className="btn btn-primary" onClick={handleNewOrder}>
              + Nowe zlecenie
            </button>
          </div>
        </header>

        <div className="calendar-container">
          <ResourceCalendar
            onDateSelect={handleDateSelect}
            onOrderClick={handleOrderClick}
            refreshKey={refreshKey}
          />
        </div>

        <div className="legend">
          <span className="legend-item"><i className="dot dot-draft" /> Szkic</span>
          <span className="legend-item"><i className="dot dot-assigned" /> Przypisane</span>
          <span className="legend-item"><i className="dot dot-progress" /> W trakcie</span>
          <span className="legend-item"><i className="dot dot-completed" /> Zakończone</span>
        </div>
      </main>

      {showOrderForm && (
        <OrderForm
          initialDate={selectedDate}
          onClose={() => setShowOrderForm(false)}
          onCreated={handleOrderCreated}
        />
      )}

      {selectedOrder && (
        <OrderDetail
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onAssign={handleAssignFromDetail}
        />
      )}

      {pendingAssignment && (
        <SuggestionPanel
          order={pendingAssignment.order}
          suggestions={pendingAssignment.suggestions}
          onAssigned={handleAssigned}
          onClose={() => setPendingAssignment(null)}
        />
      )}
    </div>
  );
}
