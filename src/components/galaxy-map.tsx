import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { COL_LETTERS, VIP_LABELS, fitBounds, galaxy, regionColor, type GalaxyData, type StarSystem } from "@/lib/galaxy";
import type { ChartTool, DraftSector, DraftWorld } from "@/lib/chart-tools";

export type MapLayers = {
  lanes: boolean;
  grid: boolean;
  sectors: boolean;
  labels: boolean;
};

export type FlyTo = { x: number; y: number; scale?: number };

export type MapHandle = {
  zoomBy: (factor: number) => void;
  fit: () => void;
  flyTo: (x: number, y: number, scale?: number) => void;
};

type Props = {
  data: GalaxyData;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  hiddenRegions: ReadonlySet<string>;
  layers: MapLayers;
  highlightLane: string | null;
  flyTo: FlyTo | null;
  tool?: ChartTool;
  draftWorlds?: DraftWorld[];
  draftSector?: DraftSector | null;
  onChartClick?: (x: number, y: number) => void;
  onChartCursor?: (p: { x: number; y: number } | null) => void;
  onVertexDrag?: (index: number, x: number, y: number) => void;
  onCloseSector?: () => void;
};

type Cam = { x: number; y: number; scale: number };

const TAU = Math.PI * 2;
const snapshot = galaxy;
const MIN_SCALE = 0.08;
const MAX_SCALE = 2.8;

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const bgStars: { x: number; y: number; r: number; a: number }[] = [];
{
  const rand = mulberry32(42);
  for (let i = 0; i < 1600; i++) {
    const ang = rand() * TAU;
    const rad = Math.pow(rand(), 0.55) * 3400;
    bgStars.push({
      x: snapshot.core.x + Math.cos(ang) * rad * 1.15,
      y: snapshot.core.y + Math.sin(ang) * rad,
      r: rand() < 0.08 ? 1.35 : rand() < 0.3 ? 0.9 : 0.55,
      a: 0.18 + rand() * 0.45,
    });
  }
}

function fitCam(w: number, h: number, data: GalaxyData): Cam {
  const box = fitBounds(data);
  const pad = 220;
  const gw = box.maxX - box.minX + pad * 2;
  const gh = box.maxY - box.minY + pad * 2;
  const scale = Math.min(w / gw, h / gh);
  const legendShift = w >= 720 ? 120 / scale : 0;
  return {
    x: (box.minX + box.maxX) / 2 - legendShift,
    y: (box.minY + box.maxY) / 2,
    scale,
  };
}

export const GalaxyMap = forwardRef<MapHandle, Props>(function GalaxyMap(
  {
    data,
    selectedId,
    onSelect,
    hiddenRegions,
    layers,
    highlightLane,
    flyTo,
    tool = "off",
    draftWorlds = [],
    draftSector = null,
    onChartClick,
    onChartCursor,
    onVertexDrag,
    onCloseSector,
  },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cam = useRef<Cam>({ x: 0, y: 0, scale: 0.2 });
  const size = useRef({ w: 1, h: 1, dpr: 1 });
  const dataRef = useRef(data);
  const layersRef = useRef(layers);
  const hiddenRef = useRef(hiddenRegions);
  const selectedRef = useRef(selectedId);
  const laneRef = useRef(highlightLane);
  const toolRef = useRef(tool);
  const draftsRef = useRef(draftWorlds);
  const sectorRef = useRef(draftSector);
  const hoverRef = useRef<string | null>(null);
  const drawRef = useRef<() => void>(() => {});
  const drag = useRef<{
    kind: "pan" | "vertex" | null;
    lx: number;
    ly: number;
    moved: boolean;
    vertex: number;
  }>({ kind: null, lx: 0, ly: 0, moved: false, vertex: -1 });

  dataRef.current = data;
  layersRef.current = layers;
  hiddenRef.current = hiddenRegions;
  selectedRef.current = selectedId;
  laneRef.current = highlightLane;
  toolRef.current = tool;
  draftsRef.current = draftWorlds;
  sectorRef.current = draftSector;

  function worldToScreen(x: number, y: number) {
    const { w, h } = size.current;
    const c = cam.current;
    return { x: (x - c.x) * c.scale + w / 2, y: (y - c.y) * c.scale + h / 2 };
  }
  function screenToWorld(x: number, y: number) {
    const { w, h } = size.current;
    const c = cam.current;
    return { x: (x - w / 2) / c.scale + c.x, y: (y - h / 2) / c.scale + c.y };
  }

  useImperativeHandle(ref, () => ({
    zoomBy(factor) {
      cam.current.scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, cam.current.scale * factor));
      drawRef.current();
    },
    fit() {
      const { w, h } = size.current;
      cam.current = fitCam(w, h, dataRef.current);
      drawRef.current();
    },
    flyTo(x, y, scale) {
      cam.current.x = x;
      cam.current.y = y;
      if (scale) cam.current.scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
      drawRef.current();
    },
  }));

  useEffect(() => {
    if (!flyTo) return;
    cam.current.x = flyTo.x;
    cam.current.y = flyTo.y;
    if (flyTo.scale) cam.current.scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, flyTo.scale));
    drawRef.current();
  }, [flyTo]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function resize() {
      const parent = canvas!.parentElement;
      const w = parent?.clientWidth || window.innerWidth;
      const h = parent?.clientHeight || window.innerHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      size.current = { w, h, dpr };
      canvas!.width = Math.floor(w * dpr);
      canvas!.height = Math.floor(h * dpr);
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      if (!cam.current.scale || cam.current.scale === 0.2) cam.current = fitCam(w, h, dataRef.current);
      draw();
    }

    function draw() {
      const { w, h, dpr } = size.current;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.fillStyle = "#08080c";
      ctx!.fillRect(0, 0, w, h);

      const g = dataRef.current;
      const c = cam.current;
      const hidden = hiddenRef.current;
      const L = layersRef.current;

      const core = worldToScreen(g.core.x, g.core.y);
      const disc = ctx!.createRadialGradient(core.x, core.y, 20 * c.scale, core.x, core.y, 2800 * c.scale);
      disc.addColorStop(0, "rgba(196,162,101,0.16)");
      disc.addColorStop(0.35, "rgba(196,162,101,0.05)");
      disc.addColorStop(1, "rgba(8,8,12,0)");
      ctx!.fillStyle = disc;
      ctx!.fillRect(0, 0, w, h);

      for (const s of bgStars) {
        const p = worldToScreen(s.x, s.y);
        if (p.x < -4 || p.y < -4 || p.x > w + 4 || p.y > h + 4) continue;
        ctx!.fillStyle = `rgba(235,230,216,${s.a})`;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, s.r, 0, TAU);
        ctx!.fill();
      }

      if (L.grid) {
        ctx!.save();
        ctx!.strokeStyle = "rgba(196,162,101,0.12)";
        ctx!.lineWidth = 1;
        ctx!.font = "11px 'Source Sans 3', sans-serif";
        ctx!.fillStyle = "rgba(154,148,134,0.7)";
        for (let col = g.grid.colMin; col <= g.grid.colMax; col++) {
          const x = g.grid.ox + col * g.grid.cellW;
          const a = worldToScreen(x, g.bounds.minY - 80);
          const b = worldToScreen(x, g.bounds.maxY + 80);
          ctx!.beginPath();
          ctx!.moveTo(a.x, a.y);
          ctx!.lineTo(b.x, b.y);
          ctx!.stroke();
          const letter = COL_LETTERS[(col - 1) % 26] ?? "";
          ctx!.fillText(letter, a.x + 4, 18);
        }
        for (let row = g.grid.rowMin; row <= g.grid.rowMax; row++) {
          const y = g.grid.oy + row * g.grid.cellH;
          const a = worldToScreen(g.bounds.minX - 80, y);
          const b = worldToScreen(g.bounds.maxX + 80, y);
          ctx!.beginPath();
          ctx!.moveTo(a.x, a.y);
          ctx!.lineTo(b.x, b.y);
          ctx!.stroke();
          ctx!.fillText(String(row), 8, a.y - 4);
        }
        ctx!.restore();
      }

      if (L.sectors) {
        ctx!.save();
        const autos = g.sectors.filter((s) => s.auto);
        const official = g.sectors.filter((s) => !s.auto);
        const paint = (sec: (typeof g.sectors)[number], phase: "fill" | "stroke") => {
          const outers = sec.parts?.length ? sec.parts : [sec.pts];
          const holes = sec.holes ?? [];
          ctx!.beginPath();
          for (const ring of [...outers, ...holes]) {
            if (ring.length < 3) continue;
            ring.forEach((pt, i) => {
              const p = worldToScreen(pt[0]!, pt[1]!);
              if (i === 0) ctx!.moveTo(p.x, p.y);
              else ctx!.lineTo(p.x, p.y);
            });
            ctx!.closePath();
          }
          if (sec.auto) {
            ctx!.fillStyle = "rgba(196,162,101,0.035)";
            ctx!.strokeStyle = "rgba(196,162,101,0.4)";
            ctx!.lineWidth = 1;
            ctx!.setLineDash([]);
          } else {
            ctx!.fillStyle = "rgba(196,162,101,0.05)";
            ctx!.strokeStyle = "rgba(196,162,101,0.28)";
            ctx!.lineWidth = 1;
            ctx!.setLineDash([]);
          }
          if (phase === "fill") ctx!.fill("evenodd");
          else ctx!.stroke();
        };
        for (const sec of autos) paint(sec, "fill");
        for (const sec of official) paint(sec, "fill");
        for (const sec of autos) paint(sec, "stroke");
        for (const sec of official) paint(sec, "stroke");
        if (c.scale > 0.48) {
          ctx!.font = "10px 'Source Sans 3', sans-serif";
          ctx!.textAlign = "center";
          ctx!.fillStyle = "rgba(196,162,101,0.58)";
          for (const sec of autos) {
            if (sec.pts.length < 3) continue;
            let area = 0;
            for (let i = 0, j = sec.pts.length - 1; i < sec.pts.length; j = i++) {
              area += sec.pts[j]![0]! * sec.pts[i]![1]! - sec.pts[i]![0]! * sec.pts[j]![1]!;
            }
            if (Math.abs(area) < 18000) continue;
            const cx = sec.pts.reduce((s, p) => s + p[0]!, 0) / sec.pts.length;
            const cy = sec.pts.reduce((s, p) => s + p[1]!, 0) / sec.pts.length;
            const p = worldToScreen(cx, cy);
            if (p.x > 8 && p.y > 8 && p.x < w - 8 && p.y < h - 8) ctx!.fillText(sec.name, p.x, p.y);
          }
          ctx!.textAlign = "start";
        }
        ctx!.restore();
      }

      if (L.lanes) {
        const hi = laneRef.current;
        for (const lane of g.lanes) {
          const pts = lane.sys
            .map((i) => g.systems[i])
            .filter((s): s is StarSystem => Boolean(s) && !hidden.has(s.region));
          if (pts.length < 2) continue;
          const on = hi === lane.name;
          ctx!.beginPath();
          pts.forEach((s, i) => {
            const p = worldToScreen(s.x, s.y);
            if (i === 0) ctx!.moveTo(p.x, p.y);
            else ctx!.lineTo(p.x, p.y);
          });
          ctx!.strokeStyle = on ? "rgba(196,162,101,0.95)" : lane.major ? "rgba(196,162,101,0.38)" : "rgba(196,162,101,0.16)";
          ctx!.lineWidth = on ? 2.4 : lane.major ? 1.4 : 1;
          ctx!.stroke();
          for (const ei of lane.ends ?? []) {
            const s = g.systems[ei];
            if (!s || hidden.has(s.region)) continue;
            const p = worldToScreen(s.x, s.y);
            ctx!.save();
            ctx!.translate(p.x, p.y);
            ctx!.rotate(Math.PI / 4);
            ctx!.strokeStyle = on ? "rgba(235,230,216,0.95)" : "rgba(196,162,101,0.7)";
            ctx!.lineWidth = on ? 1.8 : 1.2;
            ctx!.strokeRect(-3.4, -3.4, 6.8, 6.8);
            ctx!.restore();
          }
        }
      }

      const selected = selectedRef.current;
      const hover = hoverRef.current;
      const labelScale = c.scale > 0.55;
      const vipScale = c.scale > 0.18;
      for (const s of g.systems) {
        if (hidden.has(s.region)) continue;
        const p = worldToScreen(s.x, s.y);
        if (p.x < -12 || p.y < -12 || p.x > w + 12 || p.y > h + 12) continue;
        const r = s.notable ? 3.2 : 2.1;
        const on = s.id === selected || s.id === hover;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, on ? r + 2.4 : r, 0, TAU);
        ctx!.fillStyle = regionColor(s.region);
        ctx!.globalAlpha = on ? 1 : s.notable ? 0.95 : 0.75;
        ctx!.fill();
        ctx!.globalAlpha = 1;
        if (on) {
          ctx!.strokeStyle = "rgba(235,230,216,0.9)";
          ctx!.lineWidth = 1.2;
          ctx!.stroke();
        }
        if (L.labels && (labelScale || (vipScale && (VIP_LABELS.has(s.name) || s.notable && c.scale > 0.32)))) {
          ctx!.fillStyle = "rgba(235,230,216,0.88)";
          ctx!.font = `${VIP_LABELS.has(s.name) ? 12 : 10}px 'Source Sans 3', sans-serif`;
          ctx!.fillText(s.name, p.x + 6, p.y - 4);
        }
      }

      const drafts = draftsRef.current;
      const dsec = sectorRef.current;
      if (drafts.length) {
        ctx!.save();
        for (const d of drafts) {
          const p = worldToScreen(d.x, d.y);
          ctx!.beginPath();
          ctx!.arc(p.x, p.y, 11, 0, TAU);
          ctx!.setLineDash([4, 3]);
          ctx!.strokeStyle = "#ebe6d8";
          ctx!.lineWidth = 2;
          ctx!.stroke();
          ctx!.setLineDash([]);
          ctx!.fillStyle = "#ebe6d8";
          ctx!.font = "11px 'Source Sans 3', sans-serif";
          ctx!.fillText(d.name || "New world", p.x + 14, p.y + 4);
        }
        ctx!.restore();
      }
      if (dsec && dsec.pts.length) {
        ctx!.save();
        ctx!.beginPath();
        dsec.pts.forEach((pt, i) => {
          const p = worldToScreen(pt[0]!, pt[1]!);
          if (i === 0) ctx!.moveTo(p.x, p.y);
          else ctx!.lineTo(p.x, p.y);
        });
        if (dsec.closed) ctx!.closePath();
        ctx!.fillStyle = "rgba(196,162,101,0.14)";
        ctx!.strokeStyle = "#c4a265";
        ctx!.lineWidth = 3;
        if (dsec.pts.length >= 2) {
          ctx!.fill();
          ctx!.stroke();
        }
        for (const pt of dsec.pts) {
          const p = worldToScreen(pt[0]!, pt[1]!);
          ctx!.beginPath();
          ctx!.arc(p.x, p.y, 5, 0, TAU);
          ctx!.fillStyle = "#ebe6d8";
          ctx!.fill();
        }
        ctx!.restore();
      }
    }

    drawRef.current = draw;
    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    function hitSystem(sx: number, sy: number): StarSystem | null {
      const g = dataRef.current;
      const hidden = hiddenRef.current;
      let best: StarSystem | null = null;
      let bestD = 14 * 14;
      for (const s of g.systems) {
        if (hidden.has(s.region)) continue;
        const p = worldToScreen(s.x, s.y);
        const d = (p.x - sx) ** 2 + (p.y - sy) ** 2;
        if (d < bestD) {
          bestD = d;
          best = s;
        }
      }
      return best;
    }
    function hitVertex(sx: number, sy: number): number {
      const sec = sectorRef.current;
      if (!sec) return -1;
      for (let i = 0; i < sec.pts.length; i++) {
        const p = worldToScreen(sec.pts[i]![0]!, sec.pts[i]![1]!);
        if ((p.x - sx) ** 2 + (p.y - sy) ** 2 < 12 * 12) return i;
      }
      return -1;
    }

    function onDown(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      canvas!.setPointerCapture(e.pointerId);
      const v = toolRef.current === "draw" ? hitVertex(sx, sy) : -1;
      drag.current = { kind: v >= 0 ? "vertex" : "pan", lx: sx, ly: sy, moved: false, vertex: v };
    }
    function onMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const wpt = screenToWorld(sx, sy);
      onChartCursor?.(wpt);
      if (drag.current.kind === "vertex" && drag.current.vertex >= 0) {
        onVertexDrag?.(drag.current.vertex, wpt.x, wpt.y);
        drag.current.moved = true;
        return;
      }
      if (drag.current.kind === "pan") {
        const dx = sx - drag.current.lx;
        const dy = sy - drag.current.ly;
        if (Math.hypot(dx, dy) > 3) drag.current.moved = true;
        cam.current.x -= dx / cam.current.scale;
        cam.current.y -= dy / cam.current.scale;
        drag.current.lx = sx;
        drag.current.ly = sy;
        draw();
        return;
      }
      const hit = hitSystem(sx, sy);
      const next = hit?.id ?? null;
      if (next !== hoverRef.current) {
        hoverRef.current = next;
        canvas!.style.cursor = next || toolRef.current !== "off" ? "pointer" : "grab";
        draw();
      }
    }
    function onUp(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const moved = drag.current.moved;
      const kind = drag.current.kind;
      drag.current.kind = null;
      if (moved || kind === "vertex") return;
      const wpt = screenToWorld(sx, sy);
      if (toolRef.current !== "off") {
        if (e.detail === 2 && toolRef.current === "draw") {
          onCloseSector?.();
          return;
        }
        onChartClick?.(wpt.x, wpt.y);
        return;
      }
      const hit = hitSystem(sx, sy);
      onSelect(hit ? hit.id : null);
    }
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const rect = canvas!.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const before = screenToWorld(sx, sy);
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      cam.current.scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, cam.current.scale * factor));
      const after = screenToWorld(sx, sy);
      cam.current.x += before.x - after.x;
      cam.current.y += before.y - after.y;
      draw();
    }

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointerleave", () => onChartCursor?.(null));
    canvas.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("resize", resize);
    return () => {
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", resize);
    };
  }, [onChartClick, onChartCursor, onCloseSector, onSelect, onVertexDrag]);

  useEffect(() => {
    drawRef.current();
  });

  return <canvas ref={canvasRef} className="absolute inset-0 size-full touch-none" />;
});
