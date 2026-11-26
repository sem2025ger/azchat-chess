import test from 'node:test';
import {checkRoomLayout} from './schachTreffLayout.browser.mjs';
test('Schach-Treff room panels fit and retain typographic hierarchy on desktop and mobile',{timeout:180000},()=>checkRoomLayout());
test('Schach-Treff moderation, unread badges and dialogs fit 1280, 1920 and 375 px',{timeout:180000},()=>checkRoomLayout(true));

test('Schach-Treff v2 player dialog: six languages, ratings, history and actions fit 375/1366/1920 px',{timeout:180000},()=>checkRoomLayout(false,true));

test('Schach-Treff mobile v2 with moderation: room, menu, challenge and nav across 36 layouts',{timeout:240000},()=>checkRoomLayout(true,true));
