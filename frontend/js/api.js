// Change this if your backend runs on a different host/port
const API_BASE = 'https://loan-management-production-a29b.up.railway.app/api';

function getToken() {
  return localStorage.getItem('lm_token');
}

function getUser() {
  const raw = localStorage.getItem('lm_user');
  return raw ? JSON.parse(raw) : null;
}

function setSession(token, user) {
  localStorage.setItem('lm_token', token);
  localStorage.setItem('lm_user', JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem('lm_token');
  localStorage.removeItem('lm_user');
}

// Wrapper around fetch: adds base URL, JSON headers, auth token, and throws on non-2xx.
async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  if (res.status === 401) {
    const priorUser = getUser();
    const wasStaffTier = priorUser && ['super_admin', 'admin', 'staff'].includes(priorUser.role);
    clearSession();
    window.location.href = wasStaffTier ? 'user-login.html' : 'customer-login.html';
    return;
  }

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    throw new Error((data && data.message) || 'Request failed');
  }
  return data;
}

// Downloads a CSV export by opening it in a new tab with the auth token as a query param
// is not supported by the backend (it reads the header), so we fetch as blob instead.
async function downloadCsv(path, filename) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Export failed');
  }
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

// Protects a page: redirects to the right portal's login if not authenticated, or if role doesn't match.
function guardPage(requiredRole) {
  const allowed = Array.isArray(requiredRole) ? requiredRole : (requiredRole ? [requiredRole] : null);
  const isStaffTier = r => ['super_admin', 'admin', 'staff'].includes(r);

  const user = getUser();
  if (!getToken() || !user) {
    window.location.href = (allowed && allowed[0] === 'customer') ? 'customer-login.html' : 'user-login.html';
    return null;
  }
  if (allowed && !allowed.includes(user.role)) {
    window.location.href = isStaffTier(user.role) ? 'user-login.html' : 'customer-login.html';
    return null;
  }
  return user;
}

function formatMoney(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
