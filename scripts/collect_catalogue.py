"""Build a resumable snapshot of the entire public catalogue, partitioned by domain."""
import concurrent.futures,gzip,hashlib,html,json,math,pathlib,re,subprocess,time,urllib.parse
from refresh import BASE,ROOT,clean
CACHE=ROOT/'.catalogue-cache';CACHE.mkdir(exist_ok=True)
OUT=ROOT/'catalogue';OUT.mkdir(exist_ok=True)
ARCHIVE=ROOT/'collection-cache'/'pages.json.gz'
if ARCHIVE.exists():
 for name,record in json.loads(gzip.decompress(ARCHIVE.read_bytes())).items():
  target=CACHE/name
  if not target.exists():target.write_text(json.dumps(record,ensure_ascii=False))
def fetch(url):
 key=CACHE/(hashlib.sha256(url.encode()).hexdigest()+'.json')
 if key.exists():return json.loads(key.read_text())
 for attempt in range(4):
  try:
   s=subprocess.check_output(['curl','-fsSL','--max-time','40',url],text=True,stderr=subprocess.DEVNULL)
   j=json.loads(re.search(r'<script type="application/json" data-drupal-selector="drupal-settings-json">(.*?)</script>',s).group(1))
   items=j['moo_search_artworks']['results']['items_list'];total=int(re.search(r'precise">(\d+)</span>',s).group(1))
   metadata={}
   for block in re.findall(r'<article\b[^>]*artwork-masonry[^>]*>(.*?)</article>',s,re.S):
    link=re.search(r'href="([^\"]*/oeuvres/[^\"]+)"',block);img=re.search(r'<img\b[^>]*\bsrc="([^\"]+)"',block);date=re.search(r'<div class="date">(.*?)</div>',block,re.S)
    if link:metadata[html.unescape(link.group(1))]={'image':html.unescape(img.group(1)) if img and 'placeholder' not in img.group(1) else '', 'date':clean(date.group(1)) if date else ''}
   domains=[]
   facet=re.search(r'<ul[^>]*data-drupal-facet-alias="artwork_domain"[^>]*>(.*?)</ul>',s,re.S)
   if facet:
    domains=[(html.unescape(a),int(b)) for a,b in re.findall(r'data-drupal-facet-item-value="([^\"]+)"[^>]*data-drupal-facet-item-count="([^\"]+)"',facet.group(1))]
   result={'items':items,'total':total,'metadata':metadata,'domains':domains}
   key.write_text(json.dumps(result,ensure_ascii=False));return result
  except Exception:
   if attempt==3:raise
   time.sleep(2+attempt)
def url(domain=None,page=0,exposed=False):
 q={'items_per_page':100,'page':page,'sort_by':'artwork_inventory_number'}
 if domain:q['f[0]']='artwork_domain:'+domain
 if exposed:q['index_artwork_has_available_room']=1
 return BASE+'/fr/collections/recherche?'+urllib.parse.urlencode(q,quote_via=urllib.parse.quote)
def convert(j):
 rows=[]
 for a in j['items']:
  title=a['title'];author=clean(title.split('<i>')[0]).rstrip(', ');work=clean(title.split('<i>')[-1]);meta=j['metadata'].get(a['link'],{})
  rows.append({'id':a['id'],'title':work or 'Sans titre','artist':author or 'Auteur non précisé','url':BASE+a['link'],**meta})
 return rows
if __name__=='__main__':
 first=fetch(url());domains=first['domains'];print('CATALOGUE',first['total'],'DOMAINS',len(domains),flush=True)
 rows={};tasks=[];expected={};actual={};page_ids={}
 for domain,count in domains:
  expected[domain]=count;actual[domain]=set()
  for p in range(math.ceil(count/100)):tasks.append((domain,p))
 def page(t):
  domain,p=t;j=fetch(url(domain,p));r=convert(j)
  if not r:raise RuntimeError(f'Empty page {domain} {p}; refusing incomplete catalogue')
  return domain,p,r
 errors=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as ex:
  futures=[ex.submit(page,t) for t in tasks]
  for n,f in enumerate(concurrent.futures.as_completed(futures),1):
   try:domain,p,result=f.result()
   except Exception as error:errors.append(str(error));print("PAGE ERROR",str(error),flush=True);continue
   page_ids[(domain,p)]={a["id"] for a in result}
   for a in result:actual[domain].add(a['id']);rows[a['id']]=a
   if n%40==0 or n==len(tasks):print('PAGES',n,'/',len(tasks),'RECORDS',len(rows),flush=True)
 if errors:raise RuntimeError("Failed pages: "+"; ".join(errors))
 for domain,count in expected.items():
  if len(actual[domain])==count:continue
  # Tied sort values can cross page boundaries on different search replicas.
  seen={};conflicts=set()
  for p in range(math.ceil(count/100)):
   for id in page_ids[(domain,p)]:
    if id in seen:conflicts.update([seen[id],p])
    else:seen[id]=p
  candidates={p for index in conflicts for p in [index-1,index,index+1] if 0<=p<math.ceil(count/100)}
  for attempt in range(1,5):
   if len(actual[domain])==count:break
   print('REPAIR',domain,len(actual[domain]),'/',count,'pages',len(candidates),flush=True)
   def repair(p):return convert(fetch(url(domain,p)+f'&snapshot_retry={attempt}'))
   with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
    for result in ex.map(repair,sorted(candidates)):
     for a in result:actual[domain].add(a['id']);rows[a['id']]=a
  if len(actual[domain])!=count:raise RuntimeError(f'Incomplete {domain}: {len(actual[domain])}/{count}')
 if len(rows)!=first['total']:raise RuntimeError(f'Incomplete total: {len(rows)}/{first["total"]}')
 exposed=json.loads((ROOT/'data.json').read_text());exposed_ids={a['id'] for a in exposed['artworks']}
 for a in exposed['artworks']:
  if a['id'] in rows:a.update({k:v for k,v in rows[a['id']].items() if k in ['date','image'] and v})
 (ROOT/'data.json').write_text(json.dumps(exposed,ensure_ascii=False,separators=(',',':')))
 (OUT/'exposed.json').write_text(json.dumps(exposed,ensure_ascii=False,separators=(',',':')))
 outside=[a for id,a in rows.items() if id not in exposed_ids];outside.sort(key=lambda a:int(a['id']))
 shards=[]
 for i in range(0,len(outside),3000):
  name=f'part-{i//3000:03}.json';raw=json.dumps(outside[i:i+3000],ensure_ascii=False,separators=(',',':')).encode();(OUT/name).write_bytes(raw);(OUT/(name+'.gz')).write_bytes(gzip.compress(raw,mtime=0));shards.append({'file':name,'count':len(outside[i:i+3000])})
 manifest={'updated':time.strftime('%Y-%m-%d'),'source':BASE+'/fr/collections/recherche','total':len(rows),'outside':len(outside),'parts':shards,'complete':True,'expectedOutside':len(outside)}
 (OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':')))
 print('COMPLETE',len(outside),'outside;',sum((OUT/(x['file']+'.gz')).stat().st_size for x in shards),'compressed bytes',flush=True)
