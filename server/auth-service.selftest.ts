import { hashPassword, verifyPassword, needsRehash, generateToken, hashToken,
         validatePassword, normalizeEmail, isValidEmail, generateInviteCode, isExpired } from "./auth-service";

let pass = 0, fail = 0;
const check = (name: string, cond: boolean) => { cond ? pass++ : fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}`); };

(async () => {
  const pw = "correct horse battery staple";
  const h = await hashPassword(pw);
  check("hash is self-describing scrypt$N$r$p$salt$hash", /^scrypt\$65536\$8\$1\$[^$]+\$[^$]+$/.test(h));
  check("correct password verifies", await verifyPassword(pw, h));
  check("wrong password rejected", !(await verifyPassword(pw + "x", h)));
  check("empty password rejected", !(await verifyPassword("", h)));
  check("null hash rejected, no throw", !(await verifyPassword(pw, null)));
  check("malformed hash rejected, no throw", !(await verifyPassword(pw, "garbage")));
  check("truncated hash rejected", !(await verifyPassword(pw, "scrypt$65536$8$1$abc")));
  check("bcrypt-shaped hash rejected", !(await verifyPassword(pw, "$2b$12$abcdefghijklmnopqrstuv")));

  const h2 = await hashPassword(pw);
  check("same password → different hash (salted)", h !== h2);
  check("both salted hashes still verify", (await verifyPassword(pw, h)) && (await verifyPassword(pw, h2)));

  check("needsRehash false at current params", !needsRehash(h));
  check("needsRehash true for weaker params", needsRehash("scrypt$16384$8$1$YQ==$Yg=="));
  check("needsRehash true for foreign format", needsRehash("$2b$12$whatever"));

  const t1 = generateToken(), t2 = generateToken();
  check("token raw is random", t1.raw !== t2.raw);
  check("token hash matches its raw", hashToken(t1.raw) === t1.hash);
  check("token hash != raw (stored hashed)", t1.hash !== t1.raw);
  check("token hash is sha256 hex", /^[0-9a-f]{64}$/.test(t1.hash));

  check("short password rejected", !validatePassword("short").ok);
  check("common password rejected", !validatePassword("mypassword123").ok);
  check("good password accepted", validatePassword("a-reasonable-passphrase").ok);

  check("email normalized", normalizeEmail("  Yehia@AVEVA.com ") === "yehia@aveva.com");
  check("valid email accepted", isValidEmail("a@b.co"));
  check("invalid email rejected", !isValidEmail("not-an-email"));

  const codes = new Set(Array.from({length: 200}, () => generateInviteCode()));
  check("invite codes 8 chars, unambiguous alphabet", [...codes].every(c => /^[A-HJ-NP-Z2-9]{8}$/.test(c)));
  check("invite codes not colliding over 200", codes.size === 200);

  check("expired date is expired", isExpired(new Date(Date.now() - 1000)));
  check("future date is not expired", !isExpired(new Date(Date.now() + 60000)));
  check("null expiry treated as expired", isExpired(null));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
})();
