// Strict allowlist: QA-only flags never apply to main, production, or backups.
const isolatedQaBranches = new Set([
 'qa/spieler-coach-compact-controls-20261030',
 'qa/spieler-final-polish-20261031',
]);

export function isIsolatedQaPreviewBranch(branch) {
 return typeof branch === 'string' && isolatedQaBranches.has(branch);
}
