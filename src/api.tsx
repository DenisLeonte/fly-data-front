import axios from 'axios';
import type { Flight, Aggregation, SystemStatus, Insights } from '../src/types/types';

const BASE_URL = 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: BASE_URL,
}); 

export const api = {
  getStatus: () => apiClient.get<SystemStatus>('/api/status'),
  
  getRealtime: () => apiClient.get<{ data: Flight[] }>('/api/realtime'),
  
  getStreaming: () => apiClient.get<{ data: Aggregation[] }>('/api/streaming'),
  
  getBatchRegions: (limit: number = 10) => 
    apiClient.get<{ data: Aggregation[] }>(`/api/batch/regions?limit=${limit}`),
    
  getInsights: () => apiClient.get<Insights>('/api/insights'),
  
  startStreaming: () => apiClient.post('/api/streaming/start'),
  
  stopStreaming: () => apiClient.post('/api/streaming/stop'),
  
  exportCSV: () => window.open(`${BASE_URL}/api/export/batch/csv`, '_blank'),
};