import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateReport } from "../src/validate.mjs";

const report = JSON.parse(await readFile(new URL("../data/report.json", import.meta.url), "utf8"));
const schema = JSON.parse(await readFile(new URL("../schema/report.schema.json", import.meta.url), "utf8"));
const runKey = "paced-spread-25-completed";
const run = report.runs.find((item) => item.runKey === runKey);
const paced = run.pacedMeasurement;
const campaign = report.pacedCampaigns.find((item) => item.campaignKey === paced.campaignKey);
const reject = (edit, pattern) => {
  const data = structuredClone(report);
  const changed = data.runs.find((item) => item.runKey === runKey);
  edit(changed, data.pacedCampaigns.find((item) => item.campaignKey === changed.pacedMeasurement.campaignKey), data);
  const errors = validateReport(data, schema);
  assert.ok(errors.length, "unsupported completion evidence must fail closed");
  if (pattern) assert.match(errors.join("\n"), pattern);
};

test("tenth actual record is a completed 50-request follow-up in its own campaign", () => {
  assert.deepEqual(validateReport(report, schema), []);
  assert.equal(report.runs.length, 10);
  assert.equal(report.runs.at(-1).runKey, runKey);
  assert.deepEqual(run.counts, { attempted: 50, completed: 50, failed: 0, pending: 0 });
  assert.deepEqual(campaign.runKeys, [runKey]);
  assert.equal(campaign.campaignKey, "m365-spread-25");
  assert.equal(campaign.status, "completed_standalone_calibration");
  assert.equal(paced.phase, "calibration");
  assert.equal(paced.targetRpm, 25);
  assert.equal(paced.arrivalStatus, "full_window");
  assert.equal(paced.drainStatus, "complete");
  assert.equal(paced.qualification, "qualified");
  assert.equal(paced.qualifyingRunKey, null);
  assert.equal(paced.stopReason, null);
  assert.deepEqual(run.errors, []);
  assert.deepEqual(report.pacedCampaigns.map((item) => item.status), [
    "stopped_on_workiq_mcp_transport_429", "stopped_on_generic_error_threshold", "completed_standalone_calibration"
  ]);
  assert.deepEqual(report.pacedCampaigns[0].notAttemptedCalibrationRpm, [100, 150]);
});

test("full two-minute offer window and exact observed end/drain remain separate", () => {
  assert.equal(paced.plannedArrivalSeconds, 120);
  assert.equal(paced.arrivalSeconds, 120);
  assert.equal(paced.plannedSlots, 50);
  assert.equal(paced.skippedSlots, 0);
  assert.equal(paced.unofferedSlots, 0);
  assert.equal(paced.runnerRetries, 0);
  assert.equal(paced.managedServiceRetries, "unknown");
  assert.equal(paced.arrivalEndObservedSeconds, 120.00164290000001);
  assert.equal(paced.drainSeconds, 7.0647474999999975);
  assert.equal(run.windowSeconds, 127.0663904);
  assert.ok(Math.abs(run.windowSeconds - paced.arrivalEndObservedSeconds - paced.drainSeconds) < 1e-9);
  assert.notEqual(run.windowSeconds, paced.arrivalSeconds + paced.drainSeconds);
  assert.equal(paced.startedAt, "2026-09-20T21:20:17.556Z");
  assert.equal(paced.arrivalEndedAt, "2026-09-20T21:22:17.558Z");
  assert.equal(paced.observedThroughAt, "2026-09-20T21:22:24.623Z");
  assert.equal(campaign.startedAt, "2026-09-20T21:20:16.522Z");
  assert.equal(campaign.endedAt, "2026-09-20T21:22:24.644Z");
  assert.deepEqual(paced.minutes, [
    { offsetSeconds: 0, durationSeconds: 60, attempted: 25, completed: 25, failed: 0, pending: 0 },
    { offsetSeconds: 60, durationSeconds: 60, attempted: 25, completed: 25, failed: 0, pending: 0 }
  ]);
  reject((run) => { run.windowSeconds = run.pacedMeasurement.arrivalSeconds + run.pacedMeasurement.drainSeconds; }, /arrival-end offset/);
  reject((run) => { run.pacedMeasurement.minutes[1].completed = 22; }, /partition actual dispatches/);
});

test("success and all-outcome native timing match exactly; failures have no samples", () => {
  const timing = { sampleCount: 50, minMs: 6686.623099999997, p50Ms: 7743.116399999999, p95Ms: 9889.714500000002, maxMs: 11946.911099999998 };
  assert.deepEqual(paced.success, timing);
  assert.deepEqual(paced.allOutcomes, timing);
  assert.equal(paced.failure, null);
  assert.equal(paced.percentileMethod, "nearest_rank");
  for (const field of ["nativeInvocation", "firstVisibleActivity", "firstVisibleLatency", "latency", "arrival", "concurrency"]) assert.equal(run[field], null);
  reject((run) => { run.pacedMeasurement.failure = { sampleCount: 0, minMs: 0, p50Ms: 0, p95Ms: 0, maxMs: 0 }; });
  reject((run) => { run.pacedMeasurement.failure = { ...timing, sampleCount: 1 }; }, /no outcomes must use null/);
  reject((run) => { run.pacedMeasurement.success.sampleCount = 47; }, /group's count/);
});

test("completed standalone status cannot relabel a stopped, partial, unqualified or multi-stage campaign", () => {
  reject((run) => { run.pacedMeasurement.qualification = "not_evaluated"; }, /completed standalone calibration/);
  reject((run) => { run.pacedMeasurement.arrivalStatus = "partial"; run.pacedMeasurement.stopReason = "observation_cutoff"; }, /completed standalone calibration/);
  reject((run) => { run.pacedMeasurement.drainStatus = "bounded_cutoff"; }, /completed standalone calibration/);
  reject((run) => { run.pacedMeasurement.phase = "hour"; }, /completed standalone calibration/);
  reject((_, campaign) => { campaign.status = "stopped_on_generic_error_threshold"; }, /corresponding terminal cohort evidence/);
  reject((_, campaign) => { campaign.status = "completed_full_hour"; });
  reject((_, __, data) => { data.pacedCampaigns[1].status = "completed_standalone_calibration"; }, /completed standalone calibration/);
  reject((run, campaign, data) => {
    const earlier = structuredClone(data.runs.find((item) => item.runKey === "paced-calibration-10"));
    earlier.runKey = "offline-unrelated-calibration";
    earlier.pacedMeasurement.campaignKey = campaign.campaignKey;
    campaign.runKeys.unshift(earlier.runKey);
    campaign.startedAt = earlier.pacedMeasurement.startedAt;
    data.runs.push(earlier);
  }, /completed standalone calibration requires exactly one/);
});

test("measured five-call peak and fifty returned conversations remain client-only observations", () => {
  assert.deepEqual(paced.pacing, {
    schedule: "absolute_slots", missedSlotPolicy: "skip_without_replay",
    intervalMs: 2400, jitterAllowance: 0.05, observedMinIntervalMs: 2324.9084999999905, violatingIntervals: 0
  });
  assert.ok(paced.pacing.observedMinIntervalMs >= 2280);
  assert.equal(paced.peakOutstanding, 5);
  assert.equal(campaign.clientPeakOutstanding, 5);
  assert.equal(paced.concurrencyBasis, "outstanding_client_invocations");
  assert.equal(paced.concurrencyVerification, "reviewed_client_peak");
  assert.deepEqual(run.units, { conversations: 50, sessions: null });
  assert.equal(paced.failedConversations, 0);
  assert.equal(campaign.distinctReturnedConversations, 50);
  assert.equal(run.authenticatedAccounts, 1);
  assert.equal(run.environmentType, "developer");
  assert.equal(run.surface, "published_microsoft365_copilot");
  assert.equal(run.model, "GPT 5.6 Sol");
  assert.equal(run.memory, "off");
  assert.equal(run.agentVersion, null);
  reject((run) => { run.pacedMeasurement.concurrencyVerification = "configured_client_cap"; });
  reject((run) => { run.pacedMeasurement.concurrencyBasis = "backend_model_executions"; });
  reject((_, campaign) => { campaign.clientPeakOutstanding = 100; }, /cohort peaks/);
});

test("completed cohort retains pending cost and its own stale Monitor with closed privacy fields", () => {
  assert.deepEqual(campaign.postCampaignMonitor, {
    checkedAt: "2026-09-20T21:23:22Z", updatedMinutesAgo: 60, sessions: 417,
    credits: "not_recorded", relevance: "stale_precampaign_analytics"
  });
  assert.deepEqual(report.pacedCampaigns.slice(0, 2).map((item) => item.postCampaignMonitor.checkedAt), ["2026-09-20T19:34:29Z", "2026-09-20T20:48:13Z"]);
  assert.ok(report.runs.every((run) => run.cost.status === "pending" && run.cost.amount === null));
  reject((run) => { run.cost.amount = 0; }, /unknown costs as zero/);
  reject((_, campaign) => { campaign.postCampaignMonitor.updatedMinutesAgo = 1; }, /stale campaign Monitor/);
  reject((run) => { run.pacedMeasurement.conversationIds = ["private"]; });
  reject((run) => { run.rawResponses = []; });
  reject((_, campaign) => { campaign.account = "private"; });
});
