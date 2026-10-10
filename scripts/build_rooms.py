import json
from refresh import ROOT
p=ROOT/'data.json';d=json.loads(p.read_text());rooms=[]
def add(id,floor,sources=None,note='',label=None):
 rooms.append({'id':str(id),'floor':floor,'label':label or 'Salle '+str(id),'sources':sources or [str(id)],'note':note})
f0='Rez-de-chaussée';f2='Niveau médian';f5='Niveau supérieur'
for i in range(1,8):add(i,f0)
for i in ['8a','8b','8c']:add(i,f0,note='Aucune œuvre localisée dans cette salle par le catalogue consulté.')
add('9',f0);add('9 bis',f0)
for i in ['10a','10b']:add(i,f0,['10'],"Le catalogue indique « Salle 10 » sans distinguer 10a et 10b. La liste est commune aux deux espaces.")
for i in [11,12,13,14,18,24]:add(i,f0)
add('28',f5,["Salon de l'Horloge"],label='Salle 28 · Salon de l’Horloge')
for i in range(29,41):add(i,f5)
for i in [41,42]:add(i,f5,['Salles 41-42'],'Le catalogue regroupe les salles 41 et 42. La liste est commune aux deux salles.')
for i in [43,44,45]:add(i,f5,['Galerie Françoise Cachin'],'Le catalogue indique « Galerie Françoise Cachin » sans préciser la salle 43, 44 ou 45. La liste est commune à la galerie.')
for i in [46,47]:add(i,f5,['Salles 46 et 47'],'Le catalogue regroupe les salles 46 et 47. La liste est commune aux deux salles.')
for i in range(50,69):
 source='51 - Salle des Fêtes' if i==51 else str(i)
 note='Cet espace est indiqué en rénovation dans le secteur correspondant du plan de printemps 2026.' if i in [52,53,54] else ''
 add(i,f2,[source],note,label='Salle 51 · Salle des Fêtes' if i==51 else None)
for i in ['69a','69b']:add(i,f2,['69'],'Le catalogue indique « Salle 69 » sans distinguer 69a et 69b. La liste est commune aux deux espaces.')
for i in [70,71,72]:add(i,f2)
for level in [3,4]:
 floor='Niveau '+str(level)
 source='Pavillon amont niveau '+str(level)
 add('pavillon'+str(level),floor,[source],label='Pavillon amont · Niveau '+str(level))
 add('passerelle'+str(level),floor,['Passerelle'],'Le catalogue indique « Passerelle » sans distinguer les niveaux 3 et 4. La liste est commune aux passerelles.',label='Passerelle · Niveau '+str(level))
for a in d['artworks']:
 if a['room'] in ['Pavillon amont niveau 3','Pavillon amont niveau 4']:a['floor']='Niveau '+a['room'][-1]
represented={s for r in rooms for s in r['sources']}
for a in d['artworks']:
 if a['room'] not in represented:
  rooms.append({'id':'space:'+a['room'],'floor':a['floor'],'label':a['room'],'sources':[a['room']],'note':''});represented.add(a['room'])
d['rooms']=rooms;d['plan_source']='https://www.musee-orsay.fr/sites/default/files/2026-03/plan-guide%20ORSAY%20Europe%20printemps26.pdf'
p.write_text(json.dumps(d,ensure_ascii=False,separators=(',',':')))
print('Plan registry:',len(rooms),'rooms/spaces')
