import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import GuestLayout from './pages/Customer/GuestLayout';
import CustomerIntroPage from './pages/Customer/CustomerIntroPage';
import OnlineBookingPage from './pages/Customer/OnlineBookingPage';
import CustomerLayout from './pages/Customer/CustomerLayout';
import MenuPage from './pages/Customer/MenuPage';
import CartPage from './pages/Customer/CartPage';
import CustomerHistoryPage from './pages/Customer/CustomerHistoryPage';

import ManagerLayout from './pages/Manager/ManagerLayout';
import MenuManagementPage from './pages/Manager/MenuManagementPage';
import FacilityManagementPage from './pages/Manager/FacilityManagementPage';
import ManagerDashboardPage from './pages/Manager/ManagerDashboardPage';

import ReceptionistLayout from './pages/Staff/ReceptionistLayout';
import ReceptionistBookingPage from './pages/Staff/ReceptionistBookingPage';
import ReceptionistOrdersPage from './pages/Staff/ReceptionistOrdersPage';

import WaiterLayout from './pages/Staff/WaiterLayout';
import WaiterOrdersPage from './pages/Staff/WaiterOrdersPage';

import { Toaster } from 'react-hot-toast';

import BookingHistoryPage from './pages/Common/BookingHistoryPage';

function App() {
  return (
    <>
      <Toaster 
        position="top-center"
        toastOptions={{
          className: 'font-semibold text-sm rounded-2xl shadow-xl',
          duration: 3000,
          style: {
            background: '#334155',
            color: '#fff',
          },
          success: {
            style: {
              background: '#10b981',
            },
          },
          error: {
            style: {
              background: '#f43f5e',
            },
          },
        }}
      />
      <BrowserRouter>
        <Routes>
          {/* Default route redirects to Guest Intro Landing Page */}
          <Route path="/" element={<Navigate to="/guest/intro" replace />} />

          {/* GUEST PORTAL (Khách xem web ở nhà - Full-width Desktop/Mobile) */}
          <Route path="/guest" element={<GuestLayout />}>
            <Route path="" element={<Navigate to="intro" replace />} />
            <Route path="intro" element={<CustomerIntroPage />} />
            <Route path="booking" element={<OnlineBookingPage />} />
          </Route>

          {/* CUSTOMER PORTAL (Khách đang ở lều - Quét mã QR gọi món - Mobile max-w-md) */}
          <Route path="/customer" element={<CustomerLayout />}>
            <Route path="" element={<Navigate to="menu" replace />} />
            <Route path="menu" element={<MenuPage />} />
            <Route path="cart" element={<CartPage />} />
            <Route path="history" element={<CustomerHistoryPage />} />
          </Route>

          {/* MANAGER PORTAL */}
          <Route path="/manager" element={<ManagerLayout />}>
            <Route path="" element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<ManagerDashboardPage />} />
            <Route path="menu" element={<MenuManagementPage />} />
            <Route path="facilities" element={<FacilityManagementPage />} />
            <Route path="history" element={<BookingHistoryPage userRole="manager" />} />
          </Route>

          {/* RECEPTIONIST PORTAL */}
          <Route path="/receptionist" element={<ReceptionistLayout />}>
            <Route path="" element={<Navigate to="booking" replace />} />
            <Route path="booking" element={<ReceptionistBookingPage />} />
            <Route path="orders" element={<ReceptionistOrdersPage />} />
            <Route path="history" element={<BookingHistoryPage userRole="receptionist" />} />
          </Route>

          {/* WAITER PORTAL */}
          <Route path="/waiter" element={<WaiterLayout />}>
            <Route path="" element={<Navigate to="orders" replace />} />
            <Route path="orders" element={<WaiterOrdersPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
