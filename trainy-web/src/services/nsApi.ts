import type {
  Journey,
  JourneySearchParams,
  JourneyStatus,
  JourneyStop,
  Station,
} from "../types/train";

const BASE_URL = "https://gateway.apiportal.ns.nl/reisinformatie-api/api";

type NSStationsResponse = NSStationRaw[] | { payload?: NSStationRaw[] };

type NSStationRaw = {
  code?: string;
  stationCode?: string;
  UICCode?: string;
  uicCode?: string;
  name?: string;
  land?: string;
  country?: string;
  countryCode?: string;
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
  coordinates?: {
    lat?: number;
    lng?: number;
  };
  namen?: {
    lang?: string;
    langName?: string;
    long?: string;
    middel?: string;
    kort?: string;
  };
};

type NSTripResponse = {
  trips?: NSTripRaw[];
  payload?: {
    trips?: NSTripRaw[];
  };
};

type NSTripRaw = {
  uid?: string;
  id?: string;
  plannedDurationInMinutes?: number;
  durationInMinutes?: number;
  durationInSeconds?: number;
  status?: string;
  cancelled?: boolean;
  origin?: NSStopRaw;
  destination?: NSStopRaw;
  stops?: NSStopRaw[];
  legs?: NSLegRaw[];
  trainNumber?: string;
  operator?: string;
};

type NSJourneyResponse = {
  journey?: NSTripRaw;
  payload?: {
    journey?: NSTripRaw;
  };
};

type NSLegRaw = {
  origin?: NSStopRaw;
  destination?: NSStopRaw;
  stops?: NSStopRaw[];
  product?: NSProductRaw;
};

type NSProductRaw = {
  number?: string | number;
  shortCategoryName?: string;
  longCategoryName?: string;
  categoryCode?: string;
  operator?: string;
  displayName?: string;
};

type NSStopRaw = {
  station?: NSStationRaw;
  stationCode?: string;
  name?: string;
  plannedDateTime?: string;
  actualDateTime?: string;
  plannedArrivalDateTime?: string;
  actualArrivalDateTime?: string;
  plannedDepartureDateTime?: string;
  actualDepartureDateTime?: string;
  plannedTrack?: string;
  actualTrack?: string;
  track?: string;
  departureDelayInSeconds?: number;
  arrivalDelayInSeconds?: number;
  departureDelay?: number;
  arrivalDelay?: number;
  cancelled?: boolean;
  isCancelled?: boolean;
};

const getTimestamp = () => new Date().toISOString();

const logRequest = (method: string, url: string, params?: Record<string, string>) => {
  console.log(`[NS API][${getTimestamp()}] Request`, { method, url, params });
};

const logResponse = (status: number, data: unknown) => {
  const preview = JSON.stringify(data)?.slice(0, 500);
  console.log(`[NS API][${getTimestamp()}] Response`, { status, preview });
};

const toMinutes = (seconds?: number | null) => {
  if (seconds === null || seconds === undefined) {
    return undefined;
  }
  return Math.round(seconds / 60);
};

const mapStation = (raw: NSStationRaw): Station => {
  const code = raw.code ?? raw.stationCode ?? raw.UICCode ?? "";
  const name =
    raw.name ??
    raw.namen?.lang ??
    raw.namen?.langName ??
    raw.namen?.long ??
    raw.namen?.middel ??
    raw.namen?.kort ??
    "";
  const country = raw.land ?? raw.country ?? raw.countryCode ?? "";

  return {
    code,
    name,
    country,
    uicCode: raw.UICCode ?? raw.uicCode,
    lat: raw.lat ?? raw.latitude ?? raw.coordinates?.lat,
    lng: raw.lng ?? raw.longitude ?? raw.coordinates?.lng,
  };
};

const mapStop = (raw: NSStopRaw): JourneyStop => {
  const stationSource = raw.station ?? raw;

  return {
    station: mapStation(stationSource),
    scheduledArrival: raw.plannedArrivalDateTime ?? raw.plannedDateTime,
    scheduledDeparture: raw.plannedDepartureDateTime ?? raw.plannedDateTime,
    platform: raw.plannedTrack ?? raw.actualTrack ?? raw.track,
    plannedPlatform: raw.plannedTrack,
    actualPlatform: raw.actualTrack,
    departureDelay: toMinutes(raw.departureDelayInSeconds ?? raw.departureDelay),
    arrivalDelay: toMinutes(raw.arrivalDelayInSeconds ?? raw.arrivalDelay),
    cancelled: raw.cancelled ?? raw.isCancelled,
  };
};

const mapStatus = (status?: string, cancelled?: boolean): JourneyStatus => {
  if (cancelled) {
    return "cancelled";
  }

  switch (status?.toLowerCase()) {
    case "delayed":
      return "delayed";
    case "cancelled":
      return "cancelled";
    case "departed":
      return "departed";
    case "arrived":
      return "arrived";
    default:
      return "scheduled";
  }
};

const mapTrip = (trip: NSTripRaw): Journey => {
  const legs = trip.legs ?? [];
  const firstLeg = legs[0];
  const lastLeg = legs[legs.length - 1];
  const product = firstLeg?.product;
  const origin = trip.origin ?? firstLeg?.origin;
  const destination = trip.destination ?? lastLeg?.destination;
  const rawStops =
    trip.stops ?? legs.flatMap((leg) => leg.stops ?? []).filter(Boolean);

  const stops = rawStops.length
    ? rawStops.map(mapStop)
    : [origin, destination].filter((s): s is NSStopRaw => Boolean(s)).map(mapStop);

  return {
    id: trip.uid ?? trip.id ?? "",
    trainNumber: product?.number?.toString() ?? trip.trainNumber ?? product?.displayName ?? "",
    trainType:
      product?.shortCategoryName ??
      product?.categoryCode ??
      product?.longCategoryName ??
      "",
    operator: product?.operator ?? trip.operator ?? "NS",
    departure: origin ? mapStop(origin) : mapStop({}),
    arrival: destination ? mapStop(destination) : mapStop({}),
    stops,
    duration:
      trip.plannedDurationInMinutes ??
      trip.durationInMinutes ??
      toMinutes(trip.durationInSeconds) ??
      0,
    status: mapStatus(trip.status, trip.cancelled),
    apiSource: "NS",
    rawData: trip,
  };
};

const createHeaders = (): Headers => {
  const apiKey = import.meta.env.VITE_NS_API_KEY;

  if (!apiKey) {
    throw new Error("Missing VITE_NS_API_KEY for NS API requests.");
  }

  const headers = new Headers();
  headers.set("Ocp-Apim-Subscription-Key", apiKey);
  headers.set("Accept", "application/json");

  return headers;
};

const fetchJson = async <T>(
  url: string,
  params?: Record<string, string>
): Promise<{ data: T; status: number }> => {
  logRequest("GET", url, params);
  const response = await fetch(url, { headers: createHeaders() });
  const data = (await response.json()) as T;
  logResponse(response.status, data);

  if (!response.ok) {
    throw new Error(`NS API request failed with status ${response.status}.`);
  }

  return { data, status: response.status };
};

export const searchStations = async (query: string): Promise<Station[]> => {
  try {
    const url = new URL(`${BASE_URL}/v2/stations`);
    if (query) {
      url.searchParams.set("q", query);
    }
    const { data } = await fetchJson<NSStationsResponse>(url.toString(), {
      q: query,
    });

    const rawStations = Array.isArray(data)
      ? data
      : data.payload ?? [];

    return rawStations.map(mapStation);
  } catch (error) {
    console.error(
      `[NS API][${getTimestamp()}] searchStations error`,
      error
    );
    throw new Error("Failed to search stations from NS.");
  }
};

export const searchJourneys = async (
  params: JourneySearchParams
): Promise<Journey[]> => {
  try {
    const url = new URL(`${BASE_URL}/v3/trips`);
    url.searchParams.set("fromStation", params.from);
    url.searchParams.set("toStation", params.to);
    url.searchParams.set("dateTime", params.dateTime);
    const { data } = await fetchJson<NSTripResponse>(url.toString(), {
      fromStation: params.from,
      toStation: params.to,
      dateTime: params.dateTime,
    });
    const rawTrips = data.trips ?? data.payload?.trips ?? [];

    return rawTrips.map(mapTrip);
  } catch (error) {
    console.error(
      `[NS API][${getTimestamp()}] searchJourneys error`,
      error
    );
    throw new Error("Failed to search journeys from NS.");
  }
};

export const getJourneyDetails = async (
  trainNumber: string,
  dateTime: string
): Promise<Journey | null> => {
  try {
    const url = new URL(`${BASE_URL}/v2/journey`);
    url.searchParams.set("train", trainNumber);
    url.searchParams.set("dateTime", dateTime);
    const { data } = await fetchJson<NSJourneyResponse>(url.toString(), {
      train: trainNumber,
      dateTime,
    });
    const journey = data.journey ?? data.payload?.journey;

    if (!journey) {
      return null;
    }

    return mapTrip(journey);
  } catch (error) {
    console.error(
      `[NS API][${getTimestamp()}] getJourneyDetails error`,
      error
    );
    throw new Error("Failed to fetch journey details from NS.");
  }
};

export { createHeaders };
