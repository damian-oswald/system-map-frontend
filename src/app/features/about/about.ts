import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ObExternalLinkDirective } from '@oblique/oblique';

import { GraphService } from '../../core/graph.service';
import { LangService, PickPipe } from '../../core/i18n';
import { CLS, RELATIONS, REPO_URL } from '../../core/vocab';
import { DataFooter } from '../../shared/data-footer';

/** Classes explained in the glossary, in display order, with the class colour they map to. */
const GLOSSARY: { iri: string; kind: string }[] = [
	{ iri: CLS.organization, kind: 'organization' },
	{ iri: CLS.federal, kind: 'organization' },
	{ iri: CLS.cantonal, kind: 'organization' },
	{ iri: CLS.private, kind: 'organization' },
	{ iri: CLS.system, kind: 'system' },
	{ iri: CLS.fmis, kind: 'system' },
	{ iri: CLS.service, kind: 'service' },
	{ iri: CLS.dataset, kind: 'dataset' },
	{ iri: CLS.masterData, kind: 'dataset' },
	{ iri: CLS.personalData, kind: 'dataset' },
	{ iri: CLS.sensitiveData, kind: 'dataset' },
];

/** "Further information" – title and description come from `about.links.<key>` / `<key>Desc` */
const LINKS: { key: string; url: string }[] = [
	{ key: 'repo', url: REPO_URL },
	{ key: 'wiki', url: `${REPO_URL}/wiki` },
	{ key: 'issues', url: `${REPO_URL}/issues` },
	{ key: 'project', url: 'https://blw-ofag-ufag.github.io/system-map' },
	{ key: 'lindas', url: 'https://lindas.admin.ch' },
	{ key: 'oblique', url: 'https://oblique.bit.admin.ch' },
];

@Component({
	selector: 'app-about',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'sm-routed' },
	imports: [TranslatePipe, PickPipe, DataFooter, ObExternalLinkDirective],
	templateUrl: './about.html',
	styleUrl: './about.scss',
})
export class About {
	private readonly graphService = inject(GraphService);
	protected readonly lang = inject(LangService).lang;
	protected readonly graph = this.graphService.graph;
	protected readonly LINKS = LINKS;

	protected readonly classes = computed(() => {
		const g = this.graph();
		if (!g) return [];
		return GLOSSARY.filter((c) => g.classes.has(c.iri)).map((c) => ({ ...c, info: g.classes.get(c.iri)! }));
	});
	protected readonly relations = computed(() => {
		const g = this.graph();
		if (!g) return [];
		const count = new Map<string, number>();
		for (const r of g.relations) count.set(r.key, (count.get(r.key) ?? 0) + 1);
		return RELATIONS.filter((r) => count.get(r.key)).map((r) => ({
			key: r.key,
			info: g.relationInfo.get(r.key)!,
			count: count.get(r.key)!,
		}));
	});
}
