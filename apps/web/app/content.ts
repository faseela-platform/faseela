/**
 * Landing page content, in Arabic, extracted from Faseela's own profile document and the app
 * specification. Kept separate from the components so copy edits never touch layout, and so this
 * file becomes the migration source when Payload takes over.
 *
 * Vocabulary follows CONTEXT.md: مسار (Track), مهمة (Task), نقطة (Point), موسم (Season),
 * محطة (Station).
 */

export const hero = {
  /** Wordmark. The tatweel in فسيلـة is authored, load-bearing, and must never be normalised away. */
  wordmark: 'فسيلـة',
  /** Split at word boundaries for the stagger — never at letters, which would sever cursive joins. */
  taglineWords: ['نغرس', 'الوعي', 'في', 'جيلٍ', 'يصنع', 'غدَه'],
  lede: 'مبادرة شبابية لبنانية تبني الإنسان عبر المعرفة والعمل، وتفتح للشباب مساراتٍ يسيرون فيها خطوةً خطوة.',
  cta: 'ابدأ مسارك',
  ctaSecondary: 'تعرّف علينا',
} as const;

export const hadith = {
  text: 'إذا قامت الساعة وفي يد أحدكم فسيلة فليغرسها',
  attribution: 'حديث شريف',
} as const;

/** Numbers are real, from the profile document and the public channels. */
export const stats = [
  { value: '17200', suffix: '+', label: 'متابع على إنستغرام' },
  { value: '50', suffix: '', label: 'عضواً في فريق العمل' },
  { value: '5', suffix: '', label: 'أجنحة عمل' },
  { value: '7', suffix: '', label: 'دوائر استهداف' },
] as const;

export const about = {
  eyebrow: 'من نحن',
  title: 'مبادرة تبدأ من الإنسان',
  body: 'فسيلة مبادرة شبابية تعمل على بناء الوعي الثقافي والفكري لدى الشباب في لبنان. نؤمن أن التغيير يبدأ صغيراً كفسيلة تُغرس، ثم تنمو حتى تصير ظلاً ومأوى. عملنا موزّع على أجنحة متخصّصة، ويستهدف دوائر متعدّدة من المجتمع.',
} as const;

export const wings = [
  {
    title: 'الجناح الثقافي',
    body: 'محطات ولقاءات ومواد معرفية تُقدَّم بأسلوب يقرّب الفكرة إلى الشباب.',
  },
  {
    title: 'الجناح الإعلامي',
    body: 'إنتاج المحتوى المرئي والمكتوب، وإدارة الحضور على المنصّات.',
  },
  {
    title: 'الجناح التربوي',
    body: 'برامج ومسارات تُنمّي المهارات والقيم عبر مهامٍ عمليّة متدرّجة.',
  },
  {
    title: 'الجناح التنظيمي',
    body: 'إدارة الفرق والفعاليات، وتنسيق العمل بين الأجنحة.',
  },
  {
    title: 'جناح العلاقات',
    body: 'بناء الشراكات والتواصل مع المؤسسات والمجتمع المحلي.',
  },
] as const;

export const tracks = {
  eyebrow: 'كيف تعمل',
  title: 'مسارات ومهام ونقاط',
  steps: [
    {
      index: '01',
      title: 'اختر مسارك',
      body: 'كل مسار موضوع متكامل، مقسّم إلى مهام قصيرة يمكن إنجازها في وقتك.',
    },
    {
      index: '02',
      title: 'أنجز المهام',
      body: 'قراءة، مشاهدة، أو تطبيق عملي. كل مهمة تُقرّبك خطوة في المسار.',
    },
    {
      index: '03',
      title: 'اجمع النقاط',
      body: 'المهام المنجزة تمنحك نقاطاً تُراكم تقدّمك داخل الموسم.',
    },
    {
      index: '04',
      title: 'نافس في الموسم',
      body: 'لوحة صدارة لكل موسم، تُظهر ترتيبك بين المشتركين.',
    },
  ],
} as const;

export const stations = {
  eyebrow: 'محطــــات',
  title: 'لقاءات تُقرّب الفكرة',
  body: 'محطات فسيلة سلسلة لقاءات ومواد نُقدّم فيها موضوعاً واحداً بعمق، بلغة الشباب وبعيداً عن التلقين.',
} as const;

export const channels = [
  { label: 'إنستغرام', handle: '@faseela_24', href: 'https://www.instagram.com/faseela_24' },
  { label: 'تلغرام', handle: 't.me/faseela', href: 'https://t.me/faseela' },
  { label: 'يوتيوب', handle: '@faseela_24', href: 'https://www.youtube.com/@faseela_24' },
  { label: 'تيك توك', handle: '@faseela_24', href: 'https://www.tiktok.com/@faseela_24' },
] as const;

export const cta = {
  title: 'انطلق مع فسيلة',
  body: 'سجّل الآن وابدأ أول مسار. التطبيق قيد الإعداد، ويمكنك الانضمام إلى قنواتنا حتى إطلاقه.',
  primary: 'انضم إلينا',
} as const;
