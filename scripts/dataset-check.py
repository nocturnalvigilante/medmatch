# Cross-checks the Indian Medicine Dataset (data/india.json) against our hand-checked brands (eval/medicines.json + src/lib/brands.ts).
# Writes eval/dataset-check.json. Run: python3 scripts/dataset-check.py
import json,re
import glob
d=[r for f in sorted(glob.glob("data/india/[a-z0].json")) for r in json.load(open(f))]
DESC=r"(tablets?|capsules?|syrup|suspension|oral|drops?|cream|gel|ointment|lotion|inhaler|rotacap|respules|solution|powder|sachet|granules|spray|dt|md|sr|er|xr|cr|pr|mr|od|cv|ds|kid|kids|chewable|dispersible|effervescent|soft|gelatin|film|coated|new|paediatric|pediatric|junior|infant|\(paediatric\)|liquid|elixir)"
def base(n):
    n=n.lower()
    n=re.sub(r"(\d)\s*mg\b",r"\1",n)
    words=n.split()
    while len(words)>1 and re.fullmatch(DESC,words[-1]): words.pop()
    return re.sub(r"[^a-z0-9]","","".join(words))
groups={}
for x in d: groups.setdefault(base(x[0]),[]).append(x)
hand=json.load(open("eval/medicines.json"))
src=open("src/lib/brands.ts").read()
for m in re.finditer(r'brand: "([^"]+)", salts: \[(.*?)\] \}',src):
    hand.append({"brand":m.group(1),"salts":[{"name":a} for a in re.findall(r'name: "([^"]+)"',m.group(2))]})
SYN=[("amoxicillin","amoxycillin"),("furosemide","frusemide"),("acetylsalicylic acid","aspirin"),("levothyroxine","thyroxine"),("salbutamol","albuterol")]
def norm(s):
    s=s.lower()
    for a,b in SYN: s=s.replace(b,a)
    s=re.sub(r"\b(sodium|potassium|hydrochloride|dihydrochloride|maleate|ip|bp)\b","",s); return re.sub(r"[^a-z]","",s)[:6]
agree=found=0; seen=set(); out=[]
for h in hand:
    b=h["brand"]
    if b.lower() in seen: continue
    seen.add(b.lower())
    c=groups.get(base(b),[])
    if not c: out.append(("NOT FOUND",b)); continue
    found+=1
    exp=sorted(norm(s["name"]) for s in h["salts"])
    if any(sorted(norm(s[0]) for s in x[2])==exp for x in c): agree+=1
    else: out.append(("DIFF",b,[(x[0],[s[0] for s in x[2]]) for x in c[:3]],[s["name"] for s in h["salts"]]))
print(f"hand-checked brands {len(seen)} · found {found} · agree {agree}")
for o in out: print(o)
print("groups",len(groups),"multi-variant groups",sum(1 for g in groups.values() if len(g)>1))
import datetime
json.dump({"handChecked":len(seen),"found":found,"agree":agree,"disagreements":[o[1] for o in out if o[0]=="DIFF"],"notFound":[o[1] for o in out if o[0]=="NOT FOUND"],"medicines":len(d),"ranAt":datetime.datetime.now(datetime.timezone.utc).isoformat()},open("eval/dataset-check.json","w"),indent=2)
