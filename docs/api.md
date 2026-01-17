# Trainy API Integration Guide

This document details all API integrations used in Trainy for AI agents and developers.

## Overview

Trainy uses three European rail APIs:

| Provider | Country | Service File | Auth Required |
|----------|---------|--------------|---------------|
| NS (Nederlandse Spoorwegen) | Netherlands | `src/services/nsApi.ts` | Yes (API Key) |
| DB (Deutsche Bahn) | Germany | `src/services/dbApi.ts` | Yes (Client ID + API Key) |
| SNCF | France | `src/services/sncfApi.ts` | Yes (API Key) - Not yet implemented |

---

## NS API (Netherlands)

**Service file:** `trainy-web/src/services/nsApi.ts`

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

### Endpoints Used

| Function | Endpoint | Purpose |
|----------|----------|---------|
| `searchStations(query)` | `GET /v2/stations?q={query}` | Search stations by name |
| `searchJourneys(params)` | `GET /v3/trips` | Find journeys between stations |
| `getJourneyDetails(trainNumber, dateTime)` | `GET /v2/journey` | Get detailed journey info |

### Response Mapping

NS API responses are mapped to shared types in `src/types/train.ts`:
- `NSStationRaw` → `Station`
- `NSJourneyRaw` → `Journey`
- `NSStopRaw` → `JourneyStop`

### Key Quirks

- Times are ISO strings
- Delays are in minutes (no conversion needed)
- Platform info in `plannedPlatform` and `actualPlatform` fields
- Journey status derived from `status` field

---

## DB API (Germany)

**Service file:** `trainy-web/src/services/dbApi.ts`

DB integration uses **two separate APIs** for different purposes:

### Authentication (Both APIs)

```typescript
Headers: {
  "DB-Client-Id": import.meta.env.VITE_DB_CLIENT_ID,
  "DB-Api-Key": import.meta.env.VITE_DB_API_KEY
}
```

**Environment variables:**
- `VITE_DB_CLIENT_ID`
- `VITE_DB_API_KEY`

### Local Development (CORS)

DB APIs do not allow browser CORS directly. In dev, the Vite server proxies DB calls:

- Timetables: `http://localhost:5173/api/db/timetables/*`
- RIS::Journeys: `http://localhost:5173/api/db/journeys/*`

Proxy config lives in `trainy-web/vite.config.ts` and injects `DB-Client-Id` / `DB-Api-Key`.

---

### Timetables API (Station-centric)

**Base URL:** `https://apis.deutschebahn.com/db/apis/timetables/v1`
**Documentation:** https://developers.deutschebahn.com/db-api-marketplace/apis/product/timetables
**License:** Free (CC BY 4.0)
**Rate limit:** 60 calls/min

#### Endpoints

| Function | Endpoint | Purpose |
|----------|----------|---------|
| `searchStations(query)` | `GET /station/{pattern}` | Search stations by name pattern |
| `getDepartures(evaNo, dateTime)` | `GET /plan/{evaNo}/{date}/{hour}` | Get departure board at station |
| `getFullChanges(evaNo)` | `GET /fchg/{evaNo}` | Get all real-time changes |
| `getRecentChanges(evaNo)` | `GET /rchg/{evaNo}` | Get recent changes only |

#### Response Format

**Important:** Timetables API returns **XML**, not JSON. The service includes a parser:

```typescript
const parseXmlToObject = (xmlString: string): Record<string, unknown> => { ... }
```

#### Time Format Quirk

Timetables uses `YYMMDDHHMM` format (e.g., `2601171430` = Jan 17, 2026 14:30).
Converted to ISO via `parseTimetableTime()`:

```typescript
const parseTimetableTime = (timeStr?: string): string | undefined => {
  // "2601171430" → "2026-01-17T14:30:00"
}
```

#### Station Identifiers

- **EVA numbers**: 7-digit station codes (e.g., `8000105` for Frankfurt Hbf)
- **DS100 codes**: Short station codes (e.g., `FF` for Frankfurt)

---

### RIS::Journeys API (Journey-centric)

**Base URL:** `https://apis.deutschebahn.com/db/apis/ris-journeys/v2`
**Documentation:** https://developers.deutschebahn.com/db-api-marketplace/apis/product/ris-journeys-transporteure

#### Endpoints

| Function | Endpoint | Purpose |
|----------|----------|---------|
| `findJourneys(trainNumber, dateTime)` | `GET /find` | Find trains by train number |
| `getJourneyDetails(journeyId)` | `GET /{journeyID}` | Get full journey with all stops |

#### Response Format

RIS::Journeys returns **JSON** with this structure:

```typescript
type DBJourneyRaw = {
  journeyID?: string;
  train?: {
    journeyNumber?: string;
    type?: string;        // ICE, IC, RE, etc.
    category?: string;
    operator?: { name?: string };
  };
  departure?: DBEventRaw;
  arrival?: DBEventRaw;
  events?: DBEventRaw[];  // All stops
  cancelled?: boolean;
};
```

---

### When to Use Which DB API

```
┌─────────────────────────────────────────────────────────────┐
│                     USE CASE                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Search for a station?     → searchStations()  [Timetables] │
│  See departures at station → getDepartures()   [Timetables] │
│  Check delays/changes      → getFullChanges()  [Timetables] │
│                                                             │
│  Look up specific train    → findJourneys()    [Journeys]   │
│  View all stops on journey → getJourneyDetails() [Journeys] │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Shared Types

All API responses are mapped to shared types in `src/types/train.ts`:

```typescript
// Core types
export type Station = {
  code: string;           // Station code (e.g., "ASD", "8000105")
  name: string;
  country: string;        // 2-letter: "NL", "DE", "FR"
  uicCode?: string;       // International code
  lat?: number;
  lng?: number;
};

export type JourneyStop = {
  station: Station;
  scheduledArrival?: string;
  scheduledDeparture?: string;
  platform?: string;
  plannedPlatform?: string;
  actualPlatform?: string;
  departureDelay?: number;  // minutes
  arrivalDelay?: number;    // minutes
  cancelled?: boolean;
};

export type Journey = {
  id: string;
  trainNumber: string;
  trainType: string;        // ICE, IC, TGV, etc.
  operator: string;         // NS, DB, SNCF
  departure: JourneyStop;
  arrival: JourneyStop;
  stops: JourneyStop[];
  duration: number;         // minutes
  status: JourneyStatus;
  apiSource: ApiSource;
  rawData?: unknown;        // Original API response
};

export type JourneyStatus = "scheduled" | "delayed" | "cancelled" | "departed" | "arrived";
export type ApiSource = "NS" | "DB" | "SNCF" | "merged";
```

---

## Type Naming Conventions

| Prefix/Suffix | Meaning | Example |
|---------------|---------|---------|
| `NS*` | NS API raw types | `NSStationRaw` |
| `DB*` | DB API raw types | `DBJourneyRaw`, `DBTimetableStopRaw` |
| `SNCF*` | SNCF API raw types | `SNCFTripRaw` |
| `Merged*` | Combined cross-border types | `MergedJourney` |
| `*Raw` | Untransformed API response | `NSStationRaw` |

---

## Logging Pattern

All API services use consistent logging:

```typescript
// Request logging
console.log(`[NS API][${timestamp}] Request`, { method, url, params });

// Response logging
console.log(`[NS API][${timestamp}] Response`, { status, preview });

// Error logging
console.error(`[NS API][${timestamp}] searchStations error`, error);
```

---

## Error Handling Pattern

All API functions follow this pattern:

```typescript
export const someFunction = async (params): Promise<ReturnType> => {
  try {
    const url = new URL(`${BASE_URL}/endpoint`);
    // ... set params ...
    
    const { data } = await fetchJson<ResponseType>(url.toString());
    return data.items.map(mapToSharedType);
    
  } catch (error) {
    console.error(`[API][${getTimestamp()}] someFunction error`, error);
    throw new Error("Failed to do something.");
  }
};
```

---

## Environment Variables Summary

```bash
# .env.local

# NS API (Netherlands)
VITE_NS_API_KEY=your_ns_api_key

# DB API (Germany)
VITE_DB_CLIENT_ID=your_db_client_id
VITE_DB_API_KEY=your_db_api_key

# SNCF API (France) - Phase 3
VITE_SNCF_API_KEY=your_sncf_api_key

# Supabase
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## Cross-Border Journey Logic

When combining data from multiple APIs:

1. **Match trains by:** train number + departure time (±5 min tolerance)
2. **Authority by country:**
   - NS authoritative for Dutch stations
   - DB authoritative for German stations
   - SNCF authoritative for French stations
3. **Store raw responses** in `rawData` field for debugging
4. **Prefer most complete data** when merging conflicting info

---

## Quick Reference

### Search for stations
```typescript
import { searchStations } from './services/nsApi';   // Dutch
import { searchStations } from './services/dbApi';   // German
```

### Get departures at a station
```typescript
import { getDepartures } from './services/dbApi';
const departures = await getDepartures("8000105", "2026-01-17T14:00:00");
```

### Find a specific train
```typescript
import { findJourneys } from './services/dbApi';
const trains = await findJourneys("123", "2026-01-17T14:00:00"); // ICE 123
```

### Get journey details
```typescript
import { getJourneyDetails } from './services/dbApi';
const journey = await getJourneyDetails("journey-id-from-search");
```
