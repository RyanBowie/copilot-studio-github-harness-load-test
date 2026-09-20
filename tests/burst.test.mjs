import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateReport } from "../src/validate.mjs";

const report = JSON.parse(await readFile(new URL("../data/report.json", import.meta.url), "utf8"));
const schema = JSON.parse(await readFile(new URL("../schema/report.schema.json", import.meta.url), "utf8"));
const burstKey = "m365-native-burst-100";
const burst = report.runs.find((run) => run.runKey === burstKey);
const reject = (edit, expected) => {
  const data = structuredClone(report);
  const run = data.runs.find((item) => item.runKey === burstKey);
  edit(run, run.nativeInvocation, data);
  const errors = validateReport(data, schema);
  assert.ok(errors.length, "invalid burst must fail closed");
  if (expected) assert.match(errors.join("\n"), expected);
};

test("reviewed burst is exactly 100 native published Microsoft 365 invocations, separate from Teams", () => {
  assert.deepEqual(validateReport(report, schema), []);
  assert.equal(report.runs.filter((run) => !run.pacedMeasurement).length, 4);
  assert.equal(burst.surface, "published_microsoft365_copilot");
  assert.deepEqual(burst.counts, { attempted: 100, completed: 33, failed: 67, pending: 0 });
  assert.equal(burst.counts.completed / burst.counts.attempted * 100, 33);
  assert.equal(burst.authenticatedAccounts, 1);
  assert.equal(burst.environmentType, "developer");
  assert.equal(burst.model, "GPT 5.6 Sol");
  assert.equal(burst.memory, "off");
  assert.equal(burst.agentVersion, null);
  assert.equal(burst.workflow, "not_involved");
  assert.equal(burst.connectors, "unknown");
  assert.equal(report.studyContext.runKeys.includes(burstKey), false);
  assert.deepEqual(burst.units, { conversations: 100, sessions: null });
  assert.equal(burst.nativeInvocation.failedConversations, 67);
  assert.equal(burst.nativeInvocation.excludedPreflights, 2);
});

test("burst native duration summaries preserve success, failure and all-outcome populations", () => {
  const invocation = burst.nativeInvocation;
  assert.equal(invocation.endpoint, "invocation_completion");
  assert.equal(invocation.percentileMethod, "nearest_rank");
  assert.deepEqual(invocation.success, { sampleCount: 33, minMs: 8866.5169, p50Ms: 17299.0789, p95Ms: 33442.3959, maxMs: 34378.6106 });
  assert.deepEqual(invocation.failure, { sampleCount: 67, minMs: 8235.0156, p50Ms: 24965.3921, p95Ms: 37946.5726, maxMs: 39024.4086 });
  assert.deepEqual(invocation.allOutcomes, { sampleCount: 100, minMs: 8235.0156, p50Ms: 24526.3908, p95Ms: 37266.7486, maxMs: 39024.4086 });
  for (const field of ["firstVisibleActivity", "firstVisibleLatency", "latency", "arrival", "concurrency", "followUp", "workflowState"]) assert.equal(burst[field], null);
  assert.equal(burst.windowSeconds, 39.0336098);
  assert.equal(invocation.startedAt, "2026-09-20T16:54:21.563Z");
  assert.equal(invocation.endedAt, "2026-09-20T16:55:00.600Z");
  assert.notEqual((Date.parse(invocation.endedAt) - Date.parse(invocation.startedAt)) / 1000, burst.windowSeconds);
});

test("burst calibration and client launch cannot be labelled backend execution", () => {
  const invocation = burst.nativeInvocation;
  assert.equal(invocation.dispatchWindowMs, 1.6675);
  assert.equal(invocation.peakOutstanding, 100);
  assert.equal(invocation.concurrencyBasis, "outstanding_client_invocations");
  assert.equal(invocation.concurrencyVerification, "start_end_interval_sweep");
  assert.equal(invocation.path, "workiq_ask_via_native_tool_rpc");
  assert.equal(invocation.requestKind, "greeting_only");
  assert.equal(invocation.runnerRetries, 0);
  assert.equal(invocation.managedServiceRetries, "unknown");
  assert.deepEqual(invocation.calibration, {
    clock: "native_rpc_completion", eventTimestamps: "coalesced_and_excluded",
    shortRequestedMs: 200, shortObservedMs: 1562.6, longRequestedMs: 2200, longObservedMs: 3489.3
  });
});

test("burst generic errors stay unclassified, not a confirmed harness throttle", () => {
  assert.deepEqual(burst.errors, [{ category: "unknown", count: 67, evidence: "unclassified_invocation_failure" }]);
  assert.equal(burst.nativeInvocation.errorEnvelope, "workiq_m365_server_error");
  assert.equal(burst.nativeInvocation.failureResultType, "native_failure");
  assert.equal(burst.nativeInvocation.throttleEvidence, "none_explicit");
  assert.equal(burst.nativeInvocation.bottleneck, "unknown");
  reject((run) => { run.errors[0].category = "throttling"; }, /unknown category/);
  reject((run) => { run.errors[0].evidence = "transport_status"; }, /generic server_error/);
  reject((_, invocation) => { invocation.throttleEvidence = "http_429"; });
  reject((_, invocation) => { invocation.bottleneck = "model"; });
});

test("exact success intersection retains partial history and stale analytics limitations", () => {
  assert.deepEqual(burst.nativeInvocation.history, {
    completedConversations: 33, failedConversationsAbsent: 67,
    membership: "exact_intersection_verified", completeness: "partial_has_more",
    snapshotRows: 37, hasMore: true, successfulLastStep: "none_recorded"
  });
  assert.deepEqual(burst.nativeInvocation.postRunMonitor, {
    checkedAt: "2026-09-20T16:59:36Z", updatedMinutesAgo: 44,
    sessions: 1, messages: 7, credits: "not_recorded", relevance: "stale_preburst_analytics"
  });
  assert.deepEqual(burst.cost, { status: "pending", currency: null, amount: null, source: null, scope: null, recordedOn: null });
  reject((_, invocation) => { invocation.history.hasMore = false; });
  reject((_, invocation) => { invocation.history.completeness = "exhaustive"; });
  reject((_, invocation) => { invocation.postRunMonitor.relevance = "burst_totals"; });
  reject((_, invocation) => { invocation.postRunMonitor.updatedMinutesAgo = 1; }, /last updated before/);
  reject((_, invocation) => { invocation.postRunMonitor.checkedAt = "2026-09-20T16:54:30Z"; }, /checked after/);
  reject((run) => { run.cost.amount = 0; }, /unknown costs as zero/);
});

test("native contract rejects wrong surface, UI timing, message overlap and unbounded counts", () => {
  reject((run) => { run.surface = "published_teams"; }, /exclusive/);
  reject((run) => { run.nativeInvocation = null; }, /exclusive/);
  reject((_, invocation) => { invocation.endpoint = "backend_ttfa"; });
  reject((_, invocation) => { invocation.concurrencyBasis = "backend_model_executions"; });
  reject((_, invocation) => { invocation.requestKind = "approval"; });
  reject((run) => { run.workflow = "involved"; }, /greeting-only/);
  reject((run) => { run.workload = "multi_turn"; }, /greeting-only/);
  reject((run, _, data) => { run.clientIssues = structuredClone(data.runs[0].clientIssues); }, /greeting-only/);
  reject((run) => { run.concurrency = { maxInFlight: 100, basis: "observed_message_overlap" }; }, /cannot stand in/);
  reject((run) => { run.arrival = { attempts: 100, windowSeconds: 0.0016675 }; }, /cannot stand in/);
  reject((run, _, data) => { run.latency = structuredClone(data.runs[0].latency); }, /cannot stand in/);
  reject((run) => { run.units.conversations = 33; }, /every invocation/);
  reject((_, invocation) => { invocation.failedConversations = 0; }, /every invocation/);
  reject((_, invocation) => { invocation.peakOutstanding = 101; }, /must fit/);
  reject((_, invocation) => { invocation.dispatchWindowMs = 40000; }, /must fit/);
  reject((run) => { run.windowSeconds = null; }, /finished invocation batch/);
  reject((run) => { run.counts.pending = 1; }, /finished invocation batch/);
});

test("native timing summary consistency fails closed", () => {
  reject((_, invocation) => { invocation.success.sampleCount = 100; }, /group's count/);
  reject((_, invocation) => { invocation.success = null; }, /requires timing/);
  reject((_, invocation) => { invocation.failure.minMs = 30000; }, /min <= p50/);
  reject((_, invocation) => { invocation.allOutcomes.maxMs = 40000; }, /calibrated batch/);
  reject((_, invocation) => { invocation.allOutcomes.maxMs = 38900; }, /maximum across outcome/);
  reject((_, invocation) => { invocation.allOutcomes.minMs = 8800; }, /min must match/);
  reject((_, invocation) => { invocation.endedAt = invocation.startedAt; }, /wall-clock markers/);
  reject((_, invocation) => { invocation.startedAt = "2026-02-30T16:54:21.563Z"; }, /real millisecond UTC/);
  reject((_, invocation) => { invocation.calibration.longObservedMs = invocation.calibration.shortObservedMs; }, /distinct ordered durations/);
  reject((_, invocation) => { invocation.history.completedConversations = 34; }, /snapshot counts/);
  reject((_, invocation) => { invocation.history.completedConversations = 32; }, /every successful invocation/);
  reject((_, invocation) => { invocation.history.snapshotRows = 32; }, /snapshot counts/);
});

test("pilot context cannot leak into the independent 100-conversation run", () => {
  reject((_, __, data) => { data.studyContext.runKeys.push(burstKey); }, /shared single-conversation/);
  reject((_, __, data) => { data.studyContext.runKeys.push("missing-run"); }, /existing reviewed runs/);
  reject((_, __, data) => { data.studyContext.runKeys.push(data.studyContext.runKeys[0]); });
});

test("every native object boundary rejects unknown fields and omitted required fields", () => {
  function paths(value, prefix = []) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return [];
    return [prefix, ...Object.entries(value).flatMap(([key, child]) => paths(child, [...prefix, key]))];
  }
  const at = (value, path) => path.reduce((current, key) => current[key], value);
  for (const path of paths(burst.nativeInvocation)) {
    reject((_, invocation) => { at(invocation, path).conversationIds = ["not-public"]; });
    for (const key of Object.keys(at(burst.nativeInvocation, path))) reject((_, invocation) => { delete at(invocation, path)[key]; });
  }
});
