#!/usr/bin/env node
/**
 * bidi-tty — make Arabic readable in terminals that have no bidi support.
 *
 * JetBrains' terminal (the classic JediTerm engine and the 2026.x reworked one
 * alike) paints cells strictly left-to-right and never runs the Unicode
 * Bidirectional Algorithm. Arabic therefore arrives byte-correct but reads
 * backwards: the first letter of a word lands on the left, and words inside a
 * sentence come out in reverse order.
 *
 * This filter does the work the terminal skips, before the bytes ever reach it:
 *
 *   1. classify each character as right-to-left, left-to-right, or neutral
 *   2. resolve the neutrals from their surroundings (UBA levels 0-2, which is
 *      everything log lines and UI strings actually use)
 *   3. reverse the right-to-left runs, keeping digits and Latin islands upright
 *   4. swap each Arabic letter for the presentation form that already carries
 *      its contextual shape, so a terminal that cannot shape still joins them
 *
 * Usage:
 *   pnpm dev 2>&1 | node scripts/bidi-tty.mjs
 *   node scripts/bidi-tty.mjs --test-card     # print the same lines 3 ways
 *   node scripts/bidi-tty.mjs --mode=reverse  # reorder but do not reshape
 *
 * Exported for reuse: shapeLine(text, opts)
 */

// ---------------------------------------------------------------------------
// Arabic presentation forms: [isolated, final, initial, medial].
// null means the letter has no such shape. Letters with no initial/medial form
// are "right-joining": they connect to the letter before them but never to the
// one after, which is what ends a joining group mid-word.
// ---------------------------------------------------------------------------
const FORMS = new Map([
  [0x0621, [0xfe80, null, null, null]], // hamza
  [0x0622, [0xfe81, 0xfe82, null, null]], // alef madda
  [0x0623, [0xfe83, 0xfe84, null, null]], // alef hamza above
  [0x0624, [0xfe85, 0xfe86, null, null]], // waw hamza
  [0x0625, [0xfe87, 0xfe88, null, null]], // alef hamza below
  [0x0626, [0xfe89, 0xfe8a, 0xfe8b, 0xfe8c]], // yeh hamza
  [0x0627, [0xfe8d, 0xfe8e, null, null]], // alef
  [0x0628, [0xfe8f, 0xfe90, 0xfe91, 0xfe92]], // beh
  [0x0629, [0xfe93, 0xfe94, null, null]], // teh marbuta
  [0x062a, [0xfe95, 0xfe96, 0xfe97, 0xfe98]], // teh
  [0x062b, [0xfe99, 0xfe9a, 0xfe9b, 0xfe9c]], // theh
  [0x062c, [0xfe9d, 0xfe9e, 0xfe9f, 0xfea0]], // jeem
  [0x062d, [0xfea1, 0xfea2, 0xfea3, 0xfea4]], // hah
  [0x062e, [0xfea5, 0xfea6, 0xfea7, 0xfea8]], // khah
  [0x062f, [0xfea9, 0xfeaa, null, null]], // dal
  [0x0630, [0xfeab, 0xfeac, null, null]], // thal
  [0x0631, [0xfead, 0xfeae, null, null]], // reh
  [0x0632, [0xfeaf, 0xfeb0, null, null]], // zain
  [0x0633, [0xfeb1, 0xfeb2, 0xfeb3, 0xfeb4]], // seen
  [0x0634, [0xfeb5, 0xfeb6, 0xfeb7, 0xfeb8]], // sheen
  [0x0635, [0xfeb9, 0xfeba, 0xfebb, 0xfebc]], // sad
  [0x0636, [0xfebd, 0xfebe, 0xfebf, 0xfec0]], // dad
  [0x0637, [0xfec1, 0xfec2, 0xfec3, 0xfec4]], // tah
  [0x0638, [0xfec5, 0xfec6, 0xfec7, 0xfec8]], // zah
  [0x0639, [0xfec9, 0xfeca, 0xfecb, 0xfecc]], // ain
  [0x063a, [0xfecd, 0xfece, 0xfecf, 0xfed0]], // ghain
  [0x0641, [0xfed1, 0xfed2, 0xfed3, 0xfed4]], // feh
  [0x0642, [0xfed5, 0xfed6, 0xfed7, 0xfed8]], // qaf
  [0x0643, [0xfed9, 0xfeda, 0xfedb, 0xfedc]], // kaf
  [0x0644, [0xfedd, 0xfede, 0xfedf, 0xfee0]], // lam
  [0x0645, [0xfee1, 0xfee2, 0xfee3, 0xfee4]], // meem
  [0x0646, [0xfee5, 0xfee6, 0xfee7, 0xfee8]], // noon
  [0x0647, [0xfee9, 0xfeea, 0xfeeb, 0xfeec]], // heh
  [0x0648, [0xfeed, 0xfeee, null, null]], // waw
  [0x0649, [0xfeef, 0xfef0, null, null]], // alef maksura
  [0x064a, [0xfef1, 0xfef2, 0xfef3, 0xfef4]], // yeh
]);

// lam + alef collapse into a single glyph; [isolated, final]
const LAM_ALEF = new Map([
  [0x0622, [0xfef5, 0xfef6]],
  [0x0623, [0xfef7, 0xfef8]],
  [0x0625, [0xfef9, 0xfefa]],
  [0x0627, [0xfefb, 0xfefc]],
]);

const TATWEEL = 0x0640;

/** Marks that hang off a base letter and are invisible to the joining rules. */
function isTransparent(cp) {
  return (
    (cp >= 0x0610 && cp <= 0x061a) ||
    (cp >= 0x064b && cp <= 0x065f) ||
    cp === 0x0670 ||
    (cp >= 0x06d6 && cp <= 0x06dc) ||
    (cp >= 0x06df && cp <= 0x06e4) ||
    (cp >= 0x06e7 && cp <= 0x06e8) ||
    (cp >= 0x06ea && cp <= 0x06ed) ||
    cp === 0x200c || // ZWNJ
    cp === 0x200d // ZWJ
  );
}

/** Can this letter connect to the letter that follows it? */
function joinsForward(cp) {
  if (cp === TATWEEL) return true;
  const f = FORMS.get(cp);
  return f ? f[2] !== null : false;
}

/** Can this letter connect to the letter that precedes it? */
function joinsBackward(cp) {
  if (cp === TATWEEL) return true;
  const f = FORMS.get(cp);
  return f ? f[1] !== null : false;
}

// ---------------------------------------------------------------------------
// Shaping
// ---------------------------------------------------------------------------

/**
 * Replace Arabic letters with their contextual presentation forms.
 * Operates in logical order; reordering happens separately.
 */
function shapeArabic(chars) {
  const out = [];
  for (let i = 0; i < chars.length; i++) {
    const cp = chars[i].codePointAt(0);

    if (isTransparent(cp) || !FORMS.has(cp)) {
      out.push(chars[i]);
      continue;
    }

    // nearest non-transparent neighbours decide the shape
    let p = i - 1;
    while (p >= 0 && isTransparent(chars[p].codePointAt(0))) p--;
    let n = i + 1;
    while (n < chars.length && isTransparent(chars[n].codePointAt(0))) n++;

    const prev = p >= 0 ? chars[p].codePointAt(0) : -1;
    const next = n < chars.length ? chars[n].codePointAt(0) : -1;

    const linkedBefore = prev !== -1 && joinsForward(prev);
    const linkedAfter = next !== -1 && joinsForward(cp) && joinsBackward(next);

    // lam + alef is one glyph, never two
    if (cp === 0x0644 && next !== -1 && LAM_ALEF.has(next)) {
      const [iso, fin] = LAM_ALEF.get(next);
      out.push(String.fromCodePoint(linkedBefore ? fin : iso));
      // carry any marks that sat between the lam and the alef
      for (let k = i + 1; k < n; k++) out.push(chars[k]);
      i = n;
      continue;
    }

    const forms = FORMS.get(cp);
    let form;
    if (linkedBefore && linkedAfter) form = forms[3] ?? forms[1] ?? forms[0];
    else if (linkedBefore) form = forms[1] ?? forms[0];
    else if (linkedAfter) form = forms[2] ?? forms[0];
    else form = forms[0];

    out.push(String.fromCodePoint(form));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Direction resolution (Unicode Bidirectional Algorithm, levels 0-2)
// ---------------------------------------------------------------------------

const MIRROR = new Map(
  Object.entries({
    "(": ")",
    ")": "(",
    "[": "]",
    "]": "[",
    "{": "}",
    "}": "{",
    "<": ">",
    ">": "<",
    "«": "»",
    "»": "«",
    "‹": "›",
    "›": "‹",
  }),
);

function isRtl(cp) {
  return (
    (cp >= 0x0590 && cp <= 0x05ff) || // Hebrew
    (cp >= 0x0600 && cp <= 0x06ff) || // Arabic
    (cp >= 0x0750 && cp <= 0x077f) || // Arabic Supplement
    (cp >= 0x08a0 && cp <= 0x08ff) || // Arabic Extended-A
    (cp >= 0xfb50 && cp <= 0xfdff) || // Presentation Forms-A
    (cp >= 0xfe70 && cp <= 0xfeff) // Presentation Forms-B
  );
}

function isLtr(cp) {
  // the right-to-left blocks are checked first: shaped Arabic lands in
  // U+FE70..U+FEFF, which the trailing catch-all would otherwise claim
  if (isRtl(cp)) return false;
  return (
    (cp >= 0x0041 && cp <= 0x005a) ||
    (cp >= 0x0061 && cp <= 0x007a) ||
    (cp >= 0x00c0 && cp <= 0x024f) ||
    (cp >= 0x0370 && cp <= 0x058f) ||
    cp >= 0x2c00
  );
}

function isDigit(cp) {
  return (
    (cp >= 0x0030 && cp <= 0x0039) || // ASCII
    (cp >= 0x0660 && cp <= 0x0669) || // Arabic-Indic
    (cp >= 0x06f0 && cp <= 0x06f9) // Extended Arabic-Indic
  );
}

/** R | L | D (digit) | N (neutral) per character. */
function classify(chars) {
  return chars.map((ch) => {
    const cp = ch.codePointAt(0);
    if (isDigit(cp)) return "D";
    if (isRtl(cp)) return "R";
    if (isLtr(cp)) return "L";
    return "N";
  });
}

/**
 * Give every neutral a direction: one sitting between two runs of the same
 * direction joins them, anything else falls back to the paragraph direction.
 * Digits lean on whichever strong direction precedes them.
 */
function resolveNeutrals(types, base) {
  const out = types.slice();

  for (let i = 0; i < out.length; i++) {
    if (out[i] !== "D") continue;
    let p = i - 1;
    while (p >= 0 && (out[p] === "N" || out[p] === "D")) p--;
    out[i] = p >= 0 && out[p] === "R" ? "R" : "L";
  }

  for (let i = 0; i < out.length; i++) {
    if (out[i] !== "N") continue;
    let j = i;
    while (j < out.length && out[j] === "N") j++;
    const before = i > 0 ? out[i - 1] : base;
    const after = j < out.length ? out[j] : base;
    const fill = before === after ? before : base;
    for (let k = i; k < j; k++) out[k] = fill;
    i = j - 1;
  }
  return out;
}

function paragraphDirection(types) {
  for (const t of types) {
    if (t === "R") return "R";
    if (t === "L") return "L";
  }
  return "L";
}

/**
 * Group a right-to-left stretch into units that must survive reversal intact:
 * a base letter carries its combining marks, and a run of digits or Latin
 * stays upright as one block.
 */
function unitsFor(chars, from, to) {
  const units = [];
  let i = from;
  while (i < to) {
    const cp = chars[i].codePointAt(0);

    if (isDigit(cp) || isLtr(cp)) {
      let j = i;
      let buf = "";
      while (j < to) {
        const c = chars[j].codePointAt(0);
        const isInnerSep = c === 0x002e || c === 0x002c || c === 0x003a;
        if (!isDigit(c) && !isLtr(c) && !isInnerSep) break;
        buf += chars[j];
        j++;
      }
      // a trailing separator belongs to the Arabic text, not to the number
      const trailing = buf.match(/[.,:]+$/);
      if (trailing) {
        buf = buf.slice(0, -trailing[0].length);
        j -= trailing[0].length;
      }
      if (buf) {
        units.push(buf);
        i = j;
        continue;
      }
    }

    let unit = chars[i];
    let j = i + 1;
    while (j < to && isTransparent(chars[j].codePointAt(0))) {
      unit += chars[j];
      j++;
    }
    units.push(unit);
    i = j;
  }
  return units;
}

function mirrorUnit(u) {
  if (u.length !== 1) return u;
  return MIRROR.get(u) ?? u;
}

/** Reorder one already-shaped line into visual order. */
function reorder(chars) {
  const types = classify(chars);
  const base = paragraphDirection(types);
  const resolved = resolveNeutrals(types, base);

  // slice the line into maximal same-direction runs
  const runs = [];
  let start = 0;
  for (let i = 1; i <= resolved.length; i++) {
    if (i === resolved.length || resolved[i] !== resolved[start]) {
      runs.push({ dir: resolved[start], from: start, to: i });
      start = i;
    }
  }

  const rendered = runs.map((run) => {
    if (run.dir !== "R") return chars.slice(run.from, run.to).join("");
    const units = unitsFor(chars, run.from, run.to);
    return units.reverse().map(mirrorUnit).join("");
  });

  // with a right-to-left paragraph the runs themselves also flip
  return (base === "R" ? rendered.reverse() : rendered).join("");
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

const ANSI = /(\x1b\[[0-9;?]*[a-zA-Z]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\))/g;
const HAS_RTL = /[֐-׿؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

/**
 * @param {string} text
 * @param {{mode?: 'shape'|'reverse'|'off'}} [opts]
 */
export function shapeLine(text, opts = {}) {
  const mode = opts.mode ?? "shape";
  if (mode === "off" || !HAS_RTL.test(text)) return text;

  // colour codes keep their place; only the text between them is reordered
  return text
    .split(ANSI)
    .map((part, i) => {
      if (i % 2 === 1 || !HAS_RTL.test(part)) return part;
      let chars = Array.from(part);
      if (mode === "shape") chars = shapeArabic(chars);
      return reorder(chars);
    })
    .join("");
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const SAMPLES = [
  "أهلًا بك في فسيلة،",
  "  الموضوع: رابط الدخول إلى فسيلة",
  "ينتهي هذا الرابط بعد 10 دقائق",
  "error: البريد غير صالح (code 422)",
];

function testCard() {
  const modes = [
    ["raw           ", "off"],
    ["reorder       ", "reverse"],
    ["reorder+shape ", "shape"],
  ];
  console.log("\nWhichever block reads correctly is the mode to use.\n");
  for (const [label, mode] of modes) {
    console.log(`--- ${label.trim()} (--mode=${mode}) ---`);
    for (const s of SAMPLES) console.log(shapeLine(s, { mode }));
    console.log("");
  }
}

function isMain() {
  const entry = process.argv[1];
  if (!entry) return false;
  return entry.replace(/\\/g, "/").endsWith("bidi-tty.mjs");
}

if (isMain()) {
  const args = process.argv.slice(2);
  const modeArg = args.find((a) => a.startsWith("--mode="));
  const mode = modeArg ? modeArg.slice("--mode=".length) : "shape";

  if (args.includes("--test-card")) {
    testCard();
  } else {
    let carry = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      const lines = (carry + chunk).split("\n");
      carry = lines.pop() ?? "";
      for (const line of lines) process.stdout.write(shapeLine(line, { mode }) + "\n");
    });
    process.stdin.on("end", () => {
      if (carry) process.stdout.write(shapeLine(carry, { mode }));
    });
  }
}
