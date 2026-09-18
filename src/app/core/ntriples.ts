/** A parsed RDF term, reduced to what the app needs. */
export interface Term {
	/** IRI, blank node label or literal lexical value */
	value: string;
	isLiteral: boolean;
	/** language tag of a literal, '' if none */
	lang: string;
}

export interface Triple {
	s: string;
	p: string;
	o: Term;
}

const ESCAPES: Record<string, string> = { t: '\t', b: '\b', n: '\n', r: '\r', f: '\f', '"': '"', "'": "'", '\\': '\\' };

/**
 * Minimal, allocation-light N-Triples parser. The whole system map is ~5k triples, which this parses in a few
 * milliseconds; pulling in a full RDF library would cost more in bundle size than it would ever save.
 */
export function parseNTriples(text: string): Triple[] {
	const triples: Triple[] = [];
	const len = text.length;
	let i = 0;

	const skipWs = (): void => {
		while (i < len && (text[i] === ' ' || text[i] === '\t')) i++;
	};
	const readIriOrBlank = (): string => {
		if (text[i] === '<') {
			const end = text.indexOf('>', i);
			const iri = text.slice(i + 1, end);
			i = end + 1;
			return iri.includes('\\u') ? unescapeUnicode(iri) : iri;
		}
		// blank node _:label
		const start = i;
		while (i < len && text[i] !== ' ' && text[i] !== '\t') i++;
		return text.slice(start, i);
	};
	const readLiteral = (): Term => {
		i++; // opening quote
		let value = '';
		let chunkStart = i;
		while (i < len && text[i] !== '"') {
			if (text[i] === '\\') {
				value += text.slice(chunkStart, i);
				const c = text[i + 1];
				if (c === 'u' || c === 'U') {
					const n = c === 'u' ? 4 : 8;
					value += String.fromCodePoint(parseInt(text.slice(i + 2, i + 2 + n), 16));
					i += 2 + n;
				} else {
					value += ESCAPES[c] ?? c;
					i += 2;
				}
				chunkStart = i;
			} else {
				i++;
			}
		}
		value += text.slice(chunkStart, i);
		i++; // closing quote
		let lang = '';
		if (text[i] === '@') {
			const start = ++i;
			while (i < len && /[A-Za-z0-9-]/.test(text[i])) i++;
			lang = text.slice(start, i).toLowerCase();
		} else if (text[i] === '^' && text[i + 1] === '^') {
			i += 2;
			readIriOrBlank(); // datatype is irrelevant for display
		}
		return { value, isLiteral: true, lang };
	};

	while (i < len) {
		skipWs();
		const c = text[i];
		if (c === '\n' || c === '\r') {
			i++;
			continue;
		}
		if (c === '#') {
			i = nextLine(text, i);
			continue;
		}
		if (c === undefined) break;
		const s = readIriOrBlank();
		skipWs();
		const p = readIriOrBlank();
		skipWs();
		const o: Term = text[i] === '"' ? readLiteral() : { value: readIriOrBlank(), isLiteral: false, lang: '' };
		triples.push({ s, p, o });
		i = nextLine(text, i);
	}
	return triples;
}

function nextLine(text: string, from: number): number {
	const nl = text.indexOf('\n', from);
	return nl === -1 ? text.length : nl + 1;
}

function unescapeUnicode(s: string): string {
	return s.replace(/\\u([0-9a-fA-F]{4})|\\U([0-9a-fA-F]{8})/g, (_, a: string, b: string) =>
		String.fromCodePoint(parseInt(a ?? b, 16)),
	);
}
