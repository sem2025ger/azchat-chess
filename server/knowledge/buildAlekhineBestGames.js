'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { Chess, validateFen } = require('chess.js');
const { tagThemes, materialSignature } = require('./classicsThemes');

const DEFAULT_START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const SOURCE_DIR = path.join(__dirname, 'classics', 'sources', 'alekhine-best-games-1908-1923');
const BATCH_PATTERN = /^batch-(\d{2})\.json$/;

function posKey(fen) {
 const parts = String(fen || '').trim().split(/\s+/);
 return parts.slice(0, 4).join(' ');
}

function boardTurnKey(fen) {
 const parts = String(fen || '').trim().split(/\s+/);
 return `${parts[0] || ''} ${parts[1] || ''}`;
}

function assertValidFen(fen, context) {
 const v = validateFen(fen);
 if (!v || !v.ok) {
  throw new Error(`${context}: invalid FEN "${fen}" (${v?.error || 'unknown'})`);
 }
 return new Chess(fen).fen();
}

function stripMoveNumberPrefix(token) {
 return String(token || '').trim().replace(/^\d+\.(?:\.\.)?/, '').replace(/^\.\.\./, '').trim();
}

function cleanMoveToken(token) {
 return stripMoveNumberPrefix(token).replace(/[!?]+$/g, '').trim();
}

function parseMovesInput(movesInput) {
 if (Array.isArray(movesInput)) {
  return movesInput.map((m) => String(m || '').trim()).filter(Boolean);
 }
 if (typeof movesInput === 'string') {
  return movesInput
   .replace(/\{[^}]*\}/g, ' ')
   .replace(/\([^)]*\)/g, ' ')
   .replace(/\d+\.(?:\.\.)?/g, ' ')
   .trim()
   .split(/\s+/)
   .filter((t) => t && !['1-0', '0-1', '1/2-1/2', '*', '...'].includes(t));
 }
 return [];
}

function replayMoveList(startFen, rawMoves, context) {
 const board = new Chess(startFen);
 const moves = [];
 const fens = [board.fen()];
 for (let i = 0; i < rawMoves.length; i++) {
  const raw = rawMoves[i];
  const cleaned = cleanMoveToken(raw);
  if (!cleaned) continue;
  let moved = null;
  try {
   moved = board.move(cleaned, { strict: true });
  } catch {
   try {
    moved = board.move(cleaned);
   } catch (err) {
    throw new Error(`${context} ply ${i + 1} ("${raw}"): illegal move from ${board.fen()} (${err.message})`);
   }
  }
  if (!moved) {
   throw new Error(`${context} ply ${i + 1} ("${raw}"): move returned null`);
  }
  moves.push(moved.san);
  fens.push(board.fen());
 }
 return { moves, fens, finalFen: board.fen(), finalBoard: board };
}

function verifyMoveLabel(moveLabel, plyIndex, startFen, mainlineSan, context) {
 if (!moveLabel) return;
 if (plyIndex < 1 || plyIndex > mainlineSan.length) {
  throw new Error(`${context}: moveLabel "${moveLabel}" refers to out-of-range afterPly ${plyIndex}`);
 }
 const actualSan = mainlineSan[plyIndex - 1].replace(/[+#?!]+$/g, '');
 const m = String(moveLabel).trim().match(/^(\d+)(\.{1,3})([^\s]+)$/);
 if (!m) return;
 const labelNum = Number(m[1]);
 const dots = m[2];
 const labelSan = m[3].replace(/[+#?!]+$/g, '');
 const startParts = startFen.split(/\s+/);
 const startFullMove = Number(startParts[5] || 1);
 const startTurn = startParts[1] === 'b' ? 1 : 0;
 const absHalfMove = (startFullMove - 1) * 2 + startTurn + (plyIndex - 1);
 const expectedNum = Math.floor(absHalfMove / 2) + 1;
 const expectedBlack = absHalfMove % 2 === 1;
 const labelBlack = dots === '...';
 if (labelNum !== expectedNum || labelBlack !== expectedBlack || labelSan !== actualSan) {
  throw new Error(
   `${context}: moveLabel "${moveLabel}" does not match afterPly=${plyIndex} (actual ${expectedNum}${expectedBlack ? '...' : '.'}${actualSan})`
  );
 }
}

function formatPgnMoves(moves, startFen) {
 if (!moves.length) return '*';
 const parts = startFen.split(/\s+/);
 let moveNum = Number(parts[5] || 1);
 let turn = parts[1] || 'w';
 const tokens = [];
 for (let i = 0; i < moves.length; i++) {
  if (turn === 'w') {
   tokens.push(`${moveNum}. ${moves[i]}`);
   turn = 'b';
  } else {
   if (i === 0) tokens.push(`${moveNum}... ${moves[i]}`);
   else tokens.push(moves[i]);
   moveNum++;
   turn = 'w';
  }
 }
 return tokens.join(' ');
}

function buildPgnString(game, moves, startFen) {
 const headers = [
  ['Event', game.event || '?'],
  ['Site', game.site || '?'],
  ['Date', game.date || `${game.year || '????'}.??.??`],
  ['Round', game.round != null ? String(game.round) : String(game.gameNumber)],
  ['White', game.white],
  ['Black', game.black],
  ['Result', game.result || '*']
 ];
 if (game.eco) headers.push(['ECO', game.eco]);
 if (game.opening) headers.push(['Opening', game.opening]);
 if (startFen !== DEFAULT_START_FEN) {
  headers.push(['SetUp', '1']);
  headers.push(['FEN', startFen]);
 }
 const headerText = headers.map(([k, v]) => `[${k} "${String(v).replace(/"/g, '\\"')}"]`).join('\n');
 const bodyText = `${formatPgnMoves(moves, startFen)} ${game.result || '*'}`.trim();
 return `${headerText}\n\n${bodyText}`;
}

function validateVariationTree(variations, parentFens, context, stats) {
 if (!Array.isArray(variations) || !variations.length) return [];
 const out = [];
 for (let i = 0; i < variations.length; i++) {
  const v = variations[i];
  const stepIndex = v.branchPly ?? v.branchStep;
  if (!v.startFen && (typeof stepIndex !== 'number' || stepIndex < 0 || stepIndex >= parentFens.length)) {
   throw new Error(`${context} variation[${i}]: invalid branchPly/branchStep ${stepIndex} (parent fens: ${parentFens.length})`);
  }
  const baseFen = v.startFen ? assertValidFen(v.startFen, `${context} variation[${i}]`) : parentFens[stepIndex];
  const turn = baseFen.split(/\s+/)[1];
  if (v.sideToMove && v.sideToMove !== turn) {
   throw new Error(`${context} variation[${i}]: expected sideToMove=${v.sideToMove} but FEN turn is ${turn}`);
  }
  const rawMoves = parseMovesInput(v.moves);
  if (!rawMoves.length) {
   throw new Error(`${context} variation[${i}]: empty moves`);
  }
  const replayed = replayMoveList(baseFen, rawMoves, `${context} variation[${i}]`);
  stats.variations += 1;
  stats.variationMoves += replayed.moves.length;
  for (const f of replayed.fens) stats.generatedFensSet.add(f);
  stats.totalGeneratedFens += replayed.fens.length;

  const subvariations = validateVariationTree(
   v.subvariations || [],
   replayed.fens,
   `${context} variation[${i}]`,
   stats
  );

  out.push({
   label: v.label || formatPgnMoves(replayed.moves.slice(0, 2), baseFen),
   branchPly: stepIndex ?? null,
   startFen: baseFen,
   moves: replayed.moves,
   endFen: replayed.finalFen,
   fens: replayed.fens,
   summary: String(v.summary || '').trim(),
   ...(subvariations.length ? { subvariations } : {})
  });
 }
 return out;
}

function assertNoVerbatimCopyrightFields(obj, context) {
 if (!obj || typeof obj !== 'object') return;
 if (Object.prototype.hasOwnProperty.call(obj, 'originalText')) {
  throw new Error(`${context}: forbidden "originalText" field found (copyright protection rule)`);
 }
}

function buildGameUnit(game, stats) {
 assertNoVerbatimCopyrightFields(game, `Game ${game.gameNumber}`);
 const num = game.gameNumber;
 if (!Number.isInteger(num) || num < 1) {
  throw new Error(`Invalid gameNumber: ${num}`);
 }
 const context = `Game ${num} (${game.white} - ${game.black})`;
 const startFen = assertValidFen(game.startFen || DEFAULT_START_FEN, `${context} startFen`);
 const rawMainline = parseMovesInput(game.moves);
 if (!rawMainline.length) {
  throw new Error(`${context}: empty mainline moves`);
 }
 const replayed = replayMoveList(startFen, rawMainline, `${context} mainline`);
 stats.mainlineMoves += replayed.moves.length;
 for (const f of replayed.fens) stats.generatedFensSet.add(f);
 stats.totalGeneratedFens += replayed.fens.length;

 const pgn = buildPgnString(game, replayed.moves, startFen);
 const diagrams = [];
 for (let i = 0; i < (game.diagrams || []).length; i++) {
  const d = game.diagrams[i];
  const dCtx = `${context} diagram #${d.index ?? i + 1}`;
  const dFen = assertValidFen(d.fen, dCtx);
  stats.diagrams += 1;
  stats.generatedFensSet.add(dFen);
  stats.totalGeneratedFens += 1;

  if (d.isInitial) {
   if (boardTurnKey(dFen) !== boardTurnKey(startFen)) {
    throw new Error(`${dCtx}: isInitial diagram does not match startFen board/turn`);
   }
  } else if (typeof d.afterPly === 'number') {
   if (d.afterPly < 0 || d.afterPly >= replayed.fens.length) {
    throw new Error(`${dCtx}: afterPly ${d.afterPly} out of range 0..${replayed.fens.length - 1}`);
   }
   if (!d.printerErratum) {
    const expected = replayed.fens[d.afterPly];
    if (boardTurnKey(dFen) !== boardTurnKey(expected)) {
     throw new Error(
      `${dCtx}: diagram placement/turn mismatch at afterPly=${d.afterPly}\n  diagram: ${boardTurnKey(dFen)}\n  replayed: ${boardTurnKey(expected)}`
     );
    }
   }
  }
  if (d.printerErratum) {
   stats.errata.push({
    gameNumber: num,
    kind: 'diagram_printer_erratum',
    bookPage: d.bookPage ?? null,
    pdfPage: d.pdfPage ?? null,
    afterPly: d.afterPly ?? null,
    note: d.printerErratum
   });
  }

  diagrams.push({
   index: d.index ?? i + 1,
   bookPage: d.bookPage,
   pdfPage: d.pdfPage ?? null,
   afterPly: d.afterPly ?? null,
   isInitial: Boolean(d.isInitial),
   caption: d.caption || null,
   fen: dFen,
   positionKey: posKey(dFen),
   ...(d.printerErratum ? { printerErratum: d.printerErratum } : {})
  });
 }

 const annotations = [];
 const unitThemeSet = new Set(Array.isArray(game.themes) ? game.themes : []);
 const combinedUnitText = [game.opening, game.overallPlan, game.strategicSummary].filter(Boolean).join(' ');
 for (const t of tagThemes(combinedUnitText)) unitThemeSet.add(t);

 for (let i = 0; i < (game.annotations || []).length; i++) {
  const a = game.annotations[i];
  assertNoVerbatimCopyrightFields(a, `${context} annotation[${i}]`);
  const aCtx = `${context} annotation[${i}]`;
  const ply = a.afterPly;
  if (!Number.isInteger(ply) || ply < 0 || ply >= replayed.fens.length) {
   throw new Error(`${aCtx}: invalid afterPly ${ply} (0..${replayed.fens.length - 1})`);
  }
  if (a.moveLabel) {
   verifyMoveLabel(a.moveLabel, ply, startFen, replayed.moves, aCtx);
  }
  const summary = String(a.summary || '').trim();
  if (!summary) {
   throw new Error(`${aCtx}: missing summary`);
  }
  stats.annotations += 1;
  const validatedVars = validateVariationTree(a.variations || [], replayed.fens, aCtx, stats);
  const aThemes = Array.from(new Set([
   ...(Array.isArray(a.themes) ? a.themes : []),
   ...tagThemes(`${summary} ${validatedVars.map((v) => v.summary).join(' ')}`)
  ])).sort();
  for (const t of aThemes) unitThemeSet.add(t);

  annotations.push({
   id: `g${num}-a${i + 1}`,
   afterPly: ply,
   moveLabel: a.moveLabel || null,
   bookPage: a.bookPage,
   pdfPage: a.pdfPage ?? null,
   nag: a.nag || null,
   fen: replayed.fens[ply],
   positionKey: posKey(replayed.fens[ply]),
   summary,
   themes: aThemes,
   variations: validatedVars
  });
 }

 if (Array.isArray(game.errata)) {
  for (const e of game.errata) {
   stats.errata.push({ gameNumber: num, ...e });
  }
 }

 const positionKeySet = new Set();
 for (const f of replayed.fens) positionKeySet.add(posKey(f));
 for (const d of diagrams) positionKeySet.add(d.positionKey);
 function addVarKeys(vars) {
  for (const v of vars) {
   for (const f of v.fens) positionKeySet.add(posKey(f));
   if (v.subvariations) addVarKeys(v.subvariations);
  }
 }
 for (const a of annotations) addVarKeys(a.variations);

 const unitThemes = Array.from(unitThemeSet).sort();
 const endMatSig = materialSignature(replayed.finalFen);
 const pages = {
  from: game.pages?.from ?? null,
  to: game.pages?.to ?? null,
  ...(Array.isArray(game.pages?.pdfPages) ? { pdfPages: game.pages.pdfPages } : {})
 };

 const chunks = buildGameChunks({
  num,
  game,
  pages,
  unitThemes,
  replayed,
  annotations,
  diagrams
 });

 const title = `Game ${num}: ${game.white} – ${game.black} (${game.site || game.event}, ${game.year})`;
 return {
  id: `g${num}`,
  kind: 'game',
  gameNumber: num,
  title,
  chapter: game.chapter || null,
  chapterTitle: game.chapterTitle || null,
  white: game.white,
  black: game.black,
  event: game.event,
  site: game.site || null,
  date: game.date || null,
  year: game.year,
  opening: game.opening,
  eco: game.eco || null,
  result: game.result,
  pages,
  themes: unitThemes,
  startFen,
  materialSignature: endMatSig,
  pgn,
  mainline: replayed.moves,
  diagrams,
  annotations,
  positionKeys: Array.from(positionKeySet),
  chunks
 };
}

function formatVariationInline(v) {
 const first = formatPgnMoves(v.moves, v.startFen);
 const subs = (v.subvariations || [])
  .map((sv) => `[sub: ${formatPgnMoves(sv.moves, sv.startFen)}${sv.summary ? ' — ' + sv.summary : ''}]`)
  .join(' ');
 return `${first}${v.summary ? ' — ' + v.summary : ''}${subs ? ' ' + subs : ''}`;
}

function buildGameChunks({ num, game, pages, unitThemes, replayed, annotations }) {
 const chunks = [];
 const header = `Game ${num}: ${game.white} vs ${game.black} (${game.event}, ${game.year}) — ${game.opening}${game.eco ? ` [${game.eco}]` : ''}, Result: ${game.result}.`;
 const overviewText = [
  header,
  game.overallPlan || game.strategicSummary || '',
  `Line: ${replayed.moves.slice(0, 12).reduce((acc, m, idx) => (idx % 2 === 0 ? `${acc}${acc ? ' ' : ''}${idx / 2 + 1}. ${m}` : `${acc} ${m}`), '')}${replayed.moves.length > 12 ? ' ...' : ''}`
 ]
  .filter(Boolean)
  .join('\n');

 const openingKeys = Array.from(new Set(replayed.fens.slice(0, Math.min(18, replayed.fens.length)).map(posKey)));
 chunks.push({
  id: `g${num}-overview`,
  text: overviewText,
  pages: { from: pages.from, to: pages.to },
  themes: unitThemes,
  positionKeys: openingKeys,
  moveRange: { fromPly: 0, toPly: Math.min(17, replayed.moves.length) }
 });

 const MAX_CHUNK_CHARS = 950;
 let group = [];
 let groupLen = 0;

 function flushGroup(idx) {
  if (!group.length) return;
  const fromPage = Math.min(...group.map((a) => a.bookPage || pages.from || 1));
  const toPage = Math.max(...group.map((a) => a.bookPage || pages.to || fromPage));
  const cThemes = Array.from(new Set(group.flatMap((a) => a.themes))).sort();
  const keySet = new Set();
  for (const a of group) {
   keySet.add(a.positionKey);
   if (a.afterPly > 0) keySet.add(posKey(replayed.fens[a.afterPly - 1]));
   if (a.afterPly + 1 < replayed.fens.length) keySet.add(posKey(replayed.fens[a.afterPly + 1]));
   for (const v of a.variations) {
    for (const f of v.fens) keySet.add(posKey(f));
    if (v.subvariations) {
     for (const sv of v.subvariations) {
      for (const f of sv.fens) keySet.add(posKey(f));
     }
    }
   }
  }
  const lines = group.map((a) => {
   const prefix = a.moveLabel ? `${a.moveLabel}${a.nag || ''}` : `After ply ${a.afterPly}`;
   const vars = a.variations.length
    ? ` Variations: ${a.variations.map(formatVariationInline).join('; ')}`
    : '';
   return `[${prefix}, p. ${a.bookPage}] ${a.summary}${vars}`;
  });
  chunks.push({
   id: `g${num}-c${idx}`,
   text: `${header}\n${lines.join('\n')}`,
   pages: { from: fromPage, to: toPage },
   themes: cThemes.length ? cThemes : unitThemes,
   positionKeys: Array.from(keySet),
   moveRange: {
    fromPly: group[0].afterPly,
    toPly: group[group.length - 1].afterPly
   }
  });
  group = [];
  groupLen = 0;
 }

 let chunkIdx = 1;
 for (const a of annotations) {
  const est = (a.summary?.length || 0) + (a.variations?.length || 0) * 80 + 40;
  if (group.length > 0 && groupLen + est > MAX_CHUNK_CHARS) {
   flushGroup(chunkIdx++);
  }
  group.push(a);
  groupLen += est;
 }
 flushGroup(chunkIdx);
 return chunks;
}

function loadBatches(sourceDir = SOURCE_DIR, batchFilter = null) {
 if (!fs.existsSync(sourceDir)) {
  throw new Error(`Source directory not found: ${sourceDir}`);
 }
 const files = fs
  .readdirSync(sourceDir)
  .filter((f) => BATCH_PATTERN.test(f))
  .sort();
 if (!files.length) {
  throw new Error(`No batch-*.json files found in ${sourceDir}`);
 }
 const selected = batchFilter
  ? files.filter((f) => {
     const num = Number(f.match(BATCH_PATTERN)[1]);
     return Array.isArray(batchFilter) ? batchFilter.includes(num) : num === Number(batchFilter);
    })
  : files;
 return selected.map((f) => ({
  file: f,
  data: JSON.parse(fs.readFileSync(path.join(sourceDir, f), 'utf8'))
 }));
}

function validateAndBuild({ sourceDir = SOURCE_DIR, requireComplete = true, batchFilter = null } = {}) {
 const metaPath = path.join(sourceDir, 'metadata.json');
 if (!fs.existsSync(metaPath)) {
  throw new Error(`metadata.json not found in ${sourceDir}`);
 }
 const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
 const batches = loadBatches(sourceDir, batchFilter);
 const stats = {
  pdfPagesProcessed: 0,
  games: 0,
  mainlineMoves: 0,
  variations: 0,
  variationMoves: 0,
  diagrams: 0,
  annotations: 0,
  totalGeneratedFens: 0,
  generatedFensSet: new Set(),
  errata: []
 };

 const allPdfPages = new Set();
 const rawGames = [];
 for (const b of batches) {
  for (const p of b.data.pdfPagesCovered || []) allPdfPages.add(String(p));
  for (const g of b.data.games || []) rawGames.push(g);
 }
 rawGames.sort((a, b) => a.gameNumber - b.gameNumber);

 if (requireComplete) {
  if (rawGames.length !== 100) {
   throw new Error(`Expected 100 games in complete Alekhine dataset, found ${rawGames.length}`);
  }
  for (let i = 0; i < 100; i++) {
   if (rawGames[i].gameNumber !== i + 1) {
    throw new Error(`Missing or out-of-order game at index ${i}: expected ${i + 1}, got ${rawGames[i].gameNumber}`);
   }
  }
 }

 const units = rawGames.map((g) => {
  const unit = buildGameUnit(g, stats);
  stats.games += 1;
  return unit;
 });

 stats.pdfPagesProcessed = meta.totalPdfPages || allPdfPages.size;
 const uniqueGeneratedFens = stats.generatedFensSet.size;
 const totalErrata = Array.isArray(meta.frontMatterErrata)
  ? [...meta.frontMatterErrata, ...stats.errata]
  : stats.errata;

 return {
  schemaVersion: 1,
  bookId: meta.bookId,
  title: meta.title,
  author: meta.author,
  firstPublished: meta.firstPublished,
  sourceEdition: meta.sourceEdition,
  rights: meta.rights,
  stats: {
   pdfPagesProcessed: stats.pdfPagesProcessed,
   games: stats.games,
   mainlineMoves: stats.mainlineMoves,
   variations: stats.variations,
   variationMoves: stats.variationMoves,
   totalValidatedMoves: stats.mainlineMoves + stats.variationMoves,
   diagrams: stats.diagrams,
   annotations: stats.annotations,
   totalGeneratedFens: stats.totalGeneratedFens,
   uniqueGeneratedFens,
   errataCount: totalErrata.length
  },
  errata: totalErrata,
  frontMatter: meta.frontMatter || null,
  units
 };
}

function build() {
 return validateAndBuild({ requireComplete: true });
}

if (require.main === module) {
 const batchArgIdx = process.argv.indexOf('--batch');
 const batchNum = batchArgIdx >= 0 ? Number(process.argv[batchArgIdx + 1]) : null;
 const res = batchNum
  ? validateAndBuild({ requireComplete: false, batchFilter: batchNum })
  : validateAndBuild({ requireComplete: true });
 console.log(
  JSON.stringify(
   {
    ok: true,
    scope: batchNum ? `batch-${String(batchNum).padStart(2, '0')}` : 'complete-book',
    stats: res.stats,
    errata: res.errata
   },
   null,
   2
  )
 );
}

module.exports = { build, validateAndBuild, buildGameUnit, posKey, cleanMoveToken };
