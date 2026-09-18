import { Injectable, signal } from '@angular/core';

import { ENDPOINT, GRAPH_IRI, NS } from './vocab';

/** Number of triples in the graph – asked live on every visit, never cached. */
const COUNT_QUERY = `SELECT (COUNT(?s) AS ?N)
FROM <${GRAPH_IRI}>
WHERE {
  ?s ?p ?o .
}`;

/** Creation and last modification date of the dataset, from its metadata record. */
const DATES_QUERY = `PREFIX schema: <${NS.schema}>
SELECT ?created ?modified
FROM <${GRAPH_IRI}>
WHERE {
  <${NS.sm}metadata> schema:dateCreated ?created ; schema:dateModified ?modified .
}`;

export interface LiveStats {
	triples: number;
	created?: string;
	modified?: string;
	/** when LINDAS answered */
	at: Date;
}

interface SparqlJson {
	results: { bindings: Record<string, { value: string }>[] };
}

/**
 * Live figures about the graph shown in the data section of every page. Unlike the graph itself these are never
 * served from a cache: every visit asks LINDAS anew, so the date and the triple count are always current.
 */
@Injectable({ providedIn: 'root' })
export class LiveStatsService {
	readonly stats = signal<LiveStats | null>(null);
	readonly loading = signal(false);
	readonly error = signal<string | null>(null);

	constructor() {
		void this.refresh();
	}

	async refresh(): Promise<void> {
		this.loading.set(true);
		try {
			const [count, dates] = await Promise.all([select(COUNT_QUERY), select(DATES_QUERY)]);
			this.stats.set({
				triples: Number(count[0]?.['N']?.value ?? 0),
				created: dates[0]?.['created']?.value,
				modified: dates[0]?.['modified']?.value,
				at: new Date(),
			});
			this.error.set(null);
		} catch (e) {
			this.error.set(e instanceof Error ? e.message : String(e));
		} finally {
			this.loading.set(false);
		}
	}
}

async function select(query: string): Promise<Record<string, { value: string }>[]> {
	const res = await fetch(`${ENDPOINT}?query=${encodeURIComponent(query)}`, {
		headers: { Accept: 'application/sparql-results+json' },
		cache: 'no-store',
	});
	if (!res.ok) throw new Error(`LINDAS responded with HTTP ${res.status}`);
	return ((await res.json()) as SparqlJson).results.bindings;
}
