# Downloads the 50 real product photos used by the photo eval (eval/photos/web/*.jpg).
# The photos belong to the online pharmacy that published them, so they are not stored in this repo;
# eval/photos/web/labels.json lists each photo's source page, image URL and the hand-labelled composition.
import json, os, urllib.request
D = "eval/photos/web"
labels = json.load(open(f"{D}/labels.json"))
for k, v in labels.items():
    f = f"{D}/{k}.jpg"
    if os.path.exists(f): continue
    req = urllib.request.Request(v["image"], headers={"User-Agent": "Mozilla/5.0"})
    open(f, "wb").write(urllib.request.urlopen(req, timeout=30).read())
    print("got", f)
print(len(labels), "photos in", D)
