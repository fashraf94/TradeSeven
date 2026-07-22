#!/usr/bin/env bash
#
# scripts/status-consumer-census.sh
#
# Reproducible enumeration of every pod-status (GROUP_STATUS) consumer — the
# Training-Pod P0 EXPIRED consumer census (review Q5). It lists every non-test
# reference so a reviewer can re-derive the consumer set and confirm the new
# GROUP_STATUS.EXPIRED value is handled (positive gates ignore it; display mappers
# read it terminal; active-status selectors exclude it). Regenerate the committed
# snapshot with:
#
#   bash scripts/status-consumer-census.sh > docs/audits/20260722_STATUS_CONSUMER_CENSUS.txt
#
set -euo pipefail
cd "$(dirname "$0")/.."

SRC=(api src)
NONTEST='\.test\.'

section() { printf '\n===================== %s =====================\n' "$1"; }

printf '# GROUP_STATUS consumer census (reproducible — scripts/status-consumer-census.sh)\n'
printf '# HEAD: %s\n' "$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"

section 'Non-test files referencing GROUP_STATUS'
grep -rln 'GROUP_STATUS' --include='*.js' --include='*.jsx' "${SRC[@]}" | grep -v node_modules | grep -vE "$NONTEST" | sort

section "switch statements over a status (exhaustive-consumer risk)"
grep -rnE 'switch\s*\(.*[sS]tatus' --include='*.js' --include='*.jsx' "${SRC[@]}" | grep -v node_modules | grep -vE "$NONTEST" || true

section "Firestore where('status', ...) queries under api/"
grep -rnE "where\(\s*['\"]status['\"]" --include='*.js' api | grep -v node_modules | grep -vE "$NONTEST" || true

section 'Active-status selectors + status predicates (leagueTournament.js)'
grep -nE 'export function (selectMyGroup|selectMyTrainingPod|casualDeployMissesPodSession)' src/constants/leagueTournament.js || true

section 'GROUP_STATUS.EXPIRED references (the new value + its handlers)'
grep -rnE "GROUP_STATUS\.EXPIRED" --include='*.js' --include='*.jsx' "${SRC[@]}" | grep -v node_modules | grep -vE "$NONTEST" || true

section 'Callers of fetchEligibleGroupsByStatus (must NEVER pass EXPIRED)'
grep -rnE 'fetchEligibleGroupsByStatus\(' --include='*.js' "${SRC[@]}" | grep -v node_modules | grep -vE "$NONTEST" || true
