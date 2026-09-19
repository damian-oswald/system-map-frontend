import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { ObButtonDirective, ObExternalLinkDirective } from '@oblique/oblique';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AddressService } from '../../core/address.service';
import { Collection, Entity } from '../../core/graph.model';
import { GraphService } from '../../core/graph.service';
import { LabelPipe, LangService, PickPipe, entityLabel, entityTitle, isFallback, pick } from '../../core/i18n';
import { CLS, HIERARCHY_KEYS, KINDS, Kind, RELATIONS, REPO_URL, compactIri } from '../../core/vocab';
import { DataFooter } from '../../shared/data-footer';
import { EntityTree, KIND_ICON, NameList, PageState, TreeNode } from '../../shared/ui';
import { CatalogRow, CountKey, buildRow, figureLabel } from '../catalog/catalog-data';
import { SystemMap } from '../map/system-map';

/** one row of the subject–predicate–object table */
interface Triple {
	s: Entity;
	/** relation key, or 'keyword' / 'collection' for the two non-relation properties */
	key: string;
	/** translated predicate */
	p: string;
	o?: Entity;
	c?: Collection;
	/** sort rank of the predicate: relation order, then keywords, then architectures */
	order: number;
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
/** key figures in the banner, per class – aggregated down the hierarchy, the same figures the inventory shows */
const FIGURES: Record<Kind, CountKey[]> = {
	organization: ['parts', 'systems', 'datasets', 'services'],
	system: ['parts', 'datasets', 'services', 'users'],
	dataset: ['parts', 'systems', 'legal'],
	service: ['parts', 'systems', 'users'],
};
const COLUMNS = ['subject', 'predicate', 'object'];
const FEEDBACK_MAIL = 'agridata.ch@blw.admin.ch';
const PAGE_SIZES = [12, 24, 48, 96];
const DEFAULT_PAGE_SIZE = 24;

@Component({
	selector: 'app-entity-page',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'sm-routed' },
	imports: [
		TranslatePipe,
		MatButtonModule,
		MatIconModule,
		MatPaginatorModule,
		MatSortModule,
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
	protected readonly REPO_URL = REPO_URL;
	protected readonly copied = signal(false);
	protected readonly COLUMNS = COLUMNS;
	protected readonly PAGE_SIZES = PAGE_SIZES;

	protected readonly entity = computed(() => {
		this.graph();
		const e = this.graphService.entity(this.key());
		if (e) this.title.setTitle(`${entityLabel(e, this.lang())} · ${this.translate.instant('app.title')}`);
		return e ?? null;
	});

	/** feedback on this element by e-mail: the title as subject, the IRI in the body */
	protected readonly mailto = computed(() => {
		const e = this.entity();
		if (!e) return '';
		const subject = encodeURIComponent(entityTitle(e, this.lang()));
		const body = encodeURIComponent(`${e.id}\n\n`);
		return `mailto:${FEEDBACK_MAIL}?subject=${subject}&body=${body}`;
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

	// ---------------------------------------------------------------------------------------------- hierarchy

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

	/** the element and everything below it in its hierarchy */
	private readonly tree = computed<Entity[]>(() => {
		const e = this.entity();
		const g = this.graph();
		if (!e || !g) return [];
		const out: Entity[] = [];
		const seen = new Set<string>();
		const stack = [e];
		while (stack.length) {
			const x = stack.pop()!;
			if (seen.has(x.id)) continue;
			seen.add(x.id);
			out.push(x);
			for (const c of x.children) {
				const ce = g.entities.get(c);
				if (ce) stack.push(ce);
			}
		}
		return out;
	});

	// ---------------------------------------------------------------------------------------------- relations (S P O)

	/**
	 * Every documented relation as a triple: the element's incoming and outgoing ones plus the outgoing ones of all
	 * its parts (sub-units, sub-systems, …). Hierarchy relations are left out – the tree above shows them – and the
	 * element's keywords and architectures are added as two more predicates.
	 */
	protected readonly triples = computed<Triple[]>(() => {
		const e = this.entity();
		const g = this.graph();
		if (!e || !g) return [];
		const lang = this.lang();
		const order = RELATIONS.map((r) => r.key);
		const pName = (key: string): string => pick(g.relationInfo.get(key)?.name, lang) || key;
		const tree = this.tree();
		const treeIds = new Set(tree.map((x) => x.id));
		const rows: Triple[] = [];
		for (const x of tree) {
			for (const r of x.out) {
				if (HIERARCHY_KEYS.has(r.key)) continue;
				const o = g.entities.get(r.o);
				if (o) rows.push({ s: x, key: r.key, p: pName(r.key), o, order: order.indexOf(r.key) });
			}
		}
		// incoming relations of the element itself (those from its own parts are already listed as their outgoing)
		for (const r of e.in) {
			if (HIERARCHY_KEYS.has(r.key)) continue;
			const s = g.entities.get(r.s);
			if (s && !treeIds.has(s.id)) rows.push({ s, key: r.key, p: pName(r.key), o: e, order: order.indexOf(r.key) });
		}
		for (const k of e.keywords) {
			const o = g.entities.get(k);
			if (o) rows.push({ s: e, key: 'keyword', p: this.translate.instant('entity.pKeyword'), o, order: 900 });
		}
		for (const c of g.collections.filter((c) => c.members.has(e.id))) {
			rows.push({ s: e, key: 'collection', p: this.translate.instant('entity.pArchitecture'), c, order: 950 });
		}
		return rows;
	});

	protected readonly sort = signal<Sort>({ active: 'predicate', direction: 'asc' });
	protected readonly pageIndex = signal(0);
	protected readonly pageSize = signal(DEFAULT_PAGE_SIZE);

	protected readonly sorted = computed(() => {
		const lang = this.lang();
		const { active, direction } = this.sort();
		const dir = direction === 'desc' ? -1 : 1;
		const subject = (t: Triple): string => entityTitle(t.s, lang);
		const object = (t: Triple): string => (t.c ? pick(t.c.name, lang) : entityTitle(t.o, lang));
		const predicate = (a: Triple, b: Triple): number => a.order - b.order || a.p.localeCompare(b.p, lang);
		const by = (a: Triple, b: Triple): number => {
			switch (active) {
				case 'subject':
					return subject(a).localeCompare(subject(b), lang);
				case 'object':
					return object(a).localeCompare(object(b), lang);
				default:
					return predicate(a, b);
			}
		};
		return [...this.triples()].sort(
			(a, b) =>
				dir * by(a, b) ||
				predicate(a, b) ||
				subject(a).localeCompare(subject(b), lang) ||
				object(a).localeCompare(object(b), lang),
		);
	});
	protected readonly page = computed(() =>
		Math.min(this.pageIndex(), Math.max(0, Math.ceil(this.sorted().length / this.pageSize()) - 1)),
	);
	protected readonly paged = computed(() => {
		const start = this.page() * this.pageSize();
		return this.sorted().slice(start, start + this.pageSize());
	});

	constructor() {
		// the address is only needed for organizations
		effect(() => {
			if (this.entity()?.kind === 'organization') untracked(() => this.addressService.load());
		});
		// another element or another sort order: back to the first page
		effect(() => {
			this.entity();
			this.sort();
			untracked(() => this.pageIndex.set(0));
		});
	}

	protected onSort(s: Sort): void {
		this.sort.set(s.direction ? s : { active: 'predicate', direction: 'asc' });
	}
	protected onPage(e: PageEvent): void {
		this.pageIndex.set(e.pageIndex);
		this.pageSize.set(e.pageSize);
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
