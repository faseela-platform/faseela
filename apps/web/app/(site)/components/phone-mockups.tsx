import { app } from "../content";

/**
 * Three phone mockups for the المنصّة section — home, a track with its tasks, the season board —
 * as the owner drew them. Illustrative: the names and numbers are sample values, the screens are
 * the real ones (Slice 5–8), and the caption says so. `aria-hidden` throughout; the section's
 * prose carries the meaning.
 *
 * Fixed hex on purpose: the phones show the app's LIGHT screens inside a section that is dark in
 * both themes, so they must not follow the page theme.
 */
const ink = "#0b0e0d",
  paper = "#f7fbfa",
  muted = "#5d6260",
  faint = "#767978",
  hairline = "#e2e6e5";
const brand = "#30917f",
  accent = "#977b2b",
  tint = "#eef7f4";

function Frame({
  width,
  height,
  children,
  tilt,
  delay,
  wide,
}: {
  width: number;
  height: number;
  children: React.ReactNode;
  tilt: string;
  delay: string;
  wide?: boolean;
}) {
  return (
    <div
      className="phone-bob"
      style={{ transform: tilt, transformStyle: "preserve-3d", animationDelay: delay }}
    >
      <div
        className="rounded-[38px] p-2.5"
        style={{
          width,
          background: "#1d2120",
          border: `1px solid ${wide ? "#3b403f" : "#313534"}`,
          boxShadow: wide ? "0 50px 100px rgba(0,0,0,0.65)" : "0 40px 80px rgba(0,0,0,0.55)",
        }}
      >
        <div
          className="overflow-hidden rounded-[30px]"
          style={{ background: paper, color: ink, height }}
        >
          <div className="flex justify-center pt-2">
            <span className="h-[18px] w-[74px] rounded-xl" style={{ background: ink }} />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

const L = ({ v }: { v: string }) => (
  <span dir="ltr" className="num">
    {v}
  </span>
);

function Home() {
  return (
    <>
      <div className="flex items-center justify-between px-4 pt-3.5">
        <span className="font-display text-[15px] font-extrabold" style={{ color: accent }}>
          فسيلـة
        </span>
        <span
          className="rounded-full px-2.5 py-1 text-[11px] font-bold"
          style={{ color: brand, background: "#e5f4f0" }}
        >
          نقاطي <L v="120" />
        </span>
      </div>
      <div className="px-4 pt-3">
        <p className="font-display text-[17px] font-bold">أهلاً، سارة</p>
        <p className="text-[11px]" style={{ color: faint }}>
          لديك مهمتان هذا الأسبوع
        </p>
      </div>
      <div className="flex flex-col gap-2.5 px-4 py-3">
        {[
          {
            kind: "إعلان",
            title: "لقاء محطات — الجمعة القادم",
            grad: "linear-gradient(135deg, #1ecfae, #0e9b82)",
            color: brand,
          },
          {
            kind: "منتج",
            title: "خلاصة كتاب — جديد المسار",
            grad: "linear-gradient(135deg, #e3bd4e, #b18f2f)",
            color: accent,
          },
        ].map((c) => (
          <div
            key={c.title}
            className="overflow-hidden rounded-[14px]"
            style={{ border: `1px solid ${hairline}` }}
          >
            <div className="h-16" style={{ background: c.grad }} />
            <div className="px-3 py-2.5">
              <p className="text-[10px] font-bold" style={{ color: c.color }}>
                {c.kind}
              </p>
              <p className="mt-0.5 text-[12px] font-semibold">{c.title}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function Track() {
  const tasks = [
    { t: "لخّص الفصل الأول في ثلاثة أسطر", pts: "10+", done: true },
    { t: "شارك اقتباساً أعجبك", pts: "5+", done: true },
    { t: "صمّم بطاقة اقتباس وانشرها", pts: "15+", done: false },
  ];
  return (
    <>
      <div className="px-[18px] pt-4">
        <p className="text-[10px] font-bold" style={{ color: brand }}>
          مسار
        </p>
        <p className="font-display mt-0.5 text-[17px] font-extrabold">الوعي الفكري</p>
        <div
          className="mt-3 h-2 overflow-hidden rounded-[var(--radius-btn)]"
          style={{ background: hairline }}
        >
          <span
            className="block h-full w-[64%] rounded-[var(--radius-btn)]"
            style={{ background: "linear-gradient(90deg, #0e9b82, #1ecfae)" }}
          />
        </div>
        <p className="mt-1.5 text-[10px]" style={{ color: faint }}>
          <L v="64%" /> من المسار · <L v="96" /> نقطة
        </p>
      </div>
      <div className="flex flex-col gap-2 px-[18px] py-3.5">
        {tasks.map((task) => (
          <div
            key={task.t}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
            style={task.done ? { background: tint } : { border: "1px dashed #c9cecd" }}
          >
            <span
              className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] text-white"
              style={task.done ? { background: brand } : { border: "1.5px solid #c9cecd" }}
            >
              {task.done ? "✓" : ""}
            </span>
            <span
              className="flex-1 text-[11.5px] font-semibold"
              style={{ color: task.done ? ink : muted }}
            >
              {task.t}
            </span>
            <span
              className="text-[10px] font-bold"
              style={{ color: task.done ? brand : accent }}
              dir="ltr"
            >
              {task.pts}
            </span>
          </div>
        ))}
        <div
          className="mt-1.5 rounded-xl py-2.5 text-center text-[12px] font-bold text-white"
          style={{ background: brand }}
        >
          سلّم مهمتك
        </div>
      </div>
    </>
  );
}

function Board() {
  const rows = [
    { rank: "1", name: "نور", pts: "340", avatar: "#c7a958", first: true },
    { rank: "2", name: "عمر", pts: "320", avatar: "#61c0ad" },
    { rank: "3", name: "سارة", pts: "310", avatar: "#8ed5c4" },
  ];
  return (
    <>
      <div className="px-[18px] pt-4">
        <p className="text-[10px] font-bold" style={{ color: accent }}>
          موسم الخريف
        </p>
        <p className="font-display mt-0.5 text-[17px] font-extrabold">لوحة الصدارة</p>
      </div>
      <div className="flex flex-col gap-2 px-[18px] py-3.5">
        {rows.map((r) => (
          <div
            key={r.rank}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
            style={
              r.first
                ? {
                    background: "linear-gradient(135deg, #fdf6e3, #f6ead0)",
                    border: "1px solid #e6dcc1",
                  }
                : { border: `1px solid ${hairline}` }
            }
          >
            <span
              className="font-display text-[13px] font-extrabold"
              style={{ color: r.first ? accent : faint }}
              dir="ltr"
            >
              {r.rank}
            </span>
            <span className="h-[26px] w-[26px] rounded-full" style={{ background: r.avatar }} />
            <span className="flex-1 text-[12px] font-bold">{r.name}</span>
            <span
              className="text-[11px] font-bold"
              style={{ color: r.first ? accent : muted }}
              dir="ltr"
            >
              {r.pts}
            </span>
          </div>
        ))}
        <div
          className="mt-1 rounded-xl px-3 py-2.5 text-center text-[11px] font-semibold"
          style={{ background: tint, color: "#2f7769" }}
        >
          رتبتك: خاص · <L v="120" /> نقطة
        </div>
      </div>
    </>
  );
}

export function PhoneMockups() {
  return (
    <figure aria-hidden="true" className="mt-14 md:mt-[70px]">
      <div
        className="flex flex-wrap items-end justify-center gap-8 md:gap-11"
        style={{ perspective: "1600px" }}
      >
        <div data-reveal="0" className="hidden md:block">
          <Frame width={235} height={460} tilt="rotateY(14deg)" delay="0s">
            <Home />
          </Frame>
          <p className="text-caption mt-4 text-center" style={{ color: faint }}>
            {app.screens[0]}
          </p>
        </div>
        <div data-reveal="120">
          <Frame
            width={250}
            height={490}
            tilt="translateZ(60px) translateY(-24px)"
            delay="0.4s"
            wide
          >
            <Track />
          </Frame>
          <p className="text-caption mt-4 text-center" style={{ color: "#a7abaa" }}>
            {app.screens[1]}
          </p>
        </div>
        <div data-reveal="240" className="hidden md:block">
          <Frame width={235} height={460} tilt="rotateY(-14deg)" delay="0.8s">
            <Board />
          </Frame>
          <p className="text-caption mt-4 text-center" style={{ color: faint }}>
            {app.screens[2]}
          </p>
        </div>
      </div>
      <figcaption className="text-caption mt-6 text-center" style={{ color: faint }}>
        {app.mockupNote}
      </figcaption>
    </figure>
  );
}
