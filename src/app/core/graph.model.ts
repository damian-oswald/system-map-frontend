import { Kind } from './vocab';

export type Lang = 'de' | 'fr' | 'it' | 'en';
export const LANGS: Lang[] = ['de', 'fr', 'it', 'en'];

/** Literal values keyed by language tag ('' = untagged). */
export type LangText = Record<string, string>;

export type EntityKind = Kind | 'legislation' | 'keyword' | 'collection' | 'other';
export type OrgType = 'federal' | 'cantonal' | 'private' | 'other';

export interface Relation {
	/** canonical relation key, see RELATIONS in vocab.ts */
	key: string;
	s: string;
	o: string;
}

export interface Entity {
	id: string;
	/** compact IRI used in routes */
	key: string;
	kind: EntityKind;
	types: Set<string>;
	name: LangText;
	description: LangText;
	abbreviation?: string;
	urls: string[];
	keywords: string[];
	sameAs: string[];
	collections: string[];
	out: Relation[];
	in: Relation[];

	// organizations
	orgType?: OrgType;
	parents: string[];
	children: string[];
	/** top-level organization this one rolls up to (itself for top-level orgs) */
	root?: string;
	depth?: number;
	canton?: string;

	// systems
	fmis?: boolean;

	// datasets
	personal?: boolean;
	sensitive?: boolean;
	master?: boolean;

	/** number of triples with this element as subject – how much is recorded about it */
	props: number;
}

export interface TermInfo {
	name: LangText;
	description: LangText;
}

export interface Collection {
	id: string;
	name: LangText;
	members: Set<string>;
}

export interface GraphMeta {
	name: LangText;
	description: LangText;
	dateCreated?: string;
	datePublished?: string;
	dateModified?: string;
	url?: string;
}

export interface SystemMapGraph {
	entities: Map<string, Entity>;
	byKind: Record<Kind, Entity[]>;
	/** relations among organizations, systems, datasets and services */
	relations: Relation[];
	legislation: Entity[];
	keywords: Entity[];
	collections: Collection[];
	classes: Map<string, TermInfo>;
	relationInfo: Map<string, TermInfo>;
	meta: GraphMeta;
	tripleCount: number;
	loadedAt: Date;
}
