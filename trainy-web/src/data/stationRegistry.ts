// =============================================================================
// Station Registry
// =============================================================================
// Code-driven station mappings with cross-API identifiers for core stations.
// This provides fast lookups and explicit control over station mappings.

import type { ProviderID, CountryCode } from "../services/providers/types";

// =============================================================================
// Types
// =============================================================================

export interface UnifiedStation {
  /** Internal unique ID, e.g., "amsterdam-centraal" */
  id: string;
  /** Display name for UI, e.g., "Amsterdam Centraal" */
  displayName: string;
  /** Country code */
  country: CountryCode;
  /** Coordinates for mapping */
  coordinates?: { lat: number; lng: number };
  /** Provider-specific station identifiers */
  providerIds: Partial<Record<ProviderID, string>>;
}

// =============================================================================
// Station Registry
// =============================================================================
// Core stations across NL and DE with their API-specific identifiers

export const STATION_REGISTRY: Record<string, UnifiedStation> = {
  // ---------------------------------------------------------------------------
  // Netherlands (NL)
  // ---------------------------------------------------------------------------
  "amsterdam-centraal": {
    id: "amsterdam-centraal",
    displayName: "Amsterdam Centraal",
    country: "NL",
    coordinates: { lat: 52.3791, lng: 4.9003 },
    providerIds: {
      NS: "ASD",
      DB: "8400058",
      SBB: "8400058",
    },
  },
  "amsterdam-zuid": {
    id: "amsterdam-zuid",
    displayName: "Amsterdam Zuid",
    country: "NL",
    coordinates: { lat: 52.3389, lng: 4.8728 },
    providerIds: {
      NS: "ASZ",
      DB: "8400061",
    },
  },
  "utrecht-centraal": {
    id: "utrecht-centraal",
    displayName: "Utrecht Centraal",
    country: "NL",
    coordinates: { lat: 52.0893, lng: 5.1101 },
    providerIds: {
      NS: "UT",
      DB: "8400621",
    },
  },
  "arnhem-centraal": {
    id: "arnhem-centraal",
    displayName: "Arnhem Centraal",
    country: "NL",
    coordinates: { lat: 51.9851, lng: 5.8987 },
    providerIds: {
      NS: "AH",
      DB: "8400071",
    },
  },
  "rotterdam-centraal": {
    id: "rotterdam-centraal",
    displayName: "Rotterdam Centraal",
    country: "NL",
    coordinates: { lat: 51.9244, lng: 4.4699 },
    providerIds: {
      NS: "RTD",
      DB: "8400530",
    },
  },
  "den-haag-centraal": {
    id: "den-haag-centraal",
    displayName: "Den Haag Centraal",
    country: "NL",
    coordinates: { lat: 52.0808, lng: 4.3247 },
    providerIds: {
      NS: "GVC",
      DB: "8400280",
    },
  },
  "schiphol-airport": {
    id: "schiphol-airport",
    displayName: "Schiphol Airport",
    country: "NL",
    coordinates: { lat: 52.3105, lng: 4.7613 },
    providerIds: {
      NS: "SHL",
      DB: "8400561",
    },
  },
  "eindhoven-centraal": {
    id: "eindhoven-centraal",
    displayName: "Eindhoven Centraal",
    country: "NL",
    coordinates: { lat: 51.4433, lng: 5.4811 },
    providerIds: {
      NS: "EHV",
      DB: "8400206",
    },
  },

  // ---------------------------------------------------------------------------
  // Germany (DE)
  // ---------------------------------------------------------------------------
  "frankfurt-hbf": {
    id: "frankfurt-hbf",
    displayName: "Frankfurt (Main) Hbf",
    country: "DE",
    coordinates: { lat: 50.1072, lng: 8.6637 },
    providerIds: {
      NS: "Frankfurt (Main) Hbf",
      DB: "8000105",
      SBB: "8011068",
    },
  },
  "koln-hbf": {
    id: "koln-hbf",
    displayName: "Köln Hbf",
    country: "DE",
    coordinates: { lat: 50.9431, lng: 6.9589 },
    providerIds: {
      NS: "Köln Hbf",
      DB: "8000207",
      SBB: "8015458",
    },
  },
  "dusseldorf-hbf": {
    id: "dusseldorf-hbf",
    displayName: "Düsseldorf Hbf",
    country: "DE",
    coordinates: { lat: 51.2200, lng: 6.7942 },
    providerIds: {
      NS: "Düsseldorf Hbf",
      DB: "8000085",
    },
  },
  "duisburg-hbf": {
    id: "duisburg-hbf",
    displayName: "Duisburg Hbf",
    country: "DE",
    coordinates: { lat: 51.4297, lng: 6.7756 },
    providerIds: {
      NS: "Duisburg Hbf",
      DB: "8000086",
    },
  },
  "essen-hbf": {
    id: "essen-hbf",
    displayName: "Essen Hbf",
    country: "DE",
    coordinates: { lat: 51.4513, lng: 7.0142 },
    providerIds: {
      NS: "Essen Hbf",
      DB: "8000098",
    },
  },
  "dortmund-hbf": {
    id: "dortmund-hbf",
    displayName: "Dortmund Hbf",
    country: "DE",
    coordinates: { lat: 51.5177, lng: 7.4591 },
    providerIds: {
      NS: "Dortmund Hbf",
      DB: "8000080",
    },
  },
  "berlin-hbf": {
    id: "berlin-hbf",
    displayName: "Berlin Hbf",
    country: "DE",
    coordinates: { lat: 52.5251, lng: 13.3694 },
    providerIds: {
      NS: "Berlin Hbf",
      DB: "8011160",
    },
  },
  "munchen-hbf": {
    id: "munchen-hbf",
    displayName: "München Hbf",
    country: "DE",
    coordinates: { lat: 48.1403, lng: 11.5601 },
    providerIds: {
      NS: "München Hbf",
      DB: "8000261",
      SBB: "8020347",
    },
  },
  "hamburg-hbf": {
    id: "hamburg-hbf",
    displayName: "Hamburg Hbf",
    country: "DE",
    coordinates: { lat: 53.5530, lng: 10.0066 },
    providerIds: {
      NS: "Hamburg Hbf",
      DB: "8002549",
    },
  },
  "hannover-hbf": {
    id: "hannover-hbf",
    displayName: "Hannover Hbf",
    country: "DE",
    coordinates: { lat: 52.3768, lng: 9.7417 },
    providerIds: {
      NS: "Hannover Hbf",
      DB: "8000152",
    },
  },
  "oberhausen-hbf": {
    id: "oberhausen-hbf",
    displayName: "Oberhausen Hbf",
    country: "DE",
    coordinates: { lat: 51.4728, lng: 6.8517 },
    providerIds: {
      NS: "Oberhausen Hbf",
      DB: "8000286",
    },
  },
  "emmerich": {
    id: "emmerich",
    displayName: "Emmerich",
    country: "DE",
    coordinates: { lat: 51.8314, lng: 6.2469 },
    providerIds: {
      NS: "Emmerich",
      DB: "8001843",
    },
  },

  // ---------------------------------------------------------------------------
  // Switzerland (CH)
  // ---------------------------------------------------------------------------
  "zurich-hb": {
    id: "zurich-hb",
    displayName: "Zürich HB",
    country: "CH",
    coordinates: { lat: 47.3779, lng: 8.5402 },
    providerIds: {
      NS: "ZUE",
      SBB: "8503000",
      DB: "8503000",
    },
  },
  "basel-sbb": {
    id: "basel-sbb",
    displayName: "Basel SBB",
    country: "CH",
    coordinates: { lat: 47.5474, lng: 7.5896 },
    providerIds: {
      NS: "BASELS",
      SBB: "8500010",
      DB: "8500010",
    },
  },
  "bern-hb": {
    id: "bern-hb",
    displayName: "Bern",
    country: "CH",
    coordinates: { lat: 46.9480, lng: 7.4474 },
    providerIds: {
      SBB: "8507000",
      DB: "8507000",
    },
  },
  "geneve-cornavin": {
    id: "geneve-cornavin",
    displayName: "Genève",
    country: "CH",
    coordinates: { lat: 46.2101, lng: 6.1423 },
    providerIds: {
      SBB: "8501008",
      DB: "8501008",
    },
  },
  "lausanne": {
    id: "lausanne",
    displayName: "Lausanne",
    country: "CH",
    coordinates: { lat: 46.5168, lng: 6.6291 },
    providerIds: {
      SBB: "8501120",
      DB: "8501120",
    },
  },
  "luzern": {
    id: "luzern",
    displayName: "Luzern",
    country: "CH",
    coordinates: { lat: 47.0502, lng: 8.3093 },
    providerIds: {
      SBB: "8505000",
      DB: "8505000",
    },
  },

  // ---------------------------------------------------------------------------
  // France (FR) - Stubs for future SNCF integration
  // ---------------------------------------------------------------------------
  "paris-nord": {
    id: "paris-nord",
    displayName: "Paris Gare du Nord",
    country: "FR",
    coordinates: { lat: 48.8809, lng: 2.3553 },
    providerIds: {
      // SNCF ID to be added
    },
  },
  "paris-est": {
    id: "paris-est",
    displayName: "Paris Gare de l'Est",
    country: "FR",
    coordinates: { lat: 48.8764, lng: 2.3594 },
    providerIds: {
      // SNCF ID to be added
    },
  },

  // ---------------------------------------------------------------------------
  // Belgium (BE) - Often on NL/DE international routes
  // ---------------------------------------------------------------------------
  "bruxelles-midi": {
    id: "bruxelles-midi",
    displayName: "Bruxelles-Midi / Brussel-Zuid",
    country: "BE",
    coordinates: { lat: 50.8358, lng: 4.3366 },
    providerIds: {
      NS: "Brussel-Zuid",
      DB: "8800004",
    },
  },
  "antwerpen-centraal": {
    id: "antwerpen-centraal",
    displayName: "Antwerpen-Centraal",
    country: "BE",
    coordinates: { lat: 51.2172, lng: 4.4211 },
    providerIds: {
      NS: "Antwerpen-Centraal",
      DB: "8800012",
    },
  },
};

// =============================================================================
// Lookup Helpers
// =============================================================================

/**
 * Find a station by its provider-specific ID
 */
export function findStationByProviderId(
  providerId: string,
  provider: ProviderID
): UnifiedStation | null {
  for (const station of Object.values(STATION_REGISTRY)) {
    if (station.providerIds[provider] === providerId) {
      return station;
    }
  }
  return null;
}

/**
 * Find stations matching a name (case-insensitive partial match)
 */
export function findStationsByName(query: string): UnifiedStation[] {
  const normalized = query.toLowerCase().trim();
  if (!normalized) return [];

  return Object.values(STATION_REGISTRY).filter((station) =>
    station.displayName.toLowerCase().includes(normalized)
  );
}

/**
 * Get a station by its registry ID
 */
export function getStationById(id: string): UnifiedStation | null {
  return STATION_REGISTRY[id] ?? null;
}

/**
 * Get all stations for a specific country
 */
export function getStationsForCountry(country: CountryCode): UnifiedStation[] {
  return Object.values(STATION_REGISTRY).filter(
    (station) => station.country === country
  );
}

/**
 * Get the provider-specific ID for a station
 */
export function getProviderStationId(
  station: UnifiedStation,
  provider: ProviderID
): string | null {
  return station.providerIds[provider] ?? null;
}

/**
 * Check if a station is in the registry
 */
export function isKnownStation(id: string): boolean {
  return id in STATION_REGISTRY;
}

/**
 * Get all stations in the registry
 */
export function getAllStations(): UnifiedStation[] {
  return Object.values(STATION_REGISTRY);
}
