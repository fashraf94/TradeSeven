// api/_utils/__fixtures__/pinTimezoneUtc.js
//
// Side-effect module: pins THIS test process's timezone to UTC. Import it
// FIRST, before any module that may build a local-time Date. The Cockpit off
// golden was captured in UTC, and the pre-existing gameplan runtime builds a
// local-time instant, so a run on a Chicago machine moved two golden rows by
// five hours (branch review BR-5). Correcting that runtime is a separate task.
//
// Assigning process.env.TZ on a Node main thread resets the process
// timezone. Vitest runs each test file in its own child process here (the
// forks pool), so the pin never leaks into another file.
process.env.TZ = 'UTC';
