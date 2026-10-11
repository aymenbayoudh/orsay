'use strict';
const $=id=>document.getElementById(id), norm=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const compact=s=>norm(s).replace(/\s/g,'');
const collator=new Intl.Collator('fr',{numeric:true});
const OUTSIDE='Hors salles d’Orsay',OUTSIDE_ROOM='Catalogue hors salles';
let cataloguePromise=null,catalogueLoaded=false,catalogueLoading=false,catalogueError='',baseCount=0,physicalUpdated='',catalogueMeta=null;
const loadedParts=new Map();
let data=[],rooms=[],favoriteOnly=false,randomId=null,view='list',favorites=new Set();
try{const v=JSON.parse(localStorage.getItem('orsay-favorites')||'[]');if(Array.isArray(v))favorites=new Set(v.filter(x=>typeof x==='string'));view=localStorage.getItem('orsay-view')==='grid'?'grid':'list';}catch{}
const artworkLocation=a=>a.floor===OUTSIDE?(a.conservation?('Non exposée à Orsay · '+a.conservation):'Hors salles · localisation à vérifier'):a.floor+' · '+roomLabel(a.room);
const roomLabel=r=>/^\d/.test(r)?'Salle '+r:r;
const ranks={'Rez-de-chaussée':0,'Niveau médian':2,'Niveau 3':3,'Niveau 4':4,'Niveau supérieur':5};
const floorLabel=f=>f===OUTSIDE?OUTSIDE+' · catalogue partiel':({'Rez-de-chaussée':'0 · Rez-de-chaussée','Niveau médian':'2 · Niveau médian','Niveau supérieur':'5 · Niveau supérieur'})[f]||f;
function roomMatches(r,q){if(!q)return true;const query=compact(q).replace(/^salles?/,'');if(/^\d+$/.test(query)){return (/^\d|^salles?\s/i.test(r.label))&&(r.label.match(/\d+/g)||[]).includes(query);}return compact(r.label).includes(query);}
function roomList(){const f=$('floor').value,q=$('roomsearch').value.trim();return rooms.filter(r=>(f?r.floor===f:r.floor!==OUTSIDE||favoriteOnly)&&roomMatches(r,q));}
function option(value,text){const o=document.createElement('option');o.value=value;o.textContent=text;return o;}
function roomOptions(){const current=$('room').value;const available=rooms.filter(r=>$('floor').value?r.floor===$('floor').value:r.floor!==OUTSIDE||favoriteOnly);$('room').replaceChildren(option('','Toutes les salles'),...available.map(r=>option(r.id,r.label)));if(available.some(r=>r.id===current))$('room').value=current;}
function selection(){const f=$('floor').value,r=rooms.find(r=>r.id===$('room').value),rq=$('roomsearch').value.trim(),q=norm($('search').value.trim());const allowed=new Set(roomList().flatMap(r=>r.sources));return data.filter(a=>(a.floor!==OUTSIDE||f===OUTSIDE||favoriteOnly)&&(r?r.sources.includes(a.room):(!f&&!rq)||allowed.has(a.room))&&(!q||norm(a.title+' '+a.artist+' '+(a.inventory||'')).includes(q))&&(!favoriteOnly||favorites.has(a.id)));}
function element(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
function heartIcon(){const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),path=document.createElementNS(ns,'path');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.setAttribute('class','heart-icon');path.setAttribute('d','M12 20.5C10.2 19.1 3 14.3 3 8.5A5 5 0 0 1 12 5.5a5 5 0 0 1 9 3c0 5.8-7.2 10.6-9 12Z');svg.append(path);return svg;}
$('favorites').prepend(heartIcon());
function card(a){
 const row=element('article','work');row.dataset.id=a.id;
 const link=element('a','work-link');link.href=a.url;link.target='_blank';link.rel='noopener';link.setAttribute('aria-label',a.title+' — '+a.artist+' · fiche officielle');
 const media=element('div','work-media');
 if(a.image){const img=element('img');img.src=a.image;img.alt=a.title;img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';img.onerror=()=>{media.replaceChildren(element('span','image-missing','Image non disponible'));media.classList.add('no-image');};media.append(img);}else{media.classList.add('no-image');media.append(element('span','image-missing','Image non disponible'));}
 const copy=element('div','work-copy'),heading=element('h3','work-heading');heading.append(element('span','artist',a.artist),element('span','work-title',a.title));copy.dataset.location=artworkLocation(a);copy.append(heading);if(a.date)copy.append(element('div','work-date',a.date));link.append(media,copy);
 const bottom=element('div','card-bottom');bottom.append(element('div','location',artworkLocation(a)));
 const heart=element('button','heart');heart.append(heartIcon());heart.setAttribute('aria-pressed',String(favorites.has(a.id)));heart.setAttribute('aria-label',(favorites.has(a.id)?'Retirer des favoris : ':'Ajouter aux favoris : ')+a.title);
 heart.onclick=()=>{const remove=favorites.has(a.id);if(remove)favorites.delete(a.id);else favorites.add(a.id);try{localStorage.setItem('orsay-favorites',JSON.stringify([...favorites]));}catch{$('updated').textContent='Le navigateur ne permet pas d’enregistrer vos favoris.';}if(favoriteOnly){render();return;}heart.setAttribute('aria-pressed',String(!remove));heart.setAttribute('aria-label',(remove?'Ajouter aux favoris : ':'Retirer des favoris : ')+a.title);$('favcount').textContent=favorites.size;};
 bottom.append(heart);row.append(link,bottom);return row;
}
function render(){
 $('favorite-tools').hidden=!favoriteOnly;$('export-favorites').disabled=!favorites.size;$('favcount').textContent=favorites.size;$('favorites').setAttribute('aria-pressed',String(favoriteOnly));$('listview').setAttribute('aria-pressed',String(view==='list'));$('gridview').setAttribute('aria-pressed',String(view==='grid'));
 const r=rooms.find(r=>r.id===$('room').value),matches=selection(),outside=$('floor').value===OUTSIDE;const noun=outside?'notice':'œuvre';if(physicalUpdated){const updated=outside&&catalogueMeta?catalogueMeta.updated:physicalUpdated;const count=outside&&catalogueMeta?catalogueMeta.outside:baseCount;$('updated').textContent='Catalogue relevé le '+updated.split('-').reverse().join('/')+' · '+count.toLocaleString('fr')+' '+(outside&&catalogueMeta?'notices hors salles':'œuvres des salles')+'.';}if(randomId&&!matches.some(a=>a.id===randomId))randomId=null;
 const displayed=randomId?matches.filter(a=>a.id===randomId):matches;
 $('heading').textContent=randomId?'Au hasard':favoriteOnly?'Mes favoris':r?r.label:$('floor').value?floorLabel($('floor').value):'Toutes les salles';
 $('count').textContent=catalogueLoading&&$('floor').value===OUTSIDE?'Chargement du catalogue…':randomId?'1 '+noun+' · '+matches.length.toLocaleString('fr')+' dans la sélection':matches.length.toLocaleString('fr')+' '+noun+(matches.length!==1?'s':'');
 $('works').className=randomId?'works-grid random-work':'works-'+view;const fragment=document.createDocumentFragment();for(const artwork of displayed)fragment.append(card(artwork));$('works').replaceChildren(fragment);
 if(!matches.length)$('works').append(element('p','empty',catalogueLoading&&$('floor').value===OUTSIDE?'Les notices sont chargées à la demande.':catalogueError&&$('floor').value===OUTSIDE?'Le chargement a échoué. Utilisez Réessayer ci-dessus.':r?'Aucune œuvre n’est localisée ici dans le catalogue consulté.':favoriteOnly?'Aucun favori ne correspond à cette sélection.':'Aucune œuvre ne correspond à cette recherche.'));
 const partial=catalogueMeta?.complete===false?'Catalogue partiel : '+catalogueMeta.outside.toLocaleString('fr')+' notices récupérées sur '+catalogueMeta.expectedOutside.toLocaleString('fr')+' attendues hors salles. ':'';const note=(outside?partial:'')+(r?.note||($('floor').value===OUTSIDE?'Notices absentes de la sélection des salles : œuvres non exposées à Orsay, dépôts ailleurs ou localisation non précisée. Consultez la fiche officielle pour leur statut exact.':''));$('roomnote').hidden=!note;$('roomnote').textContent=note;$('retry-catalogue').hidden=!catalogueError||$('floor').value!==OUTSIDE;$('allresults').hidden=!randomId;$('random').disabled=!matches.length;
 const available=roomList();$('rooms').replaceChildren(...available.map(room=>{const b=element('button','',room.label);b.setAttribute('aria-pressed',String(room.id===r?.id));b.onclick=()=>{$('room').value=room.id;changed();};return b;}));
 $('navigation').hidden=!r||!!randomId;const i=available.findIndex(x=>x.id===r?.id);$('prev').disabled=i<=0;$('next').disabled=i<0||i>=available.length-1;
 $('prev').onclick=()=>{if(i>0){$('room').value=available[i-1].id;changed();}};$('next').onclick=()=>{if(i>=0&&i<available.length-1){$('room').value=available[i+1].id;changed();}};
}
function changed(){document.querySelector('main').style.minHeight='';randomId=null;render();}
function setView(v){view=v;try{localStorage.setItem('orsay-view',v);}catch{}render();}
$('listview').onclick=()=>setView('list');$('gridview').onclick=()=>setView('grid');
$('floor').onchange=()=>{roomOptions();changed();if($('floor').value===OUTSIDE)loadCatalogue().catch(()=>{});};let searchTimer;for(const id of ['room','search','roomsearch'])$(id).addEventListener(id==='room'?'change':'input',()=>{if(id==='roomsearch')$('room').value='';if(id==='search'){clearTimeout(searchTimer);searchTimer=setTimeout(changed,180);}else changed();});
$('favorites').onclick=async()=>{favoriteOnly=!favoriteOnly;if(favoriteOnly){for(const id of ['floor','room','search','roomsearch'])$(id).value='';roomOptions();}changed();const known=new Set(data.map(a=>a.id));if(favoriteOnly&&[...favorites].some(id=>!known.has(id)))try{await loadCatalogue();}catch{ $('transfer-status').textContent='Certains favoris nécessitent le catalogue hors salles. Réessayez son chargement.';}};
$('reset').onclick=()=>{for(const id of ['floor','room','search','roomsearch'])$(id).value='';favoriteOnly=false;roomOptions();changed();};
$('random').onclick=()=>{let pool=selection();if(pool.length>1)pool=pool.filter(a=>a.id!==randomId);if(!pool.length)return;const y=window.scrollY,main=document.querySelector('main');main.style.minHeight=Math.max(0,window.innerHeight-main.getBoundingClientRect().top)+'px';randomId=pool[Math.floor(Math.random()*pool.length)].id;render();window.scrollTo({top:y,left:0,behavior:'instant'});};$('allresults').onclick=()=>{document.querySelector('main').style.minHeight='';randomId=null;render();};
fetch('data.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(d=>{data=d.artworks;baseCount=data.length;physicalUpdated=d.updated;rooms=d.rooms||[...new Set(data.map(a=>a.room))].map(r=>({id:r,label:roomLabel(r),floor:data.find(a=>a.room===r).floor,sources:[r],note:''}));rooms.push({id:'outside',label:'Hors salles / autres localisations',floor:OUTSIDE,sources:[OUTSIDE_ROOM],note:'Notices absentes de la sélection des salles : œuvres non exposées à Orsay, dépôts ailleurs ou localisation non précisée. La fiche officielle indique leur statut exact.'});rooms.sort((a,b)=>(ranks[a.floor]??9)-(ranks[b.floor]??9)||collator.compare(a.label,b.label));const floors=[...new Set(rooms.map(r=>r.floor))].sort((a,b)=>(ranks[a]??9)-(ranks[b]??9));$('floor').append(...floors.map(f=>option(f,floorLabel(f))));roomOptions();$('updated').textContent='Catalogue relevé le '+d.updated.split('-').reverse().join('/')+' · '+data.length+' œuvres.';render();}).catch(()=>{$('count').textContent='Impossible de charger les œuvres. Rechargez la page pour réessayer.';});

function importFavorites(payload){
 const ids=Array.isArray(payload)?payload:payload?.format==='orsay-favorites'&&payload.version===1?payload.favorites:null;
 if(!Array.isArray(ids)||ids.some(id=>typeof id!=='string')||ids.length>250000)throw Error('Choisissez un fichier de favoris Orsay exporté depuis le site.');
 const known=new Set(data.map(a=>a.id)),next=new Set(favorites);let added=0,unknown=0,pending=0;
 for(const id of new Set(ids)){if(!known.has(id)){if(catalogueMeta?.complete===false&&/^\d+$/.test(id)){if(!next.has(id)){next.add(id);pending++;}}else unknown++;continue;}if(!next.has(id)){next.add(id);added++;}}
 localStorage.setItem('orsay-favorites',JSON.stringify([...next]));favorites=next;changed();
 $('transfer-status').textContent=added+' favori'+(added!==1?'s':'')+' ajouté'+(added!==1?'s':'')+'.'+(pending?' '+pending+' favori'+(pending!==1?'s':'')+' conservé'+(pending!==1?'s':'')+' en attente du catalogue complet.':'')+(unknown?' '+unknown+' œuvre'+(unknown!==1?'s':'')+' absente'+(unknown!==1?'s':'')+' du catalogue actuel.':'');
 return {added,unknown,pending};
}
$('export-favorites').onclick=()=>{
 const payload={format:'orsay-favorites',version:1,exportedAt:new Date().toISOString(),favorites:[...favorites]};
 const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'})),link=element('a');link.href=url;link.download='orsay-favoris-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
 $('transfer-status').textContent='Fichier exporté. Transférez-le sur l’autre appareil, puis choisissez Importer dans Mes favoris.';
};
$('import-favorites').onclick=()=>$('favorites-file').click();
$('favorites-file').onchange=async()=>{
 const file=$('favorites-file').files[0];if(!file)return;
 try{if(file.size>10000000)throw Error('Le fichier est trop volumineux.');const text=await file.text();let payload;try{payload=JSON.parse(text);}catch{throw Error('Ce fichier n’est pas un fichier de favoris JSON valide.');}const ids=Array.isArray(payload)?payload:payload?.favorites,known=new Set(data.map(a=>a.id));if(Array.isArray(ids)&&ids.some(id=>typeof id==='string'&&!known.has(id))&&!catalogueLoaded){$('transfer-status').textContent='Chargement du catalogue pour retrouver vos favoris…';await loadCatalogue();}importFavorites(payload);}
 catch(error){$('transfer-status').textContent=error.message;}
 finally{$('favorites-file').value='';}
};

function loadCatalogue(){
 if(catalogueLoaded)return Promise.resolve();if(cataloguePromise)return cataloguePromise;
 catalogueLoading=true;catalogueError='';render();
 cataloguePromise=(async()=>{
  const response=await fetch('catalogue/manifest.json',{cache:'no-cache'});if(!response.ok)throw Error('Catalogue indisponible');const manifest=await response.json();
  let next=0,done=0;const results=new Array(manifest.parts.length);
  async function worker(){
   while(next<manifest.parts.length){const i=next++,part=manifest.parts[i];let rows=loadedParts.get(part.file);
    if(!rows){let response;
     if(typeof DecompressionStream!=='undefined'){response=await fetch('catalogue/'+part.file+'.gz');if(!response.ok)throw Error('Notice indisponible');rows=await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json();}
     else{response=await fetch('catalogue/'+part.file);if(!response.ok)throw Error('Notice indisponible');rows=await response.json();}
     if(!Array.isArray(rows)||rows.length!==part.count)throw Error('Catalogue incomplet');loadedParts.set(part.file,rows);
    }
    results[i]=rows;done++;if($('floor').value===OUTSIDE)$('count').textContent='Chargement du catalogue · '+Math.round(done/manifest.parts.length*100)+' %';
   }
  }
  const tasks=Array.from({length:4},worker);const settled=await Promise.allSettled(tasks);const failure=settled.find(r=>r.status==='rejected');if(failure)throw failure.reason;
  const ids=new Set(data.map(a=>a.id)),additional=[];
  for(const part of results)for(const a of part){if(ids.has(a.id))throw Error('Doublon dans le catalogue');ids.add(a.id);additional.push({...a,floor:OUTSIDE,room:OUTSIDE_ROOM});}
  if(additional.length!==manifest.outside)throw Error('Catalogue incomplet');for(const a of additional)data.push(a);catalogueLoaded=true;catalogueMeta=manifest;loadedParts.clear();
 })().catch(error=>{catalogueError=error.message;throw error;}).finally(()=>{catalogueLoading=false;cataloguePromise=null;render();});
 return cataloguePromise;
}
$('retry-catalogue').onclick=()=>loadCatalogue().catch(()=>{});
