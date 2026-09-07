import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Focus,
  Grid3x3,
  Map as MapIcon,
  Minus,
  Pencil,
  Plus,
  Route,
  Search,
  Type as TypeIcon,
} from "lucide-react";
import { ChartToolsPanel } from "@/components/chart-tools-panel";
import { GalaxyMap, type FlyTo, type MapHandle, type MapLayers } from "@/components/galaxy-map";
import { SystemPanel } from "@/components/system-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  gridSquare,
  inferPlacement,
  loadDrafts,
  newId,
  roundCoord,
  saveDrafts,
  type ChartTool,
  type DraftSector,
  type DraftWorld,
} from "@/lib/chart-tools";
import { placementFromCatalog, placementFromCatalogSector, withAutoSectors, type CatalogPlanet, type CatalogSector } from "@/lib/catalog";
import { galaxy, REGION_ORDER, regionColor, searchSystems } from "@/lib/galaxy";
import { fetchGalaxy, type GalaxyLoad } from "@/lib/load-galaxy";
import { cn } from "@/lib/utils";

export function AtlasApp() {
  const mapRef = useRef<MapHandle>(null);
  const [chart, setChart] = useState<GalaxyLoad>(() => ({
    data: withAutoSectors(galaxy),
    source: "snapshot",
    fetchedAt: Date.now(),
    hash: "snapshot",
    systemCount: galaxy.systems.length,
  }));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [layers, setLayers] = useState<MapLayers>({
    lanes: true,
    grid: false,
    sectors: true,
    labels: true,
  });
  const [highlightLane, setHighlightLane] = useState<string | null>(null);
  const [flyTo, setFlyTo] = useState<FlyTo | null>(null);
  const [tool, setTool] = useState<ChartTool>("off");
  const [current, setCurrent] = useState<DraftWorld | null>(null);
  const [worlds, setWorlds] = useState<DraftWorld[]>([]);
  const [sector, setSector] = useState<DraftSector | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number; grid: string } | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const gridWasOn = useRef(false);

  const data = chart.data;
  const selected = data.systems.find((s) => s.id === selectedId) ?? null;
  const visibleCount = data.systems.filter((s) => !hidden.has(s.region)).length;
  const matches = useMemo(() => searchSystems(data, query), [data, query]);

  useEffect(() => {
    const stored = loadDrafts();
    setWorlds(stored.worlds);
    if (stored.sectors[0]) setSector(stored.sectors[0]);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveDrafts(worlds, sector ? [sector] : []);
  }, [hydrated, worlds, sector]);

  useEffect(() => {
    let live = true;
    fetchGalaxy().then((next) => {
      if (live) setChart(next);
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        setTool("off");
        setSelectedId(null);
        setSearchOpen(false);
      }
      if (e.key === "Enter" && tool === "draw") {
        setSector((prev) => (prev && prev.pts.length >= 3 ? { ...prev, closed: true } : prev));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tool]);

  function setChartTool(next: ChartTool) {
    if (next === tool) {
      setTool("off");
      setLayers((l) => ({ ...l, grid: gridWasOn.current }));
      return;
    }
    if (tool === "off") {
      gridWasOn.current = layers.grid;
      setLayers((l) => ({ ...l, grid: true }));
    }
    setTool(next);
    setSelectedId(null);
    setHighlightLane(null);
    setFiltersOpen(false);
  }

  function onChartClick(x: number, y: number) {
    if (tool === "place") {
      const extras = sector && sector.pts.length >= 3 ? [sector] : [];
      const inferred = inferPlacement(data, x, y, extras);
      const keepMeta = Boolean(current?.name);
      setCurrent({
        id: current?.id ?? newId("w"),
        name: current?.name ?? "",
        shape: current?.shape ?? "",
        wiki: current?.wiki ?? "",
        blurb: current?.blurb ?? "",
        ...inferred,
        region: keepMeta ? current!.region : inferred.region,
        sector: keepMeta && current!.sector ? current!.sector : inferred.sector,
      });
      return;
    }
    if (tool === "draw") {
      const pt: number[] = [roundCoord(x), roundCoord(y)];
      setSector((prev) => {
        if (prev?.closed) return prev;
        if (!prev) return { name: "", pts: [pt], closed: false };
        return { ...prev, pts: [...prev.pts, pt], closed: false };
      });
    }
  }

  function pickCatalog(p: CatalogPlanet) {
    const placed = placementFromCatalog(data, p);
    setCurrent({
      id: current?.id ?? newId("w"),
      ...placed,
    });
    setFlyTo({ x: placed.x, y: placed.y, scale: 0.72 });
    setChartTool("place");
  }

  function pickCatalogSector(s: CatalogSector) {
    const placed = placementFromCatalogSector(data, s);
    setSector({
      name: placed.name,
      pts: placed.pts,
      closed: true,
      wiki: placed.wiki,
      blurb: placed.blurb,
    });
    setLayers((l) => ({ ...l, sectors: true }));
    setFlyTo({ x: placed.x, y: placed.y, scale: 0.5 });
    setChartTool("draw");
  }

  const live = chart.source === "live";
  const toolsOn = tool !== "off";

  return (
    <div className="relative h-dvh overflow-hidden bg-bg text-fg">
      <GalaxyMap
        ref={mapRef}
        data={data}
        selectedId={selectedId}
        onSelect={(id) => {
          setSelectedId(id);
          setHighlightLane(null);
        }}
        hiddenRegions={hidden}
        layers={layers}
        highlightLane={highlightLane}
        flyTo={flyTo}
        tool={tool}
        draftWorlds={current ? [...worlds.filter((w) => w.id !== current.id), current] : worlds}
        draftSector={sector}
        onChartClick={onChartClick}
        onChartCursor={(p) => {
          if (!p) {
            setCursor(null);
            return;
          }
          setCursor({
            x: roundCoord(p.x),
            y: roundCoord(p.y),
            grid: gridSquare(data.grid, p.x, p.y),
          });
        }}
        onVertexDrag={(index, x, y) => {
          setSector((prev) => {
            if (!prev) return prev;
            const pts = prev.pts.map((pt, i) => (i === index ? [roundCoord(x), roundCoord(y)] : pt));
            return { ...prev, pts };
          });
        }}
        onCloseSector={() => {
          setSector((prev) => (prev && prev.pts.length >= 3 ? { ...prev, closed: true } : prev));
        }}
      />

      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:p-4">
        <div className="pointer-events-auto mx-auto flex max-w-3xl items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface/95 px-3 py-2 shadow-panel">
            <MapIcon className="size-4 text-muted" />
            <div className="leading-tight">
              <div className="font-display text-base text-fg sm:text-lg">
                <span className="sm:hidden">Atlas</span>
                <span className="hidden sm:inline">Galactic Atlas</span>
              </div>
              <div className="text-xs tracking-wide text-muted uppercase">
                <span className="hidden sm:inline">{visibleCount} systems · </span>
                {live ? "Live" : "Snapshot"}
              </div>
            </div>
          </div>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <Input
              ref={searchRef}
              value={query}
              placeholder="Search systems, sectors, grid…"
              className="border-border bg-surface/95 pl-9 shadow-panel"
              onFocus={() => setSearchOpen(true)}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchOpen(true);
              }}
            />
            {searchOpen && query && matches.length > 0 ? (
              <ul className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-border bg-surface shadow-panel">
                {matches.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-2"
                      onClick={() => {
                        setSelectedId(s.id);
                        setFlyTo({ x: s.x, y: s.y, scale: 0.9 });
                        setSearchOpen(false);
                        setQuery("");
                      }}
                    >
                      <span className="size-2 rounded-full" style={{ background: regionColor(s.region) }} />
                      <span className="min-w-0 flex-1 truncate text-sm">{s.name}</span>
                      <span className="text-xs text-muted">{s.grid}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </header>

      <div className="pointer-events-none absolute top-20 left-3 z-20 md:left-4">
        <div className="pointer-events-auto hidden w-44 rounded-lg border border-border bg-surface/95 p-3 shadow-panel md:block">
          <p className="mb-2 text-xs tracking-wide text-muted uppercase">Regions</p>
          <ul className="space-y-1">
            {REGION_ORDER.map((r) => (
              <li key={r}>
                <button
                  type="button"
                  className={cn("flex w-full items-center gap-2 text-left text-sm", hidden.has(r) && "opacity-40")}
                  onClick={() => {
                    setHidden((prev) => {
                      const next = new Set(prev);
                      if (next.has(r)) next.delete(r);
                      else next.add(r);
                      return next;
                    });
                  }}
                >
                  <span className="size-2 shrink-0 rounded-full" style={{ background: regionColor(r) }} />
                  <span className="truncate">{r}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="pointer-events-auto mt-0 bg-surface/95 shadow-panel md:hidden"
          onClick={() => setFiltersOpen((v) => !v)}
        >
          Regions
        </Button>
        {filtersOpen ? (
          <div className="pointer-events-auto mt-2 max-h-64 w-44 overflow-y-auto rounded-lg border border-border bg-surface p-3 shadow-panel md:hidden">
            {REGION_ORDER.map((r) => (
              <button
                key={r}
                type="button"
                className={cn("flex w-full items-center gap-2 py-1 text-left text-sm", hidden.has(r) && "opacity-40")}
                onClick={() => {
                  setHidden((prev) => {
                    const next = new Set(prev);
                    if (next.has(r)) next.delete(r);
                    else next.add(r);
                    return next;
                  });
                }}
              >
                <span className="size-2 rounded-full" style={{ background: regionColor(r) }} />
                {r}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="pointer-events-none absolute right-3 bottom-20 z-20 flex flex-col gap-1 md:right-4 md:bottom-4">
        <div className="pointer-events-auto flex flex-col gap-1 rounded-lg border border-border bg-surface/95 p-1 shadow-panel">
          <IconBtn label="Zoom in" onClick={() => mapRef.current?.zoomBy(1.25)}>
            <Plus />
          </IconBtn>
          <IconBtn label="Zoom out" onClick={() => mapRef.current?.zoomBy(0.8)}>
            <Minus />
          </IconBtn>
          <IconBtn label="Fit galaxy" onClick={() => mapRef.current?.fit()}>
            <Focus />
          </IconBtn>
        </div>
        <div className="pointer-events-auto flex flex-col gap-1 rounded-lg border border-border bg-surface/95 p-1 shadow-panel">
          <IconBtn label="Hyperlanes" active={layers.lanes} onClick={() => setLayers((l) => ({ ...l, lanes: !l.lanes }))}>
            <Route />
          </IconBtn>
          <IconBtn
            label="Sectors"
            active={layers.sectors}
            onClick={() => setLayers((l) => ({ ...l, sectors: !l.sectors }))}
          >
            <MapIcon />
          </IconBtn>
          <IconBtn label="Grid" active={layers.grid} onClick={() => setLayers((l) => ({ ...l, grid: !l.grid }))}>
            <Grid3x3 />
          </IconBtn>
          <IconBtn
            label="Labels"
            active={layers.labels}
            onClick={() => setLayers((l) => ({ ...l, labels: !l.labels }))}
          >
            <TypeIcon />
          </IconBtn>
          <IconBtn label="Chart tools" active={toolsOn} onClick={() => setChartTool(toolsOn ? "off" : "place")}>
            <Pencil />
          </IconBtn>
        </div>
      </div>

      {toolsOn ? (
        <ChartToolsPanel
          tool={tool}
          onTool={(next) => setChartTool(next)}
          current={current}
          onCurrent={(next) => {
            setCurrent(next);
            if (next) setFlyTo({ x: next.x, y: next.y, scale: 0.7 });
          }}
          worlds={worlds}
          onWorlds={setWorlds}
          sector={sector}
          onSector={setSector}
          cursor={cursor}
          data={data}
          onPickCatalog={pickCatalog}
          onPickCatalogSector={pickCatalogSector}
          onClose={() => setChartTool("off")}
        />
      ) : selected ? (
        <SystemPanel system={selected} onClose={() => setSelectedId(null)} onHighlightLane={setHighlightLane} />
      ) : (
        <p className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 text-xs text-subtle">
          Click to inspect · Drag to pan · Scroll to zoom
        </p>
      )}
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      aria-pressed={active}
      className={cn(active && "bg-surface-2 text-accent")}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
