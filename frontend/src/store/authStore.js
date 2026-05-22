import { create } from 'zustand';
import api from '../utils/api';
import { supabase } from '../utils/supabaseClient';

export const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: !!localStorage.getItem('access_token'),
  isLoading: false,
  error: null,

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  checkAuth: async () => {
    set({ isLoading: true, error: null });
    try {
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          localStorage.setItem('access_token', session.access_token);
          localStorage.setItem('refresh_token', session.refresh_token);
          
          const response = await api.get('/auth/me');
          set({ user: response.data, isAuthenticated: true });
        } else {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          set({ user: null, isAuthenticated: false });
        }
      } else {
        if (!localStorage.getItem('access_token')) {
          set({ isAuthenticated: false, user: null });
          return;
        }
        const response = await api.get('/auth/me');
        set({ user: response.data, isAuthenticated: true });
      }
    } catch (err) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      set({ user: null, isAuthenticated: false });
    } finally {
      set({ isLoading: false });
    }
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      if (supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          set({ error: error.message });
          throw new Error(error.message);
        }
        
        const session = data.session;
        if (session) {
          localStorage.setItem('access_token', session.access_token);
          localStorage.setItem('refresh_token', session.refresh_token);
          set({ isAuthenticated: true });
          await get().checkAuth();
          return true;
        }
      } else {
        const response = await api.post('/auth/login', { email, password });
        const { access_token, refresh_token } = response.data;
        
        localStorage.setItem('access_token', access_token);
        localStorage.setItem('refresh_token', refresh_token);
        
        set({ isAuthenticated: true });
        await get().checkAuth();
        return true;
      }
    } catch (err) {
      const errMsg = err.response?.data?.detail || err.message || 'Login failed';
      set({ error: errMsg });
      throw new Error(errMsg);
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      if (supabase) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) {
          set({ error: error.message });
          throw new Error(error.message);
        }
        set({ error: null });
        return true;
      } else {
        await api.post('/auth/register', { email, password });
        set({ error: null });
        return true;
      }
    } catch (err) {
      const errMsg = err.response?.data?.detail || err.message || 'Registration failed';
      set({ error: errMsg });
      throw new Error(errMsg);
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch (e) {
      console.error('Supabase logout issue:', e);
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      set({ user: null, isAuthenticated: false, error: null });
    }
  },
  
  clearError: () => set({ error: null })
}));
