export const ENDPOINT = 'https://lindas.admin.ch/query';
export const GRAPH_IRI = 'https://lindas.admin.ch/foag/system-map';
export const REPO_URL = 'https://github.com/blw-ofag-ufag/system-map';

export const NS = {
	rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
	rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
	owl: 'http://www.w3.org/2002/07/owl#',
	schema: 'http://schema.org/',
	dcat: 'http://www.w3.org/ns/dcat#',
	dcterms: 'http://purl.org/dc/terms/',
	dcmitype: 'http://purl.org/dc/dcmitype/',
	prov: 'http://www.w3.org/ns/prov#',
	service: 'http://purl.org/ontology/service#',
	skos: 'http://www.w3.org/2004/02/skos/core#',
	void: 'http://rdfs.org/ns/void#',
	sm: 'https://agriculture.ld.admin.ch/system-map/',
	termdat: 'https://register.ld.admin.ch/termdat/',
	zefix: 'https://register.ld.admin.ch/zefix/company/',
	sk: 'https://register.ld.admin.ch/staatskalender/organization/',
	fedlex: 'https://www.fedlex.admin.ch/eli/',
} as const;

export const RDF_TYPE = NS.rdf + 'type';

export const CLS = {
	organization: NS.schema + 'Organization',
	government: NS.schema + 'GovernmentOrganization',
	federal: NS.sm + 'FederalOrganization',
	cantonal: NS.sm + 'CantonalOrganization',
	private: NS.sm + 'PrivateOrganization',
	system: NS.schema + 'SoftwareApplication',
	fmis: NS.sm + 'FMIS',
	dataset: NS.dcat + 'Dataset',
	masterData: NS.sm + 'MasterData',
	personalData: NS.termdat + '52451',
	sensitiveData: NS.termdat + '52453',
	service: NS.service + 'Service',
	legislation: NS.schema + 'Legislation',
	keyword: NS.schema + 'DefinedTerm',
	collection: NS.dcmitype + 'Collection',
	objectProperty: NS.owl + 'ObjectProperty',
	owlClass: NS.owl + 'Class',
} as const;

export const PROP = {
	name: NS.schema + 'name',
	description: NS.schema + 'description',
	abbreviation: NS.sm + 'abbreviation',
	url: NS.schema + 'url',
	keywords: NS.schema + 'keywords',
	sameAs: NS.owl + 'sameAs',
	containsNodes: NS.sm + 'containsNodes',
	inverseOf: NS.owl + 'inverseOf',
	domain: NS.rdfs + 'domain',
	range: NS.rdfs + 'range',
} as const;

/** The four classes that make up the system map, in their fixed display (and colour) order. */
export const KINDS = ['organization', 'system', 'dataset', 'service'] as const;
export type Kind = (typeof KINDS)[number];

/**
 * Relations shown by the app. Each has a canonical direction; the inverse predicate (also present in the graph
 * after inference) is folded onto it so that every relation exists exactly once.
 */
export interface RelationDef {
	key: string;
	iri: string;
	inverse?: string;
	/** drawn as a dashed line in the map (weaker / non-structural relation) */
	dashed?: boolean;
	/** parent/child or whole/part relation – steered by the per-class level, not selectable */
	hierarchy?: boolean;
}

export const RELATIONS: RelationDef[] = [
	{ key: 'operates', iri: NS.sm + 'operates', inverse: NS.sm + 'operatedBy' },
	{ key: 'contains', iri: NS.sm + 'contains', inverse: NS.sm + 'containedIn' },
	{ key: 'provides', iri: NS.service + 'provides', inverse: NS.service + 'providedBy' },
	{ key: 'consumes', iri: NS.service + 'consumes', inverse: NS.service + 'consumedBy', dashed: true },
	{ key: 'isPartOf', iri: NS.dcterms + 'isPartOf', inverse: NS.dcterms + 'hasPart', hierarchy: true },
	{
		key: 'parentOrganization',
		iri: NS.schema + 'parentOrganization',
		inverse: NS.schema + 'subOrganization',
		hierarchy: true,
	},
	{ key: 'memberOf', iri: NS.schema + 'memberOf', inverse: NS.schema + 'member', dashed: true },
	{ key: 'owns', iri: NS.sm + 'owns', inverse: NS.sm + 'ownedBy', dashed: true },
	{ key: 'develops', iri: NS.sm + 'develops', inverse: NS.sm + 'developedBy', dashed: true },
	{ key: 'access', iri: NS.sm + 'access', dashed: true },
	{ key: 'wasDerivedFrom', iri: NS.prov + 'wasDerivedFrom', dashed: true },
	{ key: 'informs', iri: NS.sm + 'informs', dashed: true },
	{ key: 'usesMasterData', iri: NS.sm + 'usesMasterData', dashed: true },
	{ key: 'references', iri: NS.sm + 'references', dashed: true },
	{ key: 'hasLegalBasis', iri: NS.sm + 'hasLegalBasis' },
];

/** Relations that express a hierarchy (child → parent / part → whole). */
export const HIERARCHY_KEYS = new Set(RELATIONS.filter((r) => r.hierarchy).map((r) => r.key));

/** Stray predicates in the data that mean the same as a canonical one. */
export const PREDICATE_ALIASES: Record<string, string> = {
	[NS.sm + 'isPartOf']: NS.dcterms + 'isPartOf',
};

const PREFIXES: [string, string][] = [
	['sm', NS.sm],
	['zefix', NS.zefix],
	['sk', NS.sk],
	['fedlex', NS.fedlex],
	['termdat', NS.termdat],
];

/** Compact, URL-friendly identifier for an IRI (used in routes). */
export function compactIri(iri: string): string {
	for (const [prefix, ns] of PREFIXES) {
		if (iri.startsWith(ns)) return `${prefix}:${iri.slice(ns.length)}`;
	}
	return iri;
}

export function expandIri(key: string): string {
	const idx = key.indexOf(':');
	if (idx > 0) {
		const prefix = key.slice(0, idx);
		const hit = PREFIXES.find(([p]) => p === prefix);
		if (hit) return hit[1] + key.slice(idx + 1);
	}
	return key;
}
