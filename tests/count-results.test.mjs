import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateReport } from "../src/validate.mjs";
import { summarizeCapacity } from "../src/capacity.mjs";

const report = JSON.parse(await readFile(new URL("../data/report.json", import.meta.url), "utf8"));
const schema = JSON.parse(await readFile(new URL("../schema/report.schema.json", import.meta.url), "utf8"));
const run = report.runs.find((item) => item.runKey === "paced-elastic-100-completed");
const paced = run.pacedMeasurement;

test("reviewed full100 denominator retains the disconnected result without inventing remote admission", () => {
  assert.deepEqual(validateReport(report, schema), []);
  assert.equal(report.runs.length, 12);
  assert.deepEqual(run.counts, { attempted: 100, completed: 60, failed: 40, pending: 0 });
  assert.deepEqual(run.errors, [
    { category: "unknown", count: 39, evidence: "unclassified_invocation_failure" },
    { category: "transport", count: 1, evidence: "native_disconnected_no_conversation" }
  ]);
  assert.deepEqual(run.units, { conversations: 99, sessions: null });
  assert.equal(paced.failedConversations, 39);
  assert.equal(paced.peakOutstanding, 15);
  assert.equal(paced.runnerRetries, 0);
  assert.equal(paced.skippedSlots + paced.unofferedSlots, 0);
  assert.equal(paced.stopReason, null);
  assert.equal(paced.drainStatus, "complete");
  assert.equal(paced.arrivalStatus, "count_complete");
  assert.equal(paced.phase, "count_retest");
  assert.equal(run.cost.status, "pending");
  assert.equal(run.cost.amount, null);
});

test("measured count-bound arrivals extend beyond60 seconds and never fabricate100 first-minute dispatches", () => {
  assert.equal(paced.startedAt, "2026-09-21T11:52:03.880Z");
  assert.equal(paced.arrivalEndedAt, "2026-09-21T11:53:07.397Z");
  assert.equal(paced.observedThroughAt, "2026-09-21T11:53:16.669Z");
  assert.equal(paced.arrivalSeconds, 63.522163799999994);
  assert.equal(paced.arrivalEndObservedSeconds, paced.arrivalSeconds);
  assert.equal(paced.drainSeconds, 9.271375899999999);
  assert.equal(run.windowSeconds, 72.7935397);
  assert.ok(Math.abs(100 * 60 / paced.arrivalSeconds - 94.45522068314682) < 1e-12);
  assert.deepEqual(paced.pacing, {
    schedule: "dispatch_rebased", missedSlotPolicy: "defer_without_catchup",
    intervalMs: 600, jitterAllowance: 0, observedMinIntervalMs: 602.1187000000064, violatingIntervals: 0
  });
  assert.deepEqual(paced.minutes, [
    { offsetSeconds: 0, durationSeconds: 60, attempted: 95, completed: 55, failed: 40, pending: 0 },
    { offsetSeconds: 60, durationSeconds: 3.5221637999999946, attempted: 5, completed: 5, failed: 0, pending: 0 }
  ]);
  const [capacity] = summarizeCapacity([run]);
  assert.equal(capacity.highestQualifiedRpm, null);
  assert.equal(capacity.windows.find((window) => window.seconds === 60).best.counts.attempted, 95);
  assert.equal(capacity.windows.find((window) => window.seconds === 60).best.counts.completed, 55);
  assert.equal(capacity.windows.find((window) => window.seconds === 120).best, null);
  assert.equal(capacity.longestClean, null);
});

test("all three actual native timing populations keep exact reviewed precision", () => {
  assert.deepEqual(paced.success, { sampleCount: 60, minMs: 6535.020499999999, p50Ms: 8331.270499999999, p95Ms: 9831.7468, maxMs: 10603.77870000001 });
  assert.deepEqual(paced.failure, { sampleCount: 40, minMs: 45.20799999999872, p50Ms: 3266.1454999999987, p95Ms: 4172.814900000005, maxMs: 5584.3840000000055 });
  assert.deepEqual(paced.allOutcomes, { sampleCount: 100, minMs: 45.20799999999872, p50Ms: 7461.159, p95Ms: 9752.985700000005, maxMs: 10603.77870000001 });
  assert.doesNotMatch(JSON.stringify(run), /sourceFingerprint|sha256|conversationId|sharepoint|onmicrosoft|[a-z]:\\\\|https?:|@/i);
});
