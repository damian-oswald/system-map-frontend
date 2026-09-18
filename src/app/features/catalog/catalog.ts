import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ObButtonDirective } from '@oblique/oblique';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CANTONS } from '../../core/cantons';
import { Entity, OrgType } from '../../core/graph.model';
import { GraphService } from '../../core/graph.service';
import { LabelPipe, LangService, PickPipe, entityLabel } from '../../core/i18n';
import { KINDS, Kind, compactIri, expandIri } from '../../core/vocab';
import { DataFooter } from '../../shared/data-footer';
import { EntityChip, KIND_ICON, PageState } from '../../shared/ui';
import { ORG_TYPES } from '../map/map-model';
import { CatalogRow, buildRows, normalize, toCsv } from './catalog-data';

type Protection = 'sensitive' | 'personal' | 'none';
type GroupBy = 'none' | 'system' | 'operator';
type SortBy = 'name' | 'connections';

interface Group {
	key: string;
	entity?: Entity;
	rows: CatalogRow[];
}

@Component({
	selector: 'app-catalog',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'sm-routed' },
	imports: [
		TranslatePipe,
		MatButtonModule,
		MatButtonToggleModule,
		MatFormFieldModule,
		MatIconModule,
		MatInputModule,
		MatSelectModule,
		MatSlideToggleModule,
		MatTooltipModule,
		ObButtonDirective,
		RouterLink,
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
	protected readonly KINDS: Kind[] = ['dataset', 'system', 'service', 'organization'];
	protected readonly KIND_ICON = KIND_ICON;
	protected readonly ORG_TYPES = ORG_TYPES;
	protected readonly CANTONS = CANTONS;
	protected readonly compactIri = compactIri;

	protected readonly kind = signal<Kind>('dataset');
	protected readonly query = signal('');
	protected readonly operator = signal<string>('');
	protected readonly subgraph = signal<string>('');
	protected readonly keyword = signal<string>('');
	protected readonly protection = signal(new Set<Protection>());
	protected readonly masterOnly = signal(false);
	protected readonly fmisOnly = signal(false);
	protected readonly orgTypes = signal(new Set<OrgType>());
	protected readonly canton = signal('');
	protected readonly topLevelOnly = signal(false);
	protected readonly groupBy = signal<GroupBy>('none');
	protected readonly sortBy = signal<SortBy>('name');
	protected readonly view = signal<'cards' | 'table'>('cards');
	protected readonly filtersOpen = signal(false);

	protected readonly rowsByKind = computed(() => {
		const g = this.graph();
		const lang = this.lang();
		if (!g) return null;
		return Object.fromEntries(KINDS.map((k) => [k, buildRows(g, k, lang)])) as Record<Kind, CatalogRow[]>;
	});
	protected readonly rows = computed(() => this.rowsByKind()?.[this.kind()] ?? []);

	/** top-level organizations that appear as operators for the current class (filter options) */
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
		const q = normalize(this.query().trim());
		const terms = q.split(/\s+/).filter(Boolean);
		const op = this.operator();
		const sub = this.subgraph();
		const kw = this.keyword();
		const prot = this.protection();
		const kind = this.kind();
		const g = this.graph();
		const subMembers = sub ? g?.collections.find((c) => c.id === sub)?.members : undefined;
		let rows = this.rows().filter((r) => {
			if (terms.length && !terms.every((t) => r.search.includes(t))) return false;
			if (op && !r.operatorRoots.has(op)) return false;
			if (subMembers && !subMembers.has(r.e.id)) return false;
			if (kw && !r.e.keywords.includes(kw)) return false;
			if (kind === 'dataset') {
				if (prot.size) {
					const p: Protection = r.e.sensitive ? 'sensitive' : r.e.personal ? 'personal' : 'none';
					if (!prot.has(p)) return false;
				}
				if (this.masterOnly() && !r.e.master) return false;
			}
			if (kind === 'system' && this.fmisOnly() && !r.e.fmis) return false;
			if (this.topLevelOnly() && r.e.root !== r.e.id) return false;
			if (kind === 'organization') {
				if (this.orgTypes().size && !this.orgTypes().has(r.e.orgType ?? 'other')) return false;
				if (this.canton() && r.e.canton !== this.canton()) return false;
			}
			return true;
		});
		if (this.sortBy() === 'connections') rows = [...rows].sort((a, b) => b.degree - a.degree);
		return rows;
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

	protected readonly activeFilterCount = computed(
		() =>
			[this.operator(), this.subgraph(), this.keyword(), this.canton()].filter(Boolean).length +
			this.protection().size +
			this.orgTypes().size +
			[this.masterOnly(), this.fmisOnly(), this.topLevelOnly()].filter(Boolean).length,
	);

	constructor() {
		const q = this.route.snapshot.queryParamMap;
		const kind = q.get('kind');
		if (kind && (KINDS as readonly string[]).includes(kind)) this.kind.set(kind as Kind);
		if (q.get('q')) this.query.set(q.get('q')!);
		if (q.get('op')) this.operator.set(expandIri(q.get('op')!));
		if (q.get('sub')) this.subgraph.set(expandIri(q.get('sub')!));
		if (q.get('kw')) this.keyword.set(expandIri(q.get('kw')!));
		if (q.get('group') === 'system' || q.get('group') === 'operator') this.groupBy.set(q.get('group') as GroupBy);
		if (q.get('view') === 'table') this.view.set('table');
		const prot = q.get('protection');
		if (prot) this.protection.set(new Set(prot.split(',') as Protection[]));

		// the kind tabs are also reachable from the dashboard tiles → react to later query-param changes
		this.route.queryParamMap.subscribe((p) => {
			const k = p.get('kind');
			if (k && k !== untracked(this.kind) && (KINDS as readonly string[]).includes(k)) this.setKind(k as Kind);
		});

		effect(() => {
			const params = {
				kind: this.kind() === 'dataset' ? null : this.kind(),
				q: this.query() || null,
				op: this.operator() ? compactIri(this.operator()) : null,
				sub: this.subgraph() ? compactIri(this.subgraph()) : null,
				kw: this.keyword() ? compactIri(this.keyword()) : null,
				group: this.groupBy() === 'none' ? null : this.groupBy(),
				view: this.view() === 'cards' ? null : 'table',
				protection: this.protection().size ? [...this.protection()].join(',') : null,
			};
			untracked(() => this.router.navigate([], { relativeTo: this.route, queryParams: params, replaceUrl: true }));
		});
	}

	protected setKind(k: Kind): void {
		this.kind.set(k);
		this.clearFilters();
		if (k === 'organization' || k === 'service') this.groupBy.set('none');
	}

	protected clearFilters(): void {
		this.operator.set('');
		this.subgraph.set('');
		this.keyword.set('');
		this.protection.set(new Set());
		this.masterOnly.set(false);
		this.fmisOnly.set(false);
		this.orgTypes.set(new Set());
		this.canton.set('');
		this.topLevelOnly.set(false);
	}

	protected toggleProtection(p: Protection): void {
		this.protection.update((s) => {
			const n = new Set(s);
			if (n.has(p)) n.delete(p);
			else n.add(p);
			return n;
		});
	}
	protected toggleOrgType(t: OrgType): void {
		this.orgTypes.update((s) => {
			const n = new Set(s);
			if (n.has(t)) n.delete(t);
			else n.add(t);
			return n;
		});
	}

	protected exportCsv(): void {
		const t = (k: string): string => this.translate.instant(k);
		const headers = [
			'IRI',
			t('catalog.col.name'),
			this.kind() === 'organization' ? t('catalog.col.orgType') : t('catalog.col.flags'),
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
}
