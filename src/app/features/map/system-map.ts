import {
	AfterViewInit,
	ChangeDetectionStrategy,
	Component,
	DestroyRef,
	ElementRef,
	NgZone,
	booleanAttribute,
	computed,
	effect,
	inject,
	input,
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
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { select } from 'd3-selection';
import { ZoomBehavior, ZoomTransform, zoom, zoomIdentity } from 'd3-zoom';

import { AddressService } from '../../core/address.service';
import { Entity, OrgType } from '../../core/graph.model';
import { GraphService } from '../../core/graph.service';
import { LabelPipe, LangService, PickPipe, entityTitle, pick, shortLabel } from '../../core/i18n';
import { badgeWidth, fitLabel, fontsVersion, textWidth } from '../../core/text-fit';
import { KINDS, Kind, compactIri, expandIri } from '../../core/vocab';
import { DataFooter } from '../../shared/data-footer';
import { CHIP_ICON, KIND_ICON, ORG_ICON, PageState, entityIcon } from '../../shared/ui';
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
	importanceRank,
	representativeOf,
} from './map-model';

interface SceneNode {
	id: string;
	kind: Kind;
	x: number;
	y: number;
	r: number;
	/** class or subclass icon (id in Oblique's sprite) */
	icon: string;
	label: string;
	title: string;
	members: number;
	/** network view, merged node: the count badge at the bottom right of the border, scaled with the node */
	cb?: { r: number; w: number; fs: number };
	orgType?: OrgType;
	/** place in the importance order of the current view (0 = most important) */
	rank: number;
	/** width of the label on screen (network view) */
	lw: number;
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
	key: string;
	hierarchy: boolean;
	kind?: Kind;
}

/** an edge of the selected node, drawn with an arrow and its relation name once zoomed in enough */
interface SelEdge {
	id: string;
	d: string;
	/** same stroke width as the plain edge underneath, so selecting never changes the line */
	w: number;
	/** tip of the arrowhead and the edge's direction in degrees */
	x2: number;
	y2: number;
	angle: number;
	mx: number;
	my: number;
	label: string;
	/** label width on screen */
	lw: number;
	hierarchy: boolean;
	kind?: Kind;
}

interface Scene {
	view: MapView;
	nodes: SceneNode[];
	/** network view: nodes from least to most important – labels are painted in this order, so important ones lie on top */
	labelOrder: SceneNode[];
	edges: SceneEdge[];
	columns: Column[];
	bands: Band[];
	tree: TreeLink[];
	bounds: { x: number; y: number; w: number; h: number };
}

/** elements linked in a relation sentence before "and n more" */
const SENTENCE_MAX = 5;

interface SentencePart {
	text?: string;
	entity?: Entity;
}

interface Sentence {
	key: string;
	parts: SentencePart[];
}

/** height of the floating control bar (incl. its offset) the fitted scene keeps clear of */
const BAR_INSET = 66;
/** embedded: the number of steps whose neighbourhood comes closest to this many elements is preselected */
const IDEAL_CONTEXT_NODES = 20;
/** network view: labels shown when the scene is fitted; the budget grows with the square of the zoom factor */
const LABELS_AT_FIT = 14;
/** network view: label font size on screen and the height of its collision box */
const LABEL_PX = 12.5;
const LABEL_H = 15;
/** edge labels of the selected node: font size, box height, and the zoom factor (relative to the fit) they need */
const EDGE_LABEL_PX = 10.5;
const EDGE_LABEL_H = 13;
const EDGE_DETAIL_ZOOM = 1.4;
/** network view: top-level nodes at least this large carry their class icon, drawn this many times the radius wide */
const ICON_MIN_R = 10;
const ICON_SCALE = 1.3;
/** network view: a top-level element (no visible parent) is drawn this much larger than the formula says */
const TOP_LEVEL_BONUS = 1.15;
/** largest zoom step one wheel event may take (log2 of the factor): a mouse wheel notch zooms by about 15 % */
const WHEEL_STEP_MAX = 0.2;
/** hovering a node highlights its neighbourhood only after this pause, so brushing over nodes stays calm */
/** ms the pointer must rest on a node before its neighbourhood lights up and the rest of the map dims */
const HOVER_DELAY = 450;
const LEVEL_ICON: Record<Level, string> = { off: 'xmark', collapsed: 'collapse', detailed: 'expand' };
const COL_OF: Record<Kind, number> = { organization: 0, system: 1, service: 2, dataset: 3 };

@Component({
	selector: 'app-system-map',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { '[class.sm-routed]': '!embedded()', '[class.embedded]': 'embedded()' },
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
		LabelPipe,
		PageState,
		PickPipe,
		DataFooter,
	],
	templateUrl: './system-map.html',
	styleUrl: './system-map.scss',
})
export class SystemMap implements AfterViewInit {
	private readonly graphService = inject(GraphService);
	private readonly addressService = inject(AddressService);
	private readonly route = inject(ActivatedRoute);
	private readonly router = inject(Router);
	private readonly zone = inject(NgZone);
	private readonly translate = inject(TranslateService);
	private readonly destroyRef = inject(DestroyRef);
	protected readonly lang = inject(LangService).lang;
	protected readonly graph = this.graphService.graph;

	/**
	 * Embedded as the "context" panel of a detail page: the network view only, the focus fixed on `focusKey`, no
	 * controls, drawer or URL sync – clicking another element opens its page.
	 */
	readonly embedded = input(false, { transform: booleanAttribute });
	/** compact IRI of the element to focus on (embedded mode) */
	readonly focusKey = input<string | undefined>(undefined);

	protected readonly KINDS = KINDS;
	protected readonly ORG_TYPES = ORG_TYPES;
	protected readonly LEVELS = LEVELS;
	protected readonly LEVEL_ICON = LEVEL_ICON;
	protected readonly KIND_ICON = KIND_ICON;
	protected readonly CHIP_ICON = CHIP_ICON;
	protected readonly ORG_ICON = ORG_ICON;
	protected readonly NODE_W = NODE_W;
	protected readonly NODE_H = NODE_H;
	protected readonly ICON_MIN_R = ICON_MIN_R;
	protected readonly ICON_SCALE = ICON_SCALE;

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
	/** zoom factor at which the scene was last fitted – the label budget is relative to it */
	private fitScale = 1;
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
		const ranks = importanceRank(mg);
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
			// labels are fitted to the (indentation-dependent) node width, minus the icon and the count badge: name →
			// abbreviation → truncated name; the focused node is bold and measured as such
			for (const n of mg.nodes) {
				const bw = n.members > 1 ? badgeWidth(n.members) : 0;
				const avail = n.w - 36 - (bw ? bw + 8 : 0);
				nodes.push(this.sceneNode(n, fitLabel(n.entity, lang, avail, 12, focused === n.id ? 700 : 500), 0, ranks, bw));
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
				nodes.push(this.sceneNode(n, label(n), r, ranks));
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
					hierarchy: e.hierarchy,
					kind: e.hierarchy ? a.kind : undefined,
				});
			}
			bounds = { x: minX - 20, y: minY - 20, w: maxX - minX + 40, h: maxY - minY + 40 };
		}
		const labelOrder = view === 'network' ? [...nodes].sort((a, b) => b.rank - a.rank) : [];
		return { view, nodes, labelOrder, edges, columns, bands, tree, bounds };
	});

	/** the selected node's edges, shortened to end outside the circles so the arrowheads show, with their relation names */
	protected readonly selEdges = computed<SelEdge[]>(() => {
		const sc = this.scene();
		const sel = this.selected();
		const g = this.graph();
		if (!sc || sc.view !== 'network' || !sel || !g) return [];
		const lang = this.lang();
		const byId = new Map(sc.nodes.map((n) => [n.id, n]));
		const out: SelEdge[] = [];
		for (const e of sc.edges) {
			if (e.s !== sel && e.o !== sel) continue;
			const a = byId.get(e.s);
			const b = byId.get(e.o);
			if (!a || !b) continue;
			const dx = b.x - a.x;
			const dy = b.y - a.y;
			const len = Math.hypot(dx, dy) || 1;
			const ux = dx / len;
			const uy = dy / len;
			const x1 = a.x + ux * (a.r + 2);
			const y1 = a.y + uy * (a.r + 2);
			const x2 = b.x - ux * (b.r + 4);
			const y2 = b.y - uy * (b.r + 4);
			const label = pick(g.relationInfo.get(e.key)?.name, lang) || e.key;
			out.push({
				id: e.id,
				d: `M${x1},${y1}L${x2},${y2}`,
				w: e.hierarchy ? 1.6 : e.w,
				x2,
				y2,
				angle: (Math.atan2(uy, ux) * 180) / Math.PI,
				mx: (x1 + x2) / 2,
				my: (y1 + y2) / 2,
				label,
				lw: textWidth(label, EDGE_LABEL_PX),
				hierarchy: e.hierarchy,
				kind: e.kind,
			});
		}
		return out;
	});

	protected readonly selEdgeIds = computed(() => new Set(this.selEdges().map((e) => e.id)));

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
	/** postal address of the selected organization (from the registers it is linked to), once loaded */
	protected readonly address = computed(() => {
		const e = this.selectedEntity();
		return e?.kind === 'organization' ? this.addressService.addresses().get(e.id) : undefined;
	});
	protected readonly selectedNode = computed(() => {
		const id = this.selected();
		return id ? (this.mapGraph()?.nodeById.get(id) ?? null) : null;
	});
	/** Elements merged into the selected node when its class is collapsed. */
	protected readonly mergedChildren = computed(() => {
		const e = this.selectedEntity();
		const g = this.graph();
		if (!e || !g || this.levels()[e.kind as Kind] !== 'collapsed') return [];
		const lang = this.lang();
		return [...g.entities.values()]
			.filter((o) => o.kind === e.kind && o.root === e.id && o.id !== e.id)
			.sort((a, b) => entityTitle(a, lang).localeCompare(entityTitle(b, lang), lang));
	});

	/**
	 * The selected node's relations as short sentences: "Wird betrieben von A, B und C." – at most SENTENCE_MAX
	 * elements are linked, the rest is summarised as "und n weitere".
	 */
	protected readonly sentences = computed<Sentence[]>(() => {
		const id = this.selected();
		const mg = this.mapGraph();
		const g = this.graph();
		const lang = this.lang();
		if (!id || !mg || !g) return [];
		const and = this.translate.instant('common.and');
		const build = (label: string, items: Entity[]): Sentence => {
			const shown = items.slice(0, SENTENCE_MAX);
			const more = items.length - shown.length;
			const parts: SentencePart[] = [{ text: `${label} ` }];
			shown.forEach((entity, k) => {
				if (k > 0) parts.push({ text: k === shown.length - 1 && !more ? ` ${and} ` : ', ' });
				parts.push({ entity });
			});
			if (more) parts.push({ text: ` ${this.translate.instant('common.andMore', { n: more })}` });
			parts.push({ text: '.' });
			return { key: label, parts };
		};
		const out: Sentence[] = [];
		const merged = this.mergedChildren();
		if (merged.length) out.push(build(`${this.translate.instant('map.merged', { n: merged.length })}:`, merged));
		const groups = new Map<string, { key: string; out: boolean; items: Entity[] }>();
		for (const e of mg.edges) {
			if (e.s !== id && e.o !== id) continue;
			const isOut = e.s === id;
			const k = `${e.key}|${isOut}`;
			if (!groups.has(k)) groups.set(k, { key: e.key, out: isOut, items: [] });
			groups.get(k)!.items.push(g.entities.get(isOut ? e.o : e.s)!);
		}
		for (const grp of [...groups.values()].sort((a, b) => b.items.length - a.items.length)) {
			const raw = grp.out
				? pick(g.relationInfo.get(grp.key)?.name, lang)
				: this.translate.instant(`relInverse.${grp.key}`);
			const label = raw.charAt(0).toLocaleUpperCase(lang) + raw.slice(1);
			grp.items.sort((a, b) => entityTitle(a, lang).localeCompare(entityTitle(b, lang), lang));
			out.push(build(label, grp.items));
		}
		return out;
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
		// addresses are only needed once an organization is opened
		effect(() => {
			if (this.selectedEntity()?.kind === 'organization') untracked(() => this.addressService.load());
		});
		this.readUrl();

		// embedded: the focus follows the page; the steps start at whatever shows about IDEAL_CONTEXT_NODES elements
		effect(() => {
			if (!this.embedded()) return;
			const key = this.focusKey();
			const e = key ? this.graphService.entity(key) : undefined;
			const g = this.graph();
			untracked(() => {
				this.view.set('network');
				this.selected.set(null);
				this.focus.set(e?.id ?? null);
				if (!e || !g) return;
				const counts = [1, 2, 3].map((hops) => buildMapGraph(g, { ...this.options(), focus: e.id, hops }).nodes.length);
				const best = counts.reduce(
					(bi, n, i) => (Math.abs(n - IDEAL_CONTEXT_NODES) < Math.abs(counts[bi] - IDEAL_CONTEXT_NODES) ? i : bi),
					0,
				);
				this.hops.set(best + 1);
			});
		});

		// keep the URL in sync (replaceUrl: no history spam)
		effect(() => {
			if (this.embedded()) return;
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
				// only counts as fitted once the canvas had a size (an embedded panel may still be laid out)
				queueMicrotask(() => {
					if (this.fit(false)) this.fittedKey = key;
				});
			}
		});

		// labels are placed again when the scene, the hover/selection or the search hits change
		effect(() => {
			this.scene();
			this.active();
			this.matchIds();
			this.focusRep();
			this.selEdges();
			untracked(() => this.scheduleLabels());
		});

		this.destroyRef.onDestroy(() => this.worker?.terminate());
	}

	// ---------------------------------------------------------------------------------------------- label placement

	private labelFrame = 0;

	/** runs placeLabels once per animation frame, outside Angular */
	private scheduleLabels(): void {
		if (this.labelFrame) return;
		this.labelFrame = requestAnimationFrame(() => {
			this.labelFrame = 0;
			this.placeLabels();
		});
	}

	/**
	 * Greedy label placement in screen space, like a map: pinned labels (the hovered or selected node, the focused
	 * one, search hits) come first, then the highlighted neighbours and the rest in importance order as far as the
	 * zoom level's budget allows; a label whose box would overlap an already placed one is hidden. Runs on every
	 * zoom frame, ~430 labels take well under a millisecond.
	 */
	private placeLabels(): void {
		const sc = this.scene();
		const svg = this.svgRef()?.nativeElement;
		if (!sc || sc.view !== 'network' || !svg) return;
		const { k, x: tx, y: ty } = this.transform;
		const budget = LABELS_AT_FIT * Math.pow(k / this.fitScale, 2) + 1;
		const active = this.active();
		const sel = this.selected();
		const focus = this.focusRep();
		const matches = this.matchIds();
		const pinned = (id: string): boolean => id === active || id === sel || id === focus || !!matches?.has(id);
		const byRank = [...sc.labelOrder].reverse();
		// the highlighted neighbours get the same budget as the whole map does, most important first – a hub's
		// hundred neighbours do not all get their name at once
		const neighbours = active ? byRank.filter((n) => !pinned(n.id) && this.isHl(n.id)).slice(0, Math.ceil(budget)) : [];
		const candidates = [
			...byRank.filter((n) => pinned(n.id)),
			...neighbours,
			...byRank.filter((n) => !pinned(n.id) && !this.isHl(n.id) && n.rank < budget),
		];
		const boxes: { x: number; y: number; w: number; h: number }[] = [];
		const shown = new Set<string>();
		for (const n of candidates) {
			const x = n.x * k + tx + (n.r + 6) * k;
			const y = n.y * k + ty - LABEL_H / 2;
			const clash = boxes.some((b) => x < b.x + b.w && x + n.lw > b.x && y < b.y + b.h && y + LABEL_H > b.y);
			if (clash && !pinned(n.id)) continue;
			boxes.push({ x, y, w: n.lw, h: LABEL_H });
			shown.add(n.id);
		}
		for (const el of svg.querySelectorAll<SVGTextElement>('text.node-label')) {
			el.classList.toggle('occluded', !shown.has(el.dataset['id'] ?? ''));
		}
		// the selected node's edge arrows and names: only zoomed in, and only where no label is in the way
		const detail = k / this.fitScale >= EDGE_DETAIL_ZOOM;
		svg.classList.toggle('detail', detail);
		const edgeShown = new Set<string>();
		if (detail) {
			for (const e of this.selEdges()) {
				const x = e.mx * k + tx - e.lw / 2;
				const y = e.my * k + ty - EDGE_LABEL_H / 2;
				const clash = boxes.some((b) => x < b.x + b.w && x + e.lw > b.x && y < b.y + b.h && y + EDGE_LABEL_H > b.y);
				if (clash) continue;
				boxes.push({ x, y, w: e.lw, h: EDGE_LABEL_H });
				edgeShown.add(e.id);
			}
		}
		for (const el of svg.querySelectorAll<SVGTextElement>('text.edge-label')) {
			el.classList.toggle('occluded', !edgeShown.has(el.dataset['id'] ?? ''));
		}
	}

	ngAfterViewInit(): void {
		this.setupZoom();
		// the map fills the scrollable area between Oblique's header and footer (embedded: fixed height from CSS)
		const wrapper = this.embedded() ? null : document.querySelector('.ob-master-layout-wrapper');
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
		if (this.embedded()) return;
		const g = this.graph();
		const e = g?.entities.get(id);
		if (!e) return;
		// make sure the focused node's class is visible
		const kind = e.kind as Kind;
		if (this.levels()[kind] === 'off') this.levels.update((l) => ({ ...l, [kind]: 'detailed' }));
		this.focus.set(id);
		this.selected.set(this.repOf(e));
		// the map is laid out anew, so the node under the pointer is about to move away: no stale hover highlight
		this.onNodeLeave();
	}
	protected clearFocus(): void {
		this.focus.set(null);
	}

	// ---------------------------------------------------------------------------------------------- interaction

	private hoverTimer = 0;
	protected onNodeEnter(id: string): void {
		clearTimeout(this.hoverTimer);
		this.hoverTimer = window.setTimeout(() => this.hovered.set(id), HOVER_DELAY);
	}
	protected onNodeLeave(): void {
		clearTimeout(this.hoverTimer);
		this.hovered.set(null);
	}

	protected onNodeClick(id: string, ev: Event): void {
		ev.stopPropagation();
		if (this.embedded()) {
			this.openEntity(id);
			return;
		}
		this.selected.set(this.selected() === id ? null : id);
	}
	/** embedded: a click on another element opens its page */
	private openEntity(id: string): void {
		const e = this.graph()?.entities.get(id);
		if (e && id !== this.focusRep()) void this.router.navigate(['/entity', e.key]);
	}
	protected onBackgroundClick(): void {
		this.selected.set(null);
	}
	protected onNodeKey(id: string, ev: KeyboardEvent): void {
		if (ev.key === 'Enter' || ev.key === ' ') {
			ev.preventDefault();
			if (this.embedded()) this.openEntity(id);
			else this.selected.set(id);
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

	/** fits the scene into the canvas; false when the canvas has no size yet */
	protected fit(animate = true): boolean {
		const svg = this.svgRef()?.nativeElement;
		const scene = this.scene();
		if (!svg || !scene || !this.zoomBehavior) return false;
		const rect = svg.getBoundingClientRect();
		const height = rect.height;
		// keep the fitted scene clear of the details drawer on wide screens
		const width = scene.view === 'network' && this.selected() && rect.width > 1000 ? rect.width - 400 : rect.width;
		if (!width || !height) return false;
		const inset = this.embedded() ? 16 : BAR_INSET;
		const b = scene.bounds;
		let k: number;
		let tx: number;
		let ty: number;
		if (scene.view === 'layers') {
			// readable zoom (never below 0.74 unless the width forces it), start at the top: tall maps are scrolled
			k = Math.min(1, (width - 48) / b.w, (height - inset - 24) / b.h);
			k = Math.max(k, Math.min(0.74, (width - 48) / b.w));
			tx = b.w * k < width ? (width - b.w * k) / 2 - b.x * k : 24 - b.x * k;
			ty = b.h * k < height - inset ? inset + (height - inset - b.h * k) / 2 : inset;
		} else {
			k = Math.min(1.4, (width - 40) / b.w, (height - inset - 40) / b.h);
			tx = (width - b.w * k) / 2 - b.x * k;
			ty = inset + (height - inset - b.h * k) / 2 - b.y * k;
		}
		this.fitScale = k;
		this.applyTransform(zoomIdentity.translate(tx, ty).scale(k), animate);
		return true;
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
				// d3's default step (×10 with ctrl, meant for the tiny deltas of a trackpad pinch) makes a mouse wheel
				// notch of ~100 px zoom fourfold; capping the step keeps pinch smooth and the wheel gradual
				.wheelDelta((ev: WheelEvent) => {
					const d = -ev.deltaY * (ev.deltaMode === 1 ? 0.05 : ev.deltaMode ? 1 : 0.002) * (ev.ctrlKey ? 10 : 1);
					return Math.sign(d) * Math.min(Math.abs(d), WHEEL_STEP_MAX);
				})
				.on('zoom', (ev: { transform: ZoomTransform }) => {
					this.transform = ev.transform;
					vp.setAttribute('transform', ev.transform.toString());
					svg.style.setProperty('--zk', String(ev.transform.k));
					// how many labels the view can take: more important ones first, more as the map is zoomed in
					const labels = LABELS_AT_FIT * Math.pow(ev.transform.k / this.fitScale, 2);
					svg.style.setProperty('--label-n', labels.toFixed(2));
					this.scheduleLabels();
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

	private sceneNode(n: MapNode, label: string, r: number, ranks: Map<string, number>, badgeW = 0): SceneNode {
		return {
			id: n.id,
			kind: n.kind,
			x: n.x,
			y: n.y,
			r,
			icon: entityIcon(n.entity),
			label,
			title: entityTitle(n.entity, this.lang()),
			members: n.members,
			cb: n.members > 1 ? countBadge(r, n.members) : undefined,
			orgType: n.orgType,
			rank: ranks.get(n.id) ?? 0,
			lw: textWidth(label, LABEL_PX),
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

/**
 * 5 px for an isolated node, growing with the square root of the degree (and of the merged count) up to 30 px.
 * A top-level element (no visible parent) gets a slight bonus; sub-elements follow the plain formula.
 */
function nodeRadius(n: MapNode): number {
	const r = 5 + 1.5 * (Math.sqrt(n.degree) * 2.2 + (n.members > 1 ? Math.sqrt(n.members) : 0));
	return Math.min(30, n.parentId ? r : r * TOP_LEVEL_BONUS);
}

/** count badge of a merged node: a pill on the border, about 0.4 of the node's radius, wider for more digits */
function countBadge(r: number, members: number): { r: number; w: number; fs: number } {
	const br = Math.max(5.5, r * 0.4);
	const fs = br * 1.3;
	return { r: br, w: 2 * br + (String(members).length - 1) * fs * 0.6, fs };
}

function edgeWidth(weight: number): number {
	return Math.min(5, 1 + Math.log2(weight));
}

function hash(s: string): number {
	let h = 0;
	for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
	return h;
}
