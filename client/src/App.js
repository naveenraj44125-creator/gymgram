import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Container } from '@mui/material';
import { useAuth } from './context/AuthContext';

// Layout Components
import Navbar from './components/layout/Navbar';
import BottomNavigation from './components/layout/BottomNavigation';

// Auth Components
import Login from './components/auth/Login';
import Register from './components/auth/Register';

// Main App Components
import Home from './components/pages/Home';
import Explore from './components/pages/Explore';
import Profile from './components/pages/Profile';
import CreatePost from './components/pages/CreatePost';
import PostDetail from './components/pages/PostDetail';
import Search from './components/pages/Search';
import Settings from './components/pages/Settings';
import EditProfile from './components/pages/EditProfile';

// Utility Components
import LoadingScreen from './components/common/LoadingScreen';
import ProtectedRoute from './components/common/ProtectedRoute';
import PublicRoute from './components/common/PublicRoute';

function App() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  // Show loading screen while checking authentication
  if (isLoading) {
    return <LoadingScreen />;
  }

  // Check if current route is an auth route
  const isAuthRoute = ['/login', '/register'].includes(location.pathname);

  return (
    <div className="App">
      {/* Show navbar only when authenticated and not on auth routes */}
      {isAuthenticated && !isAuthRoute && <Navbar />}
      
      <Container 
        maxWidth="lg" 
        sx={{ 
          minHeight: '100vh',
          paddingTop: isAuthenticated && !isAuthRoute ? '80px' : '0',
          paddingBottom: isAuthenticated && !isAuthRoute ? '80px' : '0',
        }}
      >
        <Routes>
          {/* Public Routes */}
          <Route 
            path="/login" 
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            } 
          />
          <Route 
            path="/register" 
            element={
              <PublicRoute>
                <Register />
              </PublicRoute>
            } 
          />

          {/* Protected Routes */}
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/explore" 
            element={
              <ProtectedRoute>
                <Explore />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/search" 
            element={
              <ProtectedRoute>
                <Search />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/create" 
            element={
              <ProtectedRoute>
                <CreatePost />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/profile/:username" 
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/post/:id" 
            element={
              <ProtectedRoute>
                <PostDetail />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/settings" 
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/edit-profile" 
            element={
              <ProtectedRoute>
                <EditProfile />
              </ProtectedRoute>
            } 
          />

          {/* Hashtag and User Routes */}
          <Route 
            path="/hashtag/:tag" 
            element={
              <ProtectedRoute>
                <Search />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/gym/:gymName" 
            element={
              <ProtectedRoute>
                <Search />
              </ProtectedRoute>
            } 
          />

          {/* Redirect routes */}
          <Route 
            path="/profile" 
            element={
              <Navigate 
                to={user ? `/profile/${user.username}` : '/login'} 
                replace 
              />
            } 
          />

          {/* 404 Route */}
          <Route 
            path="*" 
            element={
              <div style={{ 
                textAlign: 'center', 
                padding: '2rem',
                minHeight: '50vh',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center'
              }}>
                <h1 className="text-gradient">404</h1>
                <p>Page not found</p>
              </div>
            } 
          />
        </Routes>
      </Container>

      {/* Show bottom navigation only when authenticated and not on auth routes */}
      {isAuthenticated && !isAuthRoute && <BottomNavigation />}
    </div>
  );
}

export default App;
