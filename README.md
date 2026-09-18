# AgriFood Daten- und Systemlandkarte – web application

**Live site: <https://damian-oswald.github.io/system-map-frontend/>**

A dashboard, interactive system map and data catalog for the
[DigiAgriFoodCH system map](https://github.com/blw-ofag-ufag/system-map) knowledge graph published on
[LINDAS](https://lindas.admin.ch) (named graph `https://lindas.admin.ch/foag/system-map`).

Built with Angular 21 and [Oblique 15](https://oblique.bit.admin.ch), the Swiss federal design framework.
There is no backend: the browser queries LINDAS directly.

| Page                                     | What it offers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dashboard / Übersicht** (`/dashboard`) | Key figures, who operates which systems, organizations by sector, cantonal coverage (tile map), data-protection waffle, largest and most connected systems, shared IT services, documented architectures, relation types, documentation quality                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Map / Karte** (`/map`)                 | Two static layouts of the graph: _Layers_ (organizations → IT systems → IT services → data sets, crossing-minimized) and _Network_ (force layout computed once in a web worker, so nothing wiggles). Per class (organizations, IT systems, IT services, data sets) a level of detail – off, grouped to the top-level element, or detailed with the hierarchy drawn as an indented tree; filters for sector, relation types and subgraphs; search; focus on an element's 1–3-step neighbourhood; details drawer (with the postal address of an organization from the Zefix / Staatskalender registers on LINDAS). Every setting is kept in the URL, so views can be shared. |
| **Inventory / Inventar** (`/catalog`)    | Searchable, filterable, paginated inventory of data sets, IT systems, IT services and organizations as an Oblique table (default) or cards. Text cells with links, abbreviations where they exist, figures that roll up along the hierarchy (an organization counts the systems, data sets and services of itself and all its sub-units); filters as (multi) selects in a panel like the map's; grouping by system, organization or sector; CSV export.                                                                                                                                                                                                                    |
| **Details** (`/entity/:id`)              | One page per element in numbered chapters that alternate between white and a tinted background: header with tags, description, address (organizations), parent chips, actions and key figures; relations diagram (incoming left, outgoing right, parts nested, long groups expandable); structure tree with a roll-up table (systems of sub-units, data sets in sub-systems, …); one small Oblique table per relation type; legal basis, keywords, architectures.                                                                                                                                                                                                          |
| **About** (`/about`)                     | What the project is, how the app works, a glossary generated from the ontology, and further information (links)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

Every page ends with a dark **data section** (`app-data-footer`): what the data is, when the dataset was created and
last changed, links to the source repository and the issue tracker, and a live panel that asks LINDAS on every visit
when it was last queried and how many triples the graph holds, with a reload button.

The whole app is available in German, French, Italian and English. Labels and descriptions come from the graph
in the selected language, falling back to another language where a translation is missing.

## Running it

```bash
npm install
npm start            # http://localhost:4200
npm run build        # production build in dist/system-map-frontend/browser
```

Requires Node.js 20.19+ or 22.12+.

## Deployment

Every push to `main` runs the GitHub Actions workflow in `.github/workflows/deploy.yml`: it builds the app with
`--base-href /system-map-frontend/`, adds a `404.html` fallback so deep links work, and publishes the result to the
`gh-pages` branch, which GitHub Pages serves at <https://damian-oswald.github.io/system-map-frontend/>.

To build for a different sub-path manually:

```bash
npx ng build --base-href /my-path/
cp dist/system-map-frontend/browser/index.html dist/system-map-frontend/browser/404.html
```

## How loading is kept fast

- **One query.** The entire graph (≈5,200 triples, ≈170 kB gzipped) is loaded with a single `CONSTRUCT` query
  as N-Triples, parsed by a small dedicated parser (≈5 ms) and turned into a typed in-memory model (≈7 ms).
  All pages compute their views locally, so filtering never waits on the network.
- **The query starts before Angular does.** A small inline script in `src/index.html` fires the request as soon
  as the HTML arrives, so the data download overlaps with downloading and booting the JavaScript bundle.
- **Stale-while-revalidate.** The last response is kept in `localStorage`. Repeat visits render immediately from
  the cache while a fresh copy loads in the background.
- **Lazy routes and a web worker.** Every page is its own small chunk, and the force layout runs off the main thread.

Measured on the production build (desktop, fast connection): key figures appear about 350 ms after navigation
on a first visit and about 80 ms on repeat visits. The full map (≈430 elements) renders in about 100 ms.

## Code map

```
src/index.html                       early LINDAS request
src/app/core/
  vocab.ts                           namespaces, classes, relation definitions (canonical direction + inverse)
  ntriples.ts                        minimal N-Triples parser
  graph-builder.ts                   triples → typed model (hierarchies for all classes, cantons, flags, subgraphs, ontology labels)
  graph.service.ts                   loading, caching, revalidation
  live-stats.service.ts              live triple count and dataset dates for the data section (never cached)
  i18n.ts                            language-aware label helpers and pipes
  address.service.ts                 postal addresses of organizations from the Zefix / Staatskalender graphs (map drawer)
  cantons.ts                         canton detection and tile-map grid
src/app/shared/
  data-footer.ts                     dark data/provenance section shown on every page
  ui.ts, bar-list.ts, tip.ts         entity chips, name lists, trees, ranked bars, chart tooltip
src/app/features/
  dashboard/                         dashboard-data.ts (aggregations) + view
  map/                               map-model.ts (filters and collapse), layered-layout.ts, force.worker.ts, view
  catalog/                           catalog-data.ts (rows, CSV) + view
  entity/                            details page with relations diagram
  about/
public/assets/i18n/{de,fr,it,en}.json  UI texts
```

Visual language: **instances** (a specific organization, system, dataset or service) are always drawn as
rectangular nodes with a class-coloured bar on the left – in the map, in chips and in the relations diagram.
**Classes** (in filters and legends) are marked with a coloured dot. Controls use Oblique/Angular Material
buttons, selects, button toggles and checkboxes.

Colours: the four classes use a fixed palette (organization blue, IT system teal, data set amber,
IT service purple), and organization sectors have their own palette. Both were checked for colour-blind
separation. Every colour also has a text label next to it, so no information depends on colour alone.
