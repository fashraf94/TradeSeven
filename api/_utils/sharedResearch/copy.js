// api/_utils/sharedResearch/copy.js
//
// Shared Research — THE SERVER'S PLAYER-FACING LINES (spec §6.1, §6.12 control 4).
// Every message the route answers a refusal or a failure with. Guarded like hub
// copy (copy.guard.test.js: the hub's banned list, plus "Shadow", "confidence"
// and "%"). The pause line is the spec's own, word for word. PURE DATA.

export const SR_SERVER_COPY = Object.freeze({
  disabled: 'Shared Research is not available yet.',
  invalid_entry: 'That starting point could not be read. Pick a story or type your own words.',
  item_kind_unsupported: 'That kind of starting point is not supported.',
  item_not_found: 'That story or drop is no longer available.',
  invalid_question: 'A question is 1 to 500 characters.',
  invalid_observation: 'Your words are 1 to 500 characters.',
  invalid_direction: 'A direction is 1 to 500 characters.',
  invalid_request: 'That request could not be read. Try again.',
  session_not_found: 'That investigation could not be found.',
  session_not_open: 'That investigation is no longer open.',
  step_in_flight: 'A step is already running for this investigation.',
  budget_spent: 'This investigation has used all of its steps. Reading, saving an idea and closing still work.',
  daily_limit: 'You have opened today\'s investigations. You can open another tomorrow.',
  framing_limit: 'You have framed today\'s questions. You can frame another tomorrow, or start from a story.',
  budget_paused: 'Research steps are paused for today — the daily research budget is used. Your investigation is kept; reading, saving an idea and closing still work.',
  step_limit: "You have used today's research steps. You can take another tomorrow; reading, saving an idea and closing still work.",
  findings_full: 'This investigation holds all the findings it can. Save what it found as an idea, or close it.',
  prompt_too_large: 'This investigation holds more than one step can read. Close it, or save what it found as an idea.',
  invalid_target: 'That connection is not one this investigation holds now.',
  invalid_adoption: 'That idea could not be saved. Nothing was created.',
  unsupported_assertion: 'The idea states a number none of its evidence holds. Edit it to match the evidence.',
  names_not_supported: 'The idea must name exactly the companies you picked.',
  preview_stale: 'The investigation changed since you opened the preview. Check the new draft and save again.',
  no_valid_tickers: 'None of the picked companies can be saved to a list.',
  attribution_unavailable: 'Your agent could not be found, so nothing was started. Try again.',
  step_failed: 'That step did not complete, and nothing was added. Try again.',
  frame_failed: 'That question could not be framed. Try again, or edit your words.',
  server_error: 'Something went wrong with the research. Try again.',
});

/** The line for a code; the generic line for one not listed. */
export const copyFor = (code) => (Object.hasOwn(SR_SERVER_COPY, code) ? SR_SERVER_COPY[code] : SR_SERVER_COPY.server_error);
