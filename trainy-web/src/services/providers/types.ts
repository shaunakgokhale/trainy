// =============================================================================
// Train Provider Interface
// =============================================================================
// Unified interface that all country-specific API providers must implement.
// This enables a pluggable architecture for adding new train APIs.

import type { Journey, JourneySearchParams, Station } from "../../types/train";
import type { UnifiedStation } from "../../data/stationRegistry";

// =============================================================================
// Core Types
// =============================================================================

/** Provider identifiers for each supported train API */
export type ProviderID = "NS" | "DB" | "SNCF" | "OBB" | "SBB";

/** Country codes for provider routing */
export type CountryCode = "NL" | "DE" | "FR" | "AT" | "CH" | "BE";

// =============================================================================
// Provider Interface
// =============================================================================

/**
 * Unified interface for all train API providers.
 * Each country's API is wrapped in a provider that implements this interface.
 */
export interface TrainProvider {
  /** Unique identifier for this provider */
  readonly id: ProviderID;

  /** Primary country this provider serves */
  readonly country: CountryCode;

  /** Human-readable name for logging/UI */
  readonly name: string;

  /** Whether this provider accepts station names in searchJourneys */
  readonly supportsNameQuery?: boolean;

  /**
   * Search for stations by name query.
   * @param query - Search term (station name or partial name)
   * @returns Array of stations matching the query
   */
  searchStations(query: string): Promise<Station[]>;

  /**
   * Search for journeys between two stations.
   * @param params - Search parameters including from, to, and dateTime
   * @returns Array of journeys matching the search
   */
  searchJourneys(params: JourneySearchParams): Promise<Journey[]>;

  /**
   * Get detailed journey information including all stops.
   * @param journeyId - Provider-specific journey identifier
   * @returns Journey with full stop details, or null if not found
   */
  getJourneyDetails(journeyId: string): Promise<Journey | null>;

  /**
   * Convert a unified station to this provider's station identifier.
   * Returns null if the station doesn't have an ID for this provider.
   * @param station - Unified station from the registry
   * @returns Provider-specific station ID or null
   */
  toProviderStationId(station: UnifiedStation): string | null;

  /**
   * Check if this provider can handle a station (has a provider ID for it).
   * @param station - Unified station to check
   */
  canHandleStation(station: UnifiedStation): boolean;
}

// =============================================================================
// Provider Configuration
// =============================================================================

/**
 * Configuration for provider behavior
 */
export interface ProviderConfig {
  /** Maximum number of retries for failed requests */
  maxRetries?: number;
  /** Timeout in milliseconds for API requests */
  timeoutMs?: number;
  /** Whether to log API requests/responses */
  enableLogging?: boolean;
}

/**
 * Result of a provider API call with metadata
 */
export interface ProviderResult<T> {
  data: T;
  source: ProviderID;
  timestamp: string;
  cached?: boolean;
}

// =============================================================================
// Provider Error Types
// =============================================================================

/**
 * Error thrown by providers with additional context
 */
export class ProviderError extends Error {
  public readonly provider: ProviderID;
  public readonly code?: string;
  public readonly originalError?: unknown;

  constructor(
    message: string,
    provider: ProviderID,
    code?: string,
    originalError?: unknown
  ) {
    super(`[${provider}] ${message}`);
    this.name = "ProviderError";
    this.provider = provider;
    this.code = code;
    this.originalError = originalError;
  }
}

// =============================================================================
// Country to Provider Mapping
// =============================================================================

/**
 * Maps country codes to their primary provider
 */
export const COUNTRY_TO_PROVIDER: Record<CountryCode, ProviderID> = {
  NL: "NS",
  DE: "DB",
  FR: "SNCF",
  AT: "OBB",
  CH: "SBB",
  BE: "NS", // Belgium is often served by NS for international routes
};

/**
 * Get the primary provider for a country
 */
export function getProviderForCountry(country: CountryCode): ProviderID {
  return COUNTRY_TO_PROVIDER[country];
}
