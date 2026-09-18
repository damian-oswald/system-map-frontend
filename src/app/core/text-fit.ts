import { signal } from '@angular/core';

import { Entity, Lang } from './graph.model';
import { entityLabel } from './i18n';

/**
 * Measured label fitting for SVG nodes. Widths are measured on a canvas with the same font the SVG text uses,
 * so labels never run into badges or node borders.
 */

const FAMILY = '"Noto Sans", Arial, sans-serif';

/** Bumps whenever web fonts finish loading, so layouts that measured with a fallback font recompute. */
export const fontsVersion = signal(0);
if (typeof document !== 'undefined' && document.fonts) {
	void document.fonts.ready.then(() => fontsVersion.update((v) => v + 1));
	document.fonts.addEventListener('loadingdone', () => fontsVersion.update((v) => v + 1));
}

let ctx: CanvasRenderingContext2D | null | undefined;

export function textWidth(text: string, size = 12, weight = 400): number {
	const font = `${weight} ${size}px ${FAMILY}`;
	if (ctx === undefined) ctx = document.createElement('canvas').getContext('2d');
	if (!ctx) return text.length * size * 0.55;
	ctx.font = font;
	// while Noto Sans is still loading the fallback (Arial) measures narrower: add a safety margin
	const factor = document.fonts?.check(font) ? 1 : 1.08;
	return ctx.measureText(text).width * factor;
}

/** Truncates `text` with an ellipsis so that it fits into `maxWidth` px. */
export function fitText(text: string, maxWidth: number, size = 12, weight = 400): string {
	if (textWidth(text, size, weight) <= maxWidth) return text;
	let lo = 1;
	let hi = text.length;
	while (lo < hi) {
		const mid = (lo + hi + 1) >> 1;
		if (textWidth(text.slice(0, mid).trimEnd() + '…', size, weight) <= maxWidth) lo = mid;
		else hi = mid - 1;
	}
	return text.slice(0, lo).trimEnd() + '…';
}

/** The name if it fits into `maxWidth` px, else the abbreviation if that fits, else the name cut with an ellipsis. */
export function fitLabel(e: Entity, lang: Lang, maxWidth: number, size = 12, weight = 400): string {
	const name = entityLabel(e, lang);
	if (textWidth(name, size, weight) <= maxWidth) return name;
	if (e.abbreviation && textWidth(e.abbreviation, size, weight) <= maxWidth) return e.abbreviation;
	return fitText(name, maxWidth, size, weight);
}

/** Width of a count badge (pill with the number), matching the SVG badge markup. */
export function badgeWidth(n: number): number {
	return 14 + 7 * String(n).length;
}
