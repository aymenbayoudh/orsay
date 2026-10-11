const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert'),zlib=require('zlib');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(root+'/index.html','utf8'),code=fs.readFileSync(root+'/app.js','utf8'),dataset=JSON.parse(fs.readFileSync(root+'/data.json'));
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
class El{constructor(tag='div'){this.tag=tag;this.children=[];this.value='';this.style={};this.dataset={};this.attrs={};this.events={};this.classList={add(){}};}append(...c){this.children.push(...c);}replaceChildren(...c){this.children=c;if(this.tag==='select')this.value='';}setAttribute(k,v){this.attrs[k]=v;}addEventListener(k,v){this.events[k]=v;}click(){}remove(){}}
const storage=new Map();
async function start({large=false,failOnce=false}={}){
 const es=Object.fromEntries(ids.map(id=>[id,new El(['room','floor'].includes(id)?'select':'div')])),main=new El();main.getBoundingClientRect=()=>({top:-350});
 const win={scrollY:500,innerHeight:800,scrollTo:({top})=>win.scrollY=top};let blob,requested=[];
 const outside=Array.from({length:large?130001:2},(_,i)=>({id:'outside-'+i,title:'Œuvre hors salles '+i,artist:'Auteur',url:'https://www.musee-orsay.fr/fr/oeuvres/test',date:'1913'}));
 const chunks=[];for(let i=0;i<outside.length;i+=3000)chunks.push(outside.slice(i,i+3000));
 const context=vm.createContext({Blob,Response,DecompressionStream,Date,Intl,Set,Math,setTimeout:()=>{},clearTimeout:()=>{},window:win,
 URL:{createObjectURL:b=>{blob=b;return 'blob:test';},revokeObjectURL(){}},
 document:{querySelector:()=>main,body:new El(),getElementById:id=>{assert(es[id],id);return es[id];},createElement:tag=>new El(tag)},
 localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
 fetch:async url=>{requested.push(url);if(url==='data.json')return {ok:true,json:async()=>JSON.parse(JSON.stringify(dataset))};if(url==='catalogue/manifest.json')return {ok:true,json:async()=>({updated:'2026-10-11',complete:false,expectedOutside:170190-2058,outside:outside.length,parts:chunks.map((c,i)=>({file:'part-'+i+'.json',count:c.length}))})};if(failOnce){failOnce=false;return {ok:false};}const n=Number(url.match(/part-(\d+)/)[1]);return new Response(zlib.gzipSync(JSON.stringify(chunks[n])));}
 });
 vm.runInContext(code,context);await new Promise(setImmediate);return{es,main,win,run:s=>vm.runInContext(s,context),requested,getBlob:()=>blob};
}
(async()=>{
 let t=await start(),{es,run}=t;assert.equal(run('selection().length'),2058);assert.equal(es.works.children.length,80);assert(!t.requested.some(s=>s.startsWith('catalogue/')));
 assert(es.floor.children.some(o=>o.value==='Hors salles d’Orsay'));es.room.value='43';es.room.events.change();assert(run('selection().every(a=>a.room==="Galerie Françoise Cachin")'));assert(!es.roomnote.hidden);es.roomsearch.value='8a';es.roomsearch.events.input();assert.equal(es.room.value,'');assert.equal(run('selection().length'),0);assert(es.random.disabled);es.reset.onclick();
 es.gridview.onclick();assert.equal(storage.get('orsay-view'),'grid');es.random.onclick();assert.equal(es.works.children.length,1);assert.equal(t.win.scrollY,500);assert.equal(t.main.style.minHeight,'1150px');const first=run('randomId');es.random.onclick();assert.notEqual(run('randomId'),first);const chosen=run('randomId');es.works.children[0].children[1].children[1].onclick();assert(JSON.parse(storage.get('orsay-favorites')).includes(chosen));await es.favorites.onclick();assert.equal(run('selection().length'),1);assert(!es['favorite-tools'].hidden);
 await run('loadCatalogue()');assert.equal(run('data.length'),2060);es.reset.onclick();assert.equal(run('selection().length'),2058);es.floor.value='Hors salles d’Orsay';es.floor.onchange();assert.equal(run('selection().length'),2);assert(es.roomnote.textContent.includes('Catalogue partiel'));
 const copy=es.works.children[0].children[0].children[1];assert.equal(copy.children[0].children[0].textContent,'Auteur');assert.equal(copy.children[0].children[1].textContent,'Œuvre hors salles 0');assert.equal(copy.children[1].textContent,'1913');
 run('importFavorites({format:"orsay-favorites",version:1,favorites:["outside-0","outside-0","unknown"]})');assert.equal(run('favorites.size'),2);assert.throws(()=>run('importFavorites({favorites:[42]})'));assert.equal(run('favorites.size'),2);await es.favorites.onclick();assert.equal(run('selection().length'),2);es['export-favorites'].onclick();const exported=JSON.parse(await t.getBlob().text());assert.equal(exported.format,'orsay-favorites');assert(exported.favorites.includes('outside-0'));run('importFavorites({format:"orsay-favorites",version:1,favorites:["999999999"]})');assert(run('favorites.has("999999999")'));assert(es['transfer-status'].textContent.includes('en attente'));storage.set('orsay-favorites',JSON.stringify(exported.favorites));
 t=await start({failOnce:true});assert(t.run('favorites.has("outside-0")'));await assert.rejects(t.run('loadCatalogue()'));assert(!t.run('catalogueLoaded'));assert.equal(t.run('data.length'),2058);await t.run('loadCatalogue()');assert(t.run('catalogueLoaded'));assert.equal(t.run('data.length'),2060);
 storage.clear();t=await start({large:true});await t.run('loadCatalogue()');assert.equal(t.run('data.length'),132059);assert.equal(t.run('selection().length'),2058);t.es.floor.value='Hors salles d’Orsay';t.es.floor.onchange();assert.equal(t.run('selection().length'),130001);assert.equal(t.es.works.children.length,80);
 assert(!html.includes('-&gt;'));assert(fs.readFileSync(root+'/style.css','utf8').includes('--accent:#e9b9ca'));
 console.log('PASS: initial lazy loading; physical rooms; compressed catalogue; 130001 outside notices; failed-load recovery; artist/title/date layout; list/grid; stable random scroll; favorites export, import, merge and reload.');
})().catch(e=>{console.error(e);process.exit(1)});
