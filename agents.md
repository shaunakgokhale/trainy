# Trainy - European Train Travel Tracker

## Documentation

| Document | Purpose |
|----------|---------|
| `agents.md` (this file) | Project overview, code style, rules for AI agents |
| `docs/api.md` | **Detailed API integration guide** - endpoints, auth, response formats, usage examples |

## Project Overview
Web app to test and validate European train APIs (NS, DB, SNCF) before building iOS app.
Focus: Cross-border journey logic, API integration, real-time tracking.

## Current Goal
Build working web MVP that:
1. Searches trains across Netherlands, Germany, France
2. Handles cross-border journeys (Amsterdam → Frankfurt)
3. Shows real-time updates (delays, platforms)
4. Saves journeys to Supabase
5. Validates all logic before iOS development

## Tech Stack
- Frontend: React 18 + Vite + TypeScript
- Styling: TailwindCSS
- Database: Supabase (PostgreSQL + Auth)
- Deployment: Vercel (later)
- APIs: Direct browser calls to NS/DB/SNCF

## Project Structure
```
trainy/
├── agents.md            # This file - project rules for AI agents
├── trainy-web/          # React web app
│   ├── src/
│   │   ├── services/    # API integrations
│   │   │   ├── nsApi.ts   # NS (Netherlands) API
│   │   │   └── dbApi.ts   # DB (Germany) API - Timetables + RIS::Journeys
│   │   ├── components/  # Reusable React components
│   │   ├── pages/       # Main page components
│   │   ├── types/       # TypeScript type definitions
│   │   │   └── train.ts   # Shared types: Station, Journey, JourneyStop
│   │   └── utils/       # Helper functions
│   └── public/
└── docs/                # Documentation
    └── api.md           # Detailed API integration guide
```

## Code Style - TypeScript/React
- Use functional components with hooks
- Use async/await for all async operations
- Prefer named exports over default exports
- Add JSDoc comments for complex functions
- Use descriptive variable names
- Keep components small and focused (< 200 lines)

## Code Style - API Integration
- Always log requests and responses for debugging
- Handle errors gracefully with try/catch
- Add TypeScript types for all API responses
- Comment on API quirks and edge cases
- Use environment variables for API keys

## API Integration Rules

**Full API documentation:** See `docs/api.md` for detailed endpoint specs, response formats, and usage examples.

### Quick Reference

| Provider | Auth | Service File |
|----------|------|--------------|
| NS (Netherlands) | `Ocp-Apim-Subscription-Key` header | `src/services/nsApi.ts` |
| DB (Germany) | `DB-Client-Id` + `DB-Api-Key` headers | `src/services/dbApi.ts` |
| SNCF (France) | Basic HTTP auth | `src/services/sncfApi.ts` (Phase 3) |

### DB API Architecture

DB uses **two separate APIs**:
- **Timetables API** - Station-centric (departures, station search, real-time changes)
- **RIS::Journeys API** - Journey-centric (train lookup by number, full journey details)

Both require official credentials from developers.deutschebahn.com (not the community API).

### NS API
- Base URL: `https://gateway.apiportal.ns.nl/reisinformatie-api/api`
- Endpoints: `/v2/stations`, `/v3/trips`, `/v2/journey`
  
### SNCF API (Phase 3)
- Base URL: `https://api.sncf.com/v1/`
- Auth: Basic HTTP auth
- Rate limits: TBD

## Cross-Border Journey Logic
- Match trains by: train number + departure time (±5 min tolerance)
- Authority by country:
  - NS for Dutch stations
  - DB for German stations
  - SNCF for French stations
- Store both raw API responses for debugging
- Prefer most complete data when merging

## Current Focus
Building Phase 1: NS API integration + basic search functionality

## When Writing Code
1. Focus on functionality over design (TailwindCSS utility classes are fine)
2. Add extensive logging for API calls (we're learning the APIs)
3. Handle loading and error states explicitly
4. Comment on anything surprising or non-obvious
5. Keep the code simple - we'll port this to iOS later

## Environment Variables
Required in `.env.local`:
- `VITE_NS_API_KEY` - NS API subscription key
- `VITE_DB_CLIENT_ID` - DB API client ID (from developers.deutschebahn.com)
- `VITE_DB_API_KEY` - DB API key (from developers.deutschebahn.com)
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key
- `VITE_SNCF_API_KEY` - SNCF API key (Phase 3)

## Type Naming
- Prefix with source: `NSStation`, `DBJourney`, `SNCFTrip`
- Use `Merged` prefix for combined types: `MergedJourney`
- Use `Raw` suffix for untransformed API responses: `NSStationRaw`

## Avoid
- Don't over-engineer - this is a validation project
- Don't optimize performance prematurely
- Don't create abstractions for things used only once
- Don't add features beyond what's needed for current phase

## Testing Approach
- Primary test case: Amsterdam → Frankfurt (ICE trains)
- Test edge cases: cancelled trains, delays, platform changes
- Document all API quirks in docs/API_NOTES.md
