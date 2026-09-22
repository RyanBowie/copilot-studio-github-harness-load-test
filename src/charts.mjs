const chartNamespace = "http://www.w3.org/2000/svg";
let chartSequence = 0;

function chartSvg(tag, attributes = {}, text) {
  const element = document.createElementNS(chartNamespace, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  if (text !== undefined) element.textContent = text;
  return element;
}

function chartHtml(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}

export function orderRunsByRate(runs) {
  const fixedRate = (run) => run.pacedMeasurement ?? run.quotaStudyMeasurement;
  const paced = runs.filter(fixedRate).sort((a, b) =>
    fixedRate(a).targetRpm - fixedRate(b).targetRpm
    || fixedRate(a).startedAt.localeCompare(fixedRate(b).startedAt)
    || a.runKey.localeCompare(b.runKey));
  const ramps = runs.filter((run) => run.rampMeasurement).sort((a, b) =>
    a.rampMeasurement.startedAt.localeCompare(b.rampMeasurement.startedAt) || a.runKey.localeCompare(b.runKey));
  return [...paced, ...ramps, ...runs.filter((run) => run.nativeInvocation), ...runs.filter((run) => !fixedRate(run) && !run.rampMeasurement && !run.nativeInvocation)];
}

export function nativeChartRows(runs) {
  return runs.filter((run) => run.nativeInvocation || run.pacedMeasurement || run.rampMeasurement || run.quotaStudyMeasurement).map((run) => {
    const measurement = run.quotaStudyMeasurement ?? run.rampMeasurement ?? run.pacedMeasurement ?? run.nativeInvocation;
    return {
      runKey: run.runKey,
      loadShape: run.quotaStudyMeasurement ? "quota_study" : run.rampMeasurement ? "ramp" : run.pacedMeasurement ? "paced" : "burst",
      targetRpm: (run.pacedMeasurement ?? run.quotaStudyMeasurement)?.targetRpm ?? null,
      counts: { ...run.counts },
      percentages: ["completed", "failed", "pending"].map((key) => run.counts.attempted ? run.counts[key] / run.counts.attempted * 100 : null),
      latencySeconds: measurement.success ? [measurement.success.p50Ms / 1000, measurement.success.p95Ms / 1000] : [null, null],
      successfulSamples: measurement.success?.sampleCount ?? 0,
      peakOutstanding: measurement.peakOutstanding
    };
  });
}

export function barChart({ title, description, rows, series, stacked = false, domain = null, unit = "" }) {
  const figure = chartHtml("figure", undefined, "block benchmark-chart");
  const id = `benchmark-chart-${++chartSequence}`;
  figure.append(chartHtml("figcaption", title), chartHtml("p", description, "chart-note"));
  const measured = rows.flatMap((row) => row.values.filter((value) => value !== null));
  if (!measured.length) {
    figure.append(chartHtml("p", "NOT MEASURED / no eligible samples for this chart.", "fine"));
    return figure;
  }
  const maximum = domain ?? Math.max(...rows.map((row) => stacked
    ? row.values.reduce((sum, value) => sum + (value ?? 0), 0) : Math.max(0, ...row.values.filter((value) => value !== null))));
  if (!(maximum > 0)) {
    figure.append(chartHtml("p", "All recorded values are zero; no nonzero bar scale is drawn.", "fine"));
    return figure;
  }
  const left = 194, plotWidth = 410, rowHeight = stacked ? 62 : 74, top = 52;
  const height = top + rows.length * rowHeight + 28;
  const svg = chartSvg("svg", { viewBox: `0 0 800 ${height}`, role: "img", "aria-labelledby": `${id}-title ${id}-desc` });
  svg.append(chartSvg("title", { id: `${id}-title` }, title),
    chartSvg("desc", { id: `${id}-desc` }, `${description} ${rows.map((row) => `${row.label}: ${row.summary}. ${row.detail ?? ""}`).join(" ")}`));
  for (let tick = 0; tick <= 4; tick++) {
    const x = left + plotWidth * tick / 4;
    svg.append(chartSvg("line", { x1: x, y1: top - 10, x2: x, y2: height - 16, class: "chart-grid" }),
      chartSvg("text", { x, y: 24, "text-anchor": "middle", class: "chart-tick" }, `${Number((maximum * tick / 4).toFixed(2))}${unit}`));
  }
  rows.forEach((row, index) => {
    const y = top + index * rowHeight;
    const group = chartSvg("g", { "data-chart-key": row.key });
    group.append(chartSvg("title", {}, `${row.label}: ${row.summary}. ${row.detail ?? ""}`),
      chartSvg("text", { x: 0, y: y + 17, class: "chart-label" }, row.label),
      chartSvg("text", { x: left, y: y + rowHeight - 12, class: "chart-tick" }, row.detail ?? ""));
    let offset = 0;
    row.values.forEach((value, seriesIndex) => {
      if (value === null) return;
      const width = value / maximum * plotWidth;
      const barY = stacked ? y : y + seriesIndex * 18;
      group.append(chartSvg("rect", {
        x: left + (stacked ? offset : 0), y: barY, width, height: stacked ? 24 : 13,
        class: series[seriesIndex].className, "data-series": series[seriesIndex].key, "data-value": value
      }));
      if (stacked) offset += width;
    });
    const summaries = row.summaryLines ?? [row.summary];
    summaries.forEach((text, line) => group.append(chartSvg("text", {
      x: left + plotWidth + 16, y: y + 16 + line * 18, class: "chart-value"
    }, text)));
    svg.append(group);
  });
  const scroll = chartHtml("div", undefined, "chart-scroll");
  scroll.tabIndex = 0;
  scroll.setAttribute("role", "region");
  scroll.setAttribute("aria-label", `${title}; chart scrolls horizontally on small screens`);
  scroll.append(svg);
  const legend = chartHtml("div", undefined, "chart-legend");
  for (const item of series) {
    const label = chartHtml("span", item.label);
    const swatch = chartHtml("i", undefined, item.className);
    swatch.setAttribute("aria-hidden", "true");
    label.prepend(swatch);
    legend.append(label);
  }
  figure.append(scroll, legend);
  return figure;
}
