import type {
  Journey,
  JourneySearchParams,
  JourneyStatus,
  JourneyStop,
  Station,
} from "../types/train";

// =============================================================================
// DB API Service - Uses both Timetables and RIS::Journeys APIs
// =============================================================================
//
// TIMETABLES API (station-centric):
//   - searchStations: /station/{pattern}
//   - getDepartures: /plan/{evaNo}/{date}/{hour}
//   - getChanges: /fchg/{evaNo}, /rchg/{evaNo}
//   Docs: https://developers.deutschebahn.com/db-api-marketplace/apis/product/timetables
//
// RIS::JOURNEYS API (journey-centric):
//   - findJourneys: /find (by train number)
//   - getJourneyDetails: /{journeyID}
//   Docs: https://developers.deutschebahn.com/db-api-marketplace/apis/product/ris-journeys-transporteure
// =============================================================================

// API Base URLs - Use Vite proxy to avoid CORS issues
// Proxy configured in vite.config.ts routes these to the actual DB APIs
const TIMETABLES_BASE_URL = "/api/db/timetables";
const JOURNEYS_BASE_URL = "/api/db/journeys";

// Auth credentials from env (used by Vite proxy, not directly in fetch)
// These are read by vite.config.ts for proxy header injection
const _DB_CLIENT_ID = import.meta.env.VITE_DB_CLIENT_ID;
const _DB_API_KEY = import.meta.env.VITE_DB_API_KEY;
void _DB_CLIENT_ID;
void _DB_API_KEY;

// =============================================================================
// Raw API response types (DB* prefix per project conventions)
// =============================================================================

// --- Timetables API types ---

// Station from /station/{pattern} endpoint (XML parsed to object)
type DBTimetableStationRaw = {
  name?: string;
  eva?: string;
  ds100?: string; // German station code like "FF" for Frankfurt
  db?: string;
  creationts?: string;
  p?: string; // platforms
  meta?: string; // connected stations
};

// Timetable stop from /plan endpoint
type DBTimetableStopRaw = {
  id?: string;
  tl?: {
    f?: string; // filter flag
    t?: string; // train type (ICE, IC, RE, etc.)
    o?: string; // operator
    c?: string; // category
    n?: string; // train number
  };
  ar?: {
    // arrival
    pt?: string; // planned time (YYMMDDHHMM format)
    ct?: string; // changed/actual time
    pp?: string; // planned platform
    cp?: string; // changed platform
    cs?: string; // status (c=cancelled)
    l?: string; // line
    ppth?: string; // planned path - pipe-separated station names (origin is first)
  };
  dp?: {
    // departure
    pt?: string; // planned time
    ct?: string; // changed/actual time
    pp?: string; // planned platform
    cp?: string; // changed platform
    cs?: string; // status
    l?: string; // line
    ppth?: string; // planned path - pipe-separated station names (destination is last)
  };
};

type DBTimetablePlanResponse = {
  station?: string;
  eva?: string;
  s?: DBTimetableStopRaw[];
};

// --- RIS::Journeys API types ---

type DBStopPlaceRaw = {
  evaNumber?: string;
  name?: string;
  position?: {
    latitude?: number;
    longitude?: number;
  };
};

type DBEventRaw = {
  station?: DBStopPlaceRaw;
  timeSchedule?: string;
  timePredicted?: string;
  platformSchedule?: string;
  platformPredicted?: string;
  cancelled?: boolean;
};

type DBJourneyRaw = {
  journeyID?: string;
  train?: {
    journeyNumber?: string;
    type?: string;
    category?: string;
    operator?: {
      name?: string;
    };
  };
  departure?: DBEventRaw;
  arrival?: DBEventRaw;
  events?: DBEventRaw[];
  cancelled?: boolean;
};

type DBJourneysResponse = {
  journeys?: DBJourneyRaw[];
};

type DBJourneyDetailsResponse = DBJourneyRaw;

// =============================================================================
// Helper functions
// =============================================================================

const getTimestamp = () => new Date().toISOString();

// Headers for fetch - auth is handled by Vite proxy in vite.config.ts
const createHeaders = (acceptXml = false): HeadersInit => {
  // Note: DB-Client-Id and DB-Api-Key are added by the Vite proxy
  // This avoids CORS preflight issues with custom headers
  return {
    Accept: acceptXml ? "application/xml" : "application/json",
  };
};

const logRequest = (api: string, method: string, url: string, params?: Record<string, string>) => {
  console.log(`[DB ${api}][${getTimestamp()}] Request`, { method, url, params });
};

const logResponse = (api: string, status: number, data: unknown) => {
  const preview = typeof data === "string" ? data.slice(0, 500) : JSON.stringify(data)?.slice(0, 500);
  console.log(`[DB ${api}][${getTimestamp()}] Response`, { status, preview });
};

// Parse DB Timetables time format (YYMMDDHHMM) to ISO string
const parseTimetableTime = (timeStr?: string): string | undefined => {
  if (!timeStr || timeStr.length !== 10) return undefined;
  const yy = timeStr.slice(0, 2);
  const mm = timeStr.slice(2, 4);
  const dd = timeStr.slice(4, 6);
  const hh = timeStr.slice(6, 8);
  const min = timeStr.slice(8, 10);
  const year = parseInt(yy) > 50 ? `19${yy}` : `20${yy}`;
  return `${year}-${mm}-${dd}T${hh}:${min}:00`;
};

// Build local date + hour strings for DB Timetables (uses local time)
const formatTimetableDateHour = (dateInput: string | Date): { dateStr: string; hourStr: string } => {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const yy = `${date.getFullYear()}`.slice(2);
  const mm = `${date.getMonth() + 1}`.padStart(2, "0");
  const dd = `${date.getDate()}`.padStart(2, "0");
  const hour = `${date.getHours()}`.padStart(2, "0");
  return { dateStr: `${yy}${mm}${dd}`, hourStr: hour };
};

// Calculate delay in minutes between two time strings
const calculateDelayMinutes = (scheduled?: string, actual?: string): number | undefined => {
  if (!scheduled || !actual) return undefined;
  const scheduledTime = new Date(scheduled).getTime();
  const actualTime = new Date(actual).getTime();
  const diffMs = actualTime - scheduledTime;
  if (diffMs <= 0) return undefined;
  return Math.round(diffMs / 60000);
};

// Simple XML to object parser for Timetables API responses
// Note: This is a basic parser for the specific DB Timetables XML structure
const parseXmlToObject = (xmlString: string): Record<string, unknown> => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, "text/xml");

  const parseElement = (element: Element): Record<string, unknown> | string => {
    const obj: Record<string, unknown> = {};

    // Get attributes
    for (const attr of element.attributes) {
      obj[attr.name] = attr.value;
    }

    // Get child elements
    const children = element.children;
    if (children.length === 0) {
      // Leaf node - return text content or attributes
      const text = element.textContent?.trim();
      if (Object.keys(obj).length === 0 && text) {
        return text;
      }
      if (text) {
        obj._text = text;
      }
    } else {
      for (const child of children) {
        const childName = child.tagName;
        const childValue = parseElement(child);

        if (obj[childName]) {
          // Already exists - convert to array
          if (!Array.isArray(obj[childName])) {
            obj[childName] = [obj[childName]];
          }
          (obj[childName] as unknown[]).push(childValue);
        } else {
          obj[childName] = childValue;
        }
      }
    }

    return obj;
  };

  const root = doc.documentElement;
  return { [root.tagName]: parseElement(root) };
};

// =============================================================================
// Mapping functions
// =============================================================================

// Map Timetables station to our Station type
const mapTimetableStation = (raw: DBTimetableStationRaw): Station => {
  return {
    code: raw.ds100 ?? raw.eva ?? "",
    name: raw.name ?? "",
    country: "DE",
    uicCode: raw.eva,
  };
};

// Map Timetables stop to JourneyStop
const mapTimetableStop = (
  raw: DBTimetableStopRaw,
  stationName: string,
  stationEva: string
): JourneyStop => {
  const scheduledArrival = parseTimetableTime(raw.ar?.pt);
  const actualArrival = parseTimetableTime(raw.ar?.ct);
  const scheduledDeparture = parseTimetableTime(raw.dp?.pt);
  const actualDeparture = parseTimetableTime(raw.dp?.ct);

  return {
    station: {
      code: stationEva,
      name: stationName,
      country: "DE",
      uicCode: stationEva,
    },
    scheduledArrival,
    scheduledDeparture,
    platform: raw.dp?.cp ?? raw.dp?.pp ?? raw.ar?.cp ?? raw.ar?.pp,
    plannedPlatform: raw.dp?.pp ?? raw.ar?.pp,
    actualPlatform: raw.dp?.cp ?? raw.ar?.cp,
    departureDelay: calculateDelayMinutes(scheduledDeparture, actualDeparture),
    arrivalDelay: calculateDelayMinutes(scheduledArrival, actualArrival),
    cancelled: raw.dp?.cs === "c" || raw.ar?.cs === "c",
  };
};

// Extract destination station name from ppth (planned path) field
// ppth contains pipe-separated station names, last one is the final destination
const extractDestinationFromPath = (ppth?: string): string | undefined => {
  if (!ppth) return undefined;
  const stations = ppth.split("|");
  return stations.length > 0 ? stations[stations.length - 1].trim() : undefined;
};

// Extract origin station name from ppth (for arrivals, first station is origin)
// Note: Currently unused but may be needed for future enhancements
export const extractOriginFromPath = (ppth?: string): string | undefined => {
  if (!ppth) return undefined;
  const stations = ppth.split("|");
  return stations.length > 0 ? stations[0].trim() : undefined;
};

// Parse ppth to extract all station names as JourneyStops
// ar.ppth = stations BEFORE current (train came from these)
// dp.ppth = stations AFTER current (train goes to these)
const parsePathToStops = (ppth?: string): JourneyStop[] => {
  if (!ppth) return [];
  return ppth.split("|").map((name) => ({
    station: {
      code: "",
      name: name.trim(),
      country: "DE",
    },
  }));
};

// Build full route from Timetables ppth fields
// Combines: ar.ppth (origin → current) + current station + dp.ppth (current → destination)
const buildFullRouteFromPpth = (
  raw: DBTimetableStopRaw,
  currentStationName: string,
  currentStationEva: string,
  scheduledDeparture?: string
): JourneyStop[] => {
  const stops: JourneyStop[] = [];

  // 1. Stations before current (from ar.ppth - these are in order from origin)
  if (raw.ar?.ppth) {
    const beforeStops = parsePathToStops(raw.ar.ppth);
    stops.push(...beforeStops);
  }

  // 2. Current station (where we're departing from)
  stops.push({
    station: {
      code: currentStationEva,
      name: currentStationName,
      country: "DE",
      uicCode: currentStationEva,
    },
    scheduledDeparture,
    platform: raw.dp?.cp ?? raw.dp?.pp,
    plannedPlatform: raw.dp?.pp,
    actualPlatform: raw.dp?.cp,
  });

  // 3. Stations after current (from dp.ppth - these are in order to destination)
  if (raw.dp?.ppth) {
    const afterStops = parsePathToStops(raw.dp.ppth);
    stops.push(...afterStops);
  }

  return stops;
};

// Map Timetables stop to a Journey (for departure board)
const mapTimetableStopToJourney = (
  raw: DBTimetableStopRaw,
  stationName: string,
  stationEva: string
): Journey => {
  const stop = mapTimetableStop(raw, stationName, stationEva);
  const trainType = raw.tl?.c ?? raw.tl?.t ?? "";
  const trainNumber = raw.tl?.n ?? "";
  const isCancelled = raw.dp?.cs === "c" || raw.ar?.cs === "c";

  // For departures: extract destination from dp.ppth (last station in path)
  // For arrivals: extract origin from ar.ppth (first station in path)
  const destinationName = raw.dp?.ppth ? extractDestinationFromPath(raw.dp.ppth) : undefined;

  // Build full route from ppth fields
  const scheduledDeparture = parseTimetableTime(raw.dp?.pt);
  const allStops = buildFullRouteFromPpth(raw, stationName, stationEva, scheduledDeparture);

  // Create departure stop (current station)
  const departureStop: JourneyStop = {
    ...stop,
    station: {
      code: stationEva,
      name: stationName,
      country: "DE",
      uicCode: stationEva,
    },
  };

  // Create arrival stop (destination station from path, or same as departure if no path)
  const arrivalStop: JourneyStop = allStops.length > 0 ? allStops[allStops.length - 1] : {
    station: {
      code: "", // EVA not available from path
      name: destinationName ?? stationName,
      country: "DE",
    },
    scheduledArrival: undefined,
    scheduledDeparture: undefined,
  };

  let status: JourneyStatus = "scheduled";
  if (isCancelled) {
    status = "cancelled";
  } else if (stop.departureDelay || stop.arrivalDelay) {
    status = "delayed";
  }

  return {
    id: raw.id ?? `${trainType}${trainNumber}`,
    trainNumber: trainNumber,
    trainType: trainType,
    operator: raw.tl?.o ?? "DB",
    departure: departureStop,
    arrival: arrivalStop,
    stops: allStops, // Full route from ppth
    duration: 0, // Exact arrival time not available from station board
    status,
    apiSource: "DB",
    rawData: raw,
  };
};

// Map RIS::Journeys station to our Station type
const mapJourneyStation = (raw?: DBStopPlaceRaw): Station => {
  return {
    code: raw?.evaNumber ?? "",
    name: raw?.name ?? "",
    country: "DE",
    uicCode: raw?.evaNumber,
    lat: raw?.position?.latitude,
    lng: raw?.position?.longitude,
  };
};

// Map RIS::Journeys event to JourneyStop
const mapJourneyStop = (event?: DBEventRaw): JourneyStop => {
  return {
    station: mapJourneyStation(event?.station),
    scheduledArrival: event?.timeSchedule,
    scheduledDeparture: event?.timeSchedule,
    platform: event?.platformPredicted ?? event?.platformSchedule,
    plannedPlatform: event?.platformSchedule,
    actualPlatform: event?.platformPredicted,
    departureDelay: calculateDelayMinutes(event?.timeSchedule, event?.timePredicted),
    arrivalDelay: calculateDelayMinutes(event?.timeSchedule, event?.timePredicted),
    cancelled: event?.cancelled,
  };
};

// Map RIS::Journeys status
const mapJourneyStatus = (journey: DBJourneyRaw): JourneyStatus => {
  if (journey.cancelled) return "cancelled";

  const events = journey.events ?? [];
  const hasDelay = events.some((event) => {
    const delay = calculateDelayMinutes(event.timeSchedule, event.timePredicted);
    return delay !== undefined && delay > 0;
  });

  return hasDelay ? "delayed" : "scheduled";
};

// Calculate duration from RIS::Journeys events
const calculateJourneyDuration = (departure?: DBEventRaw, arrival?: DBEventRaw): number => {
  if (!departure?.timeSchedule || !arrival?.timeSchedule) return 0;
  const depTime = new Date(departure.timeSchedule).getTime();
  const arrTime = new Date(arrival.timeSchedule).getTime();
  return Math.round((arrTime - depTime) / 60000);
};

// Map RIS::Journeys response to Journey
const mapJourney = (journey: DBJourneyRaw): Journey => {
  const events = journey.events ?? [];
  const stops = events.map(mapJourneyStop);

  return {
    id: journey.journeyID ?? "",
    trainNumber: journey.train?.journeyNumber ?? "",
    trainType: journey.train?.type ?? journey.train?.category ?? "",
    operator: journey.train?.operator?.name ?? "DB",
    departure: mapJourneyStop(journey.departure),
    arrival: mapJourneyStop(journey.arrival),
    stops,
    duration: calculateJourneyDuration(journey.departure, journey.arrival),
    status: mapJourneyStatus(journey),
    apiSource: "DB",
    rawData: journey,
  };
};

// =============================================================================
// Fetch helpers
// =============================================================================

// Fetch JSON from RIS::Journeys API
const fetchJson = async <T>(
  url: string,
  params?: Record<string, string>
): Promise<{ data: T; status: number }> => {
  logRequest("Journeys", "GET", url, params);

  const response = await fetch(url, {
    method: "GET",
    headers: createHeaders(false),
  });

  const data = (await response.json()) as T;
  logResponse("Journeys", response.status, data);

  if (!response.ok) {
    throw new Error(`DB Journeys API request failed with status ${response.status}.`);
  }

  return { data, status: response.status };
};

// Fetch XML from Timetables API and parse to object
const fetchXml = async <T>(
  url: string,
  params?: Record<string, string>
): Promise<{ data: T; status: number }> => {
  logRequest("Timetables", "GET", url, params);

  const response = await fetch(url, {
    method: "GET",
    headers: createHeaders(true),
  });

  const xmlText = await response.text();
  logResponse("Timetables", response.status, xmlText);

  if (!response.ok) {
    throw new Error(`DB Timetables API request failed with status ${response.status}.`);
  }

  const data = parseXmlToObject(xmlText) as T;
  return { data, status: response.status };
};

// =============================================================================
// TIMETABLES API Functions (Station-centric)
// =============================================================================

/**
 * Search for stations by name pattern
 * Uses: Timetables API GET /station/{pattern}
 * @param query - Station name pattern to search for
 */
export const searchStations = async (query: string): Promise<Station[]> => {
  try {
    const url = `${TIMETABLES_BASE_URL}/station/${encodeURIComponent(query)}`;
    const { data } = await fetchXml<{ stations?: { station?: DBTimetableStationRaw | DBTimetableStationRaw[] } }>(
      url,
      { pattern: query }
    );

    // Handle single station or array of stations
    const stationsRaw = data.stations?.station;
    if (!stationsRaw) return [];

    const stationsArray = Array.isArray(stationsRaw) ? stationsRaw : [stationsRaw];
    return stationsArray.map(mapTimetableStation);
  } catch (error) {
    console.error(`[DB Timetables][${getTimestamp()}] searchStations error`, error);
    throw new Error("Failed to search stations from DB Timetables API.");
  }
};

/**
 * Get departures at a station for a specific hour
 * Uses: Timetables API GET /plan/{evaNo}/{date}/{hour}
 * @param evaNumber - Station EVA number (e.g., "8000105" for Frankfurt Hbf)
 * @param dateTime - ISO datetime string (uses date and hour portion)
 */
export const getDepartures = async (evaNumber: string, dateTime: string): Promise<Journey[]> => {
  try {
    const { dateStr, hourStr } = formatTimetableDateHour(dateTime);

    const url = `${TIMETABLES_BASE_URL}/plan/${encodeURIComponent(evaNumber)}/${dateStr}/${hourStr}`;
    const { data } = await fetchXml<{ timetable?: DBTimetablePlanResponse }>(url, {
      evaNo: evaNumber,
      date: dateStr,
      hour: hourStr,
    });

    const stationName = data.timetable?.station ?? "";
    const stationEva = data.timetable?.eva ?? evaNumber;
    const stops = data.timetable?.s;

    if (!stops) {
      return [];
    }

    const stopsArray = Array.isArray(stops) ? stops : [stops];
    return stopsArray.map((stop) => mapTimetableStopToJourney(stop, stationName, stationEva));
  } catch (error) {
    console.error(`[DB Timetables][${getTimestamp()}] getDepartures error`, error);
    throw new Error("Failed to get departures from DB Timetables API.");
  }
};

/**
 * Get full real-time changes at a station
 * Uses: Timetables API GET /fchg/{evaNo}
 * @param evaNumber - Station EVA number
 */
export const getFullChanges = async (evaNumber: string): Promise<Journey[]> => {
  try {
    const url = `${TIMETABLES_BASE_URL}/fchg/${encodeURIComponent(evaNumber)}`;
    const { data } = await fetchXml<{ timetable?: DBTimetablePlanResponse }>(url, {
      evaNo: evaNumber,
    });

    const stationName = data.timetable?.station ?? "";
    const stationEva = data.timetable?.eva ?? evaNumber;
    const stops = data.timetable?.s;

    if (!stops) return [];

    const stopsArray = Array.isArray(stops) ? stops : [stops];
    return stopsArray.map((stop) => mapTimetableStopToJourney(stop, stationName, stationEva));
  } catch (error) {
    console.error(`[DB Timetables][${getTimestamp()}] getFullChanges error`, error);
    throw new Error("Failed to get changes from DB Timetables API.");
  }
};

/**
 * Get recent real-time changes at a station
 * Uses: Timetables API GET /rchg/{evaNo}
 * @param evaNumber - Station EVA number
 */
export const getRecentChanges = async (evaNumber: string): Promise<Journey[]> => {
  try {
    const url = `${TIMETABLES_BASE_URL}/rchg/${encodeURIComponent(evaNumber)}`;
    const { data } = await fetchXml<{ timetable?: DBTimetablePlanResponse }>(url, {
      evaNo: evaNumber,
    });

    const stationName = data.timetable?.station ?? "";
    const stationEva = data.timetable?.eva ?? evaNumber;
    const stops = data.timetable?.s;

    if (!stops) return [];

    const stopsArray = Array.isArray(stops) ? stops : [stops];
    return stopsArray.map((stop) => mapTimetableStopToJourney(stop, stationName, stationEva));
  } catch (error) {
    console.error(`[DB Timetables][${getTimestamp()}] getRecentChanges error`, error);
    throw new Error("Failed to get recent changes from DB Timetables API.");
  }
};

// =============================================================================
// RIS::JOURNEYS API Functions (Journey-centric)
// =============================================================================

/**
 * Search for journeys by train number
 * Uses: RIS::Journeys API GET /find
 * @param trainNumber - The train number to search for (e.g., "123" for ICE 123)
 * @param dateTime - ISO datetime string for the search date
 * @param transportTypes - Optional array of transport types
 */
export const findJourneys = async (
  trainNumber: string,
  dateTime: string,
  transportTypes?: string[]
): Promise<Journey[]> => {
  try {
    const params = new URLSearchParams();
    params.set("journeyNumber", trainNumber);
    params.set("date", dateTime.split("T")[0]);

    if (transportTypes && transportTypes.length > 0) {
      params.set("transportTypes", transportTypes.join(","));
    }

    const url = `${JOURNEYS_BASE_URL}/find?${params.toString()}`;

    const { data } = await fetchJson<DBJourneysResponse>(url, {
      journeyNumber: trainNumber,
      date: dateTime,
    });

    const journeys = data.journeys ?? [];
    return journeys.map(mapJourney);
  } catch (error) {
    console.error(`[DB Journeys][${getTimestamp()}] findJourneys error`, error);
    throw new Error("Failed to find journeys from DB Journeys API.");
  }
};

/**
 * Get detailed journey information including all stops
 * Uses: RIS::Journeys API GET /{journeyID}
 * @param journeyId - The journey ID from a previous search
 */
export const getJourneyDetails = async (journeyId: string): Promise<Journey | null> => {
  try {
    const url = `${JOURNEYS_BASE_URL}/${encodeURIComponent(journeyId)}`;

    const { data } = await fetchJson<DBJourneyDetailsResponse>(url, {
      journeyId,
    });

    if (!data) {
      return null;
    }

    return mapJourney(data);
  } catch (error) {
    console.error(`[DB Journeys][${getTimestamp()}] getJourneyDetails error`, error);
    throw new Error("Failed to get journey details from DB Journeys API.");
  }
};

// =============================================================================
// Legacy/Convenience Functions
// =============================================================================

type DBArrivalInfo = {
  time: string;
  stationName: string;
};

const buildArrivalsMap = async (
  destinationEva: string,
  dateTime: string,
  hoursToCheck: number
): Promise<Map<string, DBArrivalInfo>> => {
  const arrivals: Map<string, DBArrivalInfo> = new Map();
  const baseDateTime = new Date(dateTime);

  for (let offset = 0; offset <= hoursToCheck; offset += 1) {
    const destDateTime = new Date(baseDateTime);
    destDateTime.setHours(destDateTime.getHours() + offset);

    const { dateStr, hourStr } = formatTimetableDateHour(destDateTime);
    const destUrl = `${TIMETABLES_BASE_URL}/plan/${encodeURIComponent(destinationEva)}/${dateStr}/${hourStr}`;

    try {
      const { data: destData } = await fetchXml<{ timetable?: DBTimetablePlanResponse }>(destUrl, {
        evaNo: destinationEva,
      });

      const destStops = destData.timetable?.s;
      const destStationName = destData.timetable?.station ?? "";

      if (destStops) {
        const destStopsArray = Array.isArray(destStops) ? destStops : [destStops];

        // Build a map of train number -> arrival time at destination
        for (const stop of destStopsArray) {
          if (stop.ar?.pt && stop.tl?.n) {
            const trainKey = `${stop.tl.c ?? stop.tl.t ?? ""}${stop.tl.n}`;
            const arrivalTime = parseTimetableTime(stop.ar.pt);
            if (arrivalTime) {
              arrivals.set(trainKey, { time: arrivalTime, stationName: destStationName });
            }
          }
        }
      }
    } catch (error) {
      console.warn("[DB API] buildArrivalsMap: Could not fetch destination arrivals", error);
    }
  }

  return arrivals;
};

/**
 * Search for journeys between two stations
 * Note: Neither API directly supports A→B routing. This uses Timetables departure boards.
 * For full routing, consider using getDepartures and filtering by destination.
 * @param params - Search parameters including from, to, and dateTime
 */
export const searchJourneys = async (
  params: JourneySearchParams
): Promise<Journey[]> => {
  console.log("[DB API] searchJourneys: Fetching departures from origin and arrivals at destination");

  // Get departures from origin station
  const departures = await getDepartures(params.from, params.dateTime);

  // Get arrivals at destination station for multiple hours (to capture travel time)
  const arrivals = await buildArrivalsMap(params.to, params.dateTime, 4);

  // Match departures with arrivals to calculate duration
  // Try multiple key formats since train types may differ between stations
  const journeysWithDuration = departures.map((journey) => {
    const trainKey = `${journey.trainType}${journey.trainNumber}`;
    // Also try just the train number as a fallback
    const trainNumberOnly = journey.trainNumber;
    
    // Try exact match first, then try number-only match
    let arrivalInfo = arrivals.get(trainKey);
    
    // If no exact match, search for any key ending with the train number
    if (!arrivalInfo) {
      for (const [key, value] of arrivals.entries()) {
        if (key.endsWith(trainNumberOnly)) {
          arrivalInfo = value;
          break;
        }
      }
    }

    if (arrivalInfo && journey.departure.scheduledDeparture) {
      const depTime = new Date(journey.departure.scheduledDeparture).getTime();
      const arrTime = new Date(arrivalInfo.time).getTime();
      const durationMinutes = Math.round((arrTime - depTime) / 60000);

      // Only set duration if it's positive and reasonable (< 24 hours)
      if (durationMinutes > 0 && durationMinutes < 1440) {
        return {
          ...journey,
          duration: durationMinutes,
          arrival: {
            ...journey.arrival,
            station: {
              ...journey.arrival.station,
              name: arrivalInfo.stationName,
              code: params.to,
            },
            scheduledArrival: arrivalInfo.time,
          },
        };
      }
    }

    return journey;
  });

  // Filter to only show trains that stop at the destination (have matching arrivals)
  const filteredJourneys = journeysWithDuration.filter((j) => j.duration > 0);

  return filteredJourneys.length > 0 ? filteredJourneys : departures;
};

/**
 * Search for journeys between two stations (strict)
 * Returns only trains that are observed arriving at the destination station.
 */
export const searchJourneysStrict = async (
  params: JourneySearchParams
): Promise<Journey[]> => {
  console.log("[DB API] searchJourneysStrict: Fetching departures from origin and arrivals at destination");

  const departures = await getDepartures(params.from, params.dateTime);
  const arrivals = await buildArrivalsMap(params.to, params.dateTime, 4);
  const journeysWithDuration = departures.map((journey) => {
    const trainKey = `${journey.trainType}${journey.trainNumber}`;
    const trainNumberOnly = journey.trainNumber;

    let arrivalInfo = arrivals.get(trainKey);

    if (!arrivalInfo) {
      for (const [key, value] of arrivals.entries()) {
        if (key.endsWith(trainNumberOnly)) {
          arrivalInfo = value;
          break;
        }
      }
    }

    if (arrivalInfo && journey.departure.scheduledDeparture) {
      const depTime = new Date(journey.departure.scheduledDeparture).getTime();
      const arrTime = new Date(arrivalInfo.time).getTime();
      const durationMinutes = Math.round((arrTime - depTime) / 60000);

      if (durationMinutes > 0 && durationMinutes < 1440) {
        return {
          ...journey,
          duration: durationMinutes,
          arrival: {
            ...journey.arrival,
            station: {
              ...journey.arrival.station,
              name: arrivalInfo.stationName,
              code: params.to,
              uicCode: params.to,
            },
            scheduledArrival: arrivalInfo.time,
          },
        };
      }
    }

    return journey;
  });

  const strictResults = journeysWithDuration.filter((j) => j.duration > 0);
  return strictResults;
};

/**
 * Get journey status (alias for getJourneyDetails)
 * @param journeyId - The journey ID
 */
export const getJourneyStatus = getJourneyDetails;

/**
 * Resolve journey details by train number and approximate departure time.
 * Uses RIS::Journeys findJourneys() then matches best candidate by time.
 * @param trainNumber - Train number (e.g., "123" for ICE 123)
 * @param trainType - Train type (e.g., "ICE", "IC", "RE")
 * @param departureTime - ISO datetime string for expected departure
 * @param originEva - Optional origin station EVA number for better matching
 * @returns Journey with full stops, or null if not found
 */
export const resolveJourneyDetail = async (
  trainNumber: string,
  trainType: string,
  departureTime: string,
  originEva?: string
): Promise<Journey | null> => {
  try {
    // Find journeys by train number
    const candidates = await findJourneys(trainNumber, departureTime, [trainType]);

    if (candidates.length === 0) {
      // Try without transport type filter as a fallback
      const fallbackCandidates = await findJourneys(trainNumber, departureTime);
      if (fallbackCandidates.length === 0) {
        console.warn(`[DB API] resolveJourneyDetail: No journeys found for ${trainType} ${trainNumber}`);
        return null;
      }
      candidates.push(...fallbackCandidates);
    }

    const targetTime = new Date(departureTime).getTime();
    const TEN_MINUTES_MS = 10 * 60 * 1000;

    // Score candidates by time proximity and origin match
    let bestCandidate = candidates[0];
    let bestScore = Infinity;

    for (const candidate of candidates) {
      const candidateDepTime = candidate.departure.scheduledDeparture;
      if (!candidateDepTime) continue;

      const candidateTime = new Date(candidateDepTime).getTime();
      const timeDiff = Math.abs(candidateTime - targetTime);

      // Origin EVA match gives priority
      let score = timeDiff;
      if (originEva && candidate.departure.station.code === originEva) {
        score -= TEN_MINUTES_MS; // Boost score for origin match
      }

      if (score < bestScore) {
        bestScore = score;
        bestCandidate = candidate;
      }
    }

    // If best match is too far off (>10 min), still return it but log warning
    if (bestScore > TEN_MINUTES_MS) {
      console.warn(
        `[DB API] resolveJourneyDetail: Best match for ${trainType} ${trainNumber} is ${Math.round(bestScore / 60000)} min off`
      );
    }

    // Now fetch full journey details using the journeyID
    if (bestCandidate.id) {
      const details = await getJourneyDetails(bestCandidate.id);
      if (details) {
        return details;
      }
    }

    // Fallback to the candidate itself if details fetch fails
    return bestCandidate;
  } catch (error) {
    console.error(`[DB API][${getTimestamp()}] resolveJourneyDetail error`, error);
    return null;
  }
};
