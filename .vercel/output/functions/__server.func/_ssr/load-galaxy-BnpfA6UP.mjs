import { n as TSS_SERVER_FUNCTION, t as createServerFn } from "./ssr.mjs";
import { i as galaxy } from "./galaxy-DHadNTP0.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/load-galaxy-BnpfA6UP.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1ooXofLYahqqBM-czhBrr526wn8gh8QzjTo354chCOa8/export?format=csv&gid=1707025047";
var VIP = /* @__PURE__ */ new Set([
	"Coruscant",
	"Corellia",
	"Tatooine",
	"Naboo",
	"Alderaan",
	"Kashyyyk",
	"Mandalore",
	"Kamino",
	"Mustafar",
	"Hoth",
	"Bespin",
	"Dagobah",
	"Yavin 4",
	"Endor",
	"Jakku",
	"Lothal"
]);
function parseCsv(text) {
	const rows = [];
	let row = [];
	let cell = "";
	let inQuotes = false;
	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (inQuotes) {
			if (ch === "\"") {
				if (text[i + 1] === "\"") {
					cell += "\"";
					i += 1;
				} else inQuotes = false;
			} else cell += ch;
		} else if (ch === "\"") inQuotes = true;
		else if (ch === ",") {
			row.push(cell);
			cell = "";
		} else if (ch === "\n") {
			row.push(cell);
			rows.push(row);
			row = [];
			cell = "";
		} else if (ch !== "\r") cell += ch;
	}
	if (cell.length || row.length) {
		row.push(cell);
		rows.push(row);
	}
	return rows;
}
function colOf(header, ...names) {
	for (const n of names) {
		const i = header.indexOf(n);
		if (i >= 0) return i;
	}
	const lower = names.map((n) => n.toLowerCase());
	return header.findIndex((h) => lower.some((n) => h.toLowerCase().includes(n)));
}
function num(s) {
	const n = Number(s.replace(/[^0-9.\-]/g, ""));
	return Number.isFinite(n) ? n : null;
}
function slug(name) {
	return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "system";
}
function parseGrid(gs) {
	const m = gs.toUpperCase().trim().match(/^([A-Z]+)\s*-?\s*(\d+)$/);
	if (!m) return null;
	let n = 0;
	for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64);
	return [n, Number(m[2])];
}
function linreg(xs, ys) {
	const n = xs.length;
	const mx = xs.reduce((a, b) => a + b, 0) / n;
	const my = ys.reduce((a, b) => a + b, 0) / n;
	let numv = 0;
	let den = 0;
	for (let i = 0; i < n; i++) {
		numv += (xs[i] - mx) * (ys[i] - my);
		den += (xs[i] - mx) ** 2;
	}
	const a = den ? numv / den : 0;
	return [a, my - a * mx];
}
function parseMapCsv(text) {
	const rows = parseCsv(text);
	const hi = rows.findIndex((r) => r.includes("Name") && r.some((h) => h.includes("X Coordinates")));
	if (hi < 0) throw new Error("Map header not found");
	const header = rows[hi];
	const ni = colOf(header, "Name");
	const xi = colOf(header, "X Coordinates");
	const yi = colOf(header, "Y Coordinates");
	const ri = colOf(header, "Region");
	const di = colOf(header, "Development");
	const ti = colOf(header, "Type");
	const li = colOf(header, "Level modifier");
	const wi = colOf(header, "Region wealth");
	const mi = colOf(header, "Monthly Value in Billions");
	const ii = colOf(header, "Primary Industry");
	const bi = colOf(header, "Bonus");
	const ei = colOf(header, "Essential Resources");
	const lui = colOf(header, "Luxury Resources");
	const g1 = colOf(header, "Interest group 1");
	const g2 = colOf(header, "Interest group 2");
	const wants = header.map((h, j) => h.trim() === "Wants" ? j : -1).filter((j) => j >= 0);
	const desc = header.findIndex((h) => h.includes("Description"));
	const hc = header.findIndex((h) => h.includes("Hyperlane"));
	const sec = colOf(header, "Map Sector (CANNON MAPS)");
	const shp = colOf(header, "Sector Shape on map");
	const gs = colOf(header, "Grid Square");
	const cell = (r, j) => j >= 0 && j < r.length ? (r[j] ?? "").trim() : "";
	const systems = [];
	const used = /* @__PURE__ */ new Set();
	for (const r of rows.slice(hi + 1)) {
		const name = cell(r, ni);
		if (!name || name === "Name") continue;
		const x = num(cell(r, xi));
		const y = num(cell(r, yi));
		if (x == null || y == null) continue;
		const blurb = cell(r, desc);
		const wiki = blurb.match(/https?:\/\/\S+/)?.[0]?.replace(/[).,]+$/, "") ?? "";
		const monthly = cell(r, mi);
		const monthlyN = num(monthly.replace("$", "")) ?? 0;
		const laneNames = cell(r, hc).split(";").map((p) => p.replace(/\[[^\]]*\]/g, "").replace(/\s+/g, " ").trim()).filter(Boolean);
		let id = slug(name);
		let n = 2;
		while (used.has(id)) {
			id = `${slug(name)}-${n}`;
			n += 1;
		}
		used.add(id);
		systems.push({
			id,
			name,
			region: cell(r, ri) || "Outer Rim",
			dev: cell(r, di),
			level: Math.round(num(cell(r, li)) ?? 0),
			type: cell(r, ti),
			wealth: cell(r, wi),
			monthly,
			monthlyN,
			industry: cell(r, ii),
			bonus: cell(r, bi),
			ess: cell(r, ei),
			lux: cell(r, lui),
			ig1: cell(r, g1),
			ig1w: wants[0] != null ? cell(r, wants[0]) : "",
			ig2: cell(r, g2),
			ig2w: wants[1] != null ? cell(r, wants[1]) : "",
			blurb,
			wiki,
			x,
			y,
			lanes: laneNames,
			sector: cell(r, sec),
			grid: cell(r, gs),
			district: num(cell(r, 0)) || null,
			notable: Boolean(wiki) || monthlyN >= 20 || VIP.has(name)
		});
	}
	const byLane = /* @__PURE__ */ new Map();
	systems.forEach((s, i) => {
		for (const ln of s.lanes) {
			const list = byLane.get(ln) ?? [];
			list.push(i);
			byLane.set(ln, list);
		}
	});
	const lanes = [];
	for (const [name, idxs] of byLane) {
		if (idxs.length < 2) continue;
		const pts = idxs.map((i) => ({
			x: systems[i].x,
			y: systems[i].y,
			i
		}));
		const spanX = Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x));
		const spanY = Math.max(...pts.map((p) => p.y)) - Math.min(...pts.map((p) => p.y));
		pts.sort((a, b) => spanX >= spanY ? a.x - b.x : a.y - b.y);
		const low = name.toLowerCase();
		lanes.push({
			name,
			major: idxs.length >= 4 || low.includes("run") || low.includes("spine") || low.includes("corridor") || low.includes("trunk") || low.includes("way"),
			sys: pts.map((p) => p.i)
		});
	}
	const sectors = [];
	const seenSec = /* @__PURE__ */ new Set();
	for (const r of rows.slice(hi + 1)) {
		const shape = cell(r, shp);
		if (!shape.includes("|")) continue;
		const bar = shape.indexOf("|");
		const label = shape.slice(0, bar).trim();
		if (!label || seenSec.has(label)) continue;
		const pts = [];
		for (const pair of shape.slice(bar + 1).split(";")) {
			const parts = pair.trim().split(/[,\s]+/);
			if (parts.length < 2) continue;
			const px = Number(parts[0]);
			const py = Number(parts[1]);
			if (Number.isFinite(px) && Number.isFinite(py)) pts.push([px, py]);
		}
		if (pts.length >= 3) {
			seenSec.add(label);
			sectors.push({
				name: label,
				pts
			});
		}
	}
	const pairs = [];
	for (const s of systems) {
		const gxy = parseGrid(s.grid);
		if (gxy) pairs.push([
			gxy[0],
			gxy[1],
			s.x,
			s.y
		]);
	}
	const cols = pairs.map((p) => p[0]);
	const rws = pairs.map((p) => p[1]);
	const xs = pairs.map((p) => p[2]);
	const ys = pairs.map((p) => p[3]);
	const [cellW, ox] = pairs.length >= 8 ? linreg(cols, xs) : [280, 1200];
	const [cellH, oy] = pairs.length >= 8 ? linreg(rws, ys) : [300, 400];
	const allx = systems.map((s) => s.x);
	const ally = systems.map((s) => s.y);
	const core = systems.find((s) => s.name === "Coruscant");
	return {
		systems,
		lanes,
		sectors,
		bounds: {
			minX: Math.min(...allx),
			maxX: Math.max(...allx),
			minY: Math.min(...ally),
			maxY: Math.max(...ally)
		},
		grid: {
			cellW,
			cellH,
			ox,
			oy,
			colMin: Math.min(...cols),
			colMax: Math.max(...cols),
			rowMin: Math.min(...rws),
			rowMax: Math.max(...rws)
		},
		core: {
			x: core?.x ?? allx[0],
			y: core?.y ?? ally[0]
		}
	};
}
var loadGalaxyFn_createServerFn_handler = createServerRpc({
	id: "e99e1476b8e3664785f3e644303f838b2bf22f4499afa239ea3f8cb0689fb613",
	name: "loadGalaxyFn",
	filename: "src/lib/load-galaxy.ts"
}, (opts) => loadGalaxyFn.__executeServer(opts));
var loadGalaxyFn = createServerFn({ method: "GET" }).handler(loadGalaxyFn_createServerFn_handler, async () => {
	try {
		const res = await fetch(SHEET_CSV_URL, { cache: "no-store" });
		if (!res.ok) throw new Error(`sheet ${res.status}`);
		const data = parseMapCsv(await res.text());
		if (!data.systems.length) throw new Error("empty sheet");
		return {
			data,
			source: "live",
			fetchedAt: Date.now(),
			hash: `${data.systems.length}-${data.sectors.length}`,
			systemCount: data.systems.length
		};
	} catch {
		return {
			data: galaxy,
			source: "snapshot",
			fetchedAt: Date.now(),
			hash: "snapshot",
			systemCount: galaxy.systems.length
		};
	}
});
//#endregion
export { loadGalaxyFn_createServerFn_handler };
