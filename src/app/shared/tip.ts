import { Directive, ElementRef, OnDestroy, inject, input } from '@angular/core';

/**
 * Lightweight chart tooltip: value first (strong), label second. Shown on hover and keyboard focus; text is set via
 * textContent (labels come from the data). One shared element for the whole app.
 */
@Directive({
	selector: '[appTip]',
	host: {
		'(mouseenter)': 'show()',
		'(mousemove)': 'move($event)',
		'(mouseleave)': 'hide()',
		'(focus)': 'show(true)',
		'(blur)': 'hide()',
	},
})
export class TipDirective implements OnDestroy {
	/** [value, label] */
	readonly appTip = input.required<[string | number, string]>();
	private readonly host = inject(ElementRef<HTMLElement>);
	private static el?: HTMLDivElement;

	private get el(): HTMLDivElement {
		if (!TipDirective.el) {
			const el = document.createElement('div');
			el.className = 'sm-tooltip';
			el.setAttribute('role', 'tooltip');
			el.hidden = true;
			document.body.appendChild(el);
			TipDirective.el = el;
		}
		return TipDirective.el;
	}

	show(fromFocus = false): void {
		const [value, label] = this.appTip();
		const el = this.el;
		el.replaceChildren();
		const strong = document.createElement('strong');
		strong.textContent = String(value);
		const span = document.createElement('span');
		span.textContent = label;
		el.append(strong, span);
		el.hidden = false;
		if (fromFocus) {
			const r = (this.host.nativeElement as HTMLElement).getBoundingClientRect();
			this.place(r.left + r.width / 2, r.top);
		}
	}

	move(ev: MouseEvent): void {
		this.place(ev.clientX, ev.clientY);
	}

	private place(x: number, y: number): void {
		const el = this.el;
		const w = el.offsetWidth;
		const h = el.offsetHeight;
		const left = Math.min(window.innerWidth - w - 8, Math.max(8, x + 14));
		const top = y - h - 12 < 8 ? y + 18 : y - h - 12;
		el.style.left = `${left}px`;
		el.style.top = `${top}px`;
	}

	hide(): void {
		if (TipDirective.el) TipDirective.el.hidden = true;
	}

	ngOnDestroy(): void {
		this.hide();
	}
}
