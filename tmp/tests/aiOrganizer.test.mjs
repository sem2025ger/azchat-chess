import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';
import { createAiOrganizerApi } from '../src/services/teamTournaments.ts';
import { tournamentCopy } from '../src/components/teamTournaments/copy.ts';

const languages = ['de', 'en', 'az', 'tr', 'ua', 'ru'];
const draft = {
  name: 'Fixture Cup', start_time: '2026-12-20T15:00',
  registration_deadline: '2026-12-20T14:00',
  boards_per_team: 4, min_teams: 2, max_teams: 4,
};
const signal = new AbortController().signal;
function findElement(tree, predicate) {
  if (Array.isArray(tree)) {
    for (const item of tree) {
      const found = findElement(item, predicate);
      if (found) return found;
    }
    return null;
  }
  if (!tree || !tree.props) return null;
  return predicate(tree) ? tree : findElement(tree.props.children, predicate);
}
async function withAiComponent(component, check, api = {}) {
  const path = '/src/components/teamTournaments/' + component + '.tsx';
  const fixture = '/__ai_organizer_hooks.ts';
  const vite = await createServer({
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    define: { 'import.meta.env.VITE_AI_ORGANIZER_ENABLED': '"true"' },
    plugins: [{
      name: 'ai-organizer-hooks',
      enforce: 'pre',
      resolveId(id, importer) {
        if (id === fixture) return fixture;
        if (importer?.endsWith(path) && [
          '../../context/LanguageContext', '../../services/teamTournaments',
          './AiOrganizerPanel',
        ].includes(id)) return fixture;
      },
      transform(code, id) {
        if (id.endsWith(path)) return code.replace("from 'react'", "from '" + fixture + "'");
      },
      load(id) {
        if (id !== fixture) return;
        return 