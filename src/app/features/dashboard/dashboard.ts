import { PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { GraphService } from '../../core/graph.service';
import { LabelPipe, LangService, PickPipe, pick } from '../../core/i18n';
import { KINDS, compactIri } from '../../core/vocab';
import { BarItem, BarList } from '../../shared/bar-list';
import { DataFooter } from '../../shared/data-footer';
import { TipDirective } from '../../shared/tip';
import { KIND_ICON, PageState } from '../../shared/ui';
import { computeDashboard } from './dashboard-data';

const ORG_COLOR: Record<string, string> = {
	federal: 'var(--org-federal)',
	cantonal: 'var(--org-cantonal)',
	private: 'var(--org-private)',
	other: 'var(--org-other)',
};

@Component({
	selector: 'app-dashboard',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'sm-routed' },
	imports: [
		TranslatePipe,
		RouterLink,
		MatIconModule,
		PercentPipe,
		BarList,
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
	protected readonly lang = this.langService.lang;
	protected readonly locale = this.langService.locale;
	protected readonly graph = this.graphService.graph;
	protected readonly KINDS = KINDS;
	protected readonly KIND_ICON = KIND_ICON;
	protected readonly ORG_COLOR = ORG_COLOR;
	protected readonly compactIri = compactIri;

	protected readonly data = computed(() => {
		const g = this.graph();
		return g ? computeDashboard(g) : null;
	});

	protected readonly operatorBars = computed<BarItem[]>(
		() =>
			this.data()?.operators.map((o) => ({
				entity: o.entity,
				value: o.value,
				color: ORG_COLOR[o.orgType ?? 'other'],
			})) ?? [],
	);
	protected readonly systemBars = computed<BarItem[]>(
		() => this.data()?.systemsByData.map((o) => ({ entity: o.entity, value: o.value })) ?? [],
	);
	protected readonly serviceBars = computed<BarItem[]>(
		() =>
			this.data()
				?.services.filter((o) => o.value > 0)
				.map((o) => ({ entity: o.entity, value: o.value })) ?? [],
	);
	protected readonly hubBars = computed<BarItem[]>(
		() => this.data()?.hubs.map((o) => ({ entity: o.entity, value: o.value })) ?? [],
	);
	protected readonly relationBars = computed<BarItem[]>(() => {
		const g = this.graph();
		const lang = this.lang();
		return (
			this.data()?.relationCounts.map((r) => ({
				label: pick(g?.relationInfo.get(r.key)?.name, lang) || r.key,
				value: r.count,
				color: 'var(--sm-ink-3)',
			})) ?? []
		);
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
