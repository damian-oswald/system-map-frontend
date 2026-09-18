import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ObButtonDirective } from '@oblique/oblique';
import { TranslatePipe } from '@ngx-translate/core';

import { GraphService } from '../core/graph.service';
import { LangService, PickPipe } from '../core/i18n';
import { ENDPOINT, GRAPH_IRI, REPO_URL } from '../core/vocab';

/** Dark, full-width section at the bottom of every page: provenance of the data and a reload control. */
@Component({
	selector: 'app-data-footer',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe, PickPipe, DatePipe, DecimalPipe, MatButtonModule, MatIconModule, ObButtonDirective],
	template: `
		<section class="inner" [attr.aria-label]="'footer.title' | translate">
			<div class="main">
				<h2>{{ 'footer.title' | translate }}</h2>
				<p class="lead">{{ 'footer.lead' | translate }}</p>
				<dl class="facts">
					@if (graph(); as g) {
						<div>
							<dt>{{ 'footer.name' | translate }}</dt>
							<dd>{{ g.meta.name | pick: lang() }}</dd>
						</div>
						@if (g.meta.dateCreated) {
							<div>
								<dt>{{ 'footer.created' | translate }}</dt>
								<dd>{{ g.meta.dateCreated | date: 'longDate' : undefined : locale() }}</dd>
							</div>
						}
						@if (g.meta.dateModified) {
							<div>
								<dt>{{ 'footer.modified' | translate }}</dt>
								<dd>{{ g.meta.dateModified | date: 'longDate' : undefined : locale() }}</dd>
							</div>
						}
						<div>
							<dt>{{ 'footer.source' | translate }}</dt>
							<dd>LINDAS · {{ g.tripleCount | number: '1.0-0' : locale() }} {{ 'footer.triples' | translate }}</dd>
						</div>
					}
					<div>
						<dt>{{ 'footer.graph' | translate }}</dt>
						<dd>
							<span class="mono">{{ GRAPH_IRI }}</span>
						</dd>
					</div>
					<div>
						<dt>{{ 'footer.endpoint' | translate }}</dt>
						<dd>
							<a [href]="ENDPOINT" target="_blank" rel="noopener"
								><span class="mono">{{ ENDPOINT }}</span></a
							>
						</dd>
					</div>
				</dl>
			</div>

			<div class="side">
				<div class="live">
					<span class="dot" [class.syncing]="service.revalidating()" aria-hidden="true"></span>
					<div class="live-text">
						<strong>{{ 'footer.live' | translate }}</strong>
						<span role="status">
							@if (service.revalidating()) {
								{{ 'footer.syncing' | translate }}
							} @else if (service.fetchedAt(); as at) {
								{{ 'footer.queried' | translate: { date: (at | date: 'medium' : undefined : locale()) } }}
							}
						</span>
					</div>
					<button
						mat-button
						obButton="secondary"
						type="button"
						class="reload"
						(click)="service.reload()"
						[disabled]="service.revalidating()"
					>
						<mat-icon svgIcon="refresh" />{{ 'footer.reload' | translate }}
					</button>
				</div>
				<ul class="links">
					<li>
						<a [href]="editorLink" target="_blank" rel="noopener"
							><mat-icon svgIcon="search" />{{ 'footer.editor' | translate }}</a
						>
					</li>
					<li>
						<a [href]="REPO_URL" target="_blank" rel="noopener"
							><mat-icon svgIcon="github" />{{ 'about.links.repo' | translate }}</a
						>
					</li>
					<li>
						<a [href]="REPO_URL + '/issues'" target="_blank" rel="noopener"
							><mat-icon svgIcon="message" />{{ 'about.links.issues' | translate }}</a
						>
					</li>
				</ul>
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
			margin: 0 0 28px;
			color: #b8c3cc;
			line-height: 1.55;
		}
		.facts {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
			gap: 20px 32px;
			margin: 0;
			div {
				padding-left: 14px;
				border-left: 2px solid #46596b;
			}
		}
		dt {
			color: #acb4bd;
			font-size: 0.75rem;
			font-weight: 600;
			letter-spacing: 0.06em;
			text-transform: uppercase;
		}
		dd {
			margin: 4px 0 0;
			color: #fff;
			overflow-wrap: anywhere;
		}
		.mono {
			font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
			font-size: 0.8125rem;
		}
		a {
			color: #fff;
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
			width: 10px;
			height: 10px;
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
		.links {
			display: grid;
			gap: 6px;
			margin: 24px 0 0;
			padding: 0;
			list-style: none;
			a {
				display: inline-flex;
				align-items: center;
				gap: 10px;
			}
			mat-icon {
				width: 18px;
				height: 18px;
				color: #acb4bd;
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
	private readonly langService = inject(LangService);
	protected readonly lang = this.langService.lang;
	protected readonly locale = this.langService.locale;
	protected readonly graph = this.service.graph;
	protected readonly ENDPOINT = ENDPOINT;
	protected readonly GRAPH_IRI = GRAPH_IRI;
	protected readonly REPO_URL = REPO_URL;
	protected readonly editorLink =
		'https://lindas.admin.ch/sparql/#query=' +
		encodeURIComponent(this.service.query) +
		'&endpoint=' +
		encodeURIComponent(ENDPOINT);
}
