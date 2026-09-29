const TOKEN_KEY = 'erpevv_token';

export type Role = 'SUPER' | 'ADMIN' | 'TECHNOLOGIST' | 'DISPATCHER' | 'OPERATOR';

export type Me = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  tenantId: string;
  tenantName: string;
  tenantCode: string;
  employee: { id: string; fullName: string; defaultPostId: string | null } | null;
};

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData) && !headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(path, { ...init, headers, credentials: 'include' });
  if (res.status === 401) {
    setToken(null);
    if (!path.includes('/auth/login')) {
      window.location.href = '/login';
    }
  }
  if (!res.ok) {
    let message = `Ошибка ${res.status}`;
    try {
      const body = await res.json();
      message = body.message ?? body.error ?? message;
      if (Array.isArray(body.message)) message = body.message.join(', ');
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const roleLabel: Record<Role, string> = {
  SUPER: 'Суперпользователь',
  ADMIN: 'Администратор',
  TECHNOLOGIST: 'Технолог',
  DISPATCHER: 'Диспетчер',
  OPERATOR: 'Оператор',
};

export function isSuper(role?: Role | null) {
  return role === 'SUPER';
}

export function isOperatorOnly(role?: Role | null) {
  return role === 'OPERATOR';
}
