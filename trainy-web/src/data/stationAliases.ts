// =============================================================================
// Station Aliases
// =============================================================================
// Human-friendly aliases mapping to station registry IDs.
// Allows users to search with common names, abbreviations, etc.

/**
 * Maps common search terms to station registry IDs
 */
export const STATION_ALIASES: Record<string, string> = {
  // ---------------------------------------------------------------------------
  // Amsterdam
  // ---------------------------------------------------------------------------
  amsterdam: "amsterdam-centraal",
  "amsterdam centraal": "amsterdam-centraal",
  "amsterdam central": "amsterdam-centraal",
  "amsterdam cs": "amsterdam-centraal",
  asd: "amsterdam-centraal",

  "amsterdam zuid": "amsterdam-zuid",
  "amsterdam south": "amsterdam-zuid",

  // ---------------------------------------------------------------------------
  // Utrecht
  // ---------------------------------------------------------------------------
  utrecht: "utrecht-centraal",
  "utrecht centraal": "utrecht-centraal",
  "utrecht central": "utrecht-centraal",
  "utrecht cs": "utrecht-centraal",

  // ---------------------------------------------------------------------------
  // Rotterdam
  // ---------------------------------------------------------------------------
  rotterdam: "rotterdam-centraal",
  "rotterdam centraal": "rotterdam-centraal",
  "rotterdam central": "rotterdam-centraal",
  "rotterdam cs": "rotterdam-centraal",

  // ---------------------------------------------------------------------------
  // Den Haag / The Hague
  // ---------------------------------------------------------------------------
  "den haag": "den-haag-centraal",
  "den haag centraal": "den-haag-centraal",
  "the hague": "den-haag-centraal",
  "the hague central": "den-haag-centraal",

  // ---------------------------------------------------------------------------
  // Arnhem
  // ---------------------------------------------------------------------------
  arnhem: "arnhem-centraal",
  "arnhem centraal": "arnhem-centraal",
  "arnhem central": "arnhem-centraal",

  // ---------------------------------------------------------------------------
  // Schiphol
  // ---------------------------------------------------------------------------
  schiphol: "schiphol-airport",
  "schiphol airport": "schiphol-airport",

  // ---------------------------------------------------------------------------
  // Eindhoven
  // ---------------------------------------------------------------------------
  eindhoven: "eindhoven-centraal",
  "eindhoven centraal": "eindhoven-centraal",

  // ---------------------------------------------------------------------------
  // Frankfurt
  // ---------------------------------------------------------------------------
  frankfurt: "frankfurt-hbf",
  "frankfurt hbf": "frankfurt-hbf",
  "frankfurt main": "frankfurt-hbf",
  "frankfurt am main": "frankfurt-hbf",
  "frankfurt (main) hbf": "frankfurt-hbf",
  "frankfurt(main)hbf": "frankfurt-hbf",

  // ---------------------------------------------------------------------------
  // Köln / Cologne
  // ---------------------------------------------------------------------------
  köln: "koln-hbf",
  koln: "koln-hbf",
  cologne: "koln-hbf",
  "köln hbf": "koln-hbf",
  "koln hbf": "koln-hbf",
  "cologne hbf": "koln-hbf",

  // ---------------------------------------------------------------------------
  // Düsseldorf
  // ---------------------------------------------------------------------------
  düsseldorf: "dusseldorf-hbf",
  dusseldorf: "dusseldorf-hbf",
  "düsseldorf hbf": "dusseldorf-hbf",
  "dusseldorf hbf": "dusseldorf-hbf",

  // ---------------------------------------------------------------------------
  // Duisburg
  // ---------------------------------------------------------------------------
  duisburg: "duisburg-hbf",
  "duisburg hbf": "duisburg-hbf",

  // ---------------------------------------------------------------------------
  // Essen
  // ---------------------------------------------------------------------------
  essen: "essen-hbf",
  "essen hbf": "essen-hbf",

  // ---------------------------------------------------------------------------
  // Dortmund
  // ---------------------------------------------------------------------------
  dortmund: "dortmund-hbf",
  "dortmund hbf": "dortmund-hbf",

  // ---------------------------------------------------------------------------
  // Berlin
  // ---------------------------------------------------------------------------
  berlin: "berlin-hbf",
  "berlin hbf": "berlin-hbf",
  "berlin hauptbahnhof": "berlin-hbf",

  // ---------------------------------------------------------------------------
  // München / Munich
  // ---------------------------------------------------------------------------
  münchen: "munchen-hbf",
  munchen: "munchen-hbf",
  munich: "munchen-hbf",
  "münchen hbf": "munchen-hbf",
  "munchen hbf": "munchen-hbf",
  "munich hbf": "munchen-hbf",

  // ---------------------------------------------------------------------------
  // Hamburg
  // ---------------------------------------------------------------------------
  hamburg: "hamburg-hbf",
  "hamburg hbf": "hamburg-hbf",

  // ---------------------------------------------------------------------------
  // Hannover
  // ---------------------------------------------------------------------------
  hannover: "hannover-hbf",
  hanover: "hannover-hbf",
  "hannover hbf": "hannover-hbf",

  // ---------------------------------------------------------------------------
  // Other German stations
  // ---------------------------------------------------------------------------
  oberhausen: "oberhausen-hbf",
  "oberhausen hbf": "oberhausen-hbf",
  emmerich: "emmerich",

  // ---------------------------------------------------------------------------
  // Paris
  // ---------------------------------------------------------------------------
  "paris nord": "paris-nord",
  "paris gare du nord": "paris-nord",
  "gare du nord": "paris-nord",

  "paris est": "paris-est",
  "paris gare de l'est": "paris-est",
  "gare de l'est": "paris-est",

  // ---------------------------------------------------------------------------
  // Belgium
  // ---------------------------------------------------------------------------
  bruxelles: "bruxelles-midi",
  brussels: "bruxelles-midi",
  brussel: "bruxelles-midi",
  "bruxelles midi": "bruxelles-midi",
  "brussel zuid": "bruxelles-midi",
  "brussels south": "bruxelles-midi",
  "brussels midi": "bruxelles-midi",

  antwerpen: "antwerpen-centraal",
  antwerp: "antwerpen-centraal",
  "antwerpen centraal": "antwerpen-centraal",
  "antwerp central": "antwerpen-centraal",
};

/**
 * Find a station ID from an alias
 */
export function findStationIdByAlias(query: string): string | null {
  const normalized = query.toLowerCase().trim();
  return STATION_ALIASES[normalized] ?? null;
}

/**
 * Get all aliases for a station ID
 */
export function getAliasesForStation(stationId: string): string[] {
  return Object.entries(STATION_ALIASES)
    .filter(([, id]) => id === stationId)
    .map(([alias]) => alias);
}
