import { create } from 'zustand';
import api from '../utils/api';

export const useCheckerStore = create((set, get) => ({
  jobs: [],
  currentJob: null,
  currentResults: [],
  logs: [],
  socket: null,
  isLoading: false,
  error: null,

  fetchJobs: async () => {
    set({ isLoading: true });
    try {
      const response = await api.get('/jobs');
      set({ jobs: response.data });
    } catch (err) {
      set({ error: 'Failed to fetch jobs' });
    } finally {
      set({ isLoading: false });
    }
  },

  startJob: async (formData) => {
    set({ isLoading: true, error: null, logs: [] });
    try {
      const response = await api.post('/jobs', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      set({ currentJob: response.data });
      get().connectWebSocket(response.data.id);
      get().fetchJobs();
      return response.data;
    } catch (err) {
      const errMsg = err.response?.data?.detail || 'Failed to start checking job';
      set({ error: errMsg });
      throw new Error(errMsg);
    } finally {
      set({ isLoading: false });
    }
  },

  pauseJob: async (jobId) => {
    try {
      await api.post(`/jobs/${jobId}/action?action=pause`);
      // Update state local status immediately
      set((state) => ({
        currentJob: state.currentJob?.id === jobId ? { ...state.currentJob, status: 'paused' } : state.currentJob,
        jobs: state.jobs.map(j => j.id === jobId ? { ...j, status: 'paused' } : j)
      }));
    } catch (err) {
      set({ error: 'Failed to pause job' });
    }
  },

  resumeJob: async (jobId) => {
    try {
      await api.post(`/jobs/${jobId}/action?action=resume`);
      set((state) => ({
        currentJob: state.currentJob?.id === jobId ? { ...state.currentJob, status: 'processing' } : state.currentJob,
        jobs: state.jobs.map(j => j.id === jobId ? { ...j, status: 'processing' } : j)
      }));
      // Re-connect WebSocket if disconnected
      get().connectWebSocket(jobId);
    } catch (err) {
      set({ error: 'Failed to resume job' });
    }
  },

  loadJobDetails: async (jobId) => {
    try {
      const jobRes = await api.get(`/jobs/${jobId}`);
      const resultsRes = await api.get(`/jobs/${jobId}/results?limit=200`);
      set({ currentJob: jobRes.data, currentResults: resultsRes.data });
    } catch (err) {
      set({ error: 'Failed to load job details' });
    }
  },

  connectWebSocket: (jobId) => {
    // Disconnect old socket
    get().disconnectWebSocket();

    const isProduction = import.meta.env.PROD;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;

    let wsUrl;
    if (isProduction) {
      wsUrl = `${protocol}//${host}/_/backend/api/v1/ws/${jobId}`;
    } else {
      const wsHost = host.includes('localhost:3000') ? 'localhost:8000' : host;
      wsUrl = `${protocol}//${wsHost}/api/v1/ws/${jobId}`;
    }

    logger_log(`Connecting to WS: ${wsUrl}`);
    const socket = new WebSocket(wsUrl);

    socket.onmessage = (event) => {
      // Receive heartbeat ack or job update payload
      if (event.data.startsWith('heartbeat_ack')) return;

      try {
        const update = JSON.parse(event.data);
        if (update.job_id === jobId) {
          set((state) => {
            const updatedJob = {
              ...state.currentJob,
              status: update.status,
              processed_count: update.processed_count ?? state.currentJob?.processed_count ?? 0,
              valid_count: update.valid_count ?? state.currentJob?.valid_count ?? 0,
              invalid_count: update.invalid_count ?? state.currentJob?.invalid_count ?? 0,
              total_count: update.total_count ?? state.currentJob?.total_count ?? 0,
            };

            const newLogs = update.log ? [...state.logs, update.log] : state.logs;
            // Cap logs list size for frontend performance
            if (newLogs.length > 300) newLogs.shift();

            return {
              currentJob: updatedJob,
              logs: newLogs
            };
          });
        }
      } catch (e) {
        logger_log('WS parse error: ' + e);
      }
    };

    socket.onclose = () => {
      logger_log('WS Connection closed');
    };

    socket.onerror = (err) => {
      logger_log('WS Connection error: ' + err);
    };

    set({ socket });
  },

  disconnectWebSocket: () => {
    const { socket } = get();
    if (socket) {
      socket.close();
      set({ socket: null });
    }
  },
  
  clearCurrentJob: () => {
    get().disconnectWebSocket();
    set({ currentJob: null, currentResults: [], logs: [] });
  }
}));

function logger_log(msg) {
  console.log('[Zustand Checker]', msg);
}
