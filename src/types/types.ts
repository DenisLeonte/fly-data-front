export interface Flight {
  callsign: string;
  source_region: string;
  timestamp: string;
  icao24?: string;
  latitude?: number;
  longitude?: number;
}

export interface Aggregation {
  source_region: string;
  target_region: string | null;
  flight_count: number;
  time_window?: string; // Present in streaming data
  year?: string;        // Present in batch data
}

export interface SystemStatus {
  status: string;
  backend?: string;
  streaming_active: boolean;
  timestamp: string;
  files_available?: {
    batch_regions: boolean;
    batch_countries: boolean;
    streaming_data: boolean;
    insights: boolean;
  };
}

export interface Insights {
  timestamp: string;
  data_sources: string[];
  streaming_batches?: number;
  latest_flight_count?: number;
  historical_records?: number;
  region_pairs_analyzed?: number;
  total_flights_processed?: number;
}

export interface SystemStatus {
  status: string;
  streaming_active: boolean;
  timestamp: string;
  refresh_interval: number; // Add this to track the 90s delay
}