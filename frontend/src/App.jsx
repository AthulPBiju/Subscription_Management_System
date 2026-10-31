import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CustomerPortal from './pages/CustomerPortal';
import Customers from './pages/Customers';
import Catalog from './pages/Catalog';
import Subscriptions from './pages/Subscriptions';
import Invoices from './pages/Invoices';
import Payments from './pages/Payments';
import Discounts from './pages/Discounts';
import Reports from './pages/Reports';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('brightloop_token'));
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('brightloop_user') || 'null');
    } catch {
      return null;
    }
  });
  const [overdueCount, setOverdueCount] = useState(0);

  const handleLogin = data => {
    localStorage.setItem('brightloop_token', data.access_token);
    localStorage.setItem('brightloop_user', JSON.stringify(data.user));
    setToken(data.access_token);
    setUser(data.user);
  };

  const handleLogout = () => {
    localStorage.clear();
    setToken(null);
    setUser(null);
  };

  if (!token) {
    return <Login onLogin={handleLogin} />;
  }

  const isCustomer = user?.role === 'customer';

  return (
    <Layout user={user} onLogout={handleLogout} overdue={overdueCount}>
      <Routes>
        {/* If customer, root path shows CustomerPortal */}
        <Route
          path="/"
          element={
            isCustomer ? (
              <CustomerPortal user={user} />
            ) : (
              <Dashboard onOverdueChange={setOverdueCount} />
            )
          }
        />
        <Route path="/portal" element={<CustomerPortal user={user} />} />
        <Route path="/customers" element={isCustomer ? <Navigate to="/portal" replace /> : <Customers />} />
        <Route path="/catalog" element={<Catalog />} />
        <Route path="/subscriptions" element={isCustomer ? <Navigate to="/portal" replace /> : <Subscriptions />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/payments" element={isCustomer ? <Navigate to="/portal" replace /> : <Payments />} />
        <Route path="/discounts" element={isCustomer ? <Navigate to="/portal" replace /> : <Discounts />} />
        <Route path="/reports" element={isCustomer ? <Navigate to="/portal" replace /> : <Reports />} />
        <Route path="/settings" element={<SettingsPage user={user} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
