# Trainy

European train travel tracker with cross-border journey support.

## What is Trainy?

Trainy is a web app that searches and tracks train journeys across European rail networks. It combines data from multiple train APIs (NS, DB, SNCF) to provide unified journey information for cross-border travel.

**Primary use case:** Amsterdam → Frankfurt (and other international routes)

## Features

- Search stations across Netherlands, Germany, France
- Find cross-border journeys with merged data from multiple APIs
- View journey details with all intermediate stops
- Track real-time delays and platform changes
- Store journeys in Supabase for history and offline access

## Architecture

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

## Tech Stack

- **Frontend:** React 18 + Vite + TypeScript
- **Styling:** TailwindCSS
- **Database:** Supabase (PostgreSQL)
- **APIs:** NS (Netherlands), DB (Germany), SNCF (France - planned)

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- API keys for NS and DB (see below)
- Supabase project

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/trainy.git
cd trainy/trainy-web

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local
```

### Environment Variables

Create `.env.local` with:

```bash
# NS API (Netherlands)
VITE_NS_API_KEY=your_ns_api_key

# DB API (Germany)
VITE_DB_CLIENT_ID=your_db_client_id
VITE_DB_API_KEY=your_db_api_key

# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Getting API Keys

| Provider | How to Get |
|----------|------------|
| NS | Register at [NS API Portal](https://apiportal.ns.nl/) |
| DB | Register at [DB API Marketplace](https://developers.deutschebahn.com/) |
| Supabase | Create project at [supabase.com](https://supabase.com) |

### Database Setup

Run the SQL migration in your Supabase SQL Editor:

```sql
-- Copy contents from: trainy-web/supabase/migrations/001_create_journeys_tables.sql
```

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Project Structure

```
trainy/
├── agents.md                    # Project rules for AI agents
├── docs/
│   ├── api.md                   # API integration guide
│   └── adding-providers.md      # Guide to add new country APIs
├── trainy-web/
│   ├── src/
│   │   ├── data/                # Station registry
│   │   ├── services/
│   │   │   ├── providers/       # Provider adapters
│   │   │   ├── nsApi.ts         # NS low-level API
│   │   │   ├── dbApi.ts         # DB low-level API
│   │   │   ├── internationalApi.ts  # Orchestration
│   │   │   └── journeyStore.ts  # Supabase persistence
│   │   ├── types/               # TypeScript types
│   │   ├── pages/               # React pages
│   │   └── components/          # React components
│   └── supabase/
│       └── migrations/          # Database schema
└── README.md
```

## Documentation

| Document | Description |
|----------|-------------|
| [agents.md](agents.md) | Project overview and coding guidelines |
| [docs/api.md](docs/api.md) | Detailed API integration guide |
| [docs/adding-providers.md](docs/adding-providers.md) | How to add new country APIs |

## Adding New Country APIs

Trainy is designed to be extensible. To add support for a new rail API (SNCF, OBB, SBB, etc.):

1. Create `xxxApi.ts` - Low-level API calls
2. Create `xxxProvider.ts` - Implements `TrainProvider` interface
3. Register in `providers/index.ts`
4. Add stations to `stationRegistry.ts`

See [docs/adding-providers.md](docs/adding-providers.md) for detailed instructions.

## Current Status

- ✅ NS API (Netherlands) - Fully integrated
- ✅ DB API (Germany) - Fully integrated
- ✅ Supabase storage - Journey persistence
- ✅ Cross-border merging - Amsterdam → Frankfurt works
- 🔜 SNCF API (France) - Planned
- 🔜 OBB API (Austria) - Planned
- 🔜 SBB API (Switzerland) - Planned

## Contributing

This is a personal project for validating train API integrations before building an iOS app. Contributions and suggestions are welcome!

## License

MIT
