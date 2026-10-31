import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

const api = axios.create({ baseURL: BASE_URL });

// ─── Attach JWT to every outgoing request ──────────────────────────────────
api.interceptors.request.use(config => {
  const token = localStorage.getItem('brightloop_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─── Global error handling ─────────────────────────────────────────────────
api.interceptors.response.use(
  response => response,
  error => {
    // 401 → token expired or invalid → force re-login
    if (error.response?.status === 401) {
      localStorage.clear();
      // Avoid redirect loop if we're already on the login page
      if (!window.location.pathname.startsWith('/login')) {
        window.location.reload();
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Download an invoice PDF via the authenticated API (token sent in Authorization header).
 * Falls back gracefully if the browser blocks the blob URL.
 */
export async function downloadInvoicePdf(invoiceId, invoiceNumber) {
  const res = await api.get(`/invoices/${invoiceId}/pdf`, { responseType: 'blob' });
  const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${invoiceNumber || `INV-${invoiceId}`}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default api;
