/*
  Central API client. Set window.ADEVOS_API_BASE before this script loads
  (see config.js) to point at the backend deployment. Everything else in
  the frontend goes through here so auth headers and error handling stay
  in one place.
*/
const Api = (() => {
  const BASE = window.ADEVOS_API_BASE || 'http://localhost:5000';

  function getToken() {
    return localStorage.getItem('adevos_token');
  }
  function getAdminToken() {
    return localStorage.getItem('adevos_admin_token');
  }
  function setToken(token) {
    localStorage.setItem('adevos_token', token);
  }
  function setAdminToken(token) {
    localStorage.setItem('adevos_admin_token', token);
  }
  function clearSession() {
    localStorage.removeItem('adevos_token');
    localStorage.removeItem('adevos_user');
  }
  function clearAdminSession() {
    localStorage.removeItem('adevos_admin_token');
  }

  async function request(path, { method = 'GET', body, admin = false } = {}) {
    const token = admin ? getAdminToken() : getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    let response;
    try {
      response = await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      throw new Error('Cannot reach the server. Check your connection and try again.');
    }

    let data = null;
    try {
      data = await response.json();
    } catch (_) {
      /* no body */
    }

    if (!response.ok) {
      throw new Error(data?.message || `Request failed (${response.status}).`);
    }
    return data;
  }

  return {
    get: (path, opts) => request(path, { ...opts, method: 'GET' }),
    post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
    patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body }),
    del: (path, opts) => request(path, { ...opts, method: 'DELETE' }),
    getToken, setToken, getAdminToken, setAdminToken, clearSession, clearAdminSession,
  };
})();
