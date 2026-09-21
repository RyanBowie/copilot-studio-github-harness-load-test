// OFFLINE SYNTHETIC FIXTURE ONLY. Never a publication input or observed result.
import { syntheticPacedReport, syntheticTiming } from "./synthetic-paced-report.mjs";

export function syntheticCapacityReport(scenario = "two-hours") {
  const report = syntheticPacedReport("calibration");
  const template = report.runs[0];
  report.runs = [];
  let startSeconds = 0;
  const instant = (seconds) => new Date(Date.parse("2026-01-10T00:00:00.000Z") + seconds * 1000).toISOString();
  const stage = (rate, phase, ordinal, failed = false, stopReason = "native_error") => {
    const run = structuredClone(template);
    const paced = run.pacedMeasurement;
    const plannedSeconds = phase === "capacity_screen" ? 300 : 3600;
    const arrivalSeconds = failed ? 30 : plannedSeconds;
    const attempted = failed ? 2 : rate * plannedSeconds / 60;
    run.runKey = `offline-${phase === "capacity_screen" ? "screen" : "hour"}-${ordinal}`;
    run.counts = { attempted, completed: attempted - Number(failed), failed: Number(failed), pending: 0 };
    run.units.conversations = attempted;
    run.windowSeconds = arrivalSeconds + 1;
    run.errors = failed ? [{ category: "unknown", count: 1, evidence: "unclassified_invocation_failure" }] : [];
    Object.assign(paced, {
      campaignKey: "offline-capacity-study", phase, targetRpm: rate,
      startedAt: instant(startSeconds), arrivalEndedAt: instant(startSeconds + arrivalSeconds), observedThroughAt: instant(startSeconds + arrivalSeconds + 1),
      plannedSlots: rate * plannedSeconds / 60, plannedArrivalSeconds: plannedSeconds, arrivalSeconds, arrivalEndObservedSeconds: arrivalSeconds,
      arrivalStatus: failed ? "stopped" : "full_window", stopReason: failed ? stopReason : null,
      unofferedSlots: rate * plannedSeconds / 60 - attempted, qualification: failed ? "not_qualified" : "qualified",
      qualifyingRunKey: phase === "capacity_screen" ? null : report.runs.filter((item) => item.pacedMeasurement.phase === "capacity_screen"
        && item.pacedMeasurement.qualification === "qualified").at(-1)?.runKey ?? null,
      failedConversations: Number(failed), success: syntheticTiming(run.counts.completed),
      failure: syntheticTiming(run.counts.failed), allOutcomes: syntheticTiming(attempted),
      capacityEvidence: {
        protocol: "zero_error_screens_two_hours", clockStatus: "verified_clean", evidenceStatus: "verified_complete",
        successfulWithinArrivalWindow: run.counts.completed - 1, successfulAfterArrivalWindow: 1,
        postCloseActivity: "draining_requests", pendingAtClose: 1, postCloseNativeReturns: 1
      },
      minutes: Array.from({ length: Math.ceil(arrivalSeconds / 60) }, (_, index) => ({
        offsetSeconds: index * 60, durationSeconds: Math.min(60, arrivalSeconds - index * 60),
        attempted: failed ? attempted : rate, completed: failed ? attempted - 1 : rate, failed: Number(failed), pending: 0
      }))
    });
    paced.pacing.intervalMs = 60000 / rate;
    paced.pacing.observedMinIntervalMs = paced.pacing.intervalMs * 0.95;
    report.runs.push(run);
    startSeconds += arrivalSeconds + 61;
  };
  if (!["two-hours", "one-hour", "screens", "fallback", "no-candidate", "hour-failure", "safety-stop", "progress"].includes(scenario)) {
    throw new Error("Unsupported offline capacity fixture scenario.");
  }
  if (scenario === "no-candidate") {
    stage(25, "capacity_screen", 1, true);
    return report;
  }
  const rates = ["fallback", "safety-stop"].includes(scenario) ? [25, 30] : scenario === "progress" ? [25] : [25, 30, 35, 40, 45, 50];
  rates.forEach((rate, index) => stage(rate, "capacity_screen", index + 1,
    ["fallback", "safety-stop"].includes(scenario) && index === 1, scenario === "safety-stop" ? "safety" : "native_error"));
  if (["screens", "safety-stop", "progress"].includes(scenario)) return report;
  const selected = report.runs.filter((run) => run.pacedMeasurement.qualification === "qualified").at(-1);
  stage(selected.pacedMeasurement.targetRpm, "capacity_hour", 1, scenario === "hour-failure");
  if (!["one-hour", "hour-failure"].includes(scenario)) stage(selected.pacedMeasurement.targetRpm, "capacity_hour", 2);
  return report;
}
