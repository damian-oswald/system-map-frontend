import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withFetch } from '@angular/common/http';
import localeDeCH from '@angular/common/locales/de-CH';
import localeEn from '@angular/common/locales/en';
import localeFrCH from '@angular/common/locales/fr-CH';
import localeItCH from '@angular/common/locales/it-CH';
import {
	ApplicationConfig,
	LOCALE_ID,
	provideBrowserGlobalErrorListeners,
	provideZoneChangeDetection,
} from '@angular/core';
import { TitleStrategy, provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideObliqueConfiguration } from '@oblique/oblique';

import { routes } from './app.routes';
import { TranslatedTitleStrategy } from './core/title.strategy';

registerLocaleData(localeDeCH);
registerLocaleData(localeFrCH);
registerLocaleData(localeItCH);
registerLocaleData(localeEn);

export const appConfig: ApplicationConfig = {
	providers: [
		provideBrowserGlobalErrorListeners(),
		provideZoneChangeDetection({ eventCoalescing: true }),
		provideRouter(
			routes,
			withComponentInputBinding(),
			withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
		),
		provideHttpClient(withFetch()),
		{ provide: TitleStrategy, useClass: TranslatedTitleStrategy },
		{ provide: LOCALE_ID, useValue: 'de-CH' },
		provideObliqueConfiguration({
			accessibilityStatement: {
				applicationName: 'DigiAgriFoodCH System Map',
				createdOn: new Date('2026-09-18'),
				conformity: 'none',
				applicationOperator: 'Federal Office for Agriculture FOAG',
				contact: [{ url: 'https://github.com/blw-ofag-ufag/system-map/issues' }],
			},
			translate: {
				locales: {
					locales: ['de-CH', 'fr-CH', 'it-CH', 'en-US'],
					defaultLanguage: 'de',
					disabled: false,
					languages: { de: 'Deutsch', fr: 'Français', it: 'Italiano', en: 'English' },
				},
			},
		}),
	],
};
