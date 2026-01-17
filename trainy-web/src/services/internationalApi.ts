import * as nsApi from "./nsApi";
import * as dbApi from "./dbApi";
import type {
  Journey,
  JourneyStop,
  MergedJourney,
  MergedJourneyLeg,
  MergedJourneyStop,
  MergedStation,
  Station,
} from "../types/train";

// =============================================================================
// International API Service
// =============================================================================
//
// Orchestrates NS (Dutch) and DB (German) APIs to provide cross-border
// journey search. For Amsterdam to Frankfurt, this means:
// - NS API can find journeys from Amsterdam to German border/major stations
// - DB API can find journeys from Dutch border/major stations to Frankfurt
// - This service combines and deduplicates results
//
// Key insight: NS API supports searching to German stations directly,
// since ICE trains run Amsterdam-Frankfurt. DB requires station EVA numbers.
// =============================================================================

const getTimestamp = () => new Date().toISOString();

const logInfo = (message: string, data?: unknown) => {
  console.log(`[International API][${getTimestamp()}] ${message}`, data ?? "");
};

const logError = (message: string, error: unknown) => {
  console.error(`[International API][${getTimestamp()}] ${message}`, error);
};

// =============================================================================
// Station Search - Combines NS and DB results
// =============================================================================

/**
 * Determine which country's API should be authoritative for a station
 */
const getAuthoritativeSource = (station: Station): "NS" | "DB" => {
  const country = station.country?.toUpperCase();
  if (country === "NL" || country === "NETHERLANDS" || country === "B" || country === "BE") {
    return "NS";
  }
  if (country === "DE" || country === "GERMANY" || country === "D") {
    return "DB";
  }
  // Default to NS for unknown (they have good international coverage)
  return "NS";
};

/**
 * Search stations from both NS and DB APIs
 * Returns merged results with duplicates removed
 */
export const searchStations = async (query: string): Promise<MergedStation[]> => {
  if (!query || query.length < 2) {
    return [];
  }

  logInfo(`Searching stations: "${query}"`);

  const results: MergedStation[] = [];
  const seenNames = new Set<string>();

  // Check for known stations first (provides faster results for common routes)
  const knownStation = findKnownStation(query);
  if (knownStation) {
    logInfo(`Found known station: ${knownStation.name}`);
    seenNames.add(knownStation.name.toLowerCase().trim());
    results.push(knownStation);
  }

  // Search both APIs in parallel
  const [nsResult, dbResult] = await Promise.allSettled([
    nsApi.searchStations(query),
    dbApi.searchStations(query),
  ]);

  // Process NS results first (higher priority for Dutch stations)
  if (nsResult.status === "fulfilled") {
    logInfo(`NS returned ${nsResult.value.length} stations`);
    for (const station of nsResult.value) {
      const normalizedName = station.name.toLowerCase().trim();
      if (!seenNames.has(normalizedName)) {
        seenNames.add(normalizedName);
        results.push({
          ...station,
          nsStation: station,
          authoritative: getAuthoritativeSource(station),
        });
      }
    }
  } else {
    logError("NS station search failed", nsResult.reason);
  }

  // Process DB results
  if (dbResult.status === "fulfilled") {
    logInfo(`DB returned ${dbResult.value.length} stations`);
    for (const station of dbResult.value) {
      const normalizedName = station.name.toLowerCase().trim();
      if (!seenNames.has(normalizedName)) {
        seenNames.add(normalizedName);
        results.push({
          ...station,
          dbStation: station,
          authoritative: getAuthoritativeSource(station),
        });
      } else {
        // Station exists from NS, add DB data
        const existing = results.find(
          (s) => s.name.toLowerCase().trim() === normalizedName
        );
        if (existing) {
          existing.dbStation = station;
          // If DB station has EVA code, use it (needed for DB API calls)
          if (station.uicCode && !existing.uicCode) {
            existing.uicCode = station.uicCode;
          }
        }
      }
    }
  } else {
    logError("DB station search failed", dbResult.reason);
  }

  // Sort by relevance (exact matches first, then alphabetical)
  const queryLower = query.toLowerCase();
  results.sort((a, b) => {
    const aExact = a.name.toLowerCase().startsWith(queryLower);
    const bExact = b.name.toLowerCase().startsWith(queryLower);
    if (aExact && !bExact) return -1;
    if (bExact && !aExact) return 1;
    return a.name.localeCompare(b.name);
  });

  logInfo(`Combined: ${results.length} unique stations`);
  return results;
};

// =============================================================================
// Journey Search - Orchestrates NS and DB APIs
// =============================================================================

/**
 * Generate a deduplication key for a journey
 * Uses train number + approximate departure time (rounded to 5 min)
 */
const generateDeduplicationKey = (journey: Journey): string => {
  const trainId = `${journey.trainType}${journey.trainNumber}`.replace(/\s/g, "");
  const depTime = journey.departure.scheduledDeparture;
  if (!depTime) {
    return trainId;
  }

  // Round to nearest 5 minutes for fuzzy matching
  const date = new Date(depTime);
  const minutes = Math.round(date.getMinutes() / 5) * 5;
  date.setMinutes(minutes, 0, 0);
  const timeKey = date.toISOString().slice(0, 16);

  return `${trainId}-${timeKey}`;
};

/**
 * Convert a JourneyStop to MergedJourneyStop
 */
const toMergedStop = (stop: JourneyStop, source: "NS" | "DB"): MergedJourneyStop => ({
  ...stop,
  source,
});

/**
 * Convert a Journey to MergedJourney
 */
const toMergedJourney = (journey: Journey): MergedJourney => {
  const source = journey.apiSource as "NS" | "DB";
  
  // Create a single leg from the journey
  const leg: MergedJourneyLeg = {
    trainNumber: journey.trainNumber,
    trainType: journey.trainType,
    operator: journey.operator,
    departure: toMergedStop(journey.departure, source),
    arrival: toMergedStop(journey.arrival, source),
    stops: journey.stops.map((s) => toMergedStop(s, source)),
    duration: journey.duration,
    source,
  };

  return {
    ...journey,
    [source === "NS" ? "nsJourney" : "dbJourney"]: journey,
    deduplicationKey: generateDeduplicationKey(journey),
    transfers: 0, // Single direct journey
    legs: [leg],
  };
};

/**
 * Merge two journeys that represent the same train
 * Prefers more complete data from each source
 */
const mergeJourneys = (
  journey1: MergedJourney,
  journey2: MergedJourney
): MergedJourney => {
  // Combine stops from both sources, preferring more stops
  const allStops = journey1.legs[0].stops.length >= journey2.legs[0].stops.length
    ? journey1.legs[0].stops
    : journey2.legs[0].stops;

  // Merge journey references
  const merged: MergedJourney = {
    ...journey1,
    nsJourney: journey1.nsJourney ?? journey2.nsJourney,
    dbJourney: journey1.dbJourney ?? journey2.dbJourney,
    apiSource: "merged",
    legs: [
      {
        ...journey1.legs[0],
        stops: allStops,
      },
    ],
  };

  // Use more complete arrival info
  if (!merged.arrival.scheduledArrival && journey2.arrival.scheduledArrival) {
    merged.arrival = journey2.arrival;
    merged.legs[0].arrival = toMergedStop(journey2.arrival, journey2.apiSource as "NS" | "DB");
  }

  return merged;
};

/**
 * Get the station identifier to use for each API
 */
const getStationIdForApi = (
  station: MergedStation,
  api: "NS" | "DB"
): string => {
  if (api === "NS") {
    // NS accepts station names or codes
    return station.nsStation?.name ?? station.name;
  } else {
    // DB requires EVA number for journey search
    // If we have a dbStation with code (EVA), use that
    if (station.dbStation?.uicCode) {
      return station.dbStation.uicCode;
    }
    if (station.dbStation?.code) {
      return station.dbStation.code;
    }
    // Fallback to searching by name
    return station.uicCode ?? station.code ?? station.name;
  }
};

/**
 * Search for international journeys between two stations
 * Queries both NS and DB APIs and merges results
 */
export const searchJourneys = async (
  fromStation: MergedStation,
  toStation: MergedStation,
  dateTime: string
): Promise<MergedJourney[]> => {
  logInfo("Searching international journeys", {
    from: fromStation.name,
    to: toStation.name,
    dateTime,
  });

  const journeysByKey = new Map<string, MergedJourney>();

  // Determine which APIs to query based on stations
  const shouldQueryNS = true; // NS has good international coverage
  const shouldQueryDB = true; // DB also covers international routes

  const apiCalls: Promise<{ source: "NS" | "DB"; journeys: Journey[] }>[] = [];

  // Query NS API
  if (shouldQueryNS) {
    const nsFrom = getStationIdForApi(fromStation, "NS");
    const nsTo = getStationIdForApi(toStation, "NS");
    
    logInfo(`Querying NS: ${nsFrom} → ${nsTo}`);
    
    apiCalls.push(
      nsApi
        .searchJourneys({
          from: nsFrom,
          to: nsTo,
          dateTime,
        })
        .then((journeys) => ({ source: "NS" as const, journeys }))
        .catch((error) => {
          logError("NS journey search failed", error);
          return { source: "NS" as const, journeys: [] };
        })
    );
  }

  // Query DB API
  if (shouldQueryDB) {
    // For DB, we need EVA numbers. Try to find them.
    let dbFromId = getStationIdForApi(fromStation, "DB");
    let dbToId = getStationIdForApi(toStation, "DB");

    // If we don't have EVA numbers, try to look them up
    if (!dbFromId.match(/^\d{7}$/)) {
      logInfo(`Looking up DB station ID for: ${fromStation.name}`);
      try {
        const dbStations = await dbApi.searchStations(fromStation.name);
        if (dbStations.length > 0) {
          const match = dbStations.find(
            (s) =>
              s.name.toLowerCase().includes(fromStation.name.toLowerCase()) ||
              fromStation.name.toLowerCase().includes(s.name.toLowerCase())
          ) ?? dbStations[0];
          dbFromId = match.uicCode ?? match.code;
          logInfo(`Found DB origin: ${match.name} (${dbFromId})`);
        }
      } catch (e) {
        logError("Failed to look up DB origin station", e);
      }
    }

    if (!dbToId.match(/^\d{7}$/)) {
      logInfo(`Looking up DB station ID for: ${toStation.name}`);
      try {
        const dbStations = await dbApi.searchStations(toStation.name);
        if (dbStations.length > 0) {
          const match = dbStations.find(
            (s) =>
              s.name.toLowerCase().includes(toStation.name.toLowerCase()) ||
              toStation.name.toLowerCase().includes(s.name.toLowerCase())
          ) ?? dbStations[0];
          dbToId = match.uicCode ?? match.code;
          logInfo(`Found DB destination: ${match.name} (${dbToId})`);
        }
      } catch (e) {
        logError("Failed to look up DB destination station", e);
      }
    }

    if (dbFromId && dbToId) {
      logInfo(`Querying DB: ${dbFromId} → ${dbToId}`);
      
      apiCalls.push(
        dbApi
          .searchJourneys({
            from: dbFromId,
            to: dbToId,
            dateTime,
          })
          .then((journeys) => ({ source: "DB" as const, journeys }))
          .catch((error) => {
            logError("DB journey search failed", error);
            return { source: "DB" as const, journeys: [] };
          })
      );
    }
  }

  // Wait for all API calls
  const results = await Promise.all(apiCalls);

  // Process and deduplicate results
  for (const { source, journeys } of results) {
    logInfo(`${source} returned ${journeys.length} journeys`);
    
    for (const journey of journeys) {
      const merged = toMergedJourney(journey);
      const key = merged.deduplicationKey;

      if (journeysByKey.has(key)) {
        // Merge with existing journey
        const existing = journeysByKey.get(key)!;
        journeysByKey.set(key, mergeJourneys(existing, merged));
        logInfo(`Merged duplicate journey: ${key}`);
      } else {
        journeysByKey.set(key, merged);
      }
    }
  }

  // Convert to array and sort by departure time
  const uniqueJourneys = Array.from(journeysByKey.values());
  uniqueJourneys.sort((a, b) => {
    const aTime = a.departure.scheduledDeparture ?? "";
    const bTime = b.departure.scheduledDeparture ?? "";
    return aTime.localeCompare(bTime);
  });

  logInfo(`Final result: ${uniqueJourneys.length} unique journeys`);
  return uniqueJourneys;
};

// =============================================================================
// Journey Details - Get full stop information
// =============================================================================

/**
 * Get detailed journey information with all stops
 * Tries to get data from the most authoritative source
 */
export const getJourneyDetails = async (
  journey: MergedJourney
): Promise<MergedJourney> => {
  logInfo(`Getting details for journey: ${journey.trainType} ${journey.trainNumber}`);

  // Try to get more details from each API
  const detailCalls: Promise<Journey | null>[] = [];

  // If we have an NS journey, try to get NS details
  if (journey.nsJourney) {
    detailCalls.push(
      nsApi
        .getJourneyDetails(
          journey.trainNumber,
          journey.departure.scheduledDeparture ?? new Date().toISOString()
        )
        .catch((e) => {
          logError("NS journey details failed", e);
          return null;
        })
    );
  }

  // If we have a DB journey, try to get DB details
  if (journey.dbJourney && journey.dbJourney.id) {
    detailCalls.push(
      dbApi.getJourneyDetails(journey.dbJourney.id).catch((e) => {
        logError("DB journey details failed", e);
        return null;
      })
    );
  }

  const results = await Promise.all(detailCalls);
  
  // Find the result with the most stops
  let bestResult: Journey | null = null;
  let maxStops = journey.stops.length;

  for (const result of results) {
    if (result && result.stops.length > maxStops) {
      bestResult = result;
      maxStops = result.stops.length;
    }
  }

  if (bestResult) {
    logInfo(`Found detailed journey with ${bestResult.stops.length} stops`);
    const source = bestResult.apiSource as "NS" | "DB";
    return {
      ...journey,
      stops: bestResult.stops,
      legs: [
        {
          ...journey.legs[0],
          stops: bestResult.stops.map((s) => toMergedStop(s, source)),
        },
      ],
    };
  }

  return journey;
};

// =============================================================================
// Known Major Stations (for common routes)
// =============================================================================

export const KNOWN_STATIONS = {
  // Netherlands
  AMSTERDAM_CENTRAAL: {
    name: "Amsterdam Centraal",
    code: "ASD",
    country: "NL",
    uicCode: "8400058",
    authoritative: "NS" as const,
  },
  UTRECHT_CENTRAAL: {
    name: "Utrecht Centraal",
    code: "UT",
    country: "NL",
    uicCode: "8400621",
    authoritative: "NS" as const,
  },
  ARNHEM_CENTRAAL: {
    name: "Arnhem Centraal",
    code: "AH",
    country: "NL",
    uicCode: "8400071",
    authoritative: "NS" as const,
  },
  
  // Germany
  FRANKFURT_HBF: {
    name: "Frankfurt(Main)Hbf",
    code: "FF",
    country: "DE",
    uicCode: "8000105",
    authoritative: "DB" as const,
  },
  KOLN_HBF: {
    name: "Köln Hbf",
    code: "KK",
    country: "DE",
    uicCode: "8000207",
    authoritative: "DB" as const,
  },
  DUSSELDORF_HBF: {
    name: "Düsseldorf Hbf",
    code: "KD",
    country: "DE",
    uicCode: "8000085",
    authoritative: "DB" as const,
  },
  DUISBURG_HBF: {
    name: "Duisburg Hbf",
    code: "EDG",
    country: "DE",
    uicCode: "8000086",
    authoritative: "DB" as const,
  },
} as const;

/**
 * Station name aliases for common search terms
 * Maps user-friendly names to the known stations
 */
export const STATION_ALIASES: Record<string, typeof KNOWN_STATIONS[keyof typeof KNOWN_STATIONS]> = {
  // Amsterdam
  "amsterdam": KNOWN_STATIONS.AMSTERDAM_CENTRAAL,
  "amsterdam centraal": KNOWN_STATIONS.AMSTERDAM_CENTRAAL,
  "amsterdam central": KNOWN_STATIONS.AMSTERDAM_CENTRAAL,
  "amsterdam cs": KNOWN_STATIONS.AMSTERDAM_CENTRAAL,
  
  // Frankfurt
  "frankfurt": KNOWN_STATIONS.FRANKFURT_HBF,
  "frankfurt hbf": KNOWN_STATIONS.FRANKFURT_HBF,
  "frankfurt main": KNOWN_STATIONS.FRANKFURT_HBF,
  "frankfurt am main": KNOWN_STATIONS.FRANKFURT_HBF,
  "frankfurt(main)hbf": KNOWN_STATIONS.FRANKFURT_HBF,
  
  // Köln
  "köln": KNOWN_STATIONS.KOLN_HBF,
  "koln": KNOWN_STATIONS.KOLN_HBF,
  "cologne": KNOWN_STATIONS.KOLN_HBF,
  "köln hbf": KNOWN_STATIONS.KOLN_HBF,
  "koln hbf": KNOWN_STATIONS.KOLN_HBF,
  
  // Düsseldorf
  "düsseldorf": KNOWN_STATIONS.DUSSELDORF_HBF,
  "dusseldorf": KNOWN_STATIONS.DUSSELDORF_HBF,
  "düsseldorf hbf": KNOWN_STATIONS.DUSSELDORF_HBF,
  "dusseldorf hbf": KNOWN_STATIONS.DUSSELDORF_HBF,
  
  // Utrecht
  "utrecht": KNOWN_STATIONS.UTRECHT_CENTRAAL,
  "utrecht centraal": KNOWN_STATIONS.UTRECHT_CENTRAAL,
  "utrecht cs": KNOWN_STATIONS.UTRECHT_CENTRAAL,
  
  // Arnhem
  "arnhem": KNOWN_STATIONS.ARNHEM_CENTRAAL,
  "arnhem centraal": KNOWN_STATIONS.ARNHEM_CENTRAAL,
};

/**
 * Try to find a known station from a search query
 */
export const findKnownStation = (query: string): MergedStation | null => {
  const normalized = query.toLowerCase().trim();
  const known = STATION_ALIASES[normalized];
  
  if (known) {
    return {
      ...known,
      authoritative: known.authoritative,
    };
  }
  
  return null;
};
