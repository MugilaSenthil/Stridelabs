/**
 * API Helper for Backend Integration
 * Supports both FastAPI backend and Lovable Cloud
 */

// FastAPI backend URL (for Python backend)
const FASTAPI_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Lovable Cloud URL (for edge functions)
const CLOUD_BASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

interface EmissionsQueryParams {
  year?: number;
  country?: string;
  continent?: string;
  gas_type?: string;
  limit?: number;
}

interface InsightsResponse {
  total_emissions: number;
  top_emitter: string;
  yoy_change: number;
  sector_breakdown: Record<string, number>;
  recommendations: string[];
}

interface ChatRequest {
  message: string;
  context?: Record<string, unknown>;
}

interface ChatResponse {
  response: string;
  sources?: string[];
}

/**
 * Generic fetch wrapper with error handling
 */
async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${FASTAPI_BASE_URL}${endpoint}`;
  
  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `API Error: ${response.status}`);
  }

  return response.json();
}

/**
 * API Methods
 */
export const api = {
  // Health check
  health: () => fetchApi<{ status: string; version: string }>('/health'),

  // Get emissions data with filters
  getEmissions: (params: EmissionsQueryParams = {}) => {
    const searchParams = new URLSearchParams();
    if (params.year) searchParams.set('year', params.year.toString());
    if (params.country) searchParams.set('country', params.country);
    if (params.continent) searchParams.set('continent', params.continent);
    if (params.gas_type) searchParams.set('gas_type', params.gas_type);
    if (params.limit) searchParams.set('limit', params.limit.toString());
    
    const query = searchParams.toString();
    return fetchApi<unknown[]>(`/data${query ? `?${query}` : ''}`);
  },

  // Get list of countries
  getCountries: () => fetchApi<string[]>('/countries'),

  // Get available years
  getYears: () => fetchApi<number[]>('/years'),

  // Get sectors
  getSectors: () => fetchApi<string[]>('/sectors'),

  // Get AI-generated insights
  getInsights: (year?: number) => {
    const query = year ? `?year=${year}` : '';
    return fetchApi<InsightsResponse>(`/insights${query}`);
  },

  // Chat with AI assistant
  chat: (request: ChatRequest) =>
    fetchApi<ChatResponse>('/query', {
      method: 'POST',
      body: JSON.stringify(request),
    }),
};

/**
 * React hook for API calls with loading/error states
 */
export function useApi<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = []
): ApiResponse<T> & { refetch: () => void } {
  const [state, setState] = useState<ApiResponse<T>>({
    data: null,
    error: null,
    loading: true,
  });

  const fetchData = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const data = await fetcher();
      setState({ data, error: null, loading: false });
    } catch (err) {
      setState({
        data: null,
        error: err instanceof Error ? err.message : 'Unknown error',
        loading: false,
      });
    }
  }, deps);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { ...state, refetch: fetchData };
}

// Import React hooks
import { useState, useEffect, useCallback } from 'react';

export default api;
