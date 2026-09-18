import { Entity, OrgType, SystemMapGraph } from '../../core/graph.model';
import { HIERARCHY_KEYS, Kind, KINDS, RELATIONS } from '../../core/vocab';

export type MapView = 'layers' | 'network';

/** How a class is shown: hidden, aggregated to its top-level elements, or every element with its hierarchy. */
export type Level = 'off' | 'collapsed' | 'detailed';
export const LEVELS: Level[] = ['off', 'collapsed', 'detailed'];
export const DEFAULT_LEVELS: Record<Kind, Level> = {
	organization: 'detailed',
	system: 'detailed',
	dataset: 'detailed',
	service: 'detailed',
};

export interface MapOptions {
	view: MapView;
	levels: Record<Kind, Level>;
	orgTypes: Set<OrgType>;
	relations: Set<string>;
	hideIsolated: boolean;
	/** compact IRI of a subgraph (dcmitype:Collection) or null for everything */
	subgraph: string | null;
	/** node id to focus on (only its neighbourhood is shown) */
	focus: string | null;
	hops: number;
}

export const ORG_TYPES: OrgType[] = ['federal', 'cantonal', 'private', 'other'];
/** Relations the user can toggle; hierarchy relations are steered by the per-class level instead. */
export const SELECTABLE_RELATIONS = RELATIONS.filter((r) => !HIERARCHY_KEYS.has(r.key));
export const DEFAULT_RELATIONS = SELECTABLE_RELATIONS.map((r) => r.key);

export interface MapNode {
	id: string;
	entity: Entity;
	kind: Kind;
	/** number of elements merged into this node when its class is collapsed (1 = none) */
	members: number;
	degree: number;
	orgType?: OrgType;
	/** nearest visible ancestor of the same class (detailed level) – drawn as a tree */
	parentId?: string;
	depth: number;
	x: number;
	y: number;
	/** width in the layered layout (nested children are narrower) */
	w: number;
}

export interface MapEdge {
	id: string;
	s: string;
	o: string;
	key: string;
	weight: number;
	dashed: boolean;
	/** parent/child or whole/part relation (always included, rendered as structure) */
	hierarchy: boolean;
}

export interface MapGraph {
	nodes: MapNode[];
	edges: MapEdge[];
	nodeById: Map<string, MapNode>;
	/** neighbours per node id */
	adjacency: Map<string, Set<string>>;
}

const DASHED = new Set(RELATIONS.filter((r) => r.dashed).map((r) => r.key));

export function representativeOf(graph: SystemMapGraph, id: string, levels: Record<Kind, Level>): string {
	const e = graph.entities.get(id);
	if (e && levels[e.kind as Kind] === 'collapsed' && e.root) return e.root;
	return id;
}

/** Applies all map filters and the per-class aggregation to the full graph. */
export function buildMapGraph(graph: SystemMapGraph, opt: MapOptions): MapGraph {
	const subgraph = opt.subgraph ? graph.collections.find((c) => c.id === opt.subgraph) : undefined;
	const representative = (e: Entity): string => representativeOf(graph, e.id, opt.levels);

	// 1. candidate entities
	const members = new Map<string, number>();
	const include = new Set<string>();
	for (const kind of KINDS) {
		if (opt.levels[kind] === 'off') continue;
		for (const e of graph.byKind[kind]) {
			if (subgraph && !subgraph.members.has(e.id)) continue;
			const rep = representative(e);
			const repEntity = graph.entities.get(rep)!;
			if (kind === 'organization' && !opt.orgTypes.has(repEntity.orgType ?? 'other')) continue;
			include.add(rep);
			members.set(rep, (members.get(rep) ?? 0) + 1);
		}
	}

	// 2. edges, re-targeted onto collapsed representatives and merged (hierarchy edges vanish when collapsed
	//    because both ends map onto the same representative)
	const edgeMap = new Map<string, MapEdge>();
	for (const r of graph.relations) {
		const hierarchy = HIERARCHY_KEYS.has(r.key);
		if (!hierarchy && !opt.relations.has(r.key)) continue;
		const se = graph.entities.get(r.s)!;
		const oe = graph.entities.get(r.o)!;
		if (subgraph && (!subgraph.members.has(se.id) || !subgraph.members.has(oe.id))) continue;
		const s = representative(se);
		const o = representative(oe);
		if (s === o || !include.has(s) || !include.has(o)) continue;
		const id = `${s}|${r.key}|${o}`;
		const hit = edgeMap.get(id);
		if (hit) hit.weight++;
		else edgeMap.set(id, { id, s, o, key: r.key, weight: 1, dashed: DASHED.has(r.key), hierarchy });
	}
	let edges = [...edgeMap.values()];

	const adjacencyOf = (es: MapEdge[]): Map<string, Set<string>> => {
		const adj = new Map<string, Set<string>>();
		for (const e of es) {
			if (!adj.has(e.s)) adj.set(e.s, new Set());
			if (!adj.has(e.o)) adj.set(e.o, new Set());
			adj.get(e.s)!.add(e.o);
			adj.get(e.o)!.add(e.s);
		}
		return adj;
	};
	let adjacency = adjacencyOf(edges);

	// 3. focus: keep only the k-hop neighbourhood
	let visible = include;
	const focus = opt.focus ? representativeOf(graph, opt.focus, opt.levels) : null;
	if (focus && include.has(focus)) {
		const keep = new Set([focus]);
		let frontier = [focus];
		for (let h = 0; h < opt.hops; h++) {
			const next: string[] = [];
			for (const id of frontier)
				for (const n of adjacency.get(id) ?? [])
					if (!keep.has(n)) {
						keep.add(n);
						next.push(n);
					}
			frontier = next;
		}
		visible = keep;
		edges = edges.filter((e) => keep.has(e.s) && keep.has(e.o));
		adjacency = adjacencyOf(edges);
	}

	// 4. nodes
	const nodes: MapNode[] = [];
	for (const id of visible) {
		const degree = adjacency.get(id)?.size ?? 0;
		if (opt.hideIsolated && degree === 0 && id !== focus) continue;
		const entity = graph.entities.get(id)!;
		nodes.push({
			id,
			entity,
			kind: entity.kind as Kind,
			members: members.get(id) ?? 1,
			degree,
			orgType: entity.orgType,
			depth: 0,
			x: 0,
			y: 0,
			w: 0,
		});
	}
	const nodeById = new Map(nodes.map((n) => [n.id, n]));
	edges = edges.filter((e) => nodeById.has(e.s) && nodeById.has(e.o));

	// 5. visible hierarchy: nearest visible ancestor (skipping filtered-out levels) and resulting depth
	for (const n of nodes) {
		let cur: string | undefined = n.entity.parents[0];
		const seen = new Set<string>([n.id]);
		while (cur && !nodeById.has(cur) && !seen.has(cur)) {
			seen.add(cur);
			cur = graph.entities.get(cur)?.parents[0];
		}
		if (cur && cur !== n.id && nodeById.has(cur)) n.parentId = cur;
	}
	for (const n of nodes) {
		let depth = 0;
		let cur = n.parentId;
		const seen = new Set<string>([n.id]);
		while (cur && !seen.has(cur)) {
			seen.add(cur);
			depth++;
			cur = nodeById.get(cur)?.parentId;
		}
		n.depth = Math.min(depth, 6);
	}

	return { nodes, edges, nodeById, adjacency: adjacencyOf(edges) };
}
