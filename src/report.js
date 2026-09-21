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
  client_pacing: "Local client pacing/admission stop; not provider throttling",
  native_disconnected_no_conversation: "Native disconnected result; no returned conversation; remote admission unknown",
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
const nativeFirst = (runs) => orderRunsByRate(runs);
const scopedContext = (report, run) => report.studyContext?.runKeys.includes(run.runKey) ? report.studyContext : null;
const seconds = (milliseconds) => `${(milliseconds / 1000).toFixed(3)} s`;
const pacedPhase = (measurement) => measurement.phase === "minute_retest" ? "One-minute 100-request retest"
  : measurement.phase === "count_retest" ? "Count-bound 100-request retest"
  : measurement.phase === "capacity_screen" ? "Five-minute zero-error screen"
  : measurement.phase === "capacity_hour" ? "Zero-error hour validation"
  : measurement.phase === "hour" ? "Hourly arrival cohort" : "Rate calibration cohort";
const isRetest = (run) => ["minute_retest", "count_retest"].includes(run.pacedMeasurement?.phase);
const isHourly = (run) => ["hour", "capacity_hour"].includes(run.pacedMeasurement?.phase);
const isCapacityCohort = (run) => ["capacity_screen", "capacity_hour"].includes(run.pacedMeasurement?.phase);
const achievedRpm = (run) => observedPacedRpm(run) === null ? "Not measured" : number(observedPacedRpm(run));
const postCloseLabel = (run) => run.pacedMeasurement.capacityEvidence?.postCloseActivity === "local_bookkeeping_only"
  ? "local post-close bookkeeping (no calls pending; not server-drain latency)" : "drain";
const postCloseSummary = (run) => `${number(run.pacedMeasurement.drainSeconds)} s ${postCloseLabel(run)}`;
const pacedStopLabel = (run) => run.pacedMeasurement.stopReason === "explicit_throttle" && run.errors.some((error) => error.evidence === "workiq_mcp_transport_429")
  ? label("workiq_mcp_transport_429")
  : isCapacityCohort(run) && run.pacedMeasurement.stopReason === "native_error"
    ? "First non-success closed this stage; not a rate-limit finding"
    : label(run.pacedMeasurement.stopReason);

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
const outcomeRatio = (counts) => counts.attempted ? `${number(counts.completed)} / ${number(counts.attempted)} (${number(counts.completed / counts.attempted * 100)}%)` : "No attempts";
const sourceWindow = (candidate) => `${candidate.runKey}; ${number(candidate.targetRpm)} intended RPM; dispatch offsets ${number(candidate.offsetSeconds)}-${number(candidate.offsetSeconds + candidate.windowSeconds)} s`;
const cohortNames = {
  "m365-native-burst-100": "100-request burst",
  "paced-calibration-10": "10/min calibration",
  "paced-calibration-25": "25/min calibration",
  "paced-calibration-50": "50/min calibration",
  "paced-hour-25-stopped": "25/min hour attempt",
  "paced-standalone-100-stopped": "100/min aborted",
  "paced-spread-25-completed": "25/min follow-up",
  "paced-minute-100-retest": "100/min retest",
  "paced-minute-100-local-stop": "100/min local stop",
  "paced-elastic-100-completed": "100/min target retest",
  "capacity-25-transport-stop": "25/min screen stopped"
};
const cohortName = (run) => cohortNames[run.runKey] ?? run.runKey;
const outcomeSeries = [
  { key: "completed", label: "Successful greetings", className: "series-success" },
  { key: "failed", label: "Failed invocations", className: "series-failure" },
  { key: "pending", label: "Pending", className: "series-pending" }
];

function capacityStudyCard(study) {
  const card = node("article", undefined, "note block");
  card.dataset.capacityStudy = study.campaignKey;
  const totals = study.runs.reduce((sum, run) => {
    for (const key of Object.keys(sum)) sum[key] += run.counts[key];
    return sum;
  }, { attempted: 0, completed: 0, failed: 0, pending: 0 });
  const cleanHours = study.hours.filter((run) => run.pacedMeasurement.qualification === "qualified").length;
  const failedScreen = study.screens.find((run) => run.pacedMeasurement.qualification !== "qualified");
  card.append(paragraph("REVIEWED ZERO-ERROR STUDY / SEPARATE FROM HISTORICAL CALIBRATIONS", "eyebrow"),
    node("h3", study.validatedRpm === null ? "No validated rate from this study" : `${number(study.validatedRpm)}/min passed the screen and both hours`),
    paragraph(`${number(totals.attempted)} actual attempts / ${number(totals.completed)} greeting replies / ${number(totals.failed)} failed invocations / ${number(totals.pending)} pending. Failure denominator: actual attempts, never the 7,125-call upper bound.`),
    paragraph(study.highestCleanScreen
      ? `Highest clean five-minute screen: ${number(study.highestCleanScreen.pacedMeasurement.targetRpm)} intended RPM. ${cleanHours} / 2 strictly qualifying full hours recorded at that candidate rate. A screen or one hour alone is not a validated rate.`
      : "No clean screen in this study, so no eligible hour candidate. Earlier campaigns cannot supply a candidate."),
    paragraph(`${study.screens.length} nonempty screen cohort(s) and ${study.hours.length} nonempty hour cohort(s) recorded. Never-started stages have no result. Costs: ${study.runs.every((run) => run.cost.status === "pending") ? "pending, not zero" : "see the separately reviewed cost records"}.`));
  if (failedScreen) card.append(paragraph(`${number(failedScreen.pacedMeasurement.targetRpm)} RPM screen did not qualify: ${number(failedScreen.counts.attempted)} / ${number(failedScreen.pacedMeasurement.plannedSlots)} planned slots actually sent; ${number(failedScreen.pacedMeasurement.unofferedSlots)} unoffered / ${number(failedScreen.pacedMeasurement.skippedSlots)} skipped. ${failedScreen.pacedMeasurement.stopReason ? pacedStopLabel(failedScreen) : "Strict zero-error evidence requirements were not met"}. No escalation after that screen.`));
  const disconnected = study.runs.reduce((sum, run) => sum + run.errors.filter((error) => error.evidence === "native_disconnected_no_conversation").reduce((count, error) => count + error.count, 0), 0);
  if (disconnected) card.append(paragraph(`${number(disconnected)} disconnected/invoke result(s) returned no conversation identifier. Remote agent admission is unknown. A transport disconnection is not proof of an agent/backend failure, provider throttling or capacity at the intended sending rate.`));
  if (totals.attempted === 1) card.append(paragraph("Only one invocation was attempted. Observed spacing and offered rate are not measured; no full minute or hour was observed. No successful-response timing sample exists. Neither 25 RPM capacity nor a failure threshold can be inferred."));
  for (const run of study.runs.filter((item) => item.pacedMeasurement.capacityEvidence.postCloseActivity === "local_bookkeeping_only")) {
    card.append(paragraph(`${run.runKey}: ${postCloseSummary(run)} after dispatch close. No native requests remained outstanding at close or returned afterward; native failure duration is reported separately.`, "fine"));
  }
  card.append(paragraph("Protocol: 25/30/35/40/45/50 RPM screens, each planned for five minutes. Ordinary first non-success closes the screen and stops escalation; only an earlier clean screen in this study may supply both hour validations. Explicit safety stops end the whole study; any failed hour ends validation.", "fine"),
    paragraph("Absolute not-before slots, minimum actual spacing 95% of nominal, no backlog replay or retries; 60 seconds of quiet after drain is not a quota-reset claim. Both hours are same-session validation, not different-day replication. Every planned greeting, zero errors/pending/unused slots, unique returned conversations and clean clock/evidence are required.", "fine"),
    paragraph(study.upperBoundaryUnbracketed ? "50 RPM is only a tested lower bound; the maximum remains unbracketed. These bounded clean samples do not guarantee universal 100% reliability or platform-wide capacity."
      : "No platform-wide ceiling or universal 100% reliability follows from these bounded samples. Failures do not identify a limiting layer or justify extrapolation.", "fine"));
  const details = node("details");
  details.append(node("summary", "Study cohorts and actual in-window completion counts"));
  const container = node("div");
  table(container, `Zero-error study / ${study.campaignKey}`,
    ["Cohort / intended rate", "Observed arrivals / planned", "Eventual greetings / actual attempts", "Failures / pending", "Strict qualification", "Successful completions inside / after arrival window"],
    study.runs.map((run) => {
      const paced = run.pacedMeasurement, evidence = paced.capacityEvidence;
      return [`${run.runKey} / ${pacedPhase(paced)} / ${number(paced.targetRpm)} RPM`,
        `${number(paced.arrivalSeconds)} / ${number(paced.plannedArrivalSeconds)} s`,
        outcomeRatio(run.counts), `${number(run.counts.failed)} / ${number(run.counts.pending)}`,
        label(paced.qualification), evidence.successfulWithinArrivalWindow === null ? "Unknown / unknown"
          : `${number(evidence.successfulWithinArrivalWindow)} / ${number(evidence.successfulAfterArrivalWindow)}`];
    }));
  details.append(container, paragraph("Completion counts use the half-open elapsed arrival window [0, arrivalSeconds), not dispatch-minute cohort outcomes. For a full hour this is exactly 3,600 seconds; later successes are separate, including timer overshoot and drain. Unknown counts stay unknown, not zero.", "fine"));
  card.append(details);
  return card;
}

function minuteRetestCard(run) {
  const paced = run.pacedMeasurement;
  const countBound = paced.phase === "count_retest";
  const allDispatched = run.counts.attempted === paced.plannedSlots;
  const settled = run.counts.pending === 0;
  const complete = allDispatched && settled && ["full_window", "count_complete"].includes(paced.arrivalStatus);
  const card = node("article", undefined, "note block");
  card.dataset.minuteRetest = run.runKey;
  card.append(
    paragraph(complete ? (countBound ? "REVIEWED 100-REQUEST COHORT / COUNT COMPLETE AND DRAINED" : "REVIEWED 100-REQUEST COHORT / FULL MINUTE AND DRAIN") : "REVIEWED RETEST / INCOMPLETE OR UNRESOLVED", "eyebrow"),
    node("h3", allDispatched && settled ? `100-request retest: ${number(run.counts.failed)} failed out of 100`
      : `Retest incomplete: ${number(run.counts.failed)} failures / ${number(run.counts.attempted)} attempts`),
    paragraph(`${number(run.counts.completed)} successful greetings / ${number(run.counts.failed)} failed invocations / ${number(run.counts.pending)} pending. ${allDispatched ? "All 100 planned requests were sent." : `${number(paced.unofferedSlots)} unoffered and ${number(paced.skippedSlots)} skipped slots were not sent and are not failures.`}`),
    paragraph(`${countBound ? "Target: 100 total requests, nominally 100/min. Planned spacing is at least 600 ms, rebased from actual dispatch with no catch-up. The 60-second plan may extend." : "Target: 100 requests/minute for 60 seconds, not a 100-request burst."} Actual arrival window: ${number(paced.arrivalSeconds)} s; drain: ${number(paced.drainSeconds)} s (${label(paced.drainStatus)}). ${paced.stopReason ? `Dispatch stop: ${pacedStopLabel(run)}.` : "No early dispatch stop recorded."}`),
    paragraph("For this separately authorized retest, ordinary generic invocation errors were counted without the earlier three-error cutoff. Explicit throttle, backoff, authentication and other safety guards still applied. No retries or automatic continuation.", "fine"),
    paragraph("Completing this 100-request cohort does not establish an hourly rate, a two-minute calibration qualification, a failure cause or a service quota. Outcomes include drain; costs are reported separately.", "fine")
  );
  if (countBound) card.append(paragraph(`Observed offered rate: ${achievedRpm(run)} client dispatches/min over the actual arrival window. Count completion is not proof of 100 starts inside one minute or sustained capacity; this is not a fixed-minute calibration.`));
  const disconnected = run.errors.find((error) => error.evidence === "native_disconnected_no_conversation");
  if (disconnected) {
    const generic = run.errors.filter((error) => error.evidence === "unclassified_invocation_failure").reduce((sum, error) => sum + error.count, 0);
    card.append(paragraph(`Failure evidence: ${number(generic)} generic server_error/invoke results and ${number(disconnected.count)} disconnected/invoke result(s). The disconnected attempt returned no conversation identifier; remote admission is unknown. These are native invocation failures, not ${number(run.counts.failed)} proven agent/backend failures. ${run.units.conversations === null ? "Distinct returned conversations were not measured." : `${number(run.units.conversations)} distinct returned conversations were verified.`}`));
  }
  if (!allDispatched) card.append(paragraph(`The full 100-request denominator was not observed. Failure rate is ${number(run.counts.failed / run.counts.attempted * 100)}% of the ${number(run.counts.attempted)} actual attempts, not ${number(run.counts.failed)}/100. Nothing is inferred about the requests that were never sent.`));
  if (run.runKey === "paced-minute-100-local-stop") card.append(paragraph("The local runner missed the admission deadline for planned request 42. The 15 generic invocation errors did not stop dispatch; the local timing guard did. This run therefore does not establish agent capacity at 100/min.", "fine"));
  return card;
}

function renderCharts(runs) {
  const ordered = nativeFirst(runs).filter((run) => nativeMeasurement(run));
  const rows = nativeChartRows(ordered);
  if (!rows.length) {
    for (const id of ["overview-charts", "latency-charts", "concurrency-charts"]) empty(id, "No native load chart yet.", "No eligible native measurements; visible Teams turns are reported separately.");
  } else {
    const byKey = new Map(ordered.map((run) => [run.runKey, run]));
    const outcomeChart = (selected, title, description) => barChart({
      title, description,
      domain: 100, unit: "%", stacked: true, series: outcomeSeries,
      rows: selected.map((row) => ({
        key: row.runKey, label: cohortName(row), values: row.percentages,
        summary: `${row.counts.completed} successful / ${row.counts.attempted} attempts; ${row.counts.failed} failed; ${row.counts.pending} pending`,
        summaryLines: [`${row.counts.completed} / ${row.counts.attempted} replies`, row.percentages[0] === null ? "No attempt ratio" : `${number(row.percentages[0])}% success`],
        detail: `${row.counts.failed} failed; ${row.counts.pending} pending. ${byKey.get(row.runKey).pacedMeasurement ? `${number(byKey.get(row.runKey).pacedMeasurement.arrivalSeconds)} s arrivals + drain` : "Burst; not a paced minute"}.`
      }))
    });
    const overview = byId("overview-charts");
    overview.replaceChildren();
    for (const study of summarizeCapacityStudies(runs)) overview.append(capacityStudyCard(study));
    const latestRetest = ordered.filter(isRetest).at(-1);
    if (latestRetest) overview.append(minuteRetestCard(latestRetest));
    const paced = rows.filter((row) => row.targetRpm !== null);
    const bursts = rows.filter((row) => row.targetRpm === null);
    if (paced.length) {
      const chart = outcomeChart(paced, "Paced load / success by intended sending rate",
        "Rows increase from lower to higher requests/minute; equal-rate cohorts retain chronological order. Bar width is eventual successful replies divided by actual attempts, including drain, not the sending rate or a capacity guarantee. Different durations and campaigns remain separate.");
      chart.dataset.loadShape = "paced";
      overview.append(chart);
    }
    const slower = byKey.get("paced-spread-25-completed");
    const faster = byKey.get("paced-standalone-100-stopped");
    if (slower && faster) {
      const explanation = node("article", undefined, "note block");
      explanation.id = "rate-success-explanation";
      explanation.append(node("h3", "Sending rate and success rate are different"),
        paragraph(`${slower.pacedMeasurement.targetRpm}/min schedules a call about every ${number(60 / slower.pacedMeasurement.targetRpm)} seconds; ${faster.pacedMeasurement.targetRpm}/min schedules one every ${number(60 / faster.pacedMeasurement.targetRpm)} seconds. The slower follow-up returned ${slower.counts.completed}/${slower.counts.attempted} greetings. The faster trial stopped early after only ${faster.counts.attempted} dispatches, with ${faster.counts.completed} eventual greetings and ${faster.counts.failed} generic invocation errors after dispatched calls settled. It did not complete a full minute.`));
      if (latestRetest) explanation.append(paragraph(`This comparison describes the earlier ${faster.observedOn} aborted attempt and ${slower.observedOn} slower follow-up, not the new 100-request retest above.`, "fine"));
      const hour = byKey.get("paced-hour-25-stopped");
      if (hour) explanation.append(paragraph(`The longer ${hour.pacedMeasurement.targetRpm}/min attempt was not 100% successful: ${hour.counts.completed}/${hour.counts.attempted} eventual greetings, ending on WorkIQ transport HTTP 429. Passing a short lower-rate trial does not guarantee a higher-rate or longer trial will pass.`));
      explanation.append(paragraph("These trials happened at different times with different observed client overlap. They do not isolate the cause of the generic errors or establish a GitHub Copilot Harness quota; cooldown and background conditions could also contribute.", "fine"));
      overview.append(explanation);
    }
    if (bursts.length) {
      const chart = outcomeChart(bursts, "Separate burst / not a requests-per-minute test",
        "Requests were launched together, rather than paced across a minute. This burst is shown separately so 100 requests is not mistaken for 100/min. Its bar uses the same eventual-outcome percentage scale.");
      chart.dataset.loadShape = "burst";
      overview.append(chart);
    }
    byId("latency-charts").replaceChildren(barChart({
      title: "Successful reply duration / median and tail",
      description: "Native invocation completion, measured separately for successful replies in each cohort. Paced rows increase by intended rate; the burst is last and is not an RPM trial. No pooled percentiles, failure durations, backend TTFA or invented distribution.",
      unit: " s", series: [
        { key: "p50", label: "p50 / median", className: "series-primary" },
        { key: "p95", label: "p95 / tail", className: "series-secondary" }
      ],
      rows: rows.map((row) => ({
        key: row.runKey, label: cohortName(row), values: row.latencySeconds,
        summary: row.successfulSamples ? `p50 ${number(row.latencySeconds[0])} s; p95 ${number(row.latencySeconds[1])} s; n=${row.successfulSamples}` : "No successful timing samples",
        summaryLines: row.successfulSamples ? [`p50 ${number(row.latencySeconds[0])} s`, `p95 ${number(row.latencySeconds[1])} s`] : ["No samples"],
        detail: `n=${row.successfulSamples} successful invocation durations`
      }))
    }));
    byId("concurrency-charts").replaceChildren(barChart({
      title: "Observed peak outstanding client calls",
      description: "Client calls whose measured lifetimes overlapped, ordered by intended paced rate with the burst last. This is not a worker setting, agent admission count or simultaneous backend/model execution. The 25/min follow-up still had a configured client cap of 100, not five.",
      series: [{ key: "peak", label: "Observed client peak", className: "series-primary" }],
      rows: rows.map((row) => ({
        key: row.runKey, label: cohortName(row), values: [row.peakOutstanding],
        summary: row.peakOutstanding === null ? "Not measured" : `${row.peakOutstanding} outstanding client calls`,
        summaryLines: [row.peakOutstanding === null ? "Not measured" : `${row.peakOutstanding} calls`],
        detail: `${row.counts.completed} / ${row.counts.attempted} eventual greetings; ${row.counts.failed} failed`
      }))
    }));
  }
  const content = byId("concurrency-content");
  content.replaceChildren();
  if (ordered.length) table(content, "Client overlap and outcomes / not a concurrency quota",
    ["Cohort", "Observed peak", "Eventual success", "Boundary"],
    ordered.map((run) => [cohortName(run), nativeMeasurement(run).peakOutstanding ?? "Not measured", outcomeRatio(run.counts), loadStatus(run)]));
  if (runs.some((run) => run.runKey === "paced-spread-25-completed") && runs.some((run) => run.runKey === "paced-standalone-100-stopped")) content.append(paragraph("The later spread-out 25/min cohort returned 50/50 greetings with peak five, versus 12/21 with peak 18 in the separate 100/min attempt. Time, cooldown and background conditions also changed. This is not proof of causality, a five-call configuration, or a twelve-call service limit.", "fine"));
}

function labelledControl(labelText, id, options) {
  const field = node("div", undefined, "control-field");
  const caption = node("label", labelText);
  caption.htmlFor = id;
  const control = node(options ? "select" : "input");
  control.id = id;
  if (options) for (const [value, text] of options) {
    const option = node("option", text);
    option.value = value;
    control.append(option);
  }
  else control.type = "search";
  field.append(caption, control);
  return { field, control };
}

function renderTimeline(runs) {
  const paced = nativeFirst(runs).filter((run) => run.pacedMeasurement);
  if (!paced.length) {
    empty("timeline-content", "No dispatch-minute series.", "A burst or individual visible turn is not a full offered-load minute.");
    return;
  }
  const target = byId("timeline-content");
  const controls = node("div", undefined, "searchbar");
  const choice = labelledControl("Dispatch timeline / choose a cohort", "timeline-run", paced.map((run) => [run.runKey, cohortName(run)]));
  choice.control.value = [...paced].filter(isCapacityCohort).sort((a, b) => a.pacedMeasurement.startedAt.localeCompare(b.pacedMeasurement.startedAt)).at(-1)?.runKey
    ?? paced.find(isHourly)?.runKey ?? paced.at(-1).runKey;
  controls.append(choice.field);
  const chart = node("div", undefined, "timeline-chart");
  const status = paragraph(undefined, "fine");
  status.setAttribute("role", "status");
  const draw = () => {
    const run = paced.find((item) => item.runKey === choice.control.value);
    const measurement = run.pacedMeasurement;
    chart.replaceChildren(barChart({
      title: `${cohortName(run)} / outcomes by dispatch window`,
      description: "Bars group requests by when they were dispatched, with their eventual outcomes at the final cutoff. They are not completions occurring in each minute. Partial buckets remain partial; no hourly extrapolation.",
      stacked: true, series: outcomeSeries,
      rows: measurement.minutes.map((minute) => ({
        key: `${run.runKey}-${minute.offsetSeconds}`,
        label: `${number(minute.offsetSeconds)}-${number(minute.offsetSeconds + minute.durationSeconds)} s`,
        values: [minute.completed, minute.failed, minute.pending],
        summary: `${minute.completed} greetings / ${minute.attempted} attempts; ${minute.failed} failed; ${minute.pending} pending`,
        summaryLines: [`${minute.completed} / ${minute.attempted} replies`, `${minute.failed} failed`],
        detail: `${minute.durationSeconds === 60 ? "Full dispatch minute" : `${number(minute.durationSeconds)} s partial bucket`}; ${minute.pending} pending`
      }))
    }));
    status.textContent = `${run.runKey}: ${number(measurement.arrivalSeconds)} s arrivals + ${postCloseSummary(run)}. ${loadStatus(run)} ${number(measurement.unofferedSlots)} unoffered / ${number(measurement.skippedSlots)} skipped; neither is an agent failure. The affected dispatch bucket does not identify the time an error returned.`;
  };
  choice.control.addEventListener("change", draw);
  target.replaceChildren(controls, chart, status);
  draw();
}

function renderStages(runs) {
  if (!runs.length) {
    empty("stages-content", "No reviewed stages.", "Nothing has been measured or inferred.");
    return;
  }
  const target = byId("stages-content");
  const controls = node("div", undefined, "searchbar");
  const search = labelledControl("Search stage or model", "stage-search");
  const surface = labelledControl("Surface", "stage-surface", [["all", "All surfaces"], ...[...new Set(runs.map((run) => run.surface))].map((value) => [value, label(value)])]);
  const outcome = labelledControl("Outcomes", "stage-outcome", [["all", "All outcomes"], ["failed", "Stages with failures"], ["clean", "No failed or pending outcomes"]]);
  const sort = labelledControl("Sort stages", "stage-sort", [["recorded", "Recorded order"], ["failures", "Most failures"], ["success", "Lowest success percentage"]]);
  for (const item of [search, surface, outcome, sort]) controls.append(item.field);
  const results = node("div");
  const status = paragraph(undefined, "fine");
  status.id = "stage-match-count";
  status.setAttribute("role", "status");
  const draw = () => {
    const query = search.control.value.trim().toLowerCase();
    const selection = runs.filter((run) => `${run.runKey} ${run.model ?? ""} ${cohortName(run)}`.toLowerCase().includes(query)
      && (surface.control.value === "all" || surface.control.value === run.surface)
      && (outcome.control.value === "all" || (outcome.control.value === "failed" ? run.counts.failed > 0 : run.counts.failed === 0 && run.counts.pending === 0)));
    if (sort.control.value === "failures") selection.sort((a, b) => b.counts.failed - a.counts.failed);
    if (sort.control.value === "success") selection.sort((a, b) => a.counts.completed / a.counts.attempted - b.counts.completed / b.counts.attempted);
    status.textContent = `${selection.length} of ${runs.length} reviewed stages. Counts are requested-operation outcomes; separate campaigns are not pooled.`;
    table(results, "Reviewed stage explorer", ["Stage / surface", "Load shape", "Actual arrival or observation", "Success / attempts", "Failed / pending", "Result"],
      selection.map((run) => [
        `${run.runKey} / ${label(run.surface)}`,
        run.pacedMeasurement ? `${number(run.pacedMeasurement.targetRpm)} intended/min` : run.nativeInvocation ? `${run.counts.attempted}-request burst; not RPM` : "Single visible turn",
        run.pacedMeasurement ? `${number(run.pacedMeasurement.arrivalSeconds)} s arrivals + ${postCloseSummary(run)}` : run.windowSeconds === null ? "Not measured" : `${number(run.windowSeconds)} s observation`,
        outcomeRatio(run.counts), `${run.counts.failed} / ${run.counts.pending}`,
        nativeMeasurement(run) ? loadStatus(run) : "Visible requested-operation outcome; not a load calibration."
      ]));
    if (!selection.length) results.append(paragraph("No matching stages. This filter result is not zero measured capacity.", "fine"));
  };
  for (const item of [search, surface, outcome, sort]) item.control.addEventListener(item === search ? "input" : "change", draw);
  target.replaceChildren(controls, status, results);
  draw();
}

function renderAnswerAndConversationViews(report) {
  if (!report.runs.length) {
    empty("answers-content", "No reviewed answer outcomes.", "No answer quality, length or content distribution is inferred.");
    empty("conversations-content", "No reviewed conversation counts.", "A run, conversation and runtime session are different units.");
    return;
  }
  table("answers-content", "Requested-operation outcomes / no raw answer content",
    ["Run", "Workload / endpoint", "Successful requested outcomes", "Failed / pending"],
    nativeFirst(report.runs).map((run) => [
      run.runKey, `${label(run.workload)} / ${nativeMeasurement(run) ? "native invocation completion" : "visible channel observation"}`,
      outcomeRatio(run.counts), `${run.counts.failed} / ${run.counts.pending}`
    ]));
  byId("answers-content").append(paragraph("Native load requests asked for a brief greeting. Success here is a returned greeting, not tool execution, knowledge-grounding accuracy or production workload capacity. No answer-length distribution, fabricated example answers or raw transcripts are published. The earlier public-knowledge and workflow turns are separately labelled.", "fine"));
  table("conversations-content", "Reviewed conversation counts / identifiers deliberately excluded",
    ["Run", "Attempts", "Verified conversation count", "Failure conversations", "Runtime sessions"],
    nativeFirst(report.runs).map((run) => [
      run.runKey, number(run.counts.attempted),
      run.units.conversations === null ? "Unknown" : `${number(run.units.conversations)}${scopedContext(report, run)?.conversationUse === "one_existing_reused" ? " / same reused Teams conversation" : " / distinct within this cohort"}`,
      nativeMeasurement(run)?.failedConversations ?? "Not measured", run.units.sessions ?? "Unknown"
    ]));
  byId("conversations-content").append(paragraph("A returned conversation identifier can accompany an invocation failure. Do not equate attempts, successful replies, conversations and runtime sessions. Partial Studio history pages do not prove missing records never reached the agent.", "fine"));
  if (report.pacedCampaigns?.some((campaign) => campaign.campaignKey === "m365-paced-campaign")) byId("conversations-content").append(paragraph("The original paced campaign has 383 verified distinct returned conversations for 384 attempts: its transport-429 attempt returned no identifier.", "fine"));
}

function capacityCell(candidate) {
  if (!candidate) return "NOT ESTABLISHED";
  const cell = node("div");
  cell.append(node("strong", outcomeRatio(candidate.counts)),
    paragraph(`${number(candidate.counts.failed)} failed / ${number(candidate.counts.pending)} pending`, "fine"),
    paragraph(sourceWindow(candidate), "fine run-title"));
  return cell;
}

function renderCapacity(report, evidence = null) {
  const target = byId("capacity-summary");
  target.replaceChildren();
  byId("benchmark-kpis").replaceChildren();
  const groups = summarizeCapacity(report.runs);
  if (!groups.length) {
    empty("capacity-summary", "No paced capacity windows measured.", "Individual turns or a simultaneous burst cannot establish a successful per-minute, hourly or daily rate.");
    return;
  }
  for (const group of groups) {
    const section = node("article", undefined, "stack capacity-group");
    const { context, highestQualifiedRpm, highestQualifiedRuns, longestClean, longestCompleted } = group;
    const bestMinute = group.windows.find((window) => window.seconds === 60).best;
    const bestFive = group.windows.find((window) => window.seconds === 300).best;
    const fullHour = group.runs.some((run) => isHourly(run) && run.pacedMeasurement.arrivalStatus === "full_window" && run.pacedMeasurement.drainStatus === "complete");
    const kpis = node("div", undefined, "cards benchmark-kpis");
    for (const [title, value, detail] of [
      ["Qualified short rate", highestQualifiedRpm === null ? "Not measured" : `${number(highestQualifiedRpm)}/min`, "Completed calibration only; not a service ceiling."],
      ["Best dispatch minute", bestMinute ? `${bestMinute.counts.completed} / ${bestMinute.counts.attempted}` : "Not measured", "Eventual replies from a complete 60-second dispatch bucket."],
      ["Best five minutes", bestFive ? `${bestFive.counts.completed} / ${bestFive.counts.attempted}` : "Not measured", "Eventual replies; not necessarily completed inside five minutes."],
      ["Longest clean segment", longestClean ? windowLabel(longestClean.windowSeconds) : "Not measured", longestClean ? `${longestClean.counts.completed}/${longestClean.counts.attempted} eventual replies. A segment, not a separate endurance test.` : "No eligible error-free segment."],
      ["Full hourly trial", fullHour ? "Completed" : "Not measured", "No projection of shorter trials into an hour."],
      ["Cost per success", group.runs.every((run) => run.cost.status === "pending") ? "Pending" : "Not derived", "Unsettled or shared evidence is not zero cost."]
    ]) {
      const card = node("article", undefined, "card");
      card.append(paragraph(title, "metric-label"), paragraph(value, "metric-value"), paragraph(detail, "metric-help"));
      kpis.append(card);
    }
    byId("benchmark-kpis").append(kpis, paragraph(`${label(context.surface)} / ${label(context.environmentType)} / ${context.model ?? "unknown model"} / ${context.authenticatedAccounts} account. Each maximum comes from one cohort; whole dispatch-minute buckets, not rolling or completion-window maxima.`, "fine"));
    section.append(node("h3", `${label(context.surface)} / ${label(context.environmentType)} / ${context.model ?? "unknown model"}`),
      paragraph(`Greeting-only native invocation completion; ${context.authenticatedAccounts} account; memory ${label(context.memory)}; published revision ${context.agentVersion ?? "unknown"}. Configuration-specific observations, not a controlled harness comparison.`, "fine"));
    const summary = node("div", undefined, "note boundary");
    summary.append(definitionList([
      ["Highest qualified calibration", highestQualifiedRpm === null ? "NOT ESTABLISHED" : `${number(highestQualifiedRpm)} intended requests/min; ${highestQualifiedRuns.length} qualified calibration cohort(s), each ${windowLabel(highestQualifiedRuns[0].pacedMeasurement.arrivalSeconds)}. Not a sustained safe rate or service ceiling.`],
      ["Longest clean dispatch segment", longestClean ? `${windowLabel(longestClean.windowSeconds)} / ${outcomeRatio(longestClean.counts)} eventual replies. ${sourceWindow(longestClean)}. A segment, not a separately completed endurance test.` : "NOT ESTABLISHED"],
      ["Longest completed paced trial", longestCompleted ? `${windowLabel(longestCompleted.pacedMeasurement.arrivalSeconds)} of arrivals plus drain (${longestCompleted.runKey}). Complete does not mean error-free.` : "NOT ESTABLISHED"],
      ["Full hourly arrival trial", group.runs.some((run) => isHourly(run) && run.pacedMeasurement.arrivalStatus === "full_window" && run.pacedMeasurement.drainStatus === "complete")
        ? "Completed; inspect its counts, skipped slots and qualification separately below." : "NOT ESTABLISHED; do not extrapolate shorter trials into an hourly result."]
    ]));
    section.append(barChart({
      title: "How many successful requests per window?",
      description: "Most eventual successes and best error-free alternative among complete contiguous dispatch-minute buckets within one cohort. Not arbitrary rolling maxima or service ceilings. Sub-minute, hourly and daily windows are not inferred.",
      series: [{ key: "best", label: "Most eventual successes", className: "series-primary" }, { key: "clean", label: "Best error-free alternative", className: "series-secondary" }],
      rows: group.windows.filter((window) => window.best).map((window) => ({
        key: `capacity-${window.seconds}`, label: windowLabel(window.seconds),
        values: [window.best.counts.completed, window.clean?.counts.completed ?? null],
        summary: `${window.best.counts.completed}/${window.best.counts.attempted} best; ${window.clean ? `${window.clean.counts.completed}/${window.clean.counts.attempted} clean` : "no clean window"}`,
        summaryLines: [`${window.best.counts.completed}/${window.best.counts.attempted} best`, window.clean ? `${window.clean.counts.completed}/${window.clean.counts.attempted} clean` : "No clean window"],
        detail: `${window.best.targetRpm}/min best source; dispatch ${window.best.offsetSeconds}-${window.best.offsetSeconds + window.seconds} s`
      }))
    }));
    const details = node("details", undefined, "block");
    details.append(node("summary", "Window counts, exact source cohorts and evidence boundaries"), summary,
      paragraph("Best counts among available whole dispatch-minute windows, not arbitrary rolling maxima. Each numerator is eventual successful invocations from requests sent in that window; replies may finish later during drain. Error-free means no failed or pending outcomes, not guaranteed future reliability.", "fine"));
    const container = node("div");
    table(container, `Observed dispatch-window successes / ${label(context.surface)} / ${context.model ?? "unknown model"}`,
      ["Dispatch window", "Most eventual successes / attempted", "Best error-free observed window", "Evidence boundary"],
      group.windows.map((window) => [
        windowLabel(window.seconds), capacityCell(window.best), capacityCell(window.clean),
        window.seconds < 60 ? "Not derivable from minute buckets; see the separate reviewed rolling-window supplement when available."
          : window.best ? "Complete contiguous minute buckets in one cohort. Offered load can limit the count; not a service ceiling."
            : "No eligible full window within one measured cohort. Not zero capacity."
      ]));
    details.append(container);
    section.append(details);
    target.append(section);
  }
  const gaps = node("article", undefined, "note");
  const fullHour = groups.some((group) => group.runs.some((run) => isHourly(run)
    && run.pacedMeasurement.arrivalStatus === "full_window" && run.pacedMeasurement.drainStatus === "complete"));
  gaps.append(node("h3", "Still not established"),
    paragraph(`${evidence ? "Exact burst completion-window maxima; " : "Exact rolling-window and completion-window maxima; "}${fullHour ? "daily capacity" : "a completed hourly/daily endurance result"}; failure recovery/reset; quota scope; backend concurrency; representative knowledge/workflow throughput. See Costs for separately reviewed billing evidence; no unit cost is derived here.`),
    paragraph("The same rate can pass a short calibration and later encounter a transport stop. Repeated small clean samples do not establish a 99% service guarantee. Check the rate, duration, stop reason and failure layer together."));
  target.append(gaps);
}

const clockSeconds = (ms) => (ms / 1000).toFixed(7).replace(/\.?0+$/, "");
const clockBounds = (value) => value.precision === "exact" ? `${clockSeconds(value.lowerMs)} s (recorded native callback)`
  : `${clockSeconds(value.lowerMs)}-${clockSeconds(value.upperMs)} s (inclusive bound; not an exact timestamp)`;
const clientSnapshot = (value) => `${value.dispatched} dispatched; ${value.settled} settled (${value.successes} successful / ${value.failures} failed); ${value.outstandingClientCalls} client calls outstanding`;

function reviewedWindowCell(candidate, metric) {
  if (!candidate) return "UNAVAILABLE / no eligible full window or exact clock";
  const cell = node("div");
  const { snapshot } = candidate;
  const d = snapshot.dispatchCohort, c = snapshot.completionsInWindow;
  cell.append(node("strong", metric === "dispatch" ? `${d.eventualSuccesses} / ${d.dispatched} eventual successes` : `${c.successes} successful completions`),
    paragraph(`${cohortName(candidate)} / ${candidate.runKey}`, "fine run-title"),
    paragraph(`${clockSeconds(snapshot.window.startOffsetMs)}-${clockSeconds(snapshot.window.endOffsetMs)} s; half-open, display rounded`, "fine"),
    paragraph(`At this same anchor: ${d.dispatched} dispatched, ${d.eventualSuccesses} eventual successes, ${d.eventualFailures} eventual failures, ${d.pendingAtEvidenceCutoff} pending at cutoff; ${c ? `${c.successes} successful / ${c.failures} failed completions inside the window` : "exact completion counts unavailable"}.`, "fine"));
  const detail = node("details");
  detail.append(node("summary", "Exact offsets and local client state"),
    paragraph(`Start included: ${snapshot.window.startOffsetMsExact} ms. End excluded: ${snapshot.window.endOffsetMsExact} ms.`, "fine run-title"),
    paragraph(`Eligible coverage: ${candidate.coverage.startOffsetMsExact}-${candidate.coverage.endOffsetMsExact} ms.`, "fine run-title"));
  if (snapshot.clientStateBeforeWindowStart) detail.append(
    paragraph(`Before start: ${clientSnapshot(snapshot.clientStateBeforeWindowStart)}.`, "fine"),
    paragraph(`Before end: ${clientSnapshot(snapshot.clientStateBeforeWindowEnd)}. Of this window's dispatch cohort, ${d.pendingImmediatelyBeforeWindowEnd} were still outstanding immediately before its end; that is not pending at the final cutoff.`, "fine"));
  cell.append(detail);
  return cell;
}

function renderReviewedWindows(report, evidence) {
  if (!evidence) {
    empty("reviewed-windows", "No reviewed rolling-window supplement.", "Minute-bucket totals alone cannot establish exact rolling or completion-window maxima.");
    byId("bucket-analysis").open = true;
    return;
  }
  const headline = byId("benchmark-kpis");
  headline.replaceChildren();
  const missing = report.runs.filter((run) => nativeMeasurement(run) && !evidence.runs.some((item) => item.runKey === run.runKey));
  if (missing.length) headline.append(paragraph(`Rolling-window scope: ${evidence.runs.length} reviewed native cohorts only. Excludes ${missing.map(cohortName).join(", ")} pending a reviewed window supplement; these are not maxima across every displayed run. The excluded cohort's actual totals remain in its own result.`, "fine"));
  for (const group of summarizeReviewedWindows(evidence, report)) {
    const minute = group.windows.find((window) => window.seconds === 60);
    const five = group.windows.find((window) => window.seconds === 300);
    const capacity = summarizeCapacity(group.runs)[0];
    const kpis = node("div", undefined, "cards benchmark-kpis");
    for (const [title, value, detail] of [
      ["Qualified short rate", capacity?.highestQualifiedRpm ? `${number(capacity.highestQualifiedRpm)}/min` : "Not measured", "Completed calibration, not a service ceiling."],
      ["Peak 60 s dispatch", minute.dispatch ? `${minute.dispatch.successes} / ${minute.dispatch.snapshot.dispatchCohort.dispatched}` : "Not measured", "Eventual successes of a selected dispatch cohort; errors stay in the denominator."],
      ["Peak 60 s completions", minute.completion ? number(minute.completion.successes) : "Not measured", "Replies completed inside a separately selected 60-second window."],
      ["Peak 5 min completions", five.completion ? number(five.completion.successes) : "Not measured", "Finite-window peak, not sustained hourly capacity."],
      ["Full hourly trial", group.runs.some((run) => isHourly(run) && run.pacedMeasurement.arrivalStatus === "full_window" && run.pacedMeasurement.drainStatus === "complete") ? "Completed" : "Not measured", "No hourly/daily extrapolation."],
      ["Cost per success", group.runs.every((run) => run.cost.status === "pending") ? "Pending" : "Not derived", "Client outcomes do not settle remote work, retries or billing."]
    ]) {
      const card = node("article", undefined, "card");
      card.append(paragraph(title, "metric-label"), paragraph(value, "metric-value"), paragraph(detail, "metric-help"));
      kpis.append(card);
    }
    headline.append(kpis, paragraph(`${label(group.context.surface)} / ${label(group.context.environmentType)} / ${group.context.model ?? "unknown model"}. Headline peaks use observed coverage through drain across compatible native cohorts; the two metrics select independent windows. Reviewed ${evidence.reviewedOn}; no new calls.`, "fine"));
  }
  const target = byId("reviewed-windows");
  const controls = node("div", undefined, "searchbar");
  const basis = labelledControl("Window coverage", "window-coverage", [
    ["observed_through_drain", "Observed through drain"], ["observed_arrival_only", "Observed arrival interval only"]
  ]);
  const cohort = labelledControl("Window cohort", "window-cohort", [["all", "All reviewed window cohorts"], ...nativeFirst(report.runs).filter((run) => evidence.runs.some((item) => item.runKey === run.runKey)).map((run) => [run.runKey, cohortName(run)])]);
  controls.append(basis.field, cohort.field);
  const results = node("div", undefined, "reviewed-window-results");
  const status = paragraph(undefined, "fine");
  status.setAttribute("role", "status");
  const draw = () => {
    results.replaceChildren();
    const groups = summarizeReviewedWindows(evidence, report, basis.control.value, cohort.control.value === "all" ? null : cohort.control.value);
    const throughDrain = basis.control.value === "observed_through_drain";
    status.textContent = `${throughDrain ? "Through-drain coverage includes time with no new dispatch; not sustained offered load." : "Arrival-only coverage excludes completions after the observed arrival end."} Controls change this window analysis only. Post-hoc peaks do not establish clean qualification or quotas.`;
    for (const group of groups) {
      const article = node("article", undefined, "rolling-group");
      article.append(barChart({
        title: `Exact rolling windows / ${throughDrain ? "observed through drain" : "observed arrivals only"}`,
        description: `${label(group.context.surface)} / ${group.context.model ?? "unknown model"}. Two independently selected maxima: eventual successes from dispatches inside a window, versus successful callbacks inside a window. They may come from different runs and anchors. Unknown is not zero; no hourly normalization.`,
        series: [
          { key: "dispatch", label: "Eventual successes of dispatch cohort", className: "series-primary" },
          { key: "completion", label: "Successful completions inside window", className: "series-secondary" }
        ],
        rows: group.windows.filter((window) => window.dispatch || window.completion).map((window) => ({
          key: `rolling-${window.seconds}`, label: windowLabel(window.seconds),
          values: [window.dispatch?.successes ?? null, window.completion?.successes ?? null],
          summary: `${window.dispatch ? `${window.dispatch.successes}/${window.dispatch.snapshot.dispatchCohort.dispatched} eventual dispatch-cohort successes from ${window.dispatch.runKey}` : "dispatch maximum unavailable"}; ${window.completion ? `${window.completion.successes} actual completions from ${window.completion.runKey}` : "exact completion maximum unavailable"}`,
          summaryLines: [window.dispatch ? `${window.dispatch.successes}/${window.dispatch.snapshot.dispatchCohort.dispatched} eventual` : "Unavailable", window.completion ? `${window.completion.successes} completions` : "Completion unknown"],
          detail: `Dispatch: ${window.dispatch ? cohortName(window.dispatch) : "unavailable"}; replies: ${window.completion ? cohortName(window.completion) : "unavailable"}`
        }))
      }));
      const rows = node("div");
      table(rows, `Reviewed rolling maxima / ${throughDrain ? "through drain" : "arrival only"} / ${group.context.model ?? "unknown model"}`,
        ["Exact window duration", "Maximum eventual successful dispatch cohort", "Maximum successful completions inside window"],
        group.windows.map((window) => [windowLabel(window.seconds), reviewedWindowCell(window.dispatch, "dispatch"), reviewedWindowCell(window.completion, "completion")]));
      const details = node("details", undefined, "block rolling-details");
      details.append(node("summary", "Every maximum, denominator, source anchor and paired count"), rows);
      article.append(details);
      results.append(article);
    }
  };
  basis.control.addEventListener("change", draw);
  cohort.control.addEventListener("change", draw);
  target.replaceChildren(node("h3", "Maximum successes per measured window"), controls, status, results);
  draw();
}

function renderErrorTimeline(evidence, report) {
  const target = byId("error-timeline");
  target.replaceChildren();
  if (!evidence) return;
  const byKey = new Map(evidence.runs.map((run) => [run.runKey, run]));
  const ordered = nativeFirst(report.runs).filter((run) => byKey.has(run.runKey)).map((run) => byKey.get(run.runKey));
  const errors = ordered.filter((run) => run.firstError);
  if (!errors.length) return;
  target.append(paragraph(`These callback and trigger tables use only the ${number(evidence.runs.length)}-cohort window supplement. Newer cohorts are not included; their primary results and methodology remain separate.`, "fine"));
  const first = node("div");
  table(first, "When the first error returned / client callback evidence",
    ["Cohort", "First error offset", "Counts just after processing that error", "Observed evidence"],
    errors.map((run) => [cohortName(run), clockBounds(run.firstError.completion), clientSnapshot(run.firstError.client), label(run.firstError.evidence)]));
  target.append(first, paragraph("Offsets are relative to each cohort's own monotonic origin, not invocation durations or wire/server timestamps. Burst first-error timing is bounded; it had no per-error dispatch-stop policy. A first error is not necessarily the safety trigger.", "fine"));
  const stops = node("div");
  table(stops, "Actual safety triggers and later admitted-call outcomes / not final failure thresholds",
    ["Cohort / trigger", "Trigger callback", "Dispatch-close bounds", "Client counts at trigger", "After trigger / no new dispatch"],
    ordered.filter((run) => run.safetyTrigger).map((run) => {
      const stop = run.safetyTrigger;
      const arrival = run.bases.find((basis) => basis.basis === "observed_arrival_only").coverage;
      return [
        `${cohortName(run)} / ${label(stop.reason)}${stop.reason === "generic_error_threshold" ? " / third consecutive generic failure" : ""}`,
        clockBounds(stop.completion),
        `${clockBounds(stop.dispatchClose)}. Separately observed arrival end: ${clockSeconds(arrival.endOffsetMs)} s.`,
        clientSnapshot(stop.client),
        `${stop.settlementsAfterTrigger.successes} successes / ${stop.settlementsAfterTrigger.failures} failures / ${stop.settlementsAfterTrigger.pendingAtFinalCutoff} pending at final client cutoff. ${stop.newDispatchesAfterTrigger} later starts; no quota or backend-concurrency inference.`
      ];
    }));
  target.append(stops, paragraph("The dispatch-close assignment was not separately timestamped; synchronous callback order supplies inclusive bounds. Post-trigger outcomes may arrive before the observed arrival end or during the separately measured drain. Final failures include calls already in flight. Zero client pending is not proof that remote work, retries, admission or cost have settled.", "fine"));
}

function loadStatus(run) {
  const paced = run.pacedMeasurement;
  if (!paced) return "Finished burst; not a sustained arrival rate.";
  if (paced.stopReason) return `Arrival ${label(paced.arrivalStatus)}: ${pacedStopLabel(run)}; drain ${label(paced.drainStatus)}.`;
  if (isRetest(run)) return `${number(run.counts.attempted)} / 100 planned dispatches; arrival ${label(paced.arrivalStatus)}; drain ${label(paced.drainStatus)}. Not a two-minute calibration.`;
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
        run.pacedMeasurement ? `${number(measurement.arrivalSeconds)} s arrivals + ${postCloseSummary(run)}` : `${number(run.windowSeconds)} s batch, not an arrival-rate trial`,
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
  byId("failure-charts").replaceChildren();
  if (!failures.length) {
    empty("failure-summary", "No native load-failure observations.", "An empty failure table is not evidence that the route has no limits. Visible workflow failures, if any, remain separate below.");
    return;
  }
  byId("failure-charts").append(barChart({
    title: "Failures by observed evidence / separate cohorts",
    description: "Counts of failed native invocations, not rate-limit thresholds or proven backend failures. Generic server_error results do not identify a throttling layer. Disconnected results do not prove remote admission. The explicit HTTP 429 belongs to the WorkIQ MCP transport; harness attribution is unknown.",
    stacked: true,
    series: [
      { key: "generic", label: "Generic invocation error / cause unknown", className: "series-failure" },
      { key: "transport", label: "WorkIQ transport HTTP 429", className: "series-pending" },
      { key: "disconnected", label: "Native disconnected / admission unknown", className: "series-primary" },
      { key: "other", label: "Other classified native failure", className: "series-secondary" }
    ],
    rows: failures.map((run) => {
      const generic = run.errors.filter((error) => error.evidence === "unclassified_invocation_failure").reduce((sum, error) => sum + error.count, 0);
      const transport = run.errors.filter((error) => error.evidence === "workiq_mcp_transport_429").reduce((sum, error) => sum + error.count, 0);
      const disconnected = run.errors.filter((error) => error.evidence === "native_disconnected_no_conversation").reduce((sum, error) => sum + error.count, 0);
      const other = run.counts.failed - generic - transport - disconnected;
      return {
        key: run.runKey, label: cohortName(run), values: [generic, transport, disconnected, other],
        summary: `${generic} generic errors; ${transport} transport HTTP 429; ${disconnected} disconnected; ${other} other classified failures`,
        summaryLines: [`${run.counts.failed} / ${run.counts.attempted} failed`],
        detail: `${generic} generic; ${transport} transport 429; ${disconnected} disconnected; ${other} other`
      };
    })
  }));
  table("failure-summary", "Where failures were observed / dispatch cohorts are not failure timestamps",
    ["Cohort", "Failed invocations / evidence", "First affected dispatch bucket", "Observed arrival end / terminal status", "Attribution and recovery"],
    failures.map((run) => {
      const paced = run.pacedMeasurement;
      const first = paced?.minutes.find((minute) => minute.failed > 0);
      const transport = run.errors.some((error) => error.evidence === "workiq_mcp_transport_429");
      const disconnected = run.errors.some((error) => error.evidence === "native_disconnected_no_conversation");
      const generic = run.errors.every((error) => error.evidence === "unclassified_invocation_failure");
      return [
        run.runKey,
        run.errors.map((error) => `${number(error.count)} ${label(error.evidence)}`).join("; "),
        first ? `${number(first.offsetSeconds)}-${number(first.offsetSeconds + first.durationSeconds)} s: ${number(first.failed)} eventual failure${first.failed === 1 ? "" : "s"} among ${number(first.attempted)} dispatches. Not the time the first error returned.` : "Not bucketed; exact first-error return time not available.",
        paced ? (paced.stopReason ? `${number(paced.arrivalEndObservedSeconds)} s observed arrival end / ${pacedStopLabel(run)}. Final error count includes calls already in flight, not the guard's trigger count.`
          : `${paced.phase === "count_retest" ? "Count-bound" : "Full"} ${number(paced.arrivalSeconds)} s arrival window; ${label(paced.qualification)}. No arrival stop.`)
          : `${number(run.windowSeconds)} s batch observation; not a measured failure-onset time.`,
        transport ? "WorkIQ MCP HTTP transport 429 observed. Harness attribution, quota key/window/reset and backend reach unknown; no retry interval exposed. Recovery not measured."
          : disconnected ? "Disconnected native result has no returned conversation identifier; remote admission is unknown. Generic errors remain unclassified. Invocation failures are not proven agent/backend failures or a quota."
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
    if (["standalone_minute_retest", "standalone_count_retest"].includes(campaign.status)) {
      const card = minuteRetestCard(cohorts[0]);
      card.classList.add("campaign-summary");
      card.dataset.campaignKey = campaign.campaignKey;
      card.append(paragraph(`Campaign markers: ${campaign.startedAt} to ${campaign.endedAt}. ${number(campaign.distinctReturnedConversations)} distinct returned conversations; peak ${number(campaign.clientPeakOutstanding)} outstanding client invocations, not backend/model concurrency.`, "fine"));
      overview.append(card);
      continue;
    }
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
      card.append(paragraph(`Separate authorization and campaign, not a restart or escalation of the earlier campaign. ${number(standalone.counts.completed / standalone.counts.attempted * 100)}% eventual greeting success through drain. ${completed ? "The full arrival window covered" : "The recorded arrival window covered"} ${number(paced.arrivalSeconds)} s of a planned ${number(paced.plannedArrivalSeconds)} s / ${number(paced.plannedSlots)} calls; ${number(paced.unofferedSlots)} were not offered and ${number(paced.skippedSlots)} were skipped.`),
        paragraph(completed
          ? `All planned calls dispatched; outcomes were observed through the following ${number(paced.drainSeconds)} s drain. No hour or automatic continuation followed.`
          : `${paced.arrivalSeconds < 60 ? "Not even one full minute completed. " : ""}No completed two-minute calibration or hour. Already-outstanding calls then drained for ${number(paced.drainSeconds)} s; final failure count includes that drain. No restart, retries or escalation, including unused slots.`));
    }
    if (hour) card.append(paragraph(`The ${number(hour.pacedMeasurement.targetRpm)} RPM hourly attempt ended early with a recorded ${number(hour.pacedMeasurement.arrivalSeconds)} s arrival window of 3,600 s: ${number(hour.counts.attempted)} of ${number(hour.pacedMeasurement.plannedSlots)} planned calls were dispatched, leaving ${number(hour.pacedMeasurement.unofferedSlots)} unsent. Its ${number(hour.counts.completed)} eventual replies are counted through the following ${number(hour.pacedMeasurement.drainSeconds)} s drain, not necessarily inside the arrival window. ${number(hour.pacedMeasurement.targetRpm)} RPM was the last qualified calibration rate, not a sustained-capacity finding.`));
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
      paragraph(`${observedPacedRpm(run) === null ? "Offered rate not measured; the partial window is not normalized to a minute" : `${achievedRpm(run)} achieved client dispatches/min`} over ${number(paced.arrivalSeconds)} s of a planned ${number(paced.plannedArrivalSeconds)} s arrival window. This is not an extrapolated hourly result. Arrival status: ${label(paced.arrivalStatus)}; post-close observation: ${postCloseSummary(run)} (${label(paced.drainStatus)}). ${paced.stopReason ? `Stop reason: ${pacedStopLabel(run)}.` : "No arrival stop recorded."}`),
      paragraph(`${number(paced.skippedSlots)} skipped and ${number(paced.unofferedSlots)} unoffered client slots are outside the ${number(run.counts.attempted)} invocation attempts, not agent failures. Qualification: ${label(paced.qualification)}.${paced.qualifyingRunKey ? ` Rate selected from ${paced.qualifyingRunKey}.` : ""}`),
      paragraph(`Peak outstanding client invocations: ${paced.peakOutstanding === null ? "not measured" : number(paced.peakOutstanding)}; not backend/model concurrency. Costs: ${run.cost.status}.`, "fine"));
    if (isCapacityCohort(run)) feature.append(paragraph(`Zero-error protocol only, not the historical 99% rule. Clock: ${label(paced.capacityEvidence.clockStatus)}; evidence: ${label(paced.capacityEvidence.evidenceStatus)}. Qualification of this one cohort is not validation of the complete two-hour study.`, "fine"));
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
      run.pacedMeasurement ? `${pacedPhase(run.pacedMeasurement)}: ${number(run.pacedMeasurement.arrivalSeconds)} s offer window; observed end offset ${number(run.pacedMeasurement.arrivalEndObservedSeconds)} s + ${postCloseSummary(run)}; ${label(run.pacedMeasurement.arrivalStatus)} / ${label(run.pacedMeasurement.drainStatus)}` :
      run.nativeInvocation ? `${number(run.counts.completed)} replies / ${number(run.counts.attempted)} invocation outcomes in ${number(run.windowSeconds)} s; not a sustained capacity result` :
      run.windowSeconds === null ? "Not measured" : run.counts.attempted === 1
        ? `${number(run.windowSeconds)} s; one sent message, not a throughput trial`
        : `${number(run.counts.completed / run.windowSeconds * 60)} completed/min over ${number(run.windowSeconds)} s`,
      run.pacedMeasurement ? `${number(run.pacedMeasurement.targetRpm)} intended RPM / ${observedPacedRpm(run) === null ? "observed rate not measured; no partial-minute normalization" : `${achievedRpm(run)} achieved client dispatches/min`}; no network/server arrival claim` :
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
        paragraph(`${paced.pacing.schedule === "dispatch_rebased" ? "Actual-dispatch-rebased" : "Absolute"} ${number(paced.pacing.intervalMs)} ms client spacing; ${number(paced.pacing.jitterAllowance * 100)}% minimum-gap allowance. Observed minimum gap: ${paced.pacing.observedMinIntervalMs === null ? "not measured" : `${number(paced.pacing.observedMinIntervalMs)} ms`}; violating intervals: ${paced.pacing.violatingIntervals === null ? "not measured" : number(paced.pacing.violatingIntervals)}. ${paced.pacing.schedule === "dispatch_rebased" ? "Delays extend the arrival window; no catch-up or skipped-slot replay." : "Skipped slots are not replayed."}`),
        paragraph(`Fresh conversation per request is the configured policy, not proof of conversation/session counts. Verified distinct returned conversations: ${run.units.conversations ?? "unknown"}; from failed outcomes: ${paced.failedConversations ?? "unknown"}. No identifiers are public.`, "fine"),
        paragraph(`Offer-window duration: ${paced.arrivalSeconds} s. Independently observed arrival-end offset: ${paced.arrivalEndObservedSeconds} s; ${postCloseLabel(run)}: ${paced.drainSeconds} s; full observation: ${run.windowSeconds} s. Timer overshoot and separate cutoff reads are retained, not rounded into equality; wall-clock metadata is a separate clock source.`, "fine"),
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
setTheme(explicitTheme() ?? "dark");
byId("theme-toggle").hidden = false;
byId("theme-toggle").addEventListener("click", () => {
  const theme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  const url = new URL(window.location.href);
  url.searchParams.set("scoutTheme", theme);
  window.history.replaceState(null, "", url);
  setTheme(theme);
});
window.addEventListener("popstate", () => setTheme(explicitTheme() ?? "dark"));

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
let printDetails = [];
window.addEventListener("beforeprint", () => {
  printDetails = [...document.querySelectorAll("details")].filter((details) => !details.open);
  for (const details of printDetails) details.open = true;
});
window.addEventListener("afterprint", () => {
  for (const details of printDetails) details.open = false;
  printDetails = [];
});

try {
  const report = JSON.parse(byId("report-data").textContent);
  const schema = JSON.parse(byId("report-schema").textContent);
  assertReport(report, schema);
  const evidence = JSON.parse(byId("window-evidence").textContent);
  assertWindowEvidence(evidence, JSON.parse(byId("window-schema").textContent), report);
  renderCapacity(report, evidence);
  renderReviewedWindows(report, evidence);
  renderOverview(report);
  renderCharts(report.runs);
  renderTimeline(report.runs);
  renderStages(report.runs);
  renderAnswerAndConversationViews(report);
  renderReliability(report.runs);
  renderResponses(report.runs);
  renderThroughput(report);
  renderFailureSummary(report.runs);
  renderErrorTimeline(evidence, report);
  renderObservations(report.runs);
  renderCosts(report);
  const reviewed = report.publication.status === "reviewed";
  byId("publication-status").textContent = reviewed ? "REVIEWED AGGREGATES" : "NOT MEASURED";
  byId("publication-status").classList.toggle("reviewed", reviewed);
  byId("review-status").textContent = reviewed ? `Public aggregate review: ${report.publication.reviewedOn}. Run dates and cost settlement may differ.` : "Awaiting pilot / no measured results published";
  if (evidence) byId("review-status").textContent += ` Window/callback supplement reviewed ${evidence.reviewedOn}; no new calls.`;
  byId("window-download").hidden = evidence === null;
  byId("window-schema-download").hidden = evidence === null;
} catch {
  for (const id of ["reviewed-windows", "error-timeline", "benchmark-kpis", "overview-charts", "concurrency-charts", "concurrency-content", "latency-charts", "timeline-content", "stages-content", "answers-content", "conversations-content", "capacity-summary", "overview-summary", "run-ledger", "reliability-content", "failure-charts", "failure-summary", "native-response-content", "response-content", "throughput-content", "limits-content", "observations-content", "costs-content"]) byId(id).replaceChildren();
  byId("publication-status").textContent = "DATA REJECTED";
  byId("publication-status").classList.add("rejected");
  byId("review-status").textContent = "No metrics displayed.";
  byId("data-error").textContent = "The public aggregate could not be validated or rendered. Results are withheld. Report this issue to the repository maintainer.";
  byId("data-error").hidden = false;
  console.error("Public report validation or rendering failed; results withheld.");
}
