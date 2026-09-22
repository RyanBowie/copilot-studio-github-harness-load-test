// A deliberately small, fail-closed JSON Schema interpreter shared by Node and the report.
const supportedKeywords = new Set([
  "$schema", "$id", "$defs", "$ref", "title", "description", "type", "const", "enum",
  "properties", "required", "additionalProperties", "items", "minItems", "maxItems",
  "uniqueItems", "minimum", "maximum", "minLength", "maxLength", "pattern", "anyOf"
]);

function inspectSchema(schema, root = schema) {
  for (const key of Object.keys(schema)) {
    if (!supportedKeywords.has(key)) throw new Error(`Unsupported schema keyword: ${key}`);
  }
  if (schema.$ref && (!schema.$ref.startsWith("#/$defs/") || !root.$defs?.[schema.$ref.slice(8)])) {
    throw new Error("Only existing local $defs references are supported.");
  }
  for (const child of Object.values(schema.$defs ?? {})) inspectSchema(child, root);
  for (const child of Object.values(schema.properties ?? {})) inspectSchema(child, root);
  if (schema.items) inspectSchema(schema.items, root);
  for (const child of schema.anyOf ?? []) inspectSchema(child, root);
}

function matchesType(value, type) {
  if (type === "null") return value === null;
  if (type === "array") return Array.isArray(value);
  if (type === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  if (type === "integer") return Number.isSafeInteger(value);
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  return typeof value === type;
}

function checkShape(value, rule, root, path, errors) {
  const fail = (message) => errors.push(`${path}: ${message}`);
  if (rule.$ref) return checkShape(value, root.$defs[rule.$ref.slice(8)], root, path, errors);
  if (rule.anyOf) {
    const valid = rule.anyOf.some((choice) => {
      const choiceErrors = [];
      checkShape(value, choice, root, path, choiceErrors);
      return choiceErrors.length === 0;
    });
    if (!valid) fail("does not match an allowed shape (including nested fields).");
    return;
  }
  if (rule.type && !matchesType(value, rule.type)) {
    fail(`must be ${rule.type}.`);
    return;
  }
  if ("const" in rule && value !== rule.const) fail("must match the contract constant.");
  if (rule.enum && !rule.enum.includes(value)) fail("is not an allowed value.");
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail("must be finite.");
    if (rule.minimum !== undefined && value < rule.minimum) fail(`must be >= ${rule.minimum}.`);
    if (rule.maximum !== undefined && value > rule.maximum) fail(`must be <= ${rule.maximum}.`);
  }
  if (typeof value === "string") {
    if (rule.minLength !== undefined && value.length < rule.minLength) fail("is too short.");
    if (rule.maxLength !== undefined && value.length > rule.maxLength) fail("is too long.");
    if (rule.pattern && !new RegExp(rule.pattern).test(value)) fail("has an unsupported format.");
  }
  if (Array.isArray(value)) {
    if (rule.minItems !== undefined && value.length < rule.minItems) fail("has too few items.");
    if (rule.maxItems !== undefined && value.length > rule.maxItems) fail("has too many items.");
    if (rule.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) fail("has duplicates.");
    if (rule.items) value.forEach((item, index) => checkShape(item, rule.items, root, `${path}[${index}]`, errors));
  }
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    for (const key of rule.required ?? []) {
      if (!Object.hasOwn(value, key)) fail(`missing required field ${key}.`);
    }
    for (const [key, item] of Object.entries(value)) {
      if (Object.hasOwn(rule.properties ?? {}, key)) checkShape(item, rule.properties[key], root, `${path}.${key}`, errors);
      // Do not echo unknown keys: they may themselves contain private content.
      else if (rule.additionalProperties === false) fail("contains an unknown field.");
    }
  }
}

export function validateAggregateShape(value, schema, path = "aggregate") {
  inspectSchema(schema);
  const errors = [];
  checkShape(value, schema, schema, path, errors);
  return errors;
}

function checkPublicStrings(value, path, errors) {
  if (typeof value === "string") {
    const isDocumentationUrl = /^report\.documentedLimits\[\d+\]\.sourceUrl$/.test(path);
    const identifiers = /@|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{32}|\b(?:gh[pousr]_|github_pat_|Bearer\b)|(?:sharepoint|onmicrosoft)\.com|\b(?:token|password|secret)\s*[=:]/i;
    const webAddress = /(?:https?:|www\.|[a-z0-9-]+\.(?:com|org|net|io|dev|co|uk)\b)/i;
    const placeholder = /^(?:n\/?a|tbd|todo|test|example|placeholder|synthetic|pending|unknown|not measured)$/i;
    const publicLabel = /\.(?:model|agentVersion)$/.test(path);
    if (identifiers.test(value) || (!isDocumentationUrl && webAddress.test(value)) || (publicLabel && placeholder.test(value))) {
      errors.push(`${path}: potential private content or placeholder; use null for unknown labels.`);
    }
  } else if (value !== null && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      checkPublicStrings(item, Array.isArray(value) ? `${path}[${key}]` : `${path}.${key}`, errors);
    }
  }
}

function checkInvocationTimings(invocation, counts, windowSeconds, path, fail) {
  const groups = [["success", counts.completed], ["failure", counts.failed], ["allOutcomes", counts.completed + counts.failed]];
  for (const [field, count] of groups) {
    const summary = invocation[field];
    const summaryPath = `${path}.${field}`;
    if (count === 0) {
      if (summary !== null) fail(summaryPath, "no outcomes must use null, not a fabricated sample.");
      continue;
    }
    if (summary === null) { fail(summaryPath, "requires timing for the observed outcome group."); continue; }
    if (summary.sampleCount !== count) fail(summaryPath, "samples must match this outcome group's count exactly.");
    if ((summary.minMs !== null && summary.minMs > summary.p50Ms) || summary.p50Ms > summary.p95Ms || summary.p95Ms > summary.maxMs) {
      fail(summaryPath, "must satisfy min <= p50 <= p95 <= max where min is known.");
    }
    if (summary.maxMs > windowSeconds * 1000) fail(summaryPath, "invocation duration cannot exceed the calibrated batch window.");
    if (summary.sampleCount === 1 && (summary.p50Ms !== summary.p95Ms || summary.p95Ms !== summary.maxMs || (summary.minMs !== null && summary.minMs !== summary.maxMs))) {
      fail(summaryPath, "one sample requires equal timing values.");
    }
    if (invocation.percentileMethod === "nearest_rank" && Math.ceil(summary.sampleCount * 0.95) === summary.sampleCount && summary.p95Ms !== summary.maxMs) {
      fail(summaryPath, "nearest-rank p95 must equal max for fewer than 20 samples.");
    }
  }
  const presentGroups = [invocation.success, invocation.failure].filter((value) => value !== null);
  if (invocation.allOutcomes && presentGroups.length) {
    if (invocation.allOutcomes.maxMs !== Math.max(...presentGroups.map((group) => group.maxMs))) {
      fail(`${path}.allOutcomes`, "all-outcome max must equal the maximum across outcome groups.");
    }
    if (invocation.allOutcomes.minMs !== null && presentGroups.every((group) => group.minMs !== null)
      && invocation.allOutcomes.minMs !== Math.min(...presentGroups.map((group) => group.minMs))) {
      fail(`${path}.allOutcomes`, "all-outcome min must match the outcome groups when all minima are known.");
    }
  }
}

function checkQuotaStudy(run, path, fail, checkDate) {
  const study = run.quotaStudyMeasurement, counts = run.counts, clock = study.phaseClock;
  if (run.pacedMeasurement || run.rampMeasurement || run.nativeInvocation !== null || run.workload !== "single_turn" || run.workflow !== "not_involved"
    || run.clientIssues.length || [run.workflowState, run.followUp, run.firstVisibleActivity, run.firstVisibleLatency, run.latency, run.arrival, run.concurrency].some((value) => value !== null)) {
    fail(path, "quota study must remain a separate native greeting phase, not a burst, ramp, qualified paced cohort or visible/workflow measurement.");
  }
  if (counts.pending !== 0 || counts.failed !== 1 || run.errors.length !== 1 || run.errors[0].evidence !== "native_disconnected_no_conversation"
    || run.units.conversations !== counts.completed || study.peakOutstanding > counts.attempted) {
    fail(path, "this interrupted-study shape requires settled greetings, one missing-ID disconnected invocation and verified returned conversations; no provider throttle.");
  }
  if (counts.attempted + study.unofferedLoadSlots !== study.plannedLoadSlots || counts.attempted + study.unusedStudyCeiling !== study.studyRequestCeiling) {
    fail(path, "actual attempts and unoffered phase slots / unused study ceiling must reconcile separately; identity reads are not greetings.");
  }
  if (run.windowSeconds === null || Math.abs((clock.arrivalEndOffsetMs - clock.startOffsetMs) / 1000 - study.arrivalSeconds) > 0.000001
    || Math.abs((clock.drainEndOffsetMs - clock.arrivalEndOffsetMs) / 1000 - study.drainSeconds) > 0.000001
    || Math.abs((clock.drainEndOffsetMs - clock.startOffsetMs) / 1000 - run.windowSeconds) > 0.000001
    || study.arrivalSeconds >= study.plannedArrivalSeconds || clock.arrivalObservationLoopEndOffsetMs < clock.arrivalEndOffsetMs
    || clock.arrivalObservationLoopEndOffsetMs > clock.drainEndOffsetMs || study.studyFinishedOffsetMs < clock.drainEndOffsetMs
    || study.studyFinishedOffsetMs > study.maximumStudySeconds * 1000) {
    fail(path, "partial phase, dispatch close, local observation loop, drain and study finish must retain their ordered monotonic intervals.");
  }
  const quiet = study.initialQuietEvidence;
  for (const value of [study.startedAt, study.arrivalEndedAt, study.observedThroughAt, study.studyFinishedAt,
    quiet.previousControlledRunFinishedAt, quiet.earliestPermittedIdentityAt, quiet.initialIdentityCompletedAt]) {
    const instant = new Date(value);
    if (Number.isNaN(instant.valueOf()) || instant.toISOString() !== value) fail(path, "study clock markers must be real millisecond UTC instants.");
    checkDate(value.slice(0, 10), path);
  }
  if (study.startedAt >= study.arrivalEndedAt || study.arrivalEndedAt > study.observedThroughAt || study.observedThroughAt > study.studyFinishedAt
    || study.studyFinishedAt.slice(0, 10) !== run.observedOn
    || Date.parse(quiet.earliestPermittedIdentityAt) - Date.parse(quiet.previousControlledRunFinishedAt) !== study.minimumControlledQuietSeconds * 1000
    || quiet.initialIdentityCompletedAt < quiet.earliestPermittedIdentityAt || quiet.initialIdentityCompletedAt > study.startedAt) {
    fail(path, "ordered UTC phase markers and controlled-client quiet eligibility must not imply tenant-wide quiet or a reset.");
  }
  const paired = study.pairedClockEvidence;
  if (paired.maximumStartReadDeltaMs >= paired.allowedReadDeltaLessThanMs || paired.maximumCompletionReadDeltaMs >= paired.allowedReadDeltaLessThanMs) {
    fail(path, "separately sampled paired-clock deltas must stay strictly below their reviewed allowance; do not require decimal equality.");
  }
  const durations = new Set();
  for (const window of study.rollingDispatchWindows) {
    if (durations.has(window.windowSeconds)) fail(path, "rolling study window durations must be unique.");
    durations.add(window.windowSeconds);
    if (window.startsRepresentativeSeconds + window.windowSeconds > study.arrivalSeconds
      || window.greetingsRepresentativeSeconds + window.windowSeconds > study.arrivalSeconds
      || window.maximumStarts !== window.startsWindowCounts.attempted
      || window.maximumEventualGreetings !== window.greetingsWindowCounts.completed
      || window.greetingsWindowCounts.attempted > window.maximumStarts
      || window.startsWindowCounts.completed > window.maximumEventualGreetings) {
      fail(path, "independently selected rolling dispatch populations require full coverage and consistent start/greeting maxima.");
    }
    for (const population of [window.startsWindowCounts, window.greetingsWindowCounts]) {
      if (population.attempted !== population.completed + population.failed + population.pending
        || Object.keys(population).some((key) => population[key] > counts[key])) {
        fail(path, "rolling window eventual outcomes must partition its dispatches and fit the whole phase; never infer callback throughput.");
      }
    }
  }
  checkInvocationTimings(study, counts, run.windowSeconds, path, fail);
}

function checkRampDispatchWindows(run, path, fail, checkDate) {
  const ramp = run.rampMeasurement, evidence = ramp.dispatchWindowEvidence;
  checkDate(evidence.reviewedOn, `${path}.reviewedOn`);
  if (evidence.reviewedOn < run.observedOn || ramp.clockStatus !== "verified_clean" || ramp.evidenceStatus !== "verified_complete") {
    fail(path, "reviewed dispatch windows require clean complete clock/evidence and review no earlier than the observation.");
  }
  const durations = new Set();
  for (const window of evidence.windows) {
    if (durations.has(window.windowSeconds)) fail(path, "dispatch window durations must be unique.");
    durations.add(window.windowSeconds);
    if (window.windowSeconds > ramp.arrivalSeconds || window.representativeEndSeconds > ramp.arrivalSeconds
      || Math.abs(window.representativeEndSeconds - window.representativeStartSeconds - window.windowSeconds) > 0.000001) {
      fail(path, "representative rolling windows must have full observed arrival coverage and exact duration; partial windows cannot be normalized.");
    }
    const fixedBuckets = window.windowSeconds === 600
      ? ramp.segments.map((segment) => ({ durationSeconds: segment.durationSeconds, attempted: segment.counts.attempted }))
      : ramp.minutes ?? [];
    if (window.maximumStarts > run.counts.attempted
      || fixedBuckets.some((bucket) => bucket.durationSeconds === window.windowSeconds && bucket.attempted > window.maximumStarts)) {
      fail(path, "rolling dispatch maximum must fit total starts and be at least each fully observed fixed-bucket count.");
    }
  }
  const minute = evidence.windows.find((window) => window.windowSeconds === 60);
  const tenMinutes = evidence.windows.find((window) => window.windowSeconds === 600);
  if (minute && tenMinutes && (tenMinutes.maximumStarts < minute.maximumStarts || tenMinutes.maximumStarts > 10 * minute.maximumStarts)) {
    fail(path, "nested full-window dispatch maxima must reconcile across 60 and 600 seconds.");
  }
}

function checkRampMeasurement(run, path, fail, checkDate) {
  const ramp = run.rampMeasurement;
  const { attempted, completed, failed, pending } = run.counts;
  if (run.nativeInvocation !== null || run.pacedMeasurement || run.quotaStudyMeasurement || run.workload !== "single_turn" || run.workflow !== "not_involved"
    || run.clientIssues.length || [run.workflowState, run.followUp, run.firstVisibleActivity, run.firstVisibleLatency, run.latency, run.arrival, run.concurrency].some((value) => value !== null)) {
    fail(path, "one continuous native greeting ramp cannot also be a burst, fixed-rate cohort, workflow or visible/UI measurement.");
  }
  if (run.windowSeconds === null || Math.abs(run.windowSeconds - ramp.arrivalEndObservedSeconds - ramp.drainSeconds) > 0.000001
    || ramp.arrivalEndObservedSeconds + 0.000001 < ramp.arrivalSeconds) {
    fail(path, "ramp observation must retain its actual arrival-end offset and final drain, separate from the fixed horizon.");
  }
  if (ramp.arrivalLoopEndObservedSeconds !== undefined && (ramp.arrivalLoopEndObservedSeconds < ramp.arrivalEndObservedSeconds
    || ramp.arrivalLoopEndObservedSeconds > run.windowSeconds)) fail(path, "observation-loop end must stay between dispatch close and final cutoff, not extend arrivals.");
  for (const field of ["startedAt", "arrivalEndedAt", "observedThroughAt"]) {
    const instant = new Date(ramp[field]);
    if (Number.isNaN(instant.valueOf()) || instant.toISOString() !== ramp[field]) fail(`${path}.${field}`, "must be a real millisecond UTC instant.");
    checkDate(ramp[field].slice(0, 10), `${path}.${field}`);
  }
  if (ramp.startedAt >= ramp.arrivalEndedAt || ramp.arrivalEndedAt > ramp.observedThroughAt
    || ramp.observedThroughAt.slice(0, 10) !== run.observedOn) fail(path, "ramp UTC markers must be ordered and end on the observation date.");
  if (attempted + ramp.unusedRequestBudget !== ramp.requestCeiling) fail(path, "actual ramp attempts and unused ceiling must partition 2250; unused budget is not failed traffic.");
  if (ramp.arrivalStatus === "full_window") {
    if (ramp.arrivalSeconds !== 3600 || ramp.stopReason !== null) fail(path, "a full ramp arrival window requires 3600 seconds and no early stop, not 2250 dispatches.");
  } else if (ramp.stopReason === null || (ramp.arrivalStatus === "partial" && (ramp.arrivalSeconds >= 3600 || ramp.stopReason !== "observation_cutoff"))) {
    fail(path, "a stopped/partial ramp needs a reviewed reason; partial is an early observation cutoff.");
  }
  if ((ramp.drainStatus === "complete") !== (pending === 0)) fail(path, "complete ramp drain requires no pending invocations.");
  if (ramp.pacing.violatingIntervals > attempted - 1) fail(path, "ramp pacing violations cannot exceed actual inter-dispatch gaps.");
  if (ramp.pacing.violatingIntervals > 0 && !["client_pacing", "safety"].includes(ramp.stopReason)) fail(path, "measured ramp pacing violations require an explicit safety stop, not ordinary-error continuation.");
  if ((ramp.peakOutstanding === null) !== (ramp.concurrencyVerification === null) || ramp.peakOutstanding > attempted) {
    fail(path, "ramp client peak needs matching measurement evidence and cannot exceed actual attempts.");
  }
  if ((run.units.conversations === null) !== (ramp.conversationEvidence === null)
    || (ramp.failedConversations !== null && (run.units.conversations === null || ramp.failedConversations > failed || ramp.failedConversations > run.units.conversations))) {
    fail(path, "ramp conversation counts require explicit returned-ID evidence; fresh-request intent is not a count.");
  }
  const noId = run.errors.filter((error) => ["workiq_mcp_transport_429", "native_disconnected_no_conversation", "native_http_429_no_conversation"].includes(error.evidence)).reduce((sum, error) => sum + error.count, 0);
  if ((run.units.conversations !== null && run.units.conversations > attempted - noId)
    || (ramp.failedConversations !== null && ramp.failedConversations > failed - noId)) {
    fail(path, "ramp transport 429/disconnected evidence has no returned conversation identifier; remote admission is unknown.");
  }
  if (ramp.stopReason === "explicit_throttle" && !run.errors.some((error) => error.category === "throttling")) fail(path, "an explicit ramp throttle stop needs classified evidence.");
  if (ramp.stopReason === "authentication" && !run.errors.some((error) => error.category === "authentication")) fail(path, "an authentication ramp stop needs classified evidence.");
  if (ramp.stopEvidence) {
    const event = ramp.stopEvidence, atStop = event.countsAtDecision;
    if (ramp.stopReason !== "explicit_throttle" || !run.errors.some((error) => error.evidence === "native_http_429_no_conversation")
      || event.triggeringAttempt > attempted || event.callbackFromArrivalStartMs > event.decisionFromArrivalStartMs
      || Math.abs(event.decisionFromArrivalStartMs - ramp.arrivalEndObservedSeconds * 1000) > 0.00001
      || event.nativeDurationMs > event.callbackFromArrivalStartMs || !ramp.failure
      || event.nativeDurationMs < ramp.failure.minMs || event.nativeDurationMs > ramp.failure.maxMs) {
      fail(path, "native HTTP 429 stop evidence must match its failed attempt, native duration, callback and dispatch-close decision.");
    }
    if (atStop.attempted !== attempted || atStop.attempted !== atStop.completed + atStop.failed + atStop.pending
      || atStop.failed < 1 || atStop.failed > failed || atStop.completed > completed || atStop.pending < pending
      || atStop.pending > (ramp.peakOutstanding ?? ramp.configuredClientCap)) {
      fail(path, "stop snapshot must reconcile to final outcomes with no new dispatches after the safety decision.");
    }
  }
  const before = ramp.successfulWithinArrivalWindow, after = ramp.successfulAfterArrivalWindow;
  if ((before === null) !== (after === null) || (before !== null && before + after !== completed)) {
    fail(path, "ramp completion-time populations must be paired and partition eventual successes, not dispatch-segment outcomes.");
  }
  if (pending + (after ?? 0) > (ramp.peakOutstanding ?? ramp.configuredClientCap)) {
    fail(path, "post-arrival successes and final pending cannot exceed the observed client peak or configured bound.");
  }
  if (ramp.segments.length !== Math.ceil(ramp.arrivalSeconds / 600)) fail(path, "ramp segments must cover only the observed prefix; no unattempted future segment records.");
  const totals = { attempted: 0, completed: 0, failed: 0, pending: 0 };
  ramp.segments.forEach((segment, index) => {
    const expectedRate = 25 + index * 5;
    if (segment.offsetSeconds !== index * 600 || segment.targetRpm !== expectedRate || segment.nominalRequests !== expectedRate * 10
      || Math.abs(segment.durationSeconds - Math.min(600, ramp.arrivalSeconds - index * 600)) > 0.000001) {
      fail(`${path}.segments[${index}]`, "ramp segments must follow 25/30/35/40/45/50 at contiguous 600-second offsets, with only the last segment partial.");
    }
    if (segment.durationSeconds < 600 && segment.outstandingAtEnd !== null) fail(path, "an unobserved nominal segment-end boundary must remain unknown.");
    const counts = segment.counts;
    if (counts.attempted !== counts.completed + counts.failed + counts.pending) {
      fail(path, "segment outcomes must partition actual dispatches; nominal allocations are not failure denominators.");
    }
    if (segment.nativeTimings) checkInvocationTimings(segment.nativeTimings, counts, run.windowSeconds, `${path}.segments[${index}].nativeTimings`, fail);
    if (segment.completionPopulations && (segment.completionPopulations.withinNominalWindow + segment.completionPopulations.afterNominalWindow !== counts.completed
      || segment.completionPopulations.allDispatchesWithinObservedWindow > completed)) {
      fail(path, "segment completion populations must preserve own nominal-window outcomes versus all-dispatch observed-window completions.");
    }
    if (segment.distinctReturnedConversations != null && segment.distinctReturnedConversations > counts.attempted) {
      fail(path, "distinct segment conversations cannot exceed that dispatch cohort's attempts.");
    }
    if (segment.dispatchCohortPeakOutstanding != null && (segment.dispatchCohortPeakOutstanding > counts.attempted
      || segment.dispatchCohortPeakOutstanding < counts.pending || (counts.attempted > 0 && segment.dispatchCohortPeakOutstanding === 0)
      || (ramp.peakOutstanding !== null && segment.dispatchCohortPeakOutstanding > ramp.peakOutstanding))) {
      fail(path, "dispatch-cohort client peak must fit its actual attempts, final pending and whole-run client peak.");
    }
    if (segment.outstandingAtStart !== null && (segment.outstandingAtStart > totals.attempted || segment.outstandingAtStart < totals.pending
      || (ramp.peakOutstanding !== null && segment.outstandingAtStart > ramp.peakOutstanding)
      || (index && ramp.segments[index - 1].outstandingAtEnd !== null && segment.outstandingAtStart !== ramp.segments[index - 1].outstandingAtEnd))) {
      fail(path, "adjacent ramp boundaries share outstanding calls; no invented inter-segment drain or reset.");
    }
    for (const field of Object.keys(totals)) totals[field] += counts[field];
    if (segment.outstandingAtEnd !== null && (segment.outstandingAtEnd > totals.attempted
      || segment.outstandingAtEnd < totals.pending || (ramp.peakOutstanding !== null && segment.outstandingAtEnd > ramp.peakOutstanding)
      || (segment.outstandingAtStart !== null && segment.outstandingAtEnd > segment.outstandingAtStart + counts.attempted))) {
      fail(path, "ramp boundary outstanding counts must fit actual calls, final pending and observed client peak.");
    }
  });
  if (Object.keys(totals).some((field) => totals[field] !== run.counts[field])) fail(path, "ramp segment outcomes must sum to the one run at its final cutoff.");
  if (before !== null && ramp.segments.every((segment) => segment.completionPopulations)
    && ramp.segments.reduce((sum, segment) => sum + segment.completionPopulations.allDispatchesWithinObservedWindow, 0) !== before) {
    fail(path, "all-dispatch observed-segment completions must partition the whole arrival-window completion count.");
  }
  if (ramp.minutes) {
    if (ramp.minutes.length !== Math.ceil(ramp.arrivalSeconds / 60)) fail(path, "ramp minutes must cover only the observed prefix.");
    const segmentTotals = ramp.segments.map(() => ({ attempted: 0, completed: 0, failed: 0, pending: 0 }));
    ramp.minutes.forEach((minute, index) => {
      if (minute.offsetSeconds !== index * 60 || Math.abs(minute.durationSeconds - Math.min(60, ramp.arrivalSeconds - index * 60)) > 0.000001
        || minute.attempted !== minute.completed + minute.failed + minute.pending) fail(path, "ramp minutes must be contiguous actual dispatch outcomes with only the final bucket partial.");
      const segment = segmentTotals[Math.floor(index / 10)];
      if (segment) for (const field of Object.keys(segment)) segment[field] += minute[field];
    });
    if (segmentTotals.some((counts, index) => Object.keys(counts).some((field) => counts[field] !== ramp.segments[index].counts[field]))) {
      fail(path, "ramp minute outcomes must reconcile to their containing rate segments.");
    }
  }
  if (run.units.conversations !== null && ramp.segments.every((segment) => segment.distinctReturnedConversations != null)
    && ramp.segments.reduce((sum, segment) => sum + segment.distinctReturnedConversations, 0) !== run.units.conversations) {
    fail(path, "all known segment conversation counts must sum to the distinct whole-run count.");
  }
  if (ramp.segments.every((segment) => segment.nativeTimings)) {
    for (const field of ["success", "failure", "allOutcomes"]) {
      const groups = ramp.segments.map((segment) => segment.nativeTimings[field]).filter((value) => value !== null);
      if (groups.length && ramp[field] && (ramp[field].maxMs !== Math.max(...groups.map((group) => group.maxMs))
        || (ramp[field].minMs !== null && groups.every((group) => group.minMs !== null) && ramp[field].minMs !== Math.min(...groups.map((group) => group.minMs))))) {
        fail(path, "whole-run extrema must reconcile to measured segment populations; percentiles are never averaged.");
      }
    }
  }
  const lastOutstanding = ramp.segments.at(-1).outstandingAtEnd;
  if (lastOutstanding !== null && after !== null && after + pending > lastOutstanding) fail(path, "post-arrival successful returns and final pending must fit the last observed boundary.");
  if (ramp.dispatchWindowEvidence) checkRampDispatchWindows(run, `${path}.dispatchWindowEvidence`, fail, checkDate);
  checkInvocationTimings(ramp, run.counts, run.windowSeconds, path, fail);
}

function checkPacedMeasurement(run, path, fail, checkDate) {
  const paced = run.pacedMeasurement;
  const { attempted, completed, failed, pending } = run.counts;
  if (run.nativeInvocation !== null || run.rampMeasurement || run.quotaStudyMeasurement || run.workload !== "single_turn" || run.workflow !== "not_involved" || run.clientIssues.length
    || [run.workflowState, run.followUp, run.firstVisibleActivity, run.firstVisibleLatency, run.latency, run.arrival, run.concurrency].some((value) => value !== null)) {
    fail(path, "paced greeting cohorts exclude burst records, workflow requests, unsent drafts and visible/UI measurements.");
  }
  if (run.windowSeconds === null || Math.abs(run.windowSeconds - paced.arrivalEndObservedSeconds - paced.drainSeconds) > 0.000001) {
    fail(path, "full observation window must equal measured arrival-end offset plus drain seconds, not the scheduled offer window.");
  }
  for (const field of ["startedAt", "arrivalEndedAt", "observedThroughAt"]) {
    const value = paced[field];
    const instant = new Date(value);
    if (Number.isNaN(instant.valueOf()) || instant.toISOString() !== value) fail(`${path}.${field}`, "must be a real millisecond UTC instant.");
    checkDate(value.slice(0, 10), `${path}.${field}`);
  }
  if (paced.startedAt >= paced.arrivalEndedAt || paced.arrivalEndedAt > paced.observedThroughAt || paced.observedThroughAt.slice(0, 10) !== run.observedOn) {
    fail(path, "UTC arrival and observation markers must be ordered and end on the run observation date.");
  }
  const minuteRetest = paced.phase === "minute_retest";
  const countRetest = paced.phase === "count_retest";
  const countBaseline = paced.phase === "count_baseline";
  const countBound = countRetest || countBaseline;
  const countThrough = minuteRetest || countBound;
  const capacityStage = ["capacity_screen", "capacity_hour"].includes(paced.phase);
  const plannedSeconds = countBaseline || paced.phase === "capacity_screen" ? 300 : countThrough ? 60 : ["hour", "capacity_hour"].includes(paced.phase) ? 3600 : 120;
  if (!(capacityStage ? [25, 30, 35, 40, 45, 50] : [10, 25, 50, 100, 150]).includes(paced.targetRpm)) {
    fail(path, "intended rate must belong to this phase's protocol, not another study.");
  }
  if (paced.plannedArrivalSeconds !== plannedSeconds || paced.plannedSlots !== paced.targetRpm * plannedSeconds / 60) {
    fail(path, "planned slots must match the phase duration and intended rate.");
  }
  if (countThrough) {
    if (paced.targetRpm !== (countBaseline ? 25 : 100) || paced.genericErrorPolicy !== "count_without_early_stop"
      || ["generic_error_threshold", "native_error"].includes(paced.stopReason)) {
      fail(path, countBaseline
        ? "count baseline requires 125 planned requests at 25 intended RPM and counts ordinary errors without an early generic-error stop."
        : "retest is a bounded 100-request plan that counts generic errors without an early generic-error stop.");
    }
    if (minuteRetest && paced.arrivalStatus === "full_window" && paced.arrivalEndObservedSeconds < 60) {
      fail(path, "a full minute retest requires at least 60 seconds of observed arrival coverage, not merely 100 dispatches.");
    }
  } else if (Object.hasOwn(paced, "genericErrorPolicy")) {
    fail(path, "the count-through-generic-errors policy belongs only to a separate retest or baseline, not historical calibrations or hours.");
  }
  if ((!countBound && paced.arrivalSeconds > plannedSeconds) || attempted + paced.skippedSlots + paced.unofferedSlots !== paced.plannedSlots) {
    fail(path, "attempted, skipped and unoffered slots must partition the bounded plan.");
  }
  if (countBound && paced.arrivalStatus === "full_window") {
    fail(path, "a count-bound cohort records count completion, not a fixed full-minute or five-minute window.");
  } else if (paced.arrivalStatus === "count_complete") {
    if (!countBound || attempted !== (countBaseline ? 125 : 100) || paced.skippedSlots !== 0 || paced.unofferedSlots !== 0 || paced.stopReason !== null) {
      fail(path, "count completion requires every actual dispatch in its exact bounded plan, no unused slots and no stop reason.");
    }
  } else if (paced.arrivalStatus === "full_window") {
    if (paced.arrivalSeconds !== plannedSeconds || paced.unofferedSlots !== 0 || paced.stopReason !== null) {
      fail(path, "full arrival window requires its full duration, no unoffered slots and no stop reason.");
    }
  } else if (paced.stopReason === null || (paced.arrivalStatus === "partial" && ((!countBound && paced.arrivalSeconds >= plannedSeconds) || paced.stopReason !== "observation_cutoff"))) {
    fail(path, "stopped/partial arrivals require an explicit reason; partial is an early observation cutoff.");
  }
  if ((paced.drainStatus === "complete") !== (pending === 0)) fail(path, "complete drain requires no pending invocations; cutoff retains pending outcomes.");
  const pacing = paced.pacing;
  if (Math.abs(pacing.intervalMs - 60000 / paced.targetRpm) > 0.000001) fail(path, "dispatch interval must match intended RPM.");
  if (countBound) {
    if (pacing.schedule !== "dispatch_rebased" || pacing.missedSlotPolicy !== "defer_without_catchup" || pacing.jitterAllowance !== 0
      || paced.skippedSlots !== 0 || Math.abs(paced.arrivalSeconds - paced.arrivalEndObservedSeconds) > 0.000001) {
      fail(path, "count-bound pacing requires actual-dispatch rebasing, no catch-up, no skipped slots or jitter allowance, and actual arrival-close duration.");
    }
    if (attempted > 1 && (pacing.observedMinIntervalMs === null
      || paced.arrivalSeconds * 1000 + 0.000001 < (attempted - 1) * pacing.observedMinIntervalMs)) {
      fail(path, "count-bound duration must contain the observed dispatch intervals; measured minimum spacing is required.");
    }
  } else if (pacing.schedule !== "absolute_slots" || pacing.missedSlotPolicy !== "skip_without_replay" || pacing.jitterAllowance !== 0.05) {
    fail(path, "historical fixed-window phases retain absolute slots, skip-without-replay and the 5% allowance.");
  }
  if ((pacing.observedMinIntervalMs === null) !== (pacing.violatingIntervals === null)
    || (attempted < 2 && pacing.observedMinIntervalMs !== null) || pacing.violatingIntervals > attempted - 1) {
    fail(path, "observed inter-dispatch evidence must be paired and bounded by actual intervals.");
  }
  const minAllowed = pacing.intervalMs * (1 - pacing.jitterAllowance);
  if (pacing.observedMinIntervalMs !== null && ((pacing.observedMinIntervalMs < minAllowed) !== (pacing.violatingIntervals > 0))) {
    fail(path, "pacing violations must agree with the measured minimum and declared allowance.");
  }
  if ((paced.peakOutstanding === null) !== (paced.concurrencyVerification === null) || paced.peakOutstanding > attempted) {
    fail(path, "client peak requires measured verification (interval-sweep or reviewed client peak) and cannot exceed attempts.");
  }
  if ((run.units.conversations === null) !== (paced.conversationEvidence === null)
    || (paced.failedConversations !== null && (paced.failedConversations > failed || run.units.conversations === null || paced.failedConversations > run.units.conversations))) {
    fail(path, "returned conversation evidence must match known counts; fresh-request policy is not an observed count.");
  }
  const transport429 = run.errors.filter((error) => error.evidence === "workiq_mcp_transport_429").reduce((sum, error) => sum + error.count, 0);
  const disconnected = run.errors.filter((error) => error.evidence === "native_disconnected_no_conversation").reduce((sum, error) => sum + error.count, 0);
  if ((run.units.conversations !== null && run.units.conversations > attempted - transport429 - disconnected)
    || (paced.failedConversations !== null && paced.failedConversations > failed - transport429 - disconnected)) {
    fail(path, "WorkIQ MCP transport 429 or disconnected evidence has no returned conversation identifier; do not infer one from the attempt.");
  }
  if (paced.stopReason === "explicit_throttle" && !run.errors.some((error) => error.category === "throttling")) {
    fail(path, "an explicit throttle stop needs classified throttle evidence, not a generic invocation error.");
  }
  if (paced.stopReason === "authentication" && !run.errors.some((error) => error.category === "authentication")) {
    fail(path, "an authentication stop needs classified authentication evidence.");
  }
  if (paced.stopReason === "generic_error_threshold" && (paced.arrivalStatus !== "stopped"
    || !run.errors.some((error) => error.evidence === "unclassified_invocation_failure")
    || run.errors.some((error) => ["authentication", "throttling"].includes(error.category)))) {
    fail(path, "a generic-error safety stop requires unclassified invocation failures, not an authentication or throttle claim.");
  }
  const canQualify = paced.arrivalStatus === "full_window" && paced.drainStatus === "complete"
    && attempted === paced.plannedSlots && completed * 100 >= attempted * 99
    && pacing.observedMinIntervalMs !== null && pacing.violatingIntervals === 0
    && !run.errors.some((error) => ["authentication", "throttling"].includes(error.category));
  if (capacityStage) {
    const evidence = paced.capacityEvidence;
    if (!evidence) {
      fail(path, "capacity stages require explicit clock and evidence verification; no success-shaped defaults.");
    } else {
      const before = evidence.successfulWithinArrivalWindow;
      const after = evidence.successfulAfterArrivalWindow;
      if ((before === null) !== (after === null) || (before !== null && before + after !== completed)) {
        fail(path, "inside/after-window successful-completion counts must be paired and partition eventual successes.");
      }
      if ((evidence.pendingAtClose === null) !== (evidence.postCloseNativeReturns === null)
        || evidence.pendingAtClose > attempted || evidence.postCloseNativeReturns > evidence.pendingAtClose
        || (evidence.pendingAtClose !== null && evidence.pendingAtClose !== evidence.postCloseNativeReturns + pending)
        || (evidence.postCloseActivity === "local_bookkeeping_only" && (evidence.pendingAtClose !== 0 || evidence.postCloseNativeReturns !== 0))
        || (evidence.postCloseActivity === "draining_requests" && !(evidence.pendingAtClose > 0))) {
        fail(path, "post-close activity must reconcile pending calls and native returns; local bookkeeping is not request drain.");
      }
      if (evidence.stopTiming) {
        const timing = evidence.stopTiming;
        const offsets = ["stageStartOffsetMs", "firstDispatchOffsetMs", "firstNonSuccessReturnOffsetMs", "stageDispatchCloseOffsetMs", "arrivalObservationLoopEndOffsetMs", "observationEndOffsetMs", "campaignFinishedOffsetMs"].map((key) => timing[key]);
        if (failed === 0 || paced.stopReason === null || offsets.some((value, index) => index > 0 && value < offsets[index - 1])
          || Math.abs((timing.stageDispatchCloseOffsetMs - timing.stageStartOffsetMs) / 1000 - paced.arrivalEndObservedSeconds) > 0.000001
          || Math.abs((timing.observationEndOffsetMs - timing.stageDispatchCloseOffsetMs) / 1000 - paced.drainSeconds) > 0.000001
          || (attempted === 1 && (paced.failure === null || Math.abs(timing.firstNonSuccessReturnOffsetMs - timing.firstDispatchOffsetMs - paced.failure.maxMs) > 0.000001))
          || (timing.globalSafetyStopTriggered && paced.stopReason === "native_error")) {
          fail(path, "reviewed stop clocks must order and reconcile native return, dispatch close and post-close observation; ordinary screen failure is not a global safety stop.");
        }
        for (const key of ["firstDispatchAt", "firstNonSuccessReturnAt"]) {
          const instant = new Date(timing[key]);
          if (Number.isNaN(instant.valueOf()) || instant.toISOString() !== timing[key] || timing[key] < paced.startedAt || timing[key] > paced.arrivalEndedAt) {
            fail(path, "stop wall-clock markers must be real ordered instants inside stage arrival metadata.");
          }
        }
        if (timing.firstDispatchAt > timing.firstNonSuccessReturnAt) fail(path, "first dispatch cannot follow the first non-success return.");
      }
      const strictlyQualified = canQualify && completed === paced.plannedSlots && failed === 0 && pending === 0
        && paced.skippedSlots === 0 && paced.unofferedSlots === 0 && paced.stopReason === null
        && paced.arrivalEndObservedSeconds >= plannedSeconds
        && run.units.conversations === attempted && paced.conversationEvidence === "returned_ids_checked_unique"
        && paced.failedConversations === 0 && paced.drainSeconds <= 180 && paced.allOutcomes?.maxMs <= 180000
        && evidence.clockStatus === "verified_clean" && evidence.evidenceStatus === "verified_complete";
      if (paced.qualification !== (strictlyQualified ? "qualified" : "not_qualified")) {
        fail(path, "capacity qualification requires every planned greeting, zero failures/pending/skips/unoffered/retries, unique returned conversations, full coverage and verified clean clock/evidence.");
      }
    }
    if ((paced.phase === "capacity_screen") !== (paced.qualifyingRunKey === null)) {
      fail(path, "capacity screens have no qualifying reference; capacity hours reference their own study's clean screen.");
    }
    if (paced.stopReason === "generic_error_threshold"
      || (failed > 0 && !paced.stopReason)
      || (paced.stopReason === "native_error" && (failed === 0 || run.errors.some((error) => ["authentication", "throttling"].includes(error.category))))) {
      fail(path, "capacity stages close on first non-success; ordinary native errors cannot disguise a whole-study safety stop.");
    }
  } else if (countThrough) {
    if (paced.qualification !== "not_evaluated" || paced.qualifyingRunKey !== null) {
      fail(path, "a count-through cohort is not a two-minute calibration or qualification for an hour.");
    }
  } else if (paced.phase === "calibration") {
    if (paced.qualifyingRunKey !== null || (paced.qualification === "qualified" && !canQualify)
      || (paced.qualification === "not_qualified" && canQualify)) {
      fail(path, "calibration qualification requires all slots, >=99% greetings, complete drain and healthy observed pacing.");
    }
  } else if (paced.qualification !== "not_evaluated" || paced.qualifyingRunKey === null) {
    fail(path, "hour cohorts reference a prior qualified calibration, not their own qualification.");
  }
  if (!capacityStage && Object.hasOwn(paced, "capacityEvidence")) {
    fail(path, "capacity evidence belongs only to the distinct zero-error study, not historical calibration or retests.");
  }
  if (countBaseline) {
    const evidence = paced.baselineEvidence;
    if (!evidence) {
      fail(path, "count baseline requires explicit reviewed measurement evidence; unknown stays unknown.");
    } else {
      const before = evidence.successfulWithinArrivalWindow, after = evidence.successfulAfterArrivalWindow;
      if ((before === null) !== (after === null) || (before !== null && before + after !== completed)) {
        fail(path, "baseline before/after-arrival successful counts must be paired and partition eventual successes.");
      }
      const first = evidence.firstFailedAttempt, callback = evidence.firstFailureCallbackFromArrivalStartMs;
      if ((first === null) !== (callback === null) || (first !== null && (failed === 0 || first + failed - 1 > attempted
        || callback > run.windowSeconds * 1000 || callback < paced.failure?.minMs
        || (pacing.observedMinIntervalMs !== null && callback < (first - 1) * pacing.observedMinIntervalMs)))) {
        fail(path, "baseline first failure needs paired actual-attempt/callback evidence within observed timing and failed populations.");
      }
    }
  } else if (Object.hasOwn(paced, "baselineEvidence")) {
    fail(path, "baseline evidence cannot relabel a historical or zero-error study.");
  }
  if (paced.minutes.length !== Math.ceil(paced.arrivalSeconds / 60)) fail(path, "minute buckets must cover exactly the observed arrival duration.");
  const totals = { attempted: 0, completed: 0, failed: 0, pending: 0 };
  paced.minutes.forEach((minute, index) => {
    if (minute.offsetSeconds !== index * 60 || Math.abs(minute.durationSeconds - Math.min(60, paced.arrivalSeconds - index * 60)) > 0.000001) {
      fail(`${path}.minutes[${index}]`, "minute buckets must be contiguous, with only the final bucket partial.");
    }
    if (minute.attempted !== minute.completed + minute.failed + minute.pending) fail(path, "minute outcome counts must partition actual dispatches.");
    for (const key of Object.keys(totals)) totals[key] += minute[key];
  });
  if (Object.keys(totals).some((key) => totals[key] !== run.counts[key])) fail(path, "minute dispatch-cohort totals must equal run outcomes at the same cutoff.");
  checkInvocationTimings(paced, run.counts, run.windowSeconds, path, fail);
}

function checkCapacityStudy(cohorts, fail) {
  const path = "report.runs";
  const ordered = [...cohorts].sort((a, b) => a.pacedMeasurement.startedAt.localeCompare(b.pacedMeasurement.startedAt));
  const screens = ordered.filter((run) => run.pacedMeasurement.phase === "capacity_screen");
  const hours = ordered.filter((run) => run.pacedMeasurement.phase === "capacity_hour");
  if (screens.length + hours.length !== cohorts.length || screens.length > 6 || hours.length > 2 || !screens.length
    || cohorts.reduce((sum, run) => sum + run.pacedMeasurement.plannedSlots, 0) > 7125
    || cohorts.reduce((sum, run) => sum + run.counts.attempted, 0) > 7125) {
    fail(path, "a capacity study contains only up to six screens and two hours within 7125 planned/new attempts.");
  }
  const context = (run) => JSON.stringify([
    run.surface, run.environmentType, run.model, run.agentVersion, run.authenticatedAccounts,
    run.memory, run.workload, run.workflow, run.connectors, run.pacedMeasurement.path, run.pacedMeasurement.endpoint
  ]);
  if (cohorts.some((run) => context(run) !== context(ordered[0]))) {
    fail(path, "capacity qualification cannot cross changes in recorded target configuration.");
  }
  if (Date.parse(ordered.at(-1).pacedMeasurement.observedThroughAt) - Date.parse(ordered[0].pacedMeasurement.startedAt) > 12600000) {
    fail(path, "capacity stage coverage must fit the bounded 12600-second study.");
  }
  const rates = [25, 30, 35, 40, 45, 50];
  screens.forEach((run, index) => {
    if (run.pacedMeasurement.targetRpm !== rates[index]
      || (index > 0 && screens[index - 1].pacedMeasurement.qualification !== "qualified")
      || (hours.length && run.pacedMeasurement.startedAt >= hours[0].pacedMeasurement.startedAt)) {
      fail(path, "capacity screens must follow the ordered rate prefix and stop escalation after any nonqualifying screen, before hours.");
    }
  });
  const eligible = screens.filter((run) => run.pacedMeasurement.qualification === "qualified");
  const selected = eligible.at(-1);
  if (hours.length && screens.length < 6 && screens.at(-1)?.pacedMeasurement.qualification === "qualified") {
    fail(path, "hours follow all six screens or an ordinary screen failure, not an unfinished clean screening sequence.");
  }
  hours.forEach((run, index) => {
    if (!selected || run.pacedMeasurement.qualifyingRunKey !== selected.runKey
      || run.pacedMeasurement.targetRpm !== selected.pacedMeasurement.targetRpm
      || selected.pacedMeasurement.observedThroughAt >= run.pacedMeasurement.startedAt
      || (index > 0 && hours[index - 1].pacedMeasurement.qualification !== "qualified")) {
      fail(path, "both capacity hours must use this study's highest prior clean screen; the second requires a strictly qualified first hour.");
    }
  });
  ordered.slice(0, -1).forEach((run, index) => {
    const paced = run.pacedMeasurement;
    const next = ordered[index + 1];
    if (Date.parse(next.pacedMeasurement.startedAt) - Date.parse(paced.observedThroughAt) < 60000) {
      fail(path, "capacity stages require at least 60 seconds of quiet after the preceding drain, not a claimed quota reset.");
    }
    const ordinaryScreenClose = paced.phase === "capacity_screen" && paced.stopReason === "native_error"
      && run.counts.failed > 0 && next.pacedMeasurement.phase === "capacity_hour";
    if (paced.drainStatus !== "complete" || paced.skippedSlots !== 0
      || (run.counts.attempted > 1 && paced.pacing.violatingIntervals !== 0)
      || paced.drainSeconds > 180 || paced.allOutcomes?.maxMs > 180000
      || paced.capacityEvidence?.clockStatus !== "verified_clean" || paced.capacityEvidence?.evidenceStatus !== "verified_complete"
      || run.errors.some((error) => ["authentication", "throttling"].includes(error.category))
      || (paced.qualification !== "qualified" && !ordinaryScreenClose)
      || (paced.stopReason !== null && !ordinaryScreenClose)) {
      fail(path, "no capacity stage may follow a whole-study safety/evidence/pacing stop or failed hour; only an ordinary screen failure can fall back to an earlier clean screen.");
    }
  });
}

function checkPacedCampaigns(runs, fail) {
  const campaigns = new Map();
  for (const run of runs.filter((item) => item.pacedMeasurement)) {
    const key = run.pacedMeasurement.campaignKey;
    if (!campaigns.has(key)) campaigns.set(key, []);
    campaigns.get(key).push(run);
  }
  for (const cohorts of campaigns.values()) {
    if (cohorts.some((run) => ["capacity_screen", "capacity_hour"].includes(run.pacedMeasurement.phase))) {
      checkCapacityStudy(cohorts, fail);
      continue;
    }
    const calibrations = cohorts.filter((run) => run.pacedMeasurement.phase === "calibration");
    const hours = cohorts.filter((run) => run.pacedMeasurement.phase === "hour");
    if (cohorts.some((run) => ["minute_retest", "count_retest", "count_baseline"].includes(run.pacedMeasurement.phase)) && cohorts.length !== 1) {
      fail("report.runs", "a retest or baseline must be a separate single-cohort campaign; no continuation or pooled calibration.");
    }
    if (cohorts.reduce((sum, run) => sum + run.counts.attempted, 0) > 9670 || hours.length > 1
      || new Set(calibrations.map((run) => run.pacedMeasurement.targetRpm)).size !== calibrations.length) {
      fail("report.runs", "paced campaign permits distinct calibration rates and at most one hour cohort within 9670 requests.");
    }
    const ordered = [...cohorts].sort((a, b) => a.pacedMeasurement.startedAt.localeCompare(b.pacedMeasurement.startedAt));
    if (ordered.some((run, index) => index && ordered[index - 1].pacedMeasurement.observedThroughAt > run.pacedMeasurement.startedAt)) {
      fail("report.runs", "paced cohorts in a campaign must not overlap their arrival/drain windows.");
    }
    for (const run of ordered.slice(0, -1)) {
      const paced = run.pacedMeasurement;
      if (paced.phase === "hour" || paced.arrivalStatus === "partial" || paced.drainStatus !== "complete"
        || ["generic_error_threshold", "explicit_throttle", "authentication", "account_guard", "client_pacing", "client_outstanding_bound", "safety", "request_budget", "manual_stop"].includes(paced.stopReason)
        || paced.pacing.violatingIntervals > 0 || run.errors.some((error) => ["authentication", "throttling"].includes(error.category))) {
        fail("report.runs", "no further cohort may follow a terminal campaign guard, pacing violation, unresolved cutoff or hourly cohort.");
      }
    }
    for (const run of hours) {
      const paced = run.pacedMeasurement;
      const eligible = calibrations.filter((item) => item.pacedMeasurement.qualification === "qualified"
        && item.pacedMeasurement.observedThroughAt < paced.startedAt);
      const selected = eligible.find((item) => item.runKey === paced.qualifyingRunKey);
      if (!selected || selected.pacedMeasurement.targetRpm !== paced.targetRpm || paced.targetRpm !== Math.max(...eligible.map((item) => item.pacedMeasurement.targetRpm))) {
        fail("report.runs", "hour rate must reference the highest prior qualified calibration in the same campaign.");
      }
    }
  }
}

export function validateReport(report, schema) {
  inspectSchema(schema);
  const errors = [];
  checkShape(report, schema, schema, "report", errors);
  if (errors.length) return errors;
  checkPublicStrings(report, "report", errors);
  const fail = (path, message) => errors.push(`${path}: ${message}`);
  const dates = [];
  const checkDate = (date, path) => {
    if (date === null) return;
    const parsed = new Date(`${date}T00:00:00Z`);
    if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date || date < "2020-01-01") {
      fail(path, "must be a real date on or after 2020-01-01.");
    }
    dates.push({ date, path });
  };
  checkDate(report.publication.reviewedOn, "report.publication.reviewedOn");
  if (report.publication.status === "awaiting_pilot") {
    if (report.runs.length || report.documentedLimits.length || report.publication.reviewedOn !== null || report.studyContext !== null || report.pacedCampaigns) {
      fail("report.publication", "awaiting_pilot must contain no facts and no review date.");
    }
  } else if (report.publication.reviewedOn === null || (!report.runs.length && !report.documentedLimits.length)) {
    fail("report.publication", "reviewed requires a review date and at least one fact.");
  }
  const runKeys = new Set();
  report.runs.forEach((run, index) => {
    const path = `report.runs[${index}]`;
    if (runKeys.has(run.runKey)) fail(path, "runKey must be unique; replace snapshots, never append duplicates.");
    runKeys.add(run.runKey);
    checkDate(run.observedOn, `${path}.observedOn`);
    const { attempted, completed, failed, pending } = run.counts;
    if (attempted !== completed + failed + pending) fail(`${path}.counts`, "attempted must equal completed + failed + pending.");
    const pacedNative = run.pacedMeasurement ?? run.rampMeasurement ?? run.quotaStudyMeasurement;
    if (run.units.conversations === 0 && (!pacedNative || completed > 0 || pacedNative.conversationEvidence !== "returned_ids_checked_unique")) {
      fail(`${path}.units.conversations`, "zero returned conversations requires reviewed paced native evidence with no successful greetings; unknown remains null.");
    }
    if (report.studyContext?.runKeys.includes(run.runKey) && report.studyContext.conversationUse === "one_existing_reused" && run.units.conversations !== 1) {
      fail(`${path}.units.conversations`, "a shared single-conversation study requires one reused conversation per run.");
    }
    for (const [unit, count] of Object.entries(run.units)) {
      if (count !== null && count > attempted) fail(`${path}.units.${unit}`, "cannot exceed attempted messages.");
    }
    for (const field of ["firstVisibleActivity", "firstVisibleLatency", "latency"]) {
      if (run[field] === null) continue;
      const { sampleCount, p50Ms, p95Ms, maxMs } = run[field];
      const eligibleCount = field === "firstVisibleActivity" ? attempted : completed;
      if (sampleCount > eligibleCount) fail(`${path}.${field}`, `samples cannot exceed ${field === "firstVisibleActivity" ? "sent" : "completed"} messages.`);
      if (p50Ms > p95Ms || p95Ms > maxMs) fail(`${path}.${field}`, "must satisfy p50 <= p95 <= max.");
      if (sampleCount === 1 && (p50Ms !== p95Ms || p95Ms !== maxMs)) fail(`${path}.${field}`, "one sample requires equal p50, p95 and max.");
      if (Math.ceil(sampleCount * 0.95) === sampleCount && p95Ms !== maxMs) fail(`${path}.${field}`, "nearest-rank p95 must equal max for fewer than 20 samples.");
      if (run.windowSeconds !== null && maxMs > run.windowSeconds * 1000) fail(`${path}.${field}`, "latency cannot exceed the full observation window.");
    }
    if (run.latency && run.latency.p50Ms < run.latency.stabilitySeconds * 1000) {
      fail(`${path}.latency`, "settled latency must include the stability interval.");
    }
    // Compare endpoints only when each summary covers every completed message.
    if (run.firstVisibleLatency?.sampleCount === completed && run.latency?.sampleCount === completed) {
      for (const key of ["p50Ms", "p95Ms", "maxMs"]) {
        if (run.firstVisibleLatency[key] + run.latency.stabilitySeconds * 1000 > run.latency[key]) {
          fail(`${path}.latency`, "settled endpoint cannot precede first answer plus the stability interval.");
        }
      }
      if (completed === attempted && run.firstVisibleActivity?.sampleCount === attempted && run.firstVisibleLatency?.sampleCount === completed) {
        for (const key of ["p50Ms", "p95Ms", "maxMs"]) {
          if (run.firstVisibleActivity[key] > run.firstVisibleLatency[key]) {
            fail(`${path}.firstVisibleActivity`, "first activity cannot follow first answer for the same full sample set.");
          }
        }
      }
    }
    if (run.concurrency && run.concurrency.maxInFlight > attempted) fail(`${path}.concurrency`, "cannot exceed attempted messages.");
    if (run.arrival) {
      if (run.arrival.attempts > attempted) fail(`${path}.arrival`, "arrival attempts cannot exceed run attempts.");
      if (run.windowSeconds !== null && run.arrival.windowSeconds > run.windowSeconds) fail(`${path}.arrival`, "arrival window cannot exceed observation window.");
    }
    if (run.errors.reduce((sum, error) => sum + error.count, 0) !== failed) fail(`${path}.errors`, "error counts must exactly cover failed messages.");
    if (new Set(run.errors.map((error) => error.category)).size !== run.errors.length) fail(`${path}.errors`, "error categories must be unique.");
    run.errors.forEach((error) => {
      if ((error.category === "unknown") !== ["unclassified_failure", "unclassified_invocation_failure"].includes(error.evidence)) fail(`${path}.errors`, "unclassified evidence and unknown category must be paired.");
      if (error.evidence === "unclassified_invocation_failure" && run.nativeInvocation === null && !pacedNative) fail(`${path}.errors`, "invocation evidence requires a native invocation measurement.");
      if (error.evidence === "agent_reported_timeout" && error.category !== "workflow") fail(`${path}.errors`, "an agent-reported workflow timeout is not a wire-status or throttling observation.");
      if (error.evidence === "workiq_mcp_transport_429" && (error.category !== "throttling" || !pacedNative)) {
        fail(`${path}.errors`, "WorkIQ MCP HTTP 429 requires paced transport-throttling evidence; harness attribution remains unknown.");
      }
      if (error.evidence === "native_disconnected_no_conversation" && (error.category !== "transport" || !pacedNative)) {
        fail(`${path}.errors`, "a disconnected native result requires paced transport evidence, not a confirmed agent/backend failure or throttle.");
      }
      if (error.evidence === "native_http_429_no_conversation" && (error.category !== "throttling" || !run.rampMeasurement)) {
        fail(`${path}.errors`, "reviewed ramp native HTTP 429 has unknown enforcing layer and no returned conversation, not legacy WorkIQ-layer attribution.");
      }
    });
    if ((run.surface === "published_microsoft365_copilot") !== (run.nativeInvocation !== null || Boolean(pacedNative))) {
      fail(`${path}.nativeInvocation`, "this native invocation contract is exclusive to the published Microsoft 365 Copilot surface.");
    }
    if (run.pacedMeasurement) checkPacedMeasurement(run, `${path}.pacedMeasurement`, fail, checkDate);
    if (run.rampMeasurement) checkRampMeasurement(run, `${path}.rampMeasurement`, fail, checkDate);
    if (run.quotaStudyMeasurement) checkQuotaStudy(run, `${path}.quotaStudyMeasurement`, fail, checkDate);
    if (run.nativeInvocation) {
      const invocation = run.nativeInvocation;
      if (run.windowSeconds === null || pending !== 0) fail(`${path}.nativeInvocation`, "requires a measured, finished invocation batch.");
      if (run.workload !== "single_turn" || run.workflow !== "not_involved" || run.workflowState !== null || run.clientIssues.length) {
        fail(`${path}.nativeInvocation`, "this greeting-only contract excludes workflow requests and unsent-draft client episodes.");
      }
      if ([run.firstVisibleActivity, run.firstVisibleLatency, run.latency, run.concurrency, run.arrival, run.followUp].some((value) => value !== null)) {
        fail(`${path}.nativeInvocation`, "native invocation timing and client overlap cannot stand in for visible/UI timing, message concurrency, arrivals or follow-up outcomes.");
      }
      for (const field of ["startedAt", "endedAt"]) {
        const value = invocation[field];
        const parsed = new Date(value);
        if (Number.isNaN(parsed.valueOf()) || parsed.toISOString() !== value) fail(`${path}.nativeInvocation.${field}`, "must be a real millisecond UTC instant.");
        checkDate(value.slice(0, 10), `${path}.nativeInvocation.${field}`);
      }
      if (invocation.endedAt <= invocation.startedAt || invocation.endedAt.slice(0, 10) !== run.observedOn) {
        fail(`${path}.nativeInvocation`, "wall-clock markers must be ordered and end on the run observation date.");
      }
      if (invocation.peakOutstanding > attempted || invocation.dispatchWindowMs > run.windowSeconds * 1000) {
        fail(`${path}.nativeInvocation`, "client overlap and dispatch window must fit the observed invocation batch.");
      }
      if (run.units.conversations !== attempted || invocation.failedConversations !== failed) {
        fail(`${path}.nativeInvocation`, "unique-conversation evidence must cover every invocation including failed payloads.");
      }
      checkInvocationTimings(invocation, run.counts, run.windowSeconds, `${path}.nativeInvocation`, fail);
      if (run.errors.some((error) => error.category !== "unknown" || error.evidence !== "unclassified_invocation_failure")) {
        fail(`${path}.nativeInvocation`, "generic server_error evidence cannot be labelled a confirmed throttle, quota or backend failure.");
      }
      const { calibration, history } = invocation;
      if (calibration.longRequestedMs <= calibration.shortRequestedMs || calibration.longObservedMs <= calibration.shortObservedMs) {
        fail(`${path}.nativeInvocation.calibration`, "independent short/long probes must retain their distinct ordered durations.");
      }
      if (history.completedConversations > completed || history.failedConversationsAbsent > failed || history.completedConversations > history.snapshotRows) {
        fail(`${path}.nativeInvocation.history`, "snapshot counts cannot exceed the corresponding invocation outcomes.");
      }
      if (history.membership === "exact_intersection_verified" && history.completedConversations !== completed) {
        fail(`${path}.nativeInvocation.history`, "verified full success membership must cover every successful invocation.");
      }
      const monitor = invocation.postRunMonitor;
      const checkedAt = new Date(monitor.checkedAt);
      if (Number.isNaN(checkedAt.valueOf()) || checkedAt.toISOString().replace(".000Z", "Z") !== monitor.checkedAt) {
        fail(`${path}.nativeInvocation.postRunMonitor`, "must include a real UTC check instant.");
      }
      checkDate(monitor.checkedAt.slice(0, 10), `${path}.nativeInvocation.postRunMonitor.checkedAt`);
      if (checkedAt.valueOf() < Date.parse(invocation.endedAt) || checkedAt.valueOf() - monitor.updatedMinutesAgo * 60000 >= Date.parse(invocation.startedAt)) {
        fail(`${path}.nativeInvocation.postRunMonitor`, "stale preburst analytics must be checked after the burst and last updated before it.");
      }
    }
    if (run.workflowState) {
      if (run.workflow !== "involved") fail(`${path}.workflowState`, "requires an involved workflow; its running state is independent of the agent-call outcome.");
      if (run.windowSeconds !== null && run.workflowState.invocationStatusFirstSeenMs > run.windowSeconds * 1000) {
        fail(`${path}.workflowState`, "the visible invocation status must fall within the message observation window.");
      }
    }
    if (run.followUp) {
      const followUp = run.followUp;
      const { atCutoff } = followUp;
      const instant = new Date(followUp.observedAt);
      if (Number.isNaN(instant.valueOf()) || instant.toISOString().replace(".000Z", "Z") !== followUp.observedAt) {
        fail(`${path}.followUp.observedAt`, "must be a real UTC instant.");
      }
      checkDate(followUp.observedAt.slice(0, 10), `${path}.followUp.observedAt`);
      if (followUp.observedAt.slice(0, 10) < run.observedOn) fail(`${path}.followUp`, "cannot precede the run date.");
      if (atCutoff.attempted !== atCutoff.completed + atCutoff.failed + atCutoff.pending || attempted !== atCutoff.attempted) {
        fail(`${path}.followUp.atCutoff`, "must partition the same sent attempts as the updated outcome counts.");
      }
      if (failed <= atCutoff.failed || pending >= atCutoff.pending || !run.errors.some((error) => error.category === "workflow" && error.evidence === "agent_reported_timeout")) {
        fail(`${path}.followUp`, "requires a pending-to-failed workflow timeout outcome with agent-reported evidence.");
      }
      if (run.firstVisibleLatency !== null || run.latency !== null) {
        fail(`${path}.followUp`, "late answer and settlement timing are unmeasured in this follow-up shape.");
      }
    }
  });
  if (report.studyContext?.runKeys.some((key) => !runKeys.has(key))) fail("report.studyContext.runKeys", "context can only reference existing reviewed runs.");
  checkPacedCampaigns(report.runs, fail);
  for (const run of report.runs.filter((item) => item.rampMeasurement || item.quotaStudyMeasurement)) {
    const key = (run.rampMeasurement ?? run.quotaStudyMeasurement).campaignKey;
    if (report.runs.filter((item) => (item.rampMeasurement ?? item.pacedMeasurement ?? item.quotaStudyMeasurement)?.campaignKey === key).length !== 1
      || report.pacedCampaigns?.some((campaign) => campaign.campaignKey === key)) {
      fail("report.runs", "a continuous ramp or interrupted quota study is one separate run, not repeated fixed-rate cohorts or a resumed campaign.");
    }
  }
  const campaignKeys = new Set();
  for (const campaign of report.pacedCampaigns ?? []) {
    const path = "report.pacedCampaigns";
    if (campaignKeys.has(campaign.campaignKey)) fail(path, "campaign context keys must be unique.");
    campaignKeys.add(campaign.campaignKey);
    const cohorts = report.runs.filter((run) => run.pacedMeasurement?.campaignKey === campaign.campaignKey);
    if (campaign.runKeys.length !== cohorts.length || campaign.runKeys.some((key) => !cohorts.some((run) => run.runKey === key))) {
      fail(path, "campaign context must reference exactly its measured cohorts.");
    }
    for (const field of ["startedAt", "endedAt"]) {
      const parsed = new Date(campaign[field]);
      if (Number.isNaN(parsed.valueOf()) || parsed.toISOString() !== campaign[field]) fail(path, "campaign markers must be real millisecond UTC instants.");
      checkDate(campaign[field].slice(0, 10), path);
    }
    if (campaign.startedAt >= campaign.endedAt || cohorts.some((run) => run.pacedMeasurement.startedAt < campaign.startedAt || run.pacedMeasurement.observedThroughAt > campaign.endedAt)) {
      fail(path, "campaign markers must contain the measured cohort windows.");
    }
    const knownConversations = cohorts.map((run) => run.units.conversations);
    if (knownConversations.some((count) => count === null) || campaign.distinctReturnedConversations > knownConversations.reduce((sum, count) => sum + count, 0)
      || campaign.distinctReturnedConversations < Math.max(...knownConversations)) fail(path, "verified campaign distinct conversations must fit the reviewed cohort counts.");
    if (campaign.clientPeakOutstanding !== Math.max(...cohorts.map((run) => run.pacedMeasurement.peakOutstanding ?? 0))) fail(path, "campaign peak must match non-overlapping cohort peaks.");
    const measuredRates = cohorts.filter((run) => run.pacedMeasurement.phase !== "hour").map((run) => run.pacedMeasurement.targetRpm);
    if (campaign.notAttemptedCalibrationRpm.some((rate) => measuredRates.includes(rate))) fail(path, "unattempted calibration rates cannot have observed cohorts.");
    const last = [...cohorts].sort((a, b) => a.pacedMeasurement.startedAt.localeCompare(b.pacedMeasurement.startedAt)).at(-1);
    if (["standalone_minute_retest", "standalone_count_retest"].includes(campaign.status)) {
      const phase = campaign.status === "standalone_count_retest" ? "count_retest" : "minute_retest";
      if (cohorts.length !== 1 || last.pacedMeasurement.phase !== phase) {
        fail(path, "standalone retest context must reference exactly one matching retest; completion is determined from actual dispatch and drain evidence.");
      }
    } else if (campaign.status === "completed_standalone_calibration") {
      if (cohorts.length !== 1 || last.pacedMeasurement.phase !== "calibration" || last.pacedMeasurement.arrivalStatus !== "full_window"
        || last.pacedMeasurement.drainStatus !== "complete" || last.pacedMeasurement.qualification !== "qualified"
        || last.pacedMeasurement.stopReason !== null || last.counts.attempted !== last.pacedMeasurement.plannedSlots) {
        fail(path, "completed standalone calibration requires exactly one qualified full-window cohort, all planned dispatches and complete drain; not an hour or a stopped campaign.");
      }
    } else {
      const transportStop = campaign.status === "stopped_on_workiq_mcp_transport_429";
      const stopReason = transportStop ? "explicit_throttle" : "generic_error_threshold";
      const evidence = transportStop ? "workiq_mcp_transport_429" : "unclassified_invocation_failure";
      if (!last || last.pacedMeasurement.arrivalStatus !== "stopped" || last.pacedMeasurement.stopReason !== stopReason
        || !last.errors.some((error) => error.evidence === evidence)) fail(path, "campaign stop context requires the corresponding terminal cohort evidence.");
    }
    const monitor = campaign.postCampaignMonitor;
    const checked = new Date(monitor.checkedAt);
    if (Number.isNaN(checked.valueOf()) || checked.toISOString().replace(".000Z", "Z") !== monitor.checkedAt
      || checked.valueOf() < Date.parse(campaign.endedAt) || checked.valueOf() - monitor.updatedMinutesAgo * 60000 >= Date.parse(campaign.startedAt)) {
      fail(path, "stale campaign Monitor must be checked after the campaign with a refresh preceding it.");
    }
    checkDate(monitor.checkedAt.slice(0, 10), path);
  }
  const limitKeys = new Set();
  report.documentedLimits.forEach((limit, index) => {
    if (limitKeys.has(limit.limitKey)) fail(`report.documentedLimits[${index}]`, "limitKey must be unique.");
    limitKeys.add(limit.limitKey);
    checkDate(limit.retrievedOn, `report.documentedLimits[${index}].retrievedOn`);
  });
  for (const { date, path } of dates) {
    if (report.publication.reviewedOn !== null && date > report.publication.reviewedOn) fail(path, "cannot be later than the publication review.");
  }
  return errors;
}

export function assertReport(report, schema) {
  const errors = validateReport(report, schema);
  if (errors.length) throw new Error(`Public report rejected:\n${errors.join("\n")}`);
  return report;
}
