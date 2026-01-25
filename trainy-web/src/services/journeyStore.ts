// =============================================================================
// Journey Store
// =============================================================================
// Supabase persistence layer for storing and retrieving journey data.
// Handles storage of merged journey data from multiple API sources.

import { supabase, isSupabaseConfigured } from "./supabase";
import type { JourneyRow, JourneyInsert, JourneyStopRow, JourneyStopInsert } from "../types/database";
import type { StoredJourney, StoredJourneyStop, StoredJourneyInput, JourneyStatus, ApiSource } from "../types/train";

const getTimestamp = () => new Date().toISOString();

const logInfo = (message: string, data?: unknown) => {
  console.log(`[JourneyStore][${getTimestamp()}] ${message}`, data ?? "");
};

const logError = (message: string, error: unknown) => {
  console.error(`[JourneyStore][${getTimestamp()}] ${message}`, error);
};

// =============================================================================
// Type Converters
// =============================================================================

/**
 * Convert database row to StoredJourney type
 */
function rowToStoredJourney(row: JourneyRow, stops: JourneyStopRow[]): StoredJourney {
  return {
    id: row.id,
    journeyKey: row.journey_key,
    trainNumber: row.train_number,
    trainType: row.train_type,
    operator: row.operator,
    originStationId: row.origin_station_id,
    originStationName: row.origin_station_name,
    destinationStationId: row.destination_station_id,
    destinationStationName: row.destination_station_name,
    scheduledDeparture: row.scheduled_departure,
    scheduledArrival: row.scheduled_arrival ?? undefined,
    durationMinutes: row.duration_minutes,
    status: row.status as JourneyStatus,
    sources: row.sources as ApiSource[],
    nsRawId: row.ns_raw_id ?? undefined,
    dbRawId: row.db_raw_id ?? undefined,
    sbbRawId: row.sbb_raw_id ?? undefined,
    stops: stops.map(rowToStoredJourneyStop).sort((a, b) => a.sequence - b.sequence),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Convert database row to StoredJourneyStop type
 */
function rowToStoredJourneyStop(row: JourneyStopRow): StoredJourneyStop {
  return {
    id: row.id,
    journeyId: row.journey_id,
    sequence: row.sequence,
    stationId: row.station_id,
    stationName: row.station_name,
    country: row.country,
    scheduledArrival: row.scheduled_arrival ?? undefined,
    scheduledDeparture: row.scheduled_departure ?? undefined,
    arrivalDelayMin: row.arrival_delay_min ?? undefined,
    departureDelayMin: row.departure_delay_min ?? undefined,
    plannedPlatform: row.planned_platform ?? undefined,
    actualPlatform: row.actual_platform ?? undefined,
    source: row.source as ApiSource,
    cancelled: row.cancelled,
  };
}

/**
 * Convert StoredJourneyInput to database insert format
 */
function inputToJourneyInsert(input: StoredJourneyInput): JourneyInsert {
  return {
    journey_key: input.journeyKey,
    train_number: input.trainNumber,
    train_type: input.trainType,
    operator: input.operator,
    origin_station_id: input.originStationId,
    origin_station_name: input.originStationName,
    destination_station_id: input.destinationStationId,
    destination_station_name: input.destinationStationName,
    scheduled_departure: input.scheduledDeparture,
    scheduled_arrival: input.scheduledArrival ?? null,
    duration_minutes: input.durationMinutes,
    status: input.status,
    sources: input.sources,
    ns_raw_id: input.nsRawId ?? null,
    db_raw_id: input.dbRawId ?? null,
    sbb_raw_id: input.sbbRawId ?? null,
  };
}

/**
 * Convert stop input to database insert format
 */
function inputToStopInsert(
  stop: Omit<StoredJourneyStop, "id" | "journeyId">,
  journeyId: string
): JourneyStopInsert {
  return {
    journey_id: journeyId,
    sequence: stop.sequence,
    station_id: stop.stationId,
    station_name: stop.stationName,
    country: stop.country,
    scheduled_arrival: stop.scheduledArrival ?? null,
    scheduled_departure: stop.scheduledDeparture ?? null,
    arrival_delay_min: stop.arrivalDelayMin ?? null,
    departure_delay_min: stop.departureDelayMin ?? null,
    planned_platform: stop.plannedPlatform ?? null,
    actual_platform: stop.actualPlatform ?? null,
    source: stop.source,
    cancelled: stop.cancelled,
  };
}

// =============================================================================
// CRUD Operations
// =============================================================================

/**
 * Store a new journey or update if it already exists
 * Uses journey_key for upsert logic
 */
export async function storeJourney(input: StoredJourneyInput): Promise<StoredJourney | null> {
  console.log(">>> storeJourney START:", input.journeyKey);
  
  if (!isSupabaseConfigured()) {
    console.error(">>> storeJourney: Supabase NOT configured!");
    logError("Supabase not configured, skipping store", null);
    return null;
  }

  logInfo("Storing journey", { journeyKey: input.journeyKey });

  try {
    // Check if journey already exists
    console.log(">>> Checking if journey exists...");
    const existing = await findJourneyByKey(input.journeyKey);
    console.log(">>> findJourneyByKey result:", existing ? "EXISTS" : "NOT FOUND");
    
    if (existing) {
      logInfo("Journey exists, updating", { id: existing.id });
      const updated = await updateJourney(existing.id, input);
      console.log(">>> updateJourney result:", updated ? "SUCCESS" : "NULL");
      return updated;
    }

    // Insert new journey
    const journeyInsert = inputToJourneyInsert(input);
    console.log(">>> Inserting new journey:", journeyInsert.journey_key);
    logInfo("Attempting journey insert", {
      journey_key: journeyInsert.journey_key,
      train_number: journeyInsert.train_number,
      origin: journeyInsert.origin_station_id,
      destination: journeyInsert.destination_station_id,
      sources: journeyInsert.sources,
    });
    
    const { data: journeyRow, error: journeyError } = await supabase
      .from("journeys")
      .insert(journeyInsert)
      .select()
      .single();

    if (journeyError) {
      console.error(">>> INSERT FAILED:", journeyError.code, journeyError.message);
      logError("Failed to insert journey", {
        error: journeyError,
        code: journeyError.code,
        message: journeyError.message,
        details: journeyError.details,
        hint: journeyError.hint,
        journeyKey: journeyInsert.journey_key,
      });
      throw journeyError;
    }

    console.log(">>> Journey inserted with ID:", journeyRow.id);
    logInfo("Journey inserted", { id: journeyRow.id });

    // Insert stops
    if (input.stops.length > 0) {
      console.log(">>> Inserting", input.stops.length, "stops...");
      const stopsInsert = input.stops.map((stop) =>
        inputToStopInsert(stop, journeyRow.id)
      );

      const { error: stopsError } = await supabase
        .from("journey_stops")
        .insert(stopsInsert);

      if (stopsError) {
        console.error(">>> Stops insert FAILED:", stopsError);
        logError("Failed to insert stops", stopsError);
        // Don't fail the whole operation, journey was created
      } else {
        console.log(">>> Stops inserted successfully");
      }
    }

    // Fetch and return the complete journey
    console.log(">>> Fetching complete journey by ID...");
    const result = await getJourneyById(journeyRow.id);
    console.log(">>> getJourneyById result:", result ? "SUCCESS" : "NULL");
    return result;
  } catch (error) {
    console.error("❌ storeJourney FAILED for", input.journeyKey, error);
    logError("storeJourney failed", error);
    return null;
  }
}

/**
 * Store multiple journeys in batch
 */
export async function storeJourneys(inputs: StoredJourneyInput[]): Promise<StoredJourney[]> {
  if (!isSupabaseConfigured()) {
    console.error("❌ SUPABASE NOT CONFIGURED! Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local");
    logError("Supabase not configured, skipping batch store", null);
    return [];
  }

  console.log("✅ Supabase is configured, attempting to store", inputs.length, "journeys");
  logInfo("Storing journeys batch", { 
    count: inputs.length,
    journeyKeys: inputs.map(i => i.journeyKey),
  });

  const results: StoredJourney[] = [];

  // Process in parallel with Promise.allSettled
  const promises = inputs.map((input) => storeJourney(input));
  const settled = await Promise.allSettled(promises);

  for (let i = 0; i < settled.length; i++) {
    const result = settled[i];
    if (result.status === "fulfilled" && result.value) {
      results.push(result.value);
    } else if (result.status === "rejected") {
      logError(`Journey ${i} storage rejected`, result.reason);
    } else if (result.status === "fulfilled" && !result.value) {
      logError(`Journey ${i} storage returned null`, { journeyKey: inputs[i].journeyKey });
    }
  }

  logInfo("Batch store complete", { 
    stored: results.length, 
    total: inputs.length,
    failed: inputs.length - results.length,
  });
  return results;
}

/**
 * Find a journey by its unique key
 */
export async function findJourneyByKey(journeyKey: string): Promise<StoredJourney | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  logInfo("Finding journey by key", { journeyKey });

  try {
    // Use maybeSingle() instead of single() to avoid 406 error when no rows exist
    const { data: journeyRow, error } = await supabase
      .from("journeys")
      .select("*")
      .eq("journey_key", journeyKey)
      .maybeSingle();

    if (error) {
      logError("Failed to find journey", error);
      return null;
    }

    if (!journeyRow) {
      // No journey found with this key
      return null;
    }

    // Fetch stops
    const { data: stopRows } = await supabase
      .from("journey_stops")
      .select("*")
      .eq("journey_id", journeyRow.id)
      .order("sequence");

    return rowToStoredJourney(journeyRow, stopRows ?? []);
  } catch (error) {
    logError("findJourneyByKey failed", error);
    return null;
  }
}

/**
 * Get a journey by its database ID
 */
export async function getJourneyById(id: string): Promise<StoredJourney | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  logInfo("Getting journey by ID", { id });

  try {
    const { data: journeyRow, error } = await supabase
      .from("journeys")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      logError("Failed to get journey", error);
      return null;
    }

    if (!journeyRow) {
      logError("Journey not found", { id });
      return null;
    }

    // Fetch stops
    const { data: stopRows } = await supabase
      .from("journey_stops")
      .select("*")
      .eq("journey_id", id)
      .order("sequence");

    return rowToStoredJourney(journeyRow, stopRows ?? []);
  } catch (error) {
    logError("getJourneyById failed", error);
    return null;
  }
}

/**
 * Update an existing journey
 */
export async function updateJourney(
  id: string,
  input: StoredJourneyInput
): Promise<StoredJourney | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  logInfo("Updating journey", { id });

  try {
    const journeyUpdate = inputToJourneyInsert(input);

    const { error: journeyError } = await supabase
      .from("journeys")
      .update(journeyUpdate)
      .eq("id", id);

    if (journeyError) {
      logError("Failed to update journey", journeyError);
      throw journeyError;
    }

    // Delete existing stops and re-insert
    await supabase.from("journey_stops").delete().eq("journey_id", id);

    if (input.stops.length > 0) {
      const stopsInsert = input.stops.map((stop) => inputToStopInsert(stop, id));
      await supabase.from("journey_stops").insert(stopsInsert);
    }

    return getJourneyById(id);
  } catch (error) {
    logError("updateJourney failed", error);
    return null;
  }
}

/**
 * Update realtime data for a journey (delays, platforms)
 */
export async function updateJourneyRealtime(
  id: string,
  updates: {
    status?: JourneyStatus;
    stops?: Array<{
      sequence: number;
      arrivalDelayMin?: number;
      departureDelayMin?: number;
      actualPlatform?: string;
      cancelled?: boolean;
    }>;
  }
): Promise<StoredJourney | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  logInfo("Updating journey realtime data", { id });

  try {
    // Update journey status if provided
    if (updates.status) {
      await supabase
        .from("journeys")
        .update({ status: updates.status })
        .eq("id", id);
    }

    // Update stops if provided
    if (updates.stops) {
      for (const stopUpdate of updates.stops) {
        await supabase
          .from("journey_stops")
          .update({
            arrival_delay_min: stopUpdate.arrivalDelayMin ?? null,
            departure_delay_min: stopUpdate.departureDelayMin ?? null,
            actual_platform: stopUpdate.actualPlatform ?? null,
            cancelled: stopUpdate.cancelled ?? false,
          })
          .eq("journey_id", id)
          .eq("sequence", stopUpdate.sequence);
      }
    }

    return getJourneyById(id);
  } catch (error) {
    logError("updateJourneyRealtime failed", error);
    return null;
  }
}

/**
 * Get cached journeys by route (origin + destination + date range)
 * This is the primary cache lookup function for avoiding redundant API calls
 */
export async function getJourneysByRoute(
  originStationId: string,
  destinationStationId: string,
  dateTime: string,
  timeWindowHours = 12,
  limit = 20
): Promise<StoredJourney[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  logInfo("Cache lookup: searching for cached journeys", {
    origin: originStationId,
    destination: destinationStationId,
    dateTime,
    timeWindowHours,
  });

  try {
    // Calculate time range for cache lookup
    const searchDate = new Date(dateTime);
    const startTime = new Date(searchDate.getTime() - timeWindowHours * 60 * 60 * 1000);
    const endTime = new Date(searchDate.getTime() + timeWindowHours * 60 * 60 * 1000);

    const { data: journeyRows, error } = await supabase
      .from("journeys")
      .select("*")
      .eq("origin_station_id", originStationId)
      .eq("destination_station_id", destinationStationId)
      .gte("scheduled_departure", startTime.toISOString())
      .lte("scheduled_departure", endTime.toISOString())
      .order("scheduled_departure", { ascending: true })
      .limit(limit);

    if (error) {
      logError("Cache lookup failed", error);
      return [];
    }

    if (journeyRows.length === 0) {
      logInfo("Cache miss: no cached journeys found");
      return [];
    }

    logInfo("Cache hit: found cached journeys", { count: journeyRows.length });

    // Fetch stops for all journeys
    const journeyIds = journeyRows.map((j) => j.id);
    const { data: allStops } = await supabase
      .from("journey_stops")
      .select("*")
      .in("journey_id", journeyIds);

    // Group stops by journey
    const stopsByJourney = new Map<string, JourneyStopRow[]>();
    for (const stop of allStops ?? []) {
      const existing = stopsByJourney.get(stop.journey_id) ?? [];
      existing.push(stop);
      stopsByJourney.set(stop.journey_id, existing);
    }

    return journeyRows.map((row) =>
      rowToStoredJourney(row, stopsByJourney.get(row.id) ?? [])
    );
  } catch (error) {
    logError("getJourneysByRoute failed", error);
    return [];
  }
}

/**
 * Get journeys by origin station
 */
export async function getJourneysByOrigin(
  originStationId: string,
  limit = 20
): Promise<StoredJourney[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const { data: journeyRows, error } = await supabase
      .from("journeys")
      .select("*")
      .eq("origin_station_id", originStationId)
      .order("scheduled_departure", { ascending: true })
      .limit(limit);

    if (error) {
      logError("Failed to get journeys by origin", error);
      return [];
    }

    // Fetch stops for all journeys
    const journeyIds = journeyRows.map((j) => j.id);
    const { data: allStops } = await supabase
      .from("journey_stops")
      .select("*")
      .in("journey_id", journeyIds);

    // Group stops by journey
    const stopsByJourney = new Map<string, JourneyStopRow[]>();
    for (const stop of allStops ?? []) {
      const existing = stopsByJourney.get(stop.journey_id) ?? [];
      existing.push(stop);
      stopsByJourney.set(stop.journey_id, existing);
    }

    return journeyRows.map((row) =>
      rowToStoredJourney(row, stopsByJourney.get(row.id) ?? [])
    );
  } catch (error) {
    logError("getJourneysByOrigin failed", error);
    return [];
  }
}

/**
 * Delete a journey
 */
export async function deleteJourney(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  logInfo("Deleting journey", { id });

  try {
    const { error } = await supabase.from("journeys").delete().eq("id", id);

    if (error) {
      logError("Failed to delete journey", error);
      return false;
    }

    return true;
  } catch (error) {
    logError("deleteJourney failed", error);
    return false;
  }
}
