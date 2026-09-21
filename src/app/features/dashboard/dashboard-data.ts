import { CANTONS } from '../../core/cantons';
import { Entity, LANGS, OrgType, SystemMapGraph } from '../../core/graph.model';
import { KINDS, Kind } from '../../core/vocab';
import { pageRank } from '../map/map-model';

export interface RankItem {
	entity: Entity;
	value: number;
	orgType?: OrgType;
}

/** one element in the importance-vs-properties scatter */
export interface ScatterPoint {
	entity: Entity;
	/** distinct neighbours within the scope */
	degree: number;
	/** triples recorded about the element */
	props: number;
	/** PageRank on the undirected graph of the scope (the scores sum to 1) */
	score: number;
}

export interface CantonStat {
	code: string;
	x: number;
	y: number;
	orgs: number;
	systems: number;
	root?: Entity;
}

export interface QualityRow {
	kind: Kind;
	total: number;
	description: number;
	multilingual: number;
	website: number;
	connected: number;
}

/** relations from elements of one class to elements of another, by relation type */
export interface MatrixCell {
	s: Kind;
	o: Kind;
	count: number;
	/** relation key → count, most frequent first */
	byKey: [string, number][];
}

export interface DashboardData {
	/** every element of a class, sub-units and parts included */
	counts: Record<Kind, number>;
	/** elements without a parent – the figure shown first; the difference to counts are sub-units and parts */
	topLevel: Record<Kind, number>;
	relations: number;
	orgTypes: { type: OrgType; count: number }[];
	operators: RankItem[];
	operatorsTotal: number;
	cantons: CantonStat[];
	quality: QualityRow[];
	/** 4 × 4 cells, subject class by object class */
	matrix: MatrixCell[];
}

/** sectors from the Confederation down: federal, cantonal, other public bodies, private sector */
const ORG_ORDER: OrgType[] = ['federal', 'cantonal', 'other', 'private'];

/**
 * Importance vs. how much is recorded: PageRank over the undirected graph of the four classes, restricted to the
 * members of a subgraph when a scope is given. Elements without a relation inside the scope are left out.
 */
export function scatterPoints(g: SystemMapGraph, scope: Set<string> | null): ScatterPoint[] {
	const ids = KINDS.flatMap((k) => g.byKind[k].map((e) => e.id)).filter((id) => !scope || scope.has(id));
	const adjacency = new Map(ids.map((id) => [id, new Set<string>()]));
	for (const r of g.relations) {
		if (r.s === r.o || !adjacency.has(r.s) || !adjacency.has(r.o)) continue;
		adjacency.get(r.s)!.add(r.o);
		adjacency.get(r.o)!.add(r.s);
	}
	const scores = pageRank(ids, adjacency);
	return ids
		.map((id) => {
			const e = g.entities.get(id)!;
			return { entity: e, degree: adjacency.get(id)!.size, props: e.props, score: scores.get(id)! };
		})
		.filter((p) => p.degree > 0);
}

export function computeDashboard(g: SystemMapGraph): DashboardData {
	const counts = Object.fromEntries(KINDS.map((k) => [k, g.byKind[k].length])) as Record<Kind, number>;
	const topLevel = Object.fromEntries(
		KINDS.map((k) => [k, g.byKind[k].filter((e) => !e.parents.length).length]),
	) as Record<Kind, number>;
	const orgs = g.byKind.organization;

	// systems operated per top-level organization (sub-units rolled up, systems counted once)
	const operated = new Map<string, Set<string>>();
	for (const r of g.relations) {
		if (r.key !== 'operates') continue;
		const org = g.entities.get(r.s)!;
		const root = org.root ?? org.id;
		if (!operated.has(root)) operated.set(root, new Set());
		operated.get(root)!.add(r.o);
	}
	const operators = [...operated.entries()]
		.map(([id, set]) => {
			const e = g.entities.get(id)!;
			return { entity: e, value: set.size, orgType: e.orgType };
		})
		.sort((a, b) => b.value - a.value);

	// cantons
	const cantons: CantonStat[] = CANTONS.map((c) => ({ code: c.code, x: c.x, y: c.y, orgs: 0, systems: 0 }));
	const byCode = new Map(cantons.map((c) => [c.code, c]));
	for (const o of orgs) {
		if (!o.canton) continue;
		const c = byCode.get(o.canton)!;
		c.orgs++;
		if (o.depth === 0 || (!c.root && o.root === o.id)) c.root = o;
		const sys = operated.get(o.id);
		if (o.root === o.id && sys) c.systems += sys.size;
	}

	const orgTypes = ORG_ORDER.map((type) => ({
		type,
		count: orgs.filter((o) => (o.orgType ?? 'other') === type).length,
	}));

	const quality: QualityRow[] = KINDS.map((kind) => {
		const list = g.byKind[kind];
		return {
			kind,
			total: list.length,
			description: list.filter((e) => Object.keys(e.description).length > 0).length,
			multilingual: list.filter((e) => LANGS.every((l) => e.name[l])).length,
			website: list.filter((e) => e.urls.length > 0).length,
			connected: list.filter((e) => e.in.length + e.out.length > 0).length,
		};
	});

	// which classes are linked, and by which relations
	const cellMap = new Map<string, Map<string, number>>();
	for (const r of g.relations) {
		const s = g.entities.get(r.s)?.kind;
		const o = g.entities.get(r.o)?.kind;
		if (!s || !o) continue;
		const key = `${s}|${o}`;
		if (!cellMap.has(key)) cellMap.set(key, new Map());
		const m = cellMap.get(key)!;
		m.set(r.key, (m.get(r.key) ?? 0) + 1);
	}
	const matrix: MatrixCell[] = KINDS.flatMap((s) =>
		KINDS.map((o) => {
			const byKey = [...(cellMap.get(`${s}|${o}`) ?? [])].sort((a, b) => b[1] - a[1]);
			return { s, o, count: byKey.reduce((n, [, c]) => n + c, 0), byKey };
		}),
	);

	return {
		counts,
		topLevel,
		relations: g.relations.length,
		orgTypes,
		operators: operators.slice(0, 40),
		operatorsTotal: operators.length,
		cantons,
		quality,
		matrix,
	};
}
