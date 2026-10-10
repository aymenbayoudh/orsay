import concurrent.futures,urllib.parse,re,json
from refresh import fetch,clean,BASE,ROOT

def space(name):
 rows=[];p=0
 while True:
  q=urllib.parse.urlencode({'artwork_room':name,'index_artwork_has_available_room':1,'items_per_page':100,'page':p},quote_via=urllib.parse.quote)
  s=fetch(BASE+'/fr/collections/recherche?'+q)
  j=json.loads(re.search(r'<script type="application/json" data-drupal-selector="drupal-settings-json">(.*?)</script>',s).group(1))
  items=j.get('moo_search_artworks',{}).get('results',{}).get('items_list',[])
  for a in items:rows.append({'id':a['id'],'title':clean(a['title'].split('<i>')[-1]),'artist':clean(a['title'].split('<i>')[0]).rstrip(', '),'url':BASE+a['link'],'room':name})
  if not items:break
  total=int(re.search(r'precise">(\d+)</span>',s).group(1));
  if not items or (p+1)*100>=total:break
  p+=1
 if rows:
  s=fetch(rows[0]['url']);m=re.search(r'<span class="icon-location"></span>(.*?)</div>',s,re.S);loc=clean(m.group(1))
  if name not in loc:raise RuntimeError(f'{name}: {loc}')
  floor=loc.split(',')[0].strip()
  if floor.isdigit():
   for a in rows[1:4]:
    detail=fetch(a['url']);m=re.search(r'<span class="icon-location"></span>(.*?)</div>',detail,re.S)
    candidate=clean(m.group(1)).split(',')[0].strip() if m else ''
    if candidate and not candidate.isdigit():floor=candidate;break
   if floor.isdigit():floor='Étage non précisé'
  for a in rows:a['floor']=floor
 print(name,len(rows),flush=True);return rows
if __name__=='__main__':
 rows=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
  for result in ex.map(space,['Pavillon amont','Pavillon amont niveau 3','Pavillon amont niveau 4','Galerie Françoise Cachin']):rows.extend(result)
 (ROOT/'extras.json').write_text(json.dumps(rows,ensure_ascii=False))
