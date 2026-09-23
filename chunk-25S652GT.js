import{c as Jt,d as lt,e as st,f as dt,g as q,i as ct}from"./chunk-VSL62X7B.js";import{$ as J,$b as Wt,A as vt,Aa as k,B as xt,Da as at,E as D,Ea as h,F as C,H as I,J as kt,K as z,L as $,M as _,N as c,Na as Nt,O as b,Oa as Gt,P as v,Pa as Pt,Qa as ot,Ra as Lt,Sa as Rt,Ta as At,U as Mt,V as L,W as p,Wa as Ft,X as Tt,Xa as Vt,Y as Ct,Ya as zt,Z as It,Za as $t,_ as St,_a as jt,aa as X,cb as Kt,d as mt,da as wt,f as bt,fa as R,g as Z,ga as tt,h as m,ha as x,ia as M,j as ht,ja as et,jb as Ht,k as ft,kb as Ut,kc as Yt,la as nt,lc as it,ma as Et,mc as rt,na as Ot,oa as j,pc as Zt,q as V,ra as S,sa as A,t as yt,tb as H,ua as K,v as _t,va as Dt,wb as U,x as d,xb as Q,ya as N,yb as Qt,z as B,za as Bt,zb as qt}from"./chunk-TBQ7QCU3.js";var ut=e=>["/entity",e];function de(e,o){if(e&1&&(c(0,"a",0),v(1,"mat-icon",2),c(2,"span"),x(3),b()()),e&2){let t=p(),n=p();_("routerLink",j(4,ut,t.key)),D("title",n.title()),d(),_("svgIcon",n.icon()),d(2),M(n.label())}}function ce(e,o){if(e&1&&(c(0,"span",1),v(1,"mat-icon",2),c(2,"span"),x(3),b()()),e&2){let t=p(2);D("title",t.title()),d(),_("svgIcon",t.icon()),d(2),M(t.label())}}function ge(e,o){if(e&1&&C(0,de,4,6,"a",0)(1,ce,4,3,"span",1),e&2){let t=p();I(t.link()?0:1)}}var ue=()=>[1,2,3,4];function pe(e,o){if(e&1){let t=Mt();c(0,"div",0),v(1,"mat-icon",2),c(2,"div")(3,"h2"),x(4),S(5,"translate"),b(),c(6,"p",3),x(7),S(8,"translate"),c(9,"code"),x(10),b()(),c(11,"button",4),L("click",function(){ht(t);let a=p();return ft(a.graph.reload())}),x(12),S(13,"translate"),b()()()}if(e&2){let t=p();d(4),M(A(5,4,"state.error.title")),d(3),et(" ",A(8,6,"state.error.text")," "),d(3),M(t.graph.error()),d(2),et(" ",A(13,8,"state.error.retry")," ")}}function me(e,o){e&1&&v(0,"div",8)}function be(e,o){e&1&&(c(0,"div",1),S(1,"translate"),v(2,"div",5)(3,"div",6),c(4,"div",7),z(5,me,1,0,"div",8,kt),b(),v(7,"div",9),b()),e&2&&(D("aria-label",A(1,1,"state.loading")),d(5),$(Ot(3,ue)))}var he=(e,o)=>o.e.id;function fe(e,o){if(e&1&&(c(0,"span"),v(1,"mat-icon",6),x(2),S(3,"label"),b()),e&2){let t=p(2).$implicit,n=p();tt(nt("tnode current sm-kind--",t.e.kind)),d(),_("svgIcon",n.icon(t.e)),d(),M(K(3,5,t.e,n.lang(),"title"))}}function ye(e,o){if(e&1&&(c(0,"a",7),v(1,"mat-icon",6),x(2),S(3,"label"),b()),e&2){let t=p(2).$implicit,n=p();tt(nt("tnode sm-kind--",t.e.kind)),_("routerLink",j(10,ut,t.e.key)),d(),_("svgIcon",n.icon(t.e)),d(),M(K(3,6,t.e,n.lang(),"title"))}}function _e(e,o){if(e&1&&C(0,fe,4,9,"span",4)(1,ye,4,12,"a",5),e&2){let t=p().$implicit;I(t.self?0:1)}}function ve(e,o){if(e&1&&(c(0,"span",1),v(1,"mat-icon",6),c(2,"span"),x(3),S(4,"label"),b()()),e&2){let t=p().$implicit,n=p();d(),_("svgIcon",n.icon(t.e)),d(2),M(Dt(4,2,t.e,n.lang(),"short",60))}}function xe(e,o){if(e&1&&v(0,"app-entity-chip",2),e&2){let t=p().$implicit;_("entity",t.e)("max",60)}}function ke(e,o){if(e&1&&v(0,"app-entity-tree",3),e&2){let t=p().$implicit,n=p();_("nodes",t.children)("root",!1)("plain",n.plain())}}function Me(e,o){if(e&1&&(c(0,"li"),C(1,_e,2,1)(2,ve,5,7,"span",1)(3,xe,1,2,"app-entity-chip",2),C(4,ke,1,3,"app-entity-tree",3),b()),e&2){let t=o.$implicit,n=p();d(),I(n.plain()?1:t.self?2:3),d(3),I(t.children.length?4:-1)}}var Te=(e,o)=>o.id;function Ce(e,o){if(e&1&&(c(0,"span"),x(1),b(),c(2,"a",0),S(3,"label"),x(4),b()),e&2){let t=o.$implicit,n=o.$index,a=o.$count,r=p();d(),M(r.separator(n,n===a-1)),d(),_("routerLink",j(8,ut,t.key))("title",K(3,4,t,r.lang(),"title")),d(2),M(r.label(t))}}function Ie(e,o){if(e&1&&(c(0,"span"),x(1),b()),e&2){let t=p();d(),M(t.moreText())}}var Xt={organization:"building",system:"server",dataset:"database",service:"branch",legislation:"justice-scales",keyword:"tag",collection:"stack",other:"info"},Se={federal:"bundeshaus",cantonal:"antique-building",other:"antique-building",private:"building"};function ae(e){return e?e.kind==="organization"?Se[e.orgType??"other"]:e.kind==="system"&&e.fmis?"tablet":Xt[e.kind]:Xt.other}var en={canton:"location",protection:"lock",master:"star"},gt=class e{entity=k.required();max=k(48);abbr=k(!1,{transform:h});link=k(!0,{transform:h});lang=m(q).lang;icon=N(()=>ae(this.entity()));title=N(()=>lt(this.entity(),this.lang()));label=N(()=>this.abbr()?dt(this.entity(),this.lang(),this.max()):st(this.entity(),this.lang(),this.max()));static \u0275fac=function(t){return new(t||e)};static \u0275cmp=B({type:e,selectors:[["app-entity-chip"]],inputs:{entity:[1,"entity"],max:[1,"max"],abbr:[1,"abbr"],link:[1,"link"]},decls:1,vars:1,consts:[[1,"sm-chip",3,"routerLink"],[1,"sm-chip"],[3,"svgIcon"]],template:function(t,n){if(t&1&&C(0,ge,2,1),t&2){let a;I((a=n.entity())?0:-1,a)}},dependencies:[H,Q,U],styles:["[_nghost-%COMP%]{display:inline-flex;max-width:100%}"]})},te=class e{graph=m(Zt);static \u0275fac=function(t){return new(t||e)};static \u0275cmp=B({type:e,selectors:[["app-page-state"]],decls:2,vars:1,consts:[["role","alert",1,"state-error","sm-card","sm-card-pad"],["aria-busy","true",1,"state-loading"],["svgIcon","exclamation"],[1,"sm-muted"],["mat-button","","obButton","primary","type","button",1,"retry",3,"click"],[1,"sm-skeleton",2,"height","28px","width","40%"],[1,"sm-skeleton",2,"height","16px","width","65%"],[1,"grid"],[1,"sm-skeleton",2,"height","110px"],[1,"sm-skeleton",2,"height","320px"]],template:function(t,n){t&1&&C(0,pe,14,10,"div",0)(1,be,8,4,"div",1),t&2&&I(n.graph.state()==="error"?0:1)},dependencies:[Q,U,Ut,Ht,Wt,qt],styles:[".state-loading[_ngcontent-%COMP%]{display:grid;gap:14px;padding:16px 0}.grid[_ngcontent-%COMP%]{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin:12px 0}.state-error[_ngcontent-%COMP%]{display:flex;gap:16px;margin:32px 0;border-left:4px solid var(--sm-accent)}.state-error[_ngcontent-%COMP%]   h2[_ngcontent-%COMP%]{margin:0 0 4px}.retry[_ngcontent-%COMP%]{margin-top:8px}"]})},ee=class e{nodes=k.required();root=k(!0);plain=k(!1,{transform:h});lang=m(q).lang;icon=ae;static \u0275fac=function(t){return new(t||e)};static \u0275cmp=B({type:e,selectors:[["app-entity-tree"]],inputs:{nodes:[1,"nodes"],root:[1,"root"],plain:[1,"plain"]},decls:3,vars:4,consts:[[1,"etree"],[1,"sm-chip","current"],[3,"entity","max"],[3,"nodes","root","plain"],[3,"class"],[3,"class","routerLink"],[3,"svgIcon"],[3,"routerLink"]],template:function(t,n){t&1&&(c(0,"ul",0),z(1,Me,5,2,"li",null,he),b()),t&2&&(R("root",n.root())("plain",n.plain()),d(),$(n.nodes()))},dependencies:()=>[e,gt,Q,U,H,ct],styles:['[_nghost-%COMP%]{display:block}.etree[_ngcontent-%COMP%]{margin:0;padding:0;list-style:none}.etree[_ngcontent-%COMP%]:not(.root){margin:2px 0 0 11px;padding-left:18px;border-left:1px solid var(--sm-line-strong)}li[_ngcontent-%COMP%]{position:relative;padding:3px 0}.etree[_ngcontent-%COMP%]:not(.root) > li[_ngcontent-%COMP%]:before{content:"";position:absolute;top:16px;left:-18px;width:12px;border-top:1px solid var(--sm-line-strong)}.etree[_ngcontent-%COMP%]:not(.root) > li[_ngcontent-%COMP%]:last-child:after{content:"";position:absolute;top:17px;bottom:-3px;left:-19px;width:3px;background:var(--sm-surface)}.current[_ngcontent-%COMP%]{background:var(--sm-surface-2);font-weight:600}.tnode[_ngcontent-%COMP%]{display:inline-flex;align-items:center;gap:8px;padding:3px 0;color:var(--sm-ink);text-decoration:none}.tnode[_ngcontent-%COMP%]   mat-icon[_ngcontent-%COMP%]{flex:none;width:15px;height:15px;color:var(--k, var(--sm-ink-3))}a.tnode[_ngcontent-%COMP%]:hover, a.tnode[_ngcontent-%COMP%]:focus-visible{text-decoration:underline}.tnode.current[_ngcontent-%COMP%]{background:none;border:0;font-weight:700}']})},ne=class e{items=k.required();max=k(3);chars=k(0);abbr=k(!1,{transform:h});title=k(!1,{transform:h});lang=m(q).lang;translate=m(Qt);shown=N(()=>this.items().slice(0,this.max()));more=N(()=>this.items().length-this.shown().length);moreText=N(()=>(this.lang(),` ${this.translate.instant("common.andMore",{n:this.more()})}`));label(o){let t=this.lang();return this.title()?lt(o,t):this.abbr()?dt(o,t,this.chars()):this.chars()?st(o,t,this.chars()):Jt(o,t)}separator(o,t){return o===0?"":t&&!this.more()?` ${this.translate.instant("common.and")} `:", "}static \u0275fac=function(t){return new(t||e)};static \u0275cmp=B({type:e,selectors:[["app-name-list"]],inputs:{items:[1,"items"],max:[1,"max"],chars:[1,"chars"],abbr:[1,"abbr"],title:[1,"title"]},decls:3,vars:1,consts:[[3,"routerLink","title"]],template:function(t,n){t&1&&(z(0,Ce,5,10,null,null,Te),C(2,Ie,2,1,"span")),t&2&&($(n.shown()),d(2),I(n.more()?2:-1))},dependencies:[H,ct],styles:["[_nghost-%COMP%]{display:inline;white-space:pre-wrap}a[_ngcontent-%COMP%], a[_ngcontent-%COMP%]:visited{color:inherit;text-decoration:none}a[_ngcontent-%COMP%]:hover, a[_ngcontent-%COMP%]:focus-visible{text-decoration:underline}"]})};var Ge=["button"],Pe=["*"];function Le(e,o){if(e&1&&(c(0,"div",2),v(1,"mat-pseudo-checkbox",6),b()),e&2){let t=p();d(),_("disabled",t.disabled)}}var oe=new Z("MAT_BUTTON_TOGGLE_DEFAULT_OPTIONS",{providedIn:"root",factory:()=>({hideSingleSelectionIndicator:!1,hideMultipleSelectionIndicator:!1,disabledInteractive:!1})}),ie=new Z("MatButtonToggleGroup"),Re={provide:Vt,useExisting:mt(()=>Ae),multi:!0},W=class{source;value;constructor(o,t){this.source=o,this.value=t}},Ae=(()=>{class e{_changeDetector=m(at);_dir=m(Lt,{optional:!0});_multiple=!1;_disabled=!1;_disabledInteractive=!1;_selectionModel;_rawValue;_controlValueAccessorChangeFn=()=>{};_onTouched=()=>{};_buttonToggles;appearance;get name(){return this._name}set name(t){this._name=t,this._markButtonsForCheck()}_name=m(ot).getId("mat-button-toggle-group-");vertical=!1;get value(){let t=this._selectionModel?this._selectionModel.selected:[];return this.multiple?t.map(n=>n.value):t[0]?t[0].value:void 0}set value(t){this._setSelectionByValue(t),this.valueChange.emit(this.value)}valueChange=new V;get selected(){let t=this._selectionModel?this._selectionModel.selected:[];return this.multiple?t:t[0]||null}get multiple(){return this._multiple}set multiple(t){this._multiple=t,this._markButtonsForCheck()}get disabled(){return this._disabled}set disabled(t){this._disabled=t,this._markButtonsForCheck()}get disabledInteractive(){return this._disabledInteractive}set disabledInteractive(t){this._disabledInteractive=t,this._markButtonsForCheck()}get dir(){return this._dir&&this._dir.value==="rtl"?"rtl":"ltr"}change=new V;get hideSingleSelectionIndicator(){return this._hideSingleSelectionIndicator}set hideSingleSelectionIndicator(t){this._hideSingleSelectionIndicator=t,this._markButtonsForCheck()}_hideSingleSelectionIndicator;get hideMultipleSelectionIndicator(){return this._hideMultipleSelectionIndicator}set hideMultipleSelectionIndicator(t){this._hideMultipleSelectionIndicator=t,this._markButtonsForCheck()}_hideMultipleSelectionIndicator;constructor(){let t=m(oe,{optional:!0});this.appearance=t&&t.appearance?t.appearance:"standard",this._hideSingleSelectionIndicator=t?.hideSingleSelectionIndicator??!1,this._hideMultipleSelectionIndicator=t?.hideMultipleSelectionIndicator??!1}ngOnInit(){this._selectionModel=new Ft(this.multiple,void 0,!1)}ngAfterContentInit(){this._selectionModel.select(...this._buttonToggles.filter(t=>t.checked)),this.multiple||this._initializeTabIndex()}writeValue(t){this.value=t,this._changeDetector.markForCheck()}registerOnChange(t){this._controlValueAccessorChangeFn=t}registerOnTouched(t){this._onTouched=t}setDisabledState(t){this.disabled=t}_keydown(t){if(this.multiple||this.disabled||Pt(t))return;let a=t.target.id,r=this._buttonToggles.toArray().findIndex(u=>u.buttonId===a),g=null;switch(t.keyCode){case 32:case 13:g=this._buttonToggles.get(r)||null;break;case 38:g=this._getNextButton(r,-1);break;case 37:g=this._getNextButton(r,this.dir==="ltr"?-1:1);break;case 40:g=this._getNextButton(r,1);break;case 39:g=this._getNextButton(r,this.dir==="ltr"?1:-1);break;default:return}g&&(t.preventDefault(),g._onButtonClick(),g.focus())}_emitChangeEvent(t){let n=new W(t,this.value);this._rawValue=n.value,this._controlValueAccessorChangeFn(n.value),this.change.emit(n)}_syncButtonToggle(t,n,a=!1,r=!1){!this.multiple&&this.selected&&!t.checked&&(this.selected.checked=!1),this._selectionModel?n?this._selectionModel.select(t):this._selectionModel.deselect(t):r=!0,r?Promise.resolve().then(()=>this._updateModelValue(t,a)):this._updateModelValue(t,a)}_isSelected(t){return this._selectionModel&&this._selectionModel.isSelected(t)}_isPrechecked(t){return typeof this._rawValue>"u"?!1:this.multiple&&Array.isArray(this._rawValue)?this._rawValue.some(n=>t.value!=null&&n===t.value):t.value===this._rawValue}_initializeTabIndex(){if(this._buttonToggles.forEach(t=>{t.tabIndex=-1}),this.selected)this.selected.tabIndex=0;else for(let t=0;t<this._buttonToggles.length;t++){let n=this._buttonToggles.get(t);if(!n.disabled){n.tabIndex=0;break}}}_getNextButton(t,n){let a=this._buttonToggles;for(let r=1;r<=a.length;r++){let g=(t+n*r+a.length)%a.length,u=a.get(g);if(u&&!u.disabled)return u}return null}_setSelectionByValue(t){if(this._rawValue=t,!this._buttonToggles)return;let n=this._buttonToggles.toArray();if(this.multiple&&t?(Array.isArray(t),this._clearSelection(),t.forEach(a=>this._selectValue(a,n))):(this._clearSelection(),this._selectValue(t,n)),!this.multiple&&n.every(a=>a.tabIndex===-1)){for(let a of n)if(!a.disabled){a.tabIndex=0;break}}}_clearSelection(){this._selectionModel.clear(),this._buttonToggles.forEach(t=>{t.checked=!1,this.multiple||(t.tabIndex=-1)})}_selectValue(t,n){for(let a of n)if(a.value===t){a.checked=!0,this._selectionModel.select(a),this.multiple||(a.tabIndex=0);break}}_updateModelValue(t,n){n&&this._emitChangeEvent(t),this.valueChange.emit(this.value)}_markButtonsForCheck(){this._buttonToggles?.forEach(t=>t._markForCheck())}static \u0275fac=function(n){return new(n||e)};static \u0275dir=xt({type:e,selectors:[["mat-button-toggle-group"]],contentQueries:function(n,a,r){if(n&1&&It(r,re,5),n&2){let g;J(g=X())&&(a._buttonToggles=g)}},hostAttrs:[1,"mat-button-toggle-group"],hostVars:6,hostBindings:function(n,a){n&1&&L("keydown",function(g){return a._keydown(g)}),n&2&&(D("role",a.multiple?"group":"radiogroup")("aria-disabled",a.disabled),R("mat-button-toggle-vertical",a.vertical)("mat-button-toggle-group-appearance-standard",a.appearance==="standard"))},inputs:{appearance:"appearance",name:"name",vertical:[2,"vertical","vertical",h],value:"value",multiple:[2,"multiple","multiple",h],disabled:[2,"disabled","disabled",h],disabledInteractive:[2,"disabledInteractive","disabledInteractive",h],hideSingleSelectionIndicator:[2,"hideSingleSelectionIndicator","hideSingleSelectionIndicator",h],hideMultipleSelectionIndicator:[2,"hideMultipleSelectionIndicator","hideMultipleSelectionIndicator",h]},outputs:{valueChange:"valueChange",change:"change"},exportAs:["matButtonToggleGroup"],features:[Et([Re,{provide:ie,useExisting:e}])]})}return e})(),re=(()=>{class e{_changeDetectorRef=m(at);_elementRef=m(_t);_focusMonitor=m(Nt);_idGenerator=m(ot);_animationDisabled=At();_checked=!1;ariaLabel;ariaLabelledby=null;_buttonElement;buttonToggleGroup;get buttonId(){return`${this.id}-button`}id;name;value;get tabIndex(){return this._tabIndex()}set tabIndex(t){this._tabIndex.set(t)}_tabIndex;disableRipple=!1;get appearance(){return this.buttonToggleGroup?this.buttonToggleGroup.appearance:this._appearance}set appearance(t){this._appearance=t}_appearance;get checked(){return this.buttonToggleGroup?this.buttonToggleGroup._isSelected(this):this._checked}set checked(t){t!==this._checked&&(this._checked=t,this.buttonToggleGroup&&this.buttonToggleGroup._syncButtonToggle(this,this._checked),this._changeDetectorRef.markForCheck())}get disabled(){return this._disabled||this.buttonToggleGroup&&this.buttonToggleGroup.disabled}set disabled(t){this._disabled=t}_disabled=!1;get disabledInteractive(){return this._disabledInteractive||this.buttonToggleGroup!==null&&this.buttonToggleGroup.disabledInteractive}set disabledInteractive(t){this._disabledInteractive=t}_disabledInteractive;change=new V;constructor(){m(Gt).load(jt);let t=m(ie,{optional:!0}),n=m(new Bt("tabindex"),{optional:!0})||"",a=m(oe,{optional:!0});this._tabIndex=yt(parseInt(n)||0),this.buttonToggleGroup=t,this._appearance=a&&a.appearance?a.appearance:"standard",this._disabledInteractive=a?.disabledInteractive??!1}ngOnInit(){let t=this.buttonToggleGroup;this.id=this.id||this._idGenerator.getId("mat-button-toggle-"),t&&(t._isPrechecked(this)?this.checked=!0:t._isSelected(this)!==this._checked&&t._syncButtonToggle(this,this._checked))}ngAfterViewInit(){this._animationDisabled||this._elementRef.nativeElement.classList.add("mat-button-toggle-animations-enabled"),this._focusMonitor.monitor(this._elementRef,!0)}ngOnDestroy(){let t=this.buttonToggleGroup;this._focusMonitor.stopMonitoring(this._elementRef),t&&t._isSelected(this)&&t._syncButtonToggle(this,!1,!1,!0)}focus(t){this._buttonElement.nativeElement.focus(t)}_onButtonClick(){if(this.disabled)return;let t=this.isSingleSelector()?!0:!this._checked;if(t!==this._checked&&(this._checked=t,this.buttonToggleGroup&&(this.buttonToggleGroup._syncButtonToggle(this,this._checked,!0),this.buttonToggleGroup._onTouched())),this.isSingleSelector()){let n=this.buttonToggleGroup._buttonToggles.find(a=>a.tabIndex===0);n&&(n.tabIndex=-1),this.tabIndex=0}this.change.emit(new W(this,this.value))}_markForCheck(){this._changeDetectorRef.markForCheck()}_getButtonName(){return this.isSingleSelector()?this.buttonToggleGroup.name:this.name||null}isSingleSelector(){return this.buttonToggleGroup&&!this.buttonToggleGroup.multiple}static \u0275fac=function(n){return new(n||e)};static \u0275cmp=B({type:e,selectors:[["mat-button-toggle"]],viewQuery:function(n,a){if(n&1&&St(Ge,5),n&2){let r;J(r=X())&&(a._buttonElement=r.first)}},hostAttrs:["role","presentation",1,"mat-button-toggle"],hostVars:14,hostBindings:function(n,a){n&1&&L("focus",function(){return a.focus()}),n&2&&(D("aria-label",null)("aria-labelledby",null)("id",a.id)("name",null),R("mat-button-toggle-standalone",!a.buttonToggleGroup)("mat-button-toggle-checked",a.checked)("mat-button-toggle-disabled",a.disabled)("mat-button-toggle-disabled-interactive",a.disabledInteractive)("mat-button-toggle-appearance-standard",a.appearance==="standard"))},inputs:{ariaLabel:[0,"aria-label","ariaLabel"],ariaLabelledby:[0,"aria-labelledby","ariaLabelledby"],id:"id",name:"name",value:"value",tabIndex:"tabIndex",disableRipple:[2,"disableRipple","disableRipple",h],appearance:"appearance",checked:[2,"checked","checked",h],disabled:[2,"disabled","disabled",h],disabledInteractive:[2,"disabledInteractive","disabledInteractive",h]},outputs:{change:"change"},exportAs:["matButtonToggle"],ngContentSelectors:Pe,decls:7,vars:13,consts:[["button",""],["type","button",1,"mat-button-toggle-button","mat-focus-indicator",3,"click","id","disabled"],[1,"mat-button-toggle-checkbox-wrapper"],[1,"mat-button-toggle-label-content"],[1,"mat-button-toggle-focus-overlay"],["matRipple","",1,"mat-button-toggle-ripple",3,"matRippleTrigger","matRippleDisabled"],["state","checked","aria-hidden","true","appearance","minimal",3,"disabled"]],template:function(n,a){if(n&1&&(Tt(),c(0,"button",1,0),L("click",function(){return a._onButtonClick()}),C(2,Le,2,1,"div",2),c(3,"span",3),Ct(4),b()(),v(5,"span",4)(6,"span",5)),n&2){let r=wt(1);_("id",a.buttonId)("disabled",a.disabled&&!a.disabledInteractive||null),D("role",a.isSingleSelector()?"radio":"button")("tabindex",a.disabled&&!a.disabledInteractive?-1:a.tabIndex)("aria-pressed",a.isSingleSelector()?null:a.checked)("aria-checked",a.isSingleSelector()?a.checked:null)("name",a._getButtonName())("aria-label",a.ariaLabel)("aria-labelledby",a.ariaLabelledby)("aria-disabled",a.disabled&&a.disabledInteractive?"true":null),d(2),I(a.buttonToggleGroup&&(!a.buttonToggleGroup.multiple&&!a.buttonToggleGroup.hideSingleSelectionIndicator||a.buttonToggleGroup.multiple&&!a.buttonToggleGroup.hideMultipleSelectionIndicator)?2:-1),d(4),_("matRippleTrigger",r)("matRippleDisabled",a.disableRipple||a.disabled)}},dependencies:[zt,$t],styles:[`.mat-button-toggle-standalone,
.mat-button-toggle-group {
  position: relative;
  display: inline-flex;
  flex-direction: row;
  white-space: nowrap;
  overflow: hidden;
  -webkit-tap-highlight-color: transparent;
  border-radius: var(--mat-button-toggle-legacy-shape);
  transform: translateZ(0);
}
.mat-button-toggle-standalone:not([class*=mat-elevation-z]),
.mat-button-toggle-group:not([class*=mat-elevation-z]) {
  box-shadow: 0px 3px 1px -2px rgba(0, 0, 0, 0.2), 0px 2px 2px 0px rgba(0, 0, 0, 0.14), 0px 1px 5px 0px rgba(0, 0, 0, 0.12);
}
@media (forced-colors: active) {
  .mat-button-toggle-standalone,
  .mat-button-toggle-group {
    outline: solid 1px;
  }
}

.mat-button-toggle-standalone.mat-button-toggle-appearance-standard,
.mat-button-toggle-group-appearance-standard {
  border-radius: var(--mat-button-toggle-shape, var(--mat-sys-corner-extra-large));
  border: solid 1px var(--mat-button-toggle-divider-color, var(--mat-sys-outline));
}
.mat-button-toggle-standalone.mat-button-toggle-appearance-standard .mat-pseudo-checkbox,
.mat-button-toggle-group-appearance-standard .mat-pseudo-checkbox {
  --mat-pseudo-checkbox-minimal-selected-checkmark-color: var(--mat-button-toggle-selected-state-text-color, var(--mat-sys-on-secondary-container));
}
.mat-button-toggle-standalone.mat-button-toggle-appearance-standard:not([class*=mat-elevation-z]),
.mat-button-toggle-group-appearance-standard:not([class*=mat-elevation-z]) {
  box-shadow: none;
}
@media (forced-colors: active) {
  .mat-button-toggle-standalone.mat-button-toggle-appearance-standard,
  .mat-button-toggle-group-appearance-standard {
    outline: 0;
  }
}

.mat-button-toggle-vertical {
  flex-direction: column;
}
.mat-button-toggle-vertical .mat-button-toggle-label-content {
  display: block;
}

.mat-button-toggle {
  white-space: nowrap;
  position: relative;
  color: var(--mat-button-toggle-legacy-text-color);
  font-family: var(--mat-button-toggle-legacy-label-text-font);
  font-size: var(--mat-button-toggle-legacy-label-text-size);
  line-height: var(--mat-button-toggle-legacy-label-text-line-height);
  font-weight: var(--mat-button-toggle-legacy-label-text-weight);
  letter-spacing: var(--mat-button-toggle-legacy-label-text-tracking);
  --mat-pseudo-checkbox-minimal-selected-checkmark-color: var(--mat-button-toggle-legacy-selected-state-text-color);
}
.mat-button-toggle.cdk-keyboard-focused .mat-button-toggle-focus-overlay {
  opacity: var(--mat-button-toggle-legacy-focus-state-layer-opacity);
}
.mat-button-toggle .mat-icon svg {
  vertical-align: top;
}

.mat-button-toggle-checkbox-wrapper {
  display: inline-block;
  justify-content: flex-start;
  align-items: center;
  width: 0;
  height: 18px;
  line-height: 18px;
  overflow: hidden;
  box-sizing: border-box;
  position: absolute;
  top: 50%;
  left: 16px;
  transform: translate3d(0, -50%, 0);
}
[dir=rtl] .mat-button-toggle-checkbox-wrapper {
  left: auto;
  right: 16px;
}
.mat-button-toggle-appearance-standard .mat-button-toggle-checkbox-wrapper {
  left: 12px;
}
[dir=rtl] .mat-button-toggle-appearance-standard .mat-button-toggle-checkbox-wrapper {
  left: auto;
  right: 12px;
}
.mat-button-toggle-checked .mat-button-toggle-checkbox-wrapper {
  width: 18px;
}
.mat-button-toggle-animations-enabled .mat-button-toggle-checkbox-wrapper {
  transition: width 150ms 45ms cubic-bezier(0.4, 0, 0.2, 1);
}
.mat-button-toggle-vertical .mat-button-toggle-checkbox-wrapper {
  transition: none;
}

.mat-button-toggle-checked {
  color: var(--mat-button-toggle-legacy-selected-state-text-color);
  background-color: var(--mat-button-toggle-legacy-selected-state-background-color);
}

.mat-button-toggle-disabled {
  pointer-events: none;
  color: var(--mat-button-toggle-legacy-disabled-state-text-color);
  background-color: var(--mat-button-toggle-legacy-disabled-state-background-color);
  --mat-pseudo-checkbox-minimal-disabled-selected-checkmark-color: var(--mat-button-toggle-legacy-disabled-state-text-color);
}
.mat-button-toggle-disabled.mat-button-toggle-checked {
  background-color: var(--mat-button-toggle-legacy-disabled-selected-state-background-color);
}

.mat-button-toggle-disabled-interactive {
  pointer-events: auto;
}

.mat-button-toggle-appearance-standard {
  color: var(--mat-button-toggle-text-color, var(--mat-sys-on-surface));
  background-color: var(--mat-button-toggle-background-color, transparent);
  font-family: var(--mat-button-toggle-label-text-font, var(--mat-sys-label-large-font));
  font-size: var(--mat-button-toggle-label-text-size, var(--mat-sys-label-large-size));
  line-height: var(--mat-button-toggle-label-text-line-height, var(--mat-sys-label-large-line-height));
  font-weight: var(--mat-button-toggle-label-text-weight, var(--mat-sys-label-large-weight));
  letter-spacing: var(--mat-button-toggle-label-text-tracking, var(--mat-sys-label-large-tracking));
}
.mat-button-toggle-group-appearance-standard .mat-button-toggle-appearance-standard + .mat-button-toggle-appearance-standard {
  border-left: solid 1px var(--mat-button-toggle-divider-color, var(--mat-sys-outline));
}
[dir=rtl] .mat-button-toggle-group-appearance-standard .mat-button-toggle-appearance-standard + .mat-button-toggle-appearance-standard {
  border-left: none;
  border-right: solid 1px var(--mat-button-toggle-divider-color, var(--mat-sys-outline));
}
.mat-button-toggle-group-appearance-standard.mat-button-toggle-vertical .mat-button-toggle-appearance-standard + .mat-button-toggle-appearance-standard {
  border-left: none;
  border-right: none;
  border-top: solid 1px var(--mat-button-toggle-divider-color, var(--mat-sys-outline));
}
.mat-button-toggle-appearance-standard.mat-button-toggle-checked {
  color: var(--mat-button-toggle-selected-state-text-color, var(--mat-sys-on-secondary-container));
  background-color: var(--mat-button-toggle-selected-state-background-color, var(--mat-sys-secondary-container));
}
.mat-button-toggle-appearance-standard.mat-button-toggle-disabled {
  color: var(--mat-button-toggle-disabled-state-text-color, color-mix(in srgb, var(--mat-sys-on-surface) 38%, transparent));
  background-color: var(--mat-button-toggle-disabled-state-background-color, transparent);
}
.mat-button-toggle-appearance-standard.mat-button-toggle-disabled .mat-pseudo-checkbox {
  --mat-pseudo-checkbox-minimal-disabled-selected-checkmark-color: var(--mat-button-toggle-disabled-selected-state-text-color, color-mix(in srgb, var(--mat-sys-on-surface) 38%, transparent));
}
.mat-button-toggle-appearance-standard.mat-button-toggle-disabled.mat-button-toggle-checked {
  color: var(--mat-button-toggle-disabled-selected-state-text-color, color-mix(in srgb, var(--mat-sys-on-surface) 38%, transparent));
  background-color: var(--mat-button-toggle-disabled-selected-state-background-color, color-mix(in srgb, var(--mat-sys-on-surface) 12%, transparent));
}
.mat-button-toggle-appearance-standard .mat-button-toggle-focus-overlay {
  background-color: var(--mat-button-toggle-state-layer-color, var(--mat-sys-on-surface));
}
.mat-button-toggle-appearance-standard:hover .mat-button-toggle-focus-overlay {
  opacity: var(--mat-button-toggle-hover-state-layer-opacity, var(--mat-sys-hover-state-layer-opacity));
}
.mat-button-toggle-appearance-standard.cdk-keyboard-focused .mat-button-toggle-focus-overlay {
  opacity: var(--mat-button-toggle-focus-state-layer-opacity, var(--mat-sys-focus-state-layer-opacity));
}
@media (hover: none) {
  .mat-button-toggle-appearance-standard:hover .mat-button-toggle-focus-overlay {
    display: none;
  }
}

.mat-button-toggle-label-content {
  -webkit-user-select: none;
  user-select: none;
  display: inline-block;
  padding: 0 16px;
  line-height: var(--mat-button-toggle-legacy-height);
  position: relative;
}
.mat-button-toggle-appearance-standard .mat-button-toggle-label-content {
  padding: 0 12px;
  line-height: var(--mat-button-toggle-height, 40px);
}

.mat-button-toggle-label-content > * {
  vertical-align: middle;
}

.mat-button-toggle-focus-overlay {
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  position: absolute;
  border-radius: inherit;
  pointer-events: none;
  opacity: 0;
  background-color: var(--mat-button-toggle-legacy-state-layer-color);
}

@media (forced-colors: active) {
  .mat-button-toggle-checked .mat-button-toggle-focus-overlay {
    border-bottom: solid 500px;
    opacity: 0.5;
    height: 0;
  }
  .mat-button-toggle-checked:hover .mat-button-toggle-focus-overlay {
    opacity: 0.6;
  }
  .mat-button-toggle-checked.mat-button-toggle-appearance-standard .mat-button-toggle-focus-overlay {
    border-bottom: solid 500px;
  }
}
.mat-button-toggle .mat-button-toggle-ripple {
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  position: absolute;
  pointer-events: none;
}

.mat-button-toggle-button {
  border: 0;
  background: none;
  color: inherit;
  padding: 0;
  margin: 0;
  font: inherit;
  outline: none;
  width: 100%;
  cursor: pointer;
}
.mat-button-toggle-animations-enabled .mat-button-toggle-button {
  transition: padding 150ms 45ms cubic-bezier(0.4, 0, 0.2, 1);
}
.mat-button-toggle-vertical .mat-button-toggle-button {
  transition: none;
}
.mat-button-toggle-disabled .mat-button-toggle-button {
  cursor: default;
}
.mat-button-toggle-button::-moz-focus-inner {
  border: 0;
}
.mat-button-toggle-checked .mat-button-toggle-button:has(.mat-button-toggle-checkbox-wrapper) {
  padding-left: 30px;
}
[dir=rtl] .mat-button-toggle-checked .mat-button-toggle-button:has(.mat-button-toggle-checkbox-wrapper) {
  padding-left: 0;
  padding-right: 30px;
}

.mat-button-toggle-standalone.mat-button-toggle-appearance-standard {
  --mat-focus-indicator-border-radius: var(--mat-button-toggle-shape, var(--mat-sys-corner-extra-large));
}

.mat-button-toggle-group-appearance-standard:not(.mat-button-toggle-vertical) .mat-button-toggle:last-of-type .mat-button-toggle-button::before {
  border-top-right-radius: var(--mat-button-toggle-shape, var(--mat-sys-corner-extra-large));
  border-bottom-right-radius: var(--mat-button-toggle-shape, var(--mat-sys-corner-extra-large));
}
.mat-button-toggle-group-appearance-standard:not(.mat-button-toggle-vertical) .mat-button-toggle:first-of-type .mat-button-toggle-button::before {
  border-top-left-radius: var(--mat-button-toggle-shape, var(--mat-sys-corner-extra-large));
  border-bottom-left-radius: var(--mat-button-toggle-shape, var(--mat-sys-corner-extra-large));
}

.mat-button-toggle-group-appearance-standard.mat-button-toggle-vertical .mat-button-toggle:last-of-type .mat-button-toggle-button::before {
  border-bottom-right-radius: var(--mat-button-toggle-shape, var(--mat-sys-corner-extra-large));
  border-bottom-left-radius: var(--mat-button-toggle-shape, var(--mat-sys-corner-extra-large));
}
.mat-button-toggle-group-appearance-standard.mat-button-toggle-vertical .mat-button-toggle:first-of-type .mat-button-toggle-button::before {
  border-top-right-radius: var(--mat-button-toggle-shape, var(--mat-sys-corner-extra-large));
  border-top-left-radius: var(--mat-button-toggle-shape, var(--mat-sys-corner-extra-large));
}
`],encapsulation:2,changeDetection:0})}return e})(),Cn=(()=>{class e{static \u0275fac=function(n){return new(n||e)};static \u0275mod=vt({type:e});static \u0275inj=bt({imports:[Kt,re,Rt]})}return e})();var En=["off","collapsed","detailed"],On={organization:"detailed",system:"detailed",dataset:"detailed",service:"detailed"},Dn=["federal","cantonal","private","other"],Fe=it.filter(e=>!rt.has(e.key)),Bn=Fe.map(e=>e.key),Ve=new Set(it.filter(e=>e.dashed).map(e=>e.key));function le(e,o,t){let n=e.entities.get(o);return n&&t[n.kind]==="collapsed"&&n.root?n.root:o}function Nn(e,o){let t=o.subgraph?e.collections.find(i=>i.id===o.subgraph):void 0,n=i=>le(e,i.id,o.levels),a=new Map,r=new Set;for(let i of Yt)if(o.levels[i]!=="off")for(let s of e.byKind[i]){if(t&&!t.members.has(s.id))continue;let l=n(s),T=e.entities.get(l);i==="organization"&&!o.orgTypes.has(T.orgType??"other")||(r.add(l),a.set(l,(a.get(l)??0)+1))}let g=new Map;for(let i of e.relations){let s=rt.has(i.key);if(!s&&!o.relations.has(i.key))continue;let l=e.entities.get(i.s),T=e.entities.get(i.o);if(t&&(!t.members.has(l.id)||!t.members.has(T.id)))continue;let P=n(l),O=n(T);if(P===O||!r.has(P)||!r.has(O))continue;let Y=`${P}|${i.key}|${O}`,pt=g.get(Y);pt?pt.weight++:g.set(Y,{id:Y,s:P,o:O,key:i.key,weight:1,dashed:Ve.has(i.key),hierarchy:s})}let u=[...g.values()],y=i=>{let s=new Map;for(let l of i)s.has(l.s)||s.set(l.s,new Set),s.has(l.o)||s.set(l.o,new Set),s.get(l.s).add(l.o),s.get(l.o).add(l.s);return s},G=y(u),F=r,f=o.focus?le(e,o.focus,o.levels):null;if(f&&r.has(f)){let i=new Set([f]),s=[f];for(let l=0;l<o.hops;l++){let T=[];for(let P of s)for(let O of G.get(P)??[])i.has(O)||(i.add(O),T.push(O));s=T}F=i,u=u.filter(l=>i.has(l.s)&&i.has(l.o)),G=y(u)}let w=[];for(let i of F){let s=G.get(i)?.size??0;if(o.hideIsolated&&s===0&&i!==f)continue;let l=e.entities.get(i);w.push({id:i,entity:l,kind:l.kind,members:a.get(i)??1,degree:s,orgType:l.orgType,depth:0,x:0,y:0,w:0})}let E=new Map(w.map(i=>[i.id,i]));u=u.filter(i=>E.has(i.s)&&E.has(i.o));for(let i of w){let s=i.entity.parents[0],l=new Set([i.id]);for(;s&&!E.has(s)&&!l.has(s);)l.add(s),s=e.entities.get(s)?.parents[0];s&&s!==i.id&&E.has(s)&&(i.parentId=s)}for(let i of w){let s=0,l=i.parentId,T=new Set([i.id]);for(;l&&!T.has(l);)T.add(l),s++,l=E.get(l)?.parentId;i.depth=Math.min(s,6)}return{nodes:w,edges:u,nodeById:E,adjacency:y(u)}}function Gn(e){let o=ze(e.nodes.map(n=>n.id),e.adjacency),t=e.nodes.map(n=>({id:n.id,s:o.get(n.id)*(1+.15*Math.log2(n.members)),degree:n.degree}));return t.sort((n,a)=>a.s-n.s||a.degree-n.degree||n.id.localeCompare(a.id)),new Map(t.map((n,a)=>[n.id,a]))}function ze(e,o){let t=e.length,n=new Map(e.map((u,y)=>[u,y])),a=e.map(u=>[...o.get(u)??[]].map(y=>n.get(y)??-1).filter(y=>y>=0)),r=new Array(t).fill(1/Math.max(1,t)),g=.85;for(let u=0;u<40;u++){let y=new Array(t).fill((1-g)/Math.max(1,t)),G=0;for(let f=0;f<t;f++){let w=a[f].length;if(!w){G+=r[f];continue}let E=g*r[f]/w;for(let i of a[f])y[i]+=E}let F=g*G/Math.max(1,t);for(let f=0;f<t;f++)y[f]+=F;r=y}return new Map(e.map((u,y)=>[u,r[y]]))}export{Xt as a,Se as b,ae as c,en as d,gt as e,te as f,ee as g,ne as h,Ae as i,re as j,Cn as k,En as l,On as m,Dn as n,Fe as o,Bn as p,le as q,Nn as r,Gn as s,ze as t};
