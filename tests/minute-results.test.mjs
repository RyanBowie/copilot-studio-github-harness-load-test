import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateReport } from "../src/validate.mjs";
import { summarizeCapacity } from "../src/capacity.mjs";

const report = JSON.parse(await readFile(new URL("../data/report.json", import.meta.url), "utf8"));
const schema = JSON.parse(await readFile(new URL("../schema/report.schema.json", import.meta.url), "utf8"));
const run = report.runs.find((item) => item.runKey === "paced-minute-100-local-stop");
const paced = run.pacedMeasurement;

test("reviewed minute retest has 41 actual attempts, not 100 or 59 additional failures", () => {
  assert.deepEqual(validateReport(report, schema), []);
  assert.equal(report.runs[10].runKey, "paced-minute-100-local-stop");
  assert.equal(report.publication.reviewedOn, "2026-09-21");
  assert.deepEqual(run.counts, { attempted: 41, completed: 26, failed: 15, pending: 0 });
  assert.equal(paced.plannedSlots, 100);
  assert.equal(paced.skippedSlots, 1);
  assert.equal(paced.unofferedSlots, 58);
  assert.equal(paced.genericErrorPolicy, "count_without_early_stop");
  assert.equal(paced.phase, "minute_retest");
  assert.equal(paced.stopReason, "client_pacing");
  assert.equal(paced.arrivalStatus, "stopped");
  assert.equal(paced.drainStatus, "complete");
  assert.equal(paced.qualification, "not_evaluated");
  assert.equal(paced.runnerRetries, 0);
  assert.deepEqual(run.errors, [{ category: "unknown", count: 15, evidence: "unclassified_invocation_failure" }]);
  assert.equal(run.cost.status, "pending");
  assert.equal(run.cost.amount, null);
  assert.deepEqual(run.units, { conversations: 41, sessions: null });
  assert.equal(paced.failedConversations, 15);
  assert.equal(paced.peakOutstanding, 17);
});

test("local arrival close and drain use their reviewed clock rather than the later loop end", () => {
  assert.equal(paced.startedAt, "2026-09-21T11:05:54.897Z");
  assert.equal(paced.arrivalEndedAt, "2026-09-21T11:06:20.182Z");
  assert.equal(paced.observedThroughAt, "2026-09-21T11:06:28.382Z");
  assert.equal(paced.arrivalSeconds, 25.284633200000002);
  assert.equal(paced.arrivalEndObservedSeconds, 25.284633200000002);
  assert.equal(paced.drainSeconds, 8.200922099999996);
  assert.equal(run.windowSeconds, 33.485555299999994);
  assert.deepEqual(paced.minutes, [{ offsetSeconds: 0, durationSeconds: 25.284633200000002, ...run.counts }]);
  assert.equal(paced.pacing.intervalMs, 600);
  assert.equal(paced.pacing.observedMinIntervalMs, 576.8838000000032);
  assert.equal(paced.pacing.violatingIntervals, 0);
  const [capacity] = summarizeCapacity([run]);
  assert.equal(capacity.highestQualifiedRpm, null);
  assert.equal(capacity.longestCompleted, null);
  assert.ok(capacity.windows.every((window) => window.best === null));
});

test("all three native duration populations retain reviewed precision", () => {
  assert.deepEqual(paced.success, { sampleCount: 26, minMs: 7010.9504000000015, p50Ms: 8670.152599999994, p95Ms: 10622.766899999995, maxMs: 10892.970000000001 });
  assert.deepEqual(paced.failure, { sampleCount: 15, minMs: 2737.5406000000003, p50Ms: 3501.179299999996, p95Ms: 4242.042300000001, maxMs: 4242.042300000001 });
  assert.deepEqual(paced.allOutcomes, { sampleCount: 41, minMs: 2737.5406000000003, p50Ms: 8226.066899999998, p95Ms: 10404.998699999996, maxMs: 10892.970000000001 });
  const text = JSON.stringify(run);
  assert.doesNotMatch(text, /sourceFingerprint|sha256|conversationId|sharepoint|onmicrosoft|[a-z]:\\\\|https?:|@/i);
});
