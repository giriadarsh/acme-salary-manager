export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  const response = await fetch(`/api${path}`, { ...init, headers, credentials: 'same-origin' });
  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/login') {
      window.dispatchEvent(new Event('acme-session-ended'));
    }
    const data = await response.json().catch(() => null);
    throw new ApiError(response.status, data?.message ?? 'The server could not complete the request.');
  }
  return response.status === 204 ? undefined as T : response.json();
}

export function messageFor(error: unknown) {
  return error instanceof ApiError ? error.message : 'Could not connect. Check your connection and try again.';
}
