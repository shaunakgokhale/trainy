// =============================================================================
// International API Service
// =============================================================================
// Orchestrates multiple train API providers to enable cross-border journey
// search and unified journey storage.
//
// Architecture:
// - Layer 1 (Providers): nsProvider, dbProvider handle API communication
// - Layer 2 (Registry): stationRegistry provides unified station identifiers
// - Layer 3 (This file): Orchestrates providers and manages persistence
// =============================================================================

import {
  getProviderForCountry,
  getActiveProviders,
  getProvider,
  type TrainProvider,
  type ProviderID,
  type CountryCode,
} from "./providers";
import {
  findStationsByName,
  getStationById,
  type UnifiedStation,
} from "../data/stationRegistry";
import { findStationIdByAlias } from "../data/stationAliases";
import {
  storeJourneys,
  getJourneyById,
  updateJourneyRealtime,
} from "./journeyStore";
import type {
  Journey,
  JourneyStop,
  StoredJourney,
  StoredJourneyInput,
  StoredJourneyStop,
  ApiSource,
  JourneyStatus,
} from "../types/train";
import { generateJourneyKey } from "../types/train";

// =============================================================================
// Logging Helpers
// =============================================================================

const getTimestamp = () => new Date().toISOString();

const logInfo = (message: string, data?: unknown) => {
  console.log(`[InternationalAPI][${getTimestamp()}] ${message}`, data ?? "");
};

const logError = (message: string, error: unknown) => {
  console.error(`[InternationalAPI][${getTimestamp()}] ${message}`, error);
};

// =============================================================================
// Station Search
// =============================================================================

/**
 * Search for stations across all providers and the registry.
 * Combines results with registry data taking priority.
 */
export async function searchStations(query: string): Promise<UnifiedStation[]> {
  if (!query || query.length < 2) {
    return [];
  }

  logInfo(`Searching stations: "${query}"`);

  const results: UnifiedStation[] = [];
  const seenIds = new Set<string>();

  // 1. Check aliases first (instant match for common names)
  const aliasMatch = findStationIdByAlias(query);
  if (aliasMatch) {
    const station = getStationById(aliasMatch);
    if (station) {
      logInfo(`Found alias match: ${station.displayName}`);
      seenIds.add(station.id);
      results.push(station);
    }
  }

  // 2. Search registry by name
  const registryMatches = findStationsByName(query);
  for (const station of registryMatches) {
    if (!seenIds.has(station.id)) {
      seenIds.add(station.id);
      results.push(station);
    }
  }

  // 3. Query active providers in parallel for additional stations
  const providers = getActiveProviders();
  const providerResults = await Promise.allSettled(
    providers.map((provider) =>
      provider.searchStations(query).then((stations) => ({
        provider: provider.id,
        stations,
      }))
    )
  );

  // Process provider results
  for (const result of providerResults) {
    if (result.status === "fulfilled") {
      const { provider, stations } = result.value;
      logInfo(`${provider} returned ${stations.length} stations`);

      for (const apiStation of stations) {
        // Try to find existing registry station by provider ID
        const normalizedName = apiStation.name.toLowerCase().trim();
        const existingStation = results.find(
          (s) => s.displayName.toLowerCase().trim() === normalizedName
        );

        if (existingStation) {
          // Add provider ID to existing station if not present
          if (!existingStation.providerIds[provider as ProviderID]) {
            existingStation.providerIds[provider as ProviderID] =
              apiStation.code || apiStation.uicCode;
          }
        } else {
          // Create new unified station from API result
          const newStation: UnifiedStation = {
            id: normalizedName.replace(/\s+/g, "-"),
            displayName: apiStation.name,
            country: (apiStation.country?.toUpperCase() || "XX") as CountryCode,
            coordinates:
              apiStation.lat && apiStation.lng
                ? { lat: apiStation.lat, lng: apiStation.lng }
                : undefined,
            providerIds: {
              [provider as ProviderID]: apiStation.code || apiStation.uicCode,
            },
          };
          seenIds.add(newStation.id);
          results.push(newStation);
        }
      }
    } else {
      logError("Provider station search failed", result.reason);
    }
  }

  // Sort by relevance (exact matches first)
  const queryLower = query.toLowerCase();
  results.sort((a, b) => {
    const aExact = a.displayName.toLowerCase().startsWith(queryLower);
    const bExact = b.displayName.toLowerCase().startsWith(queryLower);
    if (aExact && !bExact) return -1;
    if (bExact && !aExact) return 1;
    return a.displayName.localeCompare(b.displayName);
  });

  logInfo(`Found ${results.length} unique stations`);
  return results;
}

// =============================================================================
// Journey Search
// =============================================================================

/**
 * Search for journeys between two stations.
 * Queries relevant providers and stores results in the database.
 */
export async function searchJourneys(
  fromStation: UnifiedStation,
  toStation: UnifiedStation,
  dateTime: string
): Promise<StoredJourney[]> {
  logInfo("Searching journeys", {
    from: fromStation.displayName,
    to: toStation.displayName,
    dateTime,
  });

  // Determine which providers to query
  const primaryProvider = getProviderForCountry(fromStation.country);
  const secondaryProvider = getProviderForCountry(toStation.country);

  const providersToQuery = new Set<TrainProvider>();
  if (primaryProvider) providersToQuery.add(primaryProvider);
  if (secondaryProvider && secondaryProvider.id !== primaryProvider?.id) {
    providersToQuery.add(secondaryProvider);
  }

  // Query all relevant providers
  const allJourneys: Array<{ source: ProviderID; journey: Journey }> = [];

  for (const provider of providersToQuery) {
    try {
      const fromId = provider.toProviderStationId(fromStation);
      const toId = provider.toProviderStationId(toStation);

      if (!fromId || !toId) {
        logInfo(`${provider.id} missing station IDs, skipping`);
        continue;
      }

      logInfo(`Querying ${provider.id}: ${fromId} → ${toId}`);

      const journeys = await provider.searchJourneys({
        from: fromId,
        to: toId,
        dateTime,
      });

      logInfo(`${provider.id} returned ${journeys.length} journeys`);

      for (const journey of journeys) {
        allJourneys.push({ source: provider.id, journey });
      }
    } catch (error) {
      logError(`${provider.id} search failed`, error);
    }
  }

  // Merge duplicate journeys from different providers
  const mergedJourneys = mergeJourneys(allJourneys, fromStation, toStation);

  // Convert to storage format and store
  const storageInputs = mergedJourneys.map((merged) =>
    toStoredJourneyInput(merged, fromStation, toStation)
  );

  // Store all journeys
  const storedJourneys = await storeJourneys(storageInputs);

  // If storage failed, return in-memory versions
  if (storedJourneys.length === 0) {
    logInfo("Storage failed, returning in-memory journeys");
    return storageInputs.map((input, index) => ({
      ...input,
      id: `temp-${index}`,
      stops: input.stops.map((stop, stopIndex) => ({
        ...stop,
        id: `temp-stop-${stopIndex}`,
        journeyId: `temp-${index}`,
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
  }

  logInfo(`Stored ${storedJourneys.length} journeys`);
  return storedJourneys;
}

// =============================================================================
// Journey Details
// =============================================================================

/**
 * Get detailed journey information by database ID.
 * Optionally refreshes realtime data from providers.
 */
export async function getJourneyDetails(
  journeyId: string,
  refresh = false
): Promise<StoredJourney | null> {
  logInfo(`Getting journey details: ${journeyId}, refresh: ${refresh}`);

  // Fetch from database
  let journey = await getJourneyById(journeyId);

  if (!journey) {
    logError("Journey not found", { journeyId });
    return null;
  }

  // If refresh requested, re-query providers for realtime data
  if (refresh) {
    journey = await refreshJourneyRealtime(journey);
  }

  return journey;
}

/**
 * Refresh realtime data (delays, platforms) for a stored journey.
 */
async function refreshJourneyRealtime(
  journey: StoredJourney
): Promise<StoredJourney> {
  logInfo(`Refreshing realtime data for ${journey.journeyKey}`);

  const updates: {
    status?: JourneyStatus;
    stops?: Array<{
      sequence: number;
      arrivalDelayMin?: number;
      departureDelayMin?: number;
      actualPlatform?: string;
      cancelled?: boolean;
    }>;
  } = { stops: [] };

  // Try to get fresh data from each source
  for (const sourceId of journey.sources) {
    const provider = getProvider(sourceId as ProviderID);
    if (!provider) continue;

    try {
      // Build the provider journey ID
      let providerJourneyId: string | undefined;
      if (sourceId === "NS" && journey.nsRawId) {
        providerJourneyId = `${journey.trainNumber}_${journey.scheduledDeparture}`;
      } else if (sourceId === "DB" && journey.dbRawId) {
        providerJourneyId = journey.dbRawId;
      }

      if (!providerJourneyId) continue;

      const freshJourney = await provider.getJourneyDetails(providerJourneyId);
      if (!freshJourney) continue;

      // Update status
      if (freshJourney.status !== "scheduled") {
        updates.status = freshJourney.status;
      }

      // Update stops with fresh delay/platform data
      for (const stop of freshJourney.stops) {
        const matchingStop = journey.stops.find(
          (s) =>
            s.stationName.toLowerCase() === stop.station.name.toLowerCase() ||
            s.stationId === stop.station.code
        );

        if (matchingStop) {
          updates.stops!.push({
            sequence: matchingStop.sequence,
            arrivalDelayMin: stop.arrivalDelay,
            departureDelayMin: stop.departureDelay,
            actualPlatform: stop.actualPlatform,
            cancelled: stop.cancelled,
          });
        }
      }
    } catch (error) {
      logError(`Failed to refresh from ${sourceId}`, error);
    }
  }

  // Apply updates to database
  if (updates.status || (updates.stops && updates.stops.length > 0)) {
    const updated = await updateJourneyRealtime(journey.id, updates);
    if (updated) {
      logInfo("Realtime update applied");
      return updated;
    }
  }

  return journey;
}

// =============================================================================
// Journey Merging
// =============================================================================

interface MergedJourneyData {
  trainNumber: string;
  trainType: string;
  operator: string;
  departure: JourneyStop;
  arrival: JourneyStop;
  stops: JourneyStop[];
  duration: number;
  status: JourneyStatus;
  sources: ProviderID[];
  nsRawId?: string;
  dbRawId?: string;
}

/**
 * Merge journeys from different providers that represent the same train.
 * Uses train number + departure time for matching.
 */
function mergeJourneys(
  journeys: Array<{ source: ProviderID; journey: Journey }>,
  fromStation: UnifiedStation,
  toStation: UnifiedStation
): MergedJourneyData[] {
  const byKey = new Map<string, MergedJourneyData>();

  for (const { source, journey } of journeys) {
    const key = generateMergeKey(journey);
    const existing = byKey.get(key);

    if (existing) {
      // Merge with existing
      logInfo(`Merging duplicate journey: ${key}`);
      mergeIntoExisting(existing, journey, source, fromStation, toStation);
    } else {
      // Create new merged journey
      byKey.set(key, {
        trainNumber: journey.trainNumber,
        trainType: journey.trainType,
        operator: journey.operator,
        departure: journey.departure,
        arrival: journey.arrival,
        stops: journey.stops,
        duration: journey.duration,
        status: journey.status,
        sources: [source],
        nsRawId: source === "NS" ? journey.id : undefined,
        dbRawId: source === "DB" ? journey.id : undefined,
      });
    }
  }

  return Array.from(byKey.values());
}

/**
 * Generate a key for matching journeys across providers.
 * Uses train number + rounded departure time.
 */
function generateMergeKey(journey: Journey): string {
  const trainId = `${journey.trainType}${journey.trainNumber}`.replace(
    /\s/g,
    ""
  );
  const depTime = journey.departure.scheduledDeparture;

  if (!depTime) return trainId;

  // Round to nearest 5 minutes for fuzzy matching
  const date = new Date(depTime);
  const minutes = Math.round(date.getMinutes() / 5) * 5;
  date.setMinutes(minutes, 0, 0);
  const timeKey = date.toISOString().slice(0, 16);

  return `${trainId}-${timeKey}`;
}

/**
 * Merge a new journey into an existing merged journey.
 * Applies field priority rules based on country authority.
 */
function mergeIntoExisting(
  existing: MergedJourneyData,
  newJourney: Journey,
  newSource: ProviderID,
  fromStation: UnifiedStation,
  toStation: UnifiedStation
): void {
  // Track source
  if (!existing.sources.includes(newSource)) {
    existing.sources.push(newSource);
  }

  // Store raw IDs
  if (newSource === "NS") {
    existing.nsRawId = newJourney.id;
  } else if (newSource === "DB") {
    existing.dbRawId = newJourney.id;
  }

  // Field priority: origin country provider authoritative for departure
  const originProvider = getProviderForCountry(fromStation.country);
  const destProvider = getProviderForCountry(toStation.country);

  // Update departure if new source is authoritative for origin
  if (originProvider?.id === newSource) {
    if (newJourney.departure.platform && !existing.departure.platform) {
      existing.departure = { ...existing.departure, ...newJourney.departure };
    }
  }

  // Update arrival if new source is authoritative for destination
  if (destProvider?.id === newSource) {
    if (newJourney.arrival.platform && !existing.arrival.platform) {
      existing.arrival = { ...existing.arrival, ...newJourney.arrival };
    }
  }

  // Use more complete stops list
  if (newJourney.stops.length > existing.stops.length) {
    existing.stops = newJourney.stops;
  } else {
    // Merge platform info into existing stops
    for (const newStop of newJourney.stops) {
      const matchingStop = existing.stops.find(
        (s) =>
          s.station.name.toLowerCase() === newStop.station.name.toLowerCase()
      );
      if (matchingStop && !matchingStop.platform && newStop.platform) {
        matchingStop.platform = newStop.platform;
        matchingStop.plannedPlatform = newStop.plannedPlatform;
        matchingStop.actualPlatform = newStop.actualPlatform;
      }
    }
  }

  // Use latest realtime data
  if (newJourney.status !== "scheduled" && existing.status === "scheduled") {
    existing.status = newJourney.status;
  }
}

// =============================================================================
// Conversion Helpers
// =============================================================================

/**
 * Convert merged journey data to storage input format.
 */
function toStoredJourneyInput(
  merged: MergedJourneyData,
  fromStation: UnifiedStation,
  toStation: UnifiedStation
): StoredJourneyInput {
  const journeyKey = generateJourneyKey(
    merged.trainType,
    merged.trainNumber,
    fromStation.id,
    merged.departure.scheduledDeparture ?? new Date().toISOString()
  );

  const stops: Omit<StoredJourneyStop, "id" | "journeyId">[] = merged.stops.map(
    (stop, index) => ({
      sequence: index,
      stationId: stop.station.code || stop.station.name.toLowerCase().replace(/\s+/g, "-"),
      stationName: stop.station.name,
      country: stop.station.country || "XX",
      scheduledArrival: stop.scheduledArrival,
      scheduledDeparture: stop.scheduledDeparture,
      arrivalDelayMin: stop.arrivalDelay,
      departureDelayMin: stop.departureDelay,
      plannedPlatform: stop.plannedPlatform,
      actualPlatform: stop.actualPlatform,
      source: merged.sources[0] as ApiSource,
      cancelled: stop.cancelled ?? false,
    })
  );

  return {
    journeyKey,
    trainNumber: merged.trainNumber,
    trainType: merged.trainType,
    operator: merged.operator,
    originStationId: fromStation.id,
    originStationName: fromStation.displayName,
    destinationStationId: toStation.id,
    destinationStationName: toStation.displayName,
    scheduledDeparture:
      merged.departure.scheduledDeparture ?? new Date().toISOString(),
    scheduledArrival: merged.arrival.scheduledArrival,
    durationMinutes: merged.duration,
    status: merged.status,
    sources: merged.sources as ApiSource[],
    nsRawId: merged.nsRawId,
    dbRawId: merged.dbRawId,
    stops,
  };
}

// =============================================================================
// Re-exports for Backward Compatibility
// =============================================================================

export { STATION_REGISTRY, type UnifiedStation } from "../data/stationRegistry";
export { findStationIdByAlias } from "../data/stationAliases";
