import {
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	computed,
	effect,
	inject,
	input,
	signal,
	untracked,
	viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { ObButtonDirective, ObExternalLinkDirective } from '@oblique/oblique';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AddressService } from '../../core/address.service';
import { Entity } from '../../core/graph.model';
import { GraphService } from '../../core/graph.service';
import { LabelPipe, LangService, PickPipe, entityLabel, entityTitle, isFallback, pick } from '../../core/i18n';
import { badgeWidth, fitLabel, fontsVersion } from '../../core/text-fit';
import { CLS, HIERARCHY_KEYS, KINDS, Kind, NS, RELATIONS, compactIri } from '../../core/vocab';
import { DataFooter } from '../../shared/data-footer';
import { EntityChip, EntityTree, KIND_ICON, NameList, PageState, TreeNode } from '../../shared/ui';
import { CatalogRow, CountKey, buildRow, figureLabel } from '../catalog/catalog-data';

interface EgoNode {
	id: string;
	key: string;
	kind: string;
	side: 'l' | 'r';
	x: number;
	y: number;
	label: string;
	title: string;
	dashed: boolean;
	/** anchor of the source (the element itself or one of its parts) the link starts from */
	ax: number;
	ay: number;
}

interface Badge {
	x: number;
	w: number;
	text: string;
	cls: string;
	title: string;
}

interface PartNode {
	id: string;
	key: string;
	kind: string;
	x: number;
	y: number;
	w: number;
	label: string;
	title: string;
	badges: Badge[];
}

interface WholeNode {
	id: string;
	key: string;
	kind: string;
	x: number;
	y: number;
	w: number;
	label: string;
	title: string;
}

/** one small table in the "relations in detail" chapter: a relation type in one direction */
interface RelationTable {
	id: string;
	title: string;
	/** header of the second column, depends on the class of the related elements; empty = names only */
	infoLabel: string;
	columns: string[];
	rows: TableRow[];
}

interface TableRow {
	e: Entity;
	text?: string;
	list?: Entity[];
	/** translation keys of flags (data protection, master data) */
	tags?: { key: string; cls: string }[];
}

type ChapterId = 'relations' | 'structure' | 'tables' | 'more';

const HIDDEN_TYPES = new Set<string>([
	CLS.organization,
	CLS.system,
	CLS.dataset,
	CLS.service,
	CLS.personalData,
	CLS.sensitiveData,
	CLS.masterData,
]);
const DASHED = new Set(RELATIONS.filter((r) => r.dashed).map((r) => r.key));
const GROUP_LIMIT = 12;
/** rows a small table shows before "+ n weitere anzeigen" */
const TABLE_LIMIT = 10;
/** relation collected from all descendants for the roll-up section, per class */
const ROLLUP: Record<Kind, { key: string; out: boolean }> = {
	organization: { key: 'operates', out: true },
	system: { key: 'contains', out: true },
	dataset: { key: 'contains', out: false },
	service: { key: 'consumes', out: false },
};
/** key figures in the header, per class – the same figures the inventory shows */
const FIGURES: Record<Kind, CountKey[]> = {
	organization: ['parts', 'systems', 'datasets', 'services'],
	system: ['datasets', 'services', 'users', 'parts'],
	dataset: ['systems', 'parts', 'legal'],
	service: ['systems', 'users'],
};

@Component({
	selector: 'app-entity-page',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'sm-routed' },
	imports: [
		TranslatePipe,
		MatButtonModule,
		MatIconModule,
		MatTableModule,
		MatTooltipModule,
		ObButtonDirective,
		ObExternalLinkDirective,
		RouterLink,
		EntityChip,
		EntityTree,
		NameList,
		PageState,
		DataFooter,
		PickPipe,
		LabelPipe,
	],
	templateUrl: './entity-page.html',
	styleUrl: './entity-page.scss',
})
export class EntityPage {
	/** route parameter (compact IRI), bound via withComponentInputBinding */
	readonly key = input.required<string>();

	private readonly graphService = inject(GraphService);
	private readonly addressService = inject(AddressService);
	private readonly router = inject(Router);
	private readonly title = inject(Title);
	private readonly translate = inject(TranslateService);
	protected readonly lang = inject(LangService).lang;
	protected readonly graph = this.graphService.graph;
	protected readonly KIND_ICON = KIND_ICON;
	protected readonly compactIri = compactIri;
	protected readonly copied = signal(false);

	protected readonly entity = computed(() => {
		this.graph();
		const e = this.graphService.entity(this.key());
		if (e) this.title.setTitle(`${entityLabel(e, this.lang())} · ${this.translate.instant('app.title')}`);
		return e ?? null;
	});

	protected readonly isMappable = computed(() => (KINDS as readonly string[]).includes(this.entity()?.kind ?? ''));
	protected readonly catalogParams = computed(() => {
		const k = this.entity()?.kind;
		return { kind: k && k !== 'dataset' && (KINDS as readonly string[]).includes(k) ? k : null };
	});
	protected readonly descFallback = computed(() => isFallback(this.entity()?.description, this.lang()));

	/** the inventory row of this element: related elements and the rolled-up figures */
	protected readonly row = computed<CatalogRow | null>(() => {
		const e = this.entity();
		const g = this.graph();
		return e && g && this.isMappable() ? buildRow(g, e, this.lang()) : null;
	});
	protected readonly figures = computed(() => {
		const r = this.row();
		const e = this.entity();
		if (!r || !e) return [];
		return FIGURES[e.kind as Kind].map((count) => ({
			count,
			n: r.counts[count],
			label: figureLabel(count, e.kind as Kind, r.counts[count]),
		}));
	});
	/** postal address from the registers (Zefix, Staatskalender) the organization is linked to */
	protected readonly address = computed(() => {
		const e = this.entity();
		return e?.kind === 'organization' ? this.addressService.addresses().get(e.id) : undefined;
	});
	protected readonly parents = computed(() => {
		const g = this.graph();
		return (this.entity()?.parents ?? []).map((p) => g?.entities.get(p)).filter((x): x is Entity => !!x);
	});

	protected readonly typeLabels = computed(() => {
		const e = this.entity();
		const g = this.graph();
		if (!e || !g) return [];
		const lang = this.lang();
		return [...e.types]
			.filter((t) => !HIDDEN_TYPES.has(t))
			.map((t) => pick(g.classes.get(t)?.name, lang))
			.filter(Boolean);
	});

	protected readonly relationGroups = computed(() => {
		const e = this.entity();
		const g = this.graph();
		if (!e || !g) return [];
		const lang = this.lang();
		const groups = new Map<string, { key: string; out: boolean; items: Entity[] }>();
		const add = (key: string, out: boolean, other: Entity): void => {
			const k = `${key}|${out}`;
			if (!groups.has(k)) groups.set(k, { key, out, items: [] });
			groups.get(k)!.items.push(other);
		};
		for (const r of e.out) add(r.key, true, g.entities.get(r.o)!);
		for (const r of e.in) add(r.key, false, g.entities.get(r.s)!);
		const order = RELATIONS.map((r) => r.key);
		for (const grp of groups.values())
			grp.items.sort((a, b) => entityLabel(a, lang).localeCompare(entityLabel(b, lang), lang));
		return [...groups.values()].sort(
			(a, b) => order.indexOf(a.key) - order.indexOf(b.key) || Number(b.out) - Number(a.out),
		);
	});
	protected readonly relationCount = computed(() => this.relationGroups().reduce((a, g) => a + g.items.length, 0));

	/** the name of a relation as seen from this element: the property's name for outgoing, the inverse for incoming */
	private relationName(key: string, out: boolean): string {
		const g = this.graph()!;
		const name = out ? pick(g.relationInfo.get(key)?.name, this.lang()) : this.translate.instant(`relInverse.${key}`);
		return name.charAt(0).toUpperCase() + name.slice(1);
	}

	/**
	 * One small table per relation type and direction. The second column tells the most useful thing about the
	 * related elements' class – the operators of systems, where data sets are stored, the sector of organizations,
	 * the providers of services – leaving out this element itself. Where that would say nothing (the systems an
	 * organization operates are operated by … the organization), the column falls back to the next best thing.
	 */
	protected readonly tables = computed<RelationTable[]>(() => {
		const e = this.entity();
		const g = this.graph();
		if (!e || !g) return [];
		const lang = this.lang();
		const others = (x: Entity, key: string, out: boolean): Entity[] =>
			(out ? x.out : x.in)
				.filter((r) => r.key === key)
				.map((r) => g.entities.get(out ? r.o : r.s)!)
				.filter((y) => y.id !== e.id);
		const primary = (x: Entity): TableRow => {
			switch (x.kind) {
				case 'organization':
					return { e: x, text: this.translate.instant(`orgType.${x.orgType ?? 'other'}`) };
				case 'system':
					return { e: x, list: others(x, 'operates', false) };
				case 'dataset':
					return { e: x, list: others(x, 'contains', false) };
				case 'service':
					return { e: x, list: others(x, 'provides', false) };
				default:
					return { e: x };
			}
		};
		const fallback = (x: Entity): TableRow => {
			switch (x.kind) {
				case 'system':
					return { e: x, list: others(x, 'contains', true) };
				case 'dataset':
					return {
						e: x,
						tags: [
							...(x.sensitive
								? [{ key: 'flags.sensitive', cls: 'sm-tag--warn' }]
								: x.personal
									? [{ key: 'flags.personal', cls: 'sm-tag--warn' }]
									: []),
							...(x.master ? [{ key: 'flags.master', cls: 'sm-tag--info' }] : []),
						],
					};
				case 'service':
					return { e: x, text: String(others(x, 'consumes', false).length) };
				default:
					return { e: x };
			}
		};
		const primaryLabel: Record<Kind, string> = {
			organization: 'catalog.sector',
			system: 'catalog.who.system',
			dataset: 'catalog.where.dataset',
			service: 'catalog.where.service',
		};
		const fallbackLabel: Record<Kind, string> = {
			organization: 'catalog.sector',
			system: 'kind.dataset.plural',
			dataset: 'catalog.col.flags',
			service: 'catalog.num.users.service',
		};
		return this.relationGroups()
			.filter(
				(grp) => grp.key !== 'hasLegalBasis' && grp.items.some((x) => (KINDS as readonly string[]).includes(x.kind)),
			)
			.map((grp) => {
				const kind = grp.items[0].kind as Kind;
				const items = [...grp.items].sort((a, b) => entityLabel(a, lang).localeCompare(entityLabel(b, lang), lang));
				const says = (rows: TableRow[]): boolean => rows.some((r) => r.text || r.list?.length || r.tags?.length);
				let rows = items.map(primary);
				let label = primaryLabel[kind];
				if (!says(rows)) {
					rows = items.map(fallback);
					label = fallbackLabel[kind];
				}
				const info = says(rows);
				return {
					id: `${grp.key}|${grp.out}`,
					title: this.relationName(grp.key, grp.out),
					infoLabel: info ? this.translate.instant(label) : '',
					columns: info ? ['name', 'info'] : ['name'],
					rows,
				};
			});
	});

	/** small tables the user expanded beyond TABLE_LIMIT rows */
	protected readonly openTables = signal(new Set<string>());
	protected readonly TABLE_LIMIT = TABLE_LIMIT;

	protected tableRows(t: RelationTable): TableRow[] {
		return this.openTables().has(t.id) ? t.rows : t.rows.slice(0, TABLE_LIMIT);
	}

	protected toggleTable(id: string): void {
		this.openTables.update((s) => {
			const n = new Set(s);
			if (n.has(id)) n.delete(id);
			else n.add(id);
			return n;
		});
	}

	protected readonly ancestors = computed(() => {
		const e = this.entity();
		const g = this.graph();
		const out: Entity[] = [];
		const seen = new Set<string>();
		let cur = e && e.parents.length ? g?.entities.get(e.parents[0]) : undefined;
		while (cur && !seen.has(cur.id)) {
			seen.add(cur.id);
			out.unshift(cur);
			cur = cur.parents.length ? g?.entities.get(cur.parents[0]) : undefined;
		}
		return out;
	});

	/** Ancestors → the element → all descendants, as a tree (organizations, systems, data sets, services). */
	protected readonly structure = computed<TreeNode[]>(() => {
		const e = this.entity();
		const g = this.graph();
		if (!e || !g) return [];
		if (!this.ancestors().length && !e.children.length) return [];
		const lang = this.lang();
		const seen = new Set<string>();
		const build = (x: Entity): TreeNode => {
			seen.add(x.id);
			const kids = x.children
				.map((c) => g.entities.get(c)!)
				.filter((c) => c && !seen.has(c.id))
				.sort((a, b) => entityLabel(a, lang).localeCompare(entityLabel(b, lang), lang));
			return { e: x, self: x.id === e.id, children: kids.map(build) };
		};
		let node = build(e);
		for (const a of [...this.ancestors()].reverse()) node = { e: a, self: false, children: [node] };
		return [node];
	});

	/**
	 * What the descendants bring along, per class: systems operated by sub-units, data sets in sub-systems,
	 * systems storing the parts of a data set, users of sub-services.
	 */
	protected readonly rollup = computed(() => {
		const e = this.entity();
		const g = this.graph();
		if (!e || !g || !e.children.length) return [];
		const cfg = ROLLUP[e.kind as Kind];
		if (!cfg) return [];
		const lang = this.lang();
		const out = new Map<string, { target: Entity; via: Entity[] }>();
		const stack = [...e.children];
		const seen = new Set<string>([e.id]);
		while (stack.length) {
			const id = stack.pop()!;
			if (seen.has(id)) continue;
			seen.add(id);
			const unit = g.entities.get(id)!;
			stack.push(...unit.children);
			for (const r of cfg.out ? unit.out : unit.in) {
				if (r.key !== cfg.key) continue;
				const target = g.entities.get(cfg.out ? r.o : r.s)!;
				if (!out.has(target.id)) out.set(target.id, { target, via: [] });
				out.get(target.id)!.via.push(unit);
			}
		}
		return [...out.values()].sort((a, b) =>
			entityLabel(a.target, lang).localeCompare(entityLabel(b.target, lang), lang),
		);
	});

	protected readonly sameAs = computed(() =>
		(this.entity()?.sameAs ?? []).map((iri) => {
			if (iri.startsWith(NS.zefix)) return { iri, label: 'Zefix' };
			if (iri.startsWith(NS.sk)) return { iri, label: 'Staatskalender' };
			return { iri, label: this.host(iri) };
		}),
	);
	protected readonly legal = computed(() => {
		const e = this.entity();
		const g = this.graph();
		return e && g ? e.out.filter((r) => r.key === 'hasLegalBasis').map((r) => g.entities.get(r.o)!) : [];
	});
	protected readonly keywords = computed(() => {
		const g = this.graph();
		return (this.entity()?.keywords ?? []).map((k) => g?.entities.get(k)).filter((x): x is Entity => !!x);
	});
	protected readonly collections = computed(() => {
		const g = this.graph();
		const e = this.entity();
		return g && e ? g.collections.filter((c) => c.members.has(e.id)) : [];
	});

	/** chapters shown for this element, in order – the numbers in the chapter headers follow from it */
	protected readonly chapters = computed<ChapterId[]>(() => {
		const out: ChapterId[] = [];
		if (this.ego()?.nodes.length || this.ego()?.hasStructure) out.push('relations');
		if (this.structure().length) out.push('structure');
		if (this.tables().length) out.push('tables');
		if (this.legal().length || this.keywords().length || this.collections().length) out.push('more');
		return out;
	});

	protected chapterNo(id: ChapterId): string {
		return String(this.chapters().indexOf(id) + 1).padStart(2, '0');
	}

	/** chapters alternate between white and the tinted background */
	protected tinted(id: ChapterId): boolean {
		return this.chapters().indexOf(id) % 2 === 0;
	}

	// ---------------------------------------------------------------------------------------------- relations diagram

	/** relation groups (key|direction) the user expanded beyond GROUP_LIMIT */
	protected readonly expanded = signal(new Set<string>());
	/** available width for the diagram, kept in sync with the container */
	protected readonly diagramWidth = signal(1040);
	private readonly egoWrap = viewChild<ElementRef<HTMLElement>>('egoWrap');

	/**
	 * Relations diagram. The element is drawn as a composite in the middle: its parts (dcterms:hasPart) are nested
	 * inside its frame and keep their own relations, which start from the part's row. If the element is itself a part,
	 * the whole is drawn as an outer frame. Everything else: incoming relations left, outgoing right, grouped by type.
	 */
	protected readonly ego = computed(() => {
		const e = this.entity();
		const g = this.graph();
		if (!e || !g) return null;
		const lang = this.lang();
		const expanded = this.expanded();
		fontsVersion(); // re-fit labels once web fonts are loaded
		const W = Math.max(720, Math.min(1400, this.diagramWidth()));
		const nodeW = 236;
		const centerW = 300;
		const rowH = 30;
		const headH = 24;
		const partH = 26;
		const partRowH = 32;
		const byLabel = (a: Entity, b: Entity): number => entityLabel(a, lang).localeCompare(entityLabel(b, lang), lang);

		const parts = e.children.map((c) => g.entities.get(c)!).sort(byLabel);
		const wholes = e.parents.map((p) => g.entities.get(p)!).sort(byLabel);
		const sources = [e, ...parts];
		const inner = new Map(sources.map((x, i) => [x.id, i]));

		// ---- composite geometry
		const partsBlockH = parts.length ? 12 + parts.length * partRowH - (partRowH - partH) + 12 : 0;
		const compositeH = 40 + partsBlockH;
		const frameHeadH = wholes.length ? 22 + wholes.length * 28 + 4 : 0;
		const compositeTotalH = compositeH + (wholes.length ? frameHeadH + 20 : 0);

		// ---- external relations (per source) and internal ones (between element and parts)
		interface Entry {
			src: number;
			key: string;
			out: boolean;
			target: Entity;
		}
		const entries: Entry[] = [];
		const internalRels: { a: number; b: number; key: string }[] = [];
		sources.forEach((src, si) => {
			for (const r of src.out) {
				if (r.key === 'hasLegalBasis') continue;
				// the element's wholes are drawn as the outer frame
				if (si === 0 && HIERARCHY_KEYS.has(r.key)) continue;
				const t = g.entities.get(r.o)!;
				const ti = inner.get(t.id);
				if (ti !== undefined) {
					if (!HIERARCHY_KEYS.has(r.key)) internalRels.push({ a: si, b: ti, key: r.key });
					continue;
				}
				entries.push({ src: si, key: r.key, out: true, target: t });
			}
			for (const r of src.in) {
				const t = g.entities.get(r.s)!;
				if (inner.has(t.id)) continue;
				// a part's own parts are summarised by a badge, not drawn
				if (HIERARCHY_KEYS.has(r.key) && si > 0) continue;
				entries.push({ src: si, key: r.key, out: false, target: t });
			}
		});
		const order = RELATIONS.map((r) => r.key);
		const groups = new Map<string, { key: string; out: boolean; items: Entry[] }>();
		for (const en of entries) {
			const id = `${en.key}|${en.out}`;
			if (!groups.has(id)) groups.set(id, { key: en.key, out: en.out, items: [] });
			groups.get(id)!.items.push(en);
		}
		const sortedGroups = [...groups.values()].sort(
			(a, b) => order.indexOf(a.key) - order.indexOf(b.key) || Number(b.out) - Number(a.out),
		);
		for (const grp of sortedGroups) grp.items.sort((a, b) => a.src - b.src || byLabel(a.target, b.target));

		// ---- columns
		const pending: { n: Omit<EgoNode, 'ax' | 'ay'>; src: number }[] = [];
		const headers: { x: number; y: number; text: string; anchor: string }[] = [];
		const toggles: { x: number; y: number; anchor: string; id: string; n: number; open: boolean }[] = [];
		const layoutSide = (side: 'l' | 'r'): number => {
			let y = 0;
			for (const grp of sortedGroups.filter((x) => (side === 'l' ? !x.out : x.out))) {
				const id = `${grp.key}|${grp.out}`;
				const open = expanded.has(id);
				const name =
					side === 'r'
						? pick(g.relationInfo.get(grp.key)?.name, lang)
						: this.translate.instant(`relInverse.${grp.key}`);
				const anchor = side === 'l' ? 'start' : 'end';
				const x = side === 'l' ? 0 : W;
				headers.push({ x, y: y + 14, text: `${name} · ${grp.items.length}`, anchor });
				y += headH;
				const shown = open ? grp.items : grp.items.slice(0, GROUP_LIMIT);
				for (const it of shown) {
					pending.push({
						src: it.src,
						n: {
							id: it.target.id,
							key: it.target.key,
							kind: it.target.kind,
							side,
							x: side === 'l' ? 0 : W - nodeW,
							y,
							label: fitLabel(it.target, lang, nodeW - 20),
							title: entityTitle(it.target, lang),
							dashed: DASHED.has(grp.key),
						},
					});
					y += rowH;
				}
				if (grp.items.length > GROUP_LIMIT) {
					toggles.push({ x, y: y + 12, anchor, id, n: grp.items.length - GROUP_LIMIT, open });
					y += 22;
				}
				y += 10;
			}
			return y;
		};
		const height = Math.max(layoutSide('l'), layoutSide('r'), compositeTotalH, 80);

		// ---- centre: whole frame, element header, nested parts
		const cx = (W - centerW) / 2;
		const cy = Math.max(0, (height - compositeTotalH) / 2) + (wholes.length ? frameHeadH + 10 : 0);
		const anchorY = (si: number): number => (si === 0 ? cy + 20 : cy + 40 + 12 + (si - 1) * partRowH + partH / 2);
		const nodes: EgoNode[] = pending.map(({ n, src }) => ({
			...n,
			ax: n.side === 'l' ? cx : cx + centerW,
			ay: anchorY(src),
		}));
		const links = nodes.map((n) => {
			const ny = n.y + 12;
			const [x1, y1, x2, y2] = n.side === 'l' ? [n.x + nodeW, ny, n.ax, n.ay] : [n.ax, n.ay, n.x, ny];
			const dx = (x2 - x1) / 2;
			return { d: `M${x1},${y1}C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`, dashed: n.dashed };
		});

		const partW = centerW - 24;
		const partNodes: PartNode[] = parts.map((p, i) => {
			const badges: Badge[] = [];
			const subParts = p.children.length;
			if (subParts)
				badges.push({
					x: 0,
					w: badgeWidth(subParts),
					text: String(subParts),
					cls: 'neutral',
					title: this.translate.instant('entity.partsCount', { n: subParts }),
				});
			if (p.personal)
				badges.push({
					x: 0,
					w: 22,
					text: 'P',
					cls: 'warn',
					title: this.translate.instant(p.sensitive ? 'flags.sensitive' : 'flags.personal'),
				});
			if (p.master) badges.push({ x: 0, w: 22, text: 'M', cls: 'info', title: this.translate.instant('flags.master') });
			// badges are laid out from the right edge; the label gets what is left
			let bx = partW - 8;
			for (const b of badges) {
				bx -= b.w;
				b.x = bx;
				bx -= 4;
			}
			const labelMax = (badges.length ? bx + 4 - 8 : partW - 8) - 12;
			return {
				id: p.id,
				key: p.key,
				kind: p.kind,
				x: cx + 12,
				y: cy + 40 + 12 + i * partRowH,
				w: partW,
				label: fitLabel(p, lang, labelMax),
				title: entityTitle(p, lang),
				badges,
			};
		});
		const internal = internalRels.map(({ a, b, key }) => {
			const x = cx + centerW - 12;
			const ya = anchorY(a);
			const yb = anchorY(b);
			return {
				d: `M${x},${ya}C${x + 34},${ya} ${x + 34},${yb} ${x},${yb}`,
				title: `${entityLabel(sources[a], lang)} → ${pick(g.relationInfo.get(key)?.name, lang)} → ${entityLabel(sources[b], lang)}`,
			};
		});
		const frame = wholes.length
			? {
					x: cx - 10,
					y: cy - 10 - frameHeadH,
					w: centerW + 20,
					h: compositeH + 20 + frameHeadH,
					kind: wholes[0].kind,
					wholes: wholes.map<WholeNode>((w, i) => ({
						id: w.id,
						key: w.key,
						kind: w.kind,
						x: cx - 10 + 12,
						y: cy - 10 - frameHeadH + 22 + i * 28,
						w: centerW + 20 - 24,
						label: fitLabel(w, lang, centerW + 20 - 24 - 20),
						title: entityTitle(w, lang),
					})),
				}
			: null;
		// header of the composite: rounded on top only when parts follow
		const r = 8;
		const headPath = parts.length
			? `M0,${r}a${r},${r} 0 0 1 ${r},-${r}H${centerW - r}a${r},${r} 0 0 1 ${r},${r}V40H0Z`
			: `M0,${r}a${r},${r} 0 0 1 ${r},-${r}H${centerW - r}a${r},${r} 0 0 1 ${r},${r}V${40 - r}a${r},${r} 0 0 1 -${r},${r}H${r}a${r},${r} 0 0 1 -${r},-${r}Z`;
		return {
			nodes,
			headers,
			toggles,
			links,
			parts: partNodes,
			internal,
			frame,
			width: W,
			height,
			nodeW,
			centerW,
			compositeH,
			headPath,
			center: { x: cx, y: cy },
			centerLabel: fitLabel(e, lang, centerW - 24, 14, 700),
			hasStructure: parts.length > 0 || wholes.length > 0,
		};
	});

	constructor() {
		// keep the diagram as wide as its container
		effect((onCleanup) => {
			const el = this.egoWrap()?.nativeElement;
			if (!el) return;
			const ro = new ResizeObserver(([entry]) => {
				const w = Math.round(entry.contentRect.width);
				if (w) this.diagramWidth.set(w);
			});
			ro.observe(el);
			onCleanup(() => ro.disconnect());
		});
		// the address is only needed for organizations
		effect(() => {
			if (this.entity()?.kind === 'organization') untracked(() => this.addressService.load());
		});
	}

	protected icon(e: Entity): string {
		return KIND_ICON[e.kind];
	}

	protected toggleGroup(id: string): void {
		this.expanded.update((s) => {
			const n = new Set(s);
			if (n.has(id)) n.delete(id);
			else n.add(id);
			return n;
		});
	}

	protected go(ev: Event, key: string): void {
		ev.preventDefault();
		void this.router.navigate(['/entity', key]);
	}

	protected copy(text: string): void {
		void navigator.clipboard?.writeText(text).then(() => {
			this.copied.set(true);
			setTimeout(() => this.copied.set(false), 1500);
		});
	}

	protected host(url: string): string {
		try {
			return new URL(url).hostname.replace(/^www\./, '');
		} catch {
			return url;
		}
	}
}
