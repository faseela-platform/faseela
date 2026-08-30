/**
 * Verifies the live database matches what the schema promises.
 *
 * `[✓] migrations applied successfully` only means the SQL ran. It does not
 * mean the constraints exist — a migration that silently loses a CHECK, or a
 * partial index applied as a full one, reports exactly the same success. Every
 * guarantee in packages/db lives in one of these objects, so they are asserted
 * against the real database rather than trusted.
 *
 * Usage: node scripts/verify-db.mjs
 */
import { config } from "dotenv";
import pg from "pg";

config({
  path: new URL("../.env.local", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
});

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL_UNPOOLED or DATABASE_URL must be set");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });

let failures = 0;
const ok = (m) => console.log(`  ok    ${m}`);
const fail = (m) => {
  failures++;
  console.error(`  FAIL  ${m}`);
};

const EXPECTED_TABLES = [
  "account",
  "point_award",
  "rate_limit",
  "season",
  "session",
  "submission",
  "task",
  "track",
  "user",
  "verification",
];

/**
 * Every CHECK constraint the schema declares, by the name Postgres actually
 * stores. These are asserted by name and not by predicate because the name is
 * what a future migration can silently drop; the predicate is printed alongside
 * so a rename is distinguishable from a deletion at a glance.
 */
const EXPECTED_CHECKS = [
  "track_published_has_date",
  "task_published_has_date",
  "task_points_positive",
  "submission_reviewed_together",
  "season_ends_after_start",
  "point_award_points_positive",
];

/**
 * Columns whose absence would break a guarantee rather than merely a feature.
 * `anonymised_at` is here because erasure (ADR 0016) is the only sanctioned
 * alternative to deleting a Member, and without this column the code would fall
 * back to a delete that RESTRICT then refuses.
 */
const EXPECTED_COLUMNS = [
  ["user", "anonymised_at"],
  ["user", "phone_number"],
  ["point_award", "points"],
];

/** Indexes carrying a uniqueness guarantee the application relies on. */
const EXPECTED_UNIQUE = [
  "submission_task_user_unique",
  "point_award_submission_unique",
  "user_phone_number_unique",
];

try {
  await client.connect();

  const { rows: version } = await client.query("select version()");
  console.log(`\n${version[0].version.split(",")[0]}\n`);

  console.log("tables");
  const { rows: tables } = await client.query(
    `select table_name from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE'`,
  );
  const names = tables.map((r) => r.table_name);
  for (const t of EXPECTED_TABLES) {
    names.includes(t) ? ok(t) : fail(`missing table: ${t}`);
  }
  const extra = names.filter((n) => !EXPECTED_TABLES.includes(n) && n !== "__drizzle_migrations");
  if (extra.length) console.log(`  note  also present: ${extra.join(", ")}`);

  console.log("\ncolumns");
  const { rows: cols } = await client.query(
    `select table_name, column_name from information_schema.columns
     where table_schema = 'public'`,
  );
  for (const [table, column] of EXPECTED_COLUMNS) {
    cols.some((r) => r.table_name === table && r.column_name === column)
      ? ok(`${table}.${column}`)
      : fail(`missing column: ${table}.${column}`);
  }

  console.log("\ncheck constraints");
  const { rows: checks } = await client.query(
    `select conname, pg_get_constraintdef(oid) as def from pg_constraint
     where contype = 'c' and connamespace = 'public'::regnamespace`,
  );
  for (const c of EXPECTED_CHECKS) {
    const found = checks.find((r) => r.conname === c);
    found ? ok(`${c}  ${found.def.replace(/\s+/g, " ")}`) : fail(`missing CHECK: ${c}`);
  }
  const extraChecks = checks.filter((r) => !EXPECTED_CHECKS.includes(r.conname));
  /**
   * Unexpected CHECKs are reported, not failed. Payload will add its own
   * constraints to its own tables (ADR 0014) and that is legitimate; what is not
   * legitimate is one of ours going missing, which the loop above catches.
   */
  if (extraChecks.length) {
    console.log(`  note  undeclared CHECKs: ${extraChecks.map((r) => r.conname).join(", ")}`);
  }

  console.log("\nunique indexes");
  const { rows: idx } = await client.query(
    `select indexname, indexdef from pg_indexes where schemaname = 'public'`,
  );
  for (const u of EXPECTED_UNIQUE) {
    const found = idx.find((r) => r.indexname === u);
    if (!found) {
      fail(`missing unique index: ${u}`);
      continue;
    }
    if (!/UNIQUE/i.test(found.indexdef)) {
      fail(`${u} exists but is NOT unique`);
      continue;
    }
    ok(u);
  }

  /**
   * The phone index must be partial. A full unique index on a nullable column
   * behaves the same in Postgres for NULLs, but the partial form is what the
   * schema declares and what makes the intent explicit — if this ever becomes
   * full, adding phone auth later silently changes meaning.
   */
  const phone = idx.find((r) => r.indexname === "user_phone_number_unique");
  if (phone) {
    /WHERE .*phone_number IS NOT NULL/i.test(phone.indexdef)
      ? ok("user_phone_number_unique is partial (WHERE phone_number IS NOT NULL)")
      : fail(`user_phone_number_unique is not partial: ${phone.indexdef}`);
  }

  /**
   * Nothing may cascade into point_award. If deleting a Task, a Season, or a
   * Member erases the record that work was done, the ledger is not append-only
   * in practice and past Leaderboards silently reorder (ADR 0015, ADR 0016).
   * This check caught a genuine CASCADE on user_id that the migration reported
   * as a clean success.
   */
  console.log("\nforeign key delete behaviour: point_award (all must RESTRICT)");
  const { rows: fks } = await client.query(
    `select conname, confdeltype from pg_constraint
     where contype = 'f' and conrelid = 'point_award'::regclass
     order by conname`,
  );
  if (fks.length !== 4) fail(`expected 4 FKs on point_award, found ${fks.length}`);
  for (const fk of fks) {
    // 'r' = RESTRICT, 'a' = NO ACTION, 'c' = CASCADE, 'n' = SET NULL
    fk.confdeltype === "r"
      ? ok(`${fk.conname} = RESTRICT`)
      : fail(`${fk.conname} has confdeltype '${fk.confdeltype}', expected 'r' (RESTRICT)`);
  }

  /**
   * The converse assertion. Better Auth's credential tables *must* cascade —
   * they are pure access, and erasure has to be able to revoke them. Asserting
   * both directions is what stops a well-meaning "make everything RESTRICT"
   * sweep from leaving sessions undeletable.
   */
  console.log("\nforeign key delete behaviour: session, account (must CASCADE)");
  const { rows: authFks } = await client.query(
    `select conname, confdeltype from pg_constraint
     where contype = 'f' and conrelid in ('session'::regclass, 'account'::regclass)
     order by conname`,
  );
  for (const fk of authFks) {
    fk.confdeltype === "c"
      ? ok(`${fk.conname} = CASCADE`)
      : fail(`${fk.conname} has confdeltype '${fk.confdeltype}', expected 'c' (CASCADE)`);
  }

  console.log("\nenums");
  const { rows: enums } = await client.query(
    `select t.typname, array_agg(e.enumlabel order by e.enumsortorder) as labels
     from pg_type t join pg_enum e on e.enumtypid = t.oid
     where t.typnamespace = 'public'::regnamespace group by t.typname`,
  );
  for (const e of enums) {
    /**
     * node-postgres returns `array_agg` of an enum type as a Postgres array
     * *literal* string, not a JS array, because the aggregate's element type has
     * no registered parser. Normalising both shapes keeps this working whichever
     * driver version is installed.
     */
    const labels = Array.isArray(e.labels)
      ? e.labels
      : String(e.labels)
          .replace(/^\{|\}$/g, "")
          .split(",");
    ok(`${e.typname}: ${labels.join(" | ")}`);
  }

  console.log(
    failures === 0
      ? "\nlive schema matches the declared guarantees\n"
      : `\n${failures} mismatch(es) between the schema and the live database\n`,
  );
} catch (err) {
  console.error(`\nconnection or query failed: ${err.message}\n`);
  failures++;
} finally {
  await client.end();
}

process.exit(failures === 0 ? 0 : 1);
