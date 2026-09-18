import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';

/** Route titles are i18n keys; translate them and keep the tab title in sync with the language. */
@Injectable({ providedIn: 'root' })
export class TranslatedTitleStrategy extends TitleStrategy {
	private readonly title = inject(Title);
	private readonly translate = inject(TranslateService);
	private lastKey?: string;

	constructor() {
		super();
		this.translate.onLangChange.subscribe(() => this.apply());
	}

	override updateTitle(snapshot: RouterStateSnapshot): void {
		this.lastKey = this.buildTitle(snapshot);
		this.apply();
	}

	private apply(): void {
		// entity pages set their own title
		if (!this.lastKey) return;
		this.translate.get([this.lastKey, 'app.title']).subscribe((t: Record<string, string>) => {
			this.title.setTitle(`${t[this.lastKey!]} · ${t['app.title']}`);
		});
	}
}
