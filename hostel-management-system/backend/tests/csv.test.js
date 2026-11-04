const { test } = require("node:test");
const assert = require("node:assert/strict");

// Mirrors src/lib/csv.ts safeCsvCell
function safeCsvCell(value) {
  const v = String(value);
  if (/^-?\d+(\.\d+)?$/.test(v.trim())) return v;
  if (/^[=+\-@\t\r]/.test(v)) return "'" + v;
  return v;
}

test("formula-like text cells are neutralized", () => {
  assert.equal(safeCsvCell("=SUM(A1:A2)"), "'=SUM(A1:A2)");
  assert.equal(safeCsvCell("+cmd"), "'+cmd");
  assert.equal(safeCsvCell("-1+1"), "'-1+1");
  assert.equal(safeCsvCell("@SUM(A1)"), "'@SUM(A1)");
  assert.equal(safeCsvCell("\tfoo"), "'\tfoo");
  assert.equal(safeCsvCell("\rfoo"), "'\rfoo");
});

test("legitimate negative numbers remain numeric", () => {
  assert.equal(safeCsvCell("-5"), "-5");
  assert.equal(safeCsvCell("-3.14"), "-3.14");
  assert.equal(safeCsvCell("42"), "42");
  assert.equal(safeCsvCell("3.14"), "3.14");
});

test("ordinary text is unchanged", () => {
  assert.equal(safeCsvCell("Alice"), "Alice");
  assert.equal(safeCsvCell("Room 101"), "Room 101");
});

test("CSV escaping handles quotes, commas, newlines", () => {
  const esc = (c) => '"' + safeCsvCell(c).replace(/"/g, '""') + '"';
  assert.equal(esc('a,b'), '"a,b"');
  assert.equal(esc('say "hi"'), '"say ""hi"""');
  assert.equal(esc("line1\nline2"), '"line1\nline2"');
});
