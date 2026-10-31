import test from 'node:test';
import {checkCoachChat} from './coachChat.browser.mjs';
test('AI Coach text and voice end to end with isolated synthetic provider',{timeout:120000},()=>checkCoachChat({captureRoot:process.env.SECTIONS_CAPTURE}));
