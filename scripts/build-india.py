# Builds data/india.json from the Indian Medicine Dataset (MIT): https://github.com/junioralive/Indian-Medicine-Dataset (DATA/updated_indian_medicine_data.csv).
# Keeps medicines still sold, in forms a traveller carries (oral, inhaled, topical, eye), with their ingredients and a popularity rank.
import csv,re,json,sys,collections
SRC=sys.argv[1]; OUT=sys.argv[2]  # usage: python3 scripts/build-india.py updated_indian_medicine_data.csv data/india
csv.field_size_limit(10**8)
FORM_WORDS=r"(tablet|tablets|capsule|capsules|syrup|suspension|oral|drops?|drop|cream|gel|ointment|lotion|inhaler|rotacap|respules|solution|powder|sachet|granules|spray|dt|md|sr|er|xr|cr|pr|mr|od|kid|kids|forte|plus|eye|ear|nasal|chewable|dispersible|effervescent|soft|gelatin|film|coated|sugar|free|paediatric|pediatric|junior|infant|injection)"
def form_of(n):
    n=n.lower()
    if re.search(r"\binjection|\binfusion|\bvaccine|\bvial\b|\bampoule",n): return None
    if re.search(r"\beye\b|\bophthalmic",n): return "e"
    if re.search(r"\binhaler|\brotacap|\brespules|\btranscap|\bredicap|\binhalation",n): return "i"
    if re.search(r"\bcream|\bgel\b|\bointment|\blotion|\bsoap|\bshampoo|\bdusting|\bpatch|\bemulgel",n): return "t"
    if re.search(r"\bnasal|\bear drop|\bvaginal|\bsuppositor|\bmouthwash|\bpaint\b",n): return "a"
    if re.search(r"\btablet|\bcapsule|\bsyrup|\bsuspension|\bsachet|\bgranules|\bpowder|\bdrops?\b|\bsolution|\belixir|\blozenge|\bchewable|\bliquid|\bsoftgel",n): return "o"
    return None
SALT_RE=re.compile(r"^\s*(.+?)\s*\(\s*([\d.]+)\s*([a-z0-9%/\. ]*?)\s*\)\s*$",re.I)
def salts_of(s):
    out=[]
    for part in s.split(" + "):
        part=part.strip()
        if not part: continue
        m=SALT_RE.match(part)
        if m:
            name=re.sub(r"\s+"," ",m.group(1)).strip().lower()
            amt=m.group(2); unit=m.group(3).strip().lower().replace(" ","")
            out.append([name, amt+unit])
        else:
            out.append([re.sub(r"\s+"," ",part).lower(),""])
    return out
rows=csv.DictReader(open(SRC,encoding="utf-8"))
seen=set(); items=[]; skipped=collections.Counter()
for r in rows:
    if r["Is_discontinued"].strip().upper()=="TRUE": skipped["discontinued"]+=1; continue
    name=re.sub(r"\s+"," ",r["name"]).strip()
    f=form_of(name)
    if not f: skipped["form"]+=1; continue
    sc=(r.get("salt_composition") or "").strip()
    full=1
    if not sc:
        parts=[p.strip() for p in (r["short_composition1"],r["short_composition2"]) if p.strip()]
        if not parts: skipped["nocomp"]+=1; continue
        sc=" + ".join(parts)
        full = 1 if len(parts)==1 else 0   # 2 short columns may hide a 3rd ingredient
    
    key=name.lower()
    if key in seen: skipped["dup"]+=1; continue
    seen.add(key)
    salts=salts_of(sc)
    if not salts or len(salts)>8: skipped["badsalts"]+=1; continue
    mfr=re.sub(r"\s+(pvt\.?|private|ltd\.?|limited|pharmaceuticals?|pharma|laboratories|labs?|healthcare|india|inc\.?)\b.*$","",r["manufacturer_name"].strip(),flags=re.I)[:40]
    items.append([name,f,salts,mfr,full,int(r['id'])])
items.sort(key=lambda x:x[5])
for i,it in enumerate(items): it[5]=i  # rank: dataset order (popularity within each letter), 0 = most popular

# Fast cold starts: one file per first character, rows pre-sorted by their letters-and-digits key,
# each row carrying its base key (the name without form words / "mg") so the server builds nothing at startup.
import os
DESC=re.compile(r"^(tablets?|capsules?|syrup|suspension|oral|drops?|cream|gel|ointment|lotion|inhaler|rotacaps?|respules|solution|powder|sachet|granules|spray|dt|md|sr|er|xr|cr|pr|mr|od|kid|kids|chewable|dispersible|effervescent|soft|gelatin|film|coated|new|paediatric|pediatric|junior|infant|\(paediatric\)|liquid|elixir|sugar|free)$")
def flat(n): return re.sub(r"[^a-z0-9]","",n.lower())
def base(n):
    w=re.sub(r"(\d)\s*mg\b",r"\1",n.lower()).split()
    while len(w)>1 and DESC.match(w[-1]): w.pop()
    return re.sub(r"[^a-z0-9]","","".join(w))
def shard(n):
    c=flat(n)[:1]
    return c if c.isalpha() else "0"
os.makedirs(OUT,exist_ok=True)
shards=collections.defaultdict(list)
for it in items:
    if not flat(it[0]): continue
    shards[shard(it[0])].append(it+[base(it[0])])
for c,rows in shards.items():
    rows.sort(key=lambda r:flat(r[0]))
    json.dump(rows,open(os.path.join(OUT,c+".json"),"w"),separators=(",",":"))
# Popular medicines per letter (sitemap and A-Z page) without loading every shard.
top=[]; count=collections.Counter()
for it in items:
    c=shard(it[0])
    if it[1]!="o" or count[c]>=150: continue
    count[c]+=1; top.append(it[0])
json.dump(top,open(os.path.join(OUT,"top.json"),"w"),separators=(",",":"))
print("shards",{c:len(r) for c,r in sorted(shards.items())})
print("kept",len(items),"skipped",dict(skipped))
print("salts unique",len({s[0] for it in items for s in it[2]}))
