import { detectCanton } from './cantons';
import { Collection, Entity, EntityKind, LangText, OrgType, Relation, SystemMapGraph, TermInfo } from './graph.model';
import { Triple } from './ntriples';
import {
	CLS,
	compactIri,
	HIERARCHY_KEYS,
	KINDS,
	Kind,
	NS,
	PREDICATE_ALIASES,
	PROP,
	RDF_TYPE,
	RELATIONS,
} from './vocab';

const METADATA_IRI = NS.sm + 'metadata';

/** Normalizes the indented multi-line literals used throughout the source Turtle files. */
export function cleanText(s: string): string {
	return s
		.split(/\n\s*\n/)
		.map((para) =>
			para
				.split('\n')
				.map((l) => l.trim())
				.filter(Boolean)
				.join(' '),
		)
		.filter(Boolean)
		.join('\n\n');
}

function kindOf(types: Set<string>): EntityKind {
	if (types.has(CLS.organization)) return 'organization';
	if (types.has(CLS.system)) return 'system';
	if (types.has(CLS.dataset)) return 'dataset';
	if (types.has(CLS.service)) return 'service';
	if (types.has(CLS.legislation)) return 'legislation';
	if (types.has(CLS.keyword)) return 'keyword';
	if (types.has(CLS.collection)) return 'collection';
	return 'other';
}

function orgTypeOf(types: Set<string>): OrgType {
	if (types.has(CLS.federal)) return 'federal';
	if (types.has(CLS.cantonal)) return 'cantonal';
	if (types.has(CLS.private)) return 'private';
	return 'other';
}

export function buildGraph(triples: Triple[]): SystemMapGraph {
	const relByIri = new Map<string, { key: string; swap: boolean }>();
	for (const r of RELATIONS) {
		relByIri.set(r.iri, { key: r.key, swap: false });
		if (r.inverse) relByIri.set(r.inverse, { key: r.key, swap: true });
	}

	// ---- pass 1: collect literals, types and raw links per subject
	interface Raw {
		types: Set<string>;
		lit: Map<string, LangText>;
		links: { p: string; o: string }[];
	}
	const raw = new Map<string, Raw>();
	const get = (id: string): Raw => {
		let r = raw.get(id);
		if (!r) {
			r = { types: new Set(), lit: new Map(), links: [] };
			raw.set(id, r);
		}
		return r;
	};
	for (const t of triples) {
		const r = get(t.s);
		if (t.p === RDF_TYPE) {
			r.types.add(t.o.value);
		} else if (t.o.isLiteral) {
			let m = r.lit.get(t.p);
			if (!m) r.lit.set(t.p, (m = {}));
			// keep the first value per language
			if (!(t.o.lang in m)) m[t.o.lang] = t.o.value;
		} else {
			r.links.push({ p: PREDICATE_ALIASES[t.p] ?? t.p, o: t.o.value });
		}
	}

	const text = (r: Raw | undefined, p: string, clean = false): LangText => {
		const m = r?.lit.get(p) ?? {};
		if (!clean) return m;
		const out: LangText = {};
		for (const [k, v] of Object.entries(m)) out[k] = cleanText(v);
		return out;
	};
	const termInfo = (id: string): TermInfo => {
		const r = raw.get(id);
		return { name: text(r, PROP.name), description: text(r, PROP.description, true) };
	};

	// ---- pass 2: entities
	const entities = new Map<string, Entity>();
	for (const [id, r] of raw) {
		const kind = kindOf(r.types);
		if (kind === 'other') continue;
		const e: Entity = {
			id,
			key: compactIri(id),
			kind,
			types: r.types,
			name: text(r, PROP.name),
			description: text(r, PROP.description, true),
			abbreviation: Object.values(text(r, PROP.abbreviation))[0],
			urls: [],
			keywords: [],
			sameAs: [],
			collections: [],
			out: [],
			in: [],
			parents: [],
			children: [],
		};
		if (kind === 'organization') e.orgType = orgTypeOf(r.types);
		if (kind === 'system') e.fmis = r.types.has(CLS.fmis);
		if (kind === 'dataset') {
			e.personal = r.types.has(CLS.personalData) || r.types.has(CLS.sensitiveData);
			e.sensitive = r.types.has(CLS.sensitiveData);
			e.master = r.types.has(CLS.masterData);
		}
		entities.set(id, e);
	}

	// ---- pass 3: links → relations, urls, keywords
	const relations: Relation[] = [];
	const seen = new Set<string>();
	const collections: Collection[] = [];
	for (const [id, r] of raw) {
		const e = entities.get(id);
		if (!e) continue;
		for (const { p, o } of r.links) {
			if (p === PROP.url) {
				if (!e.urls.includes(o)) e.urls.push(o);
				continue;
			}
			if (p === PROP.keywords) {
				if (!e.keywords.includes(o)) e.keywords.push(o);
				continue;
			}
			if (p === PROP.sameAs) {
				if (o !== id && !e.sameAs.includes(o)) e.sameAs.push(o);
				continue;
			}
			if (p === PROP.containsNodes) continue;
			const rel = relByIri.get(p);
			if (!rel) continue;
			const s = rel.swap ? o : id;
			const t = rel.swap ? id : o;
			if (!entities.has(s) || !entities.has(t) || s === t) continue;
			const k = `${s} ${rel.key} ${t}`;
			if (seen.has(k)) continue;
			seen.add(k);
			const relation: Relation = { key: rel.key, s, o: t };
			relations.push(relation);
			entities.get(s)!.out.push(relation);
			entities.get(t)!.in.push(relation);
		}
		if (e.kind === 'collection') {
			const members = new Set(r.links.filter((l) => l.p === PROP.containsNodes).map((l) => l.o));
			collections.push({ id, name: e.name, members });
			for (const m of members) entities.get(m)?.collections.push(id);
		}
	}

	// ---- hierarchies: organizations (child --parentOrganization--> parent) and parts (part --isPartOf--> whole)
	for (const rel of relations) {
		if (!HIERARCHY_KEYS.has(rel.key)) continue;
		const child = entities.get(rel.s)!;
		const parent = entities.get(rel.o)!;
		if (child.kind !== parent.kind) continue;
		child.parents.push(parent.id);
		parent.children.push(child.id);
	}
	const resolveRoot = (e: Entity): { root: string; depth: number } => {
		let cur = e;
		let depth = 0;
		const visited = new Set<string>([e.id]);
		while (cur.parents.length) {
			const next = entities.get(cur.parents[0])!;
			if (visited.has(next.id)) break; // cycle guard
			visited.add(next.id);
			cur = next;
			depth++;
		}
		return { root: cur.id, depth };
	};
	for (const e of entities.values()) {
		if (!(KINDS as readonly string[]).includes(e.kind)) continue;
		const { root, depth } = resolveRoot(e);
		e.root = root;
		e.depth = depth;
	}
	// cantons: detect on the top-level organization and inherit downwards
	for (const e of entities.values()) {
		if (e.kind !== 'organization' || e.orgType !== 'cantonal') continue;
		const chain: Entity[] = [];
		let cur: Entity | undefined = e;
		const visited = new Set<string>();
		while (cur && !visited.has(cur.id)) {
			visited.add(cur.id);
			chain.push(cur);
			cur = cur.parents.length ? entities.get(cur.parents[0]) : undefined;
		}
		for (const c of chain.reverse()) {
			const canton = detectCanton(Object.values(c.name));
			if (canton) {
				e.canton = canton;
				break;
			}
		}
	}

	const byKind = Object.fromEntries(KINDS.map((k) => [k, [] as Entity[]])) as Record<Kind, Entity[]>;
	const legislation: Entity[] = [];
	const keywords: Entity[] = [];
	for (const e of entities.values()) {
		if ((KINDS as readonly string[]).includes(e.kind)) byKind[e.kind as Kind].push(e);
		else if (e.kind === 'legislation') legislation.push(e);
		else if (e.kind === 'keyword') keywords.push(e);
	}

	// ---- ontology labels (classes & relations are described in the graph itself, in four languages)
	const classes = new Map<string, TermInfo>();
	for (const [id, r] of raw) {
		if (r.types.has(CLS.owlClass)) classes.set(id, termInfo(id));
	}
	const relationInfo = new Map<string, TermInfo>();
	for (const r of RELATIONS) relationInfo.set(r.key, termInfo(r.iri));

	const m = raw.get(METADATA_IRI);
	const first = (p: string): string | undefined => Object.values(text(m, p))[0];
	const meta = {
		name: text(m, PROP.name),
		description: text(m, PROP.description, true),
		dateCreated: first(NS.schema + 'dateCreated'),
		datePublished: first(NS.schema + 'datePublished'),
		dateModified: first(NS.schema + 'dateModified'),
		url: m?.links.find((l) => l.p === PROP.url)?.o,
	};

	return {
		entities,
		byKind,
		relations,
		legislation,
		keywords,
		collections,
		classes,
		relationInfo,
		meta,
		tripleCount: triples.length,
		loadedAt: new Date(),
	};
}
