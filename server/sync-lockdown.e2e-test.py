import json, urllib.request, urllib.parse, time, sys
BASE="https://gym.alibondabo.com"
def req(path, method="GET", body=None, token=None):
    r=urllib.request.Request(BASE+path, data=json.dumps(body).encode() if body is not None else None, method=method)
    r.add_header("Content-Type","application/json"); r.add_header("User-Agent","BananaProGym/1.0 (Android)")
    if token: r.add_header("Authorization","Bearer "+token)
    try:
        with urllib.request.urlopen(r, timeout=40) as resp: return resp.status, json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        raw=e.read().decode()
        try: return e.code, json.loads(raw)
        except: return e.code, {"raw":raw[:150]}
def login(email,pw):
    s,b=req("/api/auth/login","POST",{"email":email,"password":pw}); assert s==200,(s,b); return b["sessionToken"],b["user"]
def mut(proc,inp,token): return req(f"/api/trpc/{proc}","POST",{"json":inp},token)
def qry(proc,token,inp=None):
    q="?input="+urllib.parse.quote(json.dumps({"json":inp})) if inp is not None else ""
    return req(f"/api/trpc/{proc}{q}","GET",None,token)
P=F=0
def check(n,c,d=""):
    global P,F
    if c: P+=1; print(f"PASS  {n}")
    else: F+=1; print(f"FAIL  {n}  {d}")

time.sleep(6)
WORKOUT={"id":"lock-test-1","date":"2026-08-23","sessionType":"push","startTime":"2026-08-23T18:00:00.000Z",
         "endTime":"2026-08-23T18:42:00.000Z","completed":True,"durationMinutes":42,"totalVolumeKg":4200,
         "exercises":[{"exerciseName":"Bench Press","exerciseOrder":1,"skipped":False,
                       "sets":[{"setNumber":1,"weightKg":80,"reps":8,"rpe":8}]}]}

# 1. THE EXACT CALL THAT WORKED AT 22:01 — no token at all
s,b = mut("sync.upsertBodyWeight", {"deviceId":"zaki-p0a-verify","entry":{"id":"x1","date":"2026-08-23","weightKg":80.5}}, None)
check("UNAUTHENTICATED write now REJECTED (was 200 before)", s in (401,403), f"got {s}")

s,b = qry("sync.getWorkouts", None, {"deviceId":"zaki-p0a-verify"})
check("UNAUTHENTICATED read rejected", s in (401,403), f"got {s}")

alice_t, alice = login("coach.test@example.com","a-reasonable-passphrase")
bob_t, bob = login("trainee.test@example.com","a-reasonable-passphrase")

# 2. authenticated write, but claiming SOMEONE ELSE'S device id
s,b = mut("sync.upsertWorkout", {"deviceId":"bob-device-id-i-guessed","session":WORKOUT}, alice_t)
check("authenticated write accepted", s==200, f"{s} {json.dumps(b)[:110]}")

# 3. did it land under Alice's ACCOUNT, ignoring the id she supplied?
s,b = qry("sync.getWorkouts", alice_t, {"deviceId":"anything"})
mine = b.get("result",{}).get("data",{}).get("json",[]) if s==200 else []
check("write landed under the CALLER's account", any(w.get("id")=="lock-test-1" for w in mine), json.dumps(mine)[:120])

# 4. can Bob see it by claiming the same device id?
s,b = qry("sync.getWorkouts", bob_t, {"deviceId":"bob-device-id-i-guessed"})
bobs = b.get("result",{}).get("data",{}).get("json",[]) if s==200 else []
check("OTHER user CANNOT read it via the supplied deviceId", all(w.get("id")!="lock-test-1" for w in bobs), json.dumps(bobs)[:120])
check("other user's own view is empty", bobs==[], json.dumps(bobs)[:120])

# 5. whoop now requires a session too
s,b = qry("whoop.status", None, {"deviceId":"anything"})
check("whoop.status requires a session", s in (401,403), f"got {s}")

print(f"\n{P} passed, {F} failed")
sys.exit(0 if F==0 else 1)
