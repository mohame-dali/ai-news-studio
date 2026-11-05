# App import

## Phase 19 — Smart newsroom
- [x] Guarded feed aggregation, deduplication, allowed-domain custom feed validation and source diagnostics.
- [x] Cached ranking and French newsroom dashboard with fallback.
- [x] Fact extraction, section budgets, sensitive-topic rules, progress and partial retry implemented and unit-tested.
- [x] Automated tests and live feed/dashboard verification; report unavailable services.
- [ ] Live AI ranking, fact extraction, no-invented-impact check, sensitive script and 120-second script: blocked by missing hosted Ollama service.
- [ ] Arbitrary custom feed domains: blocked until a trusted egress service can prevent DNS rebinding; publisher allowlist remains enforced.

- [x] Inspect and import the repository’s standalone studio interface and assets.
- [x] Verify start page, demo editor, navigation, saved script edits, source panel, configuration and animated preview; inspect desktop and phone layouts.
- [ ] Hosted AI, media fetching, narration and transcoding: blocked by original local services requiring separate hosting or replacement; allowed-domain article fetching is implemented.
