# Build B spec V1.0 — Amendment D: founder rulings on the B1.1 report (2026-10-16)

- **RD-1 — The capture version.**
  - `risk.stagnation` is accepted under the registered tick-capture versions (1 with calls off, 2 with calls on). It is a field added beside the existing ones, and every reader reads it by name. No reader keys on the version.
  - The rule beside the version (`captureConfig.js:37`) becomes: *bump when a reader must know the version to read a record correctly: a field removed, renamed, retyped or given a new meaning. A field added beside the existing ones and read by name does not bump; the ruling that adds it is cited here.*
  - The call-record contract's registrations are unchanged.
- **RD-2 — What a late-meeting re-merge may move.**
  - A re-merge of the previous session P moves exactly what a refresh of P at that instant would move. It is the same writer (RC-3), and criterion 2's exception reads that way.
  - It is dormant while every battle is a single trading day.
- **RD-3 — A meeting left pending at completion.**
  - Completion does not file a pending meeting, so a meeting still pending after the battle's last check never reaches the history. This predates B1.1.
  - The tape stops promising otherwise. On a battle's **final day**, the meetings note reads:

    > *a meeting created this day was still pending after the battle's last check; the platform does not file a meeting left pending at completion, so it is not copied*
  - On an **earlier day**, it reads:

    > *a meeting created this day was not yet filed when this tape was read; the next night's close pass copies it once it is filed*
  - Filing a pending meeting at completion is a platform change, and it goes to the Command Center chat. Once completion files it, the completion night's final-day re-merge copies it.
  - Nothing is copied from the pending meeting or from cron state.
- **RD-4 — Runs on the recorded basis.**
  - Accepted as built while every battle is single-day: "the rule has fired" is local to the day, and a recorded count that falls without a timely zero is not a run boundary.
  - A tag missed this way stays counted as `recorded_basis`.
  - Revisit when multi-day battles return, by carrying "fired" over from the previous day's tape.
- **RD-5 — Coverage on a recorded day.**
  - `coverage.tags` reads the evidence section's status only when some holding of the day is on the recomputed basis. The checks section always counts.
  - On a day with no recomputed holding, partial evidence no longer makes `stalled` unavailable.
- **RD-6 — A copied meeting is permanent.**
  - When a new read holds a row under a key the tape already stores, the stored row stands.
  - The day's cap keeps stored rows first, then new rows by creation time.
  - A filed meeting doesn't change after filing, so this only refuses a rewritten history. It applies to every path: the nightly pass, the late-meeting re-merge and an admin refresh.
- **RD-7 — The pre-existing items from the B1.1 review.**
  - **Fixed now:**
    - X4-3: an empty-message error's bare name in read notes and `passes.*.reason`; it now prints through the class list;
    - X2-7b: `inputs.winnerBasis` named only the recomputed input;
    - X2-6: a fixture where the daily change and the change since entry differ.
  - **Moved to B2's writer section, discovery first:** X3-5, a sequence listed as both the day's gap and unattributed after a re-write.
  - **Routed to the Command Center chat**, which owns the tick capture: X1-2. The capture serializer rejects a dotted share-class key such as `BF.B` under every symbol-keyed map, so that holding loses its capture records.
  - **Backlog:** X2-2's sub-classes of `recorded_basis`.
