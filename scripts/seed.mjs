/**
 * Seeds the real content of the Initiative: its Tracks, their Tasks, and the
 * current Season.
 *
 * Every row here is traceable to one of the two source documents, cited inline
 * as `SOURCE:`. Nothing is invented. Where the documents are silent the gap is
 * marked `GAP:` and recorded in ADR 0019 rather than filled with a plausible
 * guess — a seed that quietly fabricates programme structure is worse than an
 * empty database, because it looks authoritative.
 *
 * Idempotent: re-running upserts on the natural keys (`slug` for Track and
 * Season, `track_id + position` for Task) and never duplicates. Safe to run
 * against a database that already has Members and awards, because it only ever
 * touches content rows — it will not delete a Task that has Points against it,
 * since `point_award.task_id` is RESTRICT.
 *
 * Usage: node scripts/seed.mjs [--dry-run]
 */
import { config } from "dotenv";
import pg from "pg";

config({
  path: new URL("../.env.local", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
});

const DRY_RUN = process.argv.includes("--dry-run");

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL_UNPOOLED or DATABASE_URL must be set");
  process.exit(1);
}

/**
 * The three Tracks named in الملف التعريفي p.14 under the مسارات العمل wing.
 *
 * SOURCE: "وهي من قبيل: مجموعات القراءة، البلاغ المبين، حتى يسمع كلام الله، ..."
 * The document's "من قبيل" makes that list explicitly non-exhaustive, and
 * Abdullah confirmed on 2026-08-07 that these three are the current Tracks.
 *
 * Slugs are Latin-only by schema policy (see content.ts): Arabic slugs
 * percent-encode into unreadable URLs. These are conventional ALA-LC-flavoured
 * transliterations, chosen to stay recognisable to an Arabic reader typing them.
 */
const TRACKS = [
  {
    slug: "reading-groups",
    title: "مجموعات القراءة",
    /**
     * SOURCE: p.12 المرحلة الأولى — the Initiative began as one book a month
     * discussed in a virtual meeting; p.15 ties the project to الشهيد القارئ.
     */
    summary:
      "أقدم مسارات المبادرة وأصلها الأول: نقرأ معًا ونناقش، كتابًا بعد كتاب، لنحوّل القراءة من فعلٍ فرديٍّ صامت إلى عملٍ ثقافيٍّ منتج. يحمل المسار رسالة الشهيد القارئ محمد علي فران.",
    state: "published",
    position: 1,
  },
  {
    slug: "al-balagh-al-mubin",
    title: "البلاغ المبين",
    /**
     * SOURCE: p.15 — الشهيد التعبوي حسين نور الدين's work was "في إطار فريق عمل
     * مشروع البلاغ المبين ... محاولةً لنشر فكر القائد بكلامه الذي أحبّ واقتدى".
     * The summary says what the document says the project does, no more.
     */
    summary:
      "مسارٌ تعبويٌّ ينقل كلام القائد بكلامه هو، لا بتأويلٍ عنه: نُبلّغ الفكر من مصدره الأصيل ونوصله إلى الناس بوضوح. يحمل المسار رسالة الشهيد التعبوي حسين نور الدين.",
    state: "published",
    position: 2,
  },
  {
    slug: "hatta-yasma-kalam-allah",
    title: "حتى يسمع كلام الله",
    /**
     * GAP: named on p.14 with no description anywhere in either document. The
     * summary below stays deliberately close to the Qur'anic phrase the title
     * quotes (التوبة ٦) rather than asserting activities the documents never
     * describe. Flagged for Abdullah to rewrite.
     */
    summary:
      "مسارٌ يقصد إسماع كلام الله لمن لم يسمعه، انطلاقًا من أنّ البلاغ حقٌّ للناس قبل أن يكون واجبًا علينا.",
    state: "published",
    position: 3,
  },
];

/**
 * Tasks.
 *
 * SOURCE for the two shapes: تطبيق فسيلة p.3 — "هذه المهام ... يمكن أن تكون مورد
 * حاجة للمستخدم ... أو تكون مهمة لأجل تثبيت وتعميق ما قرأه". So a Task is either
 * a resource to consume or a consolidation of something consumed.
 *
 * SOURCE for the point value: p.3's worked example, the only number in either
 * document — "مهمة القراءة: لخص الفصل الأول من هذا الكتاب في 3 أسطر لتحصل على 50
 * نقطة". Abdullah confirmed 50 still holds on 2026-08-07.
 *
 * SOURCE for the second example: same paragraph — "ومهمة الإعلام: صمم صورة
 * اقتباس من كلام السيد القائد وانشرها". No point value was given for it.
 *
 * GAP: point values for everything except the reading summary. Rather than
 * inventing a scale, the values below are derived from the one known anchor by
 * the rule recorded in ADR 0019: a Task requiring produced work is worth the
 * anchor's 50; a Task requiring only attendance or consumption is worth 20,
 * because it costs real time but produces nothing reviewable. Two numbers, one
 * of them documented, and the reasoning is written down where an Editor can
 * disagree with it.
 *
 * `mode` follows the enum's own contract in content.ts: `attest` for things the
 * Member can only declare, `review` for work an Editor must accept.
 */
const TASKS = {
  "reading-groups": [
    {
      position: 1,
      /**
       * The document's example verbatim in intent. The book is left unnamed
       * because the Initiative changes it every two months (p.12), so naming one
       * here would date the seed immediately.
       */
      title: "تلخيص الفصل الأول",
      instructions:
        "اقرأ الفصل الأول من كتاب الموسم، ثم لخّصه في ثلاثة أسطر بأسلوبك. لا ننتظر نقلًا عن الكتاب، بل ما فهمته منه.",
      mode: "review",
      points: 50,
    },
    {
      position: 2,
      /**
       * SOURCE: p.12 — the Initiative's founding practice was a monthly book
       * discussed in a meeting. Attendance is the archetypal attest Task: no
       * artefact exists to review.
       */
      title: "حضور جلسة النقاش",
      instructions:
        "احضر جلسة النقاش الشهرية للكتاب، حضورًا أو عبر الاجتماع المجازي، ثم أكّد حضورك.",
      mode: "attest",
      points: 20,
    },
  ],
  "al-balagh-al-mubin": [
    {
      position: 1,
      /**
       * SOURCE: p.3's second worked example, "مهمة الإعلام: صمم صورة اقتباس من
       * كلام السيد القائد وانشرها". Produced work, so `review` and the 50 anchor.
       */
      title: "تصميم صورة اقتباس ونشرها",
      instructions: "اختر اقتباسًا من كلام السيد القائد، صمّم منه صورة، وانشرها. ثم أرفق ما نشرته.",
      mode: "review",
      points: 50,
    },
  ],
  "hatta-yasma-kalam-allah": [
    /**
     * GAP: the documents describe no Tasks for this Track. Seeding invented ones
     * would put words in the Initiative's mouth about its own programme, so the
     * Track is seeded with none. It will render as a published Track with an
     * empty Task list, which is an honest state the Track page must handle
     * anyway — and handling it now is better than discovering it in production.
     */
  ],
};

/**
 * The current Season.
 *
 * SOURCE: الملف التعريفي p.13, first policy of الخطة الخمسية — "ضبط الموضوعات
 * الثقافية ضمن قوالب فصلية، بحيث نختار موضوعًا كل شهرين ونعالجه بكل الوسائل
 * الممكنة. هذا الموضوع يكون موضوعًا من خطة العام". Corroborated by p.12: "نختار
 * موضوعًا في بداية كلّ شهرين".
 *
 * So a Season is a two-month themed block, and the daily/weekly/monthly rhythms
 * in تطبيق فسيلة p.3 are tally and prize cadences *inside* it, not season
 * lengths. Confirmed with Abdullah 2026-08-07.
 *
 * GAP: the theme of the current block. The documents say themes come from the
 * annual plan, which we do not have, so the title names the block by its dates
 * and leaves the theme for an Editor to set.
 *
 * Boundaries are UTC midnight on the first of the month. `endsAt` is exclusive
 * (see currentSeason in seasons.ts), so consecutive Seasons can share an instant
 * without both matching.
 */
function currentSeasonRow(now = new Date()) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  /** Two-month blocks aligned to the calendar year: Jan–Feb, Mar–Apr, ... */
  const blockStart = m - (m % 2);
  const startsAt = new Date(Date.UTC(y, blockStart, 1));
  const endsAt = new Date(Date.UTC(y, blockStart + 2, 1));
  const pad = (n) => String(n + 1).padStart(2, "0");

  return {
    slug: `${y}-${pad(blockStart)}`,
    title: `موسم ${pad(blockStart)}–${pad(blockStart + 1)} / ${y}`,
    startsAt,
    endsAt,
  };
}

const client = new pg.Client({ connectionString: url });

async function main() {
  await client.connect();
  console.log(`\nSeeding ${DRY_RUN ? "(DRY RUN — will roll back)" : ""}\n`);

  await client.query("begin");

  try {
    /* ---- Season ------------------------------------------------------- */
    const s = currentSeasonRow();
    const seasonRes = await client.query(
      `insert into "season" (slug, title, starts_at, ends_at)
       values ($1, $2, $3, $4)
       on conflict (slug) do update
         set title = excluded.title,
             starts_at = excluded.starts_at,
             ends_at = excluded.ends_at
       returning id, slug, (xmax = 0) as inserted`,
      [s.slug, s.title, s.startsAt, s.endsAt],
    );
    const seasonRow = seasonRes.rows[0];
    console.log(`  season  ${seasonRow.inserted ? "created" : "updated"}  ${s.slug}  ${s.title}`);
    console.log(
      `          ${s.startsAt.toISOString().slice(0, 10)} → ${s.endsAt.toISOString().slice(0, 10)} (exclusive)`,
    );

    /* ---- Tracks ------------------------------------------------------- */
    const trackIds = new Map();
    for (const t of TRACKS) {
      /**
       * `published_at` must be non-null exactly when state is published — the
       * track_published_has_date CHECK. Set on first publish and preserved on
       * re-run so a re-seed does not rewrite the publication date.
       */
      /**
       * `$4::publish_state` is cast explicitly. Used bare, the same parameter
       * appears once where Postgres infers the enum (the `state` column) and
       * once inside a CASE where it infers text, and the planner rejects the
       * statement with "inconsistent types deduced for parameter". The cast
       * fixes the type at the call site instead of leaving it to inference.
       */
      const res = await client.query(
        `insert into "track" (slug, title, summary, state, position, published_at)
         values ($1, $2, $3, $4::publish_state, $5,
                 case when $4::publish_state = 'published' then now() else null end)
         on conflict (slug) do update
           set title = excluded.title,
               summary = excluded.summary,
               state = excluded.state,
               position = excluded.position,
               published_at = case
                 when excluded.state = 'published'
                   then coalesce("track".published_at, now())
                 else null
               end,
               updated_at = now()
         returning id, (xmax = 0) as inserted`,
        [t.slug, t.title, t.summary, t.state, t.position],
      );
      trackIds.set(t.slug, res.rows[0].id);
      console.log(
        `  track   ${res.rows[0].inserted ? "created" : "updated"}  ${t.slug.padEnd(26)} ${t.title}`,
      );
    }

    /* ---- Tasks -------------------------------------------------------- */
    let taskCount = 0;
    for (const [slug, tasks] of Object.entries(TASKS)) {
      const trackId = trackIds.get(slug);
      if (!trackId) throw new Error(`no track seeded for ${slug}`);

      for (const task of tasks) {
        /**
         * Task has no natural unique key in the schema, so the seed identifies a
         * Task by (track_id, position) and updates in place. That keeps re-runs
         * idempotent without adding a constraint the product does not need —
         * Editors will create Tasks through Payload, where position is just
         * display order and may collide harmlessly.
         */
        const existing = await client.query(
          `select id from "task" where track_id = $1 and position = $2`,
          [trackId, task.position],
        );

        if (existing.rows.length > 0) {
          await client.query(
            `update "task"
                set title = $1, instructions = $2, mode = $3, points = $4,
                    state = 'published',
                    published_at = coalesce(published_at, now()),
                    updated_at = now()
              where id = $5`,
            [task.title, task.instructions, task.mode, task.points, existing.rows[0].id],
          );
          console.log(
            `  task    updated  ${slug}/${task.position}  ${task.title} (${task.mode}, ${task.points})`,
          );
        } else {
          await client.query(
            `insert into "task"
               (track_id, title, instructions, mode, points, state, position, published_at)
             values ($1, $2, $3, $4, $5, 'published', $6, now())`,
            [trackId, task.title, task.instructions, task.mode, task.points, task.position],
          );
          console.log(
            `  task    created  ${slug}/${task.position}  ${task.title} (${task.mode}, ${task.points})`,
          );
        }
        taskCount++;
      }
      if (tasks.length === 0) {
        console.log(`  task    none     ${slug}  (documents specify no Tasks — see ADR 0019)`);
      }
    }

    if (DRY_RUN) {
      await client.query("rollback");
      console.log(`\nDRY RUN rolled back. ${TRACKS.length} tracks, ${taskCount} tasks.\n`);
    } else {
      await client.query("commit");
      console.log(`\nSeeded ${TRACKS.length} tracks, ${taskCount} tasks, 1 season.\n`);
    }
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(`\nSeed failed: ${err.message}`);
  if (err.detail) console.error(`detail: ${err.detail}`);
  process.exit(1);
});
