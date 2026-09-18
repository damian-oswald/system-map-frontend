import { Injectable, signal } from '@angular/core';

import { ENDPOINT } from './vocab';

const CACHE_KEY = 'system-map.addresses.v1';

/**
 * Organizations in the system map are linked (owl:sameAs) to the commercial register (Zefix) and to the federal
 * Staatskalender; both registers publish a schema:PostalAddress for them on LINDAS.
 */
const QUERY = `PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX schema: <http://schema.org/>
SELECT ?org ?street ?zip ?city WHERE {
  GRAPH <https://lindas.admin.ch/foag/system-map> { ?org owl:sameAs ?same }
  { GRAPH <https://lindas.admin.ch/foj/zefix> {
      ?same schema:address ?a . ?a schema:streetAddress ?street ; schema:postalCode ?zip ; schema:addressLocality ?city } }
  UNION
  { GRAPH <https://lindas.admin.ch/fch/staatskalender> {
      ?same schema:address ?a . ?a schema:streetAddress ?street ; schema:postalCode ?zip ; schema:addressLocality ?city } }
}`;

interface SparqlJson {
	results: { bindings: Record<string, { value: string }>[] };
}

/** Formatted postal addresses per organization id, loaded on demand (the inventory is the only page that needs them). */
@Injectable({ providedIn: 'root' })
export class AddressService {
	readonly addresses = signal<ReadonlyMap<string, string>>(new Map());
	private started = false;

	/** Starts loading once; shows the cached copy immediately and refreshes it in the background. */
	load(): void {
		if (this.started) return;
		this.started = true;
		const cached = this.readCache();
		if (cached) this.addresses.set(parse(cached));
		void fetch(`${ENDPOINT}?query=${encodeURIComponent(QUERY)}`, {
			headers: { Accept: 'application/sparql-results+json' },
		})
			.then((res) => (res.ok ? res.text() : Promise.reject(new Error(`HTTP ${res.status}`))))
			.then((text) => {
				this.addresses.set(parse(text));
				this.writeCache(text);
			})
			.catch(() => {
				// addresses are an extra; the inventory works without them
			});
	}

	private readCache(): string | null {
		try {
			return localStorage.getItem(CACHE_KEY);
		} catch {
			return null;
		}
	}

	private writeCache(text: string): void {
		try {
			localStorage.setItem(CACHE_KEY, text);
		} catch {
			// storage disabled or full
		}
	}
}

function parse(text: string): Map<string, string> {
	const out = new Map<string, string>();
	try {
		for (const b of (JSON.parse(text) as SparqlJson).results.bindings) {
			const org = b['org']?.value;
			if (!org || out.has(org)) continue;
			const street = b['street']?.value ?? '';
			const place = [b['zip']?.value, b['city']?.value].filter(Boolean).join(' ');
			out.set(org, [street, place].filter(Boolean).join(', '));
		}
	} catch {
		// malformed response: no addresses
	}
	return out;
}
