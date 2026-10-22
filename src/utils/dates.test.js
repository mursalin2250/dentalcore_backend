import assert from "node:assert/strict";
import { test } from "node:test";
import { BUCKET_UNITS } from "../constants/dashboard.js";
import { addMonths, bucketKey, startOfDay, startOfMonth } from "./dates.js";
import { percentChange } from "./percentChange.js";

test("startOfDay returns Dhaka midnight", () => {
  // 2026-10-20 20:00 UTC is already 21 Oct in Dhaka.
  assert.equal(startOfDay(new Date("2026-10-20T20:00:00Z")).toISOString(), "2026-10-20T18:00:00.000Z");
  assert.equal(startOfDay(new Date("2026-10-20T10:00:00Z")).toISOString(), "2026-10-19T18:00:00.000Z");
});

test("month helpers cross year boundaries", () => {
  const month = startOfMonth(new Date("2026-01-15T10:00:00Z"));
  assert.equal(month.toISOString(), "2025-12-31T18:00:00.000Z");
  assert.equal(bucketKey(addMonths(month, -1), BUCKET_UNITS.MONTH), "2025-12");
  assert.equal(bucketKey(addMonths(month, 12), BUCKET_UNITS.MONTH), "2027-01");
});

test("bucketKey uses clinic time", () => {
  const date = new Date("2026-10-20T20:00:00Z");
  assert.equal(bucketKey(date, BUCKET_UNITS.DAY), "2026-10-21");
});

test("percentChange", () => {
  assert.equal(percentChange(120, 100), 20);
  assert.equal(percentChange(80, 100), -20);
  assert.equal(percentChange(5, 0), null);
  assert.equal(percentChange(1, 3), -66.7);
});
