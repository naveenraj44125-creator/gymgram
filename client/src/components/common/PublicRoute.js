import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import LoadingScreen from './LoadingScreen';

const PublicRoute = ({ children, restricted = true }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Show loading screen while checking authentication
  if (isLoading) {
    return <LoadingScreen message="Loading..." />;
  }

  // If authenticated and trying to access restricted public route (login/register),
  // redirect to the intended destination or home
  if (isAuthenticated && restricted) {
    const from = location.state?.from || '/';
    return <Navigate to={from} replace />;
  }

  // If not authenticated or accessing non-restricted public route, render the component
  return children;
};

export default PublicRoute;
