// api/_utils/kb/packages/index.js
//
// KB-0 — THE COMMITTED KB PACKAGES (Shared Research spec V1.2, Amendment A
// §A3.1). One row per package. The files are static JSON imports, so the
// function bundle carries them (the precedent:
// api/_utils/stockThresholdPolicyRegistry.js). They are written only by
// scripts/kb/import-release.mjs, byte for byte from an accepted release, and
// checked on every read by loader.js. A new package: run the import first,
// then add its row here.

import ideaEvaluationExport from './KB-IDEA-EVALUATION-001-v0.1.export.json' with { type: 'json' };
import ideaEvaluationAcceptance from './KB-IDEA-EVALUATION-001-v0.1.acceptance.json' with { type: 'json' };
import contentRegister from './KB-CONTENT-001.source-register.json' with { type: 'json' };

export const KB_PACKAGES = Object.freeze([
  Object.freeze({
    id: 'KB-IDEA-EVALUATION-001',
    version: '0.1',
    exportJson: ideaEvaluationExport,
    acceptance: ideaEvaluationAcceptance,
    register: contentRegister,
  }),
]);
