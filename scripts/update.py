import sys,json,re,concurrent.futures,urllib.parse
sys.path.insert(0,'/workspace/scratch/fe01938bc1f1/orsay/scripts');from refresh import fetch,clean,ROOT,BASE;from spaces import space
p=ROOT/'data.json'
def catalog(page):
 s=fetch(BASE+f'/fr/collections/recherche?index_artwork_has_available_room=1&items_per_page=100&page={page}')
 j=json.loads(re.search(r'<script type="application/json" data-drupal-selector="drupal-settings-json">(.*?)</script>',s).group(1))
 items=j.get('moo_search_artworks',{}).get('results',{}).get('items_list',[])
 total=int(re.search(r'precise">(\d+)</span>',s).group(1))
 return items,total
all,total=catalog(0)
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:
 for items,count in ex.map(catalog,range(1,(total+99)//100)):all.extend(items)
assert len({a['id'] for a in all})==total
all_ids={a['id'] for a in all}
d={'updated':__import__('time').strftime('%Y-%m-%d'),'source':BASE+'/fr/collections/recherche?index_artwork_has_available_room=1','artworks':[]}
rows={};queried=set()
def detail(a):
 s=fetch(BASE+a['link']);m=re.search(r'<span class="icon-location"></span>(.*?)</div>',s,re.S)
 loc=clean(m.group(1)) if m else '';parts=loc.split(',',1)
 floor=parts[0].strip() if len(parts)>1 else 'Localisation non précisée';room=parts[1].strip() if len(parts)>1 else loc or 'Localisation non précisée'
 b={'id':a['id'],'title':clean(a['title'].split('<i>')[-1]),'artist':clean(a['title'].split('<i>')[0]).rstrip(', '),'url':BASE+a['link'],'room':room.removeprefix('Salle '),'floor':floor}
 return b,room
for round in range(10):
 missing=[a for a in all if a['id'] not in rows];print('MISSING',len(missing),flush=True)
 if not missing:break
 samples=[missing[i] for i in range(0,len(missing),max(1,len(missing)//8))][:8];names=set()
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:
  for b,name in ex.map(detail,samples):rows[b['id']]=b;names.add(name)
 def query(name):
  r=space(name)
  for b in r:b['room']=b['room'].removeprefix('Salle ')
  return r
 with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:
  tasks={ex.submit(query,n):n for n in names if n not in queried and n!='Localisation non précisée'}
  for f in concurrent.futures.as_completed(tasks):
   name=tasks[f];queried.add(name)
   try:
    for b in f.result():rows[b['id']]=b
   except Exception as e:print('ERROR',name,e,flush=True)
 d['artworks']=[a for a in rows.values() if a['id'] in all_ids]
missing=[a for a in all if a['id'] not in rows]
if missing:
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:
  for b,name in ex.map(detail,missing):rows[b['id']]=b
 d['artworks']=[a for a in rows.values() if a['id'] in all_ids]
assert all_ids.issubset(rows)
d['artworks']=[rows[a['id']] for a in all]
d['excluded_unavailable']=sum('non exposée' in a['room'].lower() for a in d['artworks'])
d['catalog_total']=total
d['artworks']=[a for a in d['artworks'] if 'non exposée' not in a['room'].lower()]
p.write_text(json.dumps(d,ensure_ascii=False))
print('COMPLETE',len(d['artworks']),flush=True)

# Keep the image gallery and plan registry in sync with each collection refresh.
import subprocess
for script in ["enrich_images.py","build_rooms.py"]:
 subprocess.run([sys.executable,str(ROOT/"scripts"/script)],check=True)
