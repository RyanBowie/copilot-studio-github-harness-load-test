# GitHub Copilot Harness / Copilot Studio load report

A separate, aggregate-only report for single-account observations of **Copilot Studio agents powered by the GitHub Copilot Harness**. This is not the Standard Harness study, GitHub coding agent, or Copilot SDK.

**Current state: eight reviewed runs, local only.** The later paced campaign stopped early: **384 attempts, 381 greeting replies, 3 failures, 0 pending**, including a **WorkIQ MCP HTTP transport 429**, not a confirmed GitHub Copilot Harness quota. **No full hour completed.** Its four cohorts are separate from the preserved 100-request burst (33 replies / 67 unclassified failures) and three-turn Teams pilot. All costs remain **pending**, not zero. No Standard Harness data or images are imported. This repository is an offline report, not a cloud test runner. The separate email-to-workflow-to-agent scenario is not implemented.

The branch and commits remain local because the GitHub OAuth application lacks permission to push workflow files. No authentication change, workflow workaround, merge or deployment has been performed.

## Reviewed paced campaign / stopped early on 2026-09-20

One guarded greeting campaign used the same native published Microsoft 365 Copilot path, one verified corporate account, Developer environment, `GPT 5.6 Sol`, memory off and unknown exact published revision. Campaign markers were **19:15:38.150Z to 19:33:36.725Z**. No retries, automatic restart, review/approval/email workload or further load is authorized by this report.

| Cohort | Planned arrival window / calls | Actual attempts / eventual replies / failures | Result | Successful native-completion p50 / p95 |
| --- | --- | --- | --- | --- |
| Calibration 10 RPM | 120 s / 20 | 20 / 20 / 0 | Qualified | 8.431 / 10.380 s (n=20) |
| Calibration 25 RPM | 120 s / 50 | 50 / 50 / 0 | Qualified | 8.064 / 12.842 s (n=50) |
| Calibration 50 RPM | 120 s / 100 | 100 / 98 / 2 | 98%, below the predeclared 99% rule | 7.644 / 9.676 s (n=98) |
| Hourly attempt at 25 RPM | 3600 s / 1500 | 214 / 213 / 1 | Stopped after 512.2330114 s of arrivals | 7.858 / 9.680 s (n=213) |

All four cohorts drained with zero pending. The hour attempt's **213 eventual replies** comprise **211 before its observed arrival-end boundary and two during drain**, not 213 completions inside its 512.2330114 s arrival window. Calibration **100/150 RPM was not attempted**. The two failures at 50 RPM were generic WorkIQ `server_error` invocation outcomes with no explicit throttle evidence. The selected **25 RPM is the last qualified calibration rate, not a capacity ceiling**. There is no observed full-hour total or extrapolated successful hourly result.

The terminal failure was independently classified as **WorkIQ MCP HTTP transport HTTP 429**, completing in **65.2273999999743 ms**. GitHub Copilot Harness attribution is **unknown**; no conversation identifier or exposed Retry-After was returned. The safety stop left **1286 unoffered requests**, not agent failures, and there were **zero skipped client slots**. No backoff/retry or limit bypass followed.

**383 distinct returned Microsoft 365 conversation identifiers** were verified across the campaign: cohort counts 20, 50, 100 (including the two generic failures) and 213. Do not infer 384 conversations from 384 attempts. Runtime sessions remain unknown. Reviewed client-outstanding peaks were **3 / 5 / 9 / 5**, campaign peak **9**; these are not backend/model execution counts. Native completion timing uses separate success/failure/all-settled nearest-rank populations, not visible answer/UI timing. The stopped-hour all-outcome p50 is **7849.779300000053 ms (n=214)**, distinct from successful-reply p50 **7857.503999999957 ms (n=213)**. Percentiles are never pooled across stages.

**Timing precision:** completed calibrations use a scheduled 120 s offer window for dispatch accounting, while observed timer-end offsets are 120.01460379999992, 120.00120519999997 and 120.00015639999998 s. Drain begins at that separately observed offset. The stopped hour's arrival-duration read is 512.2330114 s; its arrival-end offset read is 512.2329960000001 s, plus 6.061770299999974 s drain, yielding **518.2947663 s** observation through drain. Preserve the distinct reads and raw precision; do not round counters or UTC markers into apparent equality. Per-minute counts are **request-dispatch cohorts with outcomes at the post-drain cutoff**, not completions that happened in that minute.

Monitor at **19:34:29Z** still showed **36 old sessions**, no posted credit usage and **updated two hours ago**: stale precampaign analytics, not attributed campaign usage or zero cost. The accepted budget was request-only, not a hard monetary cap or billing evidence. All costs remain pending/null.

Supplemental Studio history at **19:45:28Z** returned a bounded page of **150 metadata records**, all matching the partial hour's successful conversations and marked Completed / Microsoft 365 Copilot: **150 of that cohort's 213 successes**. With page size 150 and `hasMore=true`, this is partial corroboration: it does **not** establish that all 381 campaign successes matched history or that any other request was absent from the backend. No transcript or identifiers are reproduced.

## Measured native Microsoft 365 burst / 2026-09-20

One actual 100-request burst was executed by the testing owner through **native WorkIQ `ask` to the exact published agent**, not Teams, Studio Preview or direct engine. A Copilot app extension used `session.rpc.tools.execute` through the native invocation pipeline, not a separate Copilot SDK agent/harness. Manifest/registry target matching and Studio history corroborate the target; no IDs are published. No token extraction, private-endpoint replay, permission override or extra agents were used.

| Measure | Reviewed result | Scope |
| --- | --- | --- |
| Attempts / greeting replies / failures / pending | 100 / 33 / 67 / 0 | This burst only; **33% reply success** |
| Distinct Microsoft 365 conversations | 100 | IDs verified including 67 from failed-invocation payloads; not runtime sessions |
| Client launch spread / peak outstanding | 1.6675 ms / 100 | Client RPC launch and outstanding native calls; independently verified by a start/end interval sweep, not just configured concurrency; not network/server admission or backend/model execution |
| Batch duration | 39.0336098 s | Monotonic native completion window; not derived from wall-clock markers |
| Wall-clock markers | 16:54:21.563Z to 16:55:00.600Z | Date 2026-09-20; marker difference is 39.037 s, a distinct time source |
| Configuration | One corporate account, Developer, GPT 5.6 Sol, memory off | Exact published revision unknown |
| Retries and excluded work | 0 runner retries; managed-service retries unknown | Two earlier Microsoft 365 probes and all three earlier Teams turns excluded |
| Cost | Pending / null amount | Stale Monitor analytics cannot settle burst cost |

**Native invocation-completion durations**, including pipeline overhead; **not visible answer, UI-stable, TTFA or backend timing**:

| Population | n | Minimum (ms) | p50 (ms) | p95 (ms) | Maximum (ms) |
| --- | --- | --- | --- | --- | --- |
| Successful greeting replies | 33 | 8866.5169 | 17299.0789 | 33442.3959 | 34378.6106 |
| Failed invocations | 67 | 8235.0156 | 24965.3921 | 37946.5726 | 39024.4086 |
| All invocation outcomes | 100 | 8235.0156 | 24526.3908 | 37266.7486 | 39024.4086 |

Percentiles are **nearest-rank**, one-based `ceil(p*n)` over sorted raw monotonic durations within each population. The all-outcomes p95 is not reply latency. No average of percentiles, pooling across surfaces, or backend concurrency claim is made. The HTML rounds native duration display to three decimal seconds; public JSON preserves reviewed raw precision.

Independent timing calibration used 200 ms / 2,200 ms local native RPC operations, returning in 1.5626 s / 3.4893 s respectively. The distinct completion durations demonstrate that these native measurements were not batch-coalesced. Ordinary multi-tool CLI event/hook timestamps **were coalesced and were excluded**. Calibration does not remove client overhead or prove backend execution timing.

All 67 failures have native `resultType: "failure"` and the same generic WorkIQ/Microsoft 365 `server_error` at invocation; they are **not runner JSON-parse failures**. They are **unclassified invocation failures**, not confirmed GitHub Copilot Harness throttles: no explicit 429, Retry-After, `RATE_LIMIT_REACHED` or numeric quota evidence was observed. The bottleneck/layer is unknown. Every successful answer was a brief greeting with no workflow, approval, email or send claim; no lastStep tool was recorded on matched successful history rows.

A later workflow Activity check at **17:01:58Z** still showed only the original waiting pilot review run: the greeting burst added no **recorded** review runs. This is a scoped Activity observation, not an exhaustive claim about unobservable backend activity. No private controller artifacts, identifiers or file hashes are included.

All **33 successful conversation IDs exactly intersect** 33 Completed Microsoft 365 Copilot entries in Studio history. None of the 67 failed IDs appeared in the returned snapshot, but **hasMore=true**: its 37 rows include those 33 successes, two earlier Microsoft 365 probes, an earlier Teams row and an unused Preview stub. The snapshot is not exhaustive and history completeness/delay is unknown; absent IDs do **not** prove calls never reached the harness.

Post-burst Monitor checked at **16:59:36Z** said **updated 44 minutes ago**, showing one old Teams session, seven messages and no recorded credits. Those are **stale preburst analytics**, not burst totals or zero cost. Burst runtime sessions remain unknown.

Prompt template: `Hello! Please reply with a brief greeting only. Greeting reference: burst-NNN.` The burst includes only references **001..100**. The separate 000 preflight (9.4315 s) and an earlier Hello probe (10.971 s, uncalibrated client-tool event) are excluded from timing/count statistics. There were 102 new Microsoft 365 greeting calls across probes plus burst, but **only 100 belong to this run**. No workflow/approval/email requests, no automatic retry and no new live activity are implemented here.

## Earlier reviewed Teams pilot / 2026-09-20

These three sequential sent-message attempts reused **one existing Teams conversation**: two successful requested outcomes and one agent-reported review-submission timeout, with no agent-call outcome still pending after follow-up. The underlying review workflow remains separately Running/Waiting. This earlier pilot had no high-volume ramp; its context does not describe the subsequent native burst.

All three pilot runs used published Teams, Developer environment, `GPT 5.6 Sol`, one authenticated account and memory off. The Agents grid independently showed Powered by GitHub Copilot and Published, but the exact agent version was not frozen. Runtime session count is unknown, even though the single reused channel conversation is known.

| Run | First activity | First actual answer | UI settled (3 s stable + feedback) | Outcome at cutoff |
| --- | --- | --- | --- | --- |
| Greeting | 9.447 s | 9.447 s | 13.573 s | Completed |
| Public knowledge | 7.726 s (status) | 26.234 s | 30.031 s | Completed |
| Compliance review | 8.965 s (status) | Unmeasured outside window | Unmeasured outside window | Pending at 120.167 s; later requested submission failed |

Each timing is one observation, not an estimated latency distribution. For n=1, p50, p95 and max necessarily repeat that same value. The first two rows have no involved workflow or connector; the public run used built-in web search/browse, not a connector action. The compliance run involved a workflow and connectors, including observed SharePoint search/snippet activity.

The greeting also had **one excluded unsent-draft setup issue**, observed for 120.096 s, then recovered once with real keyboard input and no automatic retry. It is not a sent-message failure, agent timeout or throttle.

For compliance, review-tool invocation status appeared at 66.917 s; no final answer was observed by the 120.167 s timing cutoff. **Read-only follow-up at 2026-09-20T16:16:39Z** found a later agent message reporting a workflow HTTP 504 timeout, unconfirmed submission and no retry. An earlier response was marked stopped; a later grounded draft was visible, but its text and internal citations are excluded. This is an **agent-reported workflow/tool timeout**, not independently observed wire-level HTTP status or throttling. The requested operation is now counted **failed**, not pending or successful merely because a final explanatory message exists. Exact late answer/end latency is unmeasured; the original timing window is not extended by guesswork.

A separate workflow-history check shows one **Running** workflow run, trigger **Succeeded**, Human review **Waiting**, Email **Waiting**, and no final outputs. An agent-call timeout does not mean the workflow was cancelled or no review was created. Notification delivery and the actual human decision remain **unconfirmed**. The tester performed no approval, email action or retry. This functional-pilot discovery is not a GitHub Copilot Harness capacity finding.

Configuration discrepancies: the standalone Teams-send tool is missing (the conversation channel itself works), and **Search all websites is ON**, not restricted to one nominated Learn page. The tester did not edit, save or republish that configuration. Pre-pilot Monitor and a loaded post-pilot check at 16:16Z both showed no recorded sessions/credits, but analytics and billing can lag; neither is evidence of zero usage or cost. No numerical throttle threshold or high-volume ramp was observed. Separately reviewed documentation is scoped below, not reported as observed load.

Approved workload definitions (not transcripts):

- Greeting: `Hello!`
- Public knowledge: `Using Microsoft Learn, define a Power Platform environment in two sentences and cite the source.` The requested two-sentence format and a real Microsoft Learn citation were observed, not a general correctness benchmark.
- Compliance review: hypothetical internal app with synthetic device-request data; request DLP/environment-governance considerations, configured sources and a concise human-review submission. No internal content, identities or URLs are included.

## Local use

Node.js 22+ is required. The validator, build, browser runtime, and contract tests are dependency-free.

```powershell
npm test
npm run validate
npm run build
```

Open `dist\index.html` directly, or serve `dist` with a local static server. The page embeds the validated dataset, schema, CSS and JavaScript: it performs no API calls, loads no remote fonts or scripts, and works offline. Download links to `report.json` and `report.schema.json` use companion files in `dist`. Never serve the repository root as the report.

| File | Responsibility |
| --- | --- |
| `data/report.json` | Only allowed publication input; reviewed public aggregates or the empty seed |
| `schema/report.schema.json` | Closed JSON Schema, draft 2020-12 |
| `src/validate.mjs` | Shared structural, cross-field and privacy checks; fail-closed schema subset |
| `src/index.html`, `src/report.js` | Accessible static shell and safe text-based rendering |
| `scripts/build.mjs` | Validates fixed input and emits a self-contained HTML report plus JSON/schema |
| `tests/fixtures/synthetic-report.json` | Explicitly synthetic, offline-only branch coverage; never a publication source |
| `scripts/browser-qa.mjs` | Isolated, loopback-only Playwright/axe QA; no reused browser profiles |
| `.github/workflows/pages.yml` | Offline CI and separately gated, manual Pages deployment |

## Public aggregate contract (v1)

The JSON Schema is the structural source of truth. All object shapes are closed (`additionalProperties: false`); required fields must be present. Unknown measurements use `null`, not placeholders, fabricated zeros, omitted fields or assumed defaults. The shared validator adds the following semantic constraints that JSON Schema alone does not express.

### Root and review gate

The required root fields are `schemaVersion`, `harness`, `outcomeBasis`, `publication`, `studyContext`, `runs` and `documentedLimits`; `pacedCampaigns` is optional reviewed context.

- `schemaVersion` is `1`; `harness` is exactly `GitHub Copilot Harness`.
- `outcomeBasis` is exactly `requested_operation`. Outcome counts are not a count of final visible messages; a returned draft or error explanation does not make an unconfirmed requested submission successful.
- `publication.status: "awaiting_pilot"` requires empty runs/limits, `studyContext: null` and `reviewedOn: null`.
- `publication.status: "reviewed"` requires a real ISO `YYYY-MM-DD` review date and at least one reviewed run or documented limit. Observation, settlement and documentation retrieval dates cannot postdate that review.
- `reviewedOn` is an attestation by the report preparer after evidence and privacy review, not an automatic validation stamp. It contains no reviewer identity. Validation cannot prove that review occurred. These pilot aggregates were reviewed by the authorized testing/reporting agent; this does not attest to a new human review or to the separate workflow's human decision.
- Run keys and limit keys are unique public slugs, **not source IDs**. Publication rejects reserved offline/fixture/synthetic/example/fake/test keys.
- `studyContext` is `null` when unestablished, or a closed object with explicit `runKeys` scoping reviewed conversation reuse, sequential execution, ramp/configuration-change state, pre/post-pilot Monitor observations and harness/published-badge verification. Every key must reference a reviewed run. `conversationUse: "one_existing_reused"` means only those runs' `units.conversations: 1` refer to the same existing conversation. It does not constrain a separate native run's 100 distinct conversations.
- Optional `pacedCampaigns` contains closed reviewed campaign contexts referencing exactly their cohort `runKeys`. Each records ordered UTC campaign markers, transport-stop status, independently verified distinct returned conversations, client peak, explicit unattempted calibration rates and a stale postcampaign Monitor snapshot. Context cannot infer a global distinct count by summing per-run values, attach unattempted rates to measured stages, or relabel a stop as full-hour completion. Campaign contexts contain no monetary consent, identity or private source metadata.

### One run record

Every field in the table is required except `pacedMeasurement`; only explicitly nullable fields accept `null`.

| Field | Meaning and constraints |
| --- | --- |
| `runKey` | Nonidentifying public slug, at most 32 lowercase letters/digits/hyphens, starting with a letter |
| `observedOn` | Date of the observation cutoff |
| `surface` | `published_teams`, `published_microsoft365_copilot` or `studio_preview`; do not combine them in a run |
| `agentVersion`, `model` | Reviewed public labels (64 characters maximum), or `null` when unknown; no identifiers, URLs or free-form evidence |
| `environmentType` | `production`, `developer`, `sandbox`, `trial` or `unknown`; no environment name or ID |
| `authenticatedAccounts` | Exactly `1`; a larger/multi-account experiment needs a new contract |
| `memory` | `on`, `off` or `unknown`; configuration only |
| `workload` | `single_turn`, `multi_turn` or `mixed` |
| `workflow`, `connectors` | Each is `involved`, `not_involved` or `unknown`; no workflow or connection details |
| `counts` | Nonnegative integer `completed`, `failed`, `pending`; positive integer `attempted` must equal their sum |
| `units` | `conversations` and `sessions`, each observed positive integers or `null`; each cannot exceed attempts |
| `windowSeconds` | Positive observed full-window duration, or `null`; message-send through cutoff for visible runs, measured cohort-start through drain/cutoff for paced runs |
| `firstVisibleActivity`, `firstVisibleLatency`, `latency` | Each `null` or an independent activity / first actual answer / UI-settled timing summary described below |
| `nativeInvocation` | `null` for visible-channel runs; a closed, separately validated native completion/dispatch/evidence object for the published Microsoft 365 Copilot run |
| `pacedMeasurement` | Optional closed paced-cohort record, described below. Omit on existing runs; mutually exclusive with non-null `nativeInvocation` |
| `concurrency` | `null` or `{ "maxInFlight": positive integer, "basis": "observed_message_overlap" }`; never a configured worker count |
| `arrival` | `null` or observed positive `attempts` and `windowSeconds`; no inferred arrival schedule |
| `errors` | Array of structured failure categories; counts exactly cover failed messages |
| `clientIssues` | Array (empty if none recorded) of excluded client setup issues, currently only `unsent_draft`, with positive `count` and nullable positive `observedWaitSeconds` |
| `workflowState` | `null`, or the narrowly supported later-history snapshot of a Running/Waiting review workflow; independent of the agent-call outcome |
| `followUp` | `null`, or the reviewed later agent-reported timeout outcome with UTC observation time and preserved at-cutoff counts |
| `observations` | Unique approved codes for timing/configuration/activity observations; see the schema enum. No arbitrary narrative text, raw content or identifiers |
| `cost` | Required status and nullable evidence fields, described below |

An **attempt** is a sent user message or a native invocation on its labelled surface. Runner retries are additional attempts; managed-service retries are not assumed known. An unsent draft belongs in `clientIssues`, never in attempted/failed/throttling counts. A client-only episode with no sent messages is not an agent run under v1. **Completed** means the requested operation was reported successful with a visibly settled response for the Teams pilot, or a native invocation returned the requested greeting for the burst. It is not a general correctness evaluation or backend completion measurement. **Failed** means observed or reported failure of the requested operation, with its evidence class explicit; a final explanatory message can coexist with failure. **Pending** means the requested outcome remains unresolved at the stated snapshot.

Configuration discrepancies belong in structured observations, not successful tool execution. An attached human-review workflow is not evidence that it ran, and a missing standalone Teams-send tool cannot be reported as successful standalone delivery.

A **run** is one bounded observation window. Each record owns non-overlapping attempts; replace a run's snapshot in place as pending outcomes settle. A **conversation** is a channel thread or verified Microsoft 365 conversation identifier; a **session** is a runtime session only when observable. IDs returned in failure payloads are conversation evidence, not backend execution evidence. Do not infer session count or add per-run conversation counts into a globally distinct total. The overview keeps each native batch separate and groups visible-channel message counts only within their own surface; it does not headline a mixed 103-attempt result.

### Latency, rates and errors

`firstVisibleLatency` (first **actual answer**, not status activity) and `latency` both require:

```text
kind: visible_response
start: message_send
percentileMethod: nearest_rank
sampleCount: observed positive count, no greater than completed
p50Ms, p95Ms, maxMs: positive milliseconds; p50 <= p95 <= max
```

`firstVisibleLatency.end` is `first_visible_answer`. Loading, search, skill and tool-invocation status messages are explicitly excluded. `latency.end` is `feedback_controls_and_text_stable` and additionally requires positive `stabilitySeconds`. This operational UI-settled rule requires feedback controls to be present and response text unchanged for that recorded interval; the interval is included in elapsed latency. Do not substitute backend completion for this rule.

`firstVisibleActivity` is separate: `kind: "visible_activity"`, `start: "message_send"`, `end: "first_status_or_answer"`, `percentileMethod: "nearest_rank"` and the same `sampleCount`, `p50Ms`, `p95Ms`, `maxMs` fields. Its eligible sample count is **sent attempts**, including failed or still-pending turns, not just completed messages. A status-only turn stays pending, not answered, unless a terminal failure is actually observed. Do not substitute a later workflow invocation for the first activity when earlier activity occurred.

Compute nearest-rank percentiles by sorting the private elapsed-time samples ascending and taking the one-based rank `ceil(p * n)` for p50 and p95. A one-sample summary must have equal p50, p95 and max; for fewer than 20 samples p95 must equal max. Maximum latency cannot exceed the full known observation window. When answer and settled endpoints cover every completion, settled percentiles cannot precede first-answer percentiles plus the stability interval. First-activity versus first-answer ordering is checked only when both cover the entire same fully completed run. Smaller or differently eligible sample sets are not assumed to be paired. Failed, pending and untimed completions are excluded from answer/settled latency, but can contribute to activity timing. Keep source samples outside git.

These are **three distinct visible endpoints**, including channel/rendering delay, **not backend TTFA, first-token time or backend completion**. The report never combines endpoints or per-run percentiles.

For runs with multiple sent messages, observed completion pace is `completed / windowSeconds * 60`; arrival rate is `arrival.attempts / arrival.windowSeconds * 60`. A single-message pilot shows its observation window, not an extrapolated per-minute completion rate. The arrival window may differ from the full window but cannot exceed it when both are known; arrivals and maximum in-flight messages cannot exceed attempted messages. These are descriptive window rates, not steady-state platform capacity.

Error categories are `throttling`, `authentication`, `timeout`, `transport`, `connector`, `workflow`, `agent`, `unknown`, once per category. Each has a positive `count` and an `evidence` class: `visible_error`, `transport_status`, `unclassified_failure`, `unclassified_invocation_failure`, `agent_reported_timeout` or `workiq_mcp_transport_429`. Agent-reported timeout is restricted to workflow category, not a proven wire status or throttle. Unknown category and unclassified evidence must be paired; invocation evidence additionally requires `nativeInvocation` or `pacedMeasurement`. Do not infer throttling from latency or generic server_error. Raw error bodies and correlation IDs are prohibited.

The closed evidence value **`workiq_mcp_transport_429`** means an observed **WorkIQ MCP HTTP transport HTTP 429**, paired with category `throttling` on a paced cohort. Its fixed scope is transport; **GitHub Copilot Harness attribution is unknown**, not a confirmed harness quota or capacity ceiling. This narrow evidence shape also records that no conversation identifier or exposed Retry-After was returned, so the validator excludes those failed attempts from possible returned-ID counts. It does not prove no backend activity occurred. A runner's generic throttle classification is not accepted as public evidence. Use `stopReason: explicit_throttle` for the guarded stop; the UI names the transport layer, rather than declaring a harness limit. Do not publish raw stacks, internal type names, IDs or paths.

### Native invocation contract

`nativeInvocation` is separate from `visible_response` and requires surface `published_microsoft365_copilot`. The current narrowly supported shape covers a finished native batch with outcomes fully classified as replies or generic unclassified invocation failures:

- Path `workiq_ask_via_native_tool_rpc`, endpoint `invocation_completion`, request kind `greeting_only`, target verification `published_manifest_and_registry_match`. This narrow native shape requires `single_turn`, workflow `not_involved`, no workflow state and no unsent-draft episodes; broader native workloads require an explicit contract extension rather than silently inheriting greeting labels.
- `startedAt` / `endedAt`: ordered millisecond UTC wall-clock markers; `windowSeconds` remains the independently measured monotonic duration. Marker subtraction is not substituted for that duration.
- `dispatchWindowMs`, `peakOutstanding` and `concurrencyBasis: "outstanding_client_invocations"` represent **client launch and outstanding calls**, verified by `concurrencyVerification: "start_end_interval_sweep"`, never network arrival or model execution. Generic `concurrency`, `arrival` and all three visible latency fields must be null.
- `success`, `failure` and `allOutcomes` each have `sampleCount`, nullable `minMs`, `p50Ms`, `p95Ms`, `maxMs`. Group sizes exactly match outcome counts; timings must be ordered, bounded by the calibrated batch and retain their own populations. A group with no outcomes must be null, not invented. `percentileMethod` is explicit; this reviewed burst uses `nearest_rank`.
- `conversationEvidence: "unique_ids_from_success_and_failure_payloads"` requires conversations to equal attempted invocations and `failedConversations` to equal failed calls. No actual identifier is allowed.
- `runnerRetries: 0`, `managedServiceRetries: "unknown"`, `excludedPreflights`, generic `errorEnvelope`, `failureResultType: "native_failure"`, `throttleEvidence: "none_explicit"` and `bottleneck: "unknown"` keep native failure evidence separate from runner parse failures and inferred capacity limits.
- `calibration` records distinct requested/observed short/long local durations with clock `native_rpc_completion` and `eventTimestamps: "coalesced_and_excluded"`.
- `history` stores aggregate corroboration only: completion count, failed IDs absent from the returned snapshot, explicit membership-verification state, row count, `hasMore: true`, partial completeness and no lastStep recorded. It cannot establish exhaustive backend absence.
- `postRunMonitor` records the stale check instant, update age and old displayed counts. The validator ensures that the check follows the burst but the reported last update predates it. These are not burst session/credit counts and do not settle costs.

`workflowState` supports this specific reviewed evidence shape: positive `invocationStatusFirstSeenMs`, `historyCheck: "after_message_cutoff"`, positive `runningRuns`, `triggerStatus: "succeeded"`, `humanReviewStatus: "waiting"`, `emailStatus: "waiting"`, `finalOutputs: "not_available"`, `reviewNotificationDelivery: "unconfirmed"`, `humanDecision: "unconfirmed"` and `testerApprovalOrEmail: "none"`. It requires an involved workflow, **not a pending agent call**. The visible invocation status must be inside the message window; the later history check is not silently backdated to that cutoff. Other workflow states require a reviewed schema change rather than coercion into this waiting-state shape.

`followUp` records the later timeout-discovery snapshot: `observedAt` (real UTC instant), `atCutoff` (earlier attempted/completed/failed/pending partition), `outcome: "agent_reported_workflow_timeout"`, `reportedHttpStatus: 504`, `wireStatus: "not_independently_verified"`, `earlierResponseStatus: "stopped"`, `draftVisible: true`, `submissionConfirmed: false`, `retried: false`. It must update a pending requested outcome to failed with agent-reported workflow-timeout evidence, preserve the same sent attempts and keep late answer/settled timings null. It neither changes the workflow-history state nor implies cancellation.

### Optional paced cohort contract

Four reviewed paced cohorts are now in the public dataset; the original four records remain unchanged. Support for a full hour does **not** mean one completed. Synthetic cases live only in `tests/fixtures/synthetic-paced-report.mjs`; their `offline-*` run keys are rejected by the publication loader. No runner, credentials, private consent, account names, controller artifacts or raw responses are stored here.

Add one **reviewed** run per nonempty calibration stage or hourly arrival cohort, never a duplicate campaign-total run. Use the existing native published surface and single-account greeting workload, with `nativeInvocation: null` and optional `pacedMeasurement` populated. Do not turn a never-started stage or zero-dispatch plan into a run. A stopped calibration-only campaign needs no invented hour record. Existing visible timing, legacy `arrival`/`concurrency`, workflow state and follow-up fields stay null.

All fields below are required inside `pacedMeasurement`; the schema provides the complete machine-readable shape:

| Fields | Contract |
| --- | --- |
| `campaignKey`, `phase` | Public nonidentifying grouping slug; `calibration` or `hour`. Never a source ID |
| `path`, `endpoint`, `requestKind`, `timingBasis` | `workiq_ask_via_native_tool_rpc`, `invocation_completion`, `greeting_only`, `calibrated_native_rpc_completion` |
| `startedAt`, `arrivalEndedAt`, `observedThroughAt` | Ordered millisecond UTC metadata; cutoff date matches `observedOn`. Do not derive monotonic duration from wall-clock subtraction |
| `targetRpm`, `plannedArrivalSeconds`, `plannedSlots` | Protocol intent, not observation: 10/25/50/100/150 RPM; 120 s calibration or 3600 s hourly arrivals. Planned slots equal rate times planned minutes |
| `arrivalSeconds`, `arrivalEndObservedSeconds`, `drainSeconds` | Offer-window duration (scheduled cutoff for completed windows, actual cutoff for early stops), independently measured monotonic arrival-end offset, and subsequent drain. **Observed end offset + drain equals `windowSeconds`**, not scheduled window + drain. Timer overshoot/separate reads remain explicit. Achieved dispatch RPM uses `arrivalSeconds`, not the drain-inclusive duration; it is not an extrapolated hourly completion result |
| `skippedSlots`, `unofferedSlots` | Missed client slots versus remaining slots not offered before stop/cutoff. `attempted + skipped + unoffered = plannedSlots`. Neither belongs in agent attempts or failure statistics |
| `arrivalStatus`, `stopReason` | `full_window`, `stopped` or `partial`; full requires planned duration, no unoffered slots and null reason. Partial requires early `observation_cutoff`. Stopped requires a reviewed enum reason, not arbitrary text. Native `authentication`/`explicit_throttle` require matching errors; a pre-dispatch `account_guard` is separate and must not invent a failed agent invocation |
| `drainStatus` | `complete` only with no pending calls, otherwise `bounded_cutoff`. A full arrival hour can still have missed slots, errors or pending drain outcomes |
| `qualification`, `qualifyingRunKey` | Calibration `qualified` only when all slots dispatched, drain complete, at least 99% requested greetings and healthy measured pacing; otherwise `not_qualified` or `not_evaluated`. Hour uses `not_evaluated` and references the highest prior qualified calibration in the same campaign |
| `pacing` | `schedule: absolute_slots`, `missedSlotPolicy: skip_without_replay`, `intervalMs: 60000/targetRpm`, `jitterAllowance: 0.05`; paired nullable `observedMinIntervalMs` / `violatingIntervals` describe actual gaps. At 150 RPM, intended 400 ms allows minimum 380 ms. Violations remain reportable but cannot qualify a stage |
| `peakOutstanding`, `concurrencyBasis`, `concurrencyVerification` | Nullable measured peak (max 100), `outstanding_client_invocations`, paired `start_end_interval_sweep`, `reviewed_client_peak` or null. The last measured form attests the reviewed client peak without inventing a particular recomputation method. Not configured workers or backend/model executions |
| `conversationPolicy`, `conversationEvidence`, `failedConversations` | `fresh_per_request` is intent, not a count. `returned_ids_checked_unique` pairs with known `units.conversations`; otherwise null. Nullable failed-ID count cannot exceed failures or verified distinct conversations. Sessions remain independent |
| `runnerRetries`, `managedServiceRetries` | Zero and `unknown`, respectively. These do not claim control of managed-service retries |
| `percentileMethod`, `success`, `failure`, `allOutcomes` | Nearest-rank over separate native completion populations with the same summary fields as the burst. Samples match successful, failed and **settled successful+failed** counts. Pending calls are excluded; no settled samples means null. No pooled or averaged cohort percentiles |
| `minuteBasis`, `minutes` | `client_dispatch_cohort_outcomes_at_cutoff`; contiguous elapsed-minute buckets with `offsetSeconds`, `durationSeconds`, `attempted`, `completed`, `failed`, `pending`. Only the final bucket may be partial. All bucket totals reconcile to run counts at the same observation cutoff |

**Minute replies/errors belong to requests dispatched in that minute**, even when those outcomes arrive later during drain. They are not completion-minute throughput, fixed clock-hour totals or best rolling-hour totals. The renderer labels that distinction rather than claiming a successful hourly rate from planned RPM. Calibration versus hour, stopped/partial versus full arrivals, intended versus achieved dispatch rate and native versus visible timing stay separate.

The bounded protocol supports distinct calibration rates (at most 670 planned calibration calls) and at most one hour cohort (at most 9000 planned calls), capped at 9670 requests per campaign. Those numbers are protocol constraints, **not executed counts, spending evidence or future authorization**. Private account/consent checks remain the testing owner's responsibility; this report makes no authenticated calls. A generic calibration error can leave an earlier rate qualified, but does not establish a harness limit. No further cohort in the same campaign may follow a terminal guard or pacing violation. Safety/authentication/explicit-throttle/client-pacing stops are not automatic-retry opportunities. Stale Monitor counts, budget acknowledgment and absent posted credits cannot settle cost; keep pending/null until reviewed billing evidence exists.

For ingestion, supply observed slot accounting, UTC markers and monotonic windows/arrival-end offsets, per-dispatch-minute outcomes, distinct verified conversation counts, outcome-specific latency summaries and classification evidence. The offline fixture factory illustrates full, stopped, partial and calibration-only shapes but is not a source of public values. Rerun responsive UI QA when reviewed actual cohorts change.

### Costs from the first run

Every run has `cost: { status, currency, amount, source, scope, recordedOn }`.

| Status | Allowed evidence |
| --- | --- |
| `pending` | All five evidence fields are `null`; evidence is expected but not settled |
| `unknown` | All five evidence fields are `null`; cost or attribution is unavailable |
| `settled` | All evidence fields are present; nonnegative amount, approved currency, source, scope and settlement date |

Currencies in v1: `USD`, `GBP`, `EUR`, `CAD`, `AUD`, `JPY`. Sources: `billing_export`, `invoice`, `usage_meter`. Scopes: `this_run`, `shared_window`. Settlement cannot predate the run. A usage meter is not settled merely because it has a preliminary estimate. Keep pending until the evidence is final for its stated scope.

Zero is permitted **only as a reviewed settled amount**. Fractional costs are retained without rounding a positive value to zero. The UI does not sum currencies or shared windows, infer a total, or invent a per-message cost. Additional currencies/evidence formats require an explicit schema and test change.

### Documented numerical limits

`documentedLimits` is separate from observations. Each item has `limitKey`, `harnessScope`, `scope`, `metric`, positive `value`, `sourceUrl`, `retrievedOn` and `applicability`. `harnessScope` explicitly separates `github_copilot_harness`, `standard_harness`, `teams_bot_api` and `teams_connector`; see the schema for scope and metric enums. `applicability` is `unverified` or `confirmed_for_configuration`.

Only HTTPS documentation URLs under `learn.microsoft.com` or `docs.github.com` are allowed, with no query, credentials, encoded identifiers or arbitrary hosts. A documentation limit is neither a measured ceiling nor automatically applicable to a different configuration. The single numeric entry currently represents the documented one-active-turn-per-conversation GitHub Copilot Harness rule, not an observed throttle.

### Reviewed primary-source context / checked 2026-09-20

| Layer | Documented statement | Interpretation |
| --- | --- | --- |
| [GitHub Copilot Harness error codes](https://learn.microsoft.com/en-us/microsoft-copilot-studio/agents-experience/troubleshooting-error-codes) | `CONVERSATION_BUSY`: one active turn per conversation. `RATE_LIMIT_REACHED` and `QUOTA_EXCEEDED` are documented. | Per conversation, **not per account**. The source supplies no numeric GitHub Copilot Harness RPM/token ceiling. None was measured here. |
| [Standard Harness quotas](https://learn.microsoft.com/en-us/microsoft-copilot-studio/requirements-quotas) | Developer 10 RPM / 200 RPH is explicitly **Standard Harness** scope. | Do not present these numbers as a proven limit for this GitHub Copilot Harness agent. |
| [GitHub Copilot Harness usage controls](https://learn.microsoft.com/en-us/power-platform/admin/manage-usage-github-copilot-harness) | Shared agent/month credit caps and environment capacity / Stop usage controls; GitHub usage remains billed with a Microsoft 365 Copilot license; Developer/trial usage-based billing from 1 September 2026. | Controls/billing policy, not a measured per-run charge or a workload rate limit. All pilot costs remain pending. |
| [Teams bot conversation API](https://learn.microsoft.com/en-us/microsoftteams/platform/bots/how-to/rate-limit) | Conversation API estimates: 7 requests / 1 s, 8 / 2 s, 60 / 30 s, 1,800 / 3,600 s; global 50 requests/s per app per tenant. | Transport requests, **not agent turns**. Estimates can change and one message can split into requests. Not a bot-invocation contract. |
| [Teams connector](https://learn.microsoft.com/en-us/connectors/teams/#throttling-limits) | 100 calls / 60 s per connection; listed non-GET / Flow-bot operations 25 / 300 s; other operations 300 / 300 s. | Operation-specific connector limits, not published conversational-channel allowances. |
| [GitHub Copilot Harness publication channels](https://learn.microsoft.com/en-us/microsoft-copilot-studio/agents-experience/publication-channels-overview) | Teams, Microsoft 365, demo and iframe channels; native DirectLine unavailable. | Earlier pilot used published Teams; measured burst used published Microsoft 365 Copilot. Preview remains separate. |
| [CopilotStudioClient / Agents SDK integration](https://learn.microsoft.com/en-us/microsoft-copilot-studio/publication-integrate-web-or-native-app-m365-agents-sdk) | Existing integration guidance is Standard Harness only. | No supported programmatic published GitHub Copilot Harness user-client contract was established from these sources. Never replay private endpoints or presume Teams APIs invoke the bot. |
| [Billed-credit activity timing](https://learn.microsoft.com/en-us/microsoft-copilot-studio/agents-experience/authoring-review-activity#billings) | Billed credits update after "a few hours"; no exact SLA. | An empty pre-pilot meter is not zero usage or settled cost. |

The user explicitly requested and the testing owner executed one bounded 100-call native burst; it is not merely a future plan. This report update creates no live runner and grants no further/open-ended load authorization. Additional work requires an explicit bound, excludes review/email workloads and must not automatically retry ambiguous failures. Earlier single-chat wait-for-completion guidance describes the Teams pilot, not the measured distinct-conversation burst. Neither serial turns nor outstanding client RPCs establish backend/model concurrency. Old Standard Harness results from a different tenant, Production environment and DirectToEngine transport support descriptive comparison only, not a controlled harness-only comparison.

## Safe ingestion and publication

**This is a public repository: a draft PR is already public. Sanitize before writing, committing or opening a PR.**

1. Keep raw evidence outside this repository. Exclude UPNs; tenant, environment and agent IDs; internal SharePoint content/URLs/citations; Teams/chat URLs/IDs; connection details; credentials; transcripts; screenshots; and identifying filenames.
2. The report preparer reviews an aggregate against private source evidence, performs the privacy review and supplies only the permitted facts. Use `null` or an explicit unknown/pending state where evidence is missing. Plain labels/slugs can still disclose identity: explicitly review them rather than relying on validation.
3. Edit only the reviewed public facts in `data/report.json`, set the explicit review date, and update existing run keys rather than duplicating snapshots. Run `npm test` and `npm run build`; inspect the generated page and JSON before committing.
4. Review the public PR. Merging **does not deploy**. No cloud test runs or account/browser interactions are part of this project.
5. When ready, an authorized maintainer configures Pages to use GitHub Actions, configures the `github-pages` environment's required reviewers, and explicitly sets repository variable `ENABLE_PAGES_DEPLOY=true`. These are external administrative steps, not changes this scaffold performs.
6. Manually dispatch **Validate report and optionally publish Pages** on `main` with `publish=true`. Deployment additionally rejects an empty dataset or one without reviewed measured runs. The workflow uploads only the fixed `dist` output.

The normal build reads only `data/report.json`; it accepts no alternate data path or environment override. Offline fixture keys are rejected by the publication loader. Extra files/directories in `dist` fail the build rather than being accidentally packaged. No test fixture, source tree, screenshot, credential, or raw evidence file belongs in that artifact.

The validator rejects unknown fields at every object boundary, unsupported schema keywords, private-looking identifiers/URLs and common placeholders. This is **defense in depth, not guaranteed anonymization**. It cannot detect every identifying plain label, prove evidence, prevent a dishonest review flag, or protect private data that someone commits directly. Repository review remains required.

## Browser QA (offline report only)

The optional QA dependencies are development-only; they are not included in the report or needed for CI's Node contract/build checks.

```powershell
npm ci --ignore-scripts
# Use a separate, fresh local Edge process; never an authenticated/shared browser.
$env:QA_BROWSER_CHANNEL = "msedge"
# Optional: choose a screenshot directory outside the repository.
$env:QA_OUTPUT_DIR = "C:\Temp\github-harness-report-qa"
npm run qa
```

Without `QA_BROWSER_CHANNEL`, install a Playwright Chromium build once with `npx playwright install chromium`, then run `npm run qa`. Screenshots default to a unique OS temporary directory. QA creates and closes its own ephemeral loopback server and browser contexts; it blocks non-local browser requests, uses no saved profile, and never attaches to a debugging port or shared MCP browser.

Checks cover light/dark at **320, 390 and 1440 px**, all six report sections, overflow, axe WCAG A/AA rules, keyboard skip/navigation behavior, query/hash preservation, system theme changes, invalid-data withholding, print, reduced-motion and forced-color support. Explicitly labelled synthetic states exercise populated rendering only on the ephemeral QA server; they never go into `dist`.

## Design and interpretation decisions

- Exact Clawpilot base tokens and initial theme detection are retained. An explicit benchmark override applies the approved blue/purple/magenta text-only hero gradient and light/dark tokens; components use `--cp-*` colors.
- `?scoutTheme=light` / `dark` overrides system preference. The toggle preserves other parameters and the current section. No saved preference or tracking is used.
- Sections use native links with a current-page indication, rather than custom keyboard tab behavior. Print reveals all sections. No meaningless empty charts are generated.
- One Teams bot chat can serialize turns; it cannot establish platform-wide capacity by itself.
- Standard Harness comparisons are confounded by tenant, Production versus Developer, old DirectToEngine versus new channel transport, model and workload. This report contains no causal comparison.
- Load results precede cost analysis, but every recorded run carries a cost state. A separate email-to-workflow-to-agent scenario is future scope, not implemented here.
