import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import LoadingScreen from './LoadingScreen';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Show loading screen while checking authentication
  if (isLoading) {
    return <LoadingScreen message="Verifying access..." />;
  }

  // If not authenticated, redirect to login with the current location
  if (!isAuthenticated) {
    return (
      <Navigate 
        to="/login" 
        state={{ from: location.pathname }} 
        replace 
      />
    );
  }

  // If authenticated, render the protected component
  return children;
};

export default ProtectedRoute;
