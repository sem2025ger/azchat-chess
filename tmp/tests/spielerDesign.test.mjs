import test from 'node:test';
import {join} from 'node:path';
import {checkSpielerDesign} from './spielerDesign.browser.mjs';
test('Spieler redesign: work area fits 720p, six languages, responsive tabs/directory/promotion and uniform menu typography',{timeout:180000},async()=>{await checkSpielerDesign({captureRoot:process.env.SECTIONS_CAPTURE?join(process.env.SECTIONS_CAPTURE,'spieler-redesign'):undefined});});
