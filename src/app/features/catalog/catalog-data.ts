import { Entity, Lang, SystemMapGraph } from '../../core/graph.model';
import { entityLabel, entityTitle, pick } from '../../core/i18n';
import { Kind } from '../../core/vocab';

/** The figures shown as numeric columns; what they count depends on the class (see buildRows). */
export type CountKey = 'systems' | 'datasets' | 'services' | 'users' | 'parts' | 'legal';

export interface CatalogRow {
	e: Entity;
	name: string;
	description: string;
	/** where the element "lives": systems for data, providers for services, systems operated for organizations */
	systems: Entity[];
	/** who is responsible: operators for data and systems, parent units for organizations */
	operators: Entity[];
	/** top-level organizations responsible (for filtering) */
	operatorRoots: Set<string>;
	datasets: Entity[];
	services: Entity[];
	/** systems using a service / services used by a system */
	users: Entity[];
	keywords: Entity[];
	legal: Entity[];
	counts: Record<CountKey, number>;
	address?: string;
	search: string;
}

const uniq = (list: (Entity | undefined)[]): Entity[] => {
	const seen = new Set<string>();
	const out: Entity[] = [];
	for (const e of list) if (e && !seen.has(e.id)) (seen.add(e.id), out.push(e));
	return out;
};

/**
 * Rows for one class. Figures roll up along the hierarchy: an organization counts the systems operated by itself and
 * all its sub-units (schema:subOrganization*), a system counts the data sets and services of itself and its parts.
 */
export function buildRows(
	g: SystemMapGraph,
	kind: Kind,
	lang: Lang,
	addresses: ReadonlyMap<string, string>,
): CatalogRow[] {
	const get = (id: string): Entity | undefined => g.entities.get(id);
	const incoming = (e: Entity, key: string): Entity[] => e.in.filter((r) => r.key === key).map((r) => get(r.s)!);
	const outgoing = (e: Entity, key: string): Entity[] => e.out.filter((r) => r.key === key).map((r) => get(r.o)!);
	const operatorsOf = (systems: Entity[]): Entity[] => uniq(systems.flatMap((s) => incoming(s, 'operates')));
	/** the elements and everything below them in their hierarchy */
	const withDescendants = (roots: Entity[]): Entity[] => {
		const out: Entity[] = [];
		const seen = new Set<string>();
		const stack = [...roots];
		while (stack.length) {
			const e = stack.pop()!;
			if (seen.has(e.id)) continue;
			seen.add(e.id);
			out.push(e);
			for (const c of e.children) {
				const ce = get(c);
				if (ce) stack.push(ce);
			}
		}
		return out;
	};

	return g.byKind[kind]
		.map((e) => {
			let systems: Entity[] = [];
			let operators: Entity[] = [];
			let datasets: Entity[] = [];
			let services: Entity[] = [];
			let users: Entity[] = [];
			const tree = withDescendants([e]);
			if (kind === 'dataset') {
				systems = incoming(e, 'contains');
				// parts of a larger data set inherit where the whole is stored
				if (!systems.length) systems = uniq(outgoing(e, 'isPartOf').flatMap((p) => incoming(p, 'contains')));
				operators = operatorsOf(systems);
			} else if (kind === 'system') {
				operators = incoming(e, 'operates');
				datasets = uniq(tree.flatMap((s) => outgoing(s, 'contains')));
				services = uniq(tree.flatMap((s) => outgoing(s, 'provides')));
				users = outgoing(e, 'consumes');
			} else if (kind === 'organization') {
				systems = uniq(tree.flatMap((u) => outgoing(u, 'operates')));
				const allSystems = withDescendants(systems);
				datasets = uniq(allSystems.flatMap((s) => outgoing(s, 'contains')));
				services = uniq(allSystems.flatMap((s) => outgoing(s, 'provides')));
				operators = e.parents.map(get).filter((x): x is Entity => !!x);
			} else if (kind === 'service') {
				systems = incoming(e, 'provides');
				operators = operatorsOf(systems);
				users = incoming(e, 'consumes');
			}
			const roots = new Set(operators.map((o) => o.root ?? o.id));
			if (kind === 'organization') roots.add(e.root ?? e.id);
			const keywords = e.keywords.map(get).filter((x): x is Entity => !!x);
			const legal = outgoing(e, 'hasLegalBasis');
			const name = entityTitle(e, lang);
			const description = pick(e.description, lang);
			const address = addresses.get(e.id);
			const search = normalize(
				[
					...Object.values(e.name),
					e.abbreviation ?? '',
					description,
					address ?? '',
					...systems.map((s) => entityLabel(s, lang)),
					...operators.map((s) => entityLabel(s, lang)),
					...keywords.map((k) => entityLabel(k, lang)),
				].join(' '),
			);
			return {
				e,
				name,
				description,
				systems,
				operators,
				operatorRoots: roots,
				datasets,
				services,
				users,
				keywords,
				legal,
				counts: {
					systems: systems.length,
					datasets: datasets.length,
					services: services.length,
					users: users.length,
					parts: tree.length - 1,
					legal: legal.length,
				},
				address,
				search,
			};
		})
		.sort((a, b) => a.name.localeCompare(b.name, lang));
}

export function normalize(s: string): string {
	return s
		.toLowerCase()
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '');
}

/** CSV export of the filtered rows; `t` translates the column headers. */
export function toCsv(rows: CatalogRow[], kind: Kind, lang: Lang, t: (key: string) => string): string {
	const esc = (v: string | number): string => {
		const s = String(v);
		return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
	};
	const names = (list: Entity[]): string => list.map((x) => entityLabel(x, lang)).join('; ');
	const flags = (r: CatalogRow): string =>
		[r.e.sensitive ? 'sensitive' : r.e.personal ? 'personal' : '', r.e.master ? 'master' : '', r.e.fmis ? 'FMIS' : '']
			.filter(Boolean)
			.join('; ');

	const columns: [string, (r: CatalogRow) => string | number][] = [
		['IRI', (r) => r.e.id],
		[t('catalog.col.name'), (r) => r.name],
		[t('catalog.col.description'), (r) => r.description],
	];
	if (kind === 'organization') {
		columns.push(
			[t('catalog.sector'), (r) => t(`orgType.${r.e.orgType ?? 'other'}`)],
			[t('catalog.address'), (r) => r.address ?? ''],
			[t('catalog.who.organization'), (r) => names(r.operators)],
			[t('catalog.num.parts.organization'), (r) => r.counts.parts],
			[t('catalog.num.systems'), (r) => r.counts.systems],
			[t('catalog.num.datasets'), (r) => r.counts.datasets],
			[t('catalog.num.services'), (r) => r.counts.services],
		);
	} else if (kind === 'dataset') {
		columns.push(
			[t('catalog.col.flags'), flags],
			[t('catalog.where.dataset'), (r) => names(r.systems)],
			[t('catalog.who.dataset'), (r) => names(r.operators)],
			[t('catalog.num.parts.dataset'), (r) => r.counts.parts],
			[t('catalog.num.legal'), (r) => r.counts.legal],
			[t('catalog.keywords'), (r) => names(r.keywords)],
		);
	} else if (kind === 'system') {
		columns.push(
			[t('catalog.col.flags'), flags],
			[t('catalog.who.system'), (r) => names(r.operators)],
			[t('catalog.num.datasets'), (r) => r.counts.datasets],
			[t('catalog.num.services'), (r) => r.counts.services],
			[t('catalog.num.users.system'), (r) => r.counts.users],
			[t('catalog.num.parts.system'), (r) => r.counts.parts],
		);
	} else {
		columns.push(
			[t('catalog.where.service'), (r) => names(r.systems)],
			[t('catalog.who.service'), (r) => names(r.operators)],
			[t('catalog.num.users.service'), (r) => r.counts.users],
		);
	}
	columns.push([t('catalog.col.website'), (r) => r.e.urls.join(' ')]);

	const lines = [columns.map(([h]) => esc(h)).join(',')];
	for (const r of rows) lines.push(columns.map(([, f]) => esc(f(r))).join(','));
	return '﻿' + lines.join('\r\n');
}
