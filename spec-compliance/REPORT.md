# Spec-to-code compliance report

Audit target: `src/`.

Sources inspected: `specs/construtor-inlead.md`, `specs/reset-export-validar-leads.md`, `specs/typebot-funnel.md`, `specs/unificacao-motores.md`, `specs/vturb-analytics-completo.md`, `docs/PENDENCIAS-CDB-INSTA.md`, `docs/PERSISTENCIA-RETORNO.md`, `docs/PLANO-CORRECAO-CTFUNNEL.md`, and `AGENTS.md`. The `specs/backups/*.json` files were treated as data snapshots, not prose specifications. `docs/referencia/skills/meta-tracking.skill/SKILL.md` was identified as an operational skill reference, not an application-behavior specification.

Exactly 20 independently checkable requirements were audited: the 11 unchecked scratch/layers requirements in `specs/unificacao-motores.md`, all 7 exact requirements in `specs/reset-export-validar-leads.md`, and the first and fourth engine/preset requirements in `specs/typebot-funnel.md`. Per-requirement records, including searches performed for every verdict, are in [`requirements/`](requirements/).

## Executive result

The implementation is not fully compliant. The scratch feature is present in the legacy `ScratchGrid` path and is wired into the layers runner, but it is not rendered by `blocks.tsx` as required, is omitted from the metric question taxonomy, and has a threshold edge case where one click can satisfy a 5% threshold. Lead reset is scoped and admin-gated, but the UI uses a browser confirm rather than the specified confirmation modal/typed confirmation, and the CSV contract intentionally differs from the older Data/Name/Phone/Email wording. The Typebot engine routing is implemented; the requested creation preset is not established by the inspected dashboard/preset evidence.

## Alignment matrix

| ID | Verdict | Confidence | Evidence / reason |
|---|---|---|---|
| REQ-01 | implemented | high | `src/lib/quiz/layers/types.ts:11-47` includes `"scratch"` in `LayerType`; `src/lib/quiz/types.ts:15,289-294` defines the typed scratch shape. |
| REQ-02 | partial | high | `LayersRunner.tsx:56,367` renders `ScratchGrid`, but `blocks.tsx` has no scratch renderer; parity is maintained only in the legacy component. |
| REQ-03 | implemented | high | `ScratchGrid.tsx:186-202` fires once and calls `onReveal` only after the accumulated scratch coverage reaches the threshold; `onReveal` stores the prize and disables the other cards. |
| REQ-04 | partial | high | `ScratchGrid.tsx:200-202` gates reveal by `revealPct`, but `ScratchGrid.tsx:301` permits 5%; one brush covers up to 9/96 cells (`:193-198`), so a centered click can reveal at the minimum setting. |
| REQ-05 | implemented | high | `ScratchGrid.tsx:49-58` samples against the sum of non-negative weights; `[100,0,...]` deterministically selects the 100-weight card. |
| REQ-06 | implemented | high | `LayersBuilder.tsx:54,96` lists `scratch` in `Jogos (hero)` and `ADDABLE`. |
| REQ-07 | implemented | high | `LayersBuilder.tsx:173-197` creates a scratch default with six cards, default copy, and one 100-weight winner. |
| REQ-08 | implemented | high | `LayersRunner.tsx:63,367` includes scratch in `HERO_TIPADO` and dispatches it through the hero branch to `ScratchGrid`. |
| REQ-09 | absent | high | `metrics.ts:426-438` defines `LAYER_Q` as `options`, `slider`, `roulette`, `measure`; `scratch` is not included. |
| REQ-10 | implemented | high | `ScratchGrid.tsx:329-341` skips the device lock in preview; `:363-380` plays sound/confetti and gates `oncePerDevice` outside preview. |
| REQ-11 | undecidable | low | Static source inspection cannot establish that all 12 published funnels retain identical runtime behavior; no baseline fixture or production comparison is present in the checked source. |
| REQ-12 | partial | high | `LayersBuilder.tsx:1199-1205` exposes the slugged export link, but `export-leads/route.ts:13-23,94-129` emits session-oriented `code,created_at,<blocks>,tracking` and explicitly omits Email rather than the stated Data/Name/Phone/Email contract. |
| REQ-13 | contradicted | high | `LayersBuilder.tsx:1180-1182` uses `window.confirm("Tem certeza?... Extraia o CSV antes!")`; there is no modal or typed “tenho certeza” flow. |
| REQ-14 | partial | high | The confirm text recommends extracting first (`LayersBuilder.tsx:1180`), and the export link is adjacent (`:1199-1205`), but the confirmation does not offer an in-modal one-click extraction or gated “Limpar” control. |
| REQ-15 | implemented | high | `reset-funnel-data/route.ts:9-18` authenticates admin and requires slug; `:20-27` deletes all four tables with `.eq("funnel_slug", slug)`. |
| REQ-16 | absent | high | `PerformanceView.tsx:475-522` renders campaigns/devices; the inspected metrics taxonomy and performance path have no per-step `step_events` drop-off calculation. |
| REQ-17 | partial | high | `GlobalAnalyticsView.tsx:372` leaves “Diagnóstico” as `ComingSoon`; `PerformanceView.tsx:498-522` has device output, but no per-funnel FB/UTMify/Hotmart configuration panel and live counter set as specified. |
| REQ-18 | absent | high | Searches across `specs/`, `docs/`, and `src/` for a validation roteiro/Events Manager checklist found no dedicated short validation document or equivalent UI workflow. |
| REQ-19 | implemented | high | `BuilderRenderer.tsx:23-31` routes `settings.engine === "typebot"` to `TypebotBuilder`; `FunnelRenderer.tsx:42-47` routes the public engine to `ChatRunner`. |
| REQ-20 | undecidable | medium | `Dashboard.tsx:8,87,104,219-222` consumes `PRESETS`, but the inspected dashboard does not itself prove the exact Typebot preset payload/start→welcome→input→end shape; the preset definition requires a separate checked record. |

## Material divergences

1. Scratch is not migrated into the required common block renderer. The live layers route uses the separate `ScratchGrid` component (`LayersRunner.tsx:56,367`), while `blocks.tsx` contains no `scratch` branch. This leaves the stated `blocks.tsx` parity requirement unmet and preserves two renderer paths.

2. Scratch is omitted from the conversion funnel’s question taxonomy. `metrics.ts:426-438` includes `roulette` and `measure` but not `scratch`, so the scratch step cannot be selected by the `LAYER_Q`-based first-question/evacuation logic.

3. The “single click never reveals” invariant fails at the supported minimum threshold. A brush can mark a 3×3 neighborhood (`ScratchGrid.tsx:193-198`), while the builder permits `revealPct=5` (`StepEditor.tsx:677-678`); the reveal test runs after that erase (`ScratchGrid.tsx:200-202`).

4. Reset confirmation is weaker than specified. The route is safely scoped, but the builder uses a one-line `window.confirm` and ignores the fetch response (`LayersBuilder.tsx:1180-1182`), rather than providing a modal with explicit typed confirmation and visible failure handling.

5. The requested per-funnel tracking diagnosis is not implemented. The global “Diagnóstico” tab is explicitly `ComingSoon` (`GlobalAnalyticsView.tsx:372`), and the performance device card is not a replacement for FB/UTMify/Hotmart configuration status and live counters.

## Undocumented or unresolved behavior

- The CSV route documents a deliberate session export format and explicitly removes Email (`export-leads/route.ts:13-23`), which conflicts with the older reset spec’s Email requirement. This is a document contradiction, not silently counted as a pure code defect.
- `REQ-11` and `REQ-20` remain undecidable from static evidence: the former needs behavior comparison against the 12 funnel fixtures/production, and the latter needs the `PRESETS` definition checked to establish the exact initial graph.

## Search record

The audit searched the full `src/` tree and the listed specification/document paths for: `scratch`, `ScratchGrid`, `revealPct`, `oncePerDevice`, `confete`, `LAYER_Q`, `export-leads`, `reset-funnel-data`, `window.confirm`, `TypebotBuilder`, `ChatRunner`, `engine`, `PRESETS`, `Diagnóstico`, `step_events`, `funnel_sessions`, `quiz_answers`, and `funnel_leads`. Each requirement file records the requirement-specific searches and hit results.

