-- =============================================================================
-- Trainy Database Schema
-- =============================================================================
-- Tables for storing international train journeys aggregated from multiple APIs

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- Table: journeys
-- =============================================================================
-- Stores the main journey information merged from multiple API sources

CREATE TABLE IF NOT EXISTS journeys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Unique journey identifier: {trainType}{trainNumber}_{originStationId}_{departureISO}
    journey_key TEXT NOT NULL UNIQUE,
    
    -- Train information
    train_number TEXT NOT NULL,
    train_type TEXT NOT NULL,
    operator TEXT NOT NULL,
    
    -- Station information (references station registry IDs)
    origin_station_id TEXT NOT NULL,
    origin_station_name TEXT NOT NULL,
    destination_station_id TEXT NOT NULL,
    destination_station_name TEXT NOT NULL,
    
    -- Timing
    scheduled_departure TIMESTAMPTZ NOT NULL,
    scheduled_arrival TIMESTAMPTZ,
    duration_minutes INTEGER NOT NULL DEFAULT 0,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'scheduled',
    
    -- Source tracking
    sources TEXT[] NOT NULL DEFAULT '{}',
    ns_raw_id TEXT,
    db_raw_id TEXT,
    sbb_raw_id TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_journeys_journey_key ON journeys(journey_key);
CREATE INDEX IF NOT EXISTS idx_journeys_train_number ON journeys(train_number);
CREATE INDEX IF NOT EXISTS idx_journeys_scheduled_departure ON journeys(scheduled_departure);
CREATE INDEX IF NOT EXISTS idx_journeys_origin_station ON journeys(origin_station_id);
CREATE INDEX IF NOT EXISTS idx_journeys_destination_station ON journeys(destination_station_id);

-- =============================================================================
-- Table: journey_stops
-- =============================================================================
-- Stores individual stops for each journey

CREATE TABLE IF NOT EXISTS journey_stops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Reference to parent journey
    journey_id UUID NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
    
    -- Stop order (0 = origin, last = destination)
    sequence INTEGER NOT NULL,
    
    -- Station information
    station_id TEXT NOT NULL,
    station_name TEXT NOT NULL,
    country TEXT NOT NULL,
    
    -- Timing
    scheduled_arrival TIMESTAMPTZ,
    scheduled_departure TIMESTAMPTZ,
    arrival_delay_min INTEGER,
    departure_delay_min INTEGER,
    
    -- Platform information
    planned_platform TEXT,
    actual_platform TEXT,
    
    -- Source and status
    source TEXT NOT NULL,
    cancelled BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Ensure unique stop per journey at each sequence
    UNIQUE(journey_id, sequence)
);

-- Indexes for stop queries
CREATE INDEX IF NOT EXISTS idx_journey_stops_journey_id ON journey_stops(journey_id);
CREATE INDEX IF NOT EXISTS idx_journey_stops_station_id ON journey_stops(station_id);

-- =============================================================================
-- Trigger: Update updated_at on journeys modification
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_journeys_updated_at ON journeys;
CREATE TRIGGER update_journeys_updated_at
    BEFORE UPDATE ON journeys
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================
-- For now, allow public read/write access (adjust based on auth requirements)

ALTER TABLE journeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE journey_stops ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations for now (public access)
CREATE POLICY "Allow public access to journeys" ON journeys
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public access to journey_stops" ON journey_stops
    FOR ALL USING (true) WITH CHECK (true);
