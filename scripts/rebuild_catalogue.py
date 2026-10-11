"""Publish all valid cached notices after an interrupted collection, without claiming completeness."""
import gzip,json,time
from collect_catalogue import CACHE,OUT,ARCHIVE,convert,ROOT,BASE

def rebuild():
 rows={};records={};invalid=[]
 for file in sorted(CACHE.glob('*.json')):
  try:
   record=json.loads(file.read_text());converted=convert(record)
   for a in converted:
    if not isinstance(a['id'],str) or not a['id'].isdigit() or not a['url'].startswith(BASE+'/fr/oeuvres/'):raise ValueError('Invalid official identifier/link')
   records[file.name]=record
   for a in converted:
    previous=rows.get(a['url'],{})
    rows[a['url']]={**previous,**a,'image':a.get('image') or previous.get('image',''),'date':a.get('date') or previous.get('date','')}
  except (ValueError,KeyError,TypeError) as error:invalid.append((file.name,str(error)))
 if invalid:raise RuntimeError('Invalid cached pages: '+str(invalid))
 # Existing published records are retained even if their source cache was lost.
 for part in OUT.glob('part-*.json.gz'):
  for a in json.loads(gzip.decompress(part.read_bytes())):
   rows.setdefault(a['url'],a)
 for file in OUT.glob('verified-*.json'):
  for a in json.loads(file.read_text()):
   existing=rows.get(a['url'],{});canonical=existing.get('id',a['id']);aliases=set(existing.get('legacyIds',[]))
   if canonical!=a['id']:aliases.add(a['id'])
   rows[a['url']]={**existing,**a,'id':canonical,'legacyIds':sorted(aliases)}
 physical=json.loads((ROOT/'data.json').read_text());physical_ids={a['id'] for a in physical['artworks']};physical_urls={a['url'] for a in physical['artworks']}
 for a in physical['artworks']:
  found=rows.get(a['url'],{})
  for key in ['image','date']:
   if found.get(key):a[key]=found[key]
 outside=sorted((a for url,a in rows.items() if url not in physical_urls),key=lambda a:int(a['id']))
 for a in outside:a['officialId']=a['url'].rsplit('-',1)[-1]
 assert len({a['id'] for a in outside})==len(outside),'Conflicting search identifiers'
 assert not physical_ids.intersection(a['id'] for a in outside),'Conflicting physical identifiers'
 manifest=json.loads((OUT/'manifest.json').read_text());manifest.update(outside=len(outside),complete=False,updated=time.strftime('%Y-%m-%d'),revision=str(time.time_ns()))
 parts=[]
 for i in range(0,len(outside),3000):
  file=f'part-{i//3000:03}.json';raw=json.dumps(outside[i:i+3000],ensure_ascii=False,separators=(',',':')).encode()
  (OUT/(file+'.gz')).write_bytes(gzip.compress(raw,mtime=0));parts.append(dict(file=file,count=len(outside[i:i+3000])))
 manifest['parts']=parts;manifest['expectedOutside']=manifest['total']-len(physical_ids)
 (OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':')))
 (ROOT/'data.json').write_text(json.dumps(physical,ensure_ascii=False,separators=(',',':')))
 ARCHIVE.parent.mkdir(exist_ok=True);ARCHIVE.write_bytes(gzip.compress(json.dumps(records,ensure_ascii=False,separators=(',',':')).encode(),mtime=0))
 print('Recovered',len(outside),'outside notices;',len(records),'cached pages; complete=False')
if __name__=='__main__':rebuild()
