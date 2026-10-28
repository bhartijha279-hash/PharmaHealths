import axios from 'axios';

const raw = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:8080/api';
const API_BASE_URL = (raw.startsWith('http') ? raw : `https://${raw}`).replace(/\/+$/, '').concat(raw.includes('/api') ? '' : '/api');

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('pharma_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Fast In-Memory Cache for Instant Page Transitions
const memoryCache = new Map();
const CACHE_TTL_MS = 15000; // 15 seconds

async function cachedGet(url, params = {}, forceFresh = false) {
  const cacheKey = `${url}:${JSON.stringify(params)}`;
  const now = Date.now();
  if (!forceFresh && memoryCache.has(cacheKey)) {
    const cached = memoryCache.get(cacheKey);
    if (now - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }
  }

  const response = await api.get(url, { params });
  memoryCache.set(cacheKey, { timestamp: now, data: response });
  return response;
}

export function invalidateCache(pattern = '') {
  if (!pattern) {
    memoryCache.clear();
  } else {
    for (const key of memoryCache.keys()) {
      if (key.includes(pattern)) {
        memoryCache.delete(key);
      }
    }
  }
}

export const normalizeUser = (user) => {
  if (!user) return null;
  const rawRoles = Array.isArray(user.roles) ? user.roles : (user.roles ? [user.roles] : []);
  const normalizedRoles = rawRoles.map(r => {
    if (typeof r === 'string') return r.toUpperCase().trim();
    if (r && typeof r.name === 'string') return r.name.toUpperCase().trim();
    if (r && typeof r.authority === 'string') return r.authority.toUpperCase().trim();
    return String(r).toUpperCase().trim();
  });
  return {
    ...user,
    roles: normalizedRoles
  };
};

export const isUserAdmin = (user) => {
  if (!user || !user.roles) return false;
  const roles = Array.isArray(user.roles) ? user.roles : [user.roles];
  return roles.some(role => {
    const name = typeof role === 'string' ? role : (role?.name || role?.authority || '');
    const clean = String(name).toUpperCase().trim();
    return clean === 'ROLE_ADMIN' || clean === 'ROLE_PHARMACIST' || clean === 'ADMIN' || clean === 'PHARMACIST';
  });
};

export const authService = {
  login: (username, password) => {
    invalidateCache();
    return api.post('/auth/signin', { username, password });
  },
  register: (userData) => {
    invalidateCache();
    return api.post('/auth/signup', userData);
  },
  logout: () => {
    invalidateCache();
    localStorage.removeItem('pharma_token');
    localStorage.removeItem('pharma_user');
  },
  getCurrentUser: () => {
    const userStr = localStorage.getItem('pharma_user');
    if (!userStr) return null;
    try {
      const parsed = JSON.parse(userStr);
      return normalizeUser(parsed);
    } catch {
      return null;
    }
  }
};

export const userService = {
  getMyProfile: () => api.get('/users/me'),
  updateProfile: (params) => {
    invalidateCache('users');
    return api.put('/users/profile', null, { params });
  },
  getActiveCustomers: (forceFresh = false) => cachedGet('/users/customers', {}, forceFresh),
  getStaffMembers: (forceFresh = false) => cachedGet('/users/staff', {}, forceFresh),
  getPhCoins: () => api.get('/users/ph-coins'),
  createAdminUser: (userData) => {
    invalidateCache('users');
    return api.post('/users/create-admin', userData);
  },
};

export const medicineService = {
  getMedicines: (categoryId, search, forceFresh = false) => 
    cachedGet('/public/medicines', { categoryId, search }, forceFresh),
  getCategories: (forceFresh = false) => cachedGet('/public/categories', {}, forceFresh),
  getMedicineById: (id) => api.get(`/public/medicines/${id}`),
  addMedicine: (medicine) => {
    invalidateCache('medicines');
    return api.post('/medicines', medicine);
  },
  updateMedicine: (id, medicine) => {
    invalidateCache('medicines');
    return api.put(`/medicines/${id}`, medicine);
  },
  deleteMedicine: (id) => {
    invalidateCache('medicines');
    return api.delete(`/medicines/${id}`);
  },
};

export const orderService = {
  placeOrder: (orderData) => {
    invalidateCache('orders');
    invalidateCache('bills');
    invalidateCache('medicines');
    return api.post('/orders', orderData);
  },
  getMyOrders: (forceFresh = false) => cachedGet('/orders/my', {}, forceFresh),
  getAllOrders: (forceFresh = false) => cachedGet('/orders', {}, forceFresh),
  trackDelivery: (trackingNumber) => api.get(`/orders/track/${trackingNumber}`),
  updateStatus: (id, status, deliveryNotes) => {
    // Cancelling or delivering an order also changes stock and billing
    invalidateCache('orders');
    invalidateCache('bills');
    invalidateCache('medicines');
    return api.patch(`/orders/${id}/status`, null, { params: { status, deliveryNotes } });
  },
};

export const billService = {
  getAllBills: (forceFresh = false) => cachedGet('/bills', {}, forceFresh),
  getMyBills: (forceFresh = false) => cachedGet('/bills/my', {}, forceFresh),
  updateBillStatus: (id, status) => {
    invalidateCache('bills');
    return api.patch(`/bills/${id}/status`, null, { params: { status } });
  },
};

export const supportService = {
  getAllTickets: (forceFresh = false) => cachedGet('/support', {}, forceFresh),
  getMyTickets: (forceFresh = false) => cachedGet('/support/my', {}, forceFresh),
  createTicket: (subject, category, message) => {
    invalidateCache('support');
    return api.post('/support', null, { params: { subject, category, message } });
  },
  respondToTicket: (id, response, status) => {
    invalidateCache('support');
    return api.patch(`/support/${id}/respond`, null, { params: { response, status } });
  },
};

export const prescriptionService = {
  uploadPrescription: (data) => {
    invalidateCache('prescriptions');
    return api.post('/prescriptions', null, { params: data });
  },
  getMyPrescriptions: (forceFresh = false) => cachedGet('/prescriptions/my', {}, forceFresh),
  getAllPrescriptions: (forceFresh = false) => cachedGet('/prescriptions', {}, forceFresh),
  updateStatus: (id, status) => {
    invalidateCache('prescriptions');
    return api.patch(`/prescriptions/${id}/status`, null, { params: { status } });
  },
};

export default api;
