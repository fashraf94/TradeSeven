# Build B spec V1.0 — Amendment F: founder rulings on Astra's B1.1 review (2026-10-16)

- **RF-1 — Error output from a thrown function or class (criterion 7, Astra F1).** The census treats a thrown function or class as an error object: it prints its message only when it has a usable one, and otherwise the listed class alone. Its name never prints. The tape's helpers already do this.
- **RF-2 — What counts as a failed re-merge (criterion 5, Astra F2).**
  - Criterion 5 covers a re-merge whose write failed.
  - A write the writer acknowledged is a re-merge that happened, whatever a later read does. The summary reports it from the writer's own outcome (`remerged`, with `meetingsStored` taken from the committed document) and never as `remergeFailed`.
  - The re-merge's `catch` formats its reason through the class list, so it never throws. This item moves here from RE-1's B2 writer work; the rest of RE-1 stays with B2.
