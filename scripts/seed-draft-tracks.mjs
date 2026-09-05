/**
 * Seeds the six remaining §2 Tracks as DRAFTS — R3-1 (owner decision 2026-09-01:
 * "I seed the remaining six as unpublished drafts; supervisors publish when ready").
 *
 * Titles come verbatim from المواصفات التفصيلية §2; each summary is written from the
 * one topic line §2/§31 gives that Track and nothing more (ADR 0019: seed content
 * comes from the initiative's own documents — where the documents are thin, the
 * summary stays thin and the supervisor completes it before publishing).
 *
 * Idempotent by slug, and NEVER touches the three published Tracks. A Track already
 * edited by a supervisor keeps their text: the upsert only applies while the row is
 * still a draft.
 *
 *   node scripts/seed-draft-tracks.mjs
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

/** Positions continue after the three published Tracks (1–3). */
const DRAFT_TRACKS = [
  {
    slug: "lisan-sidq",
    title: "لسان صدق",
    /** §2: فكر السيد حسن نصر الله; §31: مواد مرتبطة بفكر السيد حسن نصر الله. */
    summary: "مسارٌ يُعنى بفكر السيد حسن نصر الله: نقرأ كلامه ونتدارسه وننقله بلسان صدق.",
    position: 4,
  },
  {
    slug: "naktub-ma-qaddamu",
    title: "نكتب ما قدموا",
    /** §2: الشهداء; §31: مواد مرتبطة بالشهداء. */
    summary: "مسارٌ يُعنى بالشهداء: نوثّق سيرهم وما قدّموا، فنكتب ما قدّموا ليبقى.",
    position: 5,
  },
  {
    slug: "nawa",
    title: "نوى",
    /** §2: اللقاءات الثقافية الشعبية غير النخبوية; §31: مواد اللقاءات الثقافية الشعبية. */
    summary: "مسار اللقاءات الثقافية الشعبية غير النخبوية: ثقافةٌ تُدار بين الناس، لا فوقهم.",
    position: 6,
  },
  {
    slug: "ma-yasturun",
    title: "ما يسطرون",
    /** §2: الكتابة; §31: مواد الكتابة. */
    summary: "مسار الكتابة: نتعلّم أن نكتب، ونكتب لنُبلّغ — والقلم وما يسطرون.",
    position: 7,
  },
  {
    slug: "siru-fi-al-ard",
    title: "سيروا في الأرض",
    /** §2: التجارب السابقة من التاريخ والعصر الحديث; §31: التجارب التاريخية والمعاصرة. */
    summary: "مسارٌ يدرس التجارب السابقة من التاريخ والعصر الحديث: نسير في الأرض لننظر ونعتبر.",
    position: 8,
  },
  {
    slug: "al-masar-al-fanni",
    title: "المسار الفني",
    /** §2: الفن; §31: المواد الفنية. */
    summary: "مسار الفن: إنتاجٌ فنيٌّ يحمل رسالة المبادرة بلغة الصورة والصوت والمشهد.",
    position: 9,
  },
];

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query("begin");
  for (const t of DRAFT_TRACKS) {
    const res = await client.query(
      `insert into "track" (slug, title, summary, state, position, published_at)
       values ($1, $2, $3, 'draft'::publish_state, $4, null)
       on conflict (slug) do update
         set title = excluded.title,
             summary = excluded.summary,
             position = excluded.position
         where "track".state = 'draft'
       returning slug, state, (xmax = 0) as inserted`,
      [t.slug, t.title, t.summary, t.position],
    );
    const r = res.rows[0];
    console.log(
      r
        ? `  ${r.inserted ? "created" : "refreshed"}  ${t.slug}  «${t.title}»  (${r.state})`
        : `  left alone  ${t.slug}  (no longer a draft)`,
    );
  }
  await client.query("commit");
  console.log("done — six §2 Tracks stand as drafts; supervisors publish from /idara.");
} catch (e) {
  await client.query("rollback");
  throw e;
} finally {
  await client.end();
}
