import fs from "node:fs";
import path from "node:path";

const dir = path.resolve("node_modules/obsidian");
const entry = path.join(dir, "index.js");
const packageFile = path.join(dir, "package.json");
const source = String.raw`
class Element {
  constructor(tag="div") { this.tagName=tag.toUpperCase(); this.children=[]; this.parentElement=null; this.attributes={}; this.classList={_s:new Set(), add:(...x)=>x.forEach(v=>this.classList._s.add(v)), remove:(...x)=>x.forEach(v=>this.classList._s.delete(v)), contains:v=>this.classList._s.has(v)}; this.listeners={}; this.textContent=""; this.value=""; this.type=""; this.files=[]; }
  createEl(tag, opts={}) { const e=new Element(tag); if(opts.text) e.textContent=opts.text; if(opts.cls) e.addClass(opts.cls); if(opts.type) e.type=opts.type; if(opts.href) e.href=opts.href; if(tag==="canvas"){e.getContext=()=>({drawImage(){}});e.toBlob=cb=>cb(new Blob(["jpeg"],{type:"image/jpeg"}));} this.appendChild(e); return e; }
  createDiv(opts={}) { return this.createEl("div", opts); }
  appendChild(e) { e.parentElement=this; this.children.push(e); return e; }
  empty() { this.children=[]; this.textContent=""; }
  setText(v) { this.textContent=v; return this; }
  setAttr(k,v) { this.attributes[k]=String(v); return this; }
  getAttribute(k) { return this.attributes[k] ?? null; }
  addClass(v) { this.classList.add(v); return this; } removeClass(v) { this.classList.remove(v); return this; }
  addEventListener(k,fn) { (this.listeners[k]??=[]).push(fn); }
  removeEventListener(k,fn) { this.listeners[k]=(this.listeners[k]??[]).filter(f=>f!==fn); }
  dispatchEvent(e) { for(const fn of this.listeners[e.type]??[]) fn(e); return true; }
  click() { this.dispatchEvent({type:"click"}); }
  querySelectorAll(tag) { const out=[]; const walk=e=>{ for(const c of e.children) { if(c.tagName===tag.toUpperCase()) out.push(c); walk(c); } }; walk(this); return out; }
}
export class Modal { constructor(app){this.app=app;this.modalEl=new Element("div");this.titleEl=new Element("h2");this.contentEl=new Element("div");this.modalEl.appendChild(this.titleEl);this.modalEl.appendChild(this.contentEl);} open(){this.onOpen?.();} close(){this.onClose?.();} }
export class TFile { constructor(path){this.path=path;} }
export class TFolder { constructor(path){this.path=path;} }
export const normalizePath=(value)=>value.split("\\").join("/").replace(/^\/+|\/+$/g,"");
export class App {}
export class Platform { static isMobile=false; }
export class Notice { constructor(message){Notice.messages.push(message);} static messages=[]; }
export class PluginSettingTab { constructor(app,plugin){this.app=app;this.plugin=plugin;this.containerEl=new Element("div");} }
class Component { onChange(fn){this.change=fn;return this;} setValue(v){this.value=v;return this;} }
export class SecretComponent extends Component { constructor(app,el){super();this.app=app;this.el=el;SecretComponent.instances.push(this);} static instances=[]; }
export class Setting { constructor(container){this.container=container;this.controlEl=container.createDiv({cls:"setting-item"});Setting.instances.push(this);} static instances=[]; setName(n){this.name=n;return this;} setHeading(){return this;} setDesc(d){this.desc=d;return this;} addDropdown(fn){const d=new Component();d.selectEl=new Element("select");d.addOption=()=>d;d.setValue=v=>{d.value=v;return d};d.onChange=f=>{d.change=f;return d};fn(d);this.dropdown=d;return this;} addComponent(fn){this.component=fn(new Element("input"));return this;} addText(fn){const t=new Component();t.setPlaceholder=v=>{t.placeholder=v;return t};t.setValue=v=>{t.value=v;return t};t.onChange=f=>{t.change=f;return t};fn(t);this.text=t;return this;} addButton(fn){const b=new Component();b.setButtonText=v=>{b.text=v;return b};b.onClick=f=>{b.click=f;return b};fn(b);this.button=b;return this;} }
export let requestUrlHandler=async()=>({status:200,json:{}});
export const setRequestUrlHandler=(handler)=>{requestUrlHandler=handler};
export const requestUrl=async(...args)=>requestUrlHandler(...args);
export const setIcon=()=>{};
export const Plugin=class {};
export { Element };
`;
fs.writeFileSync(entry, source);
const pkg = JSON.parse(fs.readFileSync(packageFile,"utf8"));
pkg.main="index.js";
fs.writeFileSync(packageFile, JSON.stringify(pkg));
globalThis.document={body:new (await import(entry+"?x="+Date.now())).Element("body")};
globalThis.Image=class { width=2; height=2; set src(_){queueMicrotask(()=>this.onload?.())} };
globalThis.btoa=(value)=>Buffer.from(value,"binary").toString("base64");
// The test-only module above is generated in node_modules at test startup.
