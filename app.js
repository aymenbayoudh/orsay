'use strict';
const $=id=>document.getElementById(id), norm=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const compact=s=>norm(s).replace(/\s/g,'');
const collator=new Intl.Collator('fr',{numeric:true});
let data=[],rooms=[],favoriteOnly=false,limit=80,randomId=null,view='list',favorites=new Set();
try{const v=JSON.parse(localStorage.getItem('orsay-favorites')||'[]');if(Array.isArray(v))favorites=new Set(v.filter(x=>typeof x==='string'));view=localStorage.getItem('orsay-view')==='grid'?'grid':'list';}catch{}
const roomLabel=r=>/^\d/.test(r)?'Salle '+r:r;
const ranks={'Rez-de-chaussée':0,'Niveau médian':2,'Niveau 3':3,'Niveau 4':4,'Niveau supérieur':5};
const floorLabel=f=>({'Rez-de-chaussée':'0 · Rez-de-chaussée','Niveau médian':'2 · Niveau médian','Niveau supérieur':'5 · Niveau supérieur'})[f]||f;
function roomMatches(r,q){if(!q)return true;const query=compact(q).replace(/^salles?/,'');if(/^\d+$/.test(query)){return (/^\d|^salles?\s/i.test(r.label))&&(r.label.match(/\d+/g)||[]).includes(query);}return compact(r.label).includes(query);}
function roomList(){const f=$('floor').value,q=$('roomsearch').value.trim();return rooms.filter(r=>(!f||r.floor===f)&&roomMatches(r,q));}
function option(value,text){const o=document.createElement('option');o.value=value;o.textContent=text;return o;}
function roomOptions(){const current=$('room').value;const available=rooms.filter(r=>!$('floor').value||r.floor===$('floor').value);$('room').replaceChildren(option('','Toutes les salles'),...available.map(r=>option(r.id,r.label)));if(available.some(r=>r.id===current))$('room').value=current;}
function selection(){const f=$('floor').value,r=rooms.find(r=>r.id===$('room').value),rq=$('roomsearch').value.trim(),q=norm($('search').value.trim());const allowed=new Set(roomList().flatMap(r=>r.sources));return data.filter(a=>(r?r.sources.includes(a.room):(!f&&!rq)||allowed.has(a.room))&&(!q||norm(a.title+' '+a.artist).includes(q))&&(!favoriteOnly||favorites.has(a.id)));}
function element(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
function card(a){
 const row=element('article','work');row.dataset.id=a.id;
 const link=element('a','work-link');link.href=a.url;link.target='_blank';link.rel='noopener';link.setAttribute('aria-label',a.title+' — '+a.artist+' · fiche officielle');
 const media=element('div','work-media');
 if(a.image){const img=element('img');img.src=a.image;img.alt=a.title;img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';img.onerror=()=>{media.replaceChildren(element('span','image-missing','Image non disponible'));media.classList.add('no-image');};media.append(img);}else{media.classList.add('no-image');media.append(element('span','image-missing','Image non disponible'));}
 const title=element('h3','',a.title);title.append(element('span','link-arrow',' ->'));
 link.append(media,title,element('div','artist',a.artist));
 const bottom=element('div','card-bottom');bottom.append(element('div','location',a.floor+' · '+roomLabel(a.room)));
 const heart=element('button','heart',favorites.has(a.id)?'♥':'♡');heart.setAttribute('aria-pressed',String(favorites.has(a.id)));heart.setAttribute('aria-label',(favorites.has(a.id)?'Retirer des favoris : ':'Ajouter aux favoris : ')+a.title);
 heart.onclick=()=>{const remove=favorites.has(a.id);if(remove)favorites.delete(a.id);else favorites.add(a.id);try{localStorage.setItem('orsay-favorites',JSON.stringify([...favorites]));}catch{$('updated').textContent='Le navigateur ne permet pas d’enregistrer vos favoris.';}if(favoriteOnly){render();return;}heart.textContent=remove?'♡':'♥';heart.setAttribute('aria-pressed',String(!remove));heart.setAttribute('aria-label',(remove?'Ajouter aux favoris : ':'Retirer des favoris : ')+a.title);$('favcount').textContent=favorites.size;};
 bottom.append(heart);row.append(link,bottom);return row;
}
function render(){
 $('favcount').textContent=favorites.size;$('favorites').setAttribute('aria-pressed',String(favoriteOnly));$('listview').setAttribute('aria-pressed',String(view==='list'));$('gridview').setAttribute('aria-pressed',String(view==='grid'));
 const r=rooms.find(r=>r.id===$('room').value),matches=selection();if(randomId&&!matches.some(a=>a.id===randomId))randomId=null;
 const displayed=randomId?matches.filter(a=>a.id===randomId):matches.slice(0,limit);
 $('heading').textContent=randomId?'Au hasard':favoriteOnly?'Mes favoris':r?r.label:$('floor').value?floorLabel($('floor').value):'Toutes les salles';
 $('count').textContent=randomId?'1 œuvre · '+matches.length+' dans la sélection':matches.length+' œuvre'+(matches.length!==1?'s':'');
 $('works').className=randomId?'works-grid random-work':'works-'+view;$('works').replaceChildren(...displayed.map(card));
 if(!matches.length)$('works').append(element('p','empty',r?'Aucune œuvre n’est localisée ici dans le catalogue consulté.':favoriteOnly?'Aucun favori ne correspond à cette sélection.':'Aucune œuvre ne correspond à cette recherche.'));
 $('roomnote').hidden=!r?.note;$('roomnote').textContent=r?.note||'';$('more').hidden=!!randomId||matches.length<=limit;$('allresults').hidden=!randomId;$('random').disabled=!matches.length;
 const available=roomList();$('rooms').replaceChildren(...available.map(room=>{const b=element('button','',room.label);b.setAttribute('aria-pressed',String(room.id===r?.id));b.onclick=()=>{$('room').value=room.id;changed();};return b;}));
 $('navigation').hidden=!r||!!randomId;const i=available.findIndex(x=>x.id===r?.id);$('prev').disabled=i<=0;$('next').disabled=i<0||i>=available.length-1;
 $('prev').onclick=()=>{if(i>0){$('room').value=available[i-1].id;changed();}};$('next').onclick=()=>{if(i>=0&&i<available.length-1){$('room').value=available[i+1].id;changed();}};
}
function changed(){limit=80;randomId=null;render();}
function setView(v){view=v;try{localStorage.setItem('orsay-view',v);}catch{}render();}
$('listview').onclick=()=>setView('list');$('gridview').onclick=()=>setView('grid');
$('floor').onchange=()=>{roomOptions();changed();};for(const id of ['room','search','roomsearch'])$(id).addEventListener(id==='room'?'change':'input',()=>{if(id==='roomsearch')$('room').value='';changed();});
$('favorites').onclick=()=>{favoriteOnly=!favoriteOnly;if(favoriteOnly){for(const id of ['floor','room','search','roomsearch'])$(id).value='';roomOptions();}changed();};
$('reset').onclick=()=>{for(const id of ['floor','room','search','roomsearch'])$(id).value='';favoriteOnly=false;roomOptions();changed();};$('more').onclick=()=>{limit+=80;render();};
$('random').onclick=()=>{let pool=selection();if(pool.length>1)pool=pool.filter(a=>a.id!==randomId);if(!pool.length)return;randomId=pool[Math.floor(Math.random()*pool.length)].id;render();};$('allresults').onclick=()=>{randomId=null;render();};
fetch('data.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(d=>{data=d.artworks;rooms=d.rooms||[...new Set(data.map(a=>a.room))].map(r=>({id:r,label:roomLabel(r),floor:data.find(a=>a.room===r).floor,sources:[r],note:''}));rooms.sort((a,b)=>(ranks[a.floor]??9)-(ranks[b.floor]??9)||collator.compare(a.label,b.label));const floors=[...new Set(rooms.map(r=>r.floor))].sort((a,b)=>(ranks[a]??9)-(ranks[b]??9));$('floor').append(...floors.map(f=>option(f,floorLabel(f))));roomOptions();$('updated').textContent='Catalogue relevé le '+d.updated.split('-').reverse().join('/')+' · '+data.length+' œuvres.';render();}).catch(()=>{$('count').textContent='Impossible de charger les œuvres. Rechargez la page pour réessayer.';});
