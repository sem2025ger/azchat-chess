import test from 'node:test';
import {checkRoomLayout} from './schachTreffLayout.browser.mjs';
test('Schach-Treff room panels fit and retain typographic hierarchy on desktop and mobile',{timeout:180000},checkRoomLayout);
