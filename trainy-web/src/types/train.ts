export type Station = {
  code: string;
  name: string;
  country: string;
  uicCode?: string;
  lat?: number;
  lng?: number;
};

export type JourneyStop = {
  station: Station;
  scheduledArrival?: string;
  scheduledDeparture?: string;
  platform?: string;
  plannedPlatform?: string;
  actualPlatform?: string;
  departureDelay?: number;
  arrivalDelay?: number;
  cancelled?: boolean;
};

export type JourneyStatus =
  | "scheduled"
  | "delayed"
  | "cancelled"
  | "departed"
  | "arrived";

export type ApiSource = "NS" | "DB" | "SNCF" | "merged";

export type Journey = {
  id: string;
  trainNumber: string;
  trainType: string;
  operator: string;
  departure: JourneyStop;
  arrival: JourneyStop;
  stops: JourneyStop[];
  duration: number;
  status: JourneyStatus;
  apiSource: ApiSource;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawData?: any; // Intentionally any - stores original API response for debugging
};

export type JourneySearchParams = {
  from: string;
  to: string;
  dateTime: string;
};

// =============================================================================
// International/Merged Journey Types (Merged* prefix per conventions)
// =============================================================================

export type MergedStation = Station & {
  /** Original station data from each API */
  nsStation?: Station;
  dbStation?: Station;
  /** Which country's API is authoritative for this station */
  authoritative: "NS" | "DB" | "SNCF";
};

export type MergedJourneyStop = JourneyStop & {
  /** Which API provided this stop data */
  source: ApiSource;
};

export type MergedJourney = Journey & {
  /** Source journeys from each API that were merged */
  nsJourney?: Journey;
  dbJourney?: Journey;
  /** Unique key for deduplication (trainNumber + departure time) */
  deduplicationKey: string;
  /** Number of transfers/changes */
  transfers: number;
  /** Legs for multi-leg journeys */
  legs: MergedJourneyLeg[];
};

export type MergedJourneyLeg = {
  trainNumber: string;
  trainType: string;
  operator: string;
  departure: MergedJourneyStop;
  arrival: MergedJourneyStop;
  stops: MergedJourneyStop[];
  duration: number;
  source: ApiSource;
};

export type InternationalSearchParams = {
  fromStation: MergedStation | null;
  toStation: MergedStation | null;
  dateTime: string;
};
