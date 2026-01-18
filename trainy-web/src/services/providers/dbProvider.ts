// =============================================================================
// DB Provider
// =============================================================================
// Wraps the DB API (Germany) to implement the TrainProvider interface.

import type { Journey, JourneySearchParams, Station } from "../../types/train";
import type { UnifiedStation } from "../../data/stationRegistry";
import type { TrainProvider, ProviderID, CountryCode } from "./types";
import * as dbApi from "../dbApi";

// =============================================================================
// DB Provider Implementation
// =============================================================================

class DBProvider implements TrainProvider {
  readonly id: ProviderID = "DB";
  readonly country: CountryCode = "DE";
  readonly name = "Deutsche Bahn";

  /**
   * Search for stations using DB Timetables API
   */
  async searchStations(query: string): Promise<Station[]> {
    console.log(`[DBProvider] Searching stations: "${query}"`);
    return dbApi.searchStations(query);
  }

  /**
   * Search for journeys using DB API
   * Note: DB API requires EVA numbers for station IDs
   */
  async searchJourneys(params: JourneySearchParams): Promise<Journey[]> {
    console.log(`[DBProvider] Searching journeys: ${params.from} → ${params.to}`);
    return dbApi.searchJourneys(params);
  }

  /**
   * Get journey details using DB RIS::Journeys API
   */
  async getJourneyDetails(journeyId: string): Promise<Journey | null> {
    console.log(`[DBProvider] Getting journey details: ${journeyId}`);
    return dbApi.getJourneyDetails(journeyId);
  }

  /**
   * Convert unified station to DB station identifier (EVA number)
   */
  toProviderStationId(station: UnifiedStation): string | null {
    return station.providerIds.DB ?? null;
  }

  /**
   * Check if DB can handle this station
   */
  canHandleStation(station: UnifiedStation): boolean {
    return station.providerIds.DB !== undefined;
  }
}

// Export singleton instance
export const dbProvider = new DBProvider();
