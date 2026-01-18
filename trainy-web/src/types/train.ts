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

// =============================================================================
// Stored Journey Types (Supabase persistence)
// =============================================================================

/**
 * A stop as stored in the database
 */
export type StoredJourneyStop = {
  id: string;
  journeyId: string;
  sequence: number;
  stationId: string;
  stationName: string;
  country: string;
  scheduledArrival?: string;
  scheduledDeparture?: string;
  arrivalDelayMin?: number;
  departureDelayMin?: number;
  plannedPlatform?: string;
  actualPlatform?: string;
  source: ApiSource;
  cancelled: boolean;
};

/**
 * A journey as stored in the database
 */
export type StoredJourney = {
  /** Database UUID */
  id: string;
  /** Unique key: {trainType}{trainNumber}_{originStationId}_{departureISO} */
  journeyKey: string;
  /** Train information */
  trainNumber: string;
  trainType: string;
  operator: string;
  /** Station information */
  originStationId: string;
  originStationName: string;
  destinationStationId: string;
  destinationStationName: string;
  /** Timing */
  scheduledDeparture: string;
  scheduledArrival?: string;
  durationMinutes: number;
  /** Status */
  status: JourneyStatus;
  /** Which APIs contributed data to this journey */
  sources: ApiSource[];
  /** Original API journey IDs for refresh */
  nsRawId?: string;
  dbRawId?: string;
  /** All stops on this journey */
  stops: StoredJourneyStop[];
  /** Timestamps */
  createdAt: string;
  updatedAt: string;
};

/**
 * Input for creating/updating a stored journey
 */
export type StoredJourneyInput = Omit<StoredJourney, "id" | "createdAt" | "updatedAt" | "stops"> & {
  stops: Omit<StoredJourneyStop, "id" | "journeyId">[];
};

/**
 * Generate a journey key for deduplication
 */
export function generateJourneyKey(
  trainType: string,
  trainNumber: string,
  originStationId: string,
  scheduledDeparture: string
): string {
  // Normalize the departure time to ISO format without milliseconds
  const depTime = new Date(scheduledDeparture).toISOString().slice(0, 19);
  return `${trainType}${trainNumber}_${originStationId}_${depTime}`;
}
