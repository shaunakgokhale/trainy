import { useState } from "react";
import type { Journey, JourneyStop } from "../types/train";

type Props = {
  journey: Journey;
  detailedJourney: Journey | null;
  loading: boolean;
  onBack: () => void;
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
        <pre className="mt-2 max-h-96 overflow-auto rounded bg-gray-100 p-2 text-xs">
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

function LoadingSpinner() {
  return (
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-green-600" />
  );
}

function StopItem({
  stop,
  type,
  isFirst,
}: {
  stop: JourneyStop;
  type: "departure" | "intermediate" | "arrival";
  isFirst: boolean;
}) {
  const time = type === "departure" ? stop.scheduledDeparture : stop.scheduledArrival;
  const delay = type === "departure" ? stop.departureDelay : stop.arrivalDelay;

  return (
    <div className={`relative flex items-start gap-4 ${isFirst ? "" : "mt-3"}`}>
      {/* Timeline dot */}
      <div
        className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full ${
          type === "departure"
            ? "bg-green-500 text-white"
            : type === "arrival"
              ? "bg-red-500 text-white"
              : "border-2 border-gray-300 bg-white"
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
              {stop.station.uicCode && ` • EVA ${stop.station.uicCode}`}
            </div>
          </div>
          <div className="text-right">
            <div className="font-medium">{formatTime(time)}</div>
            {delay && delay > 0 && <div className="text-xs text-red-600">+{delay} min</div>}
          </div>
        </div>

        {/* Platform info */}
        {(stop.plannedPlatform || stop.actualPlatform || stop.platform) && (
          <div className="mt-1 inline-block rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
            Platform {stop.actualPlatform ?? stop.platform ?? stop.plannedPlatform}
            {stop.plannedPlatform &&
              stop.actualPlatform &&
              stop.plannedPlatform !== stop.actualPlatform && (
                <span className="ml-1 text-orange-600">(was {stop.plannedPlatform})</span>
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

export function DBJourneyDetail({ journey, detailedJourney, loading, onBack }: Props) {
  const displayJourney = detailedJourney ?? journey;
  const stops = displayJourney.stops ?? [];
  const hasDetailedStops = detailedJourney !== null && stops.length > 1;

  return (
    <section className="rounded border bg-white p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">
          Journey Details: {displayJourney.trainType} {displayJourney.trainNumber}
        </h3>
        <button
          onClick={onBack}
          className="rounded bg-gray-100 px-3 py-1 text-sm text-gray-600 hover:bg-gray-200"
        >
          ← Back to Results
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner />
          <span className="ml-2 text-sm text-gray-500">Loading journey details from RIS::Journeys...</span>
        </div>
      ) : (
        <>
          {/* Journey summary */}
          <div className="mb-4 rounded bg-gray-50 p-3">
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <div className="text-xs text-gray-500">Train</div>
                <div className="font-medium">
                  {displayJourney.trainType} {displayJourney.trainNumber}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Operator</div>
                <div className="font-medium">{displayJourney.operator}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Duration</div>
                <div className="font-medium">
                  {displayJourney.duration > 0 ? `${displayJourney.duration} minutes` : "-"}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Status</div>
                <div
                  className={`inline-block rounded px-2 py-0.5 text-sm font-medium ${
                    displayJourney.status === "cancelled"
                      ? "bg-red-100 text-red-700"
                      : displayJourney.status === "delayed"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-green-100 text-green-700"
                  }`}
                >
                  {displayJourney.status}
                </div>
              </div>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              Data source: {detailedJourney ? "RIS::Journeys (full)" : "Timetables (partial)"}
            </div>
          </div>

          {/* Stops timeline */}
          <div className="mb-4">
            <h4 className="mb-2 text-sm font-semibold">Route & Stops</h4>
            {!hasDetailedStops && (
              <p className="mb-2 text-xs text-yellow-700 bg-yellow-50 p-2 rounded">
                Full stop information not available. Showing origin/destination only.
              </p>
            )}
          </div>

          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-2 h-[calc(100%-16px)] w-0.5 bg-gray-200" />

            {hasDetailedStops ? (
              stops.map((stop, idx) => (
                <StopItem
                  key={`${stop.station.code}-${idx}`}
                  stop={stop}
                  type={idx === 0 ? "departure" : idx === stops.length - 1 ? "arrival" : "intermediate"}
                  isFirst={idx === 0}
                />
              ))
            ) : (
              <>
                <StopItem stop={displayJourney.departure} type="departure" isFirst={true} />
                <StopItem stop={displayJourney.arrival} type="arrival" isFirst={false} />
              </>
            )}
          </div>

          {/* Raw JSON toggles */}
          <div className="mt-6 border-t pt-4">
            <h4 className="mb-2 text-sm font-semibold">Raw API Responses</h4>
            <CollapsibleJson
              json={journey.rawData ? JSON.stringify(journey.rawData, null, 2) : null}
              label="Timetables Response"
            />
            {detailedJourney && (
              <CollapsibleJson
                json={detailedJourney.rawData ? JSON.stringify(detailedJourney.rawData, null, 2) : null}
                label="RIS::Journeys Response"
              />
            )}
          </div>
        </>
      )}
    </section>
  );
}
