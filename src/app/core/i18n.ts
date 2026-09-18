import { Injectable, Pipe, PipeTransform, computed, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import { Entity, Lang, LangText } from './graph.model';

const FALLBACK: Record<Lang, string[]> = {
	de: ['de', 'en', 'fr', 'it', ''],
	fr: ['fr', 'de', 'en', 'it', ''],
	it: ['it', 'de', 'fr', 'en', ''],
	en: ['en', 'de', 'fr', 'it', ''],
};

/** Picks the best literal for a language, falling back to other languages (many entries are German only). */
export function pick(text: LangText | undefined, lang: Lang): string {
	if (!text) return '';
	for (const l of FALLBACK[lang]) if (text[l]) return text[l];
	const any = Object.values(text)[0];
	return any ?? '';
}

/** True when the value shown for `lang` actually comes from another language. */
export function isFallback(text: LangText | undefined, lang: Lang): boolean {
	return !!text && !text[lang] && Object.keys(text).length > 0;
}

export function entityLabel(e: Entity | undefined, lang: Lang): string {
	if (!e) return '';
	return pick(e.name, lang) || e.abbreviation || e.key;
}

/** "Name (ABBR)" – but only when the abbreviation adds something. */
export function entityTitle(e: Entity | undefined, lang: Lang): string {
	const label = entityLabel(e, lang);
	if (e?.abbreviation && !label.toLowerCase().includes(e.abbreviation.toLowerCase())) {
		return `${label} (${e.abbreviation})`;
	}
	return label;
}

/** A short label for dense places (map nodes, chart axes). */
export function shortLabel(e: Entity | undefined, lang: Lang, max = 34): string {
	if (!e) return '';
	const label = entityLabel(e, lang);
	if (label.length <= max) return label;
	if (e.abbreviation && e.abbreviation.length <= max) return e.abbreviation;
	return label.slice(0, max - 1).trimEnd() + '…';
}

/** The abbreviation where there is one, else the (optionally shortened) name – for dense tables. */
export function abbrLabel(e: Entity | undefined, lang: Lang, max?: number): string {
	if (!e) return '';
	return e.abbreviation ?? (max ? shortLabel(e, lang, max) : entityLabel(e, lang));
}

@Injectable({ providedIn: 'root' })
export class LangService {
	private readonly translate = inject(TranslateService);
	readonly lang = signal<Lang>(normalize(this.translate.getCurrentLang()));
	/** Angular locale id registered for the current language (for date / number pipes) */
	readonly locale = computed(() => LOCALES[this.lang()]);

	constructor() {
		this.translate.onLangChange.subscribe((e) => this.lang.set(normalize(e.lang)));
	}
}

const LOCALES: Record<Lang, string> = { de: 'de-CH', fr: 'fr-CH', it: 'it-CH', en: 'en' };

function normalize(l: string | undefined | null): Lang {
	const short = (l ?? 'de').slice(0, 2);
	return (['de', 'fr', 'it', 'en'] as const).includes(short as Lang) ? (short as Lang) : 'de';
}

@Pipe({ name: 'pick' })
export class PickPipe implements PipeTransform {
	transform(text: LangText | undefined, lang: Lang): string {
		return pick(text, lang);
	}
}

@Pipe({ name: 'label' })
export class LabelPipe implements PipeTransform {
	transform(
		e: Entity | undefined,
		lang: Lang,
		mode: 'label' | 'title' | 'short' | 'abbr' = 'label',
		max?: number,
	): string {
		if (mode === 'title') return entityTitle(e, lang);
		if (mode === 'abbr') return abbrLabel(e, lang, max);
		if (mode === 'short') return shortLabel(e, lang, max);
		return entityLabel(e, lang);
	}
}
