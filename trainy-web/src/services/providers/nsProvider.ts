// =============================================================================
// NS Provider
// =============================================================================
// Wraps the NS API (Netherlands) to implement the TrainProvider interface.

import type { Journey, JourneySearchParams, Station } from "../../types/train";
import type { UnifiedStation } from "../../data/stationRegistry";
import type { TrainProvider, ProviderID, CountryCode } from "./types";
import * as nsApi from "../nsApi";

// =============================================================================
// NS Provider Implementation
// =============================================================================

class NSProvider implements TrainProvider {
  readonly id: ProviderID = "NS";
  readonly country: CountryCode = "NL";
  readonly name = "Nederlandse Spoorwegen";

  /**
   * Search for stations using NS API
   */
  async searchStations(query: string): Promise<Station[]> {
    console.log(`[NSProvider] Searching stations: "${query}"`);
    return nsApi.searchStations(query);
  }

  /**
   * Search for journeys using NS API
   */
  async searchJourneys(params: JourneySearchParams): Promise<Journey[]> {
    console.log(`[NSProvider] Searching journeys: ${params.from} → ${params.to}`);
    return nsApi.searchJourneys(params);
  }

  /**
   * Get journey details using NS API
   * Note: NS API uses train number + dateTime, not journey ID
   */
  async getJourneyDetails(journeyId: string): Promise<Journey | null> {
    console.log(`[NSProvider] Getting journey details: ${journeyId}`);
    
    // NS journey IDs are in format: "trainNumber_dateTime"
    const [trainNumber, dateTime] = journeyId.split("_");
    if (!trainNumber || !dateTime) {
      console.warn(`[NSProvider] Invalid journey ID format: ${journeyId}`);
      return null;
    }

    return nsApi.getJourneyDetails(trainNumber, dateTime);
  }

  /**
   * Convert unified station to NS station identifier
   */
  toProviderStationId(station: UnifiedStation): string | null {
    return station.providerIds.NS ?? null;
  }

  /**
   * Check if NS can handle this station
   */
  canHandleStation(station: UnifiedStation): boolean {
    return station.providerIds.NS !== undefined;
  }
}

// Export singleton instance
export const nsProvider = new NSProvider();
