import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ObButtonDirective } from '@oblique/oblique';
import { TranslatePipe } from '@ngx-translate/core';

import { GraphService } from '../core/graph.service';
import { LangService } from '../core/i18n';
import { LiveStatsService } from '../core/live-stats.service';
import { REPO_URL } from '../core/vocab';

/** Dark, full-width section at the bottom of every page: where the data comes from, how fresh it is, and a reload. */
@Component({
	selector: 'app-data-footer',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe, DatePipe, DecimalPipe, MatButtonModule, MatIconModule, ObButtonDirective],
	template: `
		<section class="inner" [attr.aria-label]="'footer.title' | translate">
			<div class="main">
				<h2>{{ 'footer.title' | translate }}</h2>
				<p class="lead">{{ 'footer.lead' | translate }}</p>
				<ul class="facts">
					@if (created(); as d) {
						<li>
							<mat-icon svgIcon="calendar" />{{
								'footer.createdOn' | translate: { date: (d | date: 'longDate' : undefined : locale()) }
							}}
						</li>
					}
					@if (modified(); as d) {
						<li>
							<mat-icon svgIcon="history" />{{
								'footer.modifiedOn' | translate: { date: (d | date: 'longDate' : undefined : locale()) }
							}}
						</li>
					}
					<li>
						<a [href]="REPO_URL" target="_blank" rel="noopener"
							><mat-icon svgIcon="github" />{{ 'footer.repo' | translate }}</a
						>
					</li>
					<li>
						<a [href]="REPO_URL + '/issues/new'" target="_blank" rel="noopener"
							><mat-icon svgIcon="message" />{{ 'footer.issues' | translate }}</a
						>
					</li>
				</ul>
			</div>

			<div class="live">
				<span class="dot" [class.syncing]="busy()" aria-hidden="true"></span>
				<div class="live-text" role="status">
					<strong>{{ 'footer.live' | translate }}</strong>
					@if (busy()) {
						<span>{{ 'footer.syncing' | translate }}</span>
					} @else if (stats.stats(); as s) {
						<span>{{ s.at | date: 'medium' : undefined : locale() }}</span>
						<span>{{ s.triples | number: '1.0-0' : locale() }} {{ 'footer.triples' | translate }}</span>
					} @else if (stats.error()) {
						<span>{{ 'footer.unavailable' | translate }}</span>
					}
				</div>
				<button mat-button obButton="secondary" type="button" class="reload" (click)="reload()" [disabled]="busy()">
					<mat-icon svgIcon="refresh" />{{ 'footer.reload' | translate }}
				</button>
			</div>
		</section>
	`,
	styles: `
		:host {
			display: block;
			background: #1c2834;
			color: #e6ebef;
		}
		.inner {
			display: grid;
			grid-template-columns: minmax(0, 1fr) minmax(0, 420px);
			gap: 40px 64px;
			align-items: start;
			max-width: 1400px;
			margin: 0 auto;
			padding: 56px 24px 64px;
		}
		h2 {
			margin: 0 0 8px;
			color: #fff;
			font-size: 2rem;
		}
		.lead {
			max-width: 60ch;
			margin: 0 0 24px;
			color: #b8c3cc;
			line-height: 1.55;
		}
		.facts {
			display: grid;
			gap: 10px;
			margin: 0;
			padding: 0;
			list-style: none;
			li,
			a {
				display: flex;
				align-items: center;
				gap: 12px;
			}
			a {
				color: #fff;
			}
			mat-icon {
				flex: none;
				width: 18px;
				height: 18px;
				color: #acb4bd;
			}
		}
		.live {
			display: flex;
			align-items: center;
			gap: 14px;
			padding: 16px 18px;
			border: 1px solid #46596b;
			border-radius: 8px;
		}
		.dot {
			flex: none;
			align-self: flex-start;
			width: 10px;
			height: 10px;
			margin-top: 7px;
			border-radius: 50%;
			background: #34d399;
			box-shadow: 0 0 0 4px rgba(52, 211, 153, 0.2);
			&.syncing {
				animation: blink 1s ease-in-out infinite;
			}
		}
		@keyframes blink {
			50% {
				opacity: 0.3;
			}
		}
		.live-text {
			display: grid;
			flex: 1;
			gap: 2px;
			strong {
				color: #fff;
				font-weight: 400;
			}
			span {
				color: #b8c3cc;
				font-size: 0.875rem;
				font-variant-numeric: tabular-nums;
			}
		}
		.reload.mat-mdc-button {
			flex: none;
			border: 1px solid #fff !important;
			background: transparent !important;
			color: #fff !important;
			mat-icon {
				width: 18px;
				height: 18px;
				margin-right: 6px;
				color: #fff;
			}
			&:hover:not([disabled]) {
				background: rgba(255, 255, 255, 0.12) !important;
			}
			&[disabled] {
				opacity: 0.6;
			}
		}
		@media (max-width: 900px) {
			.inner {
				grid-template-columns: minmax(0, 1fr);
				padding: 40px 16px 48px;
			}
		}
		@media (prefers-reduced-motion: reduce) {
			.dot.syncing {
				animation: none;
			}
		}
	`,
})
export class DataFooter {
	protected readonly service = inject(GraphService);
	protected readonly stats = inject(LiveStatsService);
	private readonly langService = inject(LangService);
	protected readonly locale = this.langService.locale;
	protected readonly REPO_URL = REPO_URL;

	protected readonly busy = computed(() => this.service.revalidating() || this.stats.loading());
	/** dates from the live query, with the loaded graph's metadata as fallback */
	protected readonly created = computed(() => this.stats.stats()?.created ?? this.service.graph()?.meta.dateCreated);
	protected readonly modified = computed(() => this.stats.stats()?.modified ?? this.service.graph()?.meta.dateModified);

	protected reload(): void {
		void this.service.reload();
		void this.stats.refresh();
	}
}
