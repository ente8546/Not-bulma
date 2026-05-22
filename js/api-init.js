/**
 * Node.js mini sunucu API istemcisi (Firebase yerine).
 */

const TOKEN_KEY = "adminToken";
let eventSource = null;

async function apiFetch(path, options = {}) {
  const { headers: extraHeaders = {}, ...rest } = options;
  const res = await fetch(path, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errMsg = data.error || `İstek başarısız (${res.status})`;
    if (res.status === 401 && errMsg.includes("Oturum")) {
      setAdminToken(null);
    }
    throw new Error(errMsg);
  }
  return data;
}

export async function initApi() {
  const res = await fetch("/api/health");
  if (!res.ok) {
    throw new Error(
      "Sunucuya bağlanılamadı. Proje klasöründe `npm start` çalıştırın."
    );
  }
}

export function getAdminToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setAdminToken(token) {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}

export async function adminLogin(password) {
  return apiFetch("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export async function getAdminConfig() {
  const token = getAdminToken();
  if (!token) throw new Error("Oturum yok");
  return apiFetch("/api/admin/config", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function saveGradeAndPuzzle(grade, puzzle) {
  const token = getAdminToken();
  if (!token) throw new Error("Oturum yok");
  return apiFetch("/api/admin/grade", {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ grade, puzzle }),
  });
}

export async function changeAdminPassword(currentPassword, newPassword) {
  const token = getAdminToken();
  if (!token) throw new Error("Oturum yok");
  return apiFetch("/api/admin/password", {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export function watchPublicPuzzle(callback, onError) {
  if (eventSource) {
    eventSource.close();
  }

  eventSource = new EventSource("/api/puzzle/stream");

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      callback(data);
    } catch (err) {
      onError?.(err);
    }
  };

  eventSource.onerror = () => {
    onError?.(new Error("Canlı bağlantı kesildi"));
    fetch("/api/puzzle")
      .then((r) => r.json())
      .then(callback)
      .catch(onError);
  };

  return () => {
    eventSource?.close();
    eventSource = null;
  };
}
