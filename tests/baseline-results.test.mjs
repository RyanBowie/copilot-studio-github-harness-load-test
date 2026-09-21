import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateReport } from "../src/validate.mjs";
import { summarizeCapacity, summarizeCapacityStudies, observedPacedRpm } from "../src/capacity.mjs";

const report = JSON.parse(await readFile(new URL("../data/report.json", import.meta.url), "utf8"));
const schema = JSON.parse(await readFile(new URL("../schema/report.schema.json", import.meta.url), "utf8"));
const run = report.runs.find((item) => item.runKey === "paced-125-25-baseline");
const paced = run.pacedMeasurement;
const reject = (change, pattern) => {
  const changed = structuredClone(report);
  change(changed.runs.find((item) => item.runKey === run.runKey));
  assert.match(validateReport(changed, schema).join("\n"), pattern);
};

test("actual125 baseline retains first disconnect in the complete denominator and all returned ID evidence", () => {
  assert.deepEqual(validateReport(report, schema), []);
  assert.equal(report.runs.length, 15);
  assert.deepEqual(run.counts, { attempted: 125, completed: 124, failed: 1, pending: 0 });
  assert.equal(run.counts.completed / run.counts.attempted * 100, 99.2);
  assert.deepEqual(run.errors, [{ category: "transport", count: 1, evidence: "native_disconnected_no_conversation" }]);
  assert.deepEqual(run.units, { conversations: 124, sessions: null });
  assert.equal(paced.failedConversations, 0);
  assert.equal(paced.peakOutstanding, 6);
  assert.equal(paced.skippedSlots + paced.unofferedSlots + paced.runnerRetries, 0);
  assert.equal(paced.stopReason, null);
  assert.equal(paced.arrivalStatus, "count_complete");
  assert.equal(paced.drainStatus, "complete");
  assert.equal(run.cost.status, "pending");
  assert.equal(run.cost.amount, null);
});

test("actual arrival extension and partial sixth bucket cannot become a nominal25RPM or clean capacity screen", () => {
  assert.equal(paced.phase, "count_baseline");
  assert.equal(paced.plannedSlots, 125);
  assert.equal(paced.plannedArrivalSeconds, 300);
  assert.equal(paced.targetRpm, 25);
  assert.equal(paced.arrivalSeconds, 303.08066709999997);
  assert.equal(paced.arrivalEndObservedSeconds, paced.arrivalSeconds);
  assert.equal(paced.drainSeconds, 6.062341400000034);
  assert.equal(run.windowSeconds, 309.1430085);
  assert.equal(observedPacedRpm(run), 24.74588719816105);
  assert.deepEqual(paced.pacing, {
    schedule: "dispatch_rebased", missedSlotPolicy: "defer_without_catchup", intervalMs: 2400,
    jitterAllowance: 0, observedMinIntervalMs: 2401.703999999998, violatingIntervals: 0
  });
  assert.deepEqual(paced.minutes.map((minute) => [minute.attempted, minute.completed, minute.failed, minute.pending]), [
    [25, 24, 1, 0], [25, 25, 0, 0], [25, 25, 0, 0], [24, 24, 0, 0], [25, 25, 0, 0], [1, 1, 0, 0]
  ]);
  assert.equal(paced.minutes.at(-1).durationSeconds, 3.0806670999999626);
  assert.equal(paced.qualification, "not_evaluated");
  assert.equal(paced.qualifyingRunKey, null);
  assert.deepEqual(summarizeCapacityStudies([run]), []);
  const [capacity] = summarizeCapacity([run]);
  assert.equal(capacity.highestQualifiedRpm, null);
  assert.equal(capacity.windows.find((window) => window.seconds === 300).best.counts.attempted, 124);
  assert.equal(capacity.windows.find((window) => window.seconds === 300).best.counts.completed, 123);
  assert.equal(capacity.windows.find((window) => window.seconds === 300).clean, null);
  assert.equal(capacity.windows.find((window) => window.seconds === 3600).best, null);
});

test("native timing, arrival boundary populations and clock attestation remain distinct and exact", () => {
  assert.deepEqual(paced.success, { sampleCount: 124, minMs: 6147.975299999991, p50Ms: 8140.554899999988, p95Ms: 10426.634000000005, maxMs: 17592.165000000008 });
  assert.deepEqual(paced.failure, { sampleCount: 1, minMs: 242.18249999999534, p50Ms: 242.18249999999534, p95Ms: 242.18249999999534, maxMs: 242.18249999999534 });
  assert.deepEqual(paced.allOutcomes, { ...paced.success, sampleCount: 125, minMs: paced.failure.minMs });
  assert.deepEqual(paced.baselineEvidence, {
    clockStatus: "verified_clean", evidenceStatus: "verified_complete",
    successfulWithinArrivalWindow: 122, successfulAfterArrivalWindow: 2,
    firstFailedAttempt: 1, firstFailureCallbackFromArrivalStartMs: 291.7347000000009
  });
  assert.equal(paced.startedAt, "2026-09-21T21:53:49.850Z");
  assert.equal(paced.arrivalEndedAt, "2026-09-21T21:58:52.924Z");
  assert.equal(paced.observedThroughAt, "2026-09-21T21:58:58.985Z");
  assert.equal(paced.percentileMethod, "nearest_rank");
  assert.equal(run.latency, null);
  assert.equal(run.firstVisibleLatency, null);
});

test("baseline evidence rejects fabricated completion boundaries, first failures, IDs and borrowed qualification", () => {
  reject((item) => { item.pacedMeasurement.baselineEvidence.successfulWithinArrivalWindow = 124; }, /partition eventual successes/);
  reject((item) => { item.pacedMeasurement.baselineEvidence.successfulAfterArrivalWindow = null; }, /must be paired/);
  reject((item) => { item.pacedMeasurement.baselineEvidence.firstFailedAttempt = 126; }, /firstFailedAttempt: does not match an allowed shape/);
  reject((item) => { item.pacedMeasurement.baselineEvidence.firstFailedAttempt = 2; }, /within observed timing/);
  reject((item) => { item.pacedMeasurement.baselineEvidence.firstFailureCallbackFromArrivalStartMs = null; }, /paired actual-attempt/);
  reject((item) => { item.pacedMeasurement.baselineEvidence.firstFailureCallbackFromArrivalStartMs = 1; }, /within observed timing/);
  reject((item) => { item.pacedMeasurement.baselineEvidence.firstFailureCallbackFromArrivalStartMs = 400000; }, /within observed timing/);
  reject((item) => { delete item.pacedMeasurement.baselineEvidence; }, /explicit reviewed measurement evidence/);
  reject((item) => { item.units.conversations = 125; }, /no returned conversation identifier/);
  reject((item) => { item.pacedMeasurement.qualification = "qualified"; }, /not a two-minute calibration/);
  reject((item) => { item.pacedMeasurement.phase = "capacity_screen"; }, /count completion requires|baseline evidence cannot relabel/);
  reject((item) => { item.pacedMeasurement.baselineEvidence.rawDiagnostic = "forbidden"; }, /unknown field/);
});
