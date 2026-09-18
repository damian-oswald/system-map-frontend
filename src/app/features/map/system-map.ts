import {
	AfterViewInit,
	ChangeDetectionStrategy,
	Component,
	DestroyRef,
	ElementRef,
	NgZone,
	computed,
	effect,
	inject,
	signal,
	untracked,
	viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ObButtonDirective } from '@oblique/oblique';
import { TranslatePipe } from '@ngx-translate/core';
import { select } from 'd3-selection';
import { ZoomBehavior, ZoomTransform, zoom, zoomIdentity } from 'd3-zoom';

import { Entity, OrgType } from '../../core/graph.model';
import { GraphService } from '../../core/graph.service';
import { LangService, PickPipe, entityTitle, shortLabel } from '../../core/i18n';
import { badgeWidth, fitLabel, fontsVersion } from '../../core/text-fit';
import { KINDS, Kind, compactIri, expandIri } from '../../core/vocab';
import { DataFooter } from '../../shared/data-footer';
import { EntityChip, KIND_ICON, PageState } from '../../shared/ui';
import { ForceRequest, ForceResponse } from './force-layout';
import { Band, Column, NODE_H, NODE_W, TreeLink, layeredEdgePath, layoutLayers } from './layered-layout';
import {
	DEFAULT_LEVELS,
	DEFAULT_RELATIONS,
	LEVELS,
	Level,
	MapGraph,
	MapNode,
	MapOptions,
	MapView,
	ORG_TYPES,
	SELECTABLE_RELATIONS,
	buildMapGraph,
	representativeOf,
} from './map-model';

interface SceneNode {
	id: string;
	kind: Kind;
	x: number;
	y: number;
	r: number;
	label: string;
	title: string;
	members: number;
	orgType?: OrgType;
	major: boolean;
	w: number;
	depth: number;
	/** width of the merged-count badge, 0 if none */
	badgeW: number;
}

interface SceneEdge {
	id: string;
	s: string;
	o: string;
	d: string;
	w: number;
	dashed: boolean;
	key: string;
	hierarchy: boolean;
	kind?: Kind;
}

interface Scene {
	view: MapView;
	nodes: SceneNode[];
	edges: SceneEdge[];
	columns: Column[];
	bands: Band[];
	tree: TreeLink[];
	bounds: { x: number; y: number; w: number; h: number };
}

/** height of the floating control bar (incl. its offset) the fitted scene keeps clear of */
const BAR_INSET = 66;
const LEVEL_ICON: Record<Level, string> = { off: 'xmark', collapsed: 'collapse', detailed: 'expand' };
const COL_OF: Record<Kind, number> = { organization: 0, system: 1, service: 2, dataset: 3 };

@Component({
	selector: 'app-system-map',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'sm-routed' },
	imports: [
		TranslatePipe,
		MatButtonModule,
		MatAutocompleteModule,
		MatBadgeModule,
		MatButtonToggleModule,
		MatInputModule,
		MatCheckboxModule,
		MatFormFieldModule,
		MatSelectModule,
		MatIconModule,
		MatSlideToggleModule,
		MatTooltipModule,
		ObButtonDirective,
		RouterLink,
		EntityChip,
		PageState,
		PickPipe,
		DataFooter,
	],
	templateUrl: './system-map.html',
	styleUrl: './system-map.scss',
})
export class SystemMap implements AfterViewInit {
	private readonly graphService = inject(GraphService);
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	private readonly zone = inject(NgZone);
	private readonly destroyRef = inject(DestroyRef);
	protected readonly lang = inject(LangService).lang;
	protected readonly graph = this.graphService.graph;

	protected readonly KINDS = KINDS;
	protected readonly ORG_TYPES = ORG_TYPES;
	protected readonly LEVELS = LEVELS;
	protected readonly LEVEL_ICON = LEVEL_ICON;
	protected readonly KIND_ICON = KIND_ICON;
	protected readonly NODE_W = NODE_W;
	protected readonly NODE_H = NODE_H;

	// ---- options (initialised from the URL so every view is shareable)
	protected readonly view = signal<MapView>('network');
	protected readonly levels = signal<Record<Kind, Level>>({ ...DEFAULT_LEVELS });
	protected readonly orgTypes = signal(new Set<OrgType>(ORG_TYPES));
	protected readonly relations = signal(new Set<string>(DEFAULT_RELATIONS));
	protected readonly hideIsolated = signal(true);
	protected readonly subgraph = signal<string | null>(null);
	protected readonly focus = signal<string | null>(null);
	protected readonly hops = signal(1);

	// ---- interaction state
	protected readonly hovered = signal<string | null>(null);
	protected readonly selected = signal<string | null>(null);
	protected readonly query = signal('');
	protected readonly panelOpen = signal(false);
	protected readonly far = signal(false);
	protected readonly near = signal(false);
	protected readonly layoutBusy = signal(false);

	private readonly svgRef = viewChild<ElementRef<SVGSVGElement>>('svg');
	private readonly viewportRef = viewChild<ElementRef<SVGGElement>>('viewport');
	private readonly host = inject(ElementRef<HTMLElement>);
	private zoomBehavior?: ZoomBehavior<SVGSVGElement, unknown>;
	private transform: ZoomTransform = zoomIdentity;
	private worker?: Worker;
	private requestId = 0;
	private readonly forcePositions = signal<{ key: string; positions: ForceResponse['positions'] } | null>(null);
	private lastPositions: ForceResponse['positions'] = {};
	private fittedKey = '';

	protected readonly options = computed<MapOptions>(() => ({
		view: this.view(),
		levels: this.levels(),
		orgTypes: this.orgTypes(),
		relations: this.relations(),
		hideIsolated: this.hideIsolated(),
		subgraph: this.subgraph(),
		focus: this.focus(),
		hops: this.hops(),
	}));

	protected readonly mapGraph = computed<MapGraph | null>(() => {
		const g = this.graph();
		return g ? buildMapGraph(g, this.options()) : null;
	});

	/** identity of the current node/edge set – layout is recomputed only when this changes */
	private readonly structureKey = computed(() => {
		const mg = this.mapGraph();
		if (!mg) return '';
		return `${mg.nodes.length}:${mg.edges.length}:${mg.nodes.map((n) => n.id).join(',').length}:${hash(
			mg.edges.map((e) => e.id).join(),
		)}:${hash(mg.nodes.map((n) => n.id).join())}`;
	});

	protected readonly scene = computed<Scene | null>(() => {
		const mg = this.mapGraph();
		if (!mg) return null;
		const lang = this.lang();
		const view = this.view();
		fontsVersion(); // re-fit labels once web fonts are loaded
		const focused = this.focusRep();
		const label = (n: MapNode): string => shortLabel(n.entity, lang, view === 'layers' ? 31 : 26);
		const nodes: SceneNode[] = [];
		const edges: SceneEdge[] = [];
		let columns: Column[] = [];
		let bands: Band[] = [];
		let tree: TreeLink[] = [];
		let bounds = { x: 0, y: 0, w: 1, h: 1 };

		if (view === 'layers') {
			const layout = layoutLayers(mg, label);
			columns = layout.columns;
			bands = layout.bands;
			tree = layout.tree;
			bounds = { x: -20, y: 0, w: layout.width + 90, h: layout.height };
			// labels are fitted to the (indentation-dependent) node width, minus the count badge: name → abbreviation →
			// truncated name; the focused node is bold and measured as such
			for (const n of mg.nodes) {
				const bw = n.members > 1 ? badgeWidth(n.members) : 0;
				const avail = n.w - 20 - (bw ? bw + 8 : 0);
				nodes.push(this.sceneNode(n, fitLabel(n.entity, lang, avail, 12, focused === n.id ? 700 : 400), 0, bw));
			}
			for (const e of mg.edges) {
				if (e.hierarchy) continue; // drawn as tree connectors
				edges.push({
					id: e.id,
					s: e.s,
					o: e.o,
					key: e.key,
					d: layeredEdgePath(mg.nodeById.get(e.s)!, mg.nodeById.get(e.o)!),
					w: edgeWidth(e.weight),
					dashed: e.dashed,
					hierarchy: false,
				});
			}
		} else {
			const fp = this.forcePositions();
			if (!fp || fp.key !== this.structureKey()) return null;
			let minX = Infinity,
				minY = Infinity,
				maxX = -Infinity,
				maxY = -Infinity;
			for (const n of mg.nodes) {
				const p = fp.positions[n.id] ?? [0, 0];
				n.x = p[0];
				n.y = p[1];
				const r = nodeRadius(n);
				minX = Math.min(minX, n.x - r);
				minY = Math.min(minY, n.y - r);
				maxX = Math.max(maxX, n.x + r + 120);
				maxY = Math.max(maxY, n.y + r);
				nodes.push(this.sceneNode(n, label(n), r));
			}
			for (const e of mg.edges) {
				const a = mg.nodeById.get(e.s)!;
				const b = mg.nodeById.get(e.o)!;
				edges.push({
					id: e.id,
					s: e.s,
					o: e.o,
					key: e.key,
					d: `M${a.x},${a.y}L${b.x},${b.y}`,
					w: edgeWidth(e.weight),
					dashed: e.dashed,
					hierarchy: e.hierarchy,
					kind: e.hierarchy ? a.kind : undefined,
				});
			}
			bounds = { x: minX - 20, y: minY - 20, w: maxX - minX + 40, h: maxY - minY + 40 };
		}
		return { view, nodes, edges, columns, bands, tree, bounds };
	});

	/** node that drives highlighting: hover wins over the pinned selection */
	protected readonly active = computed(() => {
		const id = this.hovered() ?? this.selected();
		return id && this.mapGraph()?.nodeById.has(id) ? id : null;
	});
	protected readonly highlight = computed(() => {
		const a = this.active();
		const mg = this.mapGraph();
		if (!a || !mg) return null;
		return new Set([a, ...(mg.adjacency.get(a) ?? [])]);
	});

	/** search hits among the nodes currently on the map (not among hidden or merged elements) */
	protected readonly matches = computed(() => {
		const q = normalize(this.query());
		const mg = this.mapGraph();
		if (q.length < 2 || !mg) return [] as Entity[];
		const lang = this.lang();
		const hits: { e: Entity; score: number }[] = [];
		for (const n of mg.nodes) {
			const e = n.entity;
			const name = normalize(entityTitle(e, lang));
			const i = name.indexOf(q);
			const all = normalize(Object.values(e.name).join(' ') + ' ' + (e.abbreviation ?? ''));
			if (i >= 0) hits.push({ e, score: i === 0 ? 0 : 1 });
			else if (all.includes(q)) hits.push({ e, score: 2 });
		}
		return hits
			.sort((a, b) => a.score - b.score || entityTitle(a.e, lang).length - entityTitle(b.e, lang).length)
			.slice(0, 12)
			.map((h) => h.e);
	});
	/** suggestions grouped by class, in the fixed class order */
	protected readonly matchGroups = computed(() => {
		const m = this.matches();
		return KINDS.map((kind) => ({ kind, items: m.filter((e) => e.kind === kind) })).filter((g) => g.items.length);
	});
	protected readonly matchIds = computed(() => {
		const mg = this.mapGraph();
		const q = normalize(this.query());
		if (!mg || q.length < 2) return null;
		const set = new Set<string>();
		for (const n of mg.nodes) {
			if (normalize(Object.values(n.entity.name).join(' ') + ' ' + (n.entity.abbreviation ?? '')).includes(q))
				set.add(n.id);
		}
		return set;
	});

	protected readonly selectedEntity = computed(() => {
		const id = this.selected();
		return id ? (this.graph()?.entities.get(id) ?? null) : null;
	});
	protected readonly selectedNode = computed(() => {
		const id = this.selected();
		return id ? (this.mapGraph()?.nodeById.get(id) ?? null) : null;
	});
	/** Relations of the selected node as shown in the map (after collapse), grouped by relation & direction. */
	protected readonly selectedRelations = computed(() => {
		const id = this.selected();
		const mg = this.mapGraph();
		const g = this.graph();
		if (!id || !mg || !g) return [];
		const groups = new Map<string, { key: string; out: boolean; items: Entity[] }>();
		for (const e of mg.edges) {
			if (e.s !== id && e.o !== id) continue;
			const out = e.s === id;
			const k = `${e.key}|${out}`;
			if (!groups.has(k)) groups.set(k, { key: e.key, out, items: [] });
			groups.get(k)!.items.push(g.entities.get(out ? e.o : e.s)!);
		}
		return [...groups.values()].sort((a, b) => b.items.length - a.items.length);
	});
	protected readonly mergedChildren = computed(() => {
		const e = this.selectedEntity();
		const g = this.graph();
		if (!e || !g || this.levels()[e.kind as Kind] !== 'collapsed') return [];
		return [...g.entities.values()].filter((o) => o.kind === e.kind && o.root === e.id && o.id !== e.id);
	});

	protected readonly counts = computed(() => {
		const g = this.graph();
		const out = {
			kinds: {} as Record<string, number>,
			orgTypes: {} as Record<string, number>,
			relations: {} as Record<string, number>,
		};
		if (!g) return out;
		for (const k of KINDS) out.kinds[k] = g.byKind[k].length;
		for (const o of g.byKind.organization) out.orgTypes[o.orgType!] = (out.orgTypes[o.orgType!] ?? 0) + 1;
		for (const r of g.relations) out.relations[r.key] = (out.relations[r.key] ?? 0) + 1;
		return out;
	});
	/** relations the user can toggle (hierarchy relations are steered by the class level) */
	protected readonly relationOptions = computed(() => {
		const c = this.counts().relations;
		return SELECTABLE_RELATIONS.filter((r) => c[r.key]);
	});
	protected readonly relationList = computed(() => [...this.relations()]);
	/** number of filters that deviate from the defaults (shown as a badge on the filter button) */
	protected readonly activeFilterCount = computed(() => {
		const levels = this.levels();
		let n = KINDS.filter((k) => levels[k] !== DEFAULT_LEVELS[k]).length;
		if (this.orgTypes().size !== ORG_TYPES.length) n++;
		if (this.relationOptions().some((r) => !this.relations().has(r.key))) n++;
		if (!this.hideIsolated()) n++;
		if (this.subgraph()) n++;
		return n;
	});
	protected readonly orgTypeList = computed(() => [...this.orgTypes()]);
	/** map node that represents the focused element (its top-level organization when collapsed) */
	protected readonly focusRep = computed(() => {
		const f = this.focus();
		const e = f ? this.graph()?.entities.get(f) : undefined;
		if (!e) return null;
		return this.repOf(e);
	});
	protected readonly focusEntity = computed(() => {
		const f = this.focus();
		return f ? (this.graph()?.entities.get(f) ?? null) : null;
	});
	protected readonly subgraphs = computed(() => this.graph()?.collections ?? []);

	constructor() {
		this.readUrl();

		// keep the URL in sync (replaceUrl: no history spam)
		effect(() => {
			const params = this.urlParams();
			untracked(() => this.router.navigate([], { relativeTo: this.route, queryParams: params, replaceUrl: true }));
		});

		// network view: compute the force layout in a worker whenever the structure changes
		effect(() => {
			const key = this.structureKey();
			const mg = this.mapGraph();
			if (this.view() !== 'network' || !mg) return;
			untracked(() => {
				if (this.forcePositions()?.key === key) return;
				this.runForce(mg, key);
			});
		});

		// fit the viewport when the structure changes
		effect(() => {
			const scene = this.scene();
			const key = `${this.view()}|${this.structureKey()}`;
			if (!scene || !this.zoomBehavior) return;
			if (key !== this.fittedKey) {
				this.fittedKey = key;
				queueMicrotask(() => this.fit(false));
			}
		});

		this.destroyRef.onDestroy(() => this.worker?.terminate());
	}

	ngAfterViewInit(): void {
		this.setupZoom();
		// the map fills the scrollable area between Oblique's header and footer
		const wrapper = document.querySelector('.ob-master-layout-wrapper');
		if (wrapper) {
			const ro = new ResizeObserver(([e]) => {
				const h = Math.round(e.target.clientHeight);
				if (h) this.host.nativeElement.style.setProperty('--map-h', `${h}px`);
			});
			ro.observe(wrapper);
			this.destroyRef.onDestroy(() => ro.disconnect());
		}
	}

	// ---------------------------------------------------------------------------------------------- options

	protected setLevel(k: Kind, level: Level): void {
		this.levels.update((l) => ({ ...l, [k]: level }));
		if (level === 'off' && this.selected() && this.graph()?.entities.get(this.selected()!)?.kind === k)
			this.selected.set(null);
	}
	protected setOrgTypes(types: OrgType[]): void {
		this.orgTypes.set(new Set(types));
	}
	protected setRelations(keys: string[]): void {
		this.relations.set(new Set(keys));
	}
	protected setSubgraph(id: string): void {
		this.subgraph.set(id || null);
		this.selected.set(null);
	}
	protected reset(): void {
		this.levels.set({ ...DEFAULT_LEVELS });
		this.orgTypes.set(new Set(ORG_TYPES));
		this.relations.set(new Set(DEFAULT_RELATIONS));
		this.hideIsolated.set(true);
		this.subgraph.set(null);
		this.focus.set(null);
		this.hops.set(1);
		this.selected.set(null);
		this.query.set('');
	}

	protected focusOn(id: string): void {
		const g = this.graph();
		const e = g?.entities.get(id);
		if (!e) return;
		// make sure the focused node's class is visible
		const kind = e.kind as Kind;
		if (this.levels()[kind] === 'off') this.levels.update((l) => ({ ...l, [kind]: 'detailed' }));
		this.focus.set(id);
		this.selected.set(this.repOf(e));
	}
	protected clearFocus(): void {
		this.focus.set(null);
	}

	// ---------------------------------------------------------------------------------------------- interaction

	protected onNodeClick(id: string, ev: Event): void {
		ev.stopPropagation();
		this.selected.set(this.selected() === id ? null : id);
	}
	protected onBackgroundClick(): void {
		this.selected.set(null);
	}
	protected onNodeKey(id: string, ev: KeyboardEvent): void {
		if (ev.key === 'Enter' || ev.key === ' ') {
			ev.preventDefault();
			this.selected.set(id);
		}
	}

	protected readonly noDisplay = (): string => '';

	protected pickSearch(e: Entity): void {
		this.query.set('');
		this.selected.set(e.id);
		queueMicrotask(() => this.centerOn(e.id));
	}

	protected isHl(id: string): boolean {
		return this.highlight()?.has(id) ?? false;
	}
	protected edgeState(e: SceneEdge): 'hl' | 'dim' | '' {
		const a = this.active();
		if (!a) return '';
		return e.s === a || e.o === a ? 'hl' : 'dim';
	}

	// ---------------------------------------------------------------------------------------------- zoom

	protected zoomBy(f: number): void {
		const svg = this.svgRef()?.nativeElement;
		if (svg && this.zoomBehavior) this.zoomBehavior.scaleBy(select(svg), f);
	}

	protected fit(animate = true): void {
		const svg = this.svgRef()?.nativeElement;
		const scene = this.scene();
		if (!svg || !scene || !this.zoomBehavior) return;
		const rect = svg.getBoundingClientRect();
		const height = rect.height;
		// keep the fitted scene clear of the details drawer on wide screens
		const width = scene.view === 'network' && this.selected() && rect.width > 1000 ? rect.width - 400 : rect.width;
		if (!width || !height) return;
		const b = scene.bounds;
		let k: number;
		let tx: number;
		let ty: number;
		if (scene.view === 'layers') {
			// readable zoom (never below 0.74 unless the width forces it), start at the top: tall maps are scrolled
			k = Math.min(1, (width - 48) / b.w, (height - BAR_INSET - 24) / b.h);
			k = Math.max(k, Math.min(0.74, (width - 48) / b.w));
			tx = b.w * k < width ? (width - b.w * k) / 2 - b.x * k : 24 - b.x * k;
			ty = b.h * k < height - BAR_INSET ? BAR_INSET + (height - BAR_INSET - b.h * k) / 2 : BAR_INSET;
		} else {
			k = Math.min(1.4, (width - 40) / b.w, (height - BAR_INSET - 40) / b.h);
			tx = (width - b.w * k) / 2 - b.x * k;
			ty = BAR_INSET + (height - BAR_INSET - b.h * k) / 2 - b.y * k;
		}
		this.applyTransform(zoomIdentity.translate(tx, ty).scale(k), animate);
	}

	private centerOn(id: string): void {
		const svg = this.svgRef()?.nativeElement;
		const n = this.scene()?.nodes.find((x) => x.id === id);
		if (!svg || !n) return;
		const { width, height } = svg.getBoundingClientRect();
		const k = Math.max(this.transform.k, 0.9);
		const cx = this.view() === 'layers' ? n.x + n.w / 2 : n.x;
		const cy = this.view() === 'layers' ? n.y + NODE_H / 2 : n.y;
		this.applyTransform(zoomIdentity.translate(width / 2 - cx * k, height / 2 - cy * k).scale(k), true);
	}

	private applyTransform(t: ZoomTransform, animate: boolean): void {
		const svg = this.svgRef()?.nativeElement;
		if (!svg || !this.zoomBehavior) return;
		const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (!animate || reduce) {
			this.zoomBehavior.transform(select(svg), t);
			return;
		}
		const from = this.transform;
		const start = performance.now();
		const dur = 380;
		const step = (now: number): void => {
			const p = Math.min(1, (now - start) / dur);
			const e = 1 - Math.pow(1 - p, 3);
			const k = from.k + (t.k - from.k) * e;
			const x = from.x + (t.x - from.x) * e;
			const y = from.y + (t.y - from.y) * e;
			this.zoomBehavior!.transform(select(svg), zoomIdentity.translate(x, y).scale(k));
			if (p < 1) requestAnimationFrame(step);
		};
		this.zone.runOutsideAngular(() => requestAnimationFrame(step));
	}

	private setupZoom(): void {
		const svg = this.svgRef()?.nativeElement;
		const vp = this.viewportRef()?.nativeElement;
		if (!svg || !vp) return;
		this.zone.runOutsideAngular(() => {
			this.zoomBehavior = zoom<SVGSVGElement, unknown>()
				.scaleExtent([0.08, 4])
				// plain wheel pans (like a document), ctrl/⌘ + wheel or pinch zooms
				.filter((ev: Event) => {
					if (ev.type === 'wheel') return (ev as WheelEvent).ctrlKey || (ev as WheelEvent).metaKey;
					return !(ev as MouseEvent).button && ev.type !== 'dblclick';
				})
				.on('zoom', (ev: { transform: ZoomTransform }) => {
					this.transform = ev.transform;
					vp.setAttribute('transform', ev.transform.toString());
					svg.style.setProperty('--zk', String(Math.min(1, ev.transform.k)));
					const far = ev.transform.k < 0.38;
					const near = ev.transform.k >= 1.25;
					if (far !== this.far() || near !== this.near())
						this.zone.run(() => {
							this.far.set(far);
							this.near.set(near);
						});
				});
			const sel = select(svg);
			sel.call(this.zoomBehavior);
			svg.addEventListener(
				'wheel',
				(ev) => {
					if (ev.ctrlKey || ev.metaKey) return;
					ev.preventDefault();
					const k = this.transform.k;
					this.zoomBehavior!.translateBy(sel, -ev.deltaX / k, -ev.deltaY / k);
				},
				{ passive: false },
			);
		});
		// a first fit in case the scene was ready before the view
		if (this.scene()) {
			this.fittedKey = `${this.view()}|${this.structureKey()}`;
			queueMicrotask(() => this.fit(false));
		}
	}

	// ---------------------------------------------------------------------------------------------- layout

	private runForce(mg: MapGraph, key: string): void {
		if (!this.worker) {
			this.worker = new Worker(new URL('./force.worker', import.meta.url), { type: 'module' });
			this.worker.onmessage = ({ data }: MessageEvent<ForceResponse>) => {
				if (data.requestId !== this.requestId) return;
				this.lastPositions = { ...this.lastPositions, ...data.positions };
				this.forcePositions.set({ key: this.pendingKey, positions: data.positions });
				this.layoutBusy.set(false);
			};
		}
		this.pendingKey = key;
		this.layoutBusy.set(true);
		const req: ForceRequest = {
			requestId: ++this.requestId,
			nodes: mg.nodes.map((n) => {
				const p = this.lastPositions[n.id];
				return { id: n.id, col: COL_OF[n.kind], r: nodeRadius(n), x: p?.[0], y: p?.[1] };
			}),
			links: mg.edges.map((e) => ({ source: e.s, target: e.o, hier: e.hierarchy })),
		};
		this.worker.postMessage(req);
	}
	private pendingKey = '';

	private sceneNode(n: MapNode, label: string, r: number, badgeW = 0): SceneNode {
		return {
			id: n.id,
			kind: n.kind,
			x: n.x,
			y: n.y,
			r,
			label,
			title: entityTitle(n.entity, this.lang()),
			members: n.members,
			orgType: n.orgType,
			major: n.degree >= 6 || n.members > 3,
			w: n.w,
			depth: n.depth,
			badgeW,
		};
	}

	/** node that represents an element on the map (its top-level element when the class is collapsed) */
	private repOf(e: Entity): string {
		const g = this.graph();
		return g ? representativeOf(g, e.id, this.levels()) : e.id;
	}

	// ---------------------------------------------------------------------------------------------- URL state

	private urlParams(): Record<string, string | null> {
		const levels = this.levels();
		const orgTypes = this.orgTypes();
		const rels = this.relations();
		const sameSet = (a: Set<string>, b: string[]): boolean => a.size === b.length && b.every((x) => a.has(x));
		return {
			view: this.view() === 'network' ? null : this.view(),
			levels:
				KINDS.filter((k) => levels[k] !== DEFAULT_LEVELS[k])
					.map((k) => `${k}:${levels[k]}`)
					.join(',') || null,
			orgs: sameSet(orgTypes, ORG_TYPES) ? null : [...orgTypes].join(',') || 'none',
			rels: sameSet(rels, DEFAULT_RELATIONS) ? null : [...rels].join(',') || 'none',
			isolated: this.hideIsolated() ? null : '1',
			sub: this.subgraph() ? compactIri(this.subgraph()!) : null,
			focus: this.focus() ? compactIri(this.focus()!) : null,
			hops: this.hops() === 1 ? null : String(this.hops()),
		};
	}

	private readUrl(): void {
		const q = this.route.snapshot.queryParamMap;
		const list = (k: string): string[] | null => {
			const v = q.get(k);
			return v === null ? null : v === 'none' ? [] : v.split(',').filter(Boolean);
		};
		if (q.get('view') === 'layers') this.view.set('layers');
		const levels = list('levels');
		if (levels) {
			const next = { ...DEFAULT_LEVELS };
			for (const item of levels) {
				const [k, v] = item.split(':');
				if ((KINDS as readonly string[]).includes(k) && (LEVELS as string[]).includes(v)) next[k as Kind] = v as Level;
			}
			this.levels.set(next);
		}
		const orgs = list('orgs');
		if (orgs) this.orgTypes.set(new Set(orgs.filter((o): o is OrgType => (ORG_TYPES as string[]).includes(o))));
		const rels = list('rels');
		if (rels) this.relations.set(new Set(rels));
		if (q.get('isolated') === '1') this.hideIsolated.set(false);
		if (q.get('sub')) this.subgraph.set(expandIri(q.get('sub')!));
		if (q.get('focus')) {
			const id = expandIri(q.get('focus')!);
			this.focus.set(id);
			this.selected.set(id);
		}
		const hops = Number(q.get('hops'));
		if (hops >= 1 && hops <= 3) this.hops.set(hops);
	}
}

function normalize(s: string): string {
	return s
		.toLowerCase()
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.trim();
}

function nodeRadius(n: MapNode): number {
	return Math.min(22, 5 + Math.sqrt(n.degree) * 2.2 + (n.members > 1 ? Math.sqrt(n.members) : 0));
}

function edgeWidth(weight: number): number {
	return Math.min(5, 1 + Math.log2(weight));
}

function hash(s: string): number {
	let h = 0;
	for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
	return h;
}
