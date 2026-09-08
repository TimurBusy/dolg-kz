const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

function withHeaders(init: RequestInit, accessToken?: string) {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  return headers;
}

async function errorFromResponse(response: Response) {
  const payload = await response.json().catch(() => null);
  const message = payload?.message;
  return new Error(
    Array.isArray(message) ? message.join(', ') : message || 'Ошибка запроса',
  );
}

export async function api<T>(
  path: string,
  init: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: withHeaders(init, accessToken),
  });

  if (!response.ok) {
    throw await errorFromResponse(response);
  }

  return (await response.json()) as T;
}

export async function apiBlob(
  path: string,
  init: RequestInit = {},
  accessToken?: string,
) {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: withHeaders(init, accessToken),
  });

  if (!response.ok) {
    throw await errorFromResponse(response);
  }

  return response.blob();
}
