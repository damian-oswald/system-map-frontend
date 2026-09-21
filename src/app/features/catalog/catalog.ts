import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ObButtonDirective } from '@oblique/oblique';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { Entity, OrgType } from '../../core/graph.model';
import { GraphService } from '../../core/graph.service';
import { LabelPipe, LangService, PickPipe, abbrLabel, entityLabel } from '../../core/i18n';
import { KINDS, Kind, compactIri, expandIri } from '../../core/vocab';
import { DataFooter } from '../../shared/data-footer';
import { CHIP_ICON, EntityChip, KIND_ICON, NameList, ORG_ICON, PageState } from '../../shared/ui';
import { ORG_TYPES } from '../map/map-model';
import { CatalogRow, CountKey, buildRows, figureLabel, normalize, toCsv } from './catalog-data';

type Protection = 'sensitive' | 'personal' | 'none';
type GroupBy = 'none' | 'system' | 'operator' | 'sector';
type View = 'table' | 'cards';

interface Group {
	key: string;
	entity?: Entity;
	/** translated title for groups that are not an element (sectors) */
	label?: string;
	rows: CatalogRow[];
	/** size of the whole group – `rows` may hold only the part on the current page */
	total: number;
}

/** numeric column → the figure it shows */
export interface NumColumn {
	id: string;
	count: CountKey;
}
const NUM: Record<CountKey, NumColumn> = {
	systems: { id: 'nSystems', count: 'systems' },
	datasets: { id: 'nDatasets', count: 'datasets' },
	services: { id: 'nServices', count: 'services' },
	users: { id: 'nUsers', count: 'users' },
	parts: { id: 'nParts', count: 'parts' },
	legal: { id: 'nLegal', count: 'legal' },
};
const NUM_COLUMNS = Object.values(NUM);
const NUM_ID = new Map(NUM_COLUMNS.map((c) => [c.id, c.count]));

/** table columns per class – text cells first, figures to the right */
const COLUMNS: Record<Kind, string[]> = {
	dataset: ['name', 'systems', 'operators', 'keywords', NUM.parts.id, NUM.legal.id],
	system: ['name', 'operators', NUM.datasets.id, NUM.services.id, NUM.users.id, NUM.parts.id],
	service: ['name', 'systems', 'operators', NUM.users.id],
	organization: ['name', 'sector', 'operators', NUM.parts.id, NUM.systems.id, NUM.datasets.id, NUM.services.id],
};
/** figures that roll up along the hierarchy get a hint in the header */
const ROLLUP: Partial<Record<Kind, Set<CountKey>>> = {
	organization: new Set(['systems', 'datasets', 'services']),
	system: new Set(['datasets', 'services']),
};

/** related elements a card shows as chips, in this order; the rest becomes a "+n" */
const CHIPS: Record<Kind, (keyof Pick<CatalogRow, 'systems' | 'operators' | 'datasets' | 'services' | 'users'>)[]> = {
	dataset: ['systems', 'operators'],
	system: ['operators', 'datasets', 'services'],
	service: ['systems', 'operators'],
	organization: ['operators', 'systems'],
};
const CHIP_MAX = 8;

const PAGE_SIZES = [12, 24, 48, 96];
const DEFAULT_PAGE_SIZE = 24;

@Component({
	selector: 'app-catalog',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'sm-routed' },
	imports: [
		TranslatePipe,
		MatBadgeModule,
		MatButtonModule,
		MatButtonToggleModule,
		MatCardModule,
		MatFormFieldModule,
		MatIconModule,
		MatInputModule,
		MatPaginatorModule,
		MatSelectModule,
		MatSlideToggleModule,
		MatSortModule,
		MatTableModule,
		MatTooltipModule,
		ObButtonDirective,
		RouterLink,
		NameList,
		EntityChip,
		PageState,
		DataFooter,
		PickPipe,
		LabelPipe,
	],
	templateUrl: './catalog.html',
	styleUrl: './catalog.scss',
})
export class Catalog {
	private readonly graphService = inject(GraphService);
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	private readonly translate = inject(TranslateService);
	protected readonly lang = inject(LangService).lang;
	protected readonly graph = this.graphService.graph;
	/** class switch order: the data first */
	protected readonly KINDS: Kind[] = ['dataset', 'system', 'service', 'organization'];
	protected readonly KIND_ICON = KIND_ICON;
	protected readonly CHIP_ICON = CHIP_ICON;
	protected readonly ORG_ICON = ORG_ICON;
	protected readonly ORG_TYPES = ORG_TYPES;
	protected readonly PROTECTIONS: Protection[] = ['sensitive', 'personal', 'none'];
	protected readonly PROTECTION_KEY: Record<Protection, string> = {
		sensitive: 'flags.sensitive',
		personal: 'flags.personal',
		none: 'dash.privacy.none',
	};
	protected readonly NUM_COLUMNS = NUM_COLUMNS;
	protected readonly PAGE_SIZES = PAGE_SIZES;

	// ---- state (mirrored in the URL)
	protected readonly kind = signal<Kind>('dataset');
	protected readonly query = signal('');
	protected readonly operator = signal('');
	protected readonly keywords = signal(new Set<string>());
	protected readonly protection = signal(new Set<Protection>());
	protected readonly orgTypes = signal(new Set<OrgType>(ORG_TYPES));
	protected readonly topLevelOnly = signal(false);
	protected readonly groupBy = signal<GroupBy>('none');
	protected readonly view = signal<View>('table');
	protected readonly sort = signal<Sort>({ active: 'name', direction: 'asc' });
	protected readonly pageIndex = signal(0);
	protected readonly pageSize = signal(DEFAULT_PAGE_SIZE);
	protected readonly panelOpen = signal(false);

	protected readonly keywordList = computed(() => [...this.keywords()]);
	protected readonly protectionList = computed(() => [...this.protection()]);
	protected readonly orgTypeList = computed(() => [...this.orgTypes()]);
	/** "top level only" has no meaning once the organizations are already narrowed to one parent */
	protected readonly topLevelDisabled = computed(() => this.kind() === 'organization' && !!this.operator());

	protected readonly rowsByKind = computed(() => {
		const g = this.graph();
		const lang = this.lang();
		if (!g) return null;
		return Object.fromEntries(KINDS.map((k) => [k, buildRows(g, k, lang)])) as Record<Kind, CatalogRow[]>;
	});
	protected readonly rows = computed(() => this.rowsByKind()?.[this.kind()] ?? []);
	protected readonly columns = computed(() => COLUMNS[this.kind()]);
	/** group-by choices per class */
	protected readonly groupOptions = computed<GroupBy[]>(() => {
		switch (this.kind()) {
			case 'dataset':
				return ['system', 'operator'];
			case 'system':
				return ['operator'];
			case 'organization':
				return ['sector'];
			default:
				return [];
		}
	});

	/** top-level organizations responsible for elements of the current class (filter options) */
	protected readonly operatorOptions = computed(() => {
		const g = this.graph();
		if (!g) return [];
		const counts = new Map<string, number>();
		for (const r of this.rows()) for (const id of r.operatorRoots) counts.set(id, (counts.get(id) ?? 0) + 1);
		const lang = this.lang();
		return [...counts.entries()]
			.map(([id, n]) => ({ e: g.entities.get(id)!, n }))
			.sort((a, b) => entityLabel(a.e, lang).localeCompare(entityLabel(b.e, lang), lang));
	});
	protected readonly keywordOptions = computed(() => {
		const map = new Map<string, { e: Entity; n: number }>();
		for (const r of this.rows()) for (const k of r.keywords) map.set(k.id, { e: k, n: (map.get(k.id)?.n ?? 0) + 1 });
		return [...map.values()].sort((a, b) => b.n - a.n);
	});

	protected readonly filtered = computed(() => {
		const terms = normalize(this.query().trim()).split(/\s+/).filter(Boolean);
		const op = this.operator();
		const kws = this.keywords();
		const prot = this.protection();
		const kind = this.kind();
		const lang = this.lang();
		const table = this.view() === 'table';
		const topLevel = this.topLevelOnly() && !this.topLevelDisabled();
		const rows = this.rows().filter((r) => {
			if (terms.length && !terms.every((t) => r.search.includes(t))) return false;
			if (op && !r.operatorRoots.has(op)) return false;
			if (kws.size && !r.e.keywords.some((k) => kws.has(k))) return false;
			if (kind === 'dataset' && prot.size) {
				if (!prot.has(r.e.sensitive ? 'sensitive' : r.e.personal ? 'personal' : 'none')) return false;
			}
			if (kind === 'organization' && !this.orgTypes().has(r.e.orgType ?? 'other')) return false;
			if (topLevel && r.e.root !== r.e.id) return false;
			return true;
		});
		const { active, direction } = this.sort();
		const dir = direction === 'desc' ? -1 : 1;
		const names = (list: Entity[]): string => list.map((x) => entityLabel(x, lang)).join(' ');
		const count = NUM_ID.get(active);
		const key = (r: CatalogRow): string | number => {
			if (count) return r.counts[count];
			switch (active) {
				case 'sector':
					return this.translate.instant(`orgType.${r.e.orgType ?? 'other'}`);
				case 'operators':
					return names(r.operators);
				case 'systems':
					return names(r.systems);
				default:
					// the table shows abbreviations, so it sorts by them
					return table ? abbrLabel(r.e, lang) : r.name;
			}
		};
		const cmp = (a: string | number, b: string | number): number =>
			typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), lang);
		return [...rows].sort((a, b) => dir * cmp(key(a), key(b)) || a.name.localeCompare(b.name, lang));
	});

	/** all groups over the filtered rows (sizes and order) */
	protected readonly groups = computed<Group[]>(() => {
		const rows = this.filtered();
		const by = this.groupBy();
		if (by === 'none' || !this.groupOptions().includes(by)) return [{ key: '', rows, total: rows.length }];
		const g = this.graph()!;
		const lang = this.lang();
		if (by === 'sector') {
			return ORG_TYPES.map((t) => {
				const grpRows = rows.filter((r) => (r.e.orgType ?? 'other') === t);
				return { key: t, label: this.translate.instant(`orgType.${t}`), rows: grpRows, total: grpRows.length };
			}).filter((grp) => grp.total);
		}
		const map = new Map<string, Group>();
		const none: Group = { key: '∅', rows: [], total: 0 };
		for (const r of rows) {
			const keys =
				by === 'system' ? (this.kind() === 'system' ? [r.e] : r.systems).map((s) => s.id) : [...r.operatorRoots];
			if (!keys.length) none.rows.push(r);
			for (const k of keys) {
				if (!map.has(k)) map.set(k, { key: k, entity: g.entities.get(k), rows: [], total: 0 });
				map.get(k)!.rows.push(r);
			}
		}
		const out = [...map.values()].sort(
			(a, b) => b.rows.length - a.rows.length || entityLabel(a.entity, lang).localeCompare(entityLabel(b.entity, lang)),
		);
		if (none.rows.length) out.push(none);
		for (const grp of out) grp.total = grp.rows.length;
		return out;
	});

	/** rows over all groups (an element in two groups counts twice, as it is shown twice) */
	protected readonly total = computed(() => this.groups().reduce((n, grp) => n + grp.rows.length, 0));
	protected readonly page = computed(() =>
		Math.min(this.pageIndex(), Math.max(0, Math.ceil(this.total() / this.pageSize()) - 1)),
	);
	/** the groups cut to the current page, keeping the group order */
	protected readonly pagedGroups = computed<Group[]>(() => {
		const start = this.page() * this.pageSize();
		const end = start + this.pageSize();
		const out: Group[] = [];
		let offset = 0;
		for (const grp of this.groups()) {
			const from = Math.max(start - offset, 0);
			const to = Math.min(end - offset, grp.rows.length);
			if (from < to) out.push({ ...grp, rows: grp.rows.slice(from, to) });
			offset += grp.rows.length;
			if (offset >= end) break;
		}
		return out;
	});

	/** filters that deviate from their defaults – shown as a badge on the filter button */
	protected readonly activeFilterCount = computed(
		() =>
			(this.operator() ? 1 : 0) +
			(this.keywords().size ? 1 : 0) +
			(this.protection().size ? 1 : 0) +
			(this.orgTypes().size !== ORG_TYPES.length ? 1 : 0) +
			(this.groupBy() !== 'none' ? 1 : 0) +
			(this.topLevelOnly() && !this.topLevelDisabled() ? 1 : 0),
	);

	constructor() {
		this.readUrl();
		// the class switch is also reachable from the dashboard tiles → react to later query-param changes
		this.route.queryParamMap.subscribe((p) => {
			const k = p.get('kind') ?? 'dataset';
			if (k !== untracked(this.kind) && (KINDS as readonly string[]).includes(k)) this.setKind(k as Kind);
		});
		// back to the first page whenever the selection changes (but not when data or language arrive)
		let lastSelection: string | undefined;
		effect(() => {
			const selection = JSON.stringify([
				this.kind(),
				this.query(),
				this.operator(),
				[...this.keywords()],
				[...this.protection()],
				[...this.orgTypes()],
				this.topLevelOnly(),
				this.groupBy(),
				this.sort(),
			]);
			if (lastSelection !== undefined && selection !== lastSelection) untracked(() => this.pageIndex.set(0));
			lastSelection = selection;
		});
		effect(() => {
			const params = this.urlParams();
			untracked(() => this.router.navigate([], { relativeTo: this.route, queryParams: params, replaceUrl: true }));
		});
	}

	// ---------------------------------------------------------------------------------------------- columns & cards

	/** the chips of a card: related elements of the row's class, capped at CHIP_MAX */
	protected chips(r: CatalogRow): { list: Entity[]; more: number } {
		const seen = new Set<string>();
		const all: Entity[] = [];
		for (const key of CHIPS[this.kind()]) for (const e of r[key]) if (!seen.has(e.id)) (seen.add(e.id), all.push(e));
		return { list: all.slice(0, CHIP_MAX), more: Math.max(0, all.length - CHIP_MAX) };
	}

	protected isNum(column: string): boolean {
		return NUM_ID.has(column);
	}

	/** label of a figure ("Teile" / "Teilsysteme" / "Untereinheiten" depend on the class); singular for exactly one */
	protected numLabel(c: NumColumn, n = 0): string {
		return figureLabel(c.count, this.kind(), n);
	}

	protected numHint(c: NumColumn): string | null {
		return ROLLUP[this.kind()]?.has(c.count) ? `catalog.numHint.${this.kind()}` : null;
	}

	// ---------------------------------------------------------------------------------------------- actions

	protected setKind(k: Kind): void {
		this.kind.set(k);
		this.clearFilters();
		this.sort.set({ active: 'name', direction: 'asc' });
	}

	protected clearFilters(): void {
		this.operator.set('');
		this.keywords.set(new Set());
		this.protection.set(new Set());
		this.orgTypes.set(new Set(ORG_TYPES));
		this.topLevelOnly.set(false);
		this.groupBy.set('none');
	}

	protected setKeywords(ids: string[]): void {
		this.keywords.set(new Set(ids));
	}
	protected setProtection(values: Protection[]): void {
		this.protection.set(new Set(values));
	}
	protected setOrgTypes(values: OrgType[]): void {
		this.orgTypes.set(new Set(values));
	}
	protected onSort(s: Sort): void {
		this.sort.set(s.direction ? s : { active: 'name', direction: 'asc' });
	}
	protected onPage(e: PageEvent): void {
		this.pageIndex.set(e.pageIndex);
		this.pageSize.set(e.pageSize);
	}

	protected exportCsv(): void {
		const csv = toCsv(this.filtered(), this.kind(), this.lang(), (k) => this.translate.instant(k));
		const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
		const a = document.createElement('a');
		a.href = url;
		a.download = `system-map-${this.kind()}-${new Date().toISOString().slice(0, 10)}.csv`;
		a.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}

	/** tooltip of a table name: the full name when the cell shows the abbreviation, then the description */
	protected nameTip(r: CatalogRow): string {
		return [r.e.abbreviation ? r.name : '', r.description].filter(Boolean).join('\n\n');
	}

	protected host(url: string): string {
		try {
			return new URL(url).hostname.replace(/^www\./, '');
		} catch {
			return url;
		}
	}

	// ---------------------------------------------------------------------------------------------- URL state

	private urlParams(): Record<string, string | null> {
		return {
			kind: this.kind() === 'dataset' ? null : this.kind(),
			q: this.query() || null,
			op: this.operator() ? compactIri(this.operator()) : null,
			kw: this.keywords().size ? [...this.keywords()].map(compactIri).join(',') : null,
			protection: this.protection().size ? [...this.protection()].join(',') : null,
			sector: this.orgTypes().size === ORG_TYPES.length ? null : [...this.orgTypes()].join(',') || 'none',
			top: this.topLevelOnly() ? '1' : null,
			group: this.groupBy() === 'none' ? null : this.groupBy(),
			view: this.view() === 'table' ? null : this.view(),
			page: this.page() ? String(this.page() + 1) : null,
			size: this.pageSize() === DEFAULT_PAGE_SIZE ? null : String(this.pageSize()),
		};
	}

	private readUrl(): void {
		const q = this.route.snapshot.queryParamMap;
		const list = (k: string): string[] | null => {
			const v = q.get(k);
			return v === null ? null : v === 'none' ? [] : v.split(',').filter(Boolean);
		};
		const kind = q.get('kind');
		if (kind && (KINDS as readonly string[]).includes(kind)) this.kind.set(kind as Kind);
		if (q.get('q')) this.query.set(q.get('q')!);
		if (q.get('op')) this.operator.set(expandIri(q.get('op')!));
		const kw = list('kw');
		if (kw) this.keywords.set(new Set(kw.map(expandIri)));
		const prot = list('protection');
		if (prot)
			this.protection.set(new Set(prot.filter((p): p is Protection => (this.PROTECTIONS as string[]).includes(p))));
		const sector = list('sector');
		if (sector) this.orgTypes.set(new Set(sector.filter((s): s is OrgType => (ORG_TYPES as string[]).includes(s))));
		if (q.get('top') === '1') this.topLevelOnly.set(true);
		const group = q.get('group');
		if (group === 'system' || group === 'operator' || group === 'sector') this.groupBy.set(group);
		if (q.get('view') === 'cards') this.view.set('cards');
		const page = Number(q.get('page'));
		if (page > 1) this.pageIndex.set(page - 1);
		const size = Number(q.get('size'));
		if (PAGE_SIZES.includes(size)) this.pageSize.set(size);
	}
}
