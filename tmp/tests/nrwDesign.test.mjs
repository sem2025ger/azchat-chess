import test from 'node:test';
import {checkNRWDesign} from './nrwDesign.browser.mjs';

test('NRW prioritizes tournaments, teams and clubs with six-language responsive navigation', {timeout:180000}, async()=>{
 await checkNRWDesign({captureRoot:process.env.NRW_CAPTURE||process.env.SECTIONS_CAPTURE});
});
