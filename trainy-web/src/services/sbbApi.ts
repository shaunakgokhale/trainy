import type {
  Journey,
  JourneySearchParams,
  JourneyStatus,
  JourneyStop,
  Station,
} from "../types/train";

const BASE_URL = "https://transport.opendata.ch/v1";

// =============================================================================
// Raw API Types (SBB* prefix)
// =============================================================================

type SBBLocationRaw = {
  id?: string;
  name?: string;
  score?: number | null;
  coordinate?: {
    type?: string;
    x?: number;
    y?: number;
  };
};

type SBBPrognosisRaw = {
  platform?: string | null;
  arrival?: string | null;
  departure?: string | null;
  capacity1st?: string | number | null;
  capacity2nd?: string | number | null;
};

type SBBStopRaw = {
  station?: SBBLocationRaw;
  arrival?: string | null;
  arrivalTimestamp?: number | null;
  departure?: string | null;
  departureTimestamp?: number | null;
  platform?: string | null;
  prognosis?: SBBPrognosisRaw;
};

type SBBJourneyRaw = {
  name?: string | null;
  category?: string | null;
  categoryCode?: string | null;
  number?: string | number | null;
  operator?: string | null;
  to?: string | null;
  passList?: SBBStopRaw[];
};

type SBBSectionRaw = {
  journey?: SBBJourneyRaw | null;
  walk?: unknown;
  departure?: SBBStopRaw;
  arrival?: SBBStopRaw;
};

type SBBConnectionRaw = {
  from: SBBStopRaw;
  to: SBBStopRaw;
  duration?: string;
  service?: {
    regular?: string | null;
    irregular?: string | null;
  };
  products?: string[];
  capacity1st?: string | number | null;
  capacity2nd?: string | number | null;
  sections?: SBBSectionRaw[];
};

type SBBLocationsResponse = {
  stations?: SBBLocationRaw[];
};

type SBBConnectionsResponse = {
  connections?: SBBConnectionRaw[];
};

type SBBStationboardEntryRaw = {
  name?: string | null;
  number?: string | number | null;
  stop?: SBBStopRaw;
};

type SBBStationboardResponse = {
  stationboard?: SBBStationboardEntryRaw[];
};

// =============================================================================
// Logging Helpers
// =============================================================================

const getTimestamp = () => new Date().toISOString();

const logRequest = (method: string, url: string, params?: Record<string, string>) => {
  console.log(`[SBB API][${getTimestamp()}] Request`, { method, url, params });
};

const logResponse = (status: number, data: unknown) => {
  const preview = JSON.stringify(data)?.slice(0, 500);
  console.log(`[SBB API][${getTimestamp()}] Response`, { status, preview });
};

// =============================================================================
// Helpers
// =============================================================================

const parseDurationMinutes = (duration?: string): number => {
  if (!duration) return 0;
  const match = duration.match(/(\d+)d(\d+):(\d+):(\d+)/);
  if (!match) return 0;
  const [, days, hours, minutes] = match.map(Number);
  return days * 24 * 60 + hours * 60 + minutes;
};

const toDelayMinutes = (scheduled?: string | null, prognosis?: string | null) => {
  if (!scheduled || !prognosis) return undefined;
  const scheduledTime = new Date(scheduled).getTime();
  const prognosisTime = new Date(prognosis).getTime();
  if (Number.isNaN(scheduledTime) || Number.isNaN(prognosisTime)) return undefined;
  return Math.round((prognosisTime - scheduledTime) / 60000);
};

const mapLocationToStation = (raw?: SBBLocationRaw): Station => ({
  code: raw?.id ?? "",
  name: raw?.name ?? "",
  country: "CH",
  lat: raw?.coordinate?.x,
  lng: raw?.coordinate?.y,
});

const mapStop = (raw: SBBStopRaw): JourneyStop => {
  const plannedPlatform = raw.platform ?? undefined;
  const actualPlatform = raw.prognosis?.platform ?? undefined;

  return {
    station: mapLocationToStation(raw.station),
    scheduledArrival: raw.arrival ?? undefined,
    scheduledDeparture: raw.departure ?? undefined,
    platform: actualPlatform ?? plannedPlatform,
    plannedPlatform,
    actualPlatform,
    arrivalDelay: toDelayMinutes(raw.arrival, raw.prognosis?.arrival ?? null),
    departureDelay: toDelayMinutes(raw.departure, raw.prognosis?.departure ?? null),
  };
};

const collectStops = (connection: SBBConnectionRaw): JourneyStop[] => {
  const sections = connection.sections ?? [];
  const passList =
    sections.find((section) => section.journey?.passList?.length)?.journey?.passList ??
    [];

  if (passList.length > 0) {
    const sectionStops = sections.flatMap((section) => {
      const stops: SBBStopRaw[] = [];
      if (section.departure) stops.push(section.departure);
      if (section.arrival) stops.push(section.arrival);
      return stops;
    });

    const mappedStops = passList.map(mapStop);

    return mappedStops.map((stop) => {
      if (stop.plannedPlatform || stop.actualPlatform || stop.platform) {
        return stop;
      }

      const match = sectionStops.find((sectionStop) => {
        const sameStation =
          sectionStop.station?.id &&
          sectionStop.station?.id === stop.station.code;
        const sameName =
          sectionStop.station?.name &&
          sectionStop.station?.name.toLowerCase() ===
            stop.station.name.toLowerCase();
        const sameTime =
          (sectionStop.arrival ?? sectionStop.departure) &&
          (sectionStop.arrival ?? sectionStop.departure) ===
            (stop.scheduledArrival ?? stop.scheduledDeparture);
        return (sameStation || sameName) && sameTime;
      });

      if (!match) return stop;

      const enriched = mapStop(match);
      return {
        ...stop,
        platform: enriched.platform ?? stop.platform,
        plannedPlatform: enriched.plannedPlatform ?? stop.plannedPlatform,
        actualPlatform: enriched.actualPlatform ?? stop.actualPlatform,
        arrivalDelay: enriched.arrivalDelay ?? stop.arrivalDelay,
        departureDelay: enriched.departureDelay ?? stop.departureDelay,
      };
    });
  }

  const stops: JourneyStop[] = [];
  const seen = new Set<string>();
  for (const section of sections) {
    if (section.departure) {
      const key = `${section.departure.station?.id ?? ""}-${section.departure.departure ?? ""}`;
      if (!seen.has(key)) {
        seen.add(key);
        stops.push(mapStop(section.departure));
      }
    }
    if (section.arrival) {
      const key = `${section.arrival.station?.id ?? ""}-${section.arrival.arrival ?? ""}`;
      if (!seen.has(key)) {
        seen.add(key);
        stops.push(mapStop(section.arrival));
      }
    }
  }

  if (stops.length === 0) {
    return [mapStop(connection.from), mapStop(connection.to)];
  }

  return stops;
};

const mapJourney = (connection: SBBConnectionRaw): Journey => {
  const sections = connection.sections ?? [];
  const firstJourney = sections.find((section) => section.journey)?.journey ?? null;
  const trainType =
    firstJourney?.category ??
    firstJourney?.categoryCode ??
    connection.products?.[0] ??
    "SBB";
  const trainNumber =
    firstJourney?.number?.toString() ??
    firstJourney?.name ??
    connection.products?.[0] ??
    "unknown";

  const stops = collectStops(connection);
  const departure = stops[0] ?? mapStop(connection.from);
  const arrival = stops[stops.length - 1] ?? mapStop(connection.to);
  const duration = parseDurationMinutes(connection.duration);

  const hasDelay = stops.some(
    (stop) => (stop.arrivalDelay ?? 0) > 0 || (stop.departureDelay ?? 0) > 0
  );
  const status: JourneyStatus = hasDelay ? "delayed" : "scheduled";

  return {
    id: `${trainType}${trainNumber}-${departure.scheduledDeparture ?? ""}`,
    trainNumber,
    trainType,
    operator: firstJourney?.operator ?? "SBB",
    departure,
    arrival,
    stops,
    duration,
    status,
    apiSource: "SBB",
    rawData: connection,
  };
};

const fetchJson = async <T>(
  url: string,
  params?: Record<string, string>
): Promise<{ data: T; status: number }> => {
  logRequest("GET", url, params);
  const response = await fetch(url);
  const data = (await response.json()) as T;
  logResponse(response.status, data);

  if (!response.ok) {
    throw new Error(`SBB API request failed with status ${response.status}.`);
  }

  return { data, status: response.status };
};

const formatDate = (dateTime: string) => new Date(dateTime).toISOString().slice(0, 10);
const formatTime = (dateTime: string) => new Date(dateTime).toISOString().slice(11, 16);

// =============================================================================
// API Functions
// =============================================================================

export const searchStations = async (query: string): Promise<Station[]> => {
  console.log(`[SBB API][${getTimestamp()}] Searching stations: "${query}"`);
  try {
    const url = new URL(`${BASE_URL}/locations`);
    url.searchParams.set("query", query);
    url.searchParams.set("type", "station");

    const { data } = await fetchJson<SBBLocationsResponse>(url.toString(), {
      query,
      type: "station",
    });

    const stations = data.stations ?? [];
    return stations.map(mapLocationToStation);
  } catch (error) {
    console.error(`[SBB API][${getTimestamp()}] searchStations error`, error);
    throw new Error("Failed to search stations from SBB.");
  }
};

export const searchJourneys = async (
  params: JourneySearchParams
): Promise<Journey[]> => {
  console.log(
    `[SBB API][${getTimestamp()}] Searching journeys: ${params.from} → ${params.to}`
  );
  try {
    const url = new URL(`${BASE_URL}/connections`);
    url.searchParams.set("from", params.from);
    url.searchParams.set("to", params.to);
    url.searchParams.set("date", formatDate(params.dateTime));
    url.searchParams.set("time", formatTime(params.dateTime));

    const { data } = await fetchJson<SBBConnectionsResponse>(url.toString(), {
      from: params.from,
      to: params.to,
      date: formatDate(params.dateTime),
      time: formatTime(params.dateTime),
    });

    const connections = data.connections ?? [];
    return connections.map(mapJourney);
  } catch (error) {
    console.error(`[SBB API][${getTimestamp()}] searchJourneys error`, error);
    throw new Error("Failed to search journeys from SBB.");
  }
};

export const searchStationboard = async (params: {
  station: string;
  dateTime: string;
  limit?: number;
  type?: "arrival" | "departure";
}): Promise<SBBStationboardEntryRaw[]> => {
  const url = new URL(`${BASE_URL}/stationboard`);
  url.searchParams.set("station", params.station);
  url.searchParams.set("limit", `${params.limit ?? 40}`);
  const isoDateTime = new Date(params.dateTime).toISOString();
  url.searchParams.set("datetime", isoDateTime);
  if (params.type) {
    url.searchParams.set("type", params.type);
  }
  const { data } = await fetchJson<SBBStationboardResponse>(url.toString(), {
    station: params.station,
    limit: `${params.limit ?? 40}`,
    datetime: isoDateTime,
    type: params.type,
  });
  const entries = data.stationboard ?? [];
  return entries;
};

export const getJourneyDetails = async (
  journeyId?: string
): Promise<Journey | null> => {
  console.log(
    `[SBB API][${getTimestamp()}] getJourneyDetails not supported for this API`,
    { journeyId }
  );
  return null;
};
