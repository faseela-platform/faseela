/**
 * Landing page content, in Arabic, extracted from Faseela's own profile document and the app
 * specification, then revised to the owner's landing design (assets/design/faseela-landing.dc.html,
 * 2026-08-28) — ADR 0029. Kept separate from the components so copy edits never touch layout.
 *
 * Vocabulary follows CONTEXT.md: مسار (Track), مهمة (Task), نقطة (Point), موسم (Season),
 * محطة (Station), رتبة (Tier).
 */

export const hero = {
  /** Wordmark. The tatweel in فسيلـة is authored, load-bearing, and must never be normalised away. */
  wordmark: "فسيلـة",
  /** Split at word boundaries for the stagger — never at letters, which would sever cursive joins. */
  taglineWords: ["نغرس", "الوعي", "في", "جيلٍ", "يصنع", "غدَه"],
  /** The word the tagline lights in teal. */
  taglineAccentIndex: 1,
  /**
   * No platform clause ("قريباً على iOS وAndroid") — the app ships with the site (owner, 2026-08-29).
   */
  lede: "مبادرة شبابية لبنانية تبني الإنسان عبر المعرفة والعمل، وتفتح للشباب مساراتٍ يسيرون فيها خطوةً خطوة.",
  cta: "ابدأ مسارك",
  ctaHref: "/masarat",
  ctaSecondary: "تعرّف علينا",
  ctaSecondaryHref: "#about",
  /**
   * The three chips that orbit the mark — the product loop, never anything user-specific
   * (owner decision D6). Also rendered as a row on phones where they cannot orbit.
   */
  chips: [
    { label: "اختر مساراً", sub: "٩ مسارات معرفية", icon: "tracks" },
    { label: "أنجز مهمّة", sub: "قصيرة، في وقتك", icon: "check" },
    { label: "اجمع نقاطاً", sub: "وارتقِ في الرتب", icon: "ring" },
  ],
} as const;

export const hadith = {
  text: "إذا قامت الساعة وفي يد أحدكم فسيلة فليغرسها",
  attribution: "حديث شريف",
  /** The quote card in "من نحن" adds the provenance of the name. */
  cardAttribution: "حديث شريف — ومنه اسم المبادرة",
} as const;

/** Numbers are real, from the profile document and the public channels. Labels per the owner's landing. */
export const stats = [
  { value: 17200, suffix: "+", label: "متابع على إنستغرام", tone: "brand" },
  { value: 50, suffix: "", label: "عضواً في فريق العمل", tone: "accent" },
  { value: 5, suffix: "", label: "أجنحة عمل متخصّصة", tone: "brand" },
  { value: 7, suffix: "", label: "دوائر استهداف في المجتمع", tone: "accent" },
] as const;

export const about = {
  eyebrow: "من نحن",
  title: "مبادرة تبدأ من الإنسان",
  body: "فسيلة مبادرة شبابية تعمل على بناء الوعي الثقافي والفكري لدى الشباب في لبنان. نؤمن أن التغيير يبدأ صغيراً كفسيلة تُغرس، ثم تنمو حتى تصير ظلاً ومأوى. عملنا موزّع على أجنحة متخصّصة، ويستهدف دوائر متعدّدة من المجتمع.",
} as const;

export const wings = [
  {
    title: "الجناح الثقافي",
    body: "محطات ولقاءات ومواد معرفية تُقدَّم بأسلوب يقرّب الفكرة إلى الشباب.",
  },
  {
    title: "الجناح الإعلامي",
    body: "إنتاج المحتوى المرئي والمكتوب، وإدارة الحضور على المنصّات.",
  },
  {
    title: "الجناح التربوي",
    body: "برامج ومسارات تُنمّي المهارات والقيم عبر مهامٍ عمليّة متدرّجة.",
  },
  {
    title: "الجناح التنظيمي",
    body: "إدارة الفرق والفعاليات، وتنسيق العمل بين الأجنحة.",
  },
  {
    title: "جناح العلاقات",
    body: "بناء الشراكات والتواصل مع المؤسسات والمجتمع المحلي.",
  },
] as const;

/** The product, as the owner's landing frames it: one platform, web and app together. */
export const app = {
  eyebrow: "المنصّة",
  title: "مسارات ومهام ونقاط — في تطبيق واحد",
  body: "اختر مساراً، أنجز مهامه القصيرة في وقتك، واجمع نقاطاً تُراكم تقدّمك داخل الموسم. على الويب وفي تطبيق الهاتف.",
  /** Captions under the three phone mockups. */
  screens: ["الصفحة الرئيسة", "مسار ومهام", "المواسم والصدارة"],
  features: [
    { label: "مسارات ومهام قصيرة", tone: "brand" },
    { label: "نقاط تُمنح بالمراجعة", tone: "accent" },
    { label: "مواسم ولوحة صدارة", tone: "brand" },
    { label: "رتب تُفتح بالتقدّم", tone: "accent" },
  ],
  mockupNote: "لقطات توضيحية من التطبيق",
} as const;

export const tracks = {
  eyebrow: "كيف تعمل",
  title: "مسارات ومهام ونقاط",
  steps: [
    {
      index: "01",
      title: "اختر مسارك",
      body: "كل مسار موضوع متكامل، مقسّم إلى مهام قصيرة يمكن إنجازها في وقتك.",
    },
    {
      index: "02",
      title: "أنجز المهام",
      body: "قراءة، مشاهدة، أو تطبيق عملي. كل مهمة تُقرّبك خطوة في المسار.",
    },
    {
      index: "03",
      title: "اجمع النقاط",
      body: "المهام المنجزة تمنحك نقاطاً تُراكم تقدّمك داخل الموسم.",
    },
    {
      index: "04",
      title: "نافس في الموسم",
      body: "لوحة صدارة لكل موسم، تُظهر ترتيبك بين المشتركين.",
    },
  ],
} as const;

export const stations = {
  eyebrow: "محطــــات",
  title: "لقاءات تُقرّب الفكرة",
  body: "محطات فسيلة سلسلة لقاءات ومواد نُقدّم فيها موضوعاً واحداً بعمق، بلغة الشباب وبعيداً عن التلقين.",
} as const;

export const channels = [
  { label: "إنستغرام", handle: "@faseela_24", href: "https://www.instagram.com/faseela_24" },
  { label: "تلغرام", handle: "t.me/faseela", href: "https://t.me/faseela" },
  { label: "يوتيوب", handle: "@faseela_24", href: "https://www.youtube.com/@faseela_24" },
  { label: "تيك توك", handle: "@faseela_24", href: "https://www.tiktok.com/@faseela_24" },
] as const;

/**
 * The closing invitation. "انضم إلينا" now leads to sign-in: since Slice 1 an account is one
 * e-mail away, so the invitation is to the product, not to a link tree.
 */
export const cta = {
  title: "انطلق مع فسيلـة",
  body: "سجّل الآن وابدأ أول مسار، وتابع محطاتنا وجديدنا على قنواتنا.",
  primary: "انضم إلينا",
  primaryHref: "/dukhul",
  secondary: "اكتشف المنصّة",
  secondaryHref: "#app",
} as const;

export const footer = {
  copyright: "© فسيلـة",
  year: 2026,
  tagline: "مبادرة شبابية لبنانية",
  motto: "نغرس الوعي في جيلٍ يصنع غدَه",
} as const;
