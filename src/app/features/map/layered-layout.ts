import { OrgType } from '../../core/graph.model';
import { Kind } from '../../core/vocab';
import { MapGraph, MapNode, ORG_TYPES } from './map-model';

/**
 * Deterministic "swim-lane" layout: one column per class (organizations → systems → services → information units),
 * rows ordered by barycentre sweeps to minimize edge crossings, and short columns aligned to their neighbours by
 * order-preserving isotonic regression. Hierarchies (sub-units, parts) are drawn as indented trees directly below
 * their parent. No simulation, no wiggle — the same input always yields the same picture.
 */

export const NODE_W = 212;
export const NODE_H = 22;
export const ROW_H = 28;
/** horizontal indent per hierarchy level */
export const INDENT = 14;
const COL_GAP = 190;
const BAND_GAP = 44;
const TOP = 56;

const COLUMN_ORDER: Kind[] = ['organization', 'system', 'service', 'dataset'];

export interface Band {
	orgType: OrgType;
	x: number;
	y: number;
	count: number;
}

export interface Column {
	kind: Kind;
	x: number;
	count: number;
}

/** Elbow connector from a parent node to one of its children */
export interface TreeLink {
	d: string;
	kind: Kind;
}

export interface LayeredLayout {
	columns: Column[];
	bands: Band[];
	tree: TreeLink[];
	width: number;
	height: number;
}

export function layoutLayers(g: MapGraph, labelOf: (n: MapNode) => string): LayeredLayout {
	const kinds = COLUMN_ORDER.filter((k) => g.nodes.some((n) => n.kind === k));
	const colIndex = new Map(kinds.map((k, i) => [k, i]));
	const cols: MapNode[][] = kinds.map((k) => g.nodes.filter((n) => n.kind === k));

	// the topmost visible ancestor decides the band, so a whole tree stays together
	const topOf = (n: MapNode): MapNode => {
		let cur = n;
		const seen = new Set<string>();
		while (cur.parentId && !seen.has(cur.id)) {
			seen.add(cur.id);
			const p = g.nodeById.get(cur.parentId);
			if (!p) break;
			cur = p;
		}
		return cur;
	};
	const bandOf = (n: MapNode): number =>
		n.kind === 'organization' ? ORG_TYPES.indexOf(topOf(n).orgType ?? 'other') : 0;

	// initial order: org type bands, then alphabetical
	for (const col of cols) col.sort((a, b) => bandOf(a) - bandOf(b) || labelOf(a).localeCompare(labelOf(b)));

	const pos = new Map<string, number>();
	const writePos = (): void =>
		cols.forEach((col) => col.forEach((n, i) => pos.set(n.id, i / Math.max(1, col.length - 1))));
	writePos();

	// barycentre sweeps (normalized positions so columns of different length are comparable)
	const neighbours = (n: MapNode, filter: (c: number) => boolean): number[] => {
		const out: number[] = [];
		for (const m of g.adjacency.get(n.id) ?? []) {
			const mn = g.nodeById.get(m);
			if (mn && filter(colIndex.get(mn.kind)!)) out.push(pos.get(m)!);
		}
		return out;
	};
	const reorder = (ci: number, filter: (c: number) => boolean): void => {
		const col = cols[ci];
		const key = new Map<string, number>();
		for (const n of col) {
			const ns = neighbours(n, filter);
			key.set(n.id, ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : pos.get(n.id)!);
		}
		col.sort((a, b) => bandOf(a) - bandOf(b) || key.get(a.id)! - key.get(b.id)!);
		col.forEach((n, i) => pos.set(n.id, i / Math.max(1, col.length - 1)));
	};
	for (let iter = 0; iter < 6; iter++) {
		for (let ci = 1; ci < cols.length; ci++) reorder(ci, (c) => c < ci);
		for (let ci = cols.length - 2; ci >= 0; ci--) reorder(ci, (c) => c > ci);
	}
	// final pass using all neighbours (also same-column parts) for stability
	for (let ci = 0; ci < cols.length; ci++) reorder(ci, (c) => c !== ci);

	// isolated nodes sink to the bottom of their column (or band)
	for (const col of cols) {
		col.sort((a, b) => bandOf(a) - bandOf(b) || Number(a.degree === 0) - Number(b.degree === 0));
	}

	// hierarchies: children directly follow their parent (keeping the barycentric order among siblings)
	for (let ci = 0; ci < cols.length; ci++) cols[ci] = treeOrder(cols[ci]);

	// ---- vertical placement
	const placed = new Set<number>();
	const y = new Map<string, number>();
	const bands: Band[] = [];
	const packColumn = (ci: number): void => {
		let cursor = TOP;
		let lastBand = -1;
		for (const n of cols[ci]) {
			const b = bandOf(n);
			if (kinds[ci] === 'organization' && b !== lastBand) {
				if (lastBand !== -1) cursor += BAND_GAP - ROW_H;
				cursor += 22;
				bands.push({ orgType: ORG_TYPES[b], x: 0, y: cursor - 14, count: 0 });
				lastBand = b;
			}
			if (kinds[ci] === 'organization') bands[bands.length - 1].count++;
			y.set(n.id, cursor);
			cursor += ROW_H;
		}
	};

	// the longest column is packed; shorter ones float next to their neighbours
	const bySize = cols.map((c, i) => i).sort((a, b) => cols[b].length - cols[a].length);
	const first = bySize[0];
	packColumn(first);
	placed.add(first);
	const queue = bySize.slice(1).sort((a, b) => Math.abs(a - first) - Math.abs(b - first));
	for (const ci of queue) {
		if (kinds[ci] === 'organization') {
			// org bands keep their headers; align the whole column block to its neighbours instead
			packColumn(ci);
		} else {
			const desired = cols[ci].map((n, i) => {
				const ns: number[] = [];
				for (const m of g.adjacency.get(n.id) ?? []) {
					const mn = g.nodeById.get(m);
					if (mn && placed.has(colIndex.get(mn.kind)!)) ns.push(y.get(m)!);
				}
				return ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : TOP + i * ROW_H;
			});
			const fitted = isotonicWithSpacing(desired, ROW_H);
			const shift = Math.max(0, TOP - Math.min(...fitted));
			cols[ci].forEach((n, i) => y.set(n.id, fitted[i] + shift));
		}
		placed.add(ci);
	}

	// ---- x positions (indented by hierarchy depth) and write-back
	const columns: Column[] = kinds.map((kind, i) => ({ kind, x: i * (NODE_W + COL_GAP), count: cols[i].length }));
	let height = 0;
	for (let ci = 0; ci < cols.length; ci++) {
		for (const n of cols[ci]) {
			n.x = columns[ci].x + n.depth * INDENT;
			n.w = NODE_W - n.depth * INDENT;
			n.y = y.get(n.id)!;
			height = Math.max(height, n.y + NODE_H);
		}
	}
	for (const b of bands) b.x = columns[0].x;

	// elbow connectors parent → child
	const tree: TreeLink[] = [];
	for (const n of g.nodes) {
		const p = n.parentId ? g.nodeById.get(n.parentId) : undefined;
		if (!p) continue;
		tree.push({ d: `M${p.x + 7},${p.y + NODE_H}V${n.y + NODE_H / 2}H${n.x}`, kind: n.kind });
	}

	return { columns, bands, tree, width: columns[columns.length - 1].x + NODE_W, height: height + 24 };
}

/** Re-emits a column so that every node is directly followed by its (visible) children, depth first. */
function treeOrder(col: MapNode[]): MapNode[] {
	const index = new Map(col.map((n, i) => [n.id, i]));
	const children = new Map<string, MapNode[]>();
	const roots: MapNode[] = [];
	for (const n of col) {
		if (n.parentId && index.has(n.parentId)) {
			if (!children.has(n.parentId)) children.set(n.parentId, []);
			children.get(n.parentId)!.push(n);
		} else {
			roots.push(n);
		}
	}
	const out: MapNode[] = [];
	const seen = new Set<string>();
	const emit = (n: MapNode): void => {
		if (seen.has(n.id)) return;
		seen.add(n.id);
		out.push(n);
		(children.get(n.id) ?? []).sort((a, b) => index.get(a.id)! - index.get(b.id)!).forEach(emit);
	};
	roots.forEach(emit);
	for (const n of col) emit(n); // safety net for cycles
	return out;
}

/**
 * Least-squares fit of positions to `desired` under the constraint y[i+1] - y[i] >= spacing (pool-adjacent-violators
 * on the spacing-shifted values). Keeps the barycentric order while pulling every node as close as possible to its
 * neighbours.
 */
export function isotonicWithSpacing(desired: number[], spacing: number): number[] {
	const shifted = desired.map((d, i) => d - i * spacing);
	const blocks: { sum: number; n: number }[] = [];
	for (const v of shifted) {
		blocks.push({ sum: v, n: 1 });
		while (blocks.length > 1) {
			const b = blocks[blocks.length - 1];
			const a = blocks[blocks.length - 2];
			if (a.sum / a.n <= b.sum / b.n) break;
			blocks.splice(blocks.length - 2, 2, { sum: a.sum + b.sum, n: a.n + b.n });
		}
	}
	const out: number[] = [];
	for (const b of blocks) for (let k = 0; k < b.n; k++) out.push(b.sum / b.n);
	return out.map((v, i) => v + i * spacing);
}

/** Cubic "flow" path between two nodes of the layered layout. */
export function layeredEdgePath(a: MapNode, b: MapNode): string {
	const ay = a.y + NODE_H / 2;
	const by = b.y + NODE_H / 2;
	if (a.x + a.w === b.x + b.w) {
		// same column: loop out to the right like an arc diagram
		const x = a.x + a.w;
		const d = Math.min(160, 24 + Math.abs(by - ay) * 0.35);
		return `M${x},${ay}C${x + d},${ay} ${x + d},${by} ${x},${by}`;
	}
	const [l, r, ly, ry] = a.x < b.x ? [a, b, ay, by] : [b, a, by, ay];
	const x1 = l.x + l.w;
	const x2 = r.x;
	const dx = (x2 - x1) * 0.5;
	return `M${x1},${ly}C${x1 + dx},${ly} ${x2 - dx},${ry} ${x2},${ry}`;
}
