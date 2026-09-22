# GitHub Copilot Harness / Copilot Studio load report

A separate, aggregate-only report for single-account observations of **Copilot Studio agents powered by the GitHub Copilot Harness**. This is not the Standard Harness study, GitHub coding agent, or Copilot SDK.

> **Microsoft written permission required before replication.** Do not replicate these performance tests unless Microsoft has expressly permitted them under a duly executed written agreement, or an applicable superseding agreement expressly authorizes the testing.
>
> [Microsoft Work IQ APIs Terms of Use (preview), section 3(b)(7)](https://learn.microsoft.com/en-us/legal/work-iq-apis/terms-of-use#3-work-iq-api-license-and-guidelines), **last updated April 2026**, sets the published performance-testing restriction. Applicable agreement coverage for this historical study has not been verified by this report. A corporate account, valid license, tenant ownership, user consent or this report is **not evidence of Microsoft permission**. No Microsoft written permission is asserted and no legal compliance is certified.
>
> Historical results and protocol descriptions are observations, not authorization or instructions to benchmark. References below to an authorized run, budget or consumed gate describe testing-owner controls, not proof of Microsoft's written permission. No runnable live-traffic instructions are provided by this update.

**Current state: sixteen reviewed runs, reported on [GitHub Pages](https://ryanbowie.github.io/copilot-studio-github-harness-load-test/).** The newest quota/recovery study was **locally interrupted**, with **81 attempts / 80 greetings / 1 initial disconnected invocation / 0 pending**. Only the 35 RPM phase ran, for **140.1724152 seconds**. A fully observed 60-second dispatch window contained **35 starts**, and a separately selected window contained **35 starts that all eventually returned greetings**. This exceeds 30 client starts in a full minute, but does not establish a configured service quota, counting/reset window or sustained capacity. **The testing objective remains unresolved.**

All fifteen prior records and their campaign contexts remain unchanged, including the ramp's **365 attempts / 364 greetings / 1 HTTP 429 / 0 pending** over **835.034977 seconds**, and its separately reviewed 268-start/600-second and 30-start/60-second maxima. Those maxima describe that earlier ramp only. The separate 125-request baseline remains **124 greetings / 1 initial disconnected failure / 0 pending (99.2%)**, at **24.74588719816105 actual RPM**, not full 25/min or zero-error qualification. The strict zero-error study still has no candidate after its first transport disconnection. **No full hour completed and no GitHub Copilot Harness capacity ceiling is established.** Costs remain **pending**, not zero. No Standard Harness data or images are imported. This repository is an offline report, not a cloud test runner; the separate email-to-workflow-to-agent scenario is not implemented.

First published on **2026-09-21** through the existing GitHub Actions Pages workflow. Deployment remains manual, explicitly opted in, restricted to `main`, and gated by the `github-pages` environment's required reviewer. The published HTML, aggregate JSON and schema were verified against the reviewed source; publication performed no new live load tests.

## Evidence sufficiency by horizon

**None of these horizons establishes concurrent-human-user capacity.** All native cohorts used one corporate identity. Simultaneous client-outstanding requests are calls awaiting settlement, not people or simultaneous backend executions. Distinct conversations are identifiers, not distinct users. Unique users active at any time in a period are not necessarily simultaneous. Sustainable users meeting a declared success/latency service-level objective (SLO) are a further, unmeasured population.

| Horizon | Concurrent-human-user capacity | Observed coverage and gaps |
| --- | --- | --- |
| 60 seconds | **NOT ESTABLISHED** | Latest full dispatch cohort: **35/35 eventual greetings**, not 35 callbacks inside that minute or a quota/capacity benchmark. Its separate maximum-start representative is **35 attempts / 34 greetings / 1 failure / 0 pending**. The enclosing study was **81/80/1/0**, interrupted after **140.1724152 seconds**, with peak **8 client-outstanding calls**. The separate burst peak **100** produced **33/100 greetings**, not 100 users |
| 60 minutes | **NOT ESTABLISHED** | No completed continuous hour at a qualified target. The variable-rate ramp ended at **835.034977 seconds**, **365/364/1/0**; the earlier 25 RPM hour attempt ended at **512.2330114 seconds**, **214/213/1/0**. No sustained-hour, reset validation or per-user result |
| 24 hours | **NOT ESTABLISHED** | No 24-hour endurance cohort or multi-user coverage. Calendar time spanning sporadic runs is not continuous 24-hour observation |

Missing dimensions are independent multi-user workloads, representative request mix, think time, roles, tenant/quota isolation, sustained coverage and declared success/latency SLOs. There is no defensible percentage of missing data or fixed additional sample count that resolves these gaps. Configured numeric quota, counting window and reset remain unknown; a fixed set of black-box tests cannot be promised to identify them. **No empirical capacity extrapolation follows**; the separate arithmetic examples below are workload scenarios, not predictions.

### Illustrative scenarios - not measured capacity

**Hypothetical nominal request starts only, not forecasts, successful completions, quota, measured throughput or validated sustainable capacity.** Inputs are illustrative even if they coincide with tested rates. The latest 35-start observation is only a short window; prior HTTP 429 stops contradict assuming throttle-free hours or days.

**Unverified assumptions:** constant offered rate continuously maintained, full-interval availability, and no quota/backoff or admission loss. None of those conditions is established. These numbers are not permission to generate traffic.

| Assumed constant offered rate | 60 seconds: nominal starts | 60 minutes: nominal starts | 24 hours: nominal starts |
| --- | --- | --- | --- |
| 25 requests/minute | 25 | 1,500 | 36,000 |
| 30 requests/minute | 30 | 1,800 | 43,200 |
| 35 requests/minute | 35 | 2,100 | 50,400 |

**Offered-load population examples, not user capacity:** at an assumed 35 requests/minute, evenly spread steady usage by the following hypothetical active populations generates the same average offered load. These are **not tested, supported or concurrently executing users, or unique users observed**.

| Hypothetical active people | Assumed cadence per person | Average offered load generated |
| --- | --- | --- |
| 35 | One request per minute | 35 requests/minute |
| 175 | One request per five minutes | 35 requests/minute |
| 350 | One request per ten minutes | 35 requests/minute |

The same people can repeat requests during an hour or day; request totals are not distinct-user counts. No inference applies Little's Law to p50/p95 latency or client peaks. Mean request latency, user cadence, workload mix, multi-user behavior, quota scope and SLOs are not established for these scenarios. The illustrative tables remain outside all measured-result charts and the four public data downloads: **sixteen actual records, not a seventeenth scenario record**.

Future performance work requires the express Microsoft written permission described above or an applicable superseding agreement expressly authorizing it, service-owner confirmation and an approved representative multi-user/SLO study design. This report starts no new tests, probes, retries or load generation.

## Chart-led reporting and measured window maxima

Paced comparisons run from **10 to 25 to 35 to 50 to 100 intended requests/minute**, with equal-rate cohorts in chronological order. The outcome view puts the **100-request burst in its own chart**: it was not 100/min. Sending rate and measured success percentage are different quantities. Two-minute 25/min trials returning 50/50 do not guarantee success at 100/min or for longer periods: the separate 100/min trial ended after 21 attempts with 12 eventual greetings and 9 generic errors, while the longer 25/min attempt ended on a transport stop with 213/214 eventual greetings. Differences in time, observed overlap, cooldown and background conditions prevent a causal quota conclusion.

The report follows the Standard report's **Summary, Concurrency, Response time, Throughput and limits, Stages, Answers, Refusals/failures, Every conversation, How it was tested** navigation, plus **Costs**. Headline cards and accessible, dependency-free SVG charts lead the report; detailed evidence and tables remain available in expandable sections. The conversation view is deliberately aggregate-only, not a public transcript or identifier browser.

Charts show separate-cohort success/failure shares, successful native p50/p95 durations, observed client-outstanding peaks, reviewed rolling dispatch/completion maxima, complete minute-bucket counts with error-free alternatives, selectable dispatch-minute outcomes, and classified failures. Stage search, surface/outcome filters and sorting support detailed comparison. These are deterministic views of reviewed records, **not simulated measurements or rewritten historical data**. The burst is not labelled 100 RPM, partial minutes are not scaled up, failure durations never enter reply-percentile bars, and unsupported hourly/daily capacity or settled costs have no fabricated chart. Horizontal chart scrolling keeps labels legible on small screens; all numeric evidence remains in text/tables and the JSON download. Printing expands the detailed evidence and includes every section.

### Reviewed exact rolling windows / existing evidence only

This supplement still covers only the **seven earlier native cohorts**. It excludes the locally stopped minute retest, completed count-bound retest, first-dispatch capacity-study stop, 125-request baseline, continuous-hour ramp and locally interrupted quota study. Its peaks are not maxima across all thirteen native runs. Newer totals and native duration populations are available separately. The capacity study has no eligible full-minute coverage. The primary fixed-minute-bucket view includes the count-bound retest's measured 55 eventual successes among 95 first-minute dispatches; that is not a newly reviewed rolling maximum or 55 completions inside that minute. Ramp minute rows do not enter the older supplement or fixed-rate qualification.

An independently reviewed **2026-09-21 supplement** analyzes the existing seven native cohorts / 555 attempts, not new traffic. The original ten records, their precision and documented limits are unchanged. It contains **46 eligible run/coverage/duration pairs and 90 independently selected representative maxima**. It does not include the three Teams records or two native preflights.

| Full observed window | Most eventual successful dispatch-cohort outcomes | Most successful completions inside a window |
| --- | --- | --- |
| 10 seconds | 33 / 100, native burst (67 failures) | 12, standalone 100/min cohort |
| 30 seconds | 33 / 100, native burst (67 failures) | 27, 50/min calibration |
| 60 seconds | 50 / 51, 50/min calibration (1 failure) | 52, 50/min calibration |
| 120 seconds | 98 / 100, 50/min calibration | 98, 50/min calibration |
| 300 seconds | 126 / 126, stopped 25/min hourly attempt | 126, stopped 25/min hourly attempt |
| 900 / 3600 seconds | Unavailable | Unavailable |

These are **post-hoc peaks within observed coverage through drain**, not service ceilings, full-hour results or sustained offered load. The two columns select **independent windows**, possibly from different cohorts; they must not be presented as outcomes of one shared window. For example, the standalone 100/min cohort's best 10-second dispatch window contains **17 attempts / 12 eventual successes / 5 failures**, not 100% success. Exact burst completion-window maxima are unavailable: its recorded dispatch marker preceded a separate, unrecorded latency-start sample, so their sum is not an exact completion offset.

The report lets readers select **arrival-only versus through-drain coverage** and an individual cohort. Successful 120-second completion maxima for the completed 10/25/50/min calibrations are **19/48/92 arrival-only versus 20/50/98 through drain**; the later 25/min follow-up is **47 versus 50**. The standalone 100/min cohort's 10-second completion maximum is **6 versus 12**. Drain cannot be misrepresented as sustained arrivals. Boundary jitter and completion-time variation explain finite-window peaks above nominal RPM without establishing a quota or changing the original qualification result.

First-error and stop tables now expose the independently reviewed callback evidence:

| Cohort | First returned error offset | Client state immediately after that error |
| --- | --- | --- |
| Native burst | Bounded **8.2365103-8.2365161 s**, not exact | 100 dispatched; 1 failure settled; 99 outstanding; no per-error stop policy |
| 50/min calibration | **28.5670088 s** | 24 dispatched; 18 settled (17 successes / 1 failure); 6 outstanding; no early safety trigger |
| Stopped 25/min hour | **511.2884434 s**, WorkIQ MCP transport 429 | 214 dispatched; 211 settled (210 successes / 1 failure); 3 outstanding |
| Standalone 100/min | **11.8024572 s**, generic error | 20 dispatched; 7 settled (6 successes / 1 failure); 13 outstanding |

The 100/min guard triggered on the **third consecutive generic failure at 12.4731405 s**: 21 dispatched, 9 settled (6 successes / 3 failures), 12 outstanding. Actual dispatch-close assignment is bounded **12.4731405-12.4742295 s**, not directly timestamped; the separately observed arrival end is 12.6128662 s. The 12 admitted calls then settled as 6 successes / 6 failures, with no later starts. The hourly attempt's dispatch close is bounded **511.2884434-511.2895557 s**, separately from its 512.232996 s observed arrival end; its 3 outstanding calls succeeded afterward (one before the observed arrival end, two during drain). These are client-clock events, not backend admission, a 12-concurrent quota or GitHub Copilot Harness attribution.

### Separate fixed-minute bucket view / clean segments

The minute-bucket view remains separate and now includes the count-bound retest's **55 eventual successes from 95 first-minute dispatches**. The rolling supplement excludes that newer cohort, so its older 50-success peak is not a contradiction or an all-run maximum. Fixed bucket boundaries also differ from rolling selection; the 125-success five-minute segment below is not the rolling 126-success result above.

| Complete dispatch window | Most eventual successes / attempts | Best error-free observed window |
| --- | --- | --- |
| 1 minute | 55 / 95 (57.895%) | 25 / 25 |
| 2 minutes | 98 / 100 (98%) | 50 / 50 |
| 5 minutes | 125 / 125 | 125 / 125 |
| 8 minutes | 200 / 200 | 200 / 200 |
| 15 minutes / 1 hour / 1 day | Not established | Not established |

The **highest qualified calibration rate is 25 intended RPM**, in two separate completed two-minute cohorts. That is not a guaranteed sustained safe rate or a 25 RPM ceiling. The longest completed paced arrival trial is now the **303.08066709999997-second count-bound baseline**, which retained one failure and did not qualify a fixed-window capacity test. The clean five/eight-minute segments are part of the later-stopped hourly attempt, not separately completed endurance tests. Its **213/214 (99.53%)** eventual success rate must not conceal the WorkIQ transport stop.

The pure helper in `src/capacity.mjs` ranks only **contiguous complete 60-second dispatch buckets within a single run**. Outcomes are those requests' eventual success/failure/pending states at the original cutoff, including drain. It never joins cohorts/campaigns, bridges cooldowns or gaps, promotes a partial minute, normalizes a burst into RPM, or claims actual completion-window throughput. The view lists the source run, intended rate and offset range. Different recorded configurations (including model, environment, memory and known revision) are ranked separately; matching unknown revisions do not prove an unchanged agent.

For each requested duration, best success volume and best zero-failure/zero-pending volume are independent candidates. Success-count ties prefer fewer failures, then fewer pending, then chronological cohort/offset order (run key breaks identical cohort timestamps). Idle minutes do not extend an active clean segment. No eligible window stays **Not established**, not zero. Sub-minute and arbitrary rolling maxima cannot be inferred from minute totals. The public JSON/schema downloads retain the reviewed per-run measurements; summaries are derived in the self-contained page.

The older dispatch-bucket failure table locates the first **dispatch bucket containing a request that later failed**, not the callback timestamp in the supplemental table. Arrival-stop duration is distinct from error onset. Generic invocation failures remain unclassified; the observed WorkIQ MCP transport 429 does not identify a GitHub Copilot Harness quota. Final failure counts include drained requests and are not safety-trigger counts. The detailed original 100 RPM third-consecutive-error guard evidence remains below.

### Remaining evidence, not permission for new traffic

The [separate Standard Harness report](https://ryanbowie.github.io/copilot-studio-load-test/) informs the reporting questions, not this report's numerical limits. Its measurements are not imported here; the existing tenant/environment/transport/model/workload confounders remain.

The gaps below are not an execution plan or authorization. Any future performance study first needs the Microsoft permission described above, service-owner confirmation and an approved representative multi-user/SLO design. User authorization, an explicit request bound and offline checks cannot substitute for Microsoft's permission.

| Missing result | Reviewed aggregate needed |
| --- | --- |
| Longer windows and burst completion maxima | All 15/60-minute windows lack full observed coverage. Burst exact shared-origin completion timestamps were not captured. Do not interpolate or substitute latency-start proxies |
| Remote admission and limiting component | The reviewed callback/guard snapshots measure client invocation state, not backend admission, concurrency, quota key/window/reset or proof that a transport-429 attempt reached the agent |
| Recovery/reset | Separately reviewed observations that bound recovery, including prior load/cooldown context. A later successful test alone does not identify reset time or causality; no immediate retry, automatic restart or bypass |
| Sustained/repeatable operation | Separately authorized, bounded complete windows and repeated rate tests, including intermediate rates if approved; frozen revision/configuration and a declared success/latency criterion. No extrapolated hourly/daily result or inferred production SLO |
| Representative workloads and cost | Separately approved knowledge/workflow scenarios with requested-operation success and latency; settled, attributable billing evidence, not stale Monitor counts or zero-credit assumptions |

Further additions require a reviewed closed-schema extension before ingestion, not arbitrary metadata or raw transcripts. This change does not run experiments, grant a new request budget, access private ledgers, or settle costs. All ten original records and existing documented limits remain unchanged.

## Separate 125-request baseline / completed on 2026-09-21

The newly reviewed `paced-125-25-baseline` is a separately authorized single-account, published Microsoft 365 native greeting cohort: Developer, GPT 5.6 Sol, memory off, published revision unknown. It is **not** a resumed zero-error study, a 7125-call campaign or a direct connectivity check. One supported identity verification preceded the run; no additional agent preflight, retries or automatic continuation occurred. Ordinary normalized errors counted through, while explicit provider/throttle/backoff, authentication/identity, action, local-clock/evidence and other safety guards remained.

**125 attempts / 124 successful greetings / 1 failed invocation / 0 pending; 99.2% success.** There were zero skipped/unoffered slots and zero retries. Attempt **1** returned normalized `disconnected/invoke` in **242.18249999999534 ms**, without a conversation identifier; remote admission and enforcing layer are unknown. No HTTP status, explicit provider throttle/backoff or safety stop was exposed. All subsequent 124 greetings succeeded, with 124 distinct returned conversation IDs. Do not discard the first call as a warm-up or infer a transport failure's cause.

The nominal plan was **125 starts at 25 intended RPM / 300 seconds**, rebased from each actual dispatch plus 2400 ms, without catch-up. Actual arrivals lasted **303.08066709999997 seconds**, an extension of **3.0806670999999626 seconds**, giving **24.74588719816105 offered requests/minute**. The final start was outside the nominal 300-second window: this is not a full 25/min or zero-error screen. Across 124 gaps, min/max/mean spacing was **2401.703999999998 / 2620.8201999999947 / 2424.423137096774 ms**. Peak **6** is outstanding client invocations, not backend concurrency or the configured client cap of 100.

UTC start / first dispatch / last dispatch / arrival close / drain cutoff: **21:53:49.850Z / 21:53:49.900Z / 21:58:50.522Z / 21:58:52.924Z / 21:58:58.985Z**. First-to-last dispatch span was **300.62846899999994 seconds**. Drain took **6.062341400000034 seconds**, making total observation **309.1430085 seconds**. The first-error callback was **291.7347000000009 ms after arrival start**, distinct from that call's native duration. The handoff positively attested controller clock and evidence validity; these are recorded explicitly, not borrowed from another study.

Dispatch-minute attempted/successful counts were **25/24, 25/25, 25/25, 24/24, 25/25 and 1/1**. The sixth bucket covered only **3.0806670999999626 seconds** and is not normalized into a minute. These are eventual outcomes grouped by dispatch time: **122 successful replies actually completed before observed arrival close, and two during drain**.

| Native completion population | Samples | Minimum (ms) | p50 (ms) | p95 (ms) | Maximum (ms) |
| --- | --- | --- | --- | --- | --- |
| Successful greetings | 124 | 6147.975299999991 | 8140.554899999988 | 10426.634000000005 | 17592.165000000008 |
| Failed invocation | 1 | 242.18249999999534 | 242.18249999999534 | 242.18249999999534 | 242.18249999999534 |
| All settled outcomes | 125 | 242.18249999999534 | 8140.554899999988 | 10426.634000000005 | 17592.165000000008 |

Percentiles use nearest rank within each population; native completion is not visible response latency or backend TTFA. Costs remain pending/null, and runtime sessions are unknown. The prior thirteen records and seven-cohort rolling supplement remain unchanged. No new rolling-window/history analysis, settled billing, capacity ceiling, full-hour validation, quota reset or universal reliability is claimed. The new one-shot gate is disabled/consumed and its permanent lock retained; no further calls are authorized by this result.

## Zero-error capacity study / first-attempt transport stop on 2026-09-21

One separately bounded study proposed six 5-minute zero-error screens at 25/30/35/40/45/50 RPM and up to two full-hour validations at its highest earlier clean screen. The **7125-call ceiling was a maximum, not dispatched or failed traffic**. The first screen planned 125 slots at 25 RPM, with 2400 ms absolute slots / 2280 ms minimum gaps and no retries, backlog replay or warm-up calls.

**Actual outcome: 1 attempted native invocation, 0 greetings, 1 failure, 0 pending.** The first call returned normalized `disconnected/invoke`; the reviewed diagnostic was **"MCP request failed: Transport closed"**. No HTTP status, explicit throttle/backoff or provider stop was exposed. Zero conversation identifiers returned, so remote agent admission remains unknown. This is not a generic `server_error`, a proven backend failure or evidence that 25 RPM exceeds capacity.

The ordinary first-non-success policy closed the screen. It had **124 unoffered / 0 skipped / 0 retried** slots. No earlier clean screen existed **in this study**, so termination was `no_clean_screen`, not a global safety stop. Screens 30-50 RPM and both hours were never attempted; no empty result records are created. The remaining **7124 of the overall ceiling** are neither planned outstanding requests nor failures nor reusable authorization. No restart followed.

Campaign start / first actual dispatch / campaign finish were **16:59:58.550Z / 17:00:01.656Z / 17:00:02.812Z**. The stage began at **17:00:01.646Z**, returned its failure at **17:00:01.692Z**, closed dispatch at **17:00:01.696Z**, and ended local observation at **17:00:02.745Z**. Native failure duration was **36.30919999999605 ms**, the only sample in failure/all-outcome nearest-rank populations. Successful latency has zero samples and is null.

Arrival coverage was **0.04990869999999995 s**. The subsequent **1.0497488000000013 s** was **local observation-loop/bookkeeping**, not pending server drain or failure-response latency: no native requests remained at close, and none returned afterward. Total stage observation was **1.099657500000001 s**. The public `stopTiming` object preserves the independently reviewed campaign-monotonic offsets, including return, dispatch close, later observation-loop end and final observation end. Wall-clock rounding is not substituted for those durations.

There were **zero spacing samples**, so observed spacing and offered rate remain **not measured**; the partial bucket is not normalized to a minute. No full-minute/hour or rolling maximum follows from this run. Peak one is client outstanding only. The current aggregate explicitly verifies evidence completeness but does not supply a separate positive clean-clock attestation; `clockStatus` stays `unknown`, never silently passing qualification. Costs remain pending; there is no new Monitor/history supplement or settled billing claim. The gate is disabled/consumed and its permanent lock remains intact.

## Count-bound 100-request retest / completed on 2026-09-21

A fresh explicit authorization permitted **one new 100-request greeting cohort**, not a restart of the earlier 41-request run or reuse of its 59 unsent slots. Same published native route, one verified account, Developer / GPT 5.6 Sol / memory off / unknown published version. The corrected scheduler rebased each next eligibility from actual dispatch plus **600 ms**, with no catch-up, retries or automatic continuation. The nominal 60-second plan could extend; ordinary generic failures were counted without the old three-error cutoff, while explicit safety and evidence guards remained.

**100 native invocation attempts settled: 60 greetings / 40 failures / 0 pending. Failure rate: 40/100 (40%).** Zero skipped or unsent requests. Failures were **39 normalized `server_error/invoke` and 1 normalized `disconnected/invoke`**. The disconnected call returned no conversation identifier; remote admission is unknown. These are invocation outcomes, **not proof all 100 reached the agent or all 40 failed in the model/backend**. No HTTP status, throttle/backoff or provider stop was exposed. There was no safety stop.

Cohort start / first actual dispatch / last actual dispatch / arrival end / drain cutoff (UTC): **11:52:03.880Z / 11:52:03.897Z / 11:53:06.781Z / 11:53:07.397Z / 11:53:16.669Z**. Monotonic actual arrival duration: **63.522163799999994 s**, including **3.5221637999999946 s** beyond the nominal plan; observed offered rate **94.45522068314682 requests/minute**, calculated from all 100 starts over that arrival duration. First-to-last dispatch span was **62.8887174 s**. These are different measures; neither supports 100 starts inside a 60-second window. Drain took **9.271375899999999 s**; total observation **72.7935397 s**.

First elapsed dispatch minute: **95 attempts / 55 eventual greetings / 40 failures**. The remaining **3.5221637999999946 s** contained **5 attempts / 5 eventual greetings / 0 failures**. These are dispatch cohorts followed through drain, not completion-minute throughput. **48 greetings completed before arrival end and 12 during drain**. The partial second minute is not scaled to a full-minute rate and does not fabricate a failed-latency population.

All **99 returned conversation identifiers were independently checked unique**, including those from the 39 generic failures; the disconnected attempt supplies none. **Peak 15** is client outstanding, not backend execution or configured cap (100). Across 99 gaps, minimum / maximum / mean spacing was **602.1187000000064 / 1057.2139000000025 / 635.2395696969696 ms**, with no catch-up or below-floor intervals.

Successful native completion p50/p95: **8331.270499999999 / 9831.7468 ms** (60 samples). Failed invocation p50/p95: **3266.1454999999987 / 4172.814900000005 ms** (40 samples). Failure timing includes the first disconnected return, **45.20799999999872 ms**; it is not a successful answer. All three nearest-rank populations preserve the reviewed precision in JSON. The first error's callback was **61.8804999999993 ms** from arrival start; the later decision observation was **64.86360000000059 ms**, with one attempted, one failed and zero outstanding. It triggered no stop.

The new run is `paced-elastic-100-completed` in separate campaign `m365-finite-elastic-100`. All prior eleven records and three campaign contexts are preserved. No postcampaign Monitor snapshot, settled cost or rolling-window supplement is invented. The one-shot authorization is consumed, its gate disabled and permanent lock retained; no subsequent cohort is authorized by this result.

## One-minute 100-request retest / local runner stop on 2026-09-21

A new, separately authorized greeting cohort targeted **100 requests over 60 seconds**, with **600 ms slots, a 570 ms floor and configured client cap 100**. Unlike the earlier 21-request attempt, ordinary normalized generic errors were counted **without** the three-error cutoff. Explicit throttle/backoff, identity/authentication and local evidence/timing guards remained. One in-run identity check verified the same account; no additional agent preflights or retries occurred.

The actual outcome was **41 attempts / 26 eventual greetings / 15 generic server_error-invoke failures / 0 pending**. **One skipped slot and 58 unoffered slots total 59 never-attempted requests**, not failures. The observed failure rate is **15/41 (36.585%)**. No full minute or full 100-request denominator was observed, so the user's full-100 question remains unanswered by this run. The authorization was consumed; the remaining slots were not resumed and no new live run is implied.

The **local admission deadline for planned request 42** was missed. Its attempt marker preceded the abandonment marker by **319.63380000000325 ms**, comprising local logging/check work; at abandonment it was **662.1854999999996 ms** after its scheduled slot, beyond the 600 ms admission allowance. That span is **not an isolated disk, OS or provider latency measurement**. No native invocation was made for this slot. This stop is mapped to the public `client_pacing` category, not provider throttling or a generic-error threshold. The 15 normalized failures exposed no HTTP status or backoff signal; their enforcing layer remains unknown.

UTC cohort start / dispatch close / drain cutoff: **11:05:54.897Z / 11:06:20.182Z / 11:06:28.382Z**. Monotonic arrival/close offset was **25.284633200000002 s**; the later observation-loop end was **25.291318000000004 s**. Drain measured from the actual close was **8.200922099999996 s**, giving **33.485555299999994 s** total observation. These clocks are not interchangeable. First-error callback was **13.826682000000004 s** after arrival start; its decision observation at **13.8319117 s** recorded **24 dispatched, 7 successes, 1 failure and 16 outstanding**. At the local stop: **41 dispatched, 18 successes, 15 failures and 8 outstanding**; all eight later succeeded during drain.

Forty-one distinct returned conversations were independently reconciled, including all 15 failures. **Client peak 17** is not backend/model concurrency. Across 40 dispatch gaps, minimum spacing was **576.8838000000032 ms**, so the 570 ms floor was respected; the local stop was lateness, not sending too quickly. Success p50/p95: **8670.152599999994 / 10622.766899999995 ms** (26 samples); failure p50/p95: **3501.179299999996 / 4242.042300000001 ms** (15 samples). All 41 outcomes have their own nearest-rank distribution in the JSON.

Costs remain pending. No postcampaign Monitor/history result is invented or borrowed from the earlier campaigns. The public run key is `paced-minute-100-local-stop`; the longer handoff suggestion was shortened to fit the closed slug contract. The source contains no raw identifiers, transcripts or private-source fingerprints.

After this local stop, an **initially offline-only scheduler repair prototype** rebased next eligibility from the previous actual dispatch plus 600 ms rather than aborting on the absolute-slot lateness boundary. Its simulated checks were not observations. Following fresh explicit authorization, the testing owner wired and checked a separate one-shot production controller for the completed count-bound cohort above. That later run is not a continuation of this partial run, and its extended timing is not presented as a full 100/minute result.

## Spread-out 25 RPM follow-up / completed calibration on 2026-09-20

The user requested more spread-out requests; the testing/reporting agent selected a conservative **25 requests/minute**, not an explicit user-selected rate. This separate campaign, `m365-spread-25`, retained the same two-minute greeting scope and **configured client-outstanding cap of 100**, not five. It used the same native published Microsoft 365 route, one verified corporate account, Developer, `GPT 5.6 Sol`, memory off and unknown published revision.

All **50 planned requests returned greetings**, with **zero failures, pending calls, retries, skipped slots or unoffered slots**. The 120 s arrival window completed and qualified; no hour or automatic continuation followed. Slots were **2400 ms**, with a **2280 ms floor** and minimum observed spacing **2324.9084999999905 ms**. The **observed client peak was five**; it is neither a configured cap nor backend/model concurrency. Fifty distinct returned Microsoft 365 conversation identifiers were verified; runtime sessions remain unknown.

Campaign markers: **21:20:16.522Z to 21:22:24.644Z**. Cohort start / observed arrival end / drain cutoff: **21:20:17.556Z / 21:22:17.558Z / 21:22:24.623Z**. Monotonic offer duration was **120 s**, observed arrival-end offset **120.00164290000001 s**, drain **7.0647474999999975 s**, and observation through drain **127.0663904 s**. **47 replies completed before the observed arrival-end boundary and three during drain**. Each of the two dispatch-minute cohorts contains 25 attempts and 25 eventual replies, not necessarily 25 replies completed inside that minute.

Successful and all-outcome native completion populations are identical (**n=50**): minimum **6686.623099999997 ms**, p50 **7743.116399999999 ms**, p95 **9889.714500000002 ms**, maximum **11946.911099999998 ms**, independently calculated with nearest-rank. The failed population is **null/no samples**, not zero-latency failures. These are native invocation-completion durations, not UI settlement, TTFA or model-only time.

Studio history at **21:23:20Z** matched **all 50 successful conversations** to Completed / Microsoft 365 Copilot records. The returned page still had **150 rows / `hasMore=true`**: all this cohort's successes are corroborated, not the entirety of platform history. Monitor at **21:23:22Z** still showed **417 older sessions**, updated one hour earlier, with no credits recorded. That stale precohort snapshot does not attribute usage or establish zero cost; costs remain pending.

Descriptively, this later 25 RPM cohort returned **50/50 greetings with peak five client calls**, versus **12/21 with peak 18** in the earlier standalone 100 RPM cohort. This does **not** establish causality or a 25 RPM service ceiling: elapsed time, cooldown and background conditions could contribute. No daily limit, twelve-concurrent quota or successful hour is inferred. No automatic restart or remaining requests.

## Standalone 100 RPM calibration / generic safety stop on 2026-09-20

A separately authorized two-minute greeting calibration used campaign key `m365-standalone-100`, not a restart or escalation of `m365-paced-campaign`. Same native published Microsoft 365 route, one verified corporate account, Developer, `GPT 5.6 Sol`, memory off and unknown published revision. Campaign markers **20:46:41.450Z to 20:47:00.164Z**; cohort markers **20:46:43.499Z / 20:46:56.112Z / 20:47:00.154Z** identify start, arrival end and drain cutoff. The plan was **100 requests/minute, 600 ms slots (570 ms floor), 120 seconds / 200 calls**. The minimum observed gap was **572.0913 ms**; zero slots were skipped.

Only **21 requests** were dispatched before the generic-error guard stopped new arrivals: **12 eventual greetings (57.14%), 9 failed invocations, 0 pending** after drain. **179 slots were never offered**, not agent failures or permission to resume. No full minute, full two-minute calibration or hour completed; no escalation or runner retries. Managed-service retries remain unknown.

All nine errors were the same normalized native `server_error` at `invoke`, with a null response and returned conversation identifier: **unclassified native invocation failures, not confirmed throttling**. No HTTP 429 or retry interval was exposed for these errors. The **third consecutive generic failure** triggered the stop, at nine settled outcomes (six successes / three failures); no new invocation started afterward. Twelve already-admitted calls then settled as six successes / six failures, yielding the final 12 / 9 result. Requests 1-12 eventually succeeded and 13-21 failed, but that ordering does not establish a 12-concurrent limit. The limiting component and GitHub Copilot Harness capacity remain unknown.

**21 distinct returned Microsoft 365 conversations**, including all nine failures, were verified. Peak **18 outstanding client invocations** is not model/backend concurrency. The separately captured arrival duration is **12.612879599999992 s**, arrival-end offset **12.612866199999997 s**, drain **4.042247700000007 s**, and full observation **16.655113900000003 s**. Six greetings completed before the observed arrival-end boundary and six during drain. The sole partial-minute row is a dispatch cohort with final outcomes, not a full-minute throughput result.

| Native completion population | n | Minimum (ms) | p50 (ms) | p95 (ms) | Maximum (ms) |
| --- | --- | --- | --- | --- | --- |
| Successful greetings | 12 | 7862.741999999998 | 9187.8312 | 11333.508999999998 | 11333.508999999998 |
| Failed invocations | 9 | 3246.6122999999934 | 4054.410600000003 | 4566.253500000006 | 4566.253500000006 |
| All outcomes | 21 | 3246.6122999999934 | 8285.110100000005 | 10841.436400000006 | 11333.508999999998 |

These are independent nearest-rank native invocation-completion populations, not UI settlement, TTFA or model-only durations. All twelve successful conversations matched Completed / Microsoft 365 Copilot Studio history at **20:51:25Z**. The nine failed IDs were absent from that **150-row snapshot with `hasMore=true`**; its partial coverage does not prove they never reached the agent. No identifiers or raw responses are public.

Monitor at **20:48:13Z** showed **417 sessions**, updated one hour earlier, with no credits recorded: stale precohort analytics, not attributed usage or zero cost. Cost remains pending/null. The original campaign's earlier 36-session snapshot is preserved as historical evidence.

## Original paced campaign / stopped early on 2026-09-20

One guarded greeting campaign used the same native published Microsoft 365 Copilot path, one verified corporate account, Developer environment, `GPT 5.6 Sol`, memory off and unknown exact published revision. Campaign markers were **19:15:38.150Z to 19:33:36.725Z**. No retries, automatic restart, review/approval/email workload or further load is authorized by this report.

| Cohort | Planned arrival window / calls | Actual attempts / eventual replies / failures | Result | Successful native-completion p50 / p95 |
| --- | --- | --- | --- | --- |
| Calibration 10 RPM | 120 s / 20 | 20 / 20 / 0 | Qualified | 8.431 / 10.380 s (n=20) |
| Calibration 25 RPM | 120 s / 50 | 50 / 50 / 0 | Qualified | 8.064 / 12.842 s (n=50) |
| Calibration 50 RPM | 120 s / 100 | 100 / 98 / 2 | 98%, below the predeclared 99% rule | 7.644 / 9.676 s (n=98) |
| Hourly attempt at 25 RPM | 3600 s / 1500 | 214 / 213 / 1 | Early stop; recorded arrival duration 512.2330114 s, not exact dispatch-close time | 7.858 / 9.680 s (n=213) |

All four cohorts drained with zero pending. The hour attempt's **213 eventual replies** comprise **211 before its observed arrival-end boundary and two during drain**, not 213 completions inside its 512.2330114 s arrival window. Calibration **100/150 RPM was not attempted within this original campaign**; the later standalone 100 RPM cohort above is separately authorized and counted. The two failures at 50 RPM were generic WorkIQ `server_error` invocation outcomes with no explicit throttle evidence. The selected **25 RPM is the last qualified calibration rate in this original campaign, not a capacity ceiling**. There is no observed full-hour total or extrapolated successful hourly result.

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

Open `dist\index.html` directly, or serve `dist` with a local static server. The page embeds both validated aggregate contracts, their schemas, CSS and JavaScript: it performs no API calls, loads no remote fonts or scripts, and works offline. Download links to `report.json`, `report.schema.json`, `window-evidence.json` and `window-evidence.schema.json` use companion files in `dist`. Never serve the repository root as the report.

| File | Responsibility |
| --- | --- |
| `data/report.json` | Fixed original publication input; reviewed public aggregates or the empty seed |
| `data/window-evidence.json` | Fixed reviewed supplemental window/callback input; `null` if unavailable |
| `schema/window-evidence.schema.json`, `src/window-evidence.mjs` | Closed supplemental contract, exact-decimal consistency checks and compatible-cohort summaries |
| `schema/report.schema.json` | Closed JSON Schema, draft 2020-12 |
| `src/validate.mjs` | Shared structural, cross-field and privacy checks; fail-closed schema subset |
| `src/index.html`, `src/report.js` | Accessible static shell and safe text-based rendering |
| `scripts/build.mjs` | Validates fixed input and emits a self-contained HTML report plus JSON/schema |
| `tests/fixtures/synthetic-report.json` | Explicitly synthetic, offline-only branch coverage; never a publication source |
| `scripts/browser-qa.mjs` | Isolated, loopback-only Playwright/axe QA; no reused browser profiles |
| `.github/workflows/pages.yml` | Offline CI and separately gated, manual Pages deployment |

## Public aggregate contract (v1)

### Separate supplemental window contract (v1)

`data/window-evidence.json` is a separately reviewed supplement, never a replacement for `data/report.json`. Its entire value can be `null` when no supplement exists. Otherwise it requires a real `reviewedOn`, `newAgentCalls: 0`, an analyzed-attempt total, fixed half-open/independent-selection semantics and references to existing native run/campaign keys. Every object is closed; no freeform source prose, private paths, source-artifact hashes, identifiers or transcripts are accepted.

Each run retains its original outcome totals, clock-quality flag, two coverage bases, and all seven requested durations (10/30/60/120/300/900/3600 seconds). A maximum is `null` unless its whole window fits the explicitly observed coverage. Exact completion maxima and completion-local state are always null for the burst. Each independent maximum contains its own exact window, dispatch cohort's eventual and before-end outcomes, completions inside that window, and client snapshots immediately before both boundaries. Final-cutoff pending and pending immediately before window end are distinct.

Ranges store numeric plotting offsets alongside authoritative `*Exact` decimal strings representing arithmetic on the source IEEE-754 values. The validator uses fixed-scale `BigInt` decimal arithmetic to enforce exact widths and coverage, including differences too small for ordinary floating-point comparison. It checks both count populations, snapshot deltas, original outcome/peak bounds, unique references, clock precision, first errors, trigger counts and post-trigger settlement reconciliation. It does not increase clock accuracy or independently prove observed data/maximality; that review occurred against private evidence using separate event-density and exhaustive event-partition checks.

First-error/trigger completion bounds are inclusive: `precision: "exact"` has identical endpoints; `"bounded"` has distinct endpoints. A trigger's actual dispatch-close time remains a nonzero uncertainty bound, not an invocation duration or a measured point. The generic guard is the third consecutive error, not nine final failures. WorkIQ transport 429 has explicit transport scope and unknown harness attribution. Zero pending at the client evidence cutoff does not establish remote work/admission/retry/billing settlement. Managed-service retries remain unknown and costs pending.

Build and browser validate both inputs before rendering any measurements. A malformed supplement withholds all metrics rather than silently falling back to older charts. The two supplementary downloads expose the exact public contract without raw evidence. The original run contract follows unchanged.

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
- Optional `pacedCampaigns` contains closed reviewed campaign contexts referencing exactly their cohort `runKeys`. Each records ordered UTC campaign markers, scoped status (`stopped_on_workiq_mcp_transport_429`, `stopped_on_generic_error_threshold`, `completed_standalone_calibration` or `standalone_minute_retest`), independently verified distinct returned conversations, client peak, explicit unattempted calibration rates and a stale postcampaign Monitor snapshot. Completed standalone calibration status requires exactly one qualified calibration with all planned dispatches, its full arrival window, complete drain and no stop reason; it cannot describe an hour or multiple stages. The minute-retest status is neutral about completion and references exactly one separate minute cohort. Context cannot infer a global distinct count by summing per-run values, attach unattempted rates to measured stages **in that same campaign**, or relabel a stop as full-hour completion. Campaign contexts contain no monetary consent, identity or private source metadata.

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
| `pacedMeasurement` | Optional closed paced-cohort record, described below. Omit on existing runs; mutually exclusive with `rampMeasurement` and non-null `nativeInvocation` |
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

### Work IQ documentation boundary / reviewed 2026-09-20

Review of the official [Work IQ `ask` reference](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/work-iq/mcp/tool-reference#ask), [error handling](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/work-iq/mcp/tool-reference#error-handling) and [busy/throttled-response guidance](https://github.com/microsoft/work-iq/blob/main/plugins/workiq/skills/workiq/references/ask-work-iq.md#L5-L9) found **no verified numeric Work IQ ask/MCP RPM, hourly, daily or concurrency ceiling**. This is not evidence of unlimited capacity. Enterprise MCP's 100 RPM figure, Microsoft Graph limits and Standard Harness quotas must not be applied to Work IQ `ask`.

For busy/throttled responses, official guidance says to respect an exposed `retryAfterSeconds`, with no immediate retry or fan-out. Our transport stop exposed **no retry interval to the client**; that does not prove the server omitted a `Retry-After` header. The enforcing component, quota key/window/reset and whether the 429 attempt reached the agent remain unknown. The campaign stopped without retry; this documentation adds no authorization to resume it.

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

The separate `minute_retest` phase supports only a **60-second / 100-slot / 100 intended RPM** greeting cohort. It requires `genericErrorPolicy: "count_without_early_stop"`: ordinary generic invocation errors are counted without the earlier three-error dispatch cutoff, while explicit throttle/backoff, identity/authentication and other safety guards remain. Its qualification must be `not_evaluated` with no qualifying run reference; even 100/100 is not a two-minute qualification or permission for an hour. It must use its own single-cohort campaign. Optional `standalone_minute_retest` campaign context does not assert completion: actual dispatched counts, arrival coverage and drain determine that. Unoffered/skipped slots are never failures, and pending outcomes remain pending. This contract support contains no observed retest result by itself.

The separate `count_retest` phase also plans **100 requests at 100 intended RPM**, but the nominal 60-second plan is not a duration cutoff. `pacing.schedule: dispatch_rebased`, `missedSlotPolicy: defer_without_catchup` and zero jitter allowance describe eligibility rebased from the previous actual dispatch plus 600 ms. Delays extend the measured arrival duration, without catch-up or skipped slots. `arrivalStatus: count_complete` requires all 100 actual dispatches and no stop reason; pending responses still prevent a fully drained result. It must not use `full_window` or be presented as 100 starts inside a measured minute. Actual arrival-close duration is retained, even beyond 60 seconds; only complete measured minute buckets contribute to minute-window counts. Optional `standalone_count_retest` context references this phase only. Qualification, single-cohort isolation, generic-error policy and explicit safety bounds remain separate from historical calibration and hour records. Synthetic contract cases are offline-only and are never public observations.

`native_disconnected_no_conversation` is a closed native error-evidence value paired only with `category: transport` and a paced or ramp native measurement. It records a disconnected invocation result, not a provider throttle or proven agent/backend failure. The validator excludes these missing-ID attempts, like transport-429 attempts, from possible verified conversation and failed-conversation counts. Unknown remote admission remains unknown; neither a fresh-conversation request policy nor 100 starts proves 100 returned conversations.

Historical paced cohorts include four from the original campaign, a later stopped standalone 100 RPM calibration, a completed standalone 25 RPM follow-up, and the locally stopped minute retest. The earlier burst and three Teams records remain unchanged. Support for a full hour does **not** mean one completed. Synthetic cases live only in clearly named `tests/fixtures/synthetic-*.mjs` files; their `offline-*` run keys are rejected by the publication loader. No runner, credentials, private consent, account names, controller artifacts or raw responses are stored here.

Add one **reviewed** run per nonempty calibration, retest or hourly arrival cohort, never a duplicate campaign-total run. Use the existing native published surface and single-account greeting workload, with `nativeInvocation: null` and optional `pacedMeasurement` populated. Do not turn a never-started stage or zero-dispatch plan into a run. A stopped calibration-only campaign needs no invented hour record. Existing visible timing, legacy `arrival`/`concurrency`, workflow state and follow-up fields stay null.

All fields below are required inside `pacedMeasurement`; the schema provides the complete machine-readable shape:

| Fields | Contract |
| --- | --- |
| `campaignKey`, `phase` | Public nonidentifying grouping slug; `calibration`, `hour`, `minute_retest`, `count_retest`, `count_baseline`, `capacity_screen` or `capacity_hour`. Never a source ID |
| `path`, `endpoint`, `requestKind`, `timingBasis` | `workiq_ask_via_native_tool_rpc`, `invocation_completion`, `greeting_only`, `calibrated_native_rpc_completion` |
| `startedAt`, `arrivalEndedAt`, `observedThroughAt` | Ordered millisecond UTC metadata; cutoff date matches `observedOn`. Do not derive monotonic duration from wall-clock subtraction |
| `targetRpm`, `plannedArrivalSeconds`, `plannedSlots` | Protocol intent, not observation: 10/25/50/100/150 RPM; 120 s calibration or 3600 s hourly arrivals. Both separate retest phases are restricted to 100 RPM / nominal 60 s / 100 slots. `count_baseline` is only 25 RPM / nominal 300 s / 125 slots; count-bound arrivals may extend. Planned slots equal rate times planned minutes. Capacity phases have their own rules below |
| `arrivalSeconds`, `arrivalEndObservedSeconds`, `drainSeconds` | Offer-window duration (scheduled cutoff for completed fixed windows, actual cutoff for early stops or count-bound arrivals), independently measured monotonic arrival-end offset, and subsequent drain. **Observed end offset + drain equals `windowSeconds`**, not scheduled window + drain. Timer overshoot/separate reads remain explicit; count-bound fields both retain the actual close. Achieved dispatch RPM uses `arrivalSeconds`, not the drain-inclusive duration; it is not an extrapolated hourly completion result |
| `skippedSlots`, `unofferedSlots` | Missed client slots versus remaining slots not offered before stop/cutoff. `attempted + skipped + unoffered = plannedSlots`. Neither belongs in agent attempts or failure statistics |
| `arrivalStatus`, `stopReason` | `full_window`, `count_complete`, `stopped` or `partial`; full requires planned fixed duration, no unoffered slots and null reason. Count completion belongs only to `count_retest` (exactly 100 starts) or `count_baseline` (exactly 125 starts), with no unused slots/reason, and does not imply a fixed-window rate. Partial requires `observation_cutoff` (before the fixed duration for fixed-window phases). Stopped requires a reviewed enum reason, not arbitrary text. `generic_error_threshold` belongs only to historical phases, not the count-through-errors cohorts. Native `authentication`/`explicit_throttle` require matching errors; a pre-dispatch `account_guard` is separate and must not invent a failed agent invocation |
| `drainStatus` | `complete` only with no pending calls, otherwise `bounded_cutoff`. A full arrival hour can still have missed slots, errors or pending drain outcomes |
| `qualification`, `qualifyingRunKey` | Calibration `qualified` only when all slots dispatched, drain complete, at least 99% requested greetings and healthy measured pacing; otherwise `not_qualified` or `not_evaluated`. Hour uses `not_evaluated` and references the highest prior qualified calibration in the same campaign |
| `pacing` | Fixed-window phases: `schedule: absolute_slots`, `missedSlotPolicy: skip_without_replay`, `jitterAllowance: 0.05`. Count-bound retest: `dispatch_rebased`, `defer_without_catchup`, zero allowance and no skipped slots. `intervalMs: 60000/targetRpm`; paired `observedMinIntervalMs` / `violatingIntervals` describe actual gaps, required for count-bound runs with multiple starts. At 150 RPM, historical intended 400 ms allows minimum 380 ms; count-bound 100 RPM has a 600 ms floor. Violations remain reportable but cannot qualify a stage |
| `peakOutstanding`, `concurrencyBasis`, `concurrencyVerification` | Nullable measured peak (max 100), `outstanding_client_invocations`, paired `start_end_interval_sweep`, `reviewed_client_peak` or null. The last measured form attests the reviewed client peak without inventing a particular recomputation method. Not configured workers or backend/model executions |
| `conversationPolicy`, `conversationEvidence`, `failedConversations` | `fresh_per_request` is intent, not a count. `returned_ids_checked_unique` pairs with known `units.conversations`; otherwise null. Nullable failed-ID count cannot exceed failures or verified distinct conversations. Sessions remain independent |
| `runnerRetries`, `managedServiceRetries` | Zero and `unknown`, respectively. These do not claim control of managed-service retries |
| `percentileMethod`, `success`, `failure`, `allOutcomes` | Nearest-rank over separate native completion populations with the same summary fields as the burst. Samples match successful, failed and **settled successful+failed** counts. Pending calls are excluded; no settled samples means null. No pooled or averaged cohort percentiles |
| `minuteBasis`, `minutes` | `client_dispatch_cohort_outcomes_at_cutoff`; contiguous elapsed-minute buckets with `offsetSeconds`, `durationSeconds`, `attempted`, `completed`, `failed`, `pending`. Only the final bucket may be partial. All bucket totals reconcile to run counts at the same observation cutoff |

**Minute replies/errors belong to requests dispatched in that minute**, even when those outcomes arrive later during drain. They are not completion-minute throughput, fixed clock-hour totals or best rolling-hour totals. The renderer labels that distinction rather than claiming a successful hourly rate from planned RPM. Calibration versus hour, stopped/partial versus full arrivals, intended versus achieved dispatch rate and native versus visible timing stay separate.

The bounded protocol supports distinct calibration rates (at most 670 planned calibration calls) and at most one hour cohort (at most 9000 planned calls), capped at 9670 requests per campaign. Those numbers are protocol constraints, **not executed counts, spending evidence or future authorization**. Private account/consent checks remain the testing owner's responsibility; this report makes no authenticated calls. A generic calibration error can leave an earlier rate qualified, but does not establish a harness limit. No further cohort in the same campaign may follow a terminal guard or pacing violation. Safety/authentication/explicit-throttle/client-pacing stops are not automatic-retry opportunities. Stale Monitor counts, budget acknowledgment and absent posted credits cannot settle cost; keep pending/null until reviewed billing evidence exists.

For ingestion, supply observed slot accounting, UTC markers and monotonic windows/arrival-end offsets, per-dispatch-minute outcomes, distinct verified conversation counts, outcome-specific latency summaries and classification evidence. The offline fixture factory illustrates full, stopped, partial and calibration-only shapes but is not a source of public values. Rerun responsive UI QA when reviewed actual cohorts change.

### Separate count-bound 125-request baseline

Offline contract support for `count_baseline` does **not** establish that a new run occurred. It accepts only a separately reviewed **125-request / 25 intended RPM / nominal 300-second** native greeting cohort. Eligibility rebases from each actual dispatch plus **2400 ms**, with zero minimum-gap allowance, no catch-up/replay, no skipped slots and no runner retries. An extended actual arrival duration stays explicit; the nominal five-minute plan is not a measured fixed window or proof of sustained 25 RPM.

The required closed `baselineEvidence` object records `clockStatus` and `evidenceStatus` as reviewed statuses or explicit unknowns, paired successful counts before/after observed arrival end, and paired nullable first-failed-attempt index/callback offset from arrival start. Completion populations must sum to eventual successes; a failure index must refer to an actual attempt and its callback must fit the observation. This evidence belongs only to `count_baseline` and confers no qualification.

Like the 100-request count retest, `genericErrorPolicy: count_without_early_stop` requires ordinary normalized invocation failures to remain in the outcomes rather than trigger first-error or three-error termination. Explicit provider/throttle/backoff, authentication/identity, action, local-clock/evidence and other safety guards remain separate stop reasons. Actual failed, successful and pending counts partition actual attempts; unoffered requests are not failures. `count_complete` requires all 125 starts, while a completed drain additionally requires zero pending. Failed and all-outcome durations never substitute for successful-response latency.

The baseline uses its own single-cohort campaign, always `qualification: not_evaluated` and a null qualifying reference. Even 125/125 **cannot qualify the zero-error study's hours**, resume its consumed gate, authorize a 7125-call campaign, or establish a capacity ceiling. Historical 100-request and zero-error phases retain their own exact plans and guard semantics. Optional legacy `pacedCampaigns` context is not reused: no invented Monitor snapshot is required. Separate connectivity checks are not added to the load counts. Synthetic examples remain confined to `tests/fixtures/synthetic-count-baseline.mjs`, with publication-rejected `offline-*` keys.

### Locally interrupted quota/recovery study

`quotaStudyMeasurement` is a separate closed native measurement, exclusive with `pacedMeasurement`, `rampMeasurement` and non-null `nativeInvocation`. Its currently supported shape is **one interrupted first phase with no recovery calls or later-phase observations**; adding other observed shapes requires a reviewed contract extension. This avoids qualifying the phase as a historical calibration, inventing future results or implying that the full study completed.

The bounded plan was up to thirty minutes at 35 RPM (1050 load calls), then a separate 50 RPM phase (1500 load calls), with at least sixty minutes of controlled-client quiet before each. At most five single recovery greetings per phase could follow a bare native transport 429 after 60/120/240/480/960 seconds of quiet, stopping at the first successful greeting without resuming that load. The total ceiling was 2560 greetings plus separately counted identity reads, within four hours. These are protocol bounds, **not execution totals or restart permission**; exposed backoff, authentication, action, clock/evidence and cancellation stops remained terminal.

Only phase one actually ran: **81 starts / 80 greetings / one disconnected invocation / zero pending**, at **34.6715863678719 average offered RPM over 140.1724152 seconds**, followed by **6.336280900000013 seconds of drain**. The first call returned disconnected/invoke in 24.416700000001583 ms without a conversation ID; all subsequent 80 succeeded. There was **no HTTP 429 or backoff exposed in the available diagnostics**. A local observer's `PermissionError` / errno 13 reading the summary led the parent controller to stop dispatch and drain. Stored `manual_stop` is **not user cancellation or provider throttling**. Windows atomic-replacement contention is only a hypothesis; the exact permission-denial cause is unknown. No recovery probe, second phase or restart occurred. The 969 unoffered phase slots and 2479 unused study-ceiling calls are not failures.

The separately reviewed full-coverage 60-second analysis retained **two independently selected representative windows**: maximum starts at `[0, 60)` with 35 attempts / 34 eventual greetings / one failure, and maximum eventual greetings at `[1.7535745, 61.7535745)` with 35 attempts / 35 eventual greetings / no failure. All 49 candidate windows were reviewed by the testing owner. These are eventual outcomes grouped by **dispatch time**, not successful callbacks occurring inside that minute. No 300/600-second row is emitted without full coverage. The finding rules out an observed hard ceiling of 30 client starts in every 60-second window, but neither establishes the service's configured quota nor its internal counting or reset window.

The public contract retains exact phase UTC markers, campaign-relative monotonic offsets, clock/evidence attestations, nearest-rank outcome-specific timings, 80 distinct returned-conversation counts, peak eight outstanding client calls, and pending/null costs. Matching request-start/native-duration clocks supply dispatch/completion analysis; separately sampled event-clock offsets can differ (maximum 0.0378 ms at start and 0.0145 ms at completion, strictly below the reviewed 1 ms allowance). Do not force these readings or rounded UTC markers into decimal equality. Validation checks ordered phase/loop/drain/study boundaries, separate ceilings, full rolling coverage and population partitions; raw maximization and percentiles cannot be reconstructed from public aggregates.

Initial quiet evidence names the prior controlled run's finish, the earliest permitted identity time sixty minutes later, and identity completion before the phase. The controller's tiny already-elapsed quiet-wait record is not substituted for an observed hour of waiting. Quiet applies only to the controlled client, not all tenant/account traffic or a proved reset. The identity read is excluded from the 81 greetings. External traffic and service-internal request counts remain unknown. All fifteen earlier records, including the separate ramp window analysis, and the original seven-cohort supplement remain unchanged. **Reporting this terminal partial result does not mean the quota/reset investigation is complete.**

### Separate continuous variable-rate hour

`rampMeasurement` is a separate optional, closed measurement object on one run, mutually exclusive with `pacedMeasurement` and `nativeInvocation`. The reviewed actual `hour-ramp-25-to-50` record uses this contract; fixtures never become publication inputs. It does not resume an older campaign or authorize traffic. All fourteen prior records and the seven-cohort window supplement remain unchanged.

The **actual incomplete ramp** ran from 22:28:05.355Z until dispatch close at 22:42:00.380Z, with final drain observed through 22:42:07.378Z on 2026-09-21. One authenticated account, Developer environment, published GPT 5.6 Sol and memory off retain the declared configuration; exact agent revision and runtime-session count remain unknown. Invocation 365 exposed **HTTP 429**, normalized **transport_failure/invoke**, in **73.751600000076 ms**, with no conversation ID or exposed backoff. There were 364 distinct returned IDs and a peak of 7 outstanding client calls.

**Numeric WorkIQ limit: NOT ESTABLISHED.** The enforcing layer, quota scope and remote admission are unknown. The closed `native_http_429_no_conversation` evidence value preserves this uncertainty; it must not be reclassified as the older WorkIQ-layer 429, a newly configured 30 RPM tool limit or a harness capacity ceiling.

At the safety decision there were **365 dispatched / 361 successful / 1 failed / 3 pending**; all three pending calls then succeeded, with no later dispatches or retries. Native callback **835031.7282 ms** and dispatch-close decision **835034.977 ms** from arrival start are distinct. The observation loop ended at **835.9737600999999 s**; its **0.9387831 s** bookkeeping delay is inside the **6.997626800000085 s** post-close observation, not extra arrivals or server-drain latency. Total observation was 842.0326038000001 s. Positive clock/evidence attestation is retained; an absent explicit spacing-violation count remains null rather than invented zero.

Whole-run successful native p50/p95/max were **7.981 / 10.588 / 32.830 seconds**, over 364 replies. **361 completed before close and 3 afterward.** The first segment's 248 eventual greetings include 245 inside its nominal 600 s plus 3 after the rate boundary. The second segment's 116 own-cohort successes include 113 before actual close and 3 during drain; meanwhile 116 successes from *all* cohorts completed within that 235.035 s observed segment because 3 earlier calls carried over. Its 29.86789493888819/min window-average dispatch pace is not a completed ten-minute result. The whole 26.226446320463534/min average mixes two target rates and is not fixed-rate capacity. No 35/40/45/50 result rows, resumed gate, further calls or additional history analysis are implied.

**Separately reviewed request-window analysis / no new traffic:** fixed ten-minute buckets contain **248 starts over 600 s**, then **117 over only 235.034977 s**, without scaling the partial bucket. The largest fully observed rolling **600 s contains 268 starts (26.8 RPM equivalent)**; the largest fully observed rolling **60 s contains 30 starts**. Thus this ramp did not exceed 300 native starts in any full ten minutes or 30 in any full minute. The 365 starts span 835.034977 s, not ten minutes. These counts include the failed HTTP 429 attempt and exclude one identity control read; external traffic and service-internal request counts remain unknown.

Optional closed `rampMeasurement.dispatchWindowEvidence` keeps this derived evidence separate from the original seven-cohort supplement. It records review date, native-start scope including failures, zero new calls, excluded identity reads, unknown external traffic, full-window-only half-open `[start, end)` semantics, and unique 60/600-second maxima. Each maximum preserves exact representative offsets and the independently reviewed candidate-window count (337 minute windows, 99 ten-minute windows). The validator checks full coverage, representative duration, total/fixed-bucket bounds and consistency between the two durations; it cannot reproduce private event-level maximization from public aggregates. No raw events are included, no sixteenth run is created, and the primary fifteen-record evidence is otherwise unchanged. These are client observations, not server quota windows or a configured numeric WorkIQ limit.

The `continuous_hour_ramp_25_to_50` protocol plans one fixed **3600-second arrival horizon**, six contiguous **600-second levels at 25 / 30 / 35 / 40 / 45 / 50 nominal RPM**, and a **2250-request total ceiling**. The corresponding **250 / 300 / 350 / 400 / 450 / 500** segment allocations are nominal, not observed counts. Dispatch eligibility rebases from the actual prior dispatch plus the interval for the **currently active level**, with no catch-up, intermediate drain, quiet period or extra warm-up. Ordinary invocation failures count and continue; explicit provider/backoff, authentication/identity, action, local-clock/evidence and other safety stops remain terminal. Configured client cap 100 and request/drain guards 180 seconds are intent, not observed concurrency or durations.

| Ramp evidence | Contract |
| --- | --- |
| `campaignKey` | One separate run per namespace; cannot collide with fixed-rate campaign membership |
| `arrivalSeconds` | Observed covered prefix of the fixed horizon, at most 3600 seconds; a complete hour need not dispatch 2250 requests |
| `arrivalEndObservedSeconds`, `drainSeconds` | Actual dispatch-close offset (scheduled boundary or early safety decision) and final post-close interval; their sum equals `windowSeconds`. Optional `arrivalLoopEndObservedSeconds` preserves the later local-loop marker inside that interval, without extending arrivals |
| `arrivalStatus`, `stopReason`, `drainStatus` | Full/partial/stopped arrival coverage stays separate from complete/bounded final drain; zero pending is required for complete drain. No `count_complete`, ordinary-error cutoff or qualification field |
| `unusedRequestBudget` | `2250 - actual attempted`; neither failed traffic, outstanding work, a planned failed denominator nor reusable authorization |
| `segments` | Only the contiguous observed prefix. Each row preserves exact offset/duration, target RPM, nominal ten-minute allocation and actual attempted/completed/failed/pending at the same final cutoff. No fabricated later segment rows |
| `segmentBasis` | `elapsed_dispatch_segment_outcomes_at_final_cutoff`: requests grouped by where they started, even if replies returned in another segment or after the hour |
| `outstandingAtStart`, `outstandingAtEnd` | Nullable client counts immediately before each nominal segment boundary. Adjacent known boundaries agree; calls may carry across rate changes. Unobserved nominal ends stay null. These are not remote admission or backend concurrency |
| Optional segment `nativeTimings`, `distinctReturnedConversations`, `dispatchCohortPeakOutstanding` | Only when separately reviewed. Native durations use each segment's dispatch population through the final cutoff, not completion events occurring inside that segment. IDs remain counts only. The cohort peak is overlap among that cohort's calls across their lifetimes, not all calls active during that level. Absent/null evidence stays unknown |
| `successfulWithinArrivalWindow`, `successfulAfterArrivalWindow` | Nullable paired completion-time populations summing to eventual successes. The first uses half-open `[0, arrivalSeconds)`, exactly 3600 seconds for a full hour; the second includes timer overshoot and drain. Never derived from segment dispatch outcomes |
| `clockStatus`, `evidenceStatus` | Explicit reviewed attestations or unknowns. Unknown is not a fault or a clean result; no inferred validity |
| Optional `minutes`, `stopEvidence`, segment `completionPopulations` | Observed-prefix dispatch-minute outcomes reconcile to segments. The HTTP429 stop retains native duration, callback, decision and contemporaneous counts. Segment completions separate own-cohort nominal-window outcomes from all-cohort completions inside actual observed coverage; no raw events or IDs |
| Native outcomes, timings, IDs and costs | Existing exact-population/null-zero-sample and transport-no-ID rules apply. Successful/failed/all-settled nearest-rank summaries stay distinct, never averages of segment percentiles. Costs remain pending/unknown without attributable settlement evidence |

The renderer gives ramps their own outcome chart and segment evidence, while including them in latency, reliability, classified-error, conversation and pending-cost views. Reviewed segment latency populations receive a separate response-time chart/table; unknown populations never become zero-valued samples. Whole-run extrema reconcile to complete segment evidence, but percentiles are never averaged. A ramp is **not** a burst or a single scalar intended rate; rate and elapsed time are confounded. The fixed-rate qualification summaries and original rolling-window supplement exclude it. Even a clean variable-rate hour is neither a fixed-rate validation hour, two-hour zero-error qualification, maximum supported rate nor a platform-wide capacity finding. Partial segments are not normalized into full minutes or hours.

`tests/fixtures/synthetic-continuous-ramp.mjs` exercises only offline full, partial, stopped, pending and unknown-evidence cases. The publication loader rejects its `offline-*` keys; actual ingestion still requires the testing owner's explicitly authorized sanitized aggregate and checksum. No raw ledgers, accounts, source runners or private evidence are read by this report.

### Distinct zero-error capacity study

`capacity_screen` and `capacity_hour` implement a **separate protocol**, never a relaxation of the historical 99% calibration / single-hour rules above. Each study has its own `campaignKey`; records from older campaigns cannot supply its candidate. The grouping and qualification summary derive only from nonempty reviewed cohorts, not placeholder runs or invented Monitor/history checks. No runtime or authority to send traffic exists in this report.

Screens follow the ordered prefix **25 / 30 / 35 / 40 / 45 / 50 intended RPM**, each **300 s**, planning **125 / 150 / 175 / 200 / 225 / 250** slots. Absolute not-before slots, `skip_without_replay`, and the exact 5% minimum-gap allowance apply: the floor is `60000 / rate * 0.95` ms (including unrounded fractional values at 35 and 45 RPM). No backlog burst, replay, or runner retry is permitted. The first ordinary non-success closes that screen, drains existing requests and stops escalation. Only the highest *earlier clean screen from this study* can then supply the hour candidate. No clean screen means no hours.

Explicit throttling/provider-busy/backoff, authentication/identity, unexpected action, evidence/persistence, local clock/scheduling, request/runtime deadline and other safety stops end the **whole study**, with no lower fallback. Public stop enums preserve that distinction: `native_error` is ordinary first non-success, never a disguise for an explicit safety signal; `safety`, `client_pacing`, `account_guard` and the other specific guards remain terminal. `generic_error_threshold` and count-through-generic-errors are invalid for these phases. Final failures may include outcomes already outstanding at stop.

At most two `capacity_hour` cohorts use the same highest earlier clean screen via `qualifyingRunKey`, each **3600 s** with `rate * 60` slots (at most 3000 each). Any failed hour ends validation; a second hour requires a strictly qualifying first. Stages cannot overlap, must retain the same recorded target configuration, and require at least **60 s quiet after the preceding drain**, not an assumed quota reset. The study cap is **7125 new greetings**, with **180 s request/drain** and **12600 s campaign** bounds. An observed request/drain overrun cannot qualify. The aggregate validator checks recorded bounds and reviewed attestations; it cannot reconstruct unpublished runner decisions or authorize traffic.

Strict qualification is exact, not a rounded percentage: full observed window, all planned greetings, **zero failures / pending / skipped / unoffered / retries**, unique returned conversations covering every attempt, healthy measured minimum spacing and verified clean clock/evidence. The only labels are `qualified` and `not_qualified`; unknown prerequisites cannot silently pass. Both the selected screen **and both hours** must qualify before the UI derives a validated rate. Same-session hours are not different-day replication. Passing the top tested 50 RPM leaves the maximum unbracketed and establishes only a configuration-specific tested lower bound, never a platform ceiling or universal 100% reliability.

Both phases require the closed `capacityEvidence` object (forbidden on historical phases):

| Field | Reviewed evidence |
| --- | --- |
| `protocol` | `zero_error_screens_two_hours` |
| `clockStatus` | `verified_clean`, `compromised`, or `unknown`; only verified clean can qualify |
| `evidenceStatus` | `verified_complete`, `incomplete`, or `unknown`; only verified complete can qualify |
| `successfulWithinArrivalWindow` | Successful callbacks inside half-open elapsed `[0, arrivalSeconds)`. For a full hour this is exactly 3600 s, not a slightly later timer-end marker. Null when not independently counted |
| `successfulAfterArrivalWindow` | Successful callbacks outside that window but by final cutoff, including timer overshoot and drain. Paired with the inside count: both null, or integers whose sum equals eventual successful cohort outcomes |
| `postCloseActivity`, `pendingAtClose`, `postCloseNativeReturns` | `draining_requests`, `local_bookkeeping_only`, or `unknown`; paired nullable counts reconcile close-pending to later returns plus final pending. Bookkeeping-only requires both zero, and its elapsed interval must not be labelled server-drain latency |
| Optional `stopTiming` | Closed single-campaign-monotonic offsets distinguish first dispatch, native return, actual dispatch close, later observation-loop end and observation/campaign end, with separate millisecond UTC dispatch/return markers and a global-safety-stop flag. Durations reconcile to the stage; for one attempt, return minus dispatch equals its native failure timing |

Those completion counts are not derivable from dispatch-minute buckets. In-window completions remain distinct from eventual successes after drain. A partial window cannot become an hourly result by normalizing its one or few attempts to RPM.

Known **zero returned conversations** is allowed only for reviewed paced native evidence without successful greetings and with `conversationEvidence: returned_ids_checked_unique`; it is distinct from unknown/null and from zero remote activity. A disconnected invocation can fail before an identifier is exposed, with remote admission unknown. Failure denominators use actual attempts, not the 7125 cap or unoffered screen slots. All synthetic cases are isolated in `tests/fixtures/synthetic-capacity-report.mjs` and cannot load as publication input.

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

The user explicitly requested and the testing owner executed one bounded 100-call native burst; it is not merely a future plan. This report update creates no live runner and grants no further/open-ended load authorization. Additional performance work requires express Microsoft written permission or an applicable superseding agreement expressly authorizing it, service-owner confirmation and an approved study design before any separately bounded execution. Historical user authorization is not proof of that permission. Earlier single-chat wait-for-completion guidance describes the Teams pilot, not the measured distinct-conversation burst. Neither serial turns nor outstanding client RPCs establish backend/model concurrency. Old Standard Harness results from a different tenant, Production environment and DirectToEngine transport support descriptive comparison only, not a controlled harness-only comparison.

## Safe ingestion and publication

**This is a public repository: a draft PR is already public. Sanitize before writing, committing or opening a PR.**

1. Keep raw evidence outside this repository. Exclude UPNs; tenant, environment and agent IDs; internal SharePoint content/URLs/citations; Teams/chat URLs/IDs; connection details; credentials; transcripts; screenshots; and identifying filenames.
2. The report preparer reviews an aggregate against private source evidence, performs the privacy review and supplies only the permitted facts. Use `null` or an explicit unknown/pending state where evidence is missing. Plain labels/slugs can still disclose identity: explicitly review them rather than relying on validation.
3. Edit only reviewed public facts in the fixed input files, set the applicable explicit review date, and update existing run keys rather than duplicating snapshots. Existing-event window analysis belongs in `data/window-evidence.json`, not rewritten historical timings. Run `npm test` and `npm run build`; inspect the generated page and JSON before committing.
4. Review the public PR. Merging **does not deploy**. No cloud test runs or account/browser interactions are part of this project.
5. When ready, an authorized maintainer configures Pages to use GitHub Actions, configures the `github-pages` environment's required reviewers, and explicitly sets repository variable `ENABLE_PAGES_DEPLOY=true`. These are external administrative steps, not changes this scaffold performs.
6. Manually dispatch **Validate report and optionally publish Pages** on `main` with `publish=true`. Deployment additionally rejects an empty dataset or one without reviewed measured runs. The workflow uploads only the fixed `dist` output.

The normal build reads only the fixed `data/report.json` and `data/window-evidence.json` inputs; it accepts no alternate data path or environment override. Offline fixture keys are rejected by the publication loader. Extra files/directories in `dist` fail the build rather than being accidentally packaged. No test fixture, source tree, screenshot, credential, or raw evidence file belongs in that artifact.

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

Checks cover light/dark at **320, 390 and 1440 px**, all ten report sections, chart/label overflow, sticky-navigation heading visibility, rolling-window coverage/cohort selectors, paired counts and exact offsets, callback/trigger evidence, four downloads, axe WCAG A/AA rules, keyboard skip/navigation behavior, query/hash preservation, the dark default regardless of system theme, explicit light-mode choices, invalid-data withholding, print, reduced-motion and forced-color support. Explicitly labelled synthetic states exercise populated rendering only on the ephemeral QA server; they never go into `dist`.

## Design and interpretation decisions

- Exact Clawpilot base tokens and initial theme detection are retained. An explicit benchmark override applies the approved blue/purple/magenta text-only hero gradient and light/dark tokens; components use `--cp-*` colors.
- `?scoutTheme=light` / `dark` overrides system preference. The toggle preserves other parameters and the current section. No saved preference or tracking is used.
- Sections use native links with a current-page indication, rather than custom keyboard tab behavior. Print reveals all sections. No meaningless empty charts are generated.
- One Teams bot chat can serialize turns; it cannot establish platform-wide capacity by itself.
- Standard Harness comparisons are confounded by tenant, Production versus Developer, old DirectToEngine versus new channel transport, model and workload. This report contains no causal comparison.
- Load results precede cost analysis, but every recorded run carries a cost state. A separate email-to-workflow-to-agent scenario is future scope, not implemented here.
