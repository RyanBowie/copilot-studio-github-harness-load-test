import { validateAggregateShape } from "./validate.mjs";
import { capacityContext } from "./capacity.mjs";

const exactScale = 10n ** 60n;
const exactOffset = (text) => {
  const [integer, fraction = ""] = text.split(".");
  return BigInt(integer) * exactScale + BigInt(fraction.padEnd(60, "0"));
};
const windowDurations = [10, 30, 60, 120, 300, 900, 3600];

export function validateWindowEvidence(evidence, schema, report) {
  const errors = validateAggregateShape(evidence, schema, "windowEvidence");
  if (errors.length || evidence === null) return errors;
  const fail = (message) => errors.push(`windowEvidence: ${message}`);
  const date = new Date(`${evidence.reviewedOn}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== evidence.reviewedOn) fail("review date must be real.");
  const known = new Map(report.runs.map((run) => [run.runKey, run]));
  const seen = new Set();
  let attempted = 0;
  const pair = (value, name) => {
    if (Number(value[`${name}Exact`]) !== value[name]) fail("numeric offsets must match their exact decimal display conversion.");
  };
  const range = (value) => {
    for (const key of ["startOffsetMs", "endOffsetMs", "durationMs"]) pair(value, key);
    if (exactOffset(value.endOffsetMsExact) - exactOffset(value.startOffsetMsExact) !== exactOffset(value.durationMsExact)) fail("exact range boundaries must reconcile with duration.");
  };
  const bounds = (value) => {
    pair(value, "lowerMs");
    pair(value, "upperMs");
    const difference = exactOffset(value.upperMsExact) - exactOffset(value.lowerMsExact);
    if (difference < 0n || (value.precision === "exact" ? difference !== 0n : difference === 0n)) fail("exact events and nonzero uncertainty bounds cannot be interchanged.");
  };
  for (const item of evidence.runs) {
    const run = known.get(item.runKey);
    if (!run || !(run.nativeInvocation || run.pacedMeasurement) || seen.has(item.runKey)) {
      fail("run keys must uniquely reference existing native cohorts.");
      continue;
    }
    seen.add(item.runKey);
    attempted += run.counts.attempted;
    if (run.observedOn > evidence.reviewedOn) fail("review cannot predate a cohort.");
    if (item.campaignKey !== (run.pacedMeasurement?.campaignKey ?? null)) fail("campaign identity must match the original cohort.");
    if (item.nativeCompletionOffsetsExact !== Boolean(run.pacedMeasurement)) fail("burst proxy clocks cannot be promoted to exact native completion offsets.");
    const totals = item.counts;
    for (const [key, original] of [["dispatched", "attempted"], ["eventualSuccesses", "completed"], ["eventualFailures", "failed"], ["pendingAtEvidenceCutoff", "pending"]]) {
      if (totals[key] !== run.counts[original]) fail("supplemental totals must preserve original reviewed counts.");
    }
    const state = (value) => {
      if (value.settled !== value.successes + value.failures || value.dispatched !== value.settled + value.outstandingClientCalls) fail("client dispatched, settled and outstanding counts must partition.");
      if (value.dispatched > totals.dispatched || value.successes > totals.eventualSuccesses || value.failures > totals.eventualFailures) fail("client snapshot cannot exceed cohort totals.");
      const peak = (run.pacedMeasurement ?? run.nativeInvocation).peakOutstanding;
      if (peak !== null && value.outstandingClientCalls > peak) fail("client snapshot cannot exceed reviewed client peak.");
    };
    const bases = new Map(item.bases.map((basis) => [basis.basis, basis]));
    if (bases.size !== 2) { fail("both distinct coverage bases are required."); continue; }
    const arrival = bases.get("observed_arrival_only").coverage;
    const observation = bases.get("observed_through_drain").coverage;
    if (!observation || Boolean(arrival) !== Boolean(run.pacedMeasurement)) { fail("coverage availability must match the native measurement clock."); continue; }
    for (const [coverage, originalSeconds] of [[arrival, run.pacedMeasurement?.arrivalEndObservedSeconds], [observation, run.windowSeconds]]) {
      if (!coverage) continue;
      range(coverage);
      if (exactOffset(coverage.startOffsetMsExact) !== 0n || Math.abs(coverage.endOffsetMs - originalSeconds * 1000) > 0.00001) fail("coverage must use the original observed clock, not the plan or capped offer duration.");
    }
    if (arrival && exactOffset(arrival.endOffsetMsExact) > exactOffset(observation.endOffsetMsExact)) fail("arrival coverage cannot exceed observation through drain.");
    for (const basis of item.bases) {
      if (JSON.stringify(basis.windows.map((window) => window.durationSeconds)) !== JSON.stringify(windowDurations)) fail("each coverage basis requires all seven ordered requested durations.");
      for (const window of basis.windows) {
        const duration = BigInt(window.durationSeconds * 1000) * exactScale;
        const eligible = basis.coverage !== null && duration <= exactOffset(basis.coverage.durationMsExact);
        if (Boolean(window.dispatchCohortMaximum) !== eligible || Boolean(window.completionMaximum) !== (eligible && item.nativeCompletionOffsetsExact)) {
          fail("maxima require full observed coverage and an eligible exact clock; unavailable must be null.");
          continue;
        }
        for (const maximum of [window.dispatchCohortMaximum, window.completionMaximum]) {
          if (!maximum) continue;
          range(maximum.window);
          if (exactOffset(maximum.window.durationMsExact) !== duration
            || exactOffset(maximum.window.startOffsetMsExact) < exactOffset(basis.coverage.startOffsetMsExact)
            || exactOffset(maximum.window.endOffsetMsExact) > exactOffset(basis.coverage.endOffsetMsExact)) fail("each independent maximum must have the exact requested width inside its coverage.");
          const d = maximum.dispatchCohort;
          if (d.dispatched !== d.eventualSuccesses + d.eventualFailures + d.pendingAtEvidenceCutoff) fail("dispatch cohort outcomes must partition.");
          for (const key of Object.keys(totals)) if (d[key] > totals[key]) fail("selected dispatch cohort cannot exceed its original run.");
          if (!item.nativeCompletionOffsetsExact) {
            if ([maximum.completionsInWindow, maximum.clientStateBeforeWindowStart, maximum.clientStateBeforeWindowEnd, d.successesBeforeWindowEnd, d.failuresBeforeWindowEnd, d.pendingImmediatelyBeforeWindowEnd].some((value) => value !== null)) fail("burst completion/window-local states must remain unavailable.");
            continue;
          }
          const c = maximum.completionsInWindow, before = maximum.clientStateBeforeWindowStart, after = maximum.clientStateBeforeWindowEnd;
          if (!c || !before || !after || [d.successesBeforeWindowEnd, d.failuresBeforeWindowEnd, d.pendingImmediatelyBeforeWindowEnd].some((value) => value === null)) {
            fail("exact paced windows require both count types and boundary snapshots.");
            continue;
          }
          state(before);
          state(after);
          if (c.settled !== c.successes + c.failures || d.dispatched !== after.dispatched - before.dispatched
            || c.successes !== after.successes - before.successes || c.failures !== after.failures - before.failures) fail("window-local completions and dispatches must match the half-open boundary snapshots.");
          if (d.dispatched !== d.successesBeforeWindowEnd + d.failuresBeforeWindowEnd + d.pendingImmediatelyBeforeWindowEnd
            || d.successesBeforeWindowEnd > d.eventualSuccesses || d.failuresBeforeWindowEnd > d.eventualFailures
            || d.successesBeforeWindowEnd > c.successes || d.failuresBeforeWindowEnd > c.failures
            || d.pendingImmediatelyBeforeWindowEnd > after.outstandingClientCalls) fail("dispatch-cohort eventual outcomes and pending at window end are different, reconciled counts.");
        }
        const dispatch = window.dispatchCohortMaximum, completion = window.completionMaximum;
        if (dispatch && completion && (dispatch.dispatchCohort.eventualSuccesses < completion.dispatchCohort.eventualSuccesses
          || completion.completionsInWindow?.successes < dispatch.completionsInWindow?.successes)) fail("independent success maxima cannot be smaller than the paired snapshot's count.");
      }
    }
    if (Boolean(item.firstError) !== (run.counts.failed > 0)) fail("failed cohorts require first-error evidence; error-free cohorts use null.");
    if (item.firstError) {
      bounds(item.firstError.completion);
      state(item.firstError.client);
      if (item.firstError.client.failures !== 1 || !run.errors.some((error) => error.evidence === item.firstError.evidence)) fail("first error must reconcile with the classified original failure evidence.");
      if (item.firstError.completion.precision !== (item.nativeCompletionOffsetsExact ? "exact" : "bounded")
        || exactOffset(item.firstError.completion.upperMsExact) > exactOffset(observation.endOffsetMsExact)) fail("first-error timing must respect clock precision and observation cutoff.");
    }
    const stop = item.safetyTrigger;
    const expectedStop = run.pacedMeasurement?.stopReason;
    if (Boolean(stop) !== Boolean(expectedStop)) fail("first error is not automatically a safety stop.");
    if (stop) {
      bounds(stop.completion);
      bounds(stop.dispatchClose);
      state(stop.client);
      if (stop.reason !== (expectedStop === "explicit_throttle" ? "workiq_mcp_transport_429" : expectedStop)) fail("stop reason must preserve scoped transport or generic-error evidence.");
      if (!item.firstError || !arrival) { fail("a safety trigger requires preceding error and arrival evidence."); continue; }
      if (stop.completion.precision !== "exact" || stop.dispatchClose.precision !== "bounded"
        || exactOffset(stop.completion.lowerMsExact) < exactOffset(item.firstError.completion.lowerMsExact)
        || exactOffset(stop.dispatchClose.lowerMsExact) !== exactOffset(stop.completion.lowerMsExact)
        || exactOffset(stop.dispatchClose.upperMsExact) > exactOffset(arrival.endOffsetMsExact)) fail("trigger callback, bounded dispatch close and observed arrival end must stay distinct and ordered.");
      const after = stop.settlementsAfterTrigger;
      if (stop.client.dispatched !== totals.dispatched || stop.client.successes + after.successes !== totals.eventualSuccesses
        || stop.client.failures + after.failures !== totals.eventualFailures || after.pendingAtFinalCutoff !== totals.pendingAtEvidenceCutoff
        || after.successes + after.failures + after.pendingAtFinalCutoff !== stop.client.outstandingClientCalls) fail("already-admitted drain outcomes must reconcile with trigger and final counts, without later dispatches.");
      if (stop.consecutiveGenericFailures !== (stop.reason === "generic_error_threshold" ? 3 : 0)) fail("generic safety trigger is the third consecutive error, not the final failure count.");
    }
  }
  if (evidence.existingNativeAttemptsAnalyzed !== attempted) fail("analyzed attempts must equal the referenced native cohorts only.");
  return errors;
}

export function assertWindowEvidence(evidence, schema, report) {
  const errors = validateWindowEvidence(evidence, schema, report);
  if (errors.length) throw new Error(`Supplemental evidence rejected: ${errors.join(" ")}`);
  return evidence;
}

export function summarizeReviewedWindows(evidence, report, basisName = "observed_through_drain", runKey = null) {
  if (evidence === null) return [];
  const groups = new Map();
  for (const item of evidence.runs) {
    if (runKey !== null && item.runKey !== runKey) continue;
    const run = report.runs.find((candidate) => candidate.runKey === item.runKey);
    const context = capacityContext(run);
    const key = JSON.stringify(context);
    if (!groups.has(key)) groups.set(key, { context, runs: [], windows: windowDurations.map((seconds) => ({ seconds, dispatch: null, completion: null })) });
    const group = groups.get(key);
    group.runs.push(run);
    const basis = item.bases.find((candidate) => candidate.basis === basisName);
    for (const [index, window] of basis.windows.entries()) {
      for (const [name, field] of [["dispatch", "dispatchCohortMaximum"], ["completion", "completionMaximum"]]) {
        const snapshot = window[field];
        if (!snapshot) continue;
        const successes = name === "dispatch" ? snapshot.dispatchCohort.eventualSuccesses : snapshot.completionsInWindow.successes;
        const current = group.windows[index][name];
        if (!current || successes > current.successes) group.windows[index][name] = {
          runKey: item.runKey, campaignKey: item.campaignKey, successes, snapshot, coverage: basis.coverage
        };
      }
    }
  }
  return [...groups.values()];
}
