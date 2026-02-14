export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = localStorage.getItem('token');

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  try {
    const response = await fetch(`${API_URL}/api${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      // Handle validation errors with details
      if (data.details && Array.isArray(data.details)) {
        const detailMessages = data.details
          .map((d: { field: string; message: string }) => `${d.field}: ${d.message}`)
          .join(', ');
        return { error: `${data.error || 'Validation failed'}: ${detailMessages}` };
      }
      return { error: data.error || 'An error occurred' };
    }

    return { data };
  } catch (error) {
    return { error: 'Network error. Please try again.' };
  }
}
