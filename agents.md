# Trainy - European Train Travel Tracker

## Documentation

| Document | Purpose |
|----------|---------|
| `agents.md` (this file) | Project overview, code style, rules for AI agents |
| `docs/api.md` | **Detailed API integration guide** - endpoints, auth, response formats |
| `docs/adding-providers.md` | **Guide for adding new country APIs** |

## Project Overview
Web app to test and validate European train APIs (NS, DB, SNCF, OBB, SBB) before building iOS app.
Focus: Cross-border journey logic, API integration, real-time tracking.

## Architecture Overview

Trainy uses a **3-layer architecture** for extensible international train search:

```
┌─────────────────────────────────────────────────────────────────┐
│                        UI Layer                                  │
│                   (SearchPage, JourneyPage)                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                  Layer 3: Orchestration                          │
│              (internationalApi.ts, journeyStore.ts)              │
│                                                                  │
│  • Coordinates multiple providers                                │
│  • Merges journey data from different sources                   │
│  • Stores results in Supabase                                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                  Layer 2: Station Registry                       │
│           (stationRegistry.ts, stationAliases.ts)                │
│                                                                  │
│  • Unified station identifiers across providers                 │
│  • Maps provider-specific IDs (NS: "ASD", DB: "8400058")       │
│  • Search aliases ("amsterdam" → "amsterdam-centraal")          │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                  Layer 1: API Providers                          │
│          (nsProvider.ts, dbProvider.ts, sncfProvider.ts)         │
│                                                                  │
│  • Each implements TrainProvider interface                      │
│  • Wraps low-level API calls (nsApi.ts, dbApi.ts)              │
│  • Handles provider-specific quirks                             │
└─────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
trainy/
├── agents.md                    # This file - project rules for AI agents
├── docs/
│   ├── api.md                   # Detailed API integration guide
│   └── adding-providers.md      # Guide for adding new country APIs
├── trainy-web/
│   ├── src/
│   │   ├── data/                # Static data and registries
│   │   │   ├── stationRegistry.ts   # Unified station definitions
│   │   │   └── stationAliases.ts    # Search term aliases
│   │   ├── services/
│   │   │   ├── providers/           # Provider adapters
│   │   │   │   ├── types.ts         # TrainProvider interface
│   │   │   │   ├── nsProvider.ts    # NS adapter
│   │   │   │   ├── dbProvider.ts    # DB adapter
│   │   │   │   └── index.ts         # Provider registry
│   │   │   ├── nsApi.ts             # Low-level NS API calls
│   │   │   ├── dbApi.ts             # Low-level DB API calls
│   │   │   ├── internationalApi.ts  # Orchestration layer
│   │   │   ├── journeyStore.ts      # Supabase persistence
│   │   │   └── supabase.ts          # Supabase client
│   │   ├── types/
│   │   │   ├── train.ts             # Core types + StoredJourney
│   │   │   └── database.ts          # Supabase table types
│   │   ├── components/
│   │   ├── pages/
│   │   └── utils/
│   ├── supabase/
│   │   └── migrations/              # Database schema
│   └── public/
└── README.md
```

## Tech Stack
- Frontend: React 18 + Vite + TypeScript
- Styling: TailwindCSS
- Database: Supabase (PostgreSQL)
- APIs: NS, DB (+ SNCF, OBB, SBB planned)

## Key Concepts

### UnifiedStation
A station with identifiers for all supported providers:

```typescript
interface UnifiedStation {
  id: string;              // "amsterdam-centraal"
  displayName: string;     // "Amsterdam Centraal"
  country: CountryCode;    // "NL"
  providerIds: {
    NS?: string;           // "ASD"
    DB?: string;           // "8400058"
    SNCF?: string;
    OBB?: string;
    SBB?: string;
  };
}
```

### TrainProvider
Interface that all country APIs must implement:

```typescript
interface TrainProvider {
  readonly id: ProviderID;
  readonly country: CountryCode;
  searchStations(query: string): Promise<Station[]>;
  searchJourneys(params: JourneySearchParams): Promise<Journey[]>;
  getJourneyDetails(journeyId: string): Promise<Journey | null>;
  toProviderStationId(station: UnifiedStation): string | null;
}
```

### StoredJourney
Journey stored in Supabase with merged data from multiple providers:

```typescript
interface StoredJourney {
  id: string;                    // Database UUID
  journeyKey: string;            // Deduplication key
  trainNumber: string;
  trainType: string;
  originStationId: string;
  destinationStationId: string;
  sources: ApiSource[];          // ["NS", "DB"] - which APIs contributed
  stops: StoredJourneyStop[];
  // ... timing, status, etc.
}
```

## Code Style

### TypeScript/React
- Functional components with hooks
- async/await for all async operations
- Named exports preferred
- Keep components < 200 lines
- Descriptive variable names

### API Integration
- Console.log all requests/responses (debugging phase)
- Handle errors with try/catch
- Type all API responses
- Comment on quirks and edge cases

## Type Naming Conventions

| Prefix/Suffix | Meaning | Example |
|---------------|---------|---------|
| `NS*`, `DB*`, `SNCF*` | Provider-specific raw types | `NSStationRaw` |
| `*Raw` | Untransformed API response | `DBJourneyRaw` |
| `Unified*` | Cross-provider unified type | `UnifiedStation` |
| `Stored*` | Supabase-persisted type | `StoredJourney` |
| `Merged*` | Legacy combined types | `MergedJourney` |

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

# Future APIs
# VITE_SNCF_API_KEY=your_sncf_api_key
```

## Cross-Border Journey Logic

1. **Primary provider**: Origin station's country API
2. **Secondary provider**: Destination station's country API (if different)
3. **Matching**: Train number + departure time (±5 min tolerance)
4. **Field priority**:
   - Origin country API authoritative for departure info
   - Destination country API authoritative for arrival info
   - More complete stop list wins for intermediates
   - Latest realtime data wins for delays/platforms

## Current Focus

Building Phase 2: Full architecture with Supabase integration

## Adding New Country APIs

See `docs/adding-providers.md` for step-by-step guide to add SNCF, OBB, SBB, or other European rail APIs.

## Avoid
- Over-engineering - this is a validation project
- Premature optimization
- Single-use abstractions
- Features beyond current phase scope
