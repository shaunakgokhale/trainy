// =============================================================================
// Provider Registry
// =============================================================================
// Central registry for all train API providers.
// Provides helpers to get providers by ID or country.

import type { TrainProvider, ProviderID, CountryCode } from "./types";
import { nsProvider } from "./nsProvider";
import { dbProvider } from "./dbProvider";

// =============================================================================
// Provider Registry
// =============================================================================

/**
 * Registry of all available providers
 */
const PROVIDERS: Record<ProviderID, TrainProvider | null> = {
  NS: nsProvider,
  DB: dbProvider,
  SNCF: null, // Future implementation
  OBB: null, // Future implementation
  SBB: null, // Future implementation
};

/**
 * Maps country codes to their primary provider ID
 */
const COUNTRY_PROVIDERS: Record<CountryCode, ProviderID> = {
  NL: "NS",
  DE: "DB",
  FR: "SNCF",
  AT: "OBB",
  CH: "SBB",
  BE: "NS", // Belgium often served by NS for international routes
};

// =============================================================================
// Registry Functions
// =============================================================================

/**
 * Get a provider by its ID
 * @param id - Provider ID (NS, DB, etc.)
 * @returns Provider instance or null if not implemented
 */
export function getProvider(id: ProviderID): TrainProvider | null {
  return PROVIDERS[id];
}

/**
 * Get the primary provider for a country
 * @param country - Country code
 * @returns Provider instance or null if country's provider not implemented
 */
export function getProviderForCountry(country: CountryCode): TrainProvider | null {
  const providerId = COUNTRY_PROVIDERS[country];
  return PROVIDERS[providerId];
}

/**
 * Get all active (implemented) providers
 */
export function getActiveProviders(): TrainProvider[] {
  return Object.values(PROVIDERS).filter(
    (p): p is TrainProvider => p !== null
  );
}

/**
 * Check if a provider is implemented
 */
export function isProviderActive(id: ProviderID): boolean {
  return PROVIDERS[id] !== null;
}

/**
 * Get the provider ID for a country
 */
export function getProviderIdForCountry(country: CountryCode): ProviderID {
  return COUNTRY_PROVIDERS[country];
}

/**
 * Get providers that can handle a specific station
 * (have a station ID mapping for that station)
 */
export function getProvidersForStation(
  stationProviderIds: Partial<Record<ProviderID, string>>
): TrainProvider[] {
  return getActiveProviders().filter(
    (provider) => stationProviderIds[provider.id] !== undefined
  );
}

// =============================================================================
// Re-exports
// =============================================================================

export { nsProvider } from "./nsProvider";
export { dbProvider } from "./dbProvider";
export * from "./types";
