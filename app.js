'use strict';
const $=id=>document.getElementById(id), norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
let data=[],favoriteOnly=false,limit=80,favorites=new Set();
try{const v=JSON.parse(localStorage.getItem('orsay-favorites')||'[]');if(Array.isArray(v))favorites=new Set(v.filter(x=>typeof x==='string'));}catch{}
const collator=new Intl.Collator('fr',{numeric:true});
const roomLabel=r=>/^\d/.test(r)?'Salle '+r:r;
const roomMatches=(r,q)=>!q||(/^\d+$/.test(q)?((/^\d|^salles?\s/i.test(r))&&(r.match(/\d+/g)||[]).includes(q)):norm(r).includes(q));
function option(value,text){const o=document.createElement('option');o.value=value;o.textContent=text;return o;}
function roomOptions(){const current=$('room').value;const rooms=[...new Set(data.filter(a=>!$('floor').value||a.floor===$('floor').value).map(a=>a.room))].sort(collator.compare);$('room').replaceChildren(option('','Toutes les salles'),...rooms.map(r=>option(r,roomLabel(r))));if(rooms.includes(current))$('room').value=current;}
function render(){
 $('favcount').textContent=favorites.size;$('favorites').setAttribute('aria-pressed',String(favoriteOnly));
 const f=$('floor').value,r=$('room').value,q=norm($('search').value.trim()),rq=norm($('roomsearch').value.trim()).replace(/^salles?\s*/, '');
 const matches=data.filter(a=>(!f||a.floor===f)&&(!r||a.room===r)&&roomMatches(a.room,rq)&&(!q||norm(a.title+' '+a.artist).includes(q))&&(!favoriteOnly||favorites.has(a.id)));
 $('viewlabel').textContent=favoriteOnly?'VOTRE COLLECTION PERSONNELLE':'LES COLLECTIONS';$('heading').textContent=favoriteOnly?'Mes favoris':r?(roomLabel(r)):f||'Toutes les salles';
 $('count').textContent=matches.length+' œuvre'+(matches.length!==1?'s':'')+(r&&f?' · '+f:'');
 $('works').replaceChildren();
 if(!matches.length){const p=document.createElement('p');p.className='empty';p.textContent=favoriteOnly?'Aucun favori ne correspond à cette sélection. Touchez le cœur d’une œuvre pour la retrouver ici.':'Aucune œuvre ne correspond à cette recherche.';$('works').append(p);}
 for(const a of matches.slice(0,limit)){
  const row=document.createElement('article');row.className='work';const link=document.createElement('a');link.href=a.url;link.target='_blank';link.rel='noopener';
  const artist=document.createElement('div');artist.className='artist';artist.textContent=a.artist;const title=document.createElement('h3');title.textContent=a.title+' ↗';const loc=document.createElement('div');loc.className='location';loc.textContent=a.floor+' · '+(roomLabel(a.room));link.append(artist,title,loc);
  const heart=document.createElement('button');heart.className='heart';heart.textContent=favorites.has(a.id)?'♥':'♡';heart.setAttribute('aria-pressed',String(favorites.has(a.id)));heart.setAttribute('aria-label',(favorites.has(a.id)?'Retirer des favoris : ':'Ajouter aux favoris : ')+a.title);heart.onclick=()=>{if(favorites.has(a.id))favorites.delete(a.id);else favorites.add(a.id);try{localStorage.setItem('orsay-favorites',JSON.stringify([...favorites]));}catch{$('updated').textContent='Le navigateur ne permet pas d’enregistrer vos favoris. Ils restent disponibles pendant cette visite.';}render();};row.append(link,heart);$('works').append(row);
 }
 $('more').hidden=matches.length<=limit;
 const rooms=[...new Set(data.filter(a=>(!f||a.floor===f)&&roomMatches(a.room,rq)).map(a=>a.room))].sort(collator.compare);
 $('rooms').replaceChildren(...rooms.map(n=>{const b=document.createElement('button');b.textContent=roomLabel(n);b.setAttribute('aria-pressed',String(n===r));b.onclick=()=>{$('room').value=n;limit=80;render();};return b;}));
 $('navigation').hidden=!r;const i=rooms.indexOf(r);$('prev').disabled=i<=0;$('next').disabled=i<0||i>=rooms.length-1;
 $('prev').onclick=()=>{$('room').value=rooms[i-1];limit=80;render();};$('next').onclick=()=>{$('room').value=rooms[i+1];limit=80;render();};
}
$('floor').onchange=()=>{roomOptions();limit=80;render();};for(const id of ['room','search','roomsearch'])$(id).addEventListener(id==='room'?'change':'input',()=>{limit=80;render();});
$('favorites').onclick=()=>{favoriteOnly=!favoriteOnly;if(favoriteOnly){for(const id of ['floor','room','search','roomsearch'])$(id).value='';roomOptions();}limit=80;render();};$('reset').onclick=()=>{for(const id of ['floor','room','search','roomsearch'])$(id).value='';favoriteOnly=false;limit=80;roomOptions();render();};$('more').onclick=()=>{limit+=80;render();};
fetch('data.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(d=>{data=d.artworks;const floors=[...new Set(data.map(a=>a.floor))].sort((a,b)=>{const ranks={'Rez-de-chaussée':0,'Niveau médian':1,'Niveau supérieur':2};return (ranks[a]??3)-(ranks[b]??3)||collator.compare(a,b);});$('floor').append(...floors.map(f=>option(f,f)));roomOptions();$('updated').textContent='Données officielles relevées le '+d.updated.split('-').reverse().join('/')+' · '+data.length+' œuvres référencées.';render();}).catch(()=>{$('count').textContent='Impossible de charger les œuvres. Rechargez la page pour réessayer.';});
