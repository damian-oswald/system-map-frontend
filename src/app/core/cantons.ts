export interface Canton {
	code: string;
	/** names/terms that identify the canton in organization labels (any language) */
	names: string[];
	/** position in the tile-grid map of Switzerland (column, row) */
	x: number;
	y: number;
}

/** Tile-grid cartogram of the 26 cantons, roughly following their geographic position. */
export const CANTONS: Canton[] = [
	{ code: 'SH', names: ['Schaffhausen', 'Schaffhouse', 'Sciaffusa'], x: 5, y: 0 },
	{ code: 'BS', names: ['Basel-Stadt', 'Bâle-Ville', 'Basilea Città'], x: 3, y: 1 },
	{ code: 'BL', names: ['Basel-Landschaft', 'Bâle-Campagne', 'Basilea Campagna'], x: 4, y: 1 },
	{ code: 'AG', names: ['Aargau', 'Argovie', 'Argovia'], x: 5, y: 1 },
	{ code: 'ZH', names: ['Zürich', 'Zurich', 'Zurigo'], x: 6, y: 1 },
	{ code: 'TG', names: ['Thurgau', 'Thurgovie', 'Turgovia'], x: 7, y: 1 },
	{ code: 'JU', names: ['Jura', 'Giura'], x: 2, y: 2 },
	{ code: 'SO', names: ['Solothurn', 'Soleure', 'Soletta'], x: 3, y: 2 },
	{ code: 'LU', names: ['Luzern', 'Lucerne', 'Lucerna'], x: 4, y: 2 },
	{ code: 'ZG', names: ['Zug', 'Zoug', 'Zugo'], x: 5, y: 2 },
	{ code: 'SZ', names: ['Schwyz', 'Svitto'], x: 6, y: 2 },
	{ code: 'SG', names: ['St. Gallen', 'Saint-Gall', 'San Gallo', 'St.Gallen'], x: 7, y: 2 },
	{ code: 'AR', names: ['Appenzell Ausserrhoden', 'Appenzell Rhodes-Extérieures', 'Appenzello Esterno'], x: 8, y: 2 },
	{ code: 'AI', names: ['Appenzell Innerrhoden', 'Appenzell Rhodes-Intérieures', 'Appenzello Interno'], x: 9, y: 2 },
	{ code: 'NE', names: ['Neuchâtel', 'Neuenburg'], x: 1, y: 3 },
	{ code: 'BE', names: ['Bern', 'Berne', 'Berna'], x: 3, y: 3 },
	{ code: 'OW', names: ['Obwalden', 'Obwald', 'Obvaldo'], x: 4, y: 3 },
	{ code: 'NW', names: ['Nidwalden', 'Nidwald', 'Nidvaldo'], x: 5, y: 3 },
	{ code: 'UR', names: ['Uri'], x: 6, y: 3 },
	{ code: 'GL', names: ['Glarus', 'Glaris', 'Glarona'], x: 7, y: 3 },
	{ code: 'GR', names: ['Graubünden', 'Grisons', 'Grigioni'], x: 8, y: 3 },
	{ code: 'VD', names: ['Waadt', 'Vaud'], x: 1, y: 4 },
	{ code: 'FR', names: ['Freiburg', 'Fribourg', 'Friburgo'], x: 2, y: 4 },
	{ code: 'GE', names: ['Genf', 'Genève', 'Ginevra', 'Geneva'], x: 0, y: 5 },
	{ code: 'VS', names: ['Wallis', 'Valais', 'Vallese'], x: 3, y: 5 },
	{ code: 'TI', names: ['Tessin', 'Ticino'], x: 6, y: 5 },
];

const PATTERNS = CANTONS.map((c) => ({
	code: c.code,
	re: new RegExp(`(^|[\\s(,])(${c.names.map(escape).join('|')}|${c.code})($|[\\s),])`, 'u'),
}));

function escape(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Best-effort canton detection from a (cantonal) organization's labels, e.g. "Kanton Aargau" → AG. */
export function detectCanton(labels: string[]): string | undefined {
	// Prefer explicit "Kanton X" / "Canton de X" labels, then any mention.
	for (const label of labels) {
		if (/^(Kanton|Canton|Cantone|Republik und Kanton|République et canton)\b/i.test(label)) {
			const hit = PATTERNS.find((p) => p.re.test(label));
			if (hit) return hit.code;
		}
	}
	for (const label of labels) {
		const hit = PATTERNS.find((p) => p.re.test(label));
		if (hit) return hit.code;
	}
	return undefined;
}
