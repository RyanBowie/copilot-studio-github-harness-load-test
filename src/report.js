const byId = (id) => document.getElementById(id);
const number = (value) => value > 0 && value < 0.001 ? "<0.001" : new Intl.NumberFormat("en", { maximumFractionDigits: 3 }).format(value);
const words = (value) => value.replaceAll("_", " ");
const labels = {
  published_teams: "Published Teams",
  published_microsoft365_copilot: "Published Microsoft 365 Copilot",
  studio_preview: "Studio Preview",
  not_involved: "Not involved",
  involved: "Involved",
  unknown: "Unknown",
  github_copilot_harness: "GitHub Copilot Harness",
  standard_harness: "Standard Harness only",
  teams_bot_api: "Teams bot transport API",
  teams_connector: "Teams connector only",
  workiq_mcp_transport_429: "WorkIQ MCP HTTP transport 429; GitHub Copilot Harness attribution unknown",
  generic_error_threshold: "Generic invocation-error safety threshold; not confirmed throttling",
  turn_serialization_observed: "Turn serialization observed in this run; not a platform capacity finding.",
  manual_timing: "Manual visible-response timing.",
  partial_observation: "The initial timing window was partial; later outcome evidence is shown separately when available.",
  channel_reconnect: "Channel reconnection observed.",
  standalone_teams_send_tool_missing: "Configuration discrepancy: standalone Teams-send tool is missing; no successful standalone delivery is inferred.",
  human_review_workflow_attached: "Human-review workflow is attached; attachment alone does not establish execution.",
  public_knowledge_all_websites_enabled: "Configuration discrepancy: Search all websites is ON; public knowledge is not restricted to one nominated Microsoft Learn page.",
  built_in_web_search_observed: "Built-in web search/browse observed; this is not a connector action.",
  requested_answer_format_and_public_citation_observed: "The requested two-sentence answer format and a real public Microsoft Learn citation were observed; not a general correctness evaluation.",
  sharepoint_search_and_snippets_observed: "SharePoint search/snippet activity observed; no internal content or citations are included here.",
  unsent_draft_recovered_once_without_auto_retry: "The unsent draft was recovered once with real keyboard input; no automatic retry."
};
const label = (value) => value === null ? "Unknown" : (labels[value] ?? words(value));
const node = (tag, text, className) => {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
};
const paragraph = (text, className) => node("p", text, className);
const nativeMeasurement = (run) => run.pacedMeasurement ?? run.nativeInvocation;
const nativeFirst = (runs) => [...runs.filter((run) => run.pacedMeasurement), ...runs.filter((run) => run.nativeInvocation), ...runs.filter((run) => !nativeMeasurement(run))];
const scopedContext = (report, run) => report.studyContext?.runKeys.includes(run.runKey) ? report.studyContext : null;
const seconds = (milliseconds) => `${(milliseconds / 1000).toFixed(3)} s`;
const pacedPhase = (measurement) => measurement.phase === "hour" ? "Hourly arrival cohort" : "Rate calibration cohort";
const achievedRpm = (run) => number(run.counts.attempted / run.pacedMeasurement.arrivalSeconds * 60);
const pacedStopLabel = (run) => run.pacedMeasurement.stopReason === "explicit_throttle" && run.errors.some((error) => error.evidence === "workiq_mcp_transport_429")
  ? label("workiq_mcp_transport_429") : label(run.pacedMeasurement.stopReason);

function empty(target, title, detail) {
  const article = node("article", undefined, "empty");
  article.append(paragraph("NOT MEASURED", "eyebrow"), node("h3", title), paragraph(detail));
  byId(target).replaceChildren(article);
}

function definitionList(pairs) {
  const list = node("dl");
  for (const [term, detail] of pairs) list.append(node("dt", term), node("dd", detail));
  return list;
}

function table(target, caption, headers, rows) {
  const wrapper = node("div", undefined, "table-wrap");
  wrapper.tabIndex = 0;
  wrapper.setAttribute("role", "region");
  wrapper.setAttribute("aria-label", `${caption}; scroll horizontally if needed`);
  const grid = node("table");
  grid.append(node("caption", caption));
  const head = node("thead");
  const headings = node("tr");
  for (const heading of headers) {
    const cell = node("th", heading);
    cell.scope = "col";
    headings.append(cell);
  }
  head.append(headings);
  const body = node("tbody");
  for (const cells of rows) {
    const row = node("tr");
    for (const [index, content] of cells.entries()) {
      const cell = node(index === 0 ? "th" : "td");
      if (index === 0) cell.scope = "row";
      if (content instanceof Node) cell.append(content);
      else cell.textContent = content;
      row.append(cell);
    }
    body.append(row);
  }
  grid.append(head, body);
  wrapper.append(grid);
  (typeof target === "string" ? byId(target) : target).replaceChildren(wrapper);
}

const windowLabel = (value) => value < 60 ? `${number(value)} seconds`
  : value < 3600 ? `${number(value / 60)} minute${value === 60 ? "" : "s"}`
    : value < 86400 ? `${number(value / 3600)} hour${value === 3600 ? "" : "s"}` : `${number(value / 86400)} day`;
const outcomeRatio = (counts) => `${number(counts.completed)} / ${number(counts.attempted)} (${number(counts.completed / counts.attempted * 100)}%)`;
const sourceWindow = (candidate) => `${candidate.runKey}; ${number(candidate.targetRpm)} intended RPM; dispatch offsets ${number(candidate.offsetSeconds)}-${number(candidate.offsetSeconds + candidate.windowSeconds)} s`;

function capacityCell(candidate) {
  if (!candidate) return "NOT ESTABLISHED";
  const cell = node("div");
  cell.append(node("strong", outcomeRatio(candidate.counts)),
    paragraph(`${number(candidate.counts.failed)} failed / ${number(candidate.counts.pending)} pending`, "fine"),
    paragraph(sourceWindow(candidate), "fine run-title"));
  return cell;
}

function renderCapacity(report) {
  const target = byId("capacity-summary");
  target.replaceChildren();
  const groups = summarizeCapacity(report.runs);
  if (!groups.length) {
    empty("capacity-summary", "No paced capacity windows measured.", "Individual turns or a simultaneous burst cannot establish a successful per-minute, hourly or daily rate.");
    return;
  }
  for (const group of groups) {
    const section = node("article", undefined, "stack capacity-group");
    const { context, highestQualifiedRpm, highestQualifiedRuns, longestClean, longestCompleted } = group;
    section.append(node("h3", `${label(context.surface)} / ${label(context.environmentType)} / ${context.model ?? "unknown model"}`),
      paragraph(`Greeting-only native invocation completion; ${context.authenticatedAccounts} account; memory ${label(context.memory)}; published revision ${context.agentVersion ?? "unknown"}. Configuration-specific observations, not a controlled harness comparison.`, "fine"));
    const summary = node("div", undefined, "note boundary");
    summary.append(definitionList([
      ["Highest qualified calibration", highestQualifiedRpm === null ? "NOT ESTABLISHED" : `${number(highestQualifiedRpm)} intended requests/min; ${highestQualifiedRuns.length} qualified calibration cohort(s), each ${windowLabel(highestQualifiedRuns[0].pacedMeasurement.arrivalSeconds)}. Not a sustained safe rate or service ceiling.`],
      ["Longest clean dispatch segment", longestClean ? `${windowLabel(longestClean.windowSeconds)} / ${outcomeRatio(longestClean.counts)} eventual replies. ${sourceWindow(longestClean)}. A segment, not a separately completed endurance test.` : "NOT ESTABLISHED"],
      ["Longest completed paced trial", longestCompleted ? `${windowLabel(longestCompleted.pacedMeasurement.arrivalSeconds)} of arrivals plus drain (${longestCompleted.runKey}). Complete does not mean error-free.` : "NOT ESTABLISHED"],
      ["Full hourly arrival trial", group.runs.some((run) => run.pacedMeasurement.phase === "hour" && run.pacedMeasurement.arrivalStatus === "full_window" && run.pacedMeasurement.drainStatus === "complete")
        ? "Completed; inspect its counts, skipped slots and qualification separately below." : "NOT ESTABLISHED; do not extrapolate shorter trials into an hourly result."]
    ]));
    section.append(summary,
      paragraph("Best counts among available whole dispatch-minute windows, not arbitrary rolling maxima. Each numerator is eventual successful invocations from requests sent in that window; replies may finish later during drain. Error-free means no failed or pending outcomes, not guaranteed future reliability.", "fine"));
    const container = node("div");
    table(container, `Observed dispatch-window successes / ${label(context.surface)} / ${context.model ?? "unknown model"}`,
      ["Dispatch window", "Most eventual successes / attempted", "Best error-free observed window", "Evidence boundary"],
      group.windows.map((window) => [
        windowLabel(window.seconds), capacityCell(window.best), capacityCell(window.clean),
        window.seconds < 60 ? "Sub-minute timestamps not provided; not derived from a burst."
          : window.best ? "Complete contiguous minute buckets in one cohort. Offered load can limit the count; not a service ceiling."
            : "No eligible full window within one measured cohort. Not zero capacity."
      ]));
    section.append(container);
    target.append(section);
  }
  const gaps = node("article", undefined, "note");
  const fullHour = groups.some((group) => group.runs.some((run) => run.pacedMeasurement.phase === "hour"
    && run.pacedMeasurement.arrivalStatus === "full_window" && run.pacedMeasurement.drainStatus === "complete"));
  gaps.append(node("h3", "Still not established"),
    paragraph(`Exact rolling-window and completion-window maxima; ${fullHour ? "daily capacity" : "a completed hourly/daily endurance result"}; failure recovery/reset; quota scope; backend concurrency; representative knowledge/workflow throughput. See Costs for separately reviewed billing evidence; no unit cost is derived here.`),
    paragraph("The same rate can pass a short calibration and later encounter a transport stop. Repeated small clean samples do not establish a 99% service guarantee. Check the rate, duration, stop reason and failure layer together."));
  target.append(gaps);
}

function loadStatus(run) {
  const paced = run.pacedMeasurement;
  if (!paced) return "Finished burst; not a sustained arrival rate.";
  if (paced.stopReason) return `Arrival ${label(paced.arrivalStatus)}: ${pacedStopLabel(run)}; drain ${label(paced.drainStatus)}.`;
  return `Arrival ${label(paced.arrivalStatus)}; drain ${label(paced.drainStatus)}; ${label(paced.qualification)}.`;
}

function renderReliability(runs) {
  const native = nativeFirst(runs).filter((run) => nativeMeasurement(run));
  if (!native.length) {
    empty("reliability-content", "No native load comparison.", "Single visible turns are not rate-calibration trials.");
    return;
  }
  table("reliability-content", "Offered rate versus reliability / separate cohorts, no pooled percentiles",
    ["Cohort / offered load", "Actual window", "Eventual successes / attempts", "Failures / pending", "Successful p95", "Observed client peak", "Trial result"],
    native.map((run) => {
      const measurement = nativeMeasurement(run);
      return [
        `${run.runKey} / ${run.pacedMeasurement ? `${number(measurement.targetRpm)} intended RPM; ${measurement.campaignKey}` : `${number(run.counts.attempted)}-request burst`}`,
        run.pacedMeasurement ? `${number(measurement.arrivalSeconds)} s arrivals + ${number(measurement.drainSeconds)} s drain` : `${number(run.windowSeconds)} s batch, not an arrival-rate trial`,
        outcomeRatio(run.counts), `${number(run.counts.failed)} / ${number(run.counts.pending)}`,
        measurement.success ? seconds(measurement.success.p95Ms) : "No successful samples",
        measurement.peakOutstanding === null ? "Not measured" : `${number(measurement.peakOutstanding)} outstanding client calls`,
        loadStatus(run)
      ];
    }));
  byId("reliability-content").append(paragraph("Compare like configurations in the capacity summary; each row keeps its own cohort and campaign. A high success percentage is not a completed trial. Generic native invocation errors do not identify a throttle; WorkIQ MCP transport 429 does not establish a GitHub Copilot Harness quota. Client peaks are not backend/model concurrency.", "fine"));
}

function renderFailureSummary(runs) {
  const failures = nativeFirst(runs).filter((run) => nativeMeasurement(run) && run.counts.failed);
  if (!failures.length) {
    empty("failure-summary", "No native load-failure observations.", "An empty failure table is not evidence that the route has no limits. Visible workflow failures, if any, remain separate below.");
    return;
  }
  table("failure-summary", "Where failures were observed / dispatch cohorts are not failure timestamps",
    ["Cohort", "Failed invocations / evidence", "First affected dispatch bucket", "Arrival stop / observation end", "Attribution and recovery"],
    failures.map((run) => {
      const paced = run.pacedMeasurement;
      const first = paced?.minutes.find((minute) => minute.failed > 0);
      const transport = run.errors.some((error) => error.evidence === "workiq_mcp_transport_429");
      const generic = run.errors.every((error) => error.evidence === "unclassified_invocation_failure");
      return [
        run.runKey,
        run.errors.map((error) => `${number(error.count)} ${label(error.evidence)}`).join("; "),
        first ? `${number(first.offsetSeconds)}-${number(first.offsetSeconds + first.durationSeconds)} s: ${number(first.failed)} eventual failure${first.failed === 1 ? "" : "s"} among ${number(first.attempted)} dispatches. Not the time the first error returned.` : "Not bucketed; exact first-error return time not available.",
        paced ? (paced.stopReason ? `${number(paced.arrivalSeconds)} s / ${pacedStopLabel(run)}. Final error count includes calls already in flight, not the guard's trigger count.`
          : `Full ${number(paced.arrivalSeconds)} s arrival window; ${label(paced.qualification)}. No arrival stop.`)
          : `${number(run.windowSeconds)} s batch observation; not a measured failure-onset time.`,
        transport ? "WorkIQ MCP HTTP transport 429 observed. Harness attribution, quota key/window/reset and backend reach unknown; no retry interval exposed. Recovery not measured."
          : generic ? "Generic invocation failure; no confirmed throttle or limiting component. Exact recovery/reset not measured."
            : "See the classified evidence; no numeric harness ceiling is established. Recovery/reset not measured."
      ];
    }));
  byId("failure-summary").append(paragraph("Stop time is not first-failure time. Final failures can include invocations that were already outstanding when dispatch stopped. Recovery/reset is not inferred from a later successful trial; underlying workflow failures remain separate below.", "fine"));
}

function outcomeCards(runs, native = false, nativeScope = "This native invocation batch only") {
  const cards = node("div", undefined, "cards");
  const metricLabels = native
    ? { attempted: "Attempted invocations", completed: "Greeting replies", failed: "Failed invocations", pending: "Pending invocations" }
    : { attempted: "Sent message attempts", completed: "Successful outcomes", failed: "Failed outcomes", pending: "Pending outcomes" };
  for (const state of ["attempted", "completed", "failed", "pending"]) {
    const card = node("article", undefined, "card");
    const count = runs.length ? number(runs.reduce((sum, run) => sum + run.counts[state], 0)) : "NOT MEASURED";
    card.append(paragraph(metricLabels[state], "metric-label"), paragraph(count, "metric-value"),
      paragraph(runs.length ? (native ? nativeScope : "Requested operation outcome, not merely a final message") : "Awaiting reviewed pilot evidence", "metric-help"));
    cards.append(card);
  }
  return cards;
}

function renderOverview(report) {
  const overview = byId("overview-summary");
  overview.replaceChildren();
  for (const campaign of report.pacedCampaigns ?? []) {
    const cohorts = report.runs.filter((run) => campaign.runKeys.includes(run.runKey));
    const totals = cohorts.reduce((sum, run) => {
      for (const key of Object.keys(sum)) sum[key] += run.counts[key];
      return sum;
    }, { attempted: 0, completed: 0, failed: 0, pending: 0 });
    const hour = cohorts.find((run) => run.pacedMeasurement.phase === "hour");
    const standalone = cohorts.length === 1 && cohorts[0].pacedMeasurement.phase === "calibration" ? cohorts[0] : null;
    const transportStop = campaign.status === "stopped_on_workiq_mcp_transport_429";
    const completed = campaign.status === "completed_standalone_calibration";
    const card = node("article", undefined, "note boundary campaign-summary");
    card.dataset.campaignKey = campaign.campaignKey;
    card.append(paragraph(completed ? "PACED CAMPAIGN / COMPLETED CALIBRATION" : "PACED CAMPAIGN / STOPPED EARLY", "eyebrow"),
      node("h3", standalone ? `Standalone ${number(standalone.pacedMeasurement.targetRpm)} RPM / ${completed ? "completed calibration" : "safety stop"}` : "No full hourly result"),
      paragraph(`${number(totals.attempted)} attempts / ${number(totals.completed)} greeting replies / ${number(totals.failed)} failures / ${number(totals.pending)} pending across this campaign only.`),
      paragraph(completed
        ? "The full two-minute arrival window and drain completed. Qualification describes this bounded calibration only, not an hourly result or a GitHub Copilot Harness capacity ceiling."
        : transportStop
        ? "Stopped on WorkIQ MCP HTTP transport 429. GitHub Copilot Harness quota attribution is unknown; this is not a measured harness capacity ceiling."
        : "Stopped on the generic invocation-error safety threshold, not HTTP 429. No HTTP 429 or retry interval was exposed for these errors. The limiting layer and GitHub Copilot Harness capacity remain unknown; this is not confirmed throttling."));
    if (standalone) {
      const paced = standalone.pacedMeasurement;
      card.append(paragraph(`Separate authorization and campaign, not a restart or escalation of the earlier campaign. ${number(standalone.counts.completed / standalone.counts.attempted * 100)}% eventual greeting success through drain. ${completed ? "The full arrival window covered" : "Dispatch stopped after"} ${number(paced.arrivalSeconds)} s of a planned ${number(paced.plannedArrivalSeconds)} s / ${number(paced.plannedSlots)} calls; ${number(paced.unofferedSlots)} were not offered and ${number(paced.skippedSlots)} were skipped.`),
        paragraph(completed
          ? `All planned calls dispatched; outcomes were observed through the following ${number(paced.drainSeconds)} s drain. No hour or automatic continuation followed.`
          : `${paced.arrivalSeconds < 60 ? "Not even one full minute completed. " : ""}No completed two-minute calibration or hour. Already-outstanding calls then drained for ${number(paced.drainSeconds)} s; final failure count includes that drain. No restart, retries or escalation, including unused slots.`));
    }
    if (hour) card.append(paragraph(`The ${number(hour.pacedMeasurement.targetRpm)} RPM hourly arrival attempt stopped after ${number(hour.pacedMeasurement.arrivalSeconds)} s of 3,600 s: ${number(hour.counts.attempted)} of ${number(hour.pacedMeasurement.plannedSlots)} planned calls were dispatched, leaving ${number(hour.pacedMeasurement.unofferedSlots)} unsent. Its ${number(hour.counts.completed)} eventual replies are counted through the following ${number(hour.pacedMeasurement.drainSeconds)} s drain, not necessarily inside the arrival window. ${number(hour.pacedMeasurement.targetRpm)} RPM was the last qualified calibration rate, not a sustained-capacity finding.`));
    for (const run of cohorts.filter((item) => item.pacedMeasurement.phase === "calibration" && item.pacedMeasurement.qualification === "not_qualified")) {
      const belowThreshold = run.counts.completed * 100 < run.counts.attempted * 99;
      const reason = run.pacedMeasurement.arrivalStatus !== "full_window" ? "but ended before its planned arrival window completed and did not qualify"
        : belowThreshold ? "below the predeclared 99% qualification rule" : "but did not qualify; every slot, complete drain and healthy pacing are also required";
      card.append(paragraph(`${number(run.pacedMeasurement.targetRpm)} RPM calibration returned ${number(run.counts.completed / run.counts.attempted * 100)}% greetings, ${reason}. Unclassified errors are not quota evidence.`));
    }
    const unattempted = campaign.notAttemptedCalibrationRpm.length ? `${campaign.notAttemptedCalibrationRpm.map(number).join(" / ")} RPM calibration stages were not attempted in this campaign (${campaign.campaignKey}); separate campaigns are not included. ` : "";
    card.append(paragraph(`${unattempted}${number(campaign.distinctReturnedConversations)} distinct returned conversations were independently verified across this campaign.${transportStop ? " The transport-429 attempt returned no identifier." : ""} Peak client outstanding: ${number(campaign.clientPeakOutstanding)}, not backend/model concurrency.`),
      paragraph(`Campaign markers: ${campaign.startedAt} to ${campaign.endedAt}. No runner retries or automatic restart; managed-service retries unknown. ${cohorts.every((run) => run.cost.status === "pending") ? "Costs remain pending." : "Cost evidence is reported separately."} Earlier burst and Teams observations are separate.`, "fine"));
    overview.append(card);
  }
  for (const run of report.runs.filter((item) => item.pacedMeasurement)) {
    const paced = run.pacedMeasurement;
    const feature = node("article", undefined, "note boundary paced-summary");
    feature.dataset.runKey = run.runKey;
    feature.append(paragraph("REVIEWED PACED COHORT / NATIVE INVOCATION", "eyebrow"),
      node("h3", `${pacedPhase(paced)} / ${number(paced.targetRpm)} intended RPM`),
      paragraph(`Campaign: ${paced.campaignKey}; outcomes are not combined with other campaigns.`, "fine"),
      paragraph(`${number(run.counts.completed / run.counts.attempted * 100)}% greeting reply success at observation cutoff`),
      outcomeCards([run], true, "This paced dispatch cohort only"),
      paragraph(`${achievedRpm(run)} achieved client dispatches/min over ${number(paced.arrivalSeconds)} s of a planned ${number(paced.plannedArrivalSeconds)} s arrival window. This is an observed-window rate, not an extrapolated hourly result. Arrival status: ${label(paced.arrivalStatus)}; drain: ${label(paced.drainStatus)} (${number(paced.drainSeconds)} s). ${paced.stopReason ? `Stop reason: ${pacedStopLabel(run)}.` : "No arrival stop recorded."}`),
      paragraph(`${number(paced.skippedSlots)} skipped and ${number(paced.unofferedSlots)} unoffered client slots are outside the ${number(run.counts.attempted)} invocation attempts, not agent failures. Qualification: ${label(paced.qualification)}.${paced.qualifyingRunKey ? ` Rate selected from ${paced.qualifyingRunKey}.` : ""}`),
      paragraph(`Peak outstanding client invocations: ${paced.peakOutstanding === null ? "not measured" : number(paced.peakOutstanding)}; not backend/model concurrency. Costs: ${run.cost.status}.`, "fine"));
    overview.append(feature);
  }
  for (const run of report.runs.filter((item) => item.nativeInvocation)) {
    const invocation = run.nativeInvocation;
    const feature = node("article", undefined, "note boundary burst-summary");
    feature.dataset.runKey = run.runKey;
    feature.append(paragraph("MEASURED BURST / NATIVE INVOCATION", "eyebrow"),
      node("h3", `${number(run.counts.attempted)} requests / ${label(run.surface)}`),
      paragraph(`${number(run.counts.completed / run.counts.attempted * 100)}% greeting reply success`, "burst-result"),
      outcomeCards([run], true),
      paragraph(`${number(invocation.peakOutstanding)} outstanding client invocations at peak, independently verified by a start/end interval sweep, launched across ${invocation.dispatchWindowMs} ms. This is client RPC launch spread, not measured network/server admission spread or simultaneous backend/model execution.`),
      paragraph(`${number(run.units.conversations)} distinct Microsoft 365 conversations verified, including ${number(invocation.failedConversations)} returned with failure payloads. One account; ${number(run.windowSeconds)} s calibrated batch window. No UI-stable or TTFA timing.`),
      paragraph(`${number(run.counts.failed)} generic WorkIQ/Microsoft 365 server_error outcomes are unclassified invocation failures. No explicit 429, Retry-After, RATE_LIMIT_REACHED or numeric quota evidence; the bottleneck is unknown.`),
      paragraph(`${number(invocation.excludedPreflights)} earlier probes and the separate Teams pilot are excluded from this batch. Runner retries: ${invocation.runnerRetries}; managed-service retries: unknown. Costs: ${run.cost.status}.`, "fine"));
    overview.append(feature);
  }
  const visibleRuns = report.runs.filter((run) => !nativeMeasurement(run));
  for (const surface of new Set(visibleRuns.map((run) => run.surface))) {
    const group = node("article");
    group.dataset.surface = surface;
    group.append(node("h3", `${label(surface)} / separate observations`), outcomeCards(visibleRuns.filter((run) => run.surface === surface)));
    overview.append(group);
  }
  if (!report.runs.length) overview.append(outcomeCards([]));
  if (report.studyContext) {
    const context = report.studyContext;
    const note = node("article", undefined, "note boundary");
    note.append(node("h3", "Earlier Teams pilot / scoped counting boundaries"), paragraph(`Applies only to: ${context.runKeys.join(", ")}.`, "fine"));
    if (context.conversationUse === "one_existing_reused") note.append(paragraph("One existing Teams conversation was reused across these pilot runs only. The per-run conversation counts refer to that same conversation and must not be added together; this is not the later Microsoft 365 burst."));
    if (context.executionPattern === "sequential") note.append(paragraph("These pilot turns were sent sequentially. One authenticated account is not a multi-account capacity experiment."));
    if (context.volumeRamp === "not_performed") note.append(paragraph("No high-volume ramp was performed in this earlier Teams pilot. Its outcomes establish neither a numeric throttle threshold nor platform-wide capacity."));
    if (context.configurationChanges === "none_by_tester") note.append(paragraph("The tester did not edit, save or republish the agent configuration."));
    if (context.harnessVerification === "github_copilot_and_published_badges") note.append(paragraph("The Agents grid independently showed Powered by GitHub Copilot and Published. The exact agent version was not frozen."));
    byId("overview-summary").append(note);
  }
  if (!report.runs.length) {
    empty("run-ledger", "Awaiting the first reviewed pilot.", "No load measurements have been published. Response time, throughput, concurrency, error outcomes and costs remain not measured. There are no synthetic results behind this view.");
    return;
  }
  const ledger = node("div", undefined, "stack");
  ledger.append(node("h3", `Reviewed run ledger / ${number(report.runs.length)} ${report.runs.length === 1 ? "run" : "runs"}`));
  for (const run of nativeFirst(report.runs)) {
    const card = node("article", undefined, "card");
    card.append(node("h3", run.runKey, "run-title"), definitionList([
      ["Observed", run.observedOn], ["Surface", label(run.surface)], ["Environment", label(run.environmentType)],
      ["Model", run.model ?? "Unknown"], ["Agent version", run.agentVersion ?? "Unknown"],
      ["Authenticated accounts", "1"], ["Memory", label(run.memory)], ["Workload", label(run.workload)], ["Workflow", label(run.workflow)],
      ["Connectors", label(run.connectors)], ["Conversations / sessions", `${run.units.conversations ?? "Unknown"}${scopedContext(report, run)?.conversationUse === "one_existing_reused" ? " (same existing conversation)" : nativeMeasurement(run) && run.units.conversations !== null ? " (verified distinct Microsoft 365 conversations)" : ""} / ${run.units.sessions ?? "Unknown"}`],
      ["Requested outcomes", `${number(run.counts.attempted)} attempted / ${number(run.counts.completed)} successful / ${number(run.counts.failed)} failed / ${number(run.counts.pending)} pending`],
      ["Outcome snapshot", run.followUp ? `Updated by follow-up at ${run.followUp.observedAt}` : "At the timing observation cutoff"]
    ]));
    ledger.append(card);
  }
  byId("run-ledger").replaceChildren(ledger);
}

function renderResponses(runs) {
  const nativeContent = byId("native-response-content");
  nativeContent.replaceChildren();
  for (const run of nativeFirst(runs).filter((item) => nativeMeasurement(item))) {
    const invocation = nativeMeasurement(run);
    const article = node("article", undefined, "stack");
    article.append(node("h3", `${run.runKey} / native invocation completion`),
      paragraph("Successful replies, failed invocations and all settled invocation outcomes are separate populations. Pending invocations have no completed duration and are excluded. The all-outcome percentile is not reply latency. These durations include native invocation pipeline overhead and are neither UI-stable latency nor backend TTFA.", "fine"));
    const tableContainer = node("div");
    table(tableContainer, `${run.runKey} / Native completion duration / ${label(run.surface)}`, ["Outcome population", "n", "Minimum", "p50", "p95", "Maximum"],
      [["Successful greeting replies", invocation.success], ["Failed invocations", invocation.failure], ["All invocation outcomes", invocation.allOutcomes]]
        .map(([name, timing]) => [name, timing ? number(timing.sampleCount) : "No samples", ...["minMs", "p50Ms", "p95Ms", "maxMs"].map((field) => timing?.[field] == null ? "Not reported" : seconds(timing[field]))]));
    article.append(tableContainer, paragraph(`Percentiles: ${words(invocation.percentileMethod)} within each population, never averaged or pooled with Teams timing. Display rounded to milliseconds; reviewed raw milliseconds remain in the public JSON.`, "fine"));
    if (run.pacedMeasurement) article.append(paragraph(`${pacedPhase(invocation)} only, using calibrated native RPC completion timing. Do not pool this cohort's percentiles with calibration stages, another hourly cohort or the earlier burst. Arrival window excludes the separately recorded drain.`, "fine"));
    else {
      const calibration = invocation.calibration;
      article.append(paragraph(`Completion timing was independently calibrated: ${number(calibration.shortRequestedMs)} ms and ${number(calibration.longRequestedMs)} ms local native RPC operations returned in ${seconds(calibration.shortObservedMs)} and ${seconds(calibration.longObservedMs)}. Ordinary CLI event/hook timestamps were coalesced and excluded; calibration demonstrates distinct completion measurements, not backend timing or eliminated client overhead.`, "fine"));
    }
    nativeContent.append(article);
  }
  const visibleRuns = runs.filter((run) => !nativeMeasurement(run));
  if (runs.some((run) => nativeMeasurement(run))) nativeContent.append(paragraph("First visible activity, first answer and UI-settled latency were not measured for native invocations. The separate visible endpoints below belong only to the earlier channel observations.", "fine"));
  if (!visibleRuns.length) {
    empty("response-content", "Visible latency is not measured.", "First activity, first actual answer and UI-settled timings remain separate until reviewed samples are available. A loading or tool-invocation status is not an answer.");
    return;
  }
  table("response-content", "Visible endpoints by run (milliseconds)", ["Run / surface / endpoint", "Timed / eligible messages", "p50", "p95", "Maximum"],
    visibleRuns.flatMap((run) => ["firstVisibleActivity", "firstVisibleLatency", "latency"].map((field) => {
      const timing = run[field];
      const activity = field === "firstVisibleActivity";
      const endpoint = activity ? "First activity (status or answer; not answer latency)"
        : field === "firstVisibleLatency" ? "First actual answer (status excluded)"
          : `UI settled${timing ? `; feedback controls + ${number(timing.stabilitySeconds)} s stable text` : ""}`;
      return [
        `${run.runKey} / ${label(run.surface)} / ${endpoint}`,
        `${timing ? number(timing.sampleCount) : "Not measured"} / ${number(activity ? run.counts.attempted : run.counts.completed)} ${activity ? "sent" : "successful"}`,
        ...["p50Ms", "p95Ms", "maxMs"].map((key) => timing ? `${number(timing[key])} ms` : "Not measured")
      ];
    })));
}

function renderThroughput(report) {
  if (!report.runs.length) empty("throughput-content", "No observed rate or overlap yet.", "No concurrency, arrival rate, completion pace or throttle threshold has been measured.");
  else table("throughput-content", "Observed windows, not platform capacity", ["Run / surface", "Observation window / outcomes", "Launch or arrival observation", "Maximum outstanding"],
    nativeFirst(report.runs).map((run) => [
      `${run.runKey} / ${label(run.surface)}`,
      run.pacedMeasurement ? `${pacedPhase(run.pacedMeasurement)}: ${number(run.pacedMeasurement.arrivalSeconds)} s offer window; observed end offset ${number(run.pacedMeasurement.arrivalEndObservedSeconds)} s + ${number(run.pacedMeasurement.drainSeconds)} s drain; ${label(run.pacedMeasurement.arrivalStatus)} / ${label(run.pacedMeasurement.drainStatus)}` :
      run.nativeInvocation ? `${number(run.counts.completed)} replies / ${number(run.counts.attempted)} invocation outcomes in ${number(run.windowSeconds)} s; not a sustained capacity result` :
      run.windowSeconds === null ? "Not measured" : run.counts.attempted === 1
        ? `${number(run.windowSeconds)} s; one sent message, not a throughput trial`
        : `${number(run.counts.completed / run.windowSeconds * 60)} completed/min over ${number(run.windowSeconds)} s`,
      run.pacedMeasurement ? `${number(run.pacedMeasurement.targetRpm)} intended / ${achievedRpm(run)} achieved client dispatches/min; no network/server arrival claim` :
      run.nativeInvocation ? `${run.nativeInvocation.dispatchWindowMs} ms client RPC launch spread only; network/server arrival spread unmeasured` :
      run.arrival === null ? "Not measured" : `${number(run.arrival.attempts / run.arrival.windowSeconds * 60)} attempts/min (${number(run.arrival.attempts)} over ${number(run.arrival.windowSeconds)} s)`,
      nativeMeasurement(run) ? `${nativeMeasurement(run).peakOutstanding === null ? "Not measured" : number(nativeMeasurement(run).peakOutstanding)} client invocations; backend/model execution overlap unmeasured` :
      run.concurrency === null ? "Not measured" : `${number(run.concurrency.maxInFlight)} messages; observed overlap`
    ]));
  for (const run of report.runs.filter((item) => item.pacedMeasurement)) {
    const paced = run.pacedMeasurement;
    const section = node("article", undefined, "stack");
    section.append(node("h3", `${run.runKey} / per-minute dispatch cohorts`),
      paragraph("Buckets are elapsed client-dispatch minutes, not clock-hour or rolling-hour maxima. Replies/errors are the later outcomes of requests dispatched in each bucket, recorded at the run cutoff; they are not completions occurring within that minute. Do not equate achieved dispatch rate with successful reply throughput.", "fine"),
      paragraph(`${number(paced.skippedSlots)} skipped + ${number(paced.unofferedSlots)} unoffered slots remain outside the attempt/error denominator. No replay of missed slots; no runner retries. Managed-service retries unknown.`, "fine"));
    const container = node("div");
    table(container, `${run.runKey} / ${pacedPhase(paced)} / outcomes by dispatch minute`, ["Start offset (s)", "Bucket duration (s)", "Attempts", "Greeting replies", "Errors", "Pending"],
      paced.minutes.map((minute) => ["offsetSeconds", "durationSeconds", "attempted", "completed", "failed", "pending"].map((key) => number(minute[key]))));
    section.append(container);
    byId("throughput-content").append(section);
  }
  if (!report.documentedLimits.length) {
    const note = node("article", undefined, "note");
    note.append(node("h3", "No numerical entries in this dataset"), paragraph("This does not mean unlimited capacity. Separately cited documentation below is not an observed capacity result."));
    byId("limits-content").replaceChildren(note);
  } else table("limits-content", "Documentation only / separate from observation", ["Limit / scope", "Value / metric", "Applicability", "Public source"],
    report.documentedLimits.map((limit) => {
      const link = node("a", `Documentation (retrieved ${limit.retrievedOn})`);
      link.href = limit.sourceUrl;
      return [`${limit.limitKey} / ${label(limit.harnessScope)} / ${words(limit.scope)}`, `${number(limit.value)} ${words(limit.metric)}`, words(limit.applicability), link];
    }));
}

function renderObservations(runs) {
  if (!runs.length) {
    empty("observations-content", "No reviewed stage or error observations.", "A lack of observations is not evidence of no throttling, no failures or successful workflow execution.");
    return;
  }
  const stack = node("div", undefined, "stack");
  for (const run of nativeFirst(runs)) {
    const card = node("article", undefined, "card");
    card.append(node("h3", `${run.runKey} / ${label(run.surface)}`, "run-title"));
    card.append(paragraph(`${number(run.counts.attempted)} ${nativeMeasurement(run) ? "native invocations attempted" : "sent"}; ${number(run.counts.completed)} successful requested outcomes, ${number(run.counts.failed)} failed, ${number(run.counts.pending)} pending ${run.followUp ? "after the reviewed follow-up" : "at cutoff"}.`));
    if (!run.errors.length) card.append(paragraph("No failed messages recorded in this reviewed window. This is not a claim that throttling cannot occur.", "fine"));
    for (const error of run.errors) {
      card.append(paragraph(`${error.evidence === "workiq_mcp_transport_429" ? "Transport throttling" : label(error.category)}: ${number(error.count)} / evidence: ${label(error.evidence)}`));
      if (error.evidence === "workiq_mcp_transport_429") card.append(paragraph("This is a WorkIQ MCP HTTP transport response, not evidence of a GitHub Copilot Harness quota or capacity ceiling. No conversation identifier or Retry-After was exposed for this failure. Missing an identifier does not prove absence of backend activity. No raw transport stack is published.", "fine"));
    }
    if (run.pacedMeasurement) {
      const paced = run.pacedMeasurement;
      card.append(paragraph(`${pacedPhase(paced)}; qualification ${label(paced.qualification)}. Arrival ${label(paced.arrivalStatus)}; drain ${label(paced.drainStatus)}.${paced.stopReason ? ` Stop reason: ${pacedStopLabel(run)}.` : ""} A full arrival window does not mean every slot was dispatched or every operation succeeded.`),
        paragraph(`Absolute ${number(paced.pacing.intervalMs)} ms client slots; 5% minimum-gap allowance. Observed minimum gap: ${paced.pacing.observedMinIntervalMs === null ? "not measured" : `${number(paced.pacing.observedMinIntervalMs)} ms`}; violating intervals: ${paced.pacing.violatingIntervals === null ? "not measured" : number(paced.pacing.violatingIntervals)}. Skipped slots are not replayed.`),
        paragraph(`Fresh conversation per request is the configured policy, not proof of conversation/session counts. Verified distinct returned conversations: ${run.units.conversations ?? "unknown"}; from failed outcomes: ${paced.failedConversations ?? "unknown"}. No identifiers are public.`, "fine"),
        paragraph(`Offer-window duration: ${paced.arrivalSeconds} s. Independently observed arrival-end offset: ${paced.arrivalEndObservedSeconds} s; drain: ${paced.drainSeconds} s; full observation through drain: ${run.windowSeconds} s. Timer overshoot and separate cutoff reads are retained, not rounded into equality; wall-clock metadata is a separate clock source.`, "fine"),
        paragraph("Greeting-only requests; no workflow, approval or email workload. Native completion includes client/pipeline overhead. Unclassified invocation failures do not establish throttling or a harness-wide ceiling. No burst history or Monitor evidence is assumed to cover this cohort.", "fine"));
    }
    if (run.nativeInvocation) {
      const invocation = run.nativeInvocation;
      const history = invocation.history;
      card.append(paragraph("All failed invocations returned the same generic WorkIQ/Microsoft 365 server_error with native resultType=failure; these were not runner JSON-parse errors. This is unclassified invocation failure evidence, not confirmed GitHub Copilot Harness throttling. No explicit 429, Retry-After, RATE_LIMIT_REACHED or numeric quota evidence was observed. The limiting layer is unknown."));
      card.append(paragraph(`Published target was verified by manifest and registry matching. All ${number(run.units.conversations)} conversation identifiers were checked for uniqueness, including the ${number(invocation.failedConversations)} returned inside failure payloads. No identifiers are published.`));
      card.append(paragraph(history.membership === "exact_intersection_verified"
        ? `All ${number(history.completedConversations)} successful reply conversations exactly matched Completed Microsoft 365 Copilot entries in Studio history.`
        : `${number(history.completedConversations)} Completed Microsoft 365 Copilot history entries corroborate the count; exact membership remains unverified.`));
      card.append(paragraph(`${number(history.failedConversationsAbsent)} failed-invocation conversations were absent from the returned ${number(history.snapshotRows)}-row snapshot, but hasMore=true: it is not exhaustive and history can lag. Absence does not prove those calls never reached the harness. No lastStep tool was recorded on matched successful rows. The earlier probes and other-surface rows are not added to this burst.`));
      card.append(paragraph(`Runner retries: ${invocation.runnerRetries}; managed-service retries remain unknown. Greetings only: no workflow, approval or email requests. ${number(invocation.excludedPreflights)} earlier Microsoft 365 probes are excluded.`, "fine"));
    }
    for (const issue of run.clientIssues) card.append(paragraph(`Excluded client setup issue: ${number(issue.count)} unsent draft${issue.count === 1 ? "" : "s"}${issue.observedWaitSeconds === null ? "" : `; observed wait ${number(issue.observedWaitSeconds)} s`}. Not a sent message, agent failure or throttling outcome.`, "fine"));
    if (run.followUp) {
      const followUp = run.followUp;
      card.append(node("h4", "Later agent-call outcome / requested submission failed"));
      card.append(paragraph(`At the ${number(run.windowSeconds)} s timing cutoff: ${number(followUp.atCutoff.completed)} successful, ${number(followUp.atCutoff.failed)} failed, ${number(followUp.atCutoff.pending)} pending. At ${followUp.observedAt}, a later agent message reported a workflow HTTP ${followUp.reportedHttpStatus} timeout and unconfirmed submission. This is agent-reported, not independently observed wire-level HTTP status and not throttling.`));
      card.append(paragraph("An earlier response was marked stopped. A later grounded draft was visible, but that is not successful review submission. No draft, internal citations or personal metadata are reproduced. No retry was performed. Exact first-answer and settled latency outside the original timing window remain unmeasured."));
    }
    if (run.workflowState) {
      const workflow = run.workflowState;
      card.append(node("h4", "Review workflow still running / separate history check"));
      card.append(paragraph(`Review-tool invocation status first appeared ${number(workflow.invocationStatusFirstSeenMs / 1000)} s after send. This is not first activity, notification delivery or a human decision.`));
      card.append(definitionList([
        ["History checked", "After the message observation cutoff"],
        ["Running workflow runs", number(workflow.runningRuns)],
        ["Trigger", label(workflow.triggerStatus)],
        ["Human review action", label(workflow.humanReviewStatus)],
        ["Email action", label(workflow.emailStatus)],
        ["Final outputs", label(workflow.finalOutputs)],
        ["Review notification delivery", label(workflow.reviewNotificationDelivery)],
        ["Actual human decision", label(workflow.humanDecision)],
        ["Tester approval or email action", label(workflow.testerApprovalOrEmail)]
      ]));
      card.append(paragraph("The workflow reached a waiting review action. An agent-call timeout does not establish workflow cancellation or absence of a review. Notification delivery and a human decision remain unconfirmed.", "fine"));
    }
    for (const observation of run.observations) card.append(paragraph(label(observation), "fine"));
    if (!run.observations.length && !nativeMeasurement(run)) card.append(paragraph("No additional structured observations recorded.", "fine"));
    stack.append(card);
  }
  byId("observations-content").replaceChildren(stack);
}

function renderCosts(report) {
  const { runs } = report;
  if (!runs.length) {
    empty("costs-content", "Cost evidence is awaiting the pilot.", "No cost amount has been reported or settled. The first run must carry an explicit cost status, even when billing evidence is pending.");
    return;
  }
  table("costs-content", "Cost evidence by run / no cross-surface total", ["Run / surface", "Status", "Amount", "Evidence / scope"],
    nativeFirst(runs).map((run) => {
      const cost = run.cost;
      return [
        `${run.runKey} / ${label(run.surface)}`, cost.status.toUpperCase(),
        cost.status === "settled" ? `${cost.currency} ${cost.amount}` : "Not settled",
        cost.status === "settled" ? `${label(cost.source)} / ${label(cost.scope)} / ${cost.recordedOn}` : "No settled billing evidence"
      ];
    }));
  if (report.studyContext?.prePilotMonitor === "no_sessions_or_credits_recorded") {
    const note = node("article", undefined, "note");
    note.append(node("h3", "Earlier Teams pilot Monitor is not settled billing evidence"), paragraph("No sessions or credits were recorded in the pre-pilot Monitor check for the scoped Teams runs. Analytics and billing meters can lag; that observation is not zero usage or zero cost. Runtime session counts remain unknown."));
    byId("costs-content").append(note);
  }
  if (report.studyContext?.postPilotMonitor === "no_sessions_or_credits_recorded") byId("costs-content").append(paragraph("A later check after the Teams pilot (before the native burst) also showed no recorded sessions or credits. Delayed meters still do not establish zero cost; all unsettled amounts remain null.", "fine"));
  for (const run of runs.filter((item) => item.nativeInvocation)) {
    const monitor = run.nativeInvocation.postRunMonitor;
    const note = node("article", undefined, "note boundary");
    note.append(node("h3", `${run.runKey} / stale preburst analytics`),
      paragraph(`Monitor checked at ${monitor.checkedAt} said it was updated ${number(monitor.updatedMinutesAgo)} minutes earlier. It showed ${number(monitor.sessions)} old Teams session and ${number(monitor.messages)} messages, with no credits recorded. These are stale preburst analytics, not this burst's session or credit totals. They neither measure zero cost nor settle the pending billing amount.`));
    byId("costs-content").append(note);
  }
  for (const campaign of report.pacedCampaigns ?? []) {
    const monitor = campaign.postCampaignMonitor;
    const note = node("article", undefined, "note boundary");
    note.append(node("h3", `${campaign.campaignKey} / stale Monitor, costs pending`),
      paragraph(`Monitor checked at ${monitor.checkedAt} still showed ${number(monitor.sessions)} old sessions and no posted credits, with a refresh ${number(monitor.updatedMinutesAgo)} minutes earlier. This stale precampaign snapshot is not attributed usage for these cohorts and is not zero cost. The request-count budget was not a hard monetary limit or billing evidence.`));
    byId("costs-content").append(note);
  }
}

const themeQuery = window.matchMedia("(prefers-color-scheme: dark)");
const explicitTheme = () => {
  const value = new URLSearchParams(window.location.search).get("scoutTheme");
  return value === "light" || value === "dark" ? value : null;
};
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const next = theme === "light" ? "dark" : "light";
  byId("theme-toggle").textContent = `${next[0].toUpperCase()}${next.slice(1)} theme`;
  byId("theme-toggle").setAttribute("aria-label", `Switch to ${next} theme`);
}
setTheme(explicitTheme() ?? (themeQuery.matches ? "dark" : "light"));
byId("theme-toggle").hidden = false;
byId("theme-toggle").addEventListener("click", () => {
  const theme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  const url = new URL(window.location.href);
  url.searchParams.set("scoutTheme", theme);
  window.history.replaceState(null, "", url);
  setTheme(theme);
});
themeQuery.addEventListener("change", () => {
  if (!explicitTheme()) setTheme(themeQuery.matches ? "dark" : "light");
});
window.addEventListener("popstate", () => setTheme(explicitTheme() ?? (themeQuery.matches ? "dark" : "light")));

const sections = [...document.querySelectorAll("main > section")];
function navigate() {
  // The skip link must not reset the current section.
  if (window.location.hash === "#main") return;
  const requested = window.location.hash.slice(1);
  const active = sections.some((section) => section.id === requested) ? requested : "overview";
  for (const section of sections) section.hidden = section.id !== active;
  for (const link of document.querySelectorAll(".section-nav a")) {
    if (link.hash === `#${active}`) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
}
window.addEventListener("hashchange", navigate);
navigate();

try {
  const report = JSON.parse(byId("report-data").textContent);
  const schema = JSON.parse(byId("report-schema").textContent);
  assertReport(report, schema);
  renderCapacity(report);
  renderOverview(report);
  renderReliability(report.runs);
  renderResponses(report.runs);
  renderThroughput(report);
  renderFailureSummary(report.runs);
  renderObservations(report.runs);
  renderCosts(report);
  const reviewed = report.publication.status === "reviewed";
  byId("publication-status").textContent = reviewed ? "REVIEWED AGGREGATES" : "NOT MEASURED";
  byId("publication-status").classList.toggle("reviewed", reviewed);
  byId("review-status").textContent = reviewed ? `Public aggregate review: ${report.publication.reviewedOn}. Run dates and cost settlement may differ.` : "Awaiting pilot / no measured results published";
} catch {
  for (const id of ["capacity-summary", "overview-summary", "run-ledger", "reliability-content", "failure-summary", "native-response-content", "response-content", "throughput-content", "limits-content", "observations-content", "costs-content"]) byId(id).replaceChildren();
  byId("publication-status").textContent = "DATA REJECTED";
  byId("publication-status").classList.add("rejected");
  byId("review-status").textContent = "No metrics displayed.";
  byId("data-error").textContent = "The public aggregate could not be validated or rendered. Results are withheld. Report this issue to the repository maintainer.";
  byId("data-error").hidden = false;
  console.error("Public report validation or rendering failed; results withheld.");
}
