const byId = (id) => document.getElementById(id);
const number = (value) => value > 0 && value < 0.001 ? "<0.001" : new Intl.NumberFormat("en", { maximumFractionDigits: 3 }).format(value);
const words = (value) => value.replaceAll("_", " ");
const labels = {
  published_teams: "Published Teams",
  studio_preview: "Studio Preview",
  not_involved: "Not involved",
  involved: "Involved",
  unknown: "Unknown",
  github_copilot_harness: "GitHub Copilot Harness",
  standard_harness: "Standard Harness only",
  teams_bot_api: "Teams bot transport API",
  teams_connector: "Teams connector only",
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
  byId(target).replaceChildren(wrapper);
}

function renderOverview(report) {
  const cards = node("div", undefined, "cards");
  const metricLabels = { attempted: "Sent message attempts", completed: "Successful outcomes", failed: "Failed outcomes", pending: "Pending outcomes" };
  for (const state of ["attempted", "completed", "failed", "pending"]) {
    const card = node("article", undefined, "card");
    const count = report.runs.length ? number(report.runs.reduce((sum, run) => sum + run.counts[state], 0)) : "NOT MEASURED";
    card.append(paragraph(metricLabels[state], "metric-label"), paragraph(count, "metric-value"),
      paragraph(report.runs.length ? "Requested operation outcome, not merely a final message" : "Awaiting reviewed pilot evidence", "metric-help"));
    cards.append(card);
  }
  byId("overview-summary").replaceChildren(cards);
  if (report.studyContext) {
    const context = report.studyContext;
    const note = node("article", undefined, "note boundary");
    note.append(node("h3", "Study design and counting boundaries"));
    if (context.conversationUse === "one_existing_reused") note.append(paragraph("One existing Teams conversation was reused across every run. The per-run conversation counts refer to that same conversation; they are not separate conversations and must not be added together."));
    if (context.executionPattern === "sequential") note.append(paragraph("Turns were sent sequentially. One authenticated account is not a multi-account capacity experiment."));
    if (context.volumeRamp === "not_performed") note.append(paragraph("No high-volume ramp was performed. These pilot outcomes establish neither a numeric throttle threshold nor platform-wide capacity."));
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
  for (const run of report.runs) {
    const card = node("article", undefined, "card");
    card.append(node("h3", run.runKey, "run-title"), definitionList([
      ["Observed", run.observedOn], ["Surface", label(run.surface)], ["Environment", label(run.environmentType)],
      ["Model", run.model ?? "Unknown"], ["Agent version", run.agentVersion ?? "Unknown"],
      ["Authenticated accounts", "1"], ["Memory", label(run.memory)], ["Workload", label(run.workload)], ["Workflow", label(run.workflow)],
      ["Connectors", label(run.connectors)], ["Conversations / sessions", `${run.units.conversations ?? "Unknown"}${report.studyContext?.conversationUse === "one_existing_reused" ? " (same existing conversation)" : ""} / ${run.units.sessions ?? "Unknown"}`],
      ["Requested outcomes", `${number(run.counts.attempted)} attempted / ${number(run.counts.completed)} successful / ${number(run.counts.failed)} failed / ${number(run.counts.pending)} pending`],
      ["Outcome snapshot", run.followUp ? `Updated by follow-up at ${run.followUp.observedAt}` : "At the timing observation cutoff"]
    ]));
    ledger.append(card);
  }
  byId("run-ledger").replaceChildren(ledger);
}

function renderResponses(runs) {
  if (!runs.length) {
    empty("response-content", "Visible latency is not measured.", "First activity, first actual answer and UI-settled timings remain separate until reviewed samples are available. A loading or tool-invocation status is not an answer.");
    return;
  }
  table("response-content", "Visible endpoints by run (milliseconds)", ["Run / surface / endpoint", "Timed / eligible messages", "p50", "p95", "Maximum"],
    runs.flatMap((run) => ["firstVisibleActivity", "firstVisibleLatency", "latency"].map((field) => {
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
  else table("throughput-content", "Observed windows, not platform capacity", ["Run", "Observation window / completion pace", "Arrival rate", "Maximum in-flight"],
    report.runs.map((run) => [
      run.runKey,
      run.windowSeconds === null ? "Not measured" : run.counts.attempted === 1
        ? `${number(run.windowSeconds)} s; one sent message, not a throughput trial`
        : `${number(run.counts.completed / run.windowSeconds * 60)} completed/min over ${number(run.windowSeconds)} s`,
      run.arrival === null ? "Not measured" : `${number(run.arrival.attempts / run.arrival.windowSeconds * 60)} attempts/min (${number(run.arrival.attempts)} over ${number(run.arrival.windowSeconds)} s)`,
      run.concurrency === null ? "Not measured" : `${number(run.concurrency.maxInFlight)} messages; observed overlap`
    ]));
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
  for (const run of runs) {
    const card = node("article", undefined, "card");
    card.append(node("h3", run.runKey, "run-title"));
    card.append(paragraph(`${number(run.counts.attempted)} sent; ${number(run.counts.completed)} successful requested outcomes, ${number(run.counts.failed)} failed, ${number(run.counts.pending)} pending ${run.followUp ? "after the reviewed follow-up" : "at cutoff"}.`));
    if (!run.errors.length) card.append(paragraph("No failed messages recorded in this reviewed window. This is not a claim that throttling cannot occur.", "fine"));
    for (const error of run.errors) card.append(paragraph(`${label(error.category)}: ${number(error.count)} / evidence: ${label(error.evidence)}`));
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
    if (!run.observations.length) card.append(paragraph("No additional structured observations recorded.", "fine"));
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
  table("costs-content", "Cost evidence by run", ["Run", "Status", "Amount", "Evidence / scope"],
    runs.map((run) => {
      const cost = run.cost;
      return [
        run.runKey, cost.status.toUpperCase(),
        cost.status === "settled" ? `${cost.currency} ${cost.amount}` : "Not settled",
        cost.status === "settled" ? `${label(cost.source)} / ${label(cost.scope)} / ${cost.recordedOn}` : "No settled billing evidence"
      ];
    }));
  if (report.studyContext?.prePilotMonitor === "no_sessions_or_credits_recorded") {
    const note = node("article", undefined, "note");
    note.append(node("h3", "Pre-pilot Monitor is not settled billing evidence"), paragraph("No sessions or credits were recorded in the pre-pilot Monitor check. Analytics and billing meters can lag; that observation is not zero usage or zero cost. Runtime session counts remain unknown."));
    byId("costs-content").append(note);
  }
  if (report.studyContext?.postPilotMonitor === "no_sessions_or_credits_recorded") byId("costs-content").append(paragraph("A later post-pilot Monitor check also showed no recorded sessions or credits. Delayed meters still do not establish zero cost; all unsettled amounts remain null.", "fine"));
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
  renderOverview(report);
  renderResponses(report.runs);
  renderThroughput(report);
  renderObservations(report.runs);
  renderCosts(report);
  const reviewed = report.publication.status === "reviewed";
  byId("publication-status").textContent = reviewed ? "REVIEWED AGGREGATES" : "NOT MEASURED";
  byId("publication-status").classList.toggle("reviewed", reviewed);
  byId("review-status").textContent = reviewed ? `Public aggregate review: ${report.publication.reviewedOn}. Run dates and cost settlement may differ.` : "Awaiting pilot / no measured results published";
} catch {
  for (const id of ["overview-summary", "run-ledger", "response-content", "throughput-content", "limits-content", "observations-content", "costs-content"]) byId(id).replaceChildren();
  byId("publication-status").textContent = "DATA REJECTED";
  byId("publication-status").classList.add("rejected");
  byId("review-status").textContent = "No metrics displayed.";
  byId("data-error").textContent = "The public aggregate could not be validated or rendered. Results are withheld. Report this issue to the repository maintainer.";
  byId("data-error").hidden = false;
  console.error("Public report validation or rendering failed; results withheld.");
}
