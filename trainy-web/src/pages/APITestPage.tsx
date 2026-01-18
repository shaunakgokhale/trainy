import { useState, useEffect, useRef } from "react";
import * as nsApi from "../services/nsApi";
import * as dbApi from "../services/dbApi";
import * as internationalApi from "../services/internationalApi";
import type { Journey, Station, MergedJourneyStop, StoredJourney } from "../types/train";
import type { UnifiedStation } from "../data/stationRegistry";
import { DBJourneySearchPanel } from "../components/DBJourneySearchPanel";
import { DBJourneyResults } from "../components/DBJourneyResults";
import { DBJourneyDetail } from "../components/DBJourneyDetail";

type TabId = "ns" | "db" | "international";

type TestResult<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
  timestamp: string | null;
  rawJson: string | null;
};

const getTimestamp = () => new Date().toISOString();

const formatTime = (isoString?: string) => {
  if (!isoString) return "-";
  try {
    return new Date(isoString).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
};

function CollapsibleJson({ json }: { json: string | null }) {
  const [open, setOpen] = useState(false);

  if (!json) return null;

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-blue-600 underline"
      >
        {open ? "Hide" : "Show"} Raw JSON
      </button>
      {open && (
        <pre className="mt-2 max-h-64 overflow-auto rounded bg-gray-100 p-2 text-xs">
          {json}
        </pre>
      )}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
  );
}

function ErrorDisplay({ error }: { error: string }) {
  return (
    <div className="rounded bg-red-100 p-3 text-sm text-red-700">{error}</div>
  );
}

function StationList({ stations }: { stations: Station[] }) {
  if (stations.length === 0) {
    return <p className="text-sm text-gray-500">No stations found.</p>;
  }

  return (
    <ul className="space-y-1 text-sm">
      {stations.map((station, idx) => (
        <li key={`${station.code}-${idx}`} className="rounded bg-gray-50 p-2">
          <span className="font-medium">{station.name}</span>
          <span className="ml-2 text-gray-500">
            [{station.code}] {station.country}
          </span>
        </li>
      ))}
    </ul>
  );
}

function JourneyList({ journeys }: { journeys: Journey[] }) {
  if (journeys.length === 0) {
    return <p className="text-sm text-gray-500">No journeys found.</p>;
  }

  return (
    <ul className="space-y-2 text-sm">
      {journeys.map((journey, idx) => (
        <li key={`${journey.id}-${idx}`} className="rounded bg-gray-50 p-3">
          <div className="flex justify-between">
            <span className="font-medium">
              {journey.trainType} {journey.trainNumber}
            </span>
            <span className="text-gray-500">{journey.operator}</span>
          </div>
          <div className="mt-1 text-gray-600">
            <span>{journey.departure.station.name}</span>
            <span className="mx-2">→</span>
            <span>{journey.arrival.station.name}</span>
          </div>
          <div className="mt-1 text-xs text-gray-500">
            <span>Dep: {formatTime(journey.departure.scheduledDeparture)}</span>
            <span className="mx-3">
              Arr: {formatTime(journey.arrival.scheduledArrival)}
            </span>
            <span>Duration: {journey.duration} min</span>
          </div>
          <div className="mt-1 text-xs">
            <span
              className={`inline-block rounded px-1 ${
                journey.status === "cancelled"
                  ? "bg-red-200 text-red-800"
                  : journey.status === "delayed"
                    ? "bg-yellow-200 text-yellow-800"
                    : "bg-green-200 text-green-800"
              }`}
            >
              {journey.status}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function NSApiTest() {
  const [stationQuery, setStationQuery] = useState("Utrecht");
  const [stationResult, setStationResult] = useState<TestResult<Station[]>>({
    data: null,
    error: null,
    loading: false,
    timestamp: null,
    rawJson: null,
  });

  const [fromStation, setFromStation] = useState("Amsterdam Centraal");
  const [toStation, setToStation] = useState("Rotterdam Centraal");
  const [dateTime, setDateTime] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [journeyResult, setJourneyResult] = useState<TestResult<Journey[]>>({
    data: null,
    error: null,
    loading: false,
    timestamp: null,
    rawJson: null,
  });

  const handleSearchStations = async () => {
    setStationResult({
      data: null,
      error: null,
      loading: true,
      timestamp: null,
      rawJson: null,
    });
    const ts = getTimestamp();
    console.log(`[APITestPage][${ts}] NS Station Search: "${stationQuery}"`);

    try {
      const stations = await nsApi.searchStations(stationQuery);
      console.log(`[APITestPage][${ts}] NS Stations Result:`, stations);
      setStationResult({
        data: stations,
        error: null,
        loading: false,
        timestamp: ts,
        rawJson: JSON.stringify(stations, null, 2),
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      console.error(`[APITestPage][${ts}] NS Stations Error:`, err);
      setStationResult({
        data: null,
        error: errorMsg,
        loading: false,
        timestamp: ts,
        rawJson: null,
      });
    }
  };

  const handleSearchJourneys = async () => {
    setJourneyResult({
      data: null,
      error: null,
      loading: true,
      timestamp: null,
      rawJson: null,
    });
    const ts = getTimestamp();
    console.log(
      `[APITestPage][${ts}] NS Journey Search: ${fromStation} → ${toStation} @ ${dateTime}`
    );

    try {
      const journeys = await nsApi.searchJourneys({
        from: fromStation,
        to: toStation,
        dateTime: new Date(dateTime).toISOString(),
      });
      console.log(`[APITestPage][${ts}] NS Journeys Result:`, journeys);
      setJourneyResult({
        data: journeys,
        error: null,
        loading: false,
        timestamp: ts,
        rawJson: JSON.stringify(journeys, null, 2),
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      console.error(`[APITestPage][${ts}] NS Journeys Error:`, err);
      setJourneyResult({
        data: null,
        error: errorMsg,
        loading: false,
        timestamp: ts,
        rawJson: null,
      });
    }
  };

  return (
    <div className="space-y-8">
      {/* Station Search */}
      <section className="rounded border bg-white p-4">
        <h3 className="mb-3 font-semibold">Station Search</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={stationQuery}
            onChange={(e) => setStationQuery(e.target.value)}
            placeholder="Station name..."
            className="flex-1 rounded border px-3 py-2 text-sm"
          />
          <button
            onClick={handleSearchStations}
            disabled={stationResult.loading}
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {stationResult.loading ? <LoadingSpinner /> : "Search NS Stations"}
          </button>
        </div>
        {stationResult.timestamp && (
          <p className="mt-2 text-xs text-gray-400">
            Tested at: {stationResult.timestamp}
          </p>
        )}
        <div className="mt-3">
          {stationResult.error && <ErrorDisplay error={stationResult.error} />}
          {stationResult.data && <StationList stations={stationResult.data} />}
        </div>
        <CollapsibleJson json={stationResult.rawJson} />
      </section>

      {/* Journey Search */}
      <section className="rounded border bg-white p-4">
        <h3 className="mb-3 font-semibold">Journey Search</h3>
        <div className="grid gap-2 sm:grid-cols-3">
          <input
            type="text"
            value={fromStation}
            onChange={(e) => setFromStation(e.target.value)}
            placeholder="From station..."
            className="rounded border px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={toStation}
            onChange={(e) => setToStation(e.target.value)}
            placeholder="To station..."
            className="rounded border px-3 py-2 text-sm"
          />
          <input
            type="datetime-local"
            value={dateTime}
            onChange={(e) => setDateTime(e.target.value)}
            className="rounded border px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={handleSearchJourneys}
          disabled={journeyResult.loading}
          className="mt-2 rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {journeyResult.loading ? <LoadingSpinner /> : "Search NS Journeys"}
        </button>
        {journeyResult.timestamp && (
          <p className="mt-2 text-xs text-gray-400">
            Tested at: {journeyResult.timestamp}
          </p>
        )}
        <div className="mt-3">
          {journeyResult.error && <ErrorDisplay error={journeyResult.error} />}
          {journeyResult.data && <JourneyList journeys={journeyResult.data} />}
        </div>
        <CollapsibleJson json={journeyResult.rawJson} />
      </section>
    </div>
  );
}

// =============================================================================
// International API Test Component
// =============================================================================

type StationSearchState = {
  query: string;
  results: UnifiedStation[];
  loading: boolean;
  showDropdown: boolean;
};

function InternationalApiTest() {
  // Station selection state
  const [fromSearch, setFromSearch] = useState<StationSearchState>({
    query: "Amsterdam Centraal",
    results: [],
    loading: false,
    showDropdown: false,
  });
  const [toSearch, setToSearch] = useState<StationSearchState>({
    query: "Frankfurt",
    results: [],
    loading: false,
    showDropdown: false,
  });
  const [selectedFrom, setSelectedFrom] = useState<UnifiedStation | null>(null);
  const [selectedTo, setSelectedTo] = useState<UnifiedStation | null>(null);

  // Journey search state
  const [dateTime, setDateTime] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [journeyResult, setJourneyResult] = useState<TestResult<StoredJourney[]>>({
    data: null,
    error: null,
    loading: false,
    timestamp: null,
    rawJson: null,
  });

  // Journey detail view
  const [selectedJourney, setSelectedJourney] = useState<StoredJourney | null>(null);
  const [journeyDetails, setJourneyDetails] = useState<StoredJourney | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Refs for dropdown click-outside handling
  const fromRef = useRef<HTMLDivElement>(null);
  const toRef = useRef<HTMLDivElement>(null);

  // Debounce timer refs
  const fromTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (fromRef.current && !fromRef.current.contains(event.target as Node)) {
        setFromSearch((s) => ({ ...s, showDropdown: false }));
      }
      if (toRef.current && !toRef.current.contains(event.target as Node)) {
        setToSearch((s) => ({ ...s, showDropdown: false }));
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Search stations with debounce
  const handleFromQueryChange = (query: string) => {
    setFromSearch((s) => ({ ...s, query, showDropdown: true }));
    setSelectedFrom(null);

    if (fromTimerRef.current) clearTimeout(fromTimerRef.current);
    if (query.length < 2) {
      setFromSearch((s) => ({ ...s, results: [], loading: false }));
      return;
    }

    setFromSearch((s) => ({ ...s, loading: true }));
    fromTimerRef.current = setTimeout(async () => {
      try {
        const results = await internationalApi.searchStations(query);
        setFromSearch((s) => ({ ...s, results, loading: false }));
      } catch {
        setFromSearch((s) => ({ ...s, results: [], loading: false }));
      }
    }, 300);
  };

  const handleToQueryChange = (query: string) => {
    setToSearch((s) => ({ ...s, query, showDropdown: true }));
    setSelectedTo(null);

    if (toTimerRef.current) clearTimeout(toTimerRef.current);
    if (query.length < 2) {
      setToSearch((s) => ({ ...s, results: [], loading: false }));
      return;
    }

    setToSearch((s) => ({ ...s, loading: true }));
    toTimerRef.current = setTimeout(async () => {
      try {
        const results = await internationalApi.searchStations(query);
        setToSearch((s) => ({ ...s, results, loading: false }));
      } catch {
        setToSearch((s) => ({ ...s, results: [], loading: false }));
      }
    }, 300);
  };

  const selectFromStation = (station: UnifiedStation) => {
    setSelectedFrom(station);
    setFromSearch({
      query: station.displayName,
      results: [],
      loading: false,
      showDropdown: false,
    });
  };

  const selectToStation = (station: UnifiedStation) => {
    setSelectedTo(station);
    setToSearch({
      query: station.displayName,
      results: [],
      loading: false,
      showDropdown: false,
    });
  };

  // Search journeys
  const handleSearchJourneys = async () => {
    // Auto-search stations if not selected
    let from = selectedFrom;
    let to = selectedTo;

    if (!from && fromSearch.query) {
      const results = await internationalApi.searchStations(fromSearch.query);
      if (results.length > 0) {
        from = results[0];
        setSelectedFrom(from);
      }
    }
    if (!to && toSearch.query) {
      const results = await internationalApi.searchStations(toSearch.query);
      if (results.length > 0) {
        to = results[0];
        setSelectedTo(to);
      }
    }

    if (!from || !to) {
      setJourneyResult({
        data: null,
        error: "Please select both origin and destination stations",
        loading: false,
        timestamp: getTimestamp(),
        rawJson: null,
      });
      return;
    }

    setJourneyResult({
      data: null,
      error: null,
      loading: true,
      timestamp: null,
      rawJson: null,
    });
    setSelectedJourney(null);
    setJourneyDetails(null);

    const ts = getTimestamp();
    console.log(
      `[APITestPage][${ts}] International Journey Search: ${from.displayName} → ${to.displayName} @ ${dateTime}`
    );

    try {
      const journeys = await internationalApi.searchJourneys(
        from,
        to,
        new Date(dateTime).toISOString()
      );
      console.log(`[APITestPage][${ts}] International Journeys Result:`, journeys);
      setJourneyResult({
        data: journeys,
        error: null,
        loading: false,
        timestamp: ts,
        rawJson: JSON.stringify(journeys, null, 2),
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      console.error(`[APITestPage][${ts}] International Journeys Error:`, err);
      setJourneyResult({
        data: null,
        error: errorMsg,
        loading: false,
        timestamp: ts,
        rawJson: null,
      });
    }
  };

  // View journey details
  const handleSelectJourney = async (journey: StoredJourney) => {
    setSelectedJourney(journey);
    setDetailsLoading(true);
    setJourneyDetails(null);

    try {
      const details = await internationalApi.getJourneyDetails(journey.id, true);
      setJourneyDetails(details);
    } catch (err) {
      console.error("Failed to get journey details:", err);
      setJourneyDetails(journey); // Fallback to original journey
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeJourneyDetail = () => {
    setSelectedJourney(null);
    setJourneyDetails(null);
  };

  return (
    <div className="space-y-6">
      {/* Station Search Section */}
      <section className="rounded border bg-white p-4">
        <h3 className="mb-3 text-lg font-semibold">International Journey Search</h3>
        <p className="mb-4 text-sm text-gray-600">
          Search for train journeys between Netherlands and Germany. Combines NS and DB
          API data for complete cross-border coverage.
        </p>

        <div className="grid gap-4 md:grid-cols-3">
          {/* From Station */}
          <div ref={fromRef} className="relative">
            <label className="mb-1 block text-xs font-medium text-gray-700">
              From Station
            </label>
            <input
              type="text"
              value={fromSearch.query}
              onChange={(e) => handleFromQueryChange(e.target.value)}
              onFocus={() => setFromSearch((s) => ({ ...s, showDropdown: true }))}
              placeholder="e.g. Amsterdam Centraal"
              className={`w-full rounded border px-3 py-2 text-sm ${
                selectedFrom ? "border-green-500 bg-green-50" : ""
              }`}
            />
            {selectedFrom && (
              <span className="absolute right-2 top-7 text-green-600">✓</span>
            )}
            {fromSearch.loading && (
              <div className="absolute right-2 top-7">
                <LoadingSpinner />
              </div>
            )}
            {fromSearch.showDropdown && fromSearch.results.length > 0 && (
              <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded border bg-white shadow-lg">
                {fromSearch.results.slice(0, 10).map((station, idx) => (
                  <li
                    key={`${station.id}-${idx}`}
                    onClick={() => selectFromStation(station)}
                    className="cursor-pointer px-3 py-2 text-sm hover:bg-blue-50"
                  >
                    <span className="font-medium">{station.displayName}</span>
                    <span className="ml-2 text-xs text-gray-500">
                      {station.country}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* To Station */}
          <div ref={toRef} className="relative">
            <label className="mb-1 block text-xs font-medium text-gray-700">
              To Station
            </label>
            <input
              type="text"
              value={toSearch.query}
              onChange={(e) => handleToQueryChange(e.target.value)}
              onFocus={() => setToSearch((s) => ({ ...s, showDropdown: true }))}
              placeholder="e.g. Frankfurt"
              className={`w-full rounded border px-3 py-2 text-sm ${
                selectedTo ? "border-green-500 bg-green-50" : ""
              }`}
            />
            {selectedTo && (
              <span className="absolute right-2 top-7 text-green-600">✓</span>
            )}
            {toSearch.loading && (
              <div className="absolute right-2 top-7">
                <LoadingSpinner />
              </div>
            )}
            {toSearch.showDropdown && toSearch.results.length > 0 && (
              <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded border bg-white shadow-lg">
                {toSearch.results.slice(0, 10).map((station, idx) => (
                  <li
                    key={`${station.id}-${idx}`}
                    onClick={() => selectToStation(station)}
                    className="cursor-pointer px-3 py-2 text-sm hover:bg-blue-50"
                  >
                    <span className="font-medium">{station.displayName}</span>
                    <span className="ml-2 text-xs text-gray-500">
                      {station.country}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Date/Time */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Date & Time
            </label>
            <input
              type="datetime-local"
              value={dateTime}
              onChange={(e) => setDateTime(e.target.value)}
              className="w-full rounded border px-3 py-2 text-sm"
            />
          </div>
        </div>

        <button
          onClick={handleSearchJourneys}
          disabled={journeyResult.loading}
          className="mt-4 rounded bg-purple-600 px-6 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
        >
          {journeyResult.loading ? (
            <span className="flex items-center gap-2">
              <LoadingSpinner /> Searching both APIs...
            </span>
          ) : (
            "Search International Journeys"
          )}
        </button>

        {journeyResult.timestamp && (
          <p className="mt-2 text-xs text-gray-400">
            Searched at: {journeyResult.timestamp}
          </p>
        )}
      </section>

      {/* Error Display */}
      {journeyResult.error && (
        <div className="rounded bg-red-100 p-3 text-sm text-red-700">
          {journeyResult.error}
        </div>
      )}

      {/* Journey Results */}
      {journeyResult.data && journeyResult.data.length > 0 && !selectedJourney && (
        <section className="rounded border bg-white p-4">
          <h3 className="mb-3 font-semibold">
            Found {journeyResult.data.length} Journey{journeyResult.data.length !== 1 ? "s" : ""}
          </h3>
          <p className="mb-3 text-xs text-gray-500">
            Click on a journey to see detailed stop information
          </p>
          <InternationalJourneyList
            journeys={journeyResult.data}
            onSelect={handleSelectJourney}
          />
          <CollapsibleJson json={journeyResult.rawJson} />
        </section>
      )}

      {journeyResult.data && journeyResult.data.length === 0 && (
        <div className="rounded bg-yellow-50 p-4 text-sm text-yellow-800">
          No journeys found for this route. Try adjusting the date/time or station names.
        </div>
      )}

      {/* Journey Detail View */}
      {selectedJourney && (
        <section className="rounded border bg-white p-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">
              Journey Details: {selectedJourney.trainType} {selectedJourney.trainNumber}
            </h3>
            <button
              onClick={closeJourneyDetail}
              className="rounded bg-gray-100 px-3 py-1 text-sm text-gray-600 hover:bg-gray-200"
            >
              ← Back to Results
            </button>
          </div>

          {detailsLoading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner />
              <span className="ml-2 text-sm text-gray-500">Loading journey details...</span>
            </div>
          ) : (
            <JourneyDetailView journey={journeyDetails ?? selectedJourney} />
          )}
        </section>
      )}
    </div>
  );
}

// International journey list component
function InternationalJourneyList({
  journeys,
  onSelect,
}: {
  journeys: StoredJourney[];
  onSelect: (journey: StoredJourney) => void;
}) {
  return (
    <ul className="space-y-2">
      {journeys.map((journey, idx) => {
        const originStop = journey.stops[0];
        const destStop = journey.stops[journey.stops.length - 1];
        const sourceLabel = journey.sources.length > 1 ? "merged" : journey.sources[0] ?? "unknown";
        
        return (
          <li
            key={`${journey.journeyKey}-${idx}`}
            onClick={() => onSelect(journey)}
            className="cursor-pointer rounded border bg-gray-50 p-3 transition-colors hover:border-purple-300 hover:bg-purple-50"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="font-medium">
                  {journey.trainType} {journey.trainNumber}
                </span>
                <span className="ml-2 text-sm text-gray-500">{journey.operator}</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded px-2 py-0.5 text-xs ${
                    sourceLabel === "merged"
                      ? "bg-purple-100 text-purple-700"
                      : sourceLabel === "NS"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-green-100 text-green-700"
                  }`}
                >
                  {sourceLabel}
                </span>
                <span
                  className={`rounded px-2 py-0.5 text-xs ${
                    journey.status === "cancelled"
                      ? "bg-red-200 text-red-800"
                      : journey.status === "delayed"
                        ? "bg-yellow-200 text-yellow-800"
                        : "bg-green-200 text-green-800"
                  }`}
                >
                  {journey.status}
                </span>
              </div>
            </div>

            <div className="mt-2 flex items-center text-sm">
              <div className="flex-1">
                <div className="font-medium">{journey.originStationName}</div>
                <div className="text-gray-500">
                  {formatTime(journey.scheduledDeparture)}
                  {originStop?.plannedPlatform && (
                    <span className="ml-2">Platform {originStop.actualPlatform ?? originStop.plannedPlatform}</span>
                  )}
                </div>
              </div>
              <div className="px-4 text-center text-gray-400">
                <div className="text-xs">{journey.durationMinutes} min</div>
                <div className="text-lg">→</div>
              </div>
              <div className="flex-1 text-right">
                <div className="font-medium">{journey.destinationStationName}</div>
                <div className="text-gray-500">
                  {formatTime(journey.scheduledArrival)}
                  {destStop?.plannedPlatform && (
                    <span className="ml-2">Platform {destStop.actualPlatform ?? destStop.plannedPlatform}</span>
                  )}
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// Journey detail view with all stops
function JourneyDetailView({ journey }: { journey: StoredJourney }) {
  const stops = journey.stops ?? [];

  return (
    <div>
      {/* Journey summary */}
      <div className="mb-4 rounded bg-gray-50 p-3">
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <div className="text-xs text-gray-500">Train</div>
            <div className="font-medium">
              {journey.trainType} {journey.trainNumber}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Operator</div>
            <div className="font-medium">{journey.operator}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Duration</div>
            <div className="font-medium">{journey.durationMinutes} minutes</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Status</div>
            <div
              className={`inline-block rounded px-2 py-0.5 text-sm font-medium ${
                journey.status === "cancelled"
                  ? "bg-red-100 text-red-700"
                  : journey.status === "delayed"
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-green-100 text-green-700"
              }`}
            >
              {journey.status}
            </div>
          </div>
        </div>
        <div className="mt-2 text-xs text-gray-500">
          Data sources: {journey.sources.join(" + ")}
        </div>
      </div>

      {/* Stops timeline */}
      <div className="mb-4">
        <h4 className="mb-2 text-sm font-semibold">Route & Stops</h4>
        {stops.length === 0 ? (
          <p className="text-sm text-gray-500">
            No detailed stop information available.
          </p>
        ) : null}
      </div>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-2 h-[calc(100%-16px)] w-0.5 bg-gray-200" />

        {/* All stops in sequence */}
        {stops.map((stop, idx) => (
          <StoredStopItem
            key={`${stop.stationId}-${idx}`}
            stop={stop}
            type={idx === 0 ? "departure" : idx === stops.length - 1 ? "arrival" : "intermediate"}
            isFirst={idx === 0}
          />
        ))}
      </div>
    </div>
  );
}

// Individual stop in the timeline
function StopItem({
  stop,
  type,
  isFirst,
}: {
  stop: MergedJourneyStop;
  type: "departure" | "intermediate" | "arrival";
  isFirst: boolean;
}) {
  const time =
    type === "departure" ? stop.scheduledDeparture : stop.scheduledArrival;
  const delay =
    type === "departure" ? stop.departureDelay : stop.arrivalDelay;

  return (
    <div className={`relative flex items-start gap-4 ${isFirst ? "" : "mt-3"}`}>
      {/* Timeline dot */}
      <div
        className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full ${
          type === "departure"
            ? "bg-green-500 text-white"
            : type === "arrival"
              ? "bg-red-500 text-white"
              : "bg-white border-2 border-gray-300"
        }`}
      >
        {type === "departure" && "↑"}
        {type === "arrival" && "↓"}
        {type === "intermediate" && "•"}
      </div>

      {/* Stop info */}
      <div className="flex-1 pb-2">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-medium">{stop.station.name}</div>
            <div className="text-xs text-gray-500">
              {stop.station.country}
              {stop.source && ` • via ${stop.source} API`}
            </div>
          </div>
          <div className="text-right">
            <div className="font-medium">{formatTime(time)}</div>
            {delay && delay > 0 && (
              <div className="text-xs text-red-600">+{delay} min</div>
            )}
          </div>
        </div>

        {/* Platform info */}
        {stop.platform && (
          <div className="mt-1 inline-block rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
            Platform {stop.platform}
            {stop.plannedPlatform &&
              stop.actualPlatform &&
              stop.plannedPlatform !== stop.actualPlatform && (
                <span className="ml-1 text-orange-600">
                  (was {stop.plannedPlatform})
                </span>
              )}
          </div>
        )}

        {stop.cancelled && (
          <div className="mt-1 inline-block rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">
            Cancelled
          </div>
        )}
      </div>
    </div>
  );
}

// Individual stop in the timeline for StoredJourneyStop
function StoredStopItem({
  stop,
  type,
  isFirst,
}: {
  stop: import("../types/train").StoredJourneyStop;
  type: "departure" | "intermediate" | "arrival";
  isFirst: boolean;
}) {
  const time =
    type === "departure" ? stop.scheduledDeparture : stop.scheduledArrival;
  const delay =
    type === "departure" ? stop.departureDelayMin : stop.arrivalDelayMin;

  return (
    <div className={`relative flex items-start gap-4 ${isFirst ? "" : "mt-3"}`}>
      {/* Timeline dot */}
      <div
        className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full ${
          type === "departure"
            ? "bg-green-500 text-white"
            : type === "arrival"
              ? "bg-red-500 text-white"
              : "bg-white border-2 border-gray-300"
        }`}
      >
        {type === "departure" && "↑"}
        {type === "arrival" && "↓"}
        {type === "intermediate" && "•"}
      </div>

      {/* Stop info */}
      <div className="flex-1 pb-2">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-medium">{stop.stationName}</div>
            <div className="text-xs text-gray-500">
              {stop.country}
              {stop.source && ` • via ${stop.source} API`}
            </div>
          </div>
          <div className="text-right">
            <div className="font-medium">{formatTime(time)}</div>
            {delay && delay > 0 && (
              <div className="text-xs text-red-600">+{delay} min</div>
            )}
          </div>
        </div>

        {/* Platform info */}
        {(stop.plannedPlatform || stop.actualPlatform) && (
          <div className="mt-1 inline-block rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
            Platform {stop.actualPlatform ?? stop.plannedPlatform}
            {stop.plannedPlatform &&
              stop.actualPlatform &&
              stop.plannedPlatform !== stop.actualPlatform && (
                <span className="ml-1 text-orange-600">
                  (was {stop.plannedPlatform})
                </span>
              )}
          </div>
        )}

        {stop.cancelled && (
          <div className="mt-1 inline-block rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">
            Cancelled
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// DB API Test Component (enhanced with autocomplete + detail view)
// =============================================================================

function DBApiTest() {
  // Journey search state
  const [journeyResult, setJourneyResult] = useState<TestResult<Journey[]>>({
    data: null,
    error: null,
    loading: false,
    timestamp: null,
    rawJson: null,
  });

  // Journey detail state
  const [selectedJourney, setSelectedJourney] = useState<Journey | null>(null);
  const [detailedJourney, setDetailedJourney] = useState<Journey | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Search handler
  const handleSearch = async (fromStation: Station, toStation: Station, dateTime: string) => {
    setJourneyResult({
      data: null,
      error: null,
      loading: true,
      timestamp: null,
      rawJson: null,
    });
    setSelectedJourney(null);
    setDetailedJourney(null);

    const ts = getTimestamp();
    console.log(
      `[APITestPage][${ts}] DB Journey Search: ${fromStation.name} (${fromStation.uicCode}) → ${toStation.name} (${toStation.uicCode}) @ ${dateTime}`
    );

    try {
      const primaryJourneys = await dbApi.searchJourneysStrict({
        from: fromStation.uicCode ?? "",
        to: toStation.uicCode ?? "",
        dateTime,
      });
      let journeys = primaryJourneys;
      let fallbackStation: Station | null = null;

      if (journeys.length === 0) {
        const fallbackName = toStation.name.replace(/\s*\(tief\)/i, "").trim();
        if (fallbackName && fallbackName !== toStation.name) {
          const candidates = await dbApi.searchStations(fallbackName);
          const candidate = candidates.find(
            (station) =>
              station.uicCode &&
              station.uicCode !== toStation.uicCode &&
              !station.name.toLowerCase().includes("tief")
          );
          if (candidate) {
            fallbackStation = candidate;
            journeys = await dbApi.searchJourneysStrict({
              from: fromStation.uicCode ?? "",
              to: candidate.uicCode ?? "",
              dateTime,
            });
          }
        }
      }

      console.log(`[APITestPage][${ts}] DB Journeys Result:`, journeys);
      setJourneyResult({
        data: journeys,
        error: null,
        loading: false,
        timestamp: ts,
        rawJson: JSON.stringify(journeys, null, 2),
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      console.error(`[APITestPage][${ts}] DB Journeys Error:`, err);
      setJourneyResult({
        data: null,
        error: errorMsg,
        loading: false,
        timestamp: ts,
        rawJson: null,
      });
    }
  };

  // Select journey and fetch details
  const handleSelectJourney = async (journey: Journey) => {
    setSelectedJourney(journey);
    setDetailedJourney(null);
    setDetailLoading(true);

    const ts = getTimestamp();
    console.log(
      `[APITestPage][${ts}] Fetching DB journey details for ${journey.trainType} ${journey.trainNumber}`
    );

    try {
      const details = await dbApi.resolveJourneyDetail(
        journey.trainNumber,
        journey.trainType,
        journey.departure.scheduledDeparture ?? new Date().toISOString(),
        journey.departure.station.uicCode ?? journey.departure.station.code
      );
      console.log(`[APITestPage][${ts}] DB Journey Details:`, details);
      setDetailedJourney(details);
    } catch (err) {
      console.error(`[APITestPage][${ts}] DB Journey Details Error:`, err);
      // Still show the original journey if details fetch fails
    } finally {
      setDetailLoading(false);
    }
  };

  const handleBackToResults = () => {
    setSelectedJourney(null);
    setDetailedJourney(null);
  };

  return (
    <div className="space-y-6">
      {/* Search Panel */}
      <DBJourneySearchPanel onSearch={handleSearch} loading={journeyResult.loading} />

      {/* Error Display */}
      {journeyResult.error && (
        <div className="rounded bg-red-100 p-3 text-sm text-red-700">
          {journeyResult.error}
        </div>
      )}

      {/* Journey Results or Detail View */}
      {selectedJourney ? (
        <DBJourneyDetail
          journey={selectedJourney}
          detailedJourney={detailedJourney}
          loading={detailLoading}
          onBack={handleBackToResults}
        />
      ) : (
        journeyResult.data &&
        journeyResult.data.length > 0 && (
          <DBJourneyResults
            journeys={journeyResult.data}
            onSelect={handleSelectJourney}
            rawJson={journeyResult.rawJson}
            timestamp={journeyResult.timestamp}
          />
        )
      )}

      {journeyResult.data && journeyResult.data.length === 0 && !selectedJourney && (
        <div className="rounded bg-yellow-50 p-4 text-sm text-yellow-800">
          No journeys found for this route. Try adjusting the date/time or station names.
        </div>
      )}
    </div>
  );
}

export default function APITestPage() {
  const [activeTab, setActiveTab] = useState<TabId>("international");

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">API Test Page</h1>
      <p className="mb-6 text-sm text-gray-600">
        Test NS, DB, and International API integrations. Check the browser console for detailed
        logs.
      </p>

      {/* Tabs */}
      <div className="mb-6 flex border-b">
        <button
          onClick={() => setActiveTab("international")}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === "international"
              ? "border-b-2 border-purple-600 text-purple-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          International (NL ↔ DE)
        </button>
        <button
          onClick={() => setActiveTab("ns")}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === "ns"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          NS API (Netherlands)
        </button>
        <button
          onClick={() => setActiveTab("db")}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === "db"
              ? "border-b-2 border-green-600 text-green-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          DB API (Germany)
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "international" && <InternationalApiTest />}
      {activeTab === "ns" && <NSApiTest />}
      {activeTab === "db" && <DBApiTest />}
    </div>
  );
}
