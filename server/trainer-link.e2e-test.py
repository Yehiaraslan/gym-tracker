import json, urllib.request, urllib.parse, time, sys
BASE="https://gym.alibondabo.com"
def req(path, method="GET", body=None, token=None):
    url=BASE+path
    data=json.dumps(body).encode() if body is not None else None
    r=urllib.request.Request(url, data=data, method=method)
    r.add_header("Content-Type","application/json")
    r.add_header("User-Agent","BananaProGym/1.0 (Android)")
    if token: r.add_header("Authorization","Bearer "+token)
    try:
        with urllib.request.urlopen(r, timeout=40) as resp:
            return resp.status, json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        raw=e.read().decode()
        try: return e.code, json.loads(raw)
        except: return e.code, {"raw":raw[:200]}

def login(email,pw):
    s,b=req("/api/auth/login","POST",{"email":email,"password":pw})
    assert s==200, (s,b)
    return b["sessionToken"], b["user"]

def mut(proc, inp, token):
    return req(f"/api/trpc/{proc}","POST",{"json":inp},token)
def qry(proc, token, inp=None):
    q="?input="+urllib.parse.quote(json.dumps({"json":inp})) if inp is not None else ""
    return req(f"/api/trpc/{proc}{q}","GET",None,token)

def err(b):
    try: return b["error"]["json"]["message"]
    except: return json.dumps(b)[:110]

P=F=0
def check(name, cond, detail=""):
    global P,F
    if cond: P+=1; print(f"PASS  {name}")
    else: F+=1; print(f"FAIL  {name}  {detail}")

time.sleep(5)
coach_t, coach = login("coach.test@example.com","a-reasonable-passphrase")
trainee_t, trainee = login("trainee.test@example.com","a-reasonable-passphrase")
print(f"coach id={coach['id']} role={coach['role']} | trainee id={trainee['id']} role={trainee['role']}\n")

# unauthenticated
s,b = mut("trainerLink.createInvite", None, None)
check("unauthenticated createInvite rejected", s in (401,403), f"{s} {err(b)}")

# non-trainer cannot invite
s,b = mut("trainerLink.createInvite", None, trainee_t)
check("non-trainer cannot create invite", s==403, f"{s} {err(b)}")

# trainer creates invite
s,b = mut("trainerLink.createInvite", None, coach_t)
check("trainer creates invite", s==200, f"{s} {err(b)}")
code = b.get("result",{}).get("data",{}).get("json",{}).get("code") if s==200 else None
print(f"      invite code = {code}")

# bad codes
s,b = mut("trainerLink.redeem", {"code":"ZZZZZZZZ"}, trainee_t)
check("unknown code rejected", s==404, f"{s} {err(b)}")
s,b = mut("trainerLink.redeem", {"code":"bad!"}, trainee_t)
check("malformed code rejected", s in (400,404), f"{s} {err(b)}")

# self-link
s,b = mut("trainerLink.redeem", {"code":code}, coach_t)
check("trainer cannot redeem own code (self-link)", s==400, f"{s} {err(b)}")

# redeem
s,b = mut("trainerLink.redeem", {"code":code}, trainee_t)
check("trainee redeems invite", s==200, f"{s} {err(b)}")

# reuse
s,b = mut("trainerLink.redeem", {"code":code}, trainee_t)
check("code cannot be reused", s==409, f"{s} {err(b)}")

# rosters
s,b = qry("trainerLink.myTrainees", coach_t)
roster = b.get("result",{}).get("data",{}).get("json",[]) if s==200 else []
check("trainer roster contains the trainee", any(r["userId"]==trainee["id"] for r in roster), json.dumps(roster)[:150])
link_id = roster[0]["linkId"] if roster else None
check("photo sharing OFF by default", bool(roster) and roster[0]["photosShared"] is False)

s,b = qry("trainerLink.myTrainers", trainee_t)
tr = b.get("result",{}).get("data",{}).get("json",[]) if s==200 else []
check("trainee sees their trainer", any(r["userId"]==coach["id"] for r in tr), json.dumps(tr)[:150])

# a DIFFERENT trainer must not see this trainee
s,b = req("/api/auth/signup","POST",{"email":"rival.coach@example.com","password":"a-reasonable-passphrase","name":"Rival","role":"trainer"})
rival_t = b["sessionToken"] if s==200 else None
s,b = qry("trainerLink.myTrainees", rival_t)
rival_roster = b.get("result",{}).get("data",{}).get("json",[]) if s==200 else []
check("UNLINKED trainer sees an EMPTY roster", rival_roster==[], json.dumps(rival_roster)[:150])

# photo consent: trainer must not be able to grant it for the trainee
s,b = mut("trainerLink.setPhotoConsent", {"linkId":link_id,"shared":True}, coach_t)
check("trainer CANNOT grant photo consent", s==403, f"{s} {err(b)}")
s,b = mut("trainerLink.setPhotoConsent", {"linkId":link_id,"shared":True}, trainee_t)
check("trainee CAN grant photo consent", s==200, f"{s} {err(b)}")

# rival cannot revoke someone else's link
s,b = mut("trainerLink.revoke", {"linkId":link_id}, rival_t)
check("stranger cannot revoke a link", s==403, f"{s} {err(b)}")

# trainee revokes
s,b = mut("trainerLink.revoke", {"linkId":link_id}, trainee_t)
check("trainee can revoke the link", s==200, f"{s} {err(b)}")
s,b = qry("trainerLink.myTrainees", coach_t)
after = b.get("result",{}).get("data",{}).get("json",[]) if s==200 else []
check("roster empty after revoke", after==[], json.dumps(after)[:150])

print(f"\n{P} passed, {F} failed")
sys.exit(0 if F==0 else 1)
