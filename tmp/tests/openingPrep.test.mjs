import test from 'node:test';
import {checkOpeningPrep} from './openingPrep.browser.mjs';
test('opening preparation: six languages, query lifecycle and matching-position analysis',{timeout:180000},async()=>{await checkOpeningPrep({captureRoot:process.env.SECTIONS_CAPTURE});});
