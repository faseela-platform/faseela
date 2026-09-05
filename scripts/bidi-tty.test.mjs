import { test } from "node:test";
import assert from "node:assert/strict";
import { shapeLine } from "./bidi-tty.mjs";

const cps = (s) => Array.from(s).map((c) => c.codePointAt(0).toString(16).padStart(4, "0"));

test("shapes and reverses a plain Arabic word", () => {
  // مرحبا -> initial meem, final reh, initial hah, medial beh, final alef,
  // emitted right-to-left so the first letter lands rightmost.
  assert.deepEqual(cps(shapeLine("مرحبا")), ["fe8e", "fe92", "fea3", "feae", "fee3"]);
});

test("collapses lam-alef into one glyph", () => {
  // لا is a single ligature, not two letters
  assert.deepEqual(cps(shapeLine("لا")), ["fefb"]);
});

test("keeps digits upright inside right-to-left text", () => {
  const out = shapeLine("ينتهي هذا الرابط بعد 10 دقائق");
  assert.ok(out.includes("10"), 'digits must not be reversed into "01"');
  assert.ok(!out.includes("01"));
});

test("keeps a Latin island upright inside an Arabic sentence", () => {
  const out = shapeLine("error: البريد غير صالح (code 422)");
  assert.ok(out.includes("code 422"), "Latin run must stay in reading order");
  assert.ok(out.startsWith("error:"), "left-to-right paragraph keeps its opening run in place");
});

test("mirrors brackets that sit inside a right-to-left run", () => {
  const out = shapeLine("(فسيلة)");
  // the run flips, so the glyph drawn first must be the one that reads as "("
  assert.equal(out[0], "(");
  assert.equal(out[out.length - 1], ")");
});

test("leaves pure Latin lines untouched", () => {
  const line = "ready on http://localhost:3000 in 412ms";
  assert.equal(shapeLine(line), line);
});

test("preserves ANSI colour codes", () => {
  const out = shapeLine("\x1b[31mخطأ\x1b[0m");
  assert.ok(out.startsWith("\x1b[31m"));
  assert.ok(out.endsWith("\x1b[0m"));
});

test("keeps combining marks attached to their base letter", () => {
  const out = Array.from(shapeLine("أهلًا"));
  const fatha = out.findIndex((c) => c.codePointAt(0) === 0x064b);
  assert.ok(fatha > 0, "the mark must follow a base letter, never lead the string");
});

test("mode=off is a no-op", () => {
  const line = "أهلًا بك";
  assert.equal(shapeLine(line, { mode: "off" }), line);
});

test("mode=reverse reorders without substituting presentation forms", () => {
  const out = shapeLine("مرحبا", { mode: "reverse" });
  assert.deepEqual(cps(out), ["0627", "0628", "062d", "0631", "0645"]);
});
