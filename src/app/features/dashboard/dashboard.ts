import { PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { Router, RouterLink } from '@angular/router';
import { ObButtonDirective } from '@oblique/oblique';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { Entity, Lang, OrgType } from '../../core/graph.model';
import { GraphService } from '../../core/graph.service';
import { LabelPipe, LangService, PickPipe, abbrLabel, entityLabel, entityTitle, pick } from '../../core/i18n';
import { fitLabel, fitText, textWidth } from '../../core/text-fit';
import { CLS, KINDS, NS, compactIri } from '../../core/vocab';
import { DataFooter } from '../../shared/data-footer';
import { TipCard, TipDirective } from '../../shared/tip';
import { KIND_ICON, PageState } from '../../shared/ui';
import { SystemMap } from '../map/system-map';
import { ScatterPoint, computeDashboard, scatterPoints } from './dashboard-data';

const ORG_COLOR: Record<string, string> = {
	federal: 'var(--org-federal)',
	cantonal: 'var(--org-cantonal)',
	private: 'var(--org-private)',
	other: 'var(--org-other)',
};

/** the map excerpt shows this curated subgraph: the FOAG system landscape */
const DEMO_SUBGRAPH = NS.sm + 'foag';

// chart geometry in viewBox units – the SVGs scale to the width of their column
/** importance vs properties */
const SC = { w: 760, h: 400, l: 52, r: 20, t: 16, b: 48 };
/** scatter labels: font, box height, longest name, how many at most (viewBox units – the SVG is scaled up) */
const SL = { px: 5.5, h: 7, maxW: 90, max: 50, pad: 1.5 };
/**
 * where a name may sit relative to its dot, tried in this order: snug beside it first, then farther away with a
 * leader line. dx/dy in viewBox units from the dot's centre; anchor is the text-anchor at that point.
 */
const LABEL_SLOTS: { dx: number; dy: number; anchor: 'start' | 'middle' | 'end' }[] = [
	{ dx: 7, dy: 0, anchor: 'start' },
	{ dx: -7, dy: 0, anchor: 'end' },
	{ dx: 0, dy: -8, anchor: 'middle' },
	{ dx: 0, dy: 8.5, anchor: 'middle' },
	{ dx: 5, dy: -6.5, anchor: 'start' },
	{ dx: 5, dy: 7, anchor: 'start' },
	{ dx: -5, dy: -6.5, anchor: 'end' },
	{ dx: -5, dy: 7, anchor: 'end' },
	{ dx: 16, dy: -11, anchor: 'start' },
	{ dx: 16, dy: 11, anchor: 'start' },
	{ dx: -16, dy: -11, anchor: 'end' },
	{ dx: -16, dy: 11, anchor: 'end' },
	{ dx: 0, dy: -19, anchor: 'middle' },
	{ dx: 0, dy: 19, anchor: 'middle' },
	{ dx: 24, dy: 0, anchor: 'start' },
	{ dx: -24, dy: 0, anchor: 'end' },
];

/** an entry of the scope select: a class or (indented) a subclass */
interface ScopeOption {
	id: string;
	label: string;
	sub: boolean;
}
/** operators: columns on a log scale, names running upwards beneath them */
const OP = { w: 720, h: 300, l: 40, r: 8, t: 20, b: 100 };
const OP_LABEL_PX = 7;

interface Tick {
	v: number;
	pos: number;
	text: string;
}

interface ScatterDot extends ScatterPoint {
	cx: number;
	cy: number;
	tip: TipCard;
	/** name, if a free place for it was found; lx/ly is the text anchor, a leader line joins it when set apart */
	label: string;
	lx: number;
	ly: number;
	anchor: 'start' | 'middle' | 'end';
	leader: boolean;
}

interface Box {
	x: number;
	y: number;
	w: number;
	h: number;
}

const overlaps = (a: Box, b: Box): boolean => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

interface OperatorColumn {
	entity: Entity;
	value: number;
	orgType: OrgType;
	tip: TipCard;
	x: number;
	y: number;
	/** the name, the abbreviation if the name does not fit, else truncated */
	label: string;
}

/** a round tick step (1, 2, 5 × 10ⁿ) close to the wanted one */
function niceStep(raw: number): number {
	const mag = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-9))));
	const f = raw / mag;
	return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * mag;
}

@Component({
	selector: 'app-dashboard',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'sm-routed' },
	imports: [
		TranslatePipe,
		RouterLink,
		MatIconModule,
		MatButtonModule,
		MatFormFieldModule,
		MatSelectModule,
		ObButtonDirective,
		SystemMap,
		PercentPipe,
		TipDirective,
		PageState,
		DataFooter,
		PickPipe,
		LabelPipe,
	],
	templateUrl: './dashboard.html',
	styleUrl: './dashboard.scss',
})
export class Dashboard {
	private readonly graphService = inject(GraphService);
	private readonly langService = inject(LangService);
	private readonly router = inject(Router);
	private readonly translate = inject(TranslateService);
	protected readonly lang = this.langService.lang;
	protected readonly locale = this.langService.locale;
	protected readonly graph = this.graphService.graph;
	protected readonly KINDS = KINDS;
	protected readonly KIND_ICON = KIND_ICON;
	protected readonly ORG_COLOR = ORG_COLOR;
	protected readonly DEMO_SUBGRAPH = DEMO_SUBGRAPH;
	protected readonly SC = SC;
	protected readonly OP = OP;
	protected readonly compactIri = compactIri;

	protected readonly data = computed(() => {
		const g = this.graph();
		return g ? computeDashboard(g) : null;
	});

	/**
	 * what the scatter shows: null for everything, or `kind:…` / `org:…` / `sys:fmis` / `ds:…` for a class or
	 * subclass – a filter on the whole graph's scores
	 */
	protected readonly scope = signal<string | null>(null);
	protected readonly classScopes = computed<ScopeOption[]>(() => {
		const lang = this.lang();
		const g = this.graph();
		const t = (key: string): string => this.translate.instant(key);
		const out: ScopeOption[] = [];
		for (const k of KINDS) {
			out.push({ id: `kind:${k}`, label: t(`kind.${k}.plural`), sub: false });
			if (k === 'organization')
				for (const o of ['federal', 'cantonal', 'other', 'private'])
					out.push({ id: `org:${o}`, label: t(`orgType.${o}`), sub: true });
			if (k === 'system')
				out.push({ id: 'sys:fmis', label: pick(g?.classes.get(CLS.fmis)?.name, lang) || 'FMIS', sub: true });
			if (k === 'dataset')
				for (const f of ['master', 'personal', 'sensitive'])
					out.push({ id: `ds:${f}`, label: t(`flags.${f}`), sub: true });
		}
		return out;
	});
	private readonly scatterData = computed(() => {
		const g = this.graph();
		if (!g) return [];
		const id = this.scope();
		if (!id) return scatterPoints(g, null);
		const [type, val] = id.split(':');
		const show = (e: Entity): boolean => {
			switch (type) {
				case 'kind':
					return e.kind === val;
				case 'org':
					return e.kind === 'organization' && (e.orgType ?? 'other') === val;
				case 'sys':
					return e.kind === 'system' && !!e.fmis;
				case 'ds':
					return e.kind === 'dataset' && !!e[val as 'master' | 'personal' | 'sensitive'];
				default:
					return true;
			}
		};
		return scatterPoints(g, null).filter((p) => show(p.entity));
	});

	/**
	 * Importance vs properties: PageRank (log) against the number of recorded triples. Names are placed greedily in
	 * PageRank order: each tries the slots around its dot and keeps the first one that is inside the plot and clear
	 * of every name placed so far and of every other dot – so names appear wherever the plot has room for them.
	 */
	protected readonly scatter = computed(() => {
		const pts = this.scatterData();
		if (!pts.length) return null;
		const lang = this.lang();
		const fmt = new Intl.NumberFormat(this.locale(), { style: 'percent', maximumSignificantDigits: 2 });
		const propsKey = this.translate.instant('dash.scatter.y');
		const plotR = SC.w - SC.r;
		const plotB = SC.h - SC.b;
		const xMin = Math.min(...pts.map((p) => p.score)) / 1.3;
		const xMax = Math.max(...pts.map((p) => p.score)) * 1.3;
		const yMax = Math.max(...pts.map((p) => p.props)) * 1.08;
		const x = (v: number): number =>
			SC.l + ((Math.log10(v) - Math.log10(xMin)) / (Math.log10(xMax) - Math.log10(xMin))) * (plotR - SC.l);
		const y = (v: number): number => plotB - (v / yMax) * (plotB - SC.t);
		// least important first, so the named ones paint on top
		const points: ScatterDot[] = [...pts]
			.sort((a, b) => a.score - b.score)
			.map((p) => ({
				...p,
				cx: x(p.score),
				cy: y(p.props),
				tip: {
					title: entityTitle(p.entity, lang),
					rows: [
						['PageRank', fmt.format(p.score)],
						[propsKey, p.props],
					],
				},
				label: '',
				lx: 0,
				ly: 0,
				anchor: 'start' as const,
				leader: false,
			}));
		const placed: Box[] = [];
		const bounds: Box = { x: SC.l - 6, y: 2, w: SC.w - SC.l + 4, h: plotB };
		for (const p of [...points].sort((a, b) => b.score - a.score)) {
			if (placed.length >= SL.max) break;
			const text = fitText(abbrLabel(p.entity, lang), SL.maxW, SL.px, 500);
			const w = textWidth(text, SL.px, 500);
			for (const slot of LABEL_SLOTS) {
				const ax = p.cx + slot.dx;
				const ay = p.cy + slot.dy;
				const bx = slot.anchor === 'start' ? ax : slot.anchor === 'end' ? ax - w : ax - w / 2;
				const box: Box = { x: bx - SL.pad, y: ay - SL.h / 2 - SL.pad, w: w + 2 * SL.pad, h: SL.h + 2 * SL.pad };
				if (box.x < bounds.x || box.y < bounds.y || box.x + box.w > bounds.x + bounds.w || box.y + box.h > bounds.h)
					continue;
				if (placed.some((b) => overlaps(b, box))) continue;
				const dotBox: Box = { x: box.x - 4, y: box.y - 4, w: box.w + 8, h: box.h + 8 };
				if (
					points.some(
						(d) =>
							d !== p && d.cx > dotBox.x && d.cx < dotBox.x + dotBox.w && d.cy > dotBox.y && d.cy < dotBox.y + dotBox.h,
					)
				)
					continue;
				placed.push(box);
				p.label = text;
				p.lx = ax;
				p.ly = ay;
				p.anchor = slot.anchor;
				p.leader = Math.abs(slot.dx) > 10 || Math.abs(slot.dy) > 10;
				break;
			}
		}
		// four gridlines per decade (1 · 2 · 3 · 5), about ten across the value range
		const xTicks: Tick[] = [-5, -4, -3, -2, -1, 0]
			.flatMap((e) => [1, 2, 3, 5].map((m) => m * Math.pow(10, e)))
			.filter((v) => v >= xMin && v <= xMax)
			.map((v) => ({ v, pos: x(v), text: fmt.format(v) }));
		const step = niceStep(yMax / 10);
		const yTicks: Tick[] = [];
		for (let v = 0; v <= yMax; v += step) yTicks.push({ v, pos: y(v), text: String(v) });
		return { points, xTicks, yTicks, plotR, plotB };
	});

	/** where a leader line ends: just short of the text, on the side facing the dot */
	protected leaderEnd(p: ScatterDot): { x: number; y: number } {
		if (p.anchor === 'middle') return { x: p.lx, y: p.ly + (p.ly < p.cy ? SL.h / 2 + 1 : -SL.h / 2 - 1) };
		return { x: p.lx + (p.anchor === 'start' ? -3 : 3), y: p.ly };
	}

	/** who operates the systems: one column per top-level organization, log scale, coloured by sector */
	protected readonly opChart = computed(() => {
		const ops = this.data()?.operators ?? [];
		if (!ops.length) return null;
		const lang = this.lang();
		const slot = (OP.w - OP.l - OP.r) / ops.length;
		const w = Math.min(24, slot * 0.6);
		const base = OP.h - OP.b;
		const yMin = 0.8;
		const yMax = Math.max(...ops.map((o) => o.value)) * 1.25;
		const y = (v: number): number =>
			OP.t + (1 - (Math.log10(v) - Math.log10(yMin)) / (Math.log10(yMax) - Math.log10(yMin))) * (base - OP.t);
		const unit = this.translate.instant('dash.unit.systems');
		const columns: OperatorColumn[] = ops.map((o, i) => ({
			entity: o.entity,
			value: o.value,
			orgType: o.orgType ?? 'other',
			tip: { title: entityTitle(o.entity, lang), rows: [[unit, o.value]] },
			x: OP.l + slot * i + slot / 2,
			y: y(o.value),
			label: fitLabel(o.entity, lang, OP.b - 16, OP_LABEL_PX),
		}));
		const yTicks: Tick[] = [1, 2, 5, 10, 20, 50, 100]
			.filter((v) => v <= yMax)
			.map((v) => ({ v, pos: y(v), text: String(v) }));
		return { columns, yTicks, base, slot, w };
	});
	/** sector under the pointer (legend or column): its columns stay, the others fade */
	protected readonly hlSector = signal<OrgType | null>(null);

	/** the class matrix as rows: subject class, then one cell per object class with a sequential fill by count */
	protected readonly matrix = computed(() => {
		const d = this.data();
		const g = this.graph();
		if (!d || !g) return [];
		const lang = this.lang();
		const t = (key: string): string => this.translate.instant(key);
		const max = Math.max(1, ...d.matrix.map((c) => c.count));
		return KINDS.map((s) => ({
			s,
			cells: d.matrix
				.filter((c) => c.s === s)
				.map((c) => {
					const share = Math.sqrt(c.count / max);
					return {
						...c,
						fill: c.count ? `color-mix(in oklab, #263645 ${Math.round(12 + share * 88)}%, #eef1f4)` : 'transparent',
						ink: share > 0.45 ? '#fff' : 'var(--sm-ink)',
						tip: {
							title: `${t(`kind.${c.s}.plural`)} → ${t(`kind.${c.o}.plural`)}`,
							rows: c.byKey.map(
								([key, n]) => [pick(g.relationInfo.get(key)?.name, lang) || key, n] as [string, number],
							),
						} satisfies TipCard,
					};
				}),
		}));
	});

	protected readonly orgTotal = computed(() => this.data()?.counts.organization ?? 1);
	protected readonly cantonMax = computed(() => Math.max(1, ...(this.data()?.cantons.map((c) => c.orgs) ?? [1])));
	protected readonly subgraphs = computed(() => {
		const g = this.graph();
		if (!g) return [];
		return g.collections
			.map((c) => {
				const comp = KINDS.map((k) => ({
					kind: k,
					n: [...c.members].filter((m) => g.entities.get(m)?.kind === k).length,
				}));
				return { c, comp, total: comp.reduce((a, b) => a + b.n, 0) };
			})
			.sort((a, b) => b.total - a.total);
	});

	/** column with a 4 px rounded cap, square at the baseline */
	protected columnPath(c: OperatorColumn, base: number, w: number): string {
		const x0 = c.x - w / 2;
		const x1 = c.x + w / 2;
		const r = Math.min(4, (base - c.y) / 2);
		return `M${x0},${base}V${c.y + r}Q${x0},${c.y} ${x0 + r},${c.y}H${x1 - r}Q${x1},${c.y} ${x1},${c.y + r}V${base}Z`;
	}

	protected open(e: Entity): void {
		void this.router.navigate(['/entity', e.key]);
	}

	/** in-page link: scroll to the chapter (the page scrolls inside Oblique's layout, so the browser's anchor jump is not enough) */
	protected jumpTo(id: string, ev: Event): void {
		ev.preventDefault();
		document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	protected cantonFill(orgs: number): string {
		if (!orgs) return 'transparent';
		// sequential single hue (the dark blue), light → dark
		const t = Math.sqrt(orgs / this.cantonMax());
		return `color-mix(in oklab, #263645 ${Math.round(14 + t * 86)}%, #eef1f4)`;
	}
	protected cantonInk(orgs: number): string {
		return orgs && Math.sqrt(orgs / this.cantonMax()) > 0.45 ? '#fff' : 'var(--sm-ink)';
	}
}
