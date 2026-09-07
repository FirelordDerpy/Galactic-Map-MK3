import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, Copy, ExternalLink, Pentagon, Plus, Trash2, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  copyText,
  copyWorlds,
  sectorShapeCell,
  type ChartTool,
  type DraftSector,
  type DraftWorld,
} from "@/lib/chart-tools";
import {
  missingCount,
  missingPlanets,
  missingSectorCount,
  missingSectors,
  wikiUrl,
  type CatalogPlanet,
  type CatalogSector,
} from "@/lib/catalog";
import { REGION_ORDER, regionColor, type GalaxyData } from "@/lib/galaxy";
import { cn } from "@/lib/utils";

export function ChartToolsPanel({
  tool,
  onTool,
  current,
  onCurrent,
  worlds,
  onWorlds,
  sector,
  onSector,
  cursor,
  data,
  onPickCatalog,
  onPickCatalogSector,
  onClose,
}: {
  tool: Exclude<ChartTool, "off">;
  onTool: (tool: Exclude<ChartTool, "off">) => void;
  current: DraftWorld | null;
  onCurrent: (next: DraftWorld | null) => void;
  worlds: DraftWorld[];
  onWorlds: (next: DraftWorld[]) => void;
  sector: DraftSector | null;
  onSector: (next: DraftSector | null) => void;
  cursor: { x: number; y: number; grid: string } | null;
  data: GalaxyData;
  onPickCatalog: (planet: CatalogPlanet) => void;
  onPickCatalogSector: (sector: CatalogSector) => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [sectorQuery, setSectorQuery] = useState("");

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(null), 1400);
    return () => window.clearTimeout(t);
  }, [copied]);

  async function copy(key: string, text: string) {
    const ok = await copyText(text);
    if (ok) setCopied(key);
  }

  function queueCurrent() {
    if (!current) return;
    const row = { ...current, name: current.name.trim() || "Unnamed" };
    onWorlds([...worlds.filter((w) => w.id !== row.id), row]);
    onCurrent(null);
  }

  const shape = sector && sector.pts.length >= 3 ? sectorShapeCell(sector.name, sector.pts) : "";
  const absent = useMemo(() => missingPlanets(data.systems, catalogQuery, 36), [data.systems, catalogQuery]);
  const absentTotal = useMemo(() => missingCount(data.systems), [data.systems]);
  const absentSectors = useMemo(() => missingSectors(data, sectorQuery, 36), [data, sectorQuery]);
  const absentSectorTotal = useMemo(() => missingSectorCount(data), [data]);

  return (
    <aside
      className="absolute inset-x-0 bottom-0 z-20 flex max-h-[62vh] flex-col overflow-hidden rounded-t-xl border border-border bg-surface shadow-panel md:inset-y-4 md:right-4 md:left-auto md:max-h-none md:w-[22.5rem] md:rounded-xl"
      role="dialog"
      aria-label="Chart tools"
    >
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <h2 className="font-display text-2xl leading-tight text-fg">Chart tools</h2>
          <p className="mt-1 text-sm text-muted">Place worlds and draw sectors, then paste into the sheet.</p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close chart tools">
          <X />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <div className="grid grid-cols-2 gap-1 rounded-md bg-surface-2 p-1">
          <ToolTab active={tool === "place"} onClick={() => onTool("place")}>
            Place world
          </ToolTab>
          <ToolTab active={tool === "draw"} onClick={() => onTool("draw")}>
            Draw sector
          </ToolTab>
        </div>

        <p className="mt-3 font-mono text-xs tabular-nums text-subtle">
          {cursor ? `${cursor.x}, ${cursor.y}${cursor.grid ? ` · ${cursor.grid}` : ""}` : "Move over the map"}
        </p>

        {tool === "place" ? (
          <section className="mt-4">
            <p className="text-sm text-muted">
              Search a world that is not on the chart, or click the map. Atlas positions are estimated — click to
              nudge.
            </p>
            <div className="mt-3">
              <Input
                value={catalogQuery}
                placeholder={`Search ${absentTotal} worlds not on the chart`}
                onChange={(e) => setCatalogQuery(e.target.value)}
                aria-label="Search worlds not on the chart"
              />
              <ul className="mt-2 max-h-48 overflow-y-auto rounded-md border border-border">
                {absent.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-muted">No unmatched worlds for that search.</li>
                ) : (
                  absent.map((p) => (
                    <li key={p.n}>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-surface-2",
                          current?.name === p.n && "bg-surface-2",
                        )}
                        onClick={() => onPickCatalog(p)}
                      >
                        <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: regionColor(p.r) }} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-fg">{p.n}</span>
                          <span className="block truncate text-xs text-muted">
                            {[p.r, p.s, p.g].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
            {current ? (
              <div className="mt-3 space-y-3">
                <Field label="Name">
                  <Input
                    autoFocus
                    value={current.name}
                    placeholder="System name"
                    onChange={(e) => onCurrent({ ...current, name: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") queueCurrent();
                    }}
                  />
                </Field>
                <Field label="Region">
                  <select
                    className="flex h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none"
                    value={current.region}
                    onChange={(e) => onCurrent({ ...current, region: e.target.value })}
                  >
                    {REGION_ORDER.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Sector">
                  <Input
                    value={current.sector}
                    placeholder="Map sector"
                    onChange={(e) => onCurrent({ ...current, sector: e.target.value })}
                  />
                </Field>
                <dl className="divide-y divide-border text-sm">
                  <Meta label="Coordinates" value={`${current.x}, ${current.y}`} />
                  <Meta label="Grid" value={current.grid || "—"} />
                </dl>
                {current.blurb ? <p className="text-sm leading-relaxed text-muted">{current.blurb}</p> : null}
                {current.wiki ? (
                  <a
                    href={current.wiki || wikiUrl(current.name)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg"
                  >
                    Wookieepedia
                    <ExternalLink className="size-3.5" />
                  </a>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      const row = { ...current, name: current.name.trim() || "Unnamed" };
                      void copyWorlds([row]).then((ok) => {
                        if (ok) setCopied("world");
                      });
                      onWorlds([...worlds.filter((w) => w.id !== row.id), row]);
                    }}
                  >
                    {copied === "world" ? <Check /> : <Copy />}
                    Copy row
                  </Button>
                  <Button size="sm" variant="outline" onClick={queueCurrent}>
                    <Plus />
                    Queue
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onCurrent(null)}>
                    Discard
                  </Button>
                </div>
              </div>
            ) : (
              <p className="mt-4 rounded-md border border-border bg-surface-2 px-3 py-3 text-sm text-muted">
                Pick a world from the list or click the galaxy to drop a pin.
              </p>
            )}
          </section>
        ) : (
          <section className="mt-4">
            <p className="text-sm text-muted">
              Search a sector that has no shape on the chart, or click corners to draw one. Atlas outlines are
              estimated — drag vertices to nudge.
            </p>
            <div className="mt-3">
              <Input
                value={sectorQuery}
                placeholder={`Search ${absentSectorTotal} sectors without a shape`}
                onChange={(e) => setSectorQuery(e.target.value)}
                aria-label="Search sectors not on the chart"
              />
              <ul className="mt-2 max-h-48 overflow-y-auto rounded-md border border-border">
                {absentSectors.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-muted">No unmatched sectors for that search.</li>
                ) : (
                  absentSectors.map((s) => (
                    <li key={s.n}>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-surface-2",
                          sector?.name === s.n && "bg-surface-2",
                        )}
                        onClick={() => onPickCatalogSector(s)}
                      >
                        <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: regionColor(s.r) }} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-fg">{s.n}</span>
                          <span className="block truncate text-xs text-muted">
                            {[s.r, `${s.count} worlds`, s.notables[0]].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div className="mt-3 space-y-3">
              <Field label="Sector name">
                <Input
                  value={sector?.name ?? ""}
                  placeholder="e.g. Alderaan"
                  onChange={(e) =>
                    onSector({
                      name: e.target.value,
                      pts: sector?.pts ?? [],
                      closed: sector?.closed ?? false,
                      wiki: sector?.wiki,
                      blurb: sector?.blurb,
                    })
                  }
                />
              </Field>
              <p className="text-sm text-muted">
                {sector?.pts.length ?? 0} corners
                {sector?.closed ? " · closed" : ""}
              </p>
              {sector?.blurb ? <p className="text-sm leading-relaxed text-muted">{sector.blurb}</p> : null}
              {sector?.wiki ? (
                <a
                  href={sector.wiki}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg"
                >
                  Wookieepedia
                  <ExternalLink className="size-3.5" />
                </a>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!sector || sector.pts.length < 3}
                  onClick={() => sector && onSector({ ...sector, closed: true })}
                >
                  <Pentagon />
                  Close
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!sector || sector.pts.length === 0}
                  onClick={() => {
                    if (!sector) return;
                    const pts = sector.pts.slice(0, -1);
                    onSector(pts.length ? { ...sector, pts, closed: false } : null);
                  }}
                >
                  <Undo2 />
                  Undo
                </Button>
                <Button size="sm" variant="ghost" disabled={!sector} onClick={() => onSector(null)}>
                  Clear
                </Button>
              </div>
              <Button size="sm" disabled={!shape} onClick={() => void copy("shape", shape)}>
                {copied === "shape" ? <Check /> : <Copy />}
                Copy shape
              </Button>
              {shape ? <p className="break-all font-mono text-xs leading-relaxed text-subtle">{shape}</p> : null}
            </div>
          </section>
        )}

        {worlds.length > 0 ? (
          <section className="mt-6">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-medium tracking-wide text-muted uppercase">Queued worlds</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void copyWorlds(worlds).then((ok) => {
                    if (ok) setCopied("all");
                  });
                }}
              >
                {copied === "all" ? <Check /> : <Copy />}
                Copy all
              </Button>
            </div>
            <ul className="divide-y divide-border">
              {worlds.map((w) => (
                <li key={w.id} className="flex items-center gap-2 py-2">
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onCurrent(w)}>
                    <span className="block truncate text-sm text-fg">{w.name}</span>
                    <span className="block text-xs text-muted">
                      {w.x}, {w.y} · {w.grid}
                    </span>
                  </button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Copy ${w.name}`}
                    onClick={() => {
                      void copyWorlds([w]).then((ok) => {
                        if (ok) setCopied(`w-${w.id}`);
                      });
                    }}
                  >
                    {copied === `w-${w.id}` ? <Check /> : <Copy />}
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Remove ${w.name}`}
                    onClick={() => onWorlds(worlds.filter((x) => x.id !== w.id))}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
            <Button size="sm" variant="ghost" className="mt-2" onClick={() => onWorlds([])}>
              Clear queue
            </Button>
          </section>
        ) : null}
      </div>
    </aside>
  );
}

function ToolTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-9 rounded-md text-sm",
        active ? "bg-surface text-fg" : "text-muted hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium tracking-wide text-muted uppercase">{label}</span>
      {children}
    </label>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-2">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-mono text-fg tabular-nums">{value}</dd>
    </div>
  );
}
