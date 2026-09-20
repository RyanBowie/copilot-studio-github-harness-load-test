const byId = (id) => document.getElementById(id);
const number = (value) => value > 0 && value < 0.01 ? "<0.01" : new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(value);
const words = (value) => value.replaceAll("_", " ");
const labels = {
  published_teams: "Published Teams",
  studio_preview: "Studio Preview",
  not_involved: "Not involved",
  involved: "Involved",
  unknown: "Unknown",
  turn_serialization_observed: "Turn serialization observed in this run; not a platform capacity finding.",
  manual_timing: "Manual visible-response timing.",
  partial_observation: "Partial observation window; follow-up may change pending counts.",
  channel_reconnect: "Channel reconnection observed.",
  standalone_teams_send_tool_missing: "Configuration discrepancy: standalone Teams-send tool is missing; no successful standalone delivery is inferred.",
  human_review_workflow_attached: "Human-review workflow is attached; attachment alone does not establish execution."
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
  for (const state of ["attempted", "completed", "failed", "pending"]) {
    const card = node("article", undefined, "card");
    const count = report.runs.length ? number(report.runs.reduce((sum, run) => sum + run.counts[state], 0)) : "NOT MEASURED";
    card.append(paragraph(`${state[0].toUpperCase()}${state.slice(1)} messages`, "metric-label"), paragraph(count, "metric-value"),
      paragraph(report.runs.length ? "Across reviewed, non-overlapping run attempts" : "Awaiting reviewed pilot evidence", "metric-help"));
    cards.append(card);
  }
  byId("overview-summary").replaceChildren(cards);
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
      ["Connectors", label(run.connectors)], ["Conversations / sessions", `${run.units.conversations ?? "Unknown"} / ${run.units.sessions ?? "Unknown"}`],
      ["Message outcomes", `${number(run.counts.attempted)} attempted / ${number(run.counts.completed)} completed / ${number(run.counts.failed)} failed / ${number(run.counts.pending)} pending`]
    ]));
    ledger.append(card);
  }
  byId("run-ledger").replaceChildren(ledger);
}

function renderResponses(runs) {
  if (!runs.length) {
    empty("response-content", "Visible latency is not measured.", "First-visible and UI-settled summaries appear only after reviewed response samples are available. No empty chart implies a latency distribution.");
    return;
  }
  table("response-content", "Visible-response endpoints by run (milliseconds)", ["Run / surface / endpoint", "Timed / completed", "p50", "p95", "Maximum"],
    runs.flatMap((run) => ["firstVisibleLatency", "latency"].map((field) => {
      const timing = run[field];
      const endpoint = field === "firstVisibleLatency" ? "First visible" : `UI settled${timing ? `; feedback controls + ${number(timing.stabilitySeconds)} s stable text` : ""}`;
      return [
        `${run.runKey} / ${label(run.surface)} / ${endpoint}`,
        `${timing ? number(timing.sampleCount) : "Not measured"} / ${number(run.counts.completed)}`,
        ...["p50Ms", "p95Ms", "maxMs"].map((key) => timing ? `${number(timing[key])} ms` : "Not measured")
      ];
    })));
}

function renderThroughput(report) {
  if (!report.runs.length) empty("throughput-content", "No observed rate or overlap yet.", "No concurrency, arrival rate, completion pace or throttle threshold has been measured.");
  else table("throughput-content", "Observed windows, not platform capacity", ["Run", "Completion pace", "Arrival rate", "Maximum in-flight"],
    report.runs.map((run) => [
      run.runKey,
      run.windowSeconds === null ? "Not measured" : `${number(run.counts.completed / run.windowSeconds * 60)} completed/min over ${number(run.windowSeconds)} s`,
      run.arrival === null ? "Not measured" : `${number(run.arrival.attempts / run.arrival.windowSeconds * 60)} attempts/min (${number(run.arrival.attempts)} over ${number(run.arrival.windowSeconds)} s)`,
      run.concurrency === null ? "Not measured" : `${number(run.concurrency.maxInFlight)} messages; observed overlap`
    ]));
  if (!report.documentedLimits.length) {
    const note = node("article", undefined, "note");
    note.append(node("h3", "No numerical limits curated yet"), paragraph("This does not mean unlimited capacity. No documentation value has been reviewed for inclusion or applicability to this configuration."));
    byId("limits-content").replaceChildren(note);
  } else table("limits-content", "Documentation only / separate from observation", ["Limit / scope", "Value / metric", "Applicability", "Public source"],
    report.documentedLimits.map((limit) => {
      const link = node("a", `Documentation (retrieved ${limit.retrievedOn})`);
      link.href = limit.sourceUrl;
      return [`${limit.limitKey} / ${words(limit.scope)}`, `${number(limit.value)} ${words(limit.metric)}`, words(limit.applicability), link];
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
    card.append(paragraph(`${number(run.counts.attempted)} sent; ${number(run.counts.completed)} completed, ${number(run.counts.failed)} failed, ${number(run.counts.pending)} pending at cutoff.`));
    if (!run.errors.length) card.append(paragraph("No failed messages recorded in this reviewed window. This is not a claim that throttling cannot occur.", "fine"));
    for (const error of run.errors) card.append(paragraph(`${label(error.category)}: ${number(error.count)} / evidence: ${label(error.evidence)}`));
    for (const issue of run.clientIssues) card.append(paragraph(`Excluded client setup issue: ${number(issue.count)} unsent draft${issue.count === 1 ? "" : "s"}${issue.observedWaitSeconds === null ? "" : `; observed wait ${number(issue.observedWaitSeconds)} s`}. Not a sent message, agent failure or throttling outcome.`, "fine"));
    for (const observation of run.observations) card.append(paragraph(label(observation), "fine"));
    if (!run.observations.length) card.append(paragraph("No additional structured observations recorded.", "fine"));
    stack.append(card);
  }
  byId("observations-content").replaceChildren(stack);
}

function renderCosts(runs) {
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
  renderCosts(report.runs);
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
