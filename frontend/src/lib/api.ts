const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function apiRequest<T>(
endpoint: string,
options: RequestInit = {}
): Promise<T> {
if (!API_URL) {
throw new Error("NEXT_PUBLIC_API_URL is not configured.");
}


const response = await fetch(`${API_URL}${endpoint}`, {
  ...options,
  credentials: "include",
  headers: {
    ...(options.body instanceof FormData
      ? {}
      : { "Content-Type": "application/json" }),
    ...options.headers,
  },
});


if (!response.ok) {
const message = await response.text();
throw new Error(message || `Request failed: ${response.status}`);
}

return response.json() as Promise<T>;
}
