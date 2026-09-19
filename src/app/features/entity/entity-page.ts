import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { ObButtonDirective, ObExternalLinkDirective } from '@oblique/oblique';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AddressService } from '../../core/address.service';
import { Entity } from '../../core/graph.model';
import { GraphService } from '../../core/graph.service';
import { LabelPipe, LangService, PickPipe, entityLabel, isFallback, pick } from '../../core/i18n';
import { CLS, KINDS, Kind, RELATIONS, compactIri } from '../../core/vocab';
import { DataFooter } from '../../shared/data-footer';
import { EntityTree, KIND_ICON, NameList, PageState, TreeNode } from '../../shared/ui';
import { CatalogRow, CountKey, buildRow, figureLabel } from '../catalog/catalog-data';
import { SystemMap } from '../map/system-map';

/** one small table in the "relations in detail" section: a relation type in one direction */
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

/** the top-level classes are said by the breadcrumb; protection and master data are shown as flags */
const HIDDEN_TYPES = new Set<string>([
	CLS.organization,
	CLS.system,
	CLS.dataset,
	CLS.service,
	CLS.personalData,
	CLS.sensitiveData,
	CLS.masterData,
]);
/** rows a small table shows before "+ n weitere anzeigen" */
const TABLE_LIMIT = 10;
/** relation collected from all descendants for the roll-up table, per class */
const ROLLUP: Record<Kind, { key: string; out: boolean }> = {
	organization: { key: 'operates', out: true },
	system: { key: 'contains', out: true },
	dataset: { key: 'contains', out: false },
	service: { key: 'consumes', out: false },
};
/** key figures in the banner, per class – aggregated down the hierarchy, the same figures the inventory shows */
const FIGURES: Record<Kind, CountKey[]> = {
	organization: ['parts', 'systems', 'datasets', 'services'],
	system: ['parts', 'datasets', 'services', 'users'],
	dataset: ['parts', 'systems', 'legal'],
	service: ['parts', 'systems', 'users'],
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
		EntityTree,
		NameList,
		PageState,
		DataFooter,
		SystemMap,
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
	private readonly title = inject(Title);
	private readonly translate = inject(TranslateService);
	protected readonly lang = inject(LangService).lang;
	protected readonly graph = this.graphService.graph;
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

	/** the inventory row of this element: related elements and the aggregated figures */
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

	/** subclasses as tags ("Organisation des Bundes", "Farm-Management-Informationssystem", …) */
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
	 * organization operates are operated by … the organization), the column falls back to the next best thing, and
	 * disappears if there is nothing to say at all.
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
	protected readonly hasMore = computed(
		() => this.legal().length + this.keywords().length + this.collections().length > 0,
	);

	constructor() {
		// the address is only needed for organizations
		effect(() => {
			if (this.entity()?.kind === 'organization') untracked(() => this.addressService.load());
		});
	}

	protected icon(e: Entity): string {
		return KIND_ICON[e.kind];
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
