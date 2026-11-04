const { test } = require("node:test");
const assert = require("node:assert/strict");

test("safeCsvCell (actual TS module) neutralizes formula-like text", async () => {
  const { safeCsvCell } = await import("../../src/lib/csv.ts");
  assert.equal(safeCsvCell("=SUM(A1:A2)"), "'=SUM(A1:A2)");
  assert.equal(safeCsvCell("+cmd"), "'+cmd");
  assert.equal(safeCsvCell("-1+1"), "'-1+1");
  assert.equal(safeCsvCell("@SUM(A1)"), "'@SUM(A1)");
  assert.equal(safeCsvCell("\tfoo"), "'\tfoo");
  assert.equal(safeCsvCell("\rfoo"), "'\rfoo");
});

test("safeCsvCell preserves legitimate negative numbers", async () => {
  const { safeCsvCell } = await import("../../src/lib/csv.ts");
  assert.equal(safeCsvCell("-5"), "-5");
  assert.equal(safeCsvCell("-3.14"), "-3.14");
  assert.equal(safeCsvCell("42"), "42");
});

test("safeCsvCell leaves ordinary text unchanged", async () => {
  const { safeCsvCell } = await import("../../src/lib/csv.ts");
  assert.equal(safeCsvCell("Alice"), "Alice");
  assert.equal(safeCsvCell("Room 101"), "Room 101");
});

test("CSV escaping handles quotes, commas, newlines", async () => {
  const { safeCsvCell } = await import("../../src/lib/csv.ts");
  const esc = (c) => '"' + safeCsvCell(c).replace(/"/g, '""') + '"';
  assert.equal(esc('a,b'), '"a,b"');
  assert.equal(esc('say "hi"'), '"say ""hi"""');
  assert.equal(esc("line1\nline2"), '"line1\nline2"');
});
