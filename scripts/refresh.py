"""Retrieve room listings and verify each room's floor from official artwork pages."""
import subprocess, concurrent.futures, urllib.request, urllib.parse, re, json, html, pathlib, time
BASE='https://www.musee-orsay.fr'
ROOT=pathlib.Path(__file__).resolve().parents[1]
def fetch(url):
 for n in range(3):
  try:
   return subprocess.check_output(['curl','--fail','-sL','--max-time','50',url],text=True)
  except Exception:
   if n==2: raise
   time.sleep(1)
def clean(s): return html.unescape(re.sub('<[^>]+>','',s)).strip()
def room(n):
 query=urllib.parse.urlencode({'artwork_room':f'Salle {n}','index_artwork_has_available_room':1,'items_per_page':100},quote_via=urllib.parse.quote)
 rows=[];p=0
 while True:
  s=fetch(BASE+'/fr/collections/recherche?'+query+f'&page={p}')
  m=re.search(r'<script type="application/json" data-drupal-selector="drupal-settings-json">(.*?)</script>',s)
  j=json.loads(m.group(1));items=j.get('moo_search_artworks',{}).get('results',{}).get('items_list',[])
  for a in items:
   title=a['title'];artist=clean(title.split('<i>')[0]).rstrip(', ');work=clean(title.split('<i>')[-1])
   rows.append({'id':a['id'],'title':work,'artist':artist,'url':BASE+a['link'],'room':str(n)})
  if not items:break
  total=int(re.search(r'precise">(\d+)</span>',s).group(1));
  if not items or (p+1)*100>=total:break
  p+=1
 if not rows:return []
 detail=fetch(rows[0]['url'])
 m=re.search(r'<span class="icon-location"></span>(.*?)</div>',detail,re.S)
 location=clean(m.group(1)) if m else ''
 if not re.search(r'\bSalle\s+'+str(n)+r'\b',location):
  raise RuntimeError(f'Room {n}: unexpected location {location}')
 floor=location.split(',')[0].strip()
 for a in rows:a['floor']=floor
 print(f'Salle {n}: {len(rows)} · {floor}',flush=True)
 return rows
if __name__=='__main__':
 rows=[];errors=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
  tasks={ex.submit(room,n):n for n in range(1,87)}
  for f in concurrent.futures.as_completed(tasks):
   try:rows.extend(f.result())
   except Exception as e:errors.append(str(e));print('ERROR',tasks[f],str(e),flush=True)
 rows=list({a['id']:a for a in rows}.values())
 rows.sort(key=lambda a:(a['floor'],int(a['room']),a['artist'],a['title']))
 (ROOT/'data.json').write_text(json.dumps({'updated':time.strftime('%Y-%m-%d'),'source':BASE+'/fr/collections/recherche?index_artwork_has_available_room=1','artworks':rows,'errors':errors},ensure_ascii=False))
 print('TOTAL',len(rows),'ERRORS',errors,flush=True)
