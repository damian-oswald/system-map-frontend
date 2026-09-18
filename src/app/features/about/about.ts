import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';

import { GraphService } from '../../core/graph.service';
import { DataFooter } from '../../shared/data-footer';
import { LangService, PickPipe } from '../../core/i18n';
import { CLS, ENDPOINT, GRAPH_IRI, KINDS, REPO_URL, RELATIONS } from '../../core/vocab';

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

@Component({
	selector: 'app-about',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'sm-routed' },
	imports: [TranslatePipe, MatIconModule, PickPipe, DataFooter],
	templateUrl: './about.html',
	styleUrl: './about.scss',
})
export class About {
	protected readonly graphService = inject(GraphService);
	private readonly langService = inject(LangService);
	protected readonly lang = this.langService.lang;
	protected readonly graph = this.graphService.graph;
	protected readonly ENDPOINT = ENDPOINT;
	protected readonly GRAPH_IRI = GRAPH_IRI;
	protected readonly REPO_URL = REPO_URL;
	protected readonly KINDS = KINDS;

	protected readonly prettyQuery = this.graphService.query
		.replace('CONSTRUCT{?s ?p ?o}WHERE{', 'CONSTRUCT { ?s ?p ?o }\nWHERE {\n  ')
		.replace('GRAPH<', 'GRAPH <')
		.replace('>{?s ?p ?o ', '> {\n    ?s ?p ?o\n    ')
		.replace(/}}$/, '\n  }\n}');
	protected readonly editorLink =
		'https://lindas.admin.ch/sparql/#query=' +
		encodeURIComponent(this.prettyQuery) +
		'&endpoint=' +
		encodeURIComponent(ENDPOINT);

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
