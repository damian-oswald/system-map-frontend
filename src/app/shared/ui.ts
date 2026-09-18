import { Component, booleanAttribute, computed, forwardRef, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { ObButtonDirective } from '@oblique/oblique';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { Entity, EntityKind } from '../core/graph.model';
import { GraphService } from '../core/graph.service';
import { entityTitle, LabelPipe, LangService } from '../core/i18n';

export const KIND_ICON: Record<EntityKind, string> = {
	organization: 'building',
	system: 'server',
	dataset: 'database',
	service: 'branch',
	legislation: 'justice-scales',
	keyword: 'tag',
	collection: 'stack',
	other: 'info',
};

/** Pill linking to an entity's detail page, colour-coded by class; optionally with the class icon and the abbreviation. */
@Component({
	selector: 'app-entity-chip',
	imports: [RouterLink, LabelPipe, MatIconModule],
	template: `
		@if (entity(); as e) {
			<a class="sm-chip sm-kind--{{ e.kind }}" [routerLink]="['/entity', e.key]" [attr.title]="title()">
				@if (icon()) {
					<mat-icon [svgIcon]="KIND_ICON[e.kind]" />
				}
				<span>{{ e | label: lang() : (abbr() ? 'abbr' : 'short') : max() }}</span>
			</a>
		}
	`,
	styles: `
		:host {
			display: inline-flex;
			max-width: 100%;
		}
		mat-icon {
			flex: none;
			width: 14px;
			height: 14px;
			margin-right: 7px;
			color: var(--k, var(--sm-ink-3));
		}
	`,
})
export class EntityChip {
	readonly entity = input.required<Entity | undefined>();
	readonly max = input(48);
	/** show the class icon in front of the label */
	readonly icon = input(false, { transform: booleanAttribute });
	/** prefer the abbreviation over the (shortened) name */
	readonly abbr = input(false, { transform: booleanAttribute });
	protected readonly lang = inject(LangService).lang;
	protected readonly KIND_ICON = KIND_ICON;
	protected readonly title = computed(() => entityTitle(this.entity(), this.lang()));
}

/** Loading skeleton / error state shown while the graph is being fetched. */
@Component({
	selector: 'app-page-state',
	imports: [TranslatePipe, MatIconModule, MatButtonModule, ObButtonDirective],
	template: `
		@if (graph.state() === 'error') {
			<div class="state-error sm-card sm-card-pad" role="alert">
				<mat-icon svgIcon="exclamation" />
				<div>
					<h2>{{ 'state.error.title' | translate }}</h2>
					<p class="sm-muted">
						{{ 'state.error.text' | translate }} <code>{{ graph.error() }}</code>
					</p>
					<button mat-button obButton="primary" type="button" class="retry" (click)="graph.reload()">
						{{ 'state.error.retry' | translate }}
					</button>
				</div>
			</div>
		} @else {
			<div class="state-loading" aria-busy="true" [attr.aria-label]="'state.loading' | translate">
				<div class="sm-skeleton" style="height: 28px; width: 40%"></div>
				<div class="sm-skeleton" style="height: 16px; width: 65%"></div>
				<div class="grid">
					@for (i of [1, 2, 3, 4]; track i) {
						<div class="sm-skeleton" style="height: 110px"></div>
					}
				</div>
				<div class="sm-skeleton" style="height: 320px"></div>
			</div>
		}
	`,
	styles: `
		.state-loading {
			display: grid;
			gap: 14px;
			padding: 16px 0;
		}
		.grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
			gap: 16px;
			margin: 12px 0;
		}
		.state-error {
			display: flex;
			gap: 16px;
			margin: 32px 0;
			border-left: 4px solid var(--sm-accent);
			h2 {
				margin: 0 0 4px;
			}
		}
		.retry {
			margin-top: 8px;
		}
	`,
})
export class PageState {
	protected readonly graph = inject(GraphService);
}

export interface TreeNode {
	e: Entity;
	self: boolean;
	children: TreeNode[];
}

/** Hierarchy of an element (ancestors → the element → its descendants), drawn as an indented tree. */
@Component({
	selector: 'app-entity-tree',
	imports: [EntityChip, LabelPipe, forwardRef(() => EntityTree)],
	template: `
		<ul class="etree" [class.root]="root()">
			@for (n of nodes(); track n.e.id) {
				<li>
					@if (n.self) {
						<span class="sm-chip current sm-kind--{{ n.e.kind }}"
							><span>{{ n.e | label: lang() : 'short' : 60 }}</span></span
						>
					} @else {
						<app-entity-chip [entity]="n.e" [max]="60" />
					}
					@if (n.children.length) {
						<app-entity-tree [nodes]="n.children" [root]="false" />
					}
				</li>
			}
		</ul>
	`,
	styles: `
		:host {
			display: block;
		}
		.etree {
			margin: 0;
			padding: 0;
			list-style: none;
		}
		.etree:not(.root) {
			margin: 2px 0 0 11px;
			padding-left: 18px;
			border-left: 1px solid var(--sm-line-strong);
		}
		li {
			position: relative;
			padding: 3px 0;
		}
		.etree:not(.root) > li::before {
			content: '';
			position: absolute;
			top: 16px;
			left: -18px;
			width: 12px;
			border-top: 1px solid var(--sm-line-strong);
		}
		.etree:not(.root) > li:last-child::after {
			content: '';
			position: absolute;
			top: 17px;
			bottom: -3px;
			left: -19px;
			width: 3px;
			background: var(--sm-surface);
		}
		.current {
			background: var(--k-bg);
			border-color: var(--k);
			font-weight: 600;
		}
	`,
})
export class EntityTree {
	readonly nodes = input.required<TreeNode[]>();
	readonly root = input(true);
	protected readonly lang = inject(LangService).lang;
}

/** Names as running text – "A, B und C" or "A, B, C und n weitere" – as plain links that underline on hover. */
@Component({
	selector: 'app-name-list',
	imports: [RouterLink, LabelPipe],
	template: `@for (x of shown(); track x.id; let i = $index; let last = $last) {
			<span>{{ separator(i, last) }}</span
			><a [routerLink]="['/entity', x.key]" [title]="x | label: lang() : 'title'">{{
				abbr()
					? (x | label: lang() : 'abbr' : chars())
					: chars()
						? (x | label: lang() : 'short' : chars())
						: (x | label: lang())
			}}</a>
		}
		@if (more()) {
			<span>{{ moreText() }}</span>
		}`,
	styles: `
		:host {
			display: inline;
			white-space: pre-wrap;
		}
		a,
		a:visited {
			color: inherit;
			text-decoration: none;
		}
		a:hover,
		a:focus-visible {
			text-decoration: underline;
		}
	`,
})
export class NameList {
	readonly items = input.required<Entity[]>();
	readonly max = input(3);
	/** cut each name to this many characters (0 = full names) */
	readonly chars = input(0);
	/** show abbreviations where they exist (dense tables) */
	readonly abbr = input(false);
	protected readonly lang = inject(LangService).lang;
	private readonly translate = inject(TranslateService);
	protected readonly shown = computed(() => this.items().slice(0, this.max()));
	protected readonly more = computed(() => this.items().length - this.shown().length);
	protected readonly moreText = computed(() => {
		this.lang();
		return ` ${this.translate.instant('common.andMore', { n: this.more() })}`;
	});

	protected separator(i: number, last: boolean): string {
		if (i === 0) return '';
		return last && !this.more() ? ` ${this.translate.instant('common.and')} ` : ', ';
	}
}
