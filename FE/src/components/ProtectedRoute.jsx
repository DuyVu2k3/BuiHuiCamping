import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ allowedRoles = [] }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    // Redirect to their appropriate home page if trying to access unauthorized role route
    if (user.role === 'Manager') return <Navigate to="/manager/dashboard" replace />;
    if (user.role === 'Receptionist') return <Navigate to="/receptionist/booking" replace />;
    if (user.role === 'Waiter') return <Navigate to="/waiter/orders" replace />;
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
