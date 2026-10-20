/**
 * Safe API Client for Speak Bloom
 * Handles JSON and non-JSON responses robustly, preventing:
 * "Unexpected token '<', <!DOCTYPE... is not valid JSON" errors.
 */

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export async function safeApiFetch<T = any>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(endpoint, {
      ...options,
      headers: {
        'Accept': 'application/json',
        ...(options?.headers || {}),
      },
    });

    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');

    // If server returned non-JSON (e.g. HTML 404/500 fallback or proxy error)
    if (!isJson) {
      const rawText = await res.text();
      let friendlyMessage = 'The server returned an unexpected response format.';

      if (rawText.trim().startsWith('<') || rawText.includes('<!DOCTYPE')) {
        if (res.status === 404) {
          friendlyMessage = `API endpoint ${endpoint} was not found on this server.`;
        } else if (res.status === 413) {
          friendlyMessage = 'Audio file or payload is too large. Please record a shorter clip.';
        } else if (res.status >= 500) {
          friendlyMessage = 'The server encountered an error while processing the request.';
        } else {
          friendlyMessage = `Server returned an HTML error page (Status ${res.status}).`;
        }
      } else if (rawText.trim().length > 0) {
        friendlyMessage = rawText.slice(0, 200);
      }

      console.warn(`[SafeApiFetch] Non-JSON response from ${endpoint}: Status ${res.status}`);
      return {
        success: false,
        error: {
          code: `HTTP_${res.status}`,
          message: friendlyMessage,
        },
      };
    }

    // Safely parse JSON
    let parsed: any;
    try {
      parsed = await res.json();
    } catch (parseErr: any) {
      return {
        success: false,
        error: {
          code: 'MALFORMED_JSON',
          message: 'Received an invalid JSON response from the server.',
        },
      };
    }

    // Check if the response follows { success, data, error } or standard object
    if (!res.ok) {
      const errorMessage =
        parsed?.error?.message ||
        parsed?.error ||
        parsed?.message ||
        `Request failed with status ${res.status}`;
      return {
        success: false,
        error: {
          code: parsed?.error?.code || `HTTP_${res.status}`,
          message: typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage),
          details: parsed,
        },
      };
    }

    // If backend returned { success: true, data: ... } or raw payload
    if (parsed && typeof parsed === 'object' && 'success' in parsed) {
      return parsed as ApiResponse<T>;
    }

    return {
      success: true,
      data: parsed as T,
    };
  } catch (netErr: any) {
    console.error(`[SafeApiFetch] Network or fetch error for ${endpoint}:`, netErr);
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: netErr?.message || 'Unable to connect to the server. Please check your network connection.',
      },
    };
  }
}
