import type { Journey, JourneySearchParams, Station } from "../../types/train";
import type { UnifiedStation } from "../../data/stationRegistry";
import type { CountryCode, ProviderID, TrainProvider } from "./types";
import * as sbbApi from "../sbbApi";

class SBBProvider implements TrainProvider {
  readonly id: ProviderID = "SBB";
  readonly country: CountryCode = "CH";
  readonly name = "Swiss Federal Railways";

  async searchStations(query: string): Promise<Station[]> {
    console.log(`[SBBProvider] Searching stations: "${query}"`);
    return sbbApi.searchStations(query);
  }

  async searchJourneys(params: JourneySearchParams): Promise<Journey[]> {
    console.log(
      `[SBBProvider] Searching journeys: ${params.from} → ${params.to}`
    );
    return sbbApi.searchJourneys(params);
  }

  async getJourneyDetails(journeyId: string): Promise<Journey | null> {
    console.log(`[SBBProvider] Getting journey details: ${journeyId}`);
    return sbbApi.getJourneyDetails(journeyId);
  }

  toProviderStationId(station: UnifiedStation): string | null {
    return station.providerIds.SBB ?? null;
  }

  canHandleStation(station: UnifiedStation): boolean {
    return station.providerIds.SBB !== undefined;
  }
}

export const sbbProvider = new SBBProvider();
