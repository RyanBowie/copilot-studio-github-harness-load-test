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
    if (report.runs.length || report.documentedLimits.length || report.publication.reviewedOn !== null || report.studyContext !== null) {
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
    if (report.studyContext?.conversationUse === "one_existing_reused" && run.units.conversations !== 1) {
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
      if ((error.category === "unknown") !== (error.evidence === "unclassified_failure")) fail(`${path}.errors`, "unclassified evidence and unknown category must be paired.");
      if (error.evidence === "agent_reported_timeout" && error.category !== "workflow") fail(`${path}.errors`, "an agent-reported workflow timeout is not a wire-status or throttling observation.");
    });
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
    const cost = run.cost;
    checkDate(cost.recordedOn, `${path}.cost.recordedOn`);
    if (cost.status === "settled") {
      if ([cost.currency, cost.amount, cost.source, cost.scope, cost.recordedOn].some((value) => value === null)) fail(`${path}.cost`, "settled requires amount, currency, source, scope and date.");
      if (cost.recordedOn !== null && cost.recordedOn < run.observedOn) fail(`${path}.cost`, "settlement date cannot precede observation.");
    } else if ([cost.currency, cost.amount, cost.source, cost.scope, cost.recordedOn].some((value) => value !== null)) {
      fail(`${path}.cost`, "pending/unknown must not contain settled values; do not encode unknown costs as zero.");
    }
  });
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
