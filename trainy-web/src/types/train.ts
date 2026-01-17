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
  rawData?: any;
};

export type JourneySearchParams = {
  from: string;
  to: string;
  dateTime: string;
};
