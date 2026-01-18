import { useState, useEffect, useRef } from "react";
import * as dbApi from "../services/dbApi";
import type { Station } from "../types/train";

type StationSearchState = {
  query: string;
  results: Station[];
  loading: boolean;
  showDropdown: boolean;
};

type Props = {
  onSearch: (fromStation: Station, toStation: Station, dateTime: string) => void;
  loading: boolean;
};

export function DBJourneySearchPanel({ onSearch, loading }: Props) {
  const [fromSearch, setFromSearch] = useState<StationSearchState>({
    query: "Frankfurt",
    results: [],
    loading: false,
    showDropdown: false,
  });
  const [toSearch, setToSearch] = useState<StationSearchState>({
    query: "München",
    results: [],
    loading: false,
    showDropdown: false,
  });
  const [selectedFrom, setSelectedFrom] = useState<Station | null>(null);
  const [selectedTo, setSelectedTo] = useState<Station | null>(null);
  const [dateTime, setDateTime] = useState(new Date().toISOString().slice(0, 16));

  const fromRef = useRef<HTMLDivElement>(null);
  const toRef = useRef<HTMLDivElement>(null);
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
        const results = await dbApi.searchStations(query);
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
        const results = await dbApi.searchStations(query);
        setToSearch((s) => ({ ...s, results, loading: false }));
      } catch {
        setToSearch((s) => ({ ...s, results: [], loading: false }));
      }
    }, 300);
  };

  const selectFromStation = (station: Station) => {
    setSelectedFrom(station);
    setFromSearch({
      query: station.name,
      results: [],
      loading: false,
      showDropdown: false,
    });
  };

  const selectToStation = (station: Station) => {
    setSelectedTo(station);
    setToSearch({
      query: station.name,
      results: [],
      loading: false,
      showDropdown: false,
    });
  };

  const handleSubmit = async () => {
    let from = selectedFrom;
    let to = selectedTo;

    // Auto-resolve if not selected
    if (!from && fromSearch.query) {
      const results = await dbApi.searchStations(fromSearch.query);
      if (results.length > 0) {
        from = results[0];
        setSelectedFrom(from);
      }
    }
    if (!to && toSearch.query) {
      const results = await dbApi.searchStations(toSearch.query);
      if (results.length > 0) {
        to = results[0];
        setSelectedTo(to);
      }
    }

    if (!from?.uicCode || !to?.uicCode) {
      return;
    }

    onSearch(from, to, dateTime);
  };

  const LoadingSpinner = () => (
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-green-600" />
  );

  return (
    <section className="rounded border bg-white p-4">
      <h3 className="mb-3 text-lg font-semibold">DB Journey Search</h3>
      <p className="mb-4 text-sm text-gray-600">
        Search for train journeys within Germany. Uses DB Timetables + RIS::Journeys APIs.
      </p>

      <div className="grid gap-4 md:grid-cols-3">
        {/* From Station */}
        <div ref={fromRef} className="relative">
          <label className="mb-1 block text-xs font-medium text-gray-700">From Station</label>
          <input
            type="text"
            value={fromSearch.query}
            onChange={(e) => handleFromQueryChange(e.target.value)}
            onFocus={() => setFromSearch((s) => ({ ...s, showDropdown: true }))}
            placeholder="e.g. Frankfurt Hbf"
            className={`w-full rounded border px-3 py-2 text-sm ${
              selectedFrom ? "border-green-500 bg-green-50" : ""
            }`}
          />
          {selectedFrom && <span className="absolute right-2 top-7 text-green-600">✓</span>}
          {fromSearch.loading && (
            <div className="absolute right-2 top-7"><LoadingSpinner /></div>
          )}
          {fromSearch.showDropdown && fromSearch.results.length > 0 && (
            <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded border bg-white shadow-lg">
              {fromSearch.results.slice(0, 10).map((station, idx) => (
                <li
                  key={`${station.uicCode}-${idx}`}
                  onClick={() => selectFromStation(station)}
                  className="cursor-pointer px-3 py-2 text-sm hover:bg-green-50"
                >
                  <span className="font-medium">{station.name}</span>
                  <span className="ml-2 text-xs text-gray-500">[{station.uicCode}]</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* To Station */}
        <div ref={toRef} className="relative">
          <label className="mb-1 block text-xs font-medium text-gray-700">To Station</label>
          <input
            type="text"
            value={toSearch.query}
            onChange={(e) => handleToQueryChange(e.target.value)}
            onFocus={() => setToSearch((s) => ({ ...s, showDropdown: true }))}
            placeholder="e.g. München Hbf"
            className={`w-full rounded border px-3 py-2 text-sm ${
              selectedTo ? "border-green-500 bg-green-50" : ""
            }`}
          />
          {selectedTo && <span className="absolute right-2 top-7 text-green-600">✓</span>}
          {toSearch.loading && (
            <div className="absolute right-2 top-7"><LoadingSpinner /></div>
          )}
          {toSearch.showDropdown && toSearch.results.length > 0 && (
            <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded border bg-white shadow-lg">
              {toSearch.results.slice(0, 10).map((station, idx) => (
                <li
                  key={`${station.uicCode}-${idx}`}
                  onClick={() => selectToStation(station)}
                  className="cursor-pointer px-3 py-2 text-sm hover:bg-green-50"
                >
                  <span className="font-medium">{station.name}</span>
                  <span className="ml-2 text-xs text-gray-500">[{station.uicCode}]</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Date/Time */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Date & Time</label>
          <input
            type="datetime-local"
            value={dateTime}
            onChange={(e) => setDateTime(e.target.value)}
            className="w-full rounded border px-3 py-2 text-sm"
          />
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="mt-4 rounded bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <LoadingSpinner /> Searching DB...
          </span>
        ) : (
          "Search DB Journeys"
        )}
      </button>
    </section>
  );
}
