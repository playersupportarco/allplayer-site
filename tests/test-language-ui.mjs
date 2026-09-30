import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { siteLanguage, englishUI } from '../language.mjs';
const english = JSON.parse(await readFile(new URL('../locales/en.json', import.meta.url)));
const flush = () => new Promise(resolve => setImmediate(resolve));
let sequence = 0;

async function setup({saved, browser = ['en'], storageBlocked = false, fetcher} = {}) {
    class Element extends EventTarget {
        constructor(text = '') { super(); this.textContent=text; this.dataset={}; this.hidden=true; this.options=[]; this.value=''; }
        append(option) { this.options.push(option); }
        setAttribute() {}
    }
    const selector=new Element(), error=new Element(), title=new Element(english.home_title);
    title.dataset.copy='home_title';
    const values=new Map(saved ? [['allplayer-site-language', saved]] : []);
    globalThis.document = {
        documentElement:{lang:'en'},
        querySelector: query => query === '[data-language-select]' ? selector : query === '[data-language-error]' ? error : null,
        querySelectorAll: query => query === '[data-copy], [data-i18n]' ? [title] : [],
        createElement: () => new Element()
    };
    globalThis.window=new EventTarget();
    globalThis.location={hash:''};
    Object.defineProperty(globalThis,'navigator',{configurable:true,value:{languages:browser,language:browser[0]}});
    globalThis.localStorage={
        getItem:key=>{if(storageBlocked)throw new Error('blocked');return values.get(key)||null;},
        setItem:(key,value)=>{if(storageBlocked)throw new Error('blocked');values.set(key,value);}
    };
    globalThis.fetch=fetcher || (async url => ({ok:true,json:async()=>({...english,home_title:new URL(url).pathname.split('/').pop()})}));
    siteLanguage.language='en';siteLanguage.messages=englishUI;
    await import(`../script.js?test=${++sequence}`);
    await flush();
    return {selector,error,title,values,choose: async value=>{selector.value=value;selector.dispatchEvent(new Event('change'));await flush();}};
}

test('manual choice persists, auto resumes browser language', async()=>{
    const ui=await setup({browser:['fr-CA']});
    assert.equal(document.documentElement.lang,'fr');
    assert.equal(ui.selector.value,'auto');
    await ui.choose('ja');
    assert.equal(document.documentElement.lang,'ja');
    assert.equal(ui.values.get('allplayer-site-language'),'ja');
    await ui.choose('auto');
    assert.equal(document.documentElement.lang,'fr');
    assert.equal(ui.values.get('allplayer-site-language'),'auto');
});
test('saved legacy preference wins, storage denial does not break switching',async()=>{
    const saved=await setup({saved:'zh',browser:['fr']});
    assert.equal(document.documentElement.lang,'zh-Hans');
    assert.equal(saved.selector.value,'zh-Hans');
    const blocked=await setup({storageBlocked:true});
    await blocked.choose('ja');
    assert.equal(document.documentElement.lang,'ja');
    assert.equal(blocked.error.hidden,true);
});
test('failed locale stays readable, reports error and retries',async()=>{
    let fail=true;
    const ui=await setup({fetcher:async()=>{if(fail)throw new Error('offline');return {ok:true,json:async()=>english};}});
    await ui.choose('ja');
    assert.equal(document.documentElement.lang,'en');
    assert.equal(ui.error.hidden,false);
    assert.equal(ui.values.has('allplayer-site-language'),false);
    fail=false;
    await ui.choose('ja');
    assert.equal(document.documentElement.lang,'ja');
    assert.equal(ui.error.hidden,true);
});
test('slow previous selection cannot replace newer selection',async()=>{
    const resolvers=new Map();
    const ui=await setup({fetcher:url=>new Promise(resolve=>resolvers.set(new URL(url).pathname.split('/').pop(),resolve))});
    await ui.choose('fr');await ui.choose('ja');
    resolvers.get('ja.json')({ok:true,json:async()=>({...english,home_title:'日本語'})});await flush();
    resolvers.get('fr.json')({ok:true,json:async()=>({...english,home_title:'Français'})});await flush();
    assert.equal(document.documentElement.lang,'ja');
    assert.equal(ui.title.textContent,'日本語');
    assert.equal(ui.values.get('allplayer-site-language'),'ja');
});
