import { useState } from "react";
import * as nsApi from "../services/nsApi";
import * as dbApi from "../services/dbApi";
import type { Journey, Station } from "../types/train";

type TabId = "ns" | "db";

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

function DBApiTest() {
  const [stationQuery, setStationQuery] = useState("Frankfurt");
  const [stationResult, setStationResult] = useState<TestResult<Station[]>>({
    data: null,
    error: null,
    loading: false,
    timestamp: null,
    rawJson: null,
  });

  const [fromStation, setFromStation] = useState("8000105"); // Frankfurt Hbf
  const [toStation, setToStation] = useState("8000261"); // München Hbf
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
    console.log(`[APITestPage][${ts}] DB Station Search: "${stationQuery}"`);

    try {
      const stations = await dbApi.searchStations(stationQuery);
      console.log(`[APITestPage][${ts}] DB Stations Result:`, stations);
      setStationResult({
        data: stations,
        error: null,
        loading: false,
        timestamp: ts,
        rawJson: JSON.stringify(stations, null, 2),
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      console.error(`[APITestPage][${ts}] DB Stations Error:`, err);
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
      `[APITestPage][${ts}] DB Journey Search: ${fromStation} → ${toStation} @ ${dateTime}`
    );

    try {
      const journeys = await dbApi.searchJourneys({
        from: fromStation,
        to: toStation,
        dateTime: new Date(dateTime).toISOString(),
      });
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
            className="rounded bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
          >
            {stationResult.loading ? <LoadingSpinner /> : "Search DB Stations"}
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
        <p className="mb-2 text-xs text-gray-500">
          Tip: Use station IDs (e.g., 8000105 = Frankfurt Hbf, 8000261 = München
          Hbf, 8011160 = Berlin Hbf)
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          <input
            type="text"
            value={fromStation}
            onChange={(e) => setFromStation(e.target.value)}
            placeholder="From station ID..."
            className="rounded border px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={toStation}
            onChange={(e) => setToStation(e.target.value)}
            placeholder="To station ID..."
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
          className="mt-2 rounded bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
        >
          {journeyResult.loading ? <LoadingSpinner /> : "Search DB Journeys"}
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

export default function APITestPage() {
  const [activeTab, setActiveTab] = useState<TabId>("ns");

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">API Test Page</h1>
      <p className="mb-6 text-sm text-gray-600">
        Test NS and DB API integrations. Check the browser console for detailed
        logs.
      </p>

      {/* Tabs */}
      <div className="mb-6 flex border-b">
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
      {activeTab === "ns" && <NSApiTest />}
      {activeTab === "db" && <DBApiTest />}
    </div>
  );
}
