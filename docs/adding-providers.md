# Adding New Country APIs to Trainy

This guide explains how to add support for new European rail APIs (SNCF, OBB, SBB, etc.) to Trainy.

## Overview

Adding a new provider requires 4 steps:

1. **Create the low-level API file** (`xxxApi.ts`)
2. **Create the provider adapter** (`xxxProvider.ts`)
3. **Register the provider** (in `providers/index.ts`)
4. **Add stations to the registry** (in `stationRegistry.ts`)

---

## Step 1: Create the Low-Level API File

Create `src/services/xxxApi.ts` (e.g., `sncfApi.ts`):

```typescript
// src/services/sncfApi.ts

import type { Journey, JourneySearchParams, Station } from "../types/train";

// =============================================================================
// SNCF API Service
// =============================================================================

const BASE_URL = "https://api.sncf.com/v1";

// Raw API response types (use SNCF* prefix)
type SNCFStationRaw = {
  id?: string;
  name?: string;
  // ... API-specific fields
};

type SNCFJourneyRaw = {
  // ... API-specific fields
};

// =============================================================================
// Authentication
// =============================================================================

const createHeaders = (): Headers => {
  const apiKey = import.meta.env.VITE_SNCF_API_KEY;
  if (!apiKey) {
    throw new Error("Missing VITE_SNCF_API_KEY");
  }
  
  const headers = new Headers();
  // SNCF uses Basic auth with API key as username
  headers.set("Authorization", `Basic ${btoa(apiKey + ":")}`);
  headers.set("Accept", "application/json");
  return headers;
};

// =============================================================================
// Mapping Functions
// =============================================================================

const mapStation = (raw: SNCFStationRaw): Station => ({
  code: raw.id ?? "",
  name: raw.name ?? "",
  country: "FR",
  // ... map other fields
});

const mapJourney = (raw: SNCFJourneyRaw): Journey => ({
  // ... map to standard Journey type
  apiSource: "SNCF",
});

// =============================================================================
// API Functions
// =============================================================================

export const searchStations = async (query: string): Promise<Station[]> => {
  console.log(`[SNCF API] Searching stations: "${query}"`);
  
  try {
    const url = new URL(`${BASE_URL}/coverage/sncf/places`);
    url.searchParams.set("q", query);
    url.searchParams.set("type[]", "stop_area");
    
    const response = await fetch(url.toString(), { headers: createHeaders() });
    const data = await response.json();
    
    console.log(`[SNCF API] Response:`, data);
    
    return data.places?.map(mapStation) ?? [];
  } catch (error) {
    console.error(`[SNCF API] searchStations error:`, error);
    throw new Error("Failed to search SNCF stations");
  }
};

export const searchJourneys = async (
  params: JourneySearchParams
): Promise<Journey[]> => {
  console.log(`[SNCF API] Searching journeys: ${params.from} → ${params.to}`);
  
  try {
    const url = new URL(`${BASE_URL}/coverage/sncf/journeys`);
    url.searchParams.set("from", params.from);
    url.searchParams.set("to", params.to);
    url.searchParams.set("datetime", params.dateTime);
    
    const response = await fetch(url.toString(), { headers: createHeaders() });
    const data = await response.json();
    
    return data.journeys?.map(mapJourney) ?? [];
  } catch (error) {
    console.error(`[SNCF API] searchJourneys error:`, error);
    throw new Error("Failed to search SNCF journeys");
  }
};

export const getJourneyDetails = async (
  journeyId: string
): Promise<Journey | null> => {
  // Implement based on SNCF API capabilities
  console.log(`[SNCF API] Getting journey details: ${journeyId}`);
  return null;
};
```

### Key Points

- Use provider-specific prefixes for raw types (`SNCF*`)
- Always set `apiSource: "SNCF"` when mapping to `Journey`
- Log all requests and responses for debugging
- Handle errors gracefully with try/catch

---

## Step 2: Create the Provider Adapter

Create `src/services/providers/sncfProvider.ts`:

```typescript
// src/services/providers/sncfProvider.ts

import type { Journey, JourneySearchParams, Station } from "../../types/train";
import type { UnifiedStation } from "../../data/stationRegistry";
import type { TrainProvider, ProviderID, CountryCode } from "./types";
import * as sncfApi from "../sncfApi";

class SNCFProvider implements TrainProvider {
  readonly id: ProviderID = "SNCF";
  readonly country: CountryCode = "FR";
  readonly name = "SNCF";

  async searchStations(query: string): Promise<Station[]> {
    console.log(`[SNCFProvider] Searching stations: "${query}"`);
    return sncfApi.searchStations(query);
  }

  async searchJourneys(params: JourneySearchParams): Promise<Journey[]> {
    console.log(`[SNCFProvider] Searching journeys: ${params.from} → ${params.to}`);
    return sncfApi.searchJourneys(params);
  }

  async getJourneyDetails(journeyId: string): Promise<Journey | null> {
    console.log(`[SNCFProvider] Getting journey details: ${journeyId}`);
    return sncfApi.getJourneyDetails(journeyId);
  }

  toProviderStationId(station: UnifiedStation): string | null {
    return station.providerIds.SNCF ?? null;
  }

  canHandleStation(station: UnifiedStation): boolean {
    return station.providerIds.SNCF !== undefined;
  }
}

export const sncfProvider = new SNCFProvider();
```

---

## Step 3: Register the Provider

Update `src/services/providers/index.ts`:

```typescript
import { nsProvider } from "./nsProvider";
import { dbProvider } from "./dbProvider";
import { sncfProvider } from "./sncfProvider";  // Add import

const PROVIDERS: Record<ProviderID, TrainProvider | null> = {
  NS: nsProvider,
  DB: dbProvider,
  SNCF: sncfProvider,  // Register provider
  OBB: null,
  SBB: null,
};

const COUNTRY_PROVIDERS: Record<CountryCode, ProviderID> = {
  NL: "NS",
  DE: "DB",
  FR: "SNCF",  // Map country to provider
  AT: "OBB",
  CH: "SBB",
  BE: "NS",
};
```

Also export the provider:

```typescript
export { nsProvider } from "./nsProvider";
export { dbProvider } from "./dbProvider";
export { sncfProvider } from "./sncfProvider";  // Add export
```

---

## Step 4: Add Stations to the Registry

Update `src/data/stationRegistry.ts`:

```typescript
// Add French stations
"paris-nord": {
  id: "paris-nord",
  displayName: "Paris Gare du Nord",
  country: "FR",
  coordinates: { lat: 48.8809, lng: 2.3553 },
  providerIds: {
    SNCF: "stop_area:SNCF:87271007",  // SNCF station ID
    DB: "8700011",                     // If DB has this station
  },
},
"paris-est": {
  id: "paris-est",
  displayName: "Paris Gare de l'Est",
  country: "FR",
  coordinates: { lat: 48.8764, lng: 2.3594 },
  providerIds: {
    SNCF: "stop_area:SNCF:87113001",
  },
},
"lyon-part-dieu": {
  id: "lyon-part-dieu",
  displayName: "Lyon Part-Dieu",
  country: "FR",
  coordinates: { lat: 45.7606, lng: 4.8593 },
  providerIds: {
    SNCF: "stop_area:SNCF:87723197",
  },
},
```

Also update `src/data/stationAliases.ts`:

```typescript
// French aliases
"paris": "paris-nord",
"paris nord": "paris-nord",
"gare du nord": "paris-nord",
"paris est": "paris-est",
"gare de l'est": "paris-est",
"lyon": "lyon-part-dieu",
```

---

## Step 5: Add Environment Variable

Update `.env.local`:

```bash
VITE_SNCF_API_KEY=your_sncf_api_key
```

Update the types if needed in `src/services/providers/types.ts`:

```typescript
export type ProviderID = "NS" | "DB" | "SNCF" | "OBB" | "SBB";
export type CountryCode = "NL" | "DE" | "FR" | "AT" | "CH" | "BE";
```

---

## Testing the New Provider

1. Start the dev server: `npm run dev`
2. Go to the API Test page
3. Search for a French station (e.g., "Paris")
4. Search for a journey to/from France

Check the console logs for:
- `[SNCFProvider] Searching stations...`
- `[SNCF API] Response: ...`

---

## Checklist

- [ ] Created `src/services/xxxApi.ts` with low-level API calls
- [ ] Created `src/services/providers/xxxProvider.ts` implementing `TrainProvider`
- [ ] Registered provider in `src/services/providers/index.ts`
- [ ] Added provider ID to `ProviderID` type if new
- [ ] Added country code to `CountryCode` type if new
- [ ] Added stations to `src/data/stationRegistry.ts`
- [ ] Added aliases to `src/data/stationAliases.ts`
- [ ] Added environment variable for API key
- [ ] Updated `docs/api.md` with new provider details
- [ ] Tested station search
- [ ] Tested journey search

---

## Common Patterns

### CORS Issues

If the API doesn't support browser CORS, add a Vite proxy in `vite.config.ts`:

```typescript
server: {
  proxy: {
    '/api/sncf': {
      target: 'https://api.sncf.com',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api\/sncf/, ''),
      configure: (proxy) => {
        proxy.on('proxyReq', (proxyReq) => {
          proxyReq.setHeader('Authorization', `Basic ${btoa(process.env.VITE_SNCF_API_KEY + ':')}`);
        });
      },
    },
  },
},
```

Then update the BASE_URL in your API file:

```typescript
const BASE_URL = "/api/sncf/v1";
```

### XML Responses

If the API returns XML (like DB Timetables), use the DOMParser:

```typescript
const parseXmlToObject = (xmlString: string): Record<string, unknown> => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, "text/xml");
  // ... parse elements
};
```

### Rate Limiting

Add request throttling if needed:

```typescript
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 second

const throttledFetch = async (url: string, options: RequestInit) => {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => 
      setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest)
    );
  }
  
  lastRequestTime = Date.now();
  return fetch(url, options);
};
```

---

## API Documentation Links

| Provider | Documentation |
|----------|---------------|
| SNCF | https://www.digital.sncf.com/startup/api |
| OBB | https://data.oebb.at/ |
| SBB | https://opentransportdata.swiss/en/ |
| Renfe | Contact for API access |
| Trenitalia | Contact for API access |

---

## Questions?

If you encounter issues, check:
1. Console logs for API responses
2. Network tab for request/response details
3. The provider's API documentation for quirks
4. Existing implementations (nsApi.ts, dbApi.ts) for patterns
