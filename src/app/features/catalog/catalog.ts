import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ObButtonDirective } from '@oblique/oblique';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CANTONS } from '../../core/cantons';
import { Entity, OrgType } from '../../core/graph.model';
import { GraphService } from '../../core/graph.service';
import { LabelPipe, LangService, PickPipe, entityLabel } from '../../core/i18n';
import { KINDS, Kind, compactIri, expandIri } from '../../core/vocab';
import { DataFooter } from '../../shared/data-footer';
import { KIND_ICON, NameList, PageState } from '../../shared/ui';
import { ORG_TYPES } from '../map/map-model';
import { CatalogRow, buildRows, normalize, toCsv } from './catalog-data';

type Protection = 'sensitive' | 'personal' | 'none';
type GroupBy = 'none' | 'system' | 'operator';
type View = 'table' | 'cards';

interface Group {
	key: string;
	entity?: Entity;
	rows: CatalogRow[];
}

/** table columns per class – every cell is text, names are plain links */
const COLUMNS: Record<Kind, string[]> = {
	dataset: ['name', 'description', 'systems', 'operators', 'keywords'],
	system: ['name', 'description', 'operators', 'datasets', 'users'],
	service: ['name', 'description', 'systems', 'users'],
	organization: ['name', 'description', 'sector', 'canton', 'operators', 'systems'],
};

@Component({
	selector: 'app-catalog',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'sm-routed' },
	imports: [
		TranslatePipe,
		MatBadgeModule,
		MatButtonModule,
		MatButtonToggleModule,
		MatFormFieldModule,
		MatIconModule,
		MatInputModule,
		MatSelectModule,
		MatSlideToggleModule,
		MatSortModule,
		MatTableModule,
		MatTooltipModule,
		ObButtonDirective,
		RouterLink,
		NameList,
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
	protected readonly ORG_TYPES = ORG_TYPES;
	protected readonly CANTONS = CANTONS;
	protected readonly PROTECTIONS: Protection[] = ['sensitive', 'personal', 'none'];
	protected readonly PROTECTION_KEY: Record<Protection, string> = {
		sensitive: 'flags.sensitive',
		personal: 'flags.personal',
		none: 'dash.privacy.none',
	};

	// ---- state (mirrored in the URL)
	protected readonly kind = signal<Kind>('dataset');
	protected readonly query = signal('');
	protected readonly operator = signal('');
	protected readonly keywords = signal(new Set<string>());
	protected readonly protection = signal(new Set<Protection>());
	protected readonly masterOnly = signal(false);
	protected readonly fmisOnly = signal(false);
	protected readonly orgTypes = signal(new Set<OrgType>(ORG_TYPES));
	protected readonly canton = signal('');
	protected readonly topLevelOnly = signal(false);
	protected readonly groupBy = signal<GroupBy>('none');
	protected readonly view = signal<View>('table');
	protected readonly sort = signal<Sort>({ active: 'name', direction: 'asc' });
	protected readonly panelOpen = signal(false);

	protected readonly keywordList = computed(() => [...this.keywords()]);
	protected readonly protectionList = computed(() => [...this.protection()]);
	protected readonly orgTypeList = computed(() => [...this.orgTypes()]);

	protected readonly rowsByKind = computed(() => {
		const g = this.graph();
		const lang = this.lang();
		if (!g) return null;
		return Object.fromEntries(KINDS.map((k) => [k, buildRows(g, k, lang)])) as Record<Kind, CatalogRow[]>;
	});
	protected readonly rows = computed(() => this.rowsByKind()?.[this.kind()] ?? []);
	protected readonly columns = computed(() => COLUMNS[this.kind()]);

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
	protected readonly cantonOptions = computed(() => {
		const used = new Set(this.rows().map((r) => r.e.canton));
		return CANTONS.filter((c) => used.has(c.code));
	});

	protected readonly filtered = computed(() => {
		const terms = normalize(this.query().trim()).split(/\s+/).filter(Boolean);
		const op = this.operator();
		const kws = this.keywords();
		const prot = this.protection();
		const kind = this.kind();
		const lang = this.lang();
		const rows = this.rows().filter((r) => {
			if (terms.length && !terms.every((t) => r.search.includes(t))) return false;
			if (op && !r.operatorRoots.has(op)) return false;
			if (kws.size && !r.e.keywords.some((k) => kws.has(k))) return false;
			if (kind === 'dataset') {
				if (prot.size && !prot.has(r.e.sensitive ? 'sensitive' : r.e.personal ? 'personal' : 'none')) return false;
				if (this.masterOnly() && !r.e.master) return false;
			}
			if (kind === 'system' && this.fmisOnly() && !r.e.fmis) return false;
			if (kind === 'organization') {
				if (!this.orgTypes().has(r.e.orgType ?? 'other')) return false;
				if (this.canton() && r.e.canton !== this.canton()) return false;
			}
			if (this.topLevelOnly() && r.e.root !== r.e.id) return false;
			return true;
		});
		const { active, direction } = this.sort();
		const dir = direction === 'desc' ? -1 : 1;
		const names = (list: Entity[]): string => list.map((x) => entityLabel(x, lang)).join(' ');
		const key = (r: CatalogRow): string => {
			switch (active) {
				case 'sector':
					return this.translate.instant(`orgType.${r.e.orgType ?? 'other'}`);
				case 'canton':
					return r.e.canton ?? '';
				case 'operators':
					return names(r.operators);
				case 'systems':
					return names(r.systems);
				default:
					return r.name;
			}
		};
		return [...rows].sort((a, b) => dir * key(a).localeCompare(key(b), lang) || a.name.localeCompare(b.name, lang));
	});

	protected readonly groups = computed<Group[]>(() => {
		const rows = this.filtered();
		const by = this.groupBy();
		if (by === 'none') return [{ key: '', rows }];
		const g = this.graph()!;
		const lang = this.lang();
		const map = new Map<string, Group>();
		const none: Group = { key: '∅', rows: [] };
		for (const r of rows) {
			const keys =
				by === 'system' ? (this.kind() === 'system' ? [r.e] : r.systems).map((s) => s.id) : [...r.operatorRoots];
			if (!keys.length) none.rows.push(r);
			for (const k of keys) {
				if (!map.has(k)) map.set(k, { key: k, entity: g.entities.get(k), rows: [] });
				map.get(k)!.rows.push(r);
			}
		}
		const out = [...map.values()].sort(
			(a, b) => b.rows.length - a.rows.length || entityLabel(a.entity, lang).localeCompare(entityLabel(b.entity, lang)),
		);
		if (none.rows.length) out.push(none);
		return out;
	});

	/** filters that deviate from their defaults – shown as a badge on the filter button */
	protected readonly activeFilterCount = computed(
		() =>
			[this.operator(), this.canton()].filter(Boolean).length +
			(this.keywords().size ? 1 : 0) +
			(this.protection().size ? 1 : 0) +
			(this.orgTypes().size !== ORG_TYPES.length ? 1 : 0) +
			(this.groupBy() !== 'none' ? 1 : 0) +
			[this.masterOnly(), this.fmisOnly(), this.topLevelOnly()].filter(Boolean).length,
	);

	constructor() {
		this.readUrl();
		// the class switch is also reachable from the dashboard tiles → react to later query-param changes
		this.route.queryParamMap.subscribe((p) => {
			const k = p.get('kind') ?? 'dataset';
			if (k !== untracked(this.kind) && (KINDS as readonly string[]).includes(k)) this.setKind(k as Kind);
		});
		effect(() => {
			const params = this.urlParams();
			untracked(() => this.router.navigate([], { relativeTo: this.route, queryParams: params, replaceUrl: true }));
		});
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
		this.masterOnly.set(false);
		this.fmisOnly.set(false);
		this.orgTypes.set(new Set(ORG_TYPES));
		this.canton.set('');
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

	protected exportCsv(): void {
		const t = (k: string): string => this.translate.instant(k);
		const headers = [
			'IRI',
			t('catalog.col.name'),
			this.kind() === 'organization' ? t('catalog.sector') : t('catalog.col.flags'),
			t(`catalog.where.${this.kind()}`),
			t(`catalog.who.${this.kind()}`),
			t('kind.dataset.plural'),
			t('catalog.col.website'),
			t('catalog.col.description'),
		];
		const csv = toCsv(this.filtered(), this.kind(), this.lang(), headers);
		const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
		const a = document.createElement('a');
		a.href = url;
		a.download = `system-map-${this.kind()}-${new Date().toISOString().slice(0, 10)}.csv`;
		a.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
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
			canton: this.canton() || null,
			top: this.topLevelOnly() ? '1' : null,
			master: this.masterOnly() ? '1' : null,
			fmis: this.fmisOnly() ? '1' : null,
			group: this.groupBy() === 'none' ? null : this.groupBy(),
			view: this.view() === 'table' ? null : this.view(),
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
		if (q.get('canton')) this.canton.set(q.get('canton')!);
		if (q.get('top') === '1') this.topLevelOnly.set(true);
		if (q.get('master') === '1') this.masterOnly.set(true);
		if (q.get('fmis') === '1') this.fmisOnly.set(true);
		if (q.get('group') === 'system' || q.get('group') === 'operator') this.groupBy.set(q.get('group') as GroupBy);
		if (q.get('view') === 'cards') this.view.set('cards');
	}
}
