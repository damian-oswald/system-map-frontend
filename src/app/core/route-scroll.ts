import { DOCUMENT } from '@angular/common';
import {
	EnvironmentProviders,
	Injectable,
	Injector,
	afterNextRender,
	inject,
	provideEnvironmentInitializer,
} from '@angular/core';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';

/**
 * Scroll position across navigations. Oblique's master layout scrolls its own wrapper, not the window, so the router's
 * in-memory scrolling (which scrolls the window) has no effect here. This does the equivalent on the element that
 * actually scrolls:
 *  - another page (a different route path, e.g. an element's page) opens at the top,
 *  - back and forward return to where the reader was,
 *  - a change of query parameters alone (filters, sort, page) keeps the position.
 */
@Injectable({ providedIn: 'root' })
export class RouteScroll {
	private readonly router = inject(Router);
	private readonly document = inject(DOCUMENT);
	private readonly injector = inject(Injector);
	/** scroll position per navigation id, for back and forward */
	private readonly positions = new Map<number, number>();
	/** id and path of the last successful navigation */
	private lastId = 0;
	private lastPath = '';
	/** on back/forward, the id of the navigation whose position to restore */
	private restoreId: number | null = null;

	constructor() {
		this.router.events.subscribe((e) => {
			if (e instanceof NavigationStart) {
				this.positions.set(this.lastId, this.scroller().scrollTop);
				this.restoreId = e.navigationTrigger === 'popstate' ? (e.restoredState?.navigationId ?? null) : null;
			} else if (e instanceof NavigationEnd) {
				const path = e.urlAfterRedirects.split(/[?#]/)[0];
				let top: number | null = null;
				if (this.restoreId !== null) top = this.positions.get(this.restoreId) ?? 0;
				else if (this.lastPath && path !== this.lastPath) top = 0;
				this.lastId = e.id;
				this.lastPath = path;
				// once the routed component has rendered
				if (top !== null) {
					afterNextRender(
						{ write: () => this.scroller().scrollTo({ top, behavior: 'instant' }) },
						{ injector: this.injector },
					);
				}
			}
		});
	}

	/** the element that scrolls the routed page: the nearest scrolling ancestor of the router outlet, else the window */
	private scroller(): Element {
		const view = this.document.defaultView;
		let el = this.document.querySelector('router-outlet')?.parentElement ?? null;
		for (; el && view; el = el.parentElement) {
			const overflow = view.getComputedStyle(el).overflowY;
			if (overflow === 'auto' || overflow === 'scroll') return el;
		}
		return this.document.scrollingElement ?? this.document.documentElement;
	}
}

/** starts [[RouteScroll]] with the application */
export function provideRouteScroll(): EnvironmentProviders {
	return provideEnvironmentInitializer(() => void inject(RouteScroll));
}
