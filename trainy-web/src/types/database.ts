// =============================================================================
// Supabase Database Types
// =============================================================================
// Generated types for the Trainy database schema

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      journeys: {
        Row: {
          id: string;
          journey_key: string;
          train_number: string;
          train_type: string;
          operator: string;
          origin_station_id: string;
          origin_station_name: string;
          destination_station_id: string;
          destination_station_name: string;
          scheduled_departure: string;
          scheduled_arrival: string | null;
          duration_minutes: number;
          status: string;
          sources: string[];
          ns_raw_id: string | null;
          db_raw_id: string | null;
          sbb_raw_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          journey_key: string;
          train_number: string;
          train_type: string;
          operator: string;
          origin_station_id: string;
          origin_station_name: string;
          destination_station_id: string;
          destination_station_name: string;
          scheduled_departure: string;
          scheduled_arrival?: string | null;
          duration_minutes: number;
          status?: string;
          sources: string[];
          ns_raw_id?: string | null;
          db_raw_id?: string | null;
          sbb_raw_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          journey_key?: string;
          train_number?: string;
          train_type?: string;
          operator?: string;
          origin_station_id?: string;
          origin_station_name?: string;
          destination_station_id?: string;
          destination_station_name?: string;
          scheduled_departure?: string;
          scheduled_arrival?: string | null;
          duration_minutes?: number;
          status?: string;
          sources?: string[];
          ns_raw_id?: string | null;
          db_raw_id?: string | null;
          sbb_raw_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      journey_stops: {
        Row: {
          id: string;
          journey_id: string;
          sequence: number;
          station_id: string;
          station_name: string;
          country: string;
          scheduled_arrival: string | null;
          scheduled_departure: string | null;
          arrival_delay_min: number | null;
          departure_delay_min: number | null;
          planned_platform: string | null;
          actual_platform: string | null;
          source: string;
          cancelled: boolean;
        };
        Insert: {
          id?: string;
          journey_id: string;
          sequence: number;
          station_id: string;
          station_name: string;
          country: string;
          scheduled_arrival?: string | null;
          scheduled_departure?: string | null;
          arrival_delay_min?: number | null;
          departure_delay_min?: number | null;
          planned_platform?: string | null;
          actual_platform?: string | null;
          source: string;
          cancelled?: boolean;
        };
        Update: {
          id?: string;
          journey_id?: string;
          sequence?: number;
          station_id?: string;
          station_name?: string;
          country?: string;
          scheduled_arrival?: string | null;
          scheduled_departure?: string | null;
          arrival_delay_min?: number | null;
          departure_delay_min?: number | null;
          planned_platform?: string | null;
          actual_platform?: string | null;
          source?: string;
          cancelled?: boolean;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

// Convenience types
export type JourneyRow = Database["public"]["Tables"]["journeys"]["Row"];
export type JourneyInsert = Database["public"]["Tables"]["journeys"]["Insert"];
export type JourneyUpdate = Database["public"]["Tables"]["journeys"]["Update"];

export type JourneyStopRow = Database["public"]["Tables"]["journey_stops"]["Row"];
export type JourneyStopInsert = Database["public"]["Tables"]["journey_stops"]["Insert"];
export type JourneyStopUpdate = Database["public"]["Tables"]["journey_stops"]["Update"];
