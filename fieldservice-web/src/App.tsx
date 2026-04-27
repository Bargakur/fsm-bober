import { useState, useEffect } from 'react';
import ResourceCalendar from './components/ResourceCalendar';
import type { CalendarFilter } from './components/ResourceCalendar';
import Sidebar from './components/Sidebar';
import OrderForm from './components/OrderForm';
import OrderDetail from './components/OrderDetail';
import SuggestionPanel from './components/SuggestionPanel';
import PreFilterModal from './components/PreFilterModal';
import type { PreFilterResult } from './components/PreFilterModal';
import AdminPanel from './components/AdminPanel';
import LoginScreen from './components/LoginScreen';
import type { UserInfo } from './components/LoginScreen';
import { ROLE_LABELS } from './components/LoginScreen';
import { setAuthToken, setOnUnauthorized } from './services/api';
import type { Order, TechnicianSuggestion, CreateOrderResponse } from './types';

type View = 'calendar' | 'admin';

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

  // View state
  const [currentView, setCurrentView] = useState<View>('calendar');

  // Modal states
  const [showPreFilter, setShowPreFilter] = useState(false);
  const [preFilter, setPreFilter] = useState<PreFilterResult | null>(null);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | undefined>();
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<number | undefined>();
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

  const handleDateSelect = (dateStr: string, technicianId?: number) => {
    setSelectedDate(dateStr);
    setSelectedTechnicianId(technicianId);
    setShowOrderForm(true);
  };

  const handleNewOrder = () => {
    setSelectedDate(undefined);
    setSelectedTechnicianId(undefined);
    setPreFilter(null);
    setShowPreFilter(true);
  };

  const handlePreFilterDone = (result: PreFilterResult) => {
    setPreFilter(result);
    setShowPreFilter(false);
  };

  const handleClearFilter = () => {
    setPreFilter(null);
  };

  const handleOrderCreated = (response: CreateOrderResponse) => {
    setShowOrderForm(false);
    setPreFilter(null);
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
      <Sidebar
        onNewOrder={handleNewOrder}
        currentView={currentView}
        onViewChange={setCurrentView}
        userRole={user.role}
      />

      <main className="main">
        <header className="topbar">
          <h1>{currentView === 'admin' ? 'Administracja' : 'Kalendarz zleceń'}</h1>
          <div className="topbar-right">
            <div className="topbar-user">
              <span className="topbar-user-name">{user.fullName}</span>
            </div>
            <button className="btn btn-secondary" onClick={handleLogout}>Wyloguj</button>
            {currentView === 'calendar' && (
              <button className="btn btn-primary" onClick={handleNewOrder}>
                + Nowe zlecenie
              </button>
            )}
          </div>
        </header>

        {currentView === 'calendar' ? (
          <>
            {preFilter && (
              <div className="filter-bar">
                <span className="filter-bar-label">
                  Filtr: <strong>{preFilter.treatment.name}</strong> · {preFilter.address}
                </span>
                <button className="btn btn-secondary btn-sm" onClick={handleClearFilter}>
                  ✕ Wyczyść filtr
                </button>
              </div>
            )}

            <div className="calendar-container">
              <ResourceCalendar
                onDateSelect={handleDateSelect}
                onOrderClick={handleOrderClick}
                refreshKey={refreshKey}
                filter={preFilter ? {
                  treatmentId: preFilter.treatmentId,
                  requiredSkill: preFilter.treatment.requiredSkill,
                  lat: preFilter.lat,
                  lng: preFilter.lng,
                } : undefined}
              />
            </div>

            <div className="legend">
              <span className="legend-item"><i className="dot dot-draft" /> Szkic</span>
              <span className="legend-item"><i className="dot dot-assigned" /> Przypisane</span>
              <span className="legend-item"><i className="dot dot-progress" /> W trakcie</span>
              <span className="legend-item"><i className="dot dot-completed" /> Zakończone</span>
            </div>
          </>
        ) : currentView === 'admin' ? (
          <div className="calendar-container">
            <AdminPanel />
          </div>
        ) : null}
      </main>

      {showPreFilter && (
        <PreFilterModal
          onFilter={handlePreFilterDone}
          onClose={() => setShowPreFilter(false)}
        />
      )}

      {showOrderForm && (
        <OrderForm
          initialDate={selectedDate}
          initialTechnicianId={selectedTechnicianId}
          initialAddress={preFilter?.address}
          initialLat={preFilter?.lat}
          initialLng={preFilter?.lng}
          initialTreatmentId={preFilter?.treatmentId}
          onClose={() => setShowOrderForm(false)}
          onCreated={handleOrderCreated}
        />
      )}

      {selectedOrder && (
        <OrderDetail
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onAssign={handleAssignFromDetail}
          onDeleted={() => {
            // Zamknij modal i wymuś świeży fetch — DayDataCache.clear() w ResourceCalendar
            // wykonuje się na zmianę refreshKey, więc usunięte zlecenie zniknie z widoku.
            setSelectedOrder(null);
            setRefreshKey(k => k + 1);
          }}
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
