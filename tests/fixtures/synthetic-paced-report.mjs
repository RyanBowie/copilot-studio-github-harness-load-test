// OFFLINE SYNTHETIC FIXTURE ONLY. Never a publication input or observed result.
export const syntheticTiming = (sampleCount) => sampleCount === 0 ? null : {
  sampleCount, minMs: 1000, p50Ms: 1000, p95Ms: 1000, maxMs: 1000
};

export function syntheticPacedReport(scenario = "full") {
  const calibration = {
    runKey: "offline-paced-calibration", observedOn: "2026-01-10", surface: "published_microsoft365_copilot",
    agentVersion: null, environmentType: "developer", model: "Offline synthetic model",
    authenticatedAccounts: 1, memory: "off", workload: "single_turn", workflow: "not_involved", connectors: "unknown",
    counts: { attempted: 20, completed: 20, failed: 0, pending: 0 }, units: { conversations: 20, sessions: null },
    windowSeconds: 121, firstVisibleActivity: null, firstVisibleLatency: null, latency: null,
    concurrency: null, arrival: null, errors: [], clientIssues: [], workflowState: null, followUp: null,
    nativeInvocation: null, observations: [],
    cost: { status: "pending", currency: null, amount: null, source: null, scope: null, recordedOn: null },
    pacedMeasurement: {
      campaignKey: "offline-paced-campaign", phase: "calibration",
      path: "workiq_ask_via_native_tool_rpc", endpoint: "invocation_completion", requestKind: "greeting_only",
      timingBasis: "calibrated_native_rpc_completion",
      startedAt: "2026-01-10T00:00:00.000Z", arrivalEndedAt: "2026-01-10T00:02:00.000Z", observedThroughAt: "2026-01-10T00:02:01.000Z",
      targetRpm: 10, plannedArrivalSeconds: 120, arrivalSeconds: 120,
      plannedSlots: 20, skippedSlots: 0, unofferedSlots: 0, arrivalStatus: "full_window", stopReason: null,
      drainStatus: "complete", drainSeconds: 1, qualification: "qualified", qualifyingRunKey: null,
      pacing: { schedule: "absolute_slots", missedSlotPolicy: "skip_without_replay", intervalMs: 6000, jitterAllowance: 0.05, observedMinIntervalMs: 6000, violatingIntervals: 0 },
      peakOutstanding: 1, concurrencyBasis: "outstanding_client_invocations", concurrencyVerification: "start_end_interval_sweep",
      conversationPolicy: "fresh_per_request", conversationEvidence: "returned_ids_checked_unique", failedConversations: 0,
      runnerRetries: 0, managedServiceRetries: "unknown", percentileMethod: "nearest_rank",
      success: syntheticTiming(20), failure: null, allOutcomes: syntheticTiming(20),
      minuteBasis: "client_dispatch_cohort_outcomes_at_cutoff",
      minutes: [0, 60].map((offsetSeconds) => ({ offsetSeconds, durationSeconds: 60, attempted: 10, completed: 10, failed: 0, pending: 0 }))
    }
  };
  const report = {
    schemaVersion: 1, harness: "GitHub Copilot Harness", outcomeBasis: "requested_operation",
    publication: { status: "reviewed", reviewedOn: "2026-01-10" }, studyContext: null, runs: [calibration], documentedLimits: []
  };
  if (scenario === "calibration") return report;
  const hour = structuredClone(calibration);
  hour.runKey = "offline-paced-hour";
  hour.windowSeconds = 3601;
  hour.counts = { attempted: 600, completed: 600, failed: 0, pending: 0 };
  hour.units.conversations = 600;
  Object.assign(hour.pacedMeasurement, {
    phase: "hour", qualification: "not_evaluated", qualifyingRunKey: calibration.runKey,
    startedAt: "2026-01-10T00:03:01.000Z", arrivalEndedAt: "2026-01-10T01:03:01.000Z", observedThroughAt: "2026-01-10T01:03:02.000Z",
    plannedArrivalSeconds: 3600, arrivalSeconds: 3600, plannedSlots: 600,
    success: syntheticTiming(600), allOutcomes: syntheticTiming(600),
    minutes: Array.from({ length: 60 }, (_, index) => ({ offsetSeconds: index * 60, durationSeconds: 60, attempted: 10, completed: 10, failed: 0, pending: 0 }))
  });
  if (scenario === "stopped" || scenario === "partial") {
    hour.windowSeconds = 91;
    hour.counts = { attempted: 14, completed: 12, failed: 1, pending: 1 };
    hour.units.conversations = 13;
    hour.errors = [{ category: "unknown", count: 1, evidence: "unclassified_invocation_failure" }];
    Object.assign(hour.pacedMeasurement, {
      arrivalEndedAt: "2026-01-10T00:04:31.000Z", observedThroughAt: "2026-01-10T00:04:32.000Z",
      arrivalSeconds: 90, skippedSlots: 1, unofferedSlots: 585, arrivalStatus: scenario,
      stopReason: scenario === "stopped" ? "native_error" : "observation_cutoff",
      drainStatus: "bounded_cutoff", peakOutstanding: 2, failedConversations: 1,
      success: syntheticTiming(12), failure: syntheticTiming(1), allOutcomes: syntheticTiming(13),
      minutes: [
        { offsetSeconds: 0, durationSeconds: 60, attempted: 10, completed: 9, failed: 1, pending: 0 },
        { offsetSeconds: 60, durationSeconds: 30, attempted: 4, completed: 3, failed: 0, pending: 1 }
      ]
    });
  } else if (scenario !== "full") throw new Error("Unsupported offline paced fixture scenario.");
  report.runs.push(hour);
  return report;
}
