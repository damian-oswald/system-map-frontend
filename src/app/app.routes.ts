import { Routes } from '@angular/router';

export const routes: Routes = [
	{ path: '', pathMatch: 'full', redirectTo: 'dashboard' },
	{
		path: 'dashboard',
		loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
		title: 'nav.dashboard',
	},
	{ path: 'map', loadComponent: () => import('./features/map/system-map').then((m) => m.SystemMap), title: 'nav.map' },
	{
		path: 'catalog',
		loadComponent: () => import('./features/catalog/catalog').then((m) => m.Catalog),
		title: 'nav.catalog',
	},
	{ path: 'about', loadComponent: () => import('./features/about/about').then((m) => m.About), title: 'nav.about' },
	{
		path: 'entity/:key',
		loadComponent: () => import('./features/entity/entity-page').then((m) => m.EntityPage),
	},
	{ path: '**', redirectTo: 'dashboard' },
];
