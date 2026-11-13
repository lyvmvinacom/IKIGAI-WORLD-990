"""Run from the repository root to refresh the arena snapshot from classroom sources."""
import collections,json,random,re,unicodedata
from pathlib import Path
rng=random.Random(20261114)
words=json.loads(re.search(r'const BANK=(\[.*?\]);',Path('kotoba-ninja.html').read_text(),re.S)[1])
s=Path('bunpou-bank.js').read_text();bunpou=json.loads(s[s.index('['):s.rfind(']')+1])
s=Path('kanji-bomb-bank.js').read_text();kanji=json.loads(s[s.index('['):s.rfind(']')+1])
tests=json.loads(Path('grammar-tests.json').read_text())
# Edits are merged live by the database; base snapshot deliberately retains source IDs.
rows=[]
def norm(s):return unicodedata.normalize('NFKC',s).strip().lower()
def add(id,group,question,answer,wrong,lesson,source,source_id,**extra):
 opts=[answer]+list(dict.fromkeys(x for x in wrong if norm(x)!=norm(answer)))[:3]
 if len(opts)!=4 or len(set(map(norm,opts)))!=4:return
 rows.append(dict(id=id,group=group,lesson=lesson,question=question,options=opts,correct='A',source=source,source_id=source_id,**extra))
def choose_wrong(pool,answer,excluded=()):
 excluded=set(excluded)|{norm(answer)}
 return list(dict.fromkeys(x for x in rng.sample(pool,len(pool)) if norm(x) not in excluded))[:3]
# Vocabulary: two directions, excluding answers that share a translation/synonym.
for w in words:
 synonyms={norm(v['jp']) for v in words if norm(v['vi'])==norm(w['vi'])}
 vi_synonyms={norm(v['vi']) for v in words if norm(v['jp'])==norm(w['jp'])}
 pool=[v for v in words if v['lesson']!=w['lesson'] and norm(v['jp']) not in synonyms and norm(v['vi']) not in vi_synonyms]
 wrong_vi=choose_wrong([v['vi'] for v in pool],w['vi'])
 wrong_jp=choose_wrong([v['jp'] for v in pool],w['jp'],synonyms)
 add('CLASS-VI-'+w['id'],'vocabulary','「'+w['jp']+'」 có nghĩa là gì?',w['vi'],wrong_vi,w['lesson'],'kotoba-ninja',w['id'])
 add('CLASS-JP-'+w['id'],'vocabulary','Chọn từ tiếng Nhật: '+w['vi'],w['jp'],wrong_jp,w['lesson'],'kotoba-ninja',w['id'])
for b in bunpou:
 # Full sentences from the same classroom bank, not arbitrary word permutations.
 pool=[''.join(o['parts']) for o in bunpou if o['lesson']!=b['lesson'] and norm(o['vi'])!=norm(b['vi'])]
 add('CLASS-BP-'+b['id'],'grammar','Chọn câu đúng với nghĩa: '+b['vi'],''.join(b['parts']),choose_wrong(pool,''.join(b['parts'])),b['lesson'],'bunpou-tetris',b['id'])
for k in kanji:
 ctx=(' · '+k['ctx']) if k.get('ctx') else ''
 add('CLASS-KR-'+k['id'],'kanji','Cách đọc của 「'+k['k']+'」'+ctx,k['r'],k['rs'],k['lesson'],'kanji-bomb',k['id'])
 add('CLASS-KM-'+k['id'],'kanji','Nghĩa của 「'+k['k']+'」'+ctx,k['m'],k['ms'],k['lesson'],'kanji-bomb',k['id'])
for t in tests:
 for q in t['questions']:
  # Keep unresolved source rows in the private snapshot so a future teacher correction
  # immediately makes them usable; the view excludes ungradable rows at read time.
  prefix=t['passages'].get(q.get('passage_id'),{}).get('text','')
  row=dict(id='CLASS-GT-'+q['id'],group='kanji' if q.get('type')=='kanji-reading' else 'grammar',lesson=q.get('source_ref',{}).get('test',1) if q.get('source_ref') else 1,
   question=q['question'],options=q['options'],correct=q['correct'],source='grammar-tests',source_id=q['id'],test_id=t['id'],prefix=prefix)
  if q.get('image'):row.update(image=q['image'],image_alt=q.get('image_alt','Hình câu hỏi'))
  rows.append(row)
assert len({q['id'] for q in rows})==len(rows)
Path('assets/ikigai-classroom-arena-bank.json').write_text(json.dumps({'version':'classroom-20261114-1','questions':rows},ensure_ascii=False,separators=(',',':')))
print('Classroom snapshot',len(rows),dict(collections.Counter(q['source'] for q in rows)))
