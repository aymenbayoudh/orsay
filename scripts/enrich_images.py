import json,re,html,concurrent.futures
from pathlib import Path
from refresh import fetch,BASE,ROOT

def parse_images(s):
 images={}
 for block in re.findall(r'<article\b[^>]*artwork-masonry[^>]*>(.*?)</article>',s,re.S):
  link=re.search(r'href="([^"]*/(?:oeuvres|artworks)/[^"]+)"',block)
  image=re.search(r'<img\b[^>]*\bsrc="([^"]+)"',block)
  if link and image and 'placeholder' not in image.group(1):images[BASE+html.unescape(link.group(1))]={'image':html.unescape(image.group(1))}
 return images

def page(n):
 s=fetch(BASE+f'/fr/collections/recherche?index_artwork_has_available_room=1&items_per_page=100&page={n}')
 return parse_images(s)
if __name__=='__main__':
 d=json.loads((ROOT/'data.json').read_text());images={}
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:
  for result in ex.map(page,range((d.get('catalog_total',len(d['artworks']))+99)//100)):images.update(result)
 for a in d['artworks']:a.update(images.get(a['url'],{}))
 (ROOT/'data.json').write_text(json.dumps(d,ensure_ascii=False,separators=(',',':')))
 print('IMAGES',len(images),'OF',len(d['artworks']),flush=True)
