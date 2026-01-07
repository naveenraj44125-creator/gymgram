import React, { createContext, useContext, useReducer, useEffect } from 'react';
import axios from 'axios';

// Create Auth Context
const AuthContext = createContext();

// Action types
const AUTH_ACTIONS = {
  LOGIN_START: 'LOGIN_START',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  LOGOUT: 'LOGOUT',
  REGISTER_START: 'REGISTER_START',
  REGISTER_SUCCESS: 'REGISTER_SUCCESS',
  REGISTER_FAILURE: 'REGISTER_FAILURE',
  UPDATE_USER: 'UPDATE_USER',
  CLEAR_ERROR: 'CLEAR_ERROR'
};

// Initial state
const initialState = {
  user: null,
  accessToken: localStorage.getItem('accessToken'),
  refreshToken: localStorage.getItem('refreshToken'),
  isLoading: false,
  isAuthenticated: !!localStorage.getItem('accessToken'),
  error: null
};

// Auth reducer
const authReducer = (state, action) => {
  switch (action.type) {
    case AUTH_ACTIONS.LOGIN_START:
    case AUTH_ACTIONS.REGISTER_START:
      return {
        ...state,
        isLoading: true,
        error: null
      };

    case AUTH_ACTIONS.LOGIN_SUCCESS:
    case AUTH_ACTIONS.REGISTER_SUCCESS:
      // Store tokens in localStorage
      localStorage.setItem('accessToken', action.payload.accessToken);
      localStorage.setItem('refreshToken', action.payload.refreshToken);
      
      // Set default auth header
      axios.defaults.headers.common['Authorization'] = `Bearer ${action.payload.accessToken}`;
      
      return {
        ...state,
        user: action.payload.user,
        accessToken: action.payload.accessToken,
        refreshToken: action.payload.refreshToken,
        isAuthenticated: true,
        isLoading: false,
        error: null
      };

    case AUTH_ACTIONS.LOGIN_FAILURE:
    case AUTH_ACTIONS.REGISTER_FAILURE:
      return {
        ...state,
        isLoading: false,
        error: action.payload
      };

    case AUTH_ACTIONS.LOGOUT:
      // Remove tokens from localStorage
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      
      // Remove default auth header
      delete axios.defaults.headers.common['Authorization'];
      
      return {
        ...state,
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
        error: null
      };

    case AUTH_ACTIONS.UPDATE_USER:
      return {
        ...state,
        user: { ...state.user, ...action.payload }
      };

    case AUTH_ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        error: null
      };

    default:
      return state;
  }
};

// Auth Provider Component
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Set up axios interceptors for token refresh
  useEffect(() => {
    const requestInterceptor = axios.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('accessToken');
        if (token) {
          config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const refreshToken = localStorage.getItem('refreshToken');
            if (refreshToken) {
              const response = await axios.post('/api/auth/refresh', {
                refreshToken
              });

              const { accessToken, refreshToken: newRefreshToken } = response.data;
              
              localStorage.setItem('accessToken', accessToken);
              localStorage.setItem('refreshToken', newRefreshToken);
              
              axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
              originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;

              return axios(originalRequest);
            }
          } catch (refreshError) {
            dispatch({ type: AUTH_ACTIONS.LOGOUT });
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, []);

  // Load user data on app start if token exists
  useEffect(() => {
    const loadUser = async () => {
      const token = localStorage.getItem('accessToken');
      if (token && !state.user) {
        try {
          const response = await axios.get('/api/auth/me');
          dispatch({
            type: AUTH_ACTIONS.UPDATE_USER,
            payload: response.data.user
          });
        } catch (error) {
          console.error('Failed to load user:', error);
          dispatch({ type: AUTH_ACTIONS.LOGOUT });
        }
      }
    };

    loadUser();
  }, [state.user]);

  // Login function
  const login = async (email, password) => {
    dispatch({ type: AUTH_ACTIONS.LOGIN_START });

    try {
      const response = await axios.post('/api/auth/login', {
        email,
        password
      });

      dispatch({
        type: AUTH_ACTIONS.LOGIN_SUCCESS,
        payload: response.data
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Login failed';
      dispatch({
        type: AUTH_ACTIONS.LOGIN_FAILURE,
        payload: errorMessage
      });
      return { success: false, error: errorMessage };
    }
  };

  // Register function
  const register = async (userData) => {
    dispatch({ type: AUTH_ACTIONS.REGISTER_START });

    try {
      const response = await axios.post('/api/auth/register', userData);

      dispatch({
        type: AUTH_ACTIONS.REGISTER_SUCCESS,
        payload: response.data
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Registration failed';
      dispatch({
        type: AUTH_ACTIONS.REGISTER_FAILURE,
        payload: errorMessage
      });
      return { success: false, error: errorMessage };
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await axios.post('/api/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      dispatch({ type: AUTH_ACTIONS.LOGOUT });
    }
  };

  // Update user function
  const updateUser = async (userData) => {
    try {
      const response = await axios.put('/api/auth/me', userData);
      dispatch({
        type: AUTH_ACTIONS.UPDATE_USER,
        payload: response.data.user
      });
      return { success: true, user: response.data.user };
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Update failed';
      return { success: false, error: errorMessage };
    }
  };

  // Change password function
  const changePassword = async (currentPassword, newPassword) => {
    try {
      await axios.post('/api/auth/change-password', {
        currentPassword,
        newPassword
      });
      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Password change failed';
      return { success: false, error: errorMessage };
    }
  };

  // Clear error function
  const clearError = () => {
    dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });
  };

  const value = {
    ...state,
    login,
    register,
    logout,
    updateUser,
    changePassword,
    clearError
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// HOC for protected routes
export const withAuth = (Component) => {
  return function AuthenticatedComponent(props) {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
      return <div>Loading...</div>; // You can replace with a proper loading component
    }

    if (!isAuthenticated) {
      return null; // This will be handled by the route protection logic
    }

    return <Component {...props} />;
  };
};

export default AuthContext;
