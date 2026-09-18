import { Injectable, computed, signal } from '@angular/core';

import { buildGraph } from './graph-builder';
import { Entity, SystemMapGraph } from './graph.model';
import { parseNTriples } from './ntriples';
import { ENDPOINT, expandIri } from './vocab';

declare global {
	interface Window {
		__SM_QUERY__?: string;
		__SM_GRAPH__?: Promise<string>;
	}
}

const CACHE_KEY = 'system-map.graph.v1';
const CACHE_TIME_KEY = 'system-map.graph.v1.fetched';
const FALLBACK_QUERY =
	'CONSTRUCT{?s ?p ?o}WHERE{GRAPH<https://lindas.admin.ch/foag/system-map>{?s ?p ?o ' +
	'FILTER(!isBlank(?s)&&!isBlank(?o)&&!STRSTARTS(STR(?p),"http://www.w3.org/ns/shacl#"))}}';

export type LoadState = 'loading' | 'ready' | 'error';

/**
 * Loads the complete system map graph from LINDAS with a single CONSTRUCT query (~170 kB gzipped) and turns it into
 * an in-memory model that every page works on. Strategy for speed:
 *  1. the request is fired from index.html before Angular boots,
 *  2. the last response is kept in localStorage and rendered instantly on the next visit (stale-while-revalidate).
 */
@Injectable({ providedIn: 'root' })
export class GraphService {
	readonly state = signal<LoadState>('loading');
	readonly graph = signal<SystemMapGraph | null>(null);
	readonly error = signal<string | null>(null);
	/** true while showing cached data and a fresh copy is being fetched */
	readonly revalidating = signal(false);
	/** when the data currently shown was fetched from LINDAS */
	readonly fetchedAt = signal<Date | null>(null);
	readonly query = window.__SM_QUERY__ ?? FALLBACK_QUERY;

	readonly entityByKey = computed(() => {
		const g = this.graph();
		const map = new Map<string, Entity>();
		if (g) for (const e of g.entities.values()) map.set(e.key, e);
		return map;
	});

	constructor() {
		void this.load();
	}

	entity(idOrKey: string): Entity | undefined {
		const g = this.graph();
		return g?.entities.get(idOrKey) ?? g?.entities.get(expandIri(idOrKey)) ?? this.entityByKey().get(idOrKey);
	}

	async reload(): Promise<void> {
		window.__SM_GRAPH__ = undefined;
		this.revalidating.set(true);
		await this.fetchAndApply(null);
	}

	private async load(): Promise<void> {
		const cached = this.readCache();
		if (cached) {
			try {
				this.apply(cached);
				this.fetchedAt.set(this.readCacheTime());
				this.revalidating.set(true);
			} catch {
				// corrupt cache: ignore and wait for the network
			}
		}
		await this.fetchAndApply(cached);
	}

	private async fetchAndApply(cached: string | null): Promise<void> {
		try {
			const text = await (window.__SM_GRAPH__ ?? this.fetchGraph());
			window.__SM_GRAPH__ = undefined;
			if (text !== cached) this.apply(text);
			this.fetchedAt.set(new Date());
			this.writeCache(text);
		} catch (e) {
			if (!this.graph()) {
				this.error.set(e instanceof Error ? e.message : String(e));
				this.state.set('error');
			}
		} finally {
			this.revalidating.set(false);
		}
	}

	private async fetchGraph(): Promise<string> {
		const res = await fetch(`${ENDPOINT}?query=${encodeURIComponent(this.query)}`, {
			headers: { Accept: 'application/n-triples' },
		});
		if (!res.ok) throw new Error(`LINDAS responded with HTTP ${res.status}`);
		return res.text();
	}

	private apply(text: string): void {
		const graph = buildGraph(parseNTriples(text));
		if (!graph.entities.size) throw new Error('The graph is empty');
		this.graph.set(graph);
		this.state.set('ready');
		this.error.set(null);
	}

	private readCache(): string | null {
		try {
			return localStorage.getItem(CACHE_KEY);
		} catch {
			return null;
		}
	}

	private readCacheTime(): Date | null {
		try {
			const t = Number(localStorage.getItem(CACHE_TIME_KEY));
			return t ? new Date(t) : null;
		} catch {
			return null;
		}
	}

	private writeCache(text: string): void {
		try {
			localStorage.setItem(CACHE_KEY, text);
			localStorage.setItem(CACHE_TIME_KEY, String(Date.now()));
		} catch {
			// quota exceeded or storage disabled: caching is only an optimization
		}
	}
}
