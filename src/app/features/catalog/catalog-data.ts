import { Entity, Lang, SystemMapGraph } from '../../core/graph.model';
import { entityLabel, entityTitle, pick } from '../../core/i18n';
import { Kind } from '../../core/vocab';

export interface CatalogRow {
	e: Entity;
	name: string;
	description: string;
	/** where the entity "lives": systems for data, operators for systems, parents for orgs, providers for services */
	systems: Entity[];
	operators: Entity[];
	/** top-level organizations responsible (for filtering) */
	operatorRoots: Set<string>;
	datasets: Entity[];
	users: Entity[];
	keywords: Entity[];
	legal: Entity[];
	degree: number;
	search: string;
}

const uniq = (list: (Entity | undefined)[]): Entity[] => {
	const seen = new Set<string>();
	const out: Entity[] = [];
	for (const e of list) if (e && !seen.has(e.id)) (seen.add(e.id), out.push(e));
	return out;
};

export function buildRows(g: SystemMapGraph, kind: Kind, lang: Lang): CatalogRow[] {
	const get = (id: string): Entity | undefined => g.entities.get(id);
	const incoming = (e: Entity, key: string): Entity[] => e.in.filter((r) => r.key === key).map((r) => get(r.s)!);
	const outgoing = (e: Entity, key: string): Entity[] => e.out.filter((r) => r.key === key).map((r) => get(r.o)!);
	const operatorsOf = (systems: Entity[]): Entity[] => uniq(systems.flatMap((s) => incoming(s, 'operates')));

	return g.byKind[kind]
		.map((e) => {
			let systems: Entity[] = [];
			let operators: Entity[] = [];
			let datasets: Entity[] = [];
			let users: Entity[] = [];
			if (kind === 'dataset') {
				systems = incoming(e, 'contains');
				// parts of a larger data set inherit where the whole is stored
				if (!systems.length) systems = uniq(outgoing(e, 'isPartOf').flatMap((p) => incoming(p, 'contains')));
				operators = operatorsOf(systems);
			} else if (kind === 'system') {
				operators = incoming(e, 'operates');
				datasets = outgoing(e, 'contains');
				users = outgoing(e, 'consumes');
			} else if (kind === 'organization') {
				systems = outgoing(e, 'operates');
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
			const search = normalize(
				[
					...Object.values(e.name),
					e.abbreviation ?? '',
					description,
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
				users,
				keywords,
				legal,
				degree: new Set([...e.in.map((r) => r.s), ...e.out.map((r) => r.o)]).size,
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

export function toCsv(rows: CatalogRow[], kind: Kind, lang: Lang, headers: string[]): string {
	const esc = (v: string): string => (/[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
	const names = (list: Entity[]): string => list.map((x) => entityLabel(x, lang)).join('; ');
	const lines = [headers.map(esc).join(',')];
	for (const r of rows) {
		const flags = [
			r.e.sensitive ? 'sensitive' : r.e.personal ? 'personal' : '',
			r.e.master ? 'master' : '',
			r.e.fmis ? 'FMIS' : '',
		]
			.filter(Boolean)
			.join('; ');
		const cells = [
			r.e.id,
			r.name,
			kind === 'organization' ? (r.e.orgType ?? '') : flags,
			names(r.systems),
			names(r.operators),
			names(r.datasets),
			r.e.urls.join(' '),
			r.description,
		];
		lines.push(cells.map(esc).join(','));
	}
	return '﻿' + lines.join('\r\n');
}
