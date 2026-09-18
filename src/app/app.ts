import { Component, inject } from '@angular/core';
import { ObINavigationLink, ObMasterLayoutModule } from '@oblique/oblique';
import { TranslatePipe } from '@ngx-translate/core';

import { GraphService } from './core/graph.service';

@Component({
	selector: 'app-root',
	imports: [ObMasterLayoutModule, TranslatePipe],
	template: `
		<ob-master-layout [navigation]="navigation">
			<ng-container obHeaderTitle>
				<span class="app-title">{{ 'app.title' | translate }}</span>
			</ng-container>
			<ng-container obFooterInfo>
				<p>
					{{ 'app.footer.operator' | translate }}
				</p>
			</ng-container>
		</ob-master-layout>
	`,
})
export class App {
	protected readonly graphService = inject(GraphService);
	protected readonly navigation: ObINavigationLink[] = [
		{ url: 'dashboard', label: 'nav.dashboard' },
		{ url: 'map', label: 'nav.map' },
		{ url: 'catalog', label: 'nav.catalog' },
		{ url: 'about', label: 'nav.about' },
	];
}
