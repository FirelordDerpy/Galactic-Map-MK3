import { ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { regionColor, type StarSystem } from "@/lib/galaxy";

export function SystemPanel({
  system,
  onClose,
  onHighlightLane,
}: {
  system: StarSystem;
  onClose: () => void;
  onHighlightLane: (name: string | null) => void;
}) {
  return (
    <aside
      className="absolute inset-x-0 bottom-0 z-20 flex max-h-[62vh] flex-col overflow-hidden rounded-t-xl border border-border bg-surface shadow-panel md:inset-y-4 md:right-4 md:left-auto md:max-h-none md:w-[22.5rem] md:rounded-xl"
      role="dialog"
      aria-label={system.name}
    >
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <p className="text-xs tracking-wide text-muted uppercase">{system.region}</p>
          <h2 className="font-display text-2xl leading-tight text-fg">{system.name}</h2>
          <p className="mt-1 text-sm text-muted">
            {[system.sector, system.grid].filter(Boolean).join(" · ")}
          </p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
          <X />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <div className="mb-4 flex items-center gap-2">
          <span className="size-2.5 rounded-full" style={{ background: regionColor(system.region) }} />
          <span className="text-sm text-muted">
            {system.dev || "Undeveloped"}
            {system.type ? ` · ${system.type}` : ""}
          </span>
        </div>
        <dl className="divide-y divide-border text-sm">
          <Row label="Coordinates" value={`${Math.round(system.x)}, ${Math.round(system.y)}`} />
          {system.wealth ? <Row label="Region wealth" value={system.wealth} /> : null}
          {system.monthly ? <Row label="Monthly value" value={system.monthly} /> : null}
          {system.industry ? <Row label="Industry" value={system.industry} /> : null}
          {system.ess ? <Row label="Essentials" value={system.ess} /> : null}
          {system.lux ? <Row label="Luxuries" value={system.lux} /> : null}
        </dl>
        {system.blurb ? <p className="mt-4 text-sm leading-relaxed text-muted">{system.blurb}</p> : null}
        {system.lanes.length > 0 ? (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">Hyperlanes</p>
            <div className="flex flex-wrap gap-1.5">
              {system.lanes.map((lane) => (
                <button
                  key={lane}
                  type="button"
                  className="rounded-md border border-border bg-surface-2 px-2 py-1 text-xs text-fg hover:border-accent"
                  onMouseEnter={() => onHighlightLane(lane)}
                  onMouseLeave={() => onHighlightLane(null)}
                  onFocus={() => onHighlightLane(lane)}
                  onBlur={() => onHighlightLane(null)}
                >
                  {lane}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {system.wiki ? (
          <a
            href={system.wiki}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg"
          >
            Wookieepedia
            <ExternalLink className="size-3.5" />
          </a>
        ) : null}
      </div>
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-2">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right text-fg">{value}</dd>
    </div>
  );
}
