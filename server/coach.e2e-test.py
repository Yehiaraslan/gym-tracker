"""
End-to-end test for the coach ↔ trainee feature against a running backend.
Usage: python3 server/coach.e2e-test.py [base_url]   (default http://127.0.0.1:3020)

Creates throwaway accounts (unique per run), links them, assigns a workout
plan + meal plan, exchanges messages, reads progress, and checks that every
cross-tenant read/write is refused.
"""
import json, sys, time, urllib.request, urllib.parse, uuid

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:3020"

def req(path, method="GET", body=None, token=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(BASE + path, data=data, method=method)
    r.add_header("Content-Type", "application/json")
    r.add_header("User-Agent", "MYLifestyle/e2e (Android)")
    if token: r.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(r, timeout=40) as resp:
            return resp.status, json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try: return e.code, json.loads(raw)
        except Exception: return e.code, {"raw": raw[:200]}

def mut(proc, inp, token): return req(f"/api/trpc/{proc}", "POST", {"json": inp}, token)
def qry(proc, token, inp=None):
    q = "?input=" + urllib.parse.quote(json.dumps({"json": inp})) if inp is not None else ""
    return req(f"/api/trpc/{proc}{q}", "GET", None, token)
def data(b): return b.get("result", {}).get("data", {}).get("json")
def err(b):
    try: return b["error"]["json"]["message"]
    except Exception: return json.dumps(b)[:120]

P = F = 0
def check(name, cond, detail=""):
    global P, F
    if cond: P += 1; print(f"PASS  {name}")
    else: F += 1; print(f"FAIL  {name}  {detail}")

run = uuid.uuid4().hex[:8]
PW = "a-reasonable-passphrase"
def signup(role, tag):
    s, b = req("/api/auth/signup", "POST", {"email": f"{tag}.{run}@example.com", "password": PW, "name": tag.title(), "role": role})
    assert s == 200, (s, b)
    return b["sessionToken"], b["user"]

coach_t, coach = signup("trainer", "coach")
trainee_t, trainee = signup("user", "trainee")
rival_t, rival = signup("trainer", "rival")
print(f"coach={coach['id']} trainee={trainee['id']} rival={rival['id']}\n")

PLAN = {
    "name": "E2E Upper/Lower", "description": "test block", "durationWeeks": 6,
    "sessions": [
        {"id": "upper", "name": "Upper", "exercises": [
            {"name": "Barbell Bench Press", "sets": 4, "repsMin": 6, "repsMax": 8, "restSeconds": 180, "notes": "", "muscleGroup": "upper", "bodyPart": "Chest", "category": "compound"},
            {"name": "Chest-Supported DB Row", "sets": 3, "repsMin": 8, "repsMax": 10, "restSeconds": 120, "notes": "squeeze", "muscleGroup": "upper", "bodyPart": "Back", "category": "compound"},
        ]},
        {"id": "lower", "name": "Lower", "exercises": [
            {"name": "Barbell Back Squat", "sets": 4, "repsMin": 6, "repsMax": 8, "restSeconds": 180, "notes": "", "muscleGroup": "lower", "bodyPart": "Legs", "category": "compound"},
        ]},
    ],
    "weeklySchedule": {"Sunday": "upper", "Monday": "lower", "Tuesday": "rest", "Wednesday": "upper", "Thursday": "lower", "Friday": "rest", "Saturday": "rest"},
    "notes": "Go hard",
}
MEALS = {
    "name": "E2E Cut", "trainingDay": {"calories": 2600, "protein": 180, "carbs": 290, "fat": 70},
    "restDay": {"calories": 2300, "protein": 180, "carbs": 215, "fat": 70},
    "meals": [
        {"mealNumber": 1, "name": "Breakfast", "time": "08:00", "notes": "", "foods": [
            {"foodName": "Eggs", "servingGrams": 150, "calories": 215, "protein": 19, "carbs": 1, "fat": 15},
            {"foodName": "Oats", "servingGrams": 80, "calories": 300, "protein": 10, "carbs": 54, "fat": 5},
        ]},
        {"mealNumber": 4, "name": "Dinner", "time": "20:30", "notes": "no sauce", "foods": []},
    ],
    "notes": "3L water",
}

# ── before link: every coach-side op must be refused ──
s, b = mut("coach.assignWorkoutPlan", {"traineeId": trainee["id"], "plan": PLAN}, coach_t)
check("assign plan BEFORE link refused", s == 403, f"{s} {err(b)}")
s, b = qry("coach.traineeProgress", coach_t, {"traineeId": trainee["id"]})
check("progress BEFORE link refused", s == 403, f"{s} {err(b)}")
s, b = mut("coach.sendMessage", {"peerId": trainee["id"], "body": "hi"}, coach_t)
check("message BEFORE link refused", s == 403, f"{s} {err(b)}")
s, b = qry("coach.myPlans", trainee_t)
check("trainee myPlans empty before link", s == 200 and data(b) == {"workoutPlan": None, "mealPlan": None}, f"{s} {err(b)}")

# ── link ──
s, b = mut("trainerLink.createInvite", None, coach_t); code = data(b)["code"]
s, b = mut("trainerLink.redeem", {"code": code}, trainee_t)
check("trainee redeems invite", s == 200, f"{s} {err(b)}")

# ── roster overview ──
s, b = qry("coach.roster", coach_t)
roster = data(b) or []
check("roster shows trainee with no plans yet", s == 200 and len(roster) == 1 and roster[0]["userId"] == trainee["id"] and roster[0]["workoutPlanName"] is None, f"{s} {json.dumps(roster)[:200]}")

# ── plans ──
s, b = mut("coach.assignWorkoutPlan", {"traineeId": trainee["id"], "plan": PLAN}, coach_t)
check("coach assigns workout plan", s == 200 and data(b)["name"] == PLAN["name"], f"{s} {err(b)}")
plan1 = data(b)
bad = dict(PLAN, weeklySchedule=dict(PLAN["weeklySchedule"], Friday="ghost"))
s, b = mut("coach.assignWorkoutPlan", {"traineeId": trainee["id"], "plan": bad}, coach_t)
check("schedule pointing at unknown session rejected", s == 400, f"{s} {err(b)}")
s, b = mut("coach.assignWorkoutPlan", {"traineeId": trainee["id"], "plan": PLAN}, rival_t)
check("RIVAL coach cannot assign a plan", s == 403, f"{s} {err(b)}")
s, b = mut("coach.assignWorkoutPlan", {"traineeId": coach["id"], "plan": PLAN}, trainee_t)
check("trainee cannot assign a plan to the coach", s == 403, f"{s} {err(b)}")

s, b = mut("coach.assignMealPlan", {"traineeId": trainee["id"], "plan": MEALS}, coach_t)
check("coach assigns meal plan", s == 200 and data(b)["trainingDay"]["calories"] == 2600, f"{s} {err(b)}")

s, b = qry("coach.myPlans", trainee_t)
mp = data(b)
check("trainee receives both plans", s == 200 and mp["workoutPlan"]["id"] == plan1["id"] and mp["mealPlan"]["name"] == "E2E Cut" and mp["workoutPlan"]["coachName"] == "Coach", f"{s} {json.dumps(mp)[:200]}")
check("trainee plan carries sessions + schedule", len(mp["workoutPlan"]["sessions"]) == 2 and mp["workoutPlan"]["weeklySchedule"]["Monday"] == "lower")

# re-assign archives the previous one
s, b = mut("coach.assignWorkoutPlan", {"traineeId": trainee["id"], "plan": dict(PLAN, name="E2E v2")}, coach_t)
plan2 = data(b)
s, b = qry("coach.myPlans", trainee_t)
check("re-assign replaces the active plan", data(b)["workoutPlan"]["id"] == plan2["id"] and data(b)["workoutPlan"]["name"] == "E2E v2")
s, b = qry("coach.traineePlans", coach_t, {"traineeId": trainee["id"]})
check("coach reads what they assigned", s == 200 and data(b)["workoutPlan"]["id"] == plan2["id"] and data(b)["mealPlan"]["name"] == "E2E Cut", f"{s} {err(b)}")
s, b = qry("coach.traineePlans", rival_t, {"traineeId": trainee["id"]})
check("RIVAL cannot read the plans", s == 403, f"{s} {err(b)}")

# ── messages ──
s, b = mut("coach.sendMessage", {"peerId": coach["id"], "body": "Coach, knee hurts on squats"}, trainee_t)
check("trainee messages coach", s == 200, f"{s} {err(b)}")
s, b = mut("coach.sendMessage", {"peerId": trainee["id"], "body": "Swap to leg press this week"}, coach_t)
check("coach replies", s == 200, f"{s} {err(b)}")
s, b = mut("coach.sendMessage", {"peerId": trainee["id"], "body": "   "}, coach_t)
check("blank message rejected", s == 400, f"{s} {err(b)}")
s, b = mut("coach.sendMessage", {"peerId": trainee["id"], "body": "spam"}, rival_t)
check("RIVAL cannot message the trainee", s == 403, f"{s} {err(b)}")

s, b = qry("coach.unreadCount", trainee_t)
check("trainee has 1 unread", data(b) == 1, f"{s} {data(b)}")
s, b = qry("coach.threads", coach_t)
th = data(b) or []
check("coach thread list shows trainee + last message", len(th) == 1 and th[0]["peerId"] == trainee["id"] and th[0]["lastMessage"].startswith("Swap"), json.dumps(th)[:200])
s, b = qry("coach.thread", trainee_t, {"peerId": coach["id"]})
msgs = data(b) or []
check("thread has both messages oldest-first", len(msgs) == 2 and msgs[0]["senderId"] == trainee["id"] and msgs[1]["senderId"] == coach["id"], json.dumps(msgs)[:200])
s, b = qry("coach.unreadCount", trainee_t)
check("reading the thread clears unread", data(b) == 0, f"{data(b)}")
s, b = qry("coach.thread", rival_t, {"peerId": trainee["id"]})
check("RIVAL sees an empty thread", s == 200 and data(b) == [], f"{s} {data(b)}")

# ── progress ──
s, b = qry("coach.traineeProgress", coach_t, {"traineeId": trainee["id"]})
pg = data(b)
check("coach reads progress (empty athlete)", s == 200 and pg["trainee"]["id"] == trainee["id"] and pg["workoutsLast7"] == 0 and pg["activeWorkoutPlan"]["id"] == plan2["id"], f"{s} {err(b)}")
check("photos not shared by default", pg["trainee"]["photosShared"] is False)
s, b = qry("coach.traineeProgress", rival_t, {"traineeId": trainee["id"]})
check("RIVAL cannot read progress", s == 403, f"{s} {err(b)}")
s, b = qry("coach.roster", coach_t)
r2 = (data(b) or [{}])[0]
check("roster reflects plan names", r2.get("workoutPlanName") == "E2E v2" and r2.get("mealPlanName") == "E2E Cut", json.dumps(r2)[:200])

# ── revoke: plans stop being delivered, messaging closes, history readable ──
link_id = roster[0]["linkId"]
s, b = mut("trainerLink.revoke", {"linkId": link_id}, trainee_t)
check("trainee revokes link", s == 200, f"{s} {err(b)}")
s, b = qry("coach.myPlans", trainee_t)
check("after revoke, plans are no longer delivered", data(b) == {"workoutPlan": None, "mealPlan": None}, json.dumps(data(b))[:120])
s, b = mut("coach.sendMessage", {"peerId": trainee["id"], "body": "still there?"}, coach_t)
check("after revoke, coach cannot message", s == 403, f"{s} {err(b)}")
s, b = qry("coach.thread", trainee_t, {"peerId": coach["id"]})
check("after revoke, history still readable", s == 200 and len(data(b)) == 2)
s, b = qry("coach.traineeProgress", coach_t, {"traineeId": trainee["id"]})
check("after revoke, progress refused", s == 403, f"{s} {err(b)}")

print(f"\n{P} passed, {F} failed")
sys.exit(0 if F == 0 else 1)
