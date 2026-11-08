
const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  if (!API_URL) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured.");
  }

  const normalizedEndpoint = endpoint.startsWith("/")
    ? endpoint
    : `/${endpoint}`;

  const headers = new Headers(options.headers);

  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(
    `${API_URL}${normalizedEndpoint}`,
    {
      ...options,
      credentials: "include",
      headers,
    }
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      message || `Request failed: ${response.status}`
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
