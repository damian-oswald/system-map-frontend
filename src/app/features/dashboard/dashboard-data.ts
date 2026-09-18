import { CANTONS } from '../../core/cantons';
import { Entity, LANGS, OrgType, SystemMapGraph } from '../../core/graph.model';
import { KINDS, Kind } from '../../core/vocab';

export interface RankItem {
	entity: Entity;
	value: number;
	orgType?: OrgType;
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

export interface DashboardData {
	counts: Record<Kind, number>;
	topLevelOrgs: number;
	cantonsCovered: number;
	fmis: number;
	personal: number;
	sensitive: number;
	master: number;
	serviceUsages: number;
	relations: number;
	orgTypes: { type: OrgType; count: number }[];
	operators: RankItem[];
	operatorsTotal: number;
	systemsByData: RankItem[];
	services: RankItem[];
	hubs: RankItem[];
	cantons: CantonStat[];
	waffle: Entity[];
	quality: QualityRow[];
	relationCounts: { key: string; count: number }[];
}

const ORG_ORDER: OrgType[] = ['federal', 'cantonal', 'private', 'other'];

export function computeDashboard(g: SystemMapGraph): DashboardData {
	const counts = Object.fromEntries(KINDS.map((k) => [k, g.byKind[k].length])) as Record<Kind, number>;
	const orgs = g.byKind.organization;
	const systems = g.byKind.system;
	const datasets = g.byKind.dataset;

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

	const containsCount = (s: Entity): number => s.out.filter((r) => r.key === 'contains').length;
	const systemsByData = systems
		.map((s) => ({ entity: s, value: containsCount(s) }))
		.filter((x) => x.value > 0)
		.sort((a, b) => b.value - a.value);

	const services = g.byKind.service
		.map((s) => ({ entity: s, value: new Set(s.in.filter((r) => r.key === 'consumes').map((r) => r.s)).size }))
		.sort((a, b) => b.value - a.value);

	const hubs = [...systems, ...datasets]
		.map((e) => ({ entity: e, value: new Set([...e.in.map((r) => r.s), ...e.out.map((r) => r.o)]).size }))
		.sort((a, b) => b.value - a.value)
		.slice(0, 10);

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

	const waffle = [...datasets].sort((a, b) => rankData(a) - rankData(b));

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

	const relCount = new Map<string, number>();
	for (const r of g.relations) relCount.set(r.key, (relCount.get(r.key) ?? 0) + 1);

	return {
		counts,
		topLevelOrgs: orgs.filter((o) => o.root === o.id).length,
		cantonsCovered: cantons.filter((c) => c.orgs > 0).length,
		fmis: systems.filter((s) => s.fmis).length,
		personal: datasets.filter((d) => d.personal).length,
		sensitive: datasets.filter((d) => d.sensitive).length,
		master: datasets.filter((d) => d.master).length,
		serviceUsages: g.relations.filter((r) => r.key === 'consumes').length,
		relations: g.relations.length,
		orgTypes,
		operators: operators.slice(0, 12),
		operatorsTotal: operators.length,
		systemsByData: systemsByData.slice(0, 10),
		services,
		hubs,
		cantons,
		waffle,
		quality,
		relationCounts: [...relCount.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count),
	};
}

function rankData(d: Entity): number {
	if (d.sensitive) return 0;
	if (d.personal) return 1;
	return 2;
}
