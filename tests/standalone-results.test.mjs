import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateReport } from "../src/validate.mjs";

const report = JSON.parse(await readFile(new URL("../data/report.json", import.meta.url), "utf8"));
const schema = JSON.parse(await readFile(new URL("../schema/report.schema.json", import.meta.url), "utf8"));
const runKey = "paced-standalone-100-stopped";
const run = report.runs.find((item) => item.runKey === runKey);
const paced = run.pacedMeasurement;
const campaign = report.pacedCampaigns.find((item) => item.campaignKey === paced.campaignKey);
const reject = (edit, pattern) => {
  const data = structuredClone(report);
  const changed = data.runs.find((item) => item.runKey === runKey);
  edit(changed, data.pacedCampaigns.find((item) => item.campaignKey === changed.pacedMeasurement.campaignKey), data);
  const errors = validateReport(data, schema);
  assert.ok(errors.length, "invalid standalone evidence must fail closed");
  if (pattern) assert.match(errors.join("\n"), pattern);
};

test("ninth actual record is a separate 21-call standalone calibration, not a prior-campaign restart", () => {
  assert.deepEqual(validateReport(report, schema), []);
  assert.equal(report.runs.length, 9);
  assert.equal(report.runs.at(-1).runKey, runKey);
  assert.deepEqual(run.counts, { attempted: 21, completed: 12, failed: 9, pending: 0 });
  assert.deepEqual(campaign.runKeys, [runKey]);
  assert.equal(paced.campaignKey, "m365-standalone-100");
  assert.equal(campaign.status, "stopped_on_generic_error_threshold");
  const original = report.pacedCampaigns.find((item) => item.campaignKey === "m365-paced-campaign");
  assert.deepEqual(original.notAttemptedCalibrationRpm, [100, 150]);
  assert.deepEqual(campaign.notAttemptedCalibrationRpm, []);
  assert.equal(original.runKeys.length, 4);
  assert.ok(!original.runKeys.includes(runKey));
  reject((run) => { run.pacedMeasurement.campaignKey = original.campaignKey; }, /terminal campaign guard/);
  reject((_, campaign) => { campaign.notAttemptedCalibrationRpm = [100]; }, /unattempted calibration/);
});

test("standalone slot plan and partial-minute outcomes do not imply a complete minute or calibration", () => {
  assert.equal(paced.phase, "calibration");
  assert.equal(paced.targetRpm, 100);
  assert.equal(paced.plannedArrivalSeconds, 120);
  assert.equal(paced.plannedSlots, 200);
  assert.equal(paced.arrivalStatus, "stopped");
  assert.equal(paced.qualification, "not_qualified");
  assert.equal(paced.qualifyingRunKey, null);
  assert.equal(paced.unofferedSlots, 179);
  assert.equal(paced.skippedSlots, 0);
  assert.equal(paced.runnerRetries, 0);
  assert.equal(paced.managedServiceRetries, "unknown");
  assert.deepEqual(paced.pacing, {
    schedule: "absolute_slots", missedSlotPolicy: "skip_without_replay",
    intervalMs: 600, jitterAllowance: 0.05, observedMinIntervalMs: 572.0913, violatingIntervals: 0
  });
  assert.deepEqual(paced.minutes, [{ offsetSeconds: 0, durationSeconds: 12.612879599999992, attempted: 21, completed: 12, failed: 9, pending: 0 }]);
  reject((run) => { run.pacedMeasurement.arrivalStatus = "full_window"; }, /full arrival window/);
  reject((run) => { run.pacedMeasurement.qualification = "qualified"; }, /qualification requires/);
  reject((run) => { run.pacedMeasurement.minutes[0].durationSeconds = 60; }, /contiguous/);
  reject((run) => { run.pacedMeasurement.runnerRetries = 1; });
});

test("generic invocation-error threshold is a terminal safety stop, not authentication or throttling", () => {
  assert.equal(paced.stopReason, "generic_error_threshold");
  assert.deepEqual(run.errors, [{ category: "unknown", count: 9, evidence: "unclassified_invocation_failure" }]);
  reject((run) => { run.pacedMeasurement.stopReason = "explicit_throttle"; }, /classified throttle/);
  reject((run) => { run.errors[0] = { category: "throttling", count: 9, evidence: "transport_status" }; }, /generic-error safety stop/);
  reject((run) => { run.errors[0] = { category: "authentication", count: 9, evidence: "visible_error" }; }, /generic-error safety stop/);
  reject((run) => { run.errors[0].evidence = "unclassified_failure"; }, /generic-error safety stop/);
  reject((_, campaign) => { campaign.status = "stopped_on_workiq_mcp_transport_429"; }, /corresponding terminal cohort evidence/);
  reject((run, _, data) => {
    const next = structuredClone(data.runs.find((item) => item.runKey === "paced-calibration-25"));
    next.runKey = "offline-forbidden-follow-on";
    Object.assign(next.pacedMeasurement, {
      campaignKey: run.pacedMeasurement.campaignKey,
      startedAt: "2026-09-20T20:49:00.000Z", arrivalEndedAt: "2026-09-20T20:51:00.000Z", observedThroughAt: "2026-09-20T20:51:06.000Z"
    });
    delete data.pacedCampaigns;
    data.runs.push(next);
  }, /terminal campaign guard/);
});

test("standalone native durations preserve exact population sizes, nearest ranks and separate clock reads", () => {
  assert.equal(paced.percentileMethod, "nearest_rank");
  assert.deepEqual(paced.success, { sampleCount: 12, minMs: 7862.741999999998, p50Ms: 9187.8312, p95Ms: 11333.508999999998, maxMs: 11333.508999999998 });
  assert.deepEqual(paced.failure, { sampleCount: 9, minMs: 3246.6122999999934, p50Ms: 4054.410600000003, p95Ms: 4566.253500000006, maxMs: 4566.253500000006 });
  assert.deepEqual(paced.allOutcomes, { sampleCount: 21, minMs: 3246.6122999999934, p50Ms: 8285.110100000005, p95Ms: 10841.436400000006, maxMs: 11333.508999999998 });
  assert.equal(paced.arrivalSeconds, 12.612879599999992);
  assert.equal(paced.arrivalEndObservedSeconds, 12.612866199999997);
  assert.equal(paced.drainSeconds, 4.042247700000007);
  assert.equal(run.windowSeconds, 16.655113900000003);
  assert.equal(run.windowSeconds, paced.arrivalEndObservedSeconds + paced.drainSeconds);
  assert.notEqual(run.windowSeconds, paced.arrivalSeconds + paced.drainSeconds);
  assert.equal(paced.startedAt, "2026-09-20T20:46:43.499Z");
  assert.equal(paced.arrivalEndedAt, "2026-09-20T20:46:56.112Z");
  assert.equal(paced.observedThroughAt, "2026-09-20T20:47:00.154Z");
  assert.equal(campaign.startedAt, "2026-09-20T20:46:41.450Z");
  assert.equal(campaign.endedAt, "2026-09-20T20:47:00.164Z");
  reject((run) => { run.windowSeconds = run.pacedMeasurement.arrivalSeconds + run.pacedMeasurement.drainSeconds; }, /arrival-end offset/);
  reject((run) => { run.pacedMeasurement.success.p95Ms = run.pacedMeasurement.allOutcomes.p95Ms; }, /nearest.rank/);
});

test("returned conversations include failures but neither fresh intent nor client peak proves backend overlap", () => {
  assert.deepEqual(run.units, { conversations: 21, sessions: null });
  assert.equal(paced.failedConversations, 9);
  assert.equal(paced.conversationEvidence, "returned_ids_checked_unique");
  assert.equal(campaign.distinctReturnedConversations, 21);
  assert.equal(paced.peakOutstanding, 18);
  assert.equal(campaign.clientPeakOutstanding, 18);
  assert.equal(paced.concurrencyBasis, "outstanding_client_invocations");
  assert.equal(paced.concurrencyVerification, "reviewed_client_peak");
  assert.equal(run.authenticatedAccounts, 1);
  assert.equal(run.surface, "published_microsoft365_copilot");
  assert.equal(run.environmentType, "developer");
  assert.equal(run.model, "GPT 5.6 Sol");
  assert.equal(run.memory, "off");
  assert.equal(run.agentVersion, null);
  assert.equal(run.workflow, "not_involved");
  for (const field of ["nativeInvocation", "firstVisibleActivity", "firstVisibleLatency", "latency", "arrival", "concurrency"]) assert.equal(run[field], null);
  reject((run) => { run.pacedMeasurement.concurrencyBasis = "backend_model_executions"; });
  reject((run) => { run.units.conversations = 22; }, /conversations/);
});

test("new stale Monitor remains separate, closed and pending rather than zero-cost evidence", () => {
  assert.deepEqual(campaign.postCampaignMonitor, {
    checkedAt: "2026-09-20T20:48:13Z", updatedMinutesAgo: 60, sessions: 417,
    credits: "not_recorded", relevance: "stale_precampaign_analytics"
  });
  assert.equal(report.pacedCampaigns[0].postCampaignMonitor.sessions, 36);
  assert.ok(report.runs.every((run) => run.cost.status === "pending" && run.cost.amount === null));
  reject((run) => { run.cost.amount = 0; }, /unknown costs as zero/);
  reject((_, campaign) => { campaign.postCampaignMonitor.updatedMinutesAgo = 1; }, /stale campaign Monitor/);
  reject((run) => { run.pacedMeasurement.conversationIds = ["private"]; });
  reject((run) => { run.errors[0].rawResponse = "private"; });
  reject((_, campaign) => { campaign.account = "private"; });
});
