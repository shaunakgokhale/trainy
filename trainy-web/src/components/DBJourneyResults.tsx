import { useState } from "react";
import type { Journey } from "../types/train";

type Props = {
  journeys: Journey[];
  onSelect: (journey: Journey) => void;
  rawJson: string | null;
  timestamp: string | null;
};

function CollapsibleJson({ json, label }: { json: string | null; label?: string }) {
  const [open, setOpen] = useState(false);
  if (!json) return null;

  return (
    <div className="mt-2">
      <button onClick={() => setOpen(!open)} className="text-xs text-blue-600 underline">
        {open ? "Hide" : "Show"} {label ?? "Raw JSON"}
      </button>
      {open && (
        <pre className="mt-2 max-h-64 overflow-auto rounded bg-gray-100 p-2 text-xs">
          {json}
        </pre>
      )}
    </div>
  );
}

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

export function DBJourneyResults({ journeys, onSelect, rawJson, timestamp }: Props) {
  if (journeys.length === 0) {
    return (
      <div className="rounded bg-yellow-50 p-4 text-sm text-yellow-800">
        No journeys found for this route. Try adjusting the date/time or station names.
      </div>
    );
  }

  return (
    <section className="rounded border bg-white p-4">
      <h3 className="mb-3 font-semibold">
        Found {journeys.length} Journey{journeys.length !== 1 ? "s" : ""}
      </h3>
      {timestamp && <p className="mb-2 text-xs text-gray-400">Searched at: {timestamp}</p>}
      <p className="mb-3 text-xs text-gray-500">
        Click on a journey to see detailed stop information from RIS::Journeys API
      </p>

      <ul className="space-y-2">
        {journeys.map((journey, idx) => {
          const isCancelled = journey.status === "cancelled";
          const isDelayed = journey.status === "delayed";

          return (
            <li
              key={`${journey.id}-${idx}`}
              onClick={() => onSelect(journey)}
              className="cursor-pointer rounded border bg-gray-50 p-3 transition-colors hover:border-green-300 hover:bg-green-50"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-medium">
                    {journey.trainType} {journey.trainNumber}
                  </span>
                  <span className="ml-2 text-sm text-gray-500">{journey.operator}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
                    DB
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      isCancelled
                        ? "bg-red-200 text-red-800"
                        : isDelayed
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
                  <div className="font-medium">{journey.departure.station.name}</div>
                  <div className="text-gray-500">
                    {formatTime(journey.departure.scheduledDeparture)}
                    {journey.departure.platform && (
                      <span className="ml-2">
                        Pl. {journey.departure.actualPlatform ?? journey.departure.platform}
                      </span>
                    )}
                  </div>
                </div>
                <div className="px-4 text-center text-gray-400">
                  <div className="text-xs">{journey.duration > 0 ? `${journey.duration} min` : "-"}</div>
                  <div className="text-lg">→</div>
                </div>
                <div className="flex-1 text-right">
                  <div className="font-medium">{journey.arrival.station.name}</div>
                  <div className="text-gray-500">
                    {formatTime(journey.arrival.scheduledArrival)}
                    {journey.arrival.platform && (
                      <span className="ml-2">
                        Pl. {journey.arrival.actualPlatform ?? journey.arrival.platform}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <CollapsibleJson json={rawJson} label="Timetables API Response" />
    </section>
  );
}
