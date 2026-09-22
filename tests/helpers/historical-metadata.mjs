// Test-only reconstruction keeps pre-migration fingerprints checking every load field.
export function restoreHistoricalMetadata(report) {
  const restored = structuredClone(report);
  const monitor = (value) => {
    const { relevance, ...counts } = value;
    return { ...counts, credits: "not_recorded", relevance };
  };
  for (const run of restored.runs) {
    run.cost = { status: "pending", currency: null, amount: null, source: null, scope: null, recordedOn: null };
    if (run.nativeInvocation) run.nativeInvocation.postRunMonitor = monitor(run.nativeInvocation.postRunMonitor);
  }
  for (const campaign of restored.pacedCampaigns ?? []) campaign.postCampaignMonitor = monitor(campaign.postCampaignMonitor);
  if (restored.studyContext) {
    for (const key of ["prePilotMonitor", "postPilotMonitor"]) {
      if (restored.studyContext[key] === "no_sessions_recorded") restored.studyContext[key] = "no_sessions_or_credits_recorded";
    }
  }
  return restored;
}
