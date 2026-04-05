import axios from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// In-memory token storage
let accessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

export const getAccessToken = () => accessToken;

// Request interceptor to attach token
api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Response interceptor — unwrap { success, data } envelope + handle 401
// API always returns { success: true, data: <payload> }
// If data is an array (list endpoint), normalize to { items, total, page, limit, pages }
// If data is an object (single resource / auth), return as-is
api.interceptors.response.use(
  (response) => {
    const body = response.data;
    if (body !== null && typeof body === 'object' && 'data' in body) {
      const payload = body.data;
      if (Array.isArray(payload)) {
        response.data = {
          items: payload,
          total: payload.length,
          page: 1,
          limit: payload.length,
          pages: 1,
        };
      } else {
        response.data = payload;
      }
    }
    return response;
  },
  async (error) => {
    if (error.response?.status === 401) {
      accessToken = null;
      window.location.href = '/login';
    }

    // Extract a human-readable message from the API error envelope
    const body = error.response?.data;
    if (body?.error) {
      const { message, details } = body.error;
      if (details && typeof details === 'object') {
        // Join all field errors: "name: Field required, blueprint_id: Field required"
        const fieldErrors = Object.entries(details)
          .map(([field, msg]) => `${field}: ${msg}`)
          .join(' · ');
        error.message = fieldErrors || message;
      } else {
        error.message = message || error.message;
      }
    }

    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/v1/auth/login', { email, password }),
  logout: () => api.post('/v1/auth/logout'),
  refresh: (refresh_token: string) =>
    api.post('/v1/auth/refresh', { refresh_token }),
  me: () => api.get('/v1/auth/me'),
};

// Blueprints
export const blueprintsApi = {
  list: (params?: Record<string, unknown>) => api.get('/v1/blueprints/', { params }),
  get: (id: string) => api.get(`/v1/blueprints/${id}`),
  create: (data: { name: string; description?: string; sequential?: boolean }) =>
    api.post('/v1/blueprints/', data),
  update: (id: string, data: { name?: string; description?: string; sequential?: boolean }) =>
    api.put(`/v1/blueprints/${id}`, data),
  delete: (id: string) => api.delete(`/v1/blueprints/${id}`),
  publish: (id: string) => api.post(`/v1/blueprints/${id}/publish`),
  clone: (id: string, name: string) =>
    api.post(`/v1/blueprints/${id}/clone`, { name }),
  versions: (id: string) => api.get(`/v1/blueprints/${id}/versions`),
};

// Steps
export const stepsApi = {
  list: (blueprintId: string) =>
    api.get(`/v1/blueprints/${blueprintId}/steps/`),
  get: (blueprintId: string, stepId: string) =>
    api.get(`/v1/blueprints/${blueprintId}/steps/${stepId}`),
  create: (blueprintId: string, data: Record<string, unknown>) =>
    api.post(`/v1/blueprints/${blueprintId}/steps/`, data),
  update: (blueprintId: string, stepId: string, data: Record<string, unknown>) =>
    api.put(`/v1/blueprints/${blueprintId}/steps/${stepId}`, data),
  delete: (blueprintId: string, stepId: string) =>
    api.delete(`/v1/blueprints/${blueprintId}/steps/${stepId}`),
  reorder: (blueprintId: string, step_ids: string[]) =>
    api.put(`/v1/blueprints/${blueprintId}/steps/reorder`, { step_ids }),
};

// Runs
export const runsApi = {
  list: (params?: Record<string, unknown>) => api.get('/v1/runs/', { params }),
  get: (id: string) => api.get(`/v1/runs/${id}`),
  create: (blueprint_id: string, context?: Record<string, unknown>) =>
    api.post('/v1/runs/', { blueprint_id, context: context || {} }),
  delete: (id: string) => api.delete(`/v1/runs/${id}`),
  pause: (id: string) => api.post(`/v1/runs/${id}/pause`),
  resume: (id: string) => api.post(`/v1/runs/${id}/resume`),
  cancel: (id: string) => api.post(`/v1/runs/${id}/cancel`),
  retry: (id: string) => api.post(`/v1/runs/${id}/retry`),
  steps: (id: string) => api.get(`/v1/runs/${id}/steps/`),
  approveStep: (runId: string, stepId: string, notes?: string) =>
    api.post(`/v1/runs/${runId}/steps/${stepId}/approve`, { notes }),
  rejectStep: (runId: string, stepId: string, reason: string) =>
    api.post(`/v1/runs/${runId}/steps/${stepId}/reject`, { reason }),
  completeStep: (runId: string, stepId: string, output?: Record<string, unknown>, notes?: string) =>
    api.post(`/v1/runs/${runId}/steps/${stepId}/complete`, { output, notes }),
  stepLogs: (runId: string, stepId: string, params?: Record<string, unknown>) =>
    api.get(`/v1/runs/${runId}/steps/${stepId}/logs`, { params }),
};

// Scripts
export const scriptsApi = {
  list: (params?: Record<string, unknown>) => api.get('/v1/scripts/', { params }),
  get: (id: string) => api.get(`/v1/scripts/${id}`),
  create: (data: Record<string, unknown>) => api.post('/v1/scripts/', data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/v1/scripts/${id}`, data),
  delete: (id: string) => api.delete(`/v1/scripts/${id}`),
  validate: (data: Record<string, unknown>) =>
    api.post('/v1/scripts/validate', data),
  validateSaved: (id: string, test_params?: Record<string, unknown>, code?: string) =>
    api.post(`/v1/scripts/${id}/validate`, { test_params: test_params || {}, ...(code !== undefined ? { code } : {}) }),
  clone: (id: string, name: string) =>
    api.post(`/v1/scripts/${id}/clone`, { name }),
  versions: (id: string) => api.get(`/v1/scripts/${id}/versions`),
  restore: (id: string, version: number) =>
    api.post(`/v1/scripts/${id}/restore/${version}`),
};

// Schedules
export const schedulesApi = {
  list: (params?: Record<string, unknown>) => api.get('/v1/schedules/', { params }),
  get: (id: string) => api.get(`/v1/schedules/${id}`),
  create: (data: Record<string, unknown>) => api.post('/v1/schedules/', data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/v1/schedules/${id}`, data),
  delete: (id: string) => api.delete(`/v1/schedules/${id}`),
  activate: (id: string) => api.post(`/v1/schedules/${id}/activate`),
  deactivate: (id: string) => api.post(`/v1/schedules/${id}/deactivate`),
  trigger: (id: string) => api.post(`/v1/schedules/${id}/trigger`),
  history: (id: string, params?: Record<string, unknown>) =>
    api.get(`/v1/schedules/${id}/history`, { params }),
};

// Notifications
export const notificationsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get('/v1/notifications/', { params }),
  unreadCount: () => api.get('/v1/notifications/unread-count'),
  markRead: (id: string) => api.put(`/v1/notifications/${id}/read`),
  markAllRead: () => api.put('/v1/notifications/read-all'),
  delete: (id: string) => api.delete(`/v1/notifications/${id}`),
};

// Webhooks
export const webhooksApi = {
  list: (params?: Record<string, unknown>) => api.get('/v1/webhooks/', { params }),
  create: (data: Record<string, unknown>) => api.post('/v1/webhooks/', data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/v1/webhooks/${id}`, data),
  delete: (id: string) => api.delete(`/v1/webhooks/${id}`),
  test: (id: string) => api.post(`/v1/webhooks/${id}/test`),
};

// Users
export const usersApi = {
  list: (params?: Record<string, unknown>) => api.get('/v1/users/', { params }),
  get: (id: string) => api.get(`/v1/users/${id}`),
  create: (data: Record<string, unknown>) => api.post('/v1/users/', data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/v1/users/${id}`, data),
  updateRole: (id: string, role: string) =>
    api.put(`/v1/users/${id}/role`, { role }),
  delete: (id: string) => api.delete(`/v1/users/${id}`),
};
