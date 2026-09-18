import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Entity } from '../core/graph.model';
import { LabelPipe, LangService } from '../core/i18n';
import { TipDirective } from './tip';

export interface BarItem {
	entity?: Entity;
	label?: string;
	value: number;
	/** CSS colour of the bar (identity), defaults to the entity's class colour */
	color?: string;
	link?: unknown[];
	queryParams?: Record<string, string>;
}

/** Horizontal ranked bars: label left, thin bar with the value at its tip. */
@Component({
	selector: 'app-bar-list',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [RouterLink, LabelPipe, TipDirective],
	template: `
		<ol class="bars" [style.--label-w]="labelWidth()">
			@for (it of items(); track $index) {
				<li>
					@if (it.entity) {
						<a
							class="label"
							[routerLink]="['/entity', it.entity.key]"
							[attr.title]="it.entity | label: lang() : 'title'"
							>{{ it.entity | label: lang() : 'short' : 40 }}</a
						>
					} @else if (it.link) {
						<a class="label" [routerLink]="it.link" [queryParams]="it.queryParams">{{ it.label }}</a>
					} @else {
						<span class="label">{{ it.label }}</span>
					}
					<span
						class="track"
						[appTip]="[it.value + ' ' + unit(), it.entity ? (it.entity | label: lang() : 'title') : (it.label ?? '')]"
						tabindex="-1"
					>
						<span
							class="bar sm-kind--{{ it.entity?.kind ?? 'other' }}"
							[style.width]="'calc((100% - 44px) * ' + it.value / max() + ')'"
							[style.background]="it.color ?? null"
						></span>
						<span class="value">{{ it.value }}</span>
					</span>
				</li>
			}
		</ol>
	`,
	styles: `
		.bars {
			display: grid;
			gap: 6px;
			margin: 0;
			padding: 0;
			list-style: none;
		}
		li {
			display: grid;
			grid-template-columns: var(--label-w, 44%) minmax(0, 1fr);
			align-items: center;
			gap: 12px;
			min-height: 26px;
		}
		.label {
			overflow: hidden;
			color: var(--sm-ink);
			font-size: 0.875rem;
			text-align: right;
			text-overflow: ellipsis;
			white-space: nowrap;
			text-decoration: none;
		}
		a.label:hover {
			text-decoration: underline;
		}
		.track {
			display: flex;
			align-items: center;
			gap: 8px;
			height: 26px;
			cursor: default;
		}
		.bar {
			display: block;
			min-width: 3px;
			height: 16px;
			border-radius: 0 4px 4px 0;
			background: var(--k);
			transition: filter 0.15s;
		}
		.track:hover .bar {
			filter: brightness(1.15);
		}
		.value {
			flex: none;
			color: var(--sm-ink-2);
			font-size: 0.8125rem;
			font-weight: 600;
		}
	`,
})
export class BarList {
	readonly items = input.required<BarItem[]>();
	readonly unit = input('');
	readonly labelWidth = input('44%');
	protected readonly lang = inject(LangService).lang;
	protected readonly max = computed(() => Math.max(1, ...this.items().map((i) => i.value)));
}
