import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateReport } from "../src/validate.mjs";

const report = JSON.parse(await readFile(new URL("../data/report.json", import.meta.url), "utf8"));
const schema = JSON.parse(await readFile(new URL("../schema/report.schema.json", import.meta.url), "utf8"));
const run = (key) => report.runs.find((item) => item.runKey === key);
const pilotRuns = report.runs.filter((item) => report.studyContext.runKeys.includes(item.runKey));

test("reviewed pilot preserves sent-message outcomes and one reused conversation", () => {
  assert.deepEqual(validateReport(report, schema), []);
  assert.ok(report.publication.reviewedOn >= "2026-09-20");
  assert.equal(pilotRuns.length, 3);
  assert.deepEqual(report.studyContext.runKeys, ["greeting-pilot", "public-knowledge-pilot", "compliance-review-pilot"]);
  assert.deepEqual(pilotRuns.reduce((total, item) => {
    for (const key of Object.keys(total)) total[key] += item.counts[key];
    return total;
  }, { attempted: 0, completed: 0, failed: 0, pending: 0 }), { attempted: 3, completed: 2, failed: 1, pending: 0 });
  assert.equal(report.outcomeBasis, "requested_operation");
  assert.equal(report.studyContext.conversationUse, "one_existing_reused");
  assert.equal(report.studyContext.executionPattern, "sequential");
  assert.equal(report.studyContext.volumeRamp, "not_performed");
  assert.equal(report.studyContext.configurationChanges, "none_by_tester");
  for (const item of pilotRuns) {
    assert.equal(item.observedOn, "2026-09-20");
    assert.deepEqual(item.units, { conversations: 1, sessions: null });
    assert.equal(item.surface, "published_teams");
    assert.equal(item.environmentType, "developer");
    assert.equal(item.model, "GPT 5.6 Sol");
    assert.equal(item.agentVersion, null);
    assert.equal(item.memory, "off");
    assert.equal(item.authenticatedAccounts, 1);
    assert.equal(item.workload, "single_turn");
    assert.equal(item.arrival, null);
    assert.equal(item.concurrency, null);
    assert.equal(item.errors.reduce((total, error) => total + error.count, 0), item.counts.failed);
  }
});

test("reviewed first-activity, answer and settlement observations remain distinct", () => {
  const expected = [
    ["greeting-pilot", 9447, 9447, 13573, 13.573],
    ["public-knowledge-pilot", 7726, 26234, 30031, 30.031],
    ["compliance-review-pilot", 8965, null, null, 120.167]
  ];
  for (const [key, activity, answer, settled, window] of expected) {
    const item = run(key);
    assert.equal(item.windowSeconds, window);
    for (const [field, value] of [["firstVisibleActivity", activity], ["firstVisibleLatency", answer], ["latency", settled]]) {
      if (value === null) assert.equal(item[field], null);
      else {
        assert.equal(item[field].sampleCount, 1);
        assert.deepEqual([item[field].p50Ms, item[field].p95Ms, item[field].maxMs], [value, value, value]);
      }
    }
    if (item.latency) assert.equal(item.latency.stabilitySeconds, 3);
  }
});

test("excluded draft recovery is not an agent failure or a message attempt", () => {
  assert.deepEqual(run("greeting-pilot").clientIssues, [{ category: "unsent_draft", count: 1, observedWaitSeconds: 120.096 }]);
  assert.equal(run("greeting-pilot").counts.attempted, 1);
  assert.equal(run("greeting-pilot").counts.failed, 0);
  assert.ok(run("greeting-pilot").observations.includes("unsent_draft_recovered_once_without_auto_retry"));
});

test("compliance call fails while separate workflow history still shows waiting", () => {
  const item = run("compliance-review-pilot");
  assert.deepEqual(item.counts, { attempted: 1, completed: 0, failed: 1, pending: 0 });
  assert.equal(item.workflow, "involved");
  assert.equal(item.connectors, "involved");
  assert.deepEqual(item.workflowState, {
    invocationStatusFirstSeenMs: 66917, historyCheck: "after_message_cutoff", runningRuns: 1,
    triggerStatus: "succeeded", humanReviewStatus: "waiting", emailStatus: "waiting",
    finalOutputs: "not_available", reviewNotificationDelivery: "unconfirmed",
    humanDecision: "unconfirmed", testerApprovalOrEmail: "none"
  });
  assert.deepEqual(item.errors, [{ category: "workflow", count: 1, evidence: "agent_reported_timeout" }]);
  assert.deepEqual(item.followUp, {
    observedAt: "2026-09-20T16:16:39Z",
    atCutoff: { attempted: 1, completed: 0, failed: 0, pending: 1 },
    outcome: "agent_reported_workflow_timeout", reportedHttpStatus: 504,
    wireStatus: "not_independently_verified", earlierResponseStatus: "stopped",
    draftVisible: true, submissionConfirmed: false, retried: false
  });
});

test("retired fields stay absent and configuration discrepancies are explicit", () => {
  for (const item of pilotRuns) {
    assert.equal(Object.hasOwn(item, "cost"), false);
    assert.ok(item.observations.includes("standalone_teams_send_tool_missing"));
    assert.ok(item.observations.includes("public_knowledge_all_websites_enabled"));
  }
  assert.equal(report.studyContext.postPilotMonitor, "no_sessions_recorded");
  assert.equal(report.studyContext.harnessVerification, "github_copilot_and_published_badges");
  assert.equal(run("public-knowledge-pilot").connectors, "not_involved");
  assert.ok(run("public-knowledge-pilot").observations.includes("built_in_web_search_observed"));
});

test("the numerical documentation entry is per-conversation GHCP, not an observed RPM ceiling", () => {
  assert.equal(report.documentedLimits.length, 1);
  const limit = report.documentedLimits[0];
  assert.equal(limit.harnessScope, "github_copilot_harness");
  assert.equal(limit.scope, "per_conversation");
  assert.equal(limit.metric, "active_turns");
  assert.equal(limit.value, 1);
  assert.equal(limit.retrievedOn, "2026-09-20");
  assert.match(limit.sourceUrl, /agents-experience\/troubleshooting-error-codes$/);
});

test("reviewed context, independent workflow state and follow-up reject unsupported claims", () => {
  const mutate = (edit, pattern) => {
    const data = structuredClone(report);
    edit(data, data.runs.find((item) => item.runKey === "compliance-review-pilot"));
    const errors = validateReport(data, schema);
    assert.ok(errors.length);
    if (pattern) assert.match(errors.join("\n"), pattern);
  };
  mutate((data) => { data.runs[0].units.conversations = 2; }, /shared single-conversation/);
  mutate((_, item) => { item.workflowState.reviewNotificationDelivery = "confirmed"; });
  mutate((_, item) => { item.workflowState.humanDecision = "approved"; });
  mutate((_, item) => { item.workflowState.emailStatus = "succeeded"; });
  mutate((_, item) => { item.workflowState.historyCheck = "at_cutoff"; });
  mutate((_, item) => { item.workflow = "not_involved"; }, /involved workflow/);
  mutate((_, item) => { item.workflowState.invocationStatusFirstSeenMs = 120168; }, /within the message/);
  mutate((data) => { data.studyContext.tenantId = "must-not-publish"; });
  mutate((_, item) => { item.workflowState.runId = "must-not-publish"; });
  mutate((data) => { data.documentedLimits[0].accountScope = "must-not-publish"; });
  mutate((data) => { data.outcomeBasis = "final_visible_messages"; });
  mutate((_, item) => { item.followUp.reportedHttpStatus = 429; });
  mutate((_, item) => { item.followUp.retried = true; });
  mutate((_, item) => { item.followUp.atCutoff.attempted = 2; }, /same sent attempts/);
  mutate((_, item) => { item.followUp.observedAt = "2026-02-30T16:16:39Z"; }, /real UTC instant/);
  mutate((_, item) => { item.errors[0].category = "throttling"; }, /not a wire-status or throttling/);
  mutate((_, item) => { item.errors[0].evidence = "transport_status"; }, /agent-reported evidence/);
});
