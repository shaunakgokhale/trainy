# Trainy API Integration Guide

This document details all API integrations used in Trainy for AI agents and developers.

## Architecture Overview

Trainy uses a 3-layer architecture for international train search:

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 3: Orchestration (internationalApi.ts)                   │
│  - Coordinates providers, merges data, stores to Supabase       │
├─────────────────────────────────────────────────────────────────┤
│  Layer 2: Station Registry (stationRegistry.ts)                 │
│  - Unified station IDs across providers                         │
├─────────────────────────────────────────────────────────────────┤
│  Layer 1: Providers (nsProvider.ts, dbProvider.ts)              │
│  - Each wraps a low-level API (nsApi.ts, dbApi.ts)             │
└─────────────────────────────────────────────────────────────────┘
```

## Supported Providers

| Provider | Country | Status | Service Files |
|----------|---------|--------|---------------|
| NS (Nederlandse Spoorwegen) | Netherlands | ✅ Active | `nsApi.ts`, `nsProvider.ts` |
| DB (Deutsche Bahn) | Germany | ✅ Active | `dbApi.ts`, `dbProvider.ts` |
| SNCF | France | 🔜 Planned | - |
| OBB | Austria | 🔜 Planned | - |
| SBB | Switzerland | 🔜 Planned | - |

---

## Provider Interface

All providers implement the `TrainProvider` interface:

```typescript
// src/services/providers/types.ts

interface TrainProvider {
  readonly id: ProviderID;      // "NS" | "DB" | "SNCF" | "OBB" | "SBB"
  readonly country: CountryCode; // "NL" | "DE" | "FR" | "AT" | "CH"
  readonly name: string;         // "Nederlandse Spoorwegen"

  searchStations(query: string): Promise<Station[]>;
  searchJourneys(params: JourneySearchParams): Promise<Journey[]>;
  getJourneyDetails(journeyId: string): Promise<Journey | null>;
  toProviderStationId(station: UnifiedStation): string | null;
  canHandleStation(station: UnifiedStation): boolean;
}
```

### Provider Registry

```typescript
// Get provider by ID
import { getProvider } from './services/providers';
const ns = getProvider("NS");

// Get provider for a country
import { getProviderForCountry } from './services/providers';
const provider = getProviderForCountry("DE"); // Returns DB provider

// Get all active providers
import { getActiveProviders } from './services/providers';
const providers = getActiveProviders(); // [nsProvider, dbProvider]
```

---

## NS API (Netherlands)

**Provider:** `src/services/providers/nsProvider.ts`
**Low-level API:** `src/services/nsApi.ts`

### Authentication

```typescript
Headers: {
  "Ocp-Apim-Subscription-Key": import.meta.env.VITE_NS_API_KEY
}
```

**Environment variable:** `VITE_NS_API_KEY`

### Base URL

```
https://gateway.apiportal.ns.nl/reisinformatie-api/api
```

### Endpoints

| Function | Endpoint | Purpose |
|----------|----------|---------|
| `searchStations(query)` | `GET /v2/stations?q={query}` | Search stations by name |
| `searchJourneys(params)` | `GET /v3/trips` | Find journeys between stations |
| `getJourneyDetails(trainNumber, dateTime)` | `GET /v2/journey` | Get detailed journey info |

### Key Quirks

- Times are ISO strings
- Delays are in minutes (no conversion needed)
- Platform info in `plannedPlatform` and `actualPlatform` fields
- Can search for German stations directly (good international coverage)

---

## DB API (Germany)

**Provider:** `src/services/providers/dbProvider.ts`
**Low-level API:** `src/services/dbApi.ts`

DB integration uses **two separate APIs**:

### Authentication

```typescript
Headers: {
  "DB-Client-Id": import.meta.env.VITE_DB_CLIENT_ID,
  "DB-Api-Key": import.meta.env.VITE_DB_API_KEY
}
```

**Environment variables:** `VITE_DB_CLIENT_ID`, `VITE_DB_API_KEY`

### CORS Proxy (Development)

DB APIs don't support browser CORS. Vite proxies these calls:

- Timetables: `http://localhost:5173/api/db/timetables/*`
- RIS::Journeys: `http://localhost:5173/api/db/journeys/*`

Proxy config in `vite.config.ts` injects auth headers.

### Timetables API (Station-centric)

**Base URL:** `https://apis.deutschebahn.com/db/apis/timetables/v1`

| Function | Endpoint | Purpose |
|----------|----------|---------|
| `searchStations(query)` | `GET /station/{pattern}` | Search stations |
| `getDepartures(evaNo, dateTime)` | `GET /plan/{evaNo}/{date}/{hour}` | Departure board |
| `getFullChanges(evaNo)` | `GET /fchg/{evaNo}` | Real-time changes |

**Response format:** XML (parsed to JSON internally)

**Time format:** `YYMMDDHHMM` (e.g., `2601171430` = Jan 17, 2026 14:30)

### RIS::Journeys API (Journey-centric)

**Base URL:** `https://apis.deutschebahn.com/db/apis/ris-journeys/v2`

| Function | Endpoint | Purpose |
|----------|----------|---------|
| `findJourneys(trainNumber, dateTime)` | `GET /find` | Find by train number |
| `getJourneyDetails(journeyId)` | `GET /{journeyID}` | Full journey with stops |

**Response format:** JSON

### Station Identifiers

- **EVA numbers**: 7-digit codes (e.g., `8000105` for Frankfurt Hbf)
- **DS100 codes**: Short codes (e.g., `FF` for Frankfurt)

---

## Station Registry

Unified station definitions with cross-provider mappings:

```typescript
// src/data/stationRegistry.ts

const STATION_REGISTRY = {
  "amsterdam-centraal": {
    id: "amsterdam-centraal",
    displayName: "Amsterdam Centraal",
    country: "NL",
    providerIds: {
      NS: "ASD",           // NS station code
      DB: "8400058",       // EVA number
    },
  },
  "frankfurt-hbf": {
    id: "frankfurt-hbf",
    displayName: "Frankfurt (Main) Hbf",
    country: "DE",
    providerIds: {
      NS: "Frankfurt (Main) Hbf",  // NS uses name
      DB: "8000105",               // EVA number
    },
  },
  // ... more stations
};
```

### Lookup Functions

```typescript
import { 
  findStationsByName,
  findStationByProviderId,
  getStationById,
  getProviderStationId 
} from './data/stationRegistry';

// Search by name
const stations = findStationsByName("amsterdam");

// Find by provider ID
const station = findStationByProviderId("8000105", "DB");

// Get provider-specific ID
const evaNumber = getProviderStationId(station, "DB"); // "8000105"
```

### Station Aliases

```typescript
// src/data/stationAliases.ts

const STATION_ALIASES = {
  "amsterdam": "amsterdam-centraal",
  "amsterdam cs": "amsterdam-centraal",
  "frankfurt": "frankfurt-hbf",
  "köln": "koln-hbf",
  "cologne": "koln-hbf",
  // ...
};
```

---

## Supabase Storage

### Database Schema

**Table: `journeys`**

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| journey_key | text | Unique: `{trainType}{trainNumber}_{originId}_{departureISO}` |
| train_number | text | e.g., "123" |
| train_type | text | e.g., "ICE" |
| operator | text | e.g., "DB" |
| origin_station_id | text | Registry ID (e.g., "amsterdam-centraal") |
| destination_station_id | text | Registry ID |
| scheduled_departure | timestamptz | |
| scheduled_arrival | timestamptz | |
| duration_minutes | int | |
| status | text | scheduled/delayed/cancelled |
| sources | text[] | ["NS", "DB"] - which APIs contributed |
| ns_raw_id | text | Original NS journey ID |
| db_raw_id | text | Original DB journey ID |

**Table: `journey_stops`**

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| journey_id | uuid | FK to journeys |
| sequence | int | Stop order (0, 1, 2...) |
| station_id | text | Registry ID |
| station_name | text | Display name |
| country | text | Country code |
| scheduled_arrival | timestamptz | |
| scheduled_departure | timestamptz | |
| arrival_delay_min | int | |
| departure_delay_min | int | |
| planned_platform | text | |
| actual_platform | text | |
| source | text | Which API provided this stop |
| cancelled | boolean | |

### Journey Store API

```typescript
import { 
  storeJourney, 
  findJourneyByKey, 
  getJourneyById,
  updateJourneyRealtime 
} from './services/journeyStore';

// Store a journey
const stored = await storeJourney(journeyInput);

// Find by unique key
const journey = await findJourneyByKey("ICE123_amsterdam-centraal_2026-01-18T10:31:00");

// Get by database ID
const journey = await getJourneyById("uuid-here");

// Update realtime data
await updateJourneyRealtime(id, {
  status: "delayed",
  stops: [{ sequence: 0, departureDelayMin: 5, actualPlatform: "7" }]
});
```

---

## International API (Orchestration)

The main entry point for international journey search:

```typescript
import { 
  searchStations, 
  searchJourneys, 
  getJourneyDetails 
} from './services/internationalApi';

// Search stations across all providers
const stations = await searchStations("amsterdam");

// Search journeys (queries relevant providers, merges, stores)
const journeys = await searchJourneys(fromStation, toStation, dateTime);

// Get journey details with optional refresh
const details = await getJourneyDetails(journeyId, refresh: true);
```

### Journey Merging

When the same train is found by multiple providers:

1. **Match by**: `trainType + trainNumber + departure time (±5 min)`
2. **Field priority**:
   - Origin country API → departure info
   - Destination country API → arrival info
   - More stops → intermediate stations
   - Latest data → realtime delays/platforms

---

## Environment Variables

```bash
# .env.local

# NS API (Netherlands)
VITE_NS_API_KEY=your_ns_api_key

# DB API (Germany)  
VITE_DB_CLIENT_ID=your_db_client_id
VITE_DB_API_KEY=your_db_api_key

# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Future
# VITE_SNCF_API_KEY=your_sncf_api_key
```

---

## Type Reference

### Core Types

```typescript
// Provider identifiers
type ProviderID = "NS" | "DB" | "SNCF" | "OBB" | "SBB";
type CountryCode = "NL" | "DE" | "FR" | "AT" | "CH" | "BE";
type ApiSource = "NS" | "DB" | "SNCF" | "merged";

// Station from registry
interface UnifiedStation {
  id: string;
  displayName: string;
  country: CountryCode;
  coordinates?: { lat: number; lng: number };
  providerIds: Partial<Record<ProviderID, string>>;
}

// Journey stored in database
interface StoredJourney {
  id: string;
  journeyKey: string;
  trainNumber: string;
  trainType: string;
  operator: string;
  originStationId: string;
  originStationName: string;
  destinationStationId: string;
  destinationStationName: string;
  scheduledDeparture: string;
  scheduledArrival?: string;
  durationMinutes: number;
  status: JourneyStatus;
  sources: ApiSource[];
  stops: StoredJourneyStop[];
  createdAt: string;
  updatedAt: string;
}
```

---

## Quick Reference

### Search for stations
```typescript
import { searchStations } from './services/internationalApi';
const stations = await searchStations("frankfurt");
```

### Search for journeys
```typescript
import { searchStations, searchJourneys } from './services/internationalApi';

const [from] = await searchStations("Amsterdam");
const [to] = await searchStations("Frankfurt");
const journeys = await searchJourneys(from, to, new Date().toISOString());
```

### Get journey details with refresh
```typescript
import { getJourneyDetails } from './services/internationalApi';
const details = await getJourneyDetails(journeyId, true); // true = refresh from APIs
```

---

## Adding New Providers

See `docs/adding-providers.md` for a step-by-step guide to implement SNCF, OBB, SBB, or other European rail APIs.
