'use strict';
const assert = require('node:assert/strict');
const { createGame, chooseMove, neighbors, exhibits } = require('./game.js');

function finishDays(game) {
  while (game.view().phase === 'investigation') assert.ok(game.endDay());
  assert.equal(game.view().day, 5);
}

function roomFrom(text) {
  return Number(text.match(/(10[1-6])号室[。へ]/g).at(-1).slice(0, 3));
}

function secure(game, room) {
  const adjacent = neighbors(room);
  assert.ok(game.place('capture', room));
  assert.ok(game.place('capture', adjacent[0]));
  if (adjacent.length === 2) assert.ok(game.place('block', room));
  assert.ok(game.place('monitor', Math.min(room, adjacent[0])));
  assert.ok(game.execute());
  const { result } = game.view();
  assert.equal(result.start, room);
  assert.ok(result.caught);
  assert.equal(result.identity, 105);
  assert.ok([room, adjacent[0]].includes(result.end));
  assert.equal(result.monitored, result.moved);
  assert.ok(!game.execute());
  assert.ok(!game.place('capture', room));
  assert.ok(!game.endDay());
  assert.ok(!game.enter(room));
  assert.ok(!game.expire());
  if (result.moved) {
    assert.ok(game.view().traces.some(trace => trace.from === room && trace.night === 5));
  }
  return result;
}

const game = createGame();
assert.deepEqual(game.view().rooms.map(room => room.number), [101, 102, 103, 104, 105, 106]);
for (const room of [101, 102, 103, 104, 105]) assert.ok(game.enter(room));
assert.equal(game.view().points, 0);
assert.ok(!game.enter(106));
assert.ok(game.enter(102));
for (const [key] of exhibits) assert.ok(game.observe(key));
assert.equal(game.view().notebook.length, 0);
assert.equal(game.search('desk'), null);
assert.equal(game.question(), null);
assert.ok(game.note(102, '仮説'));
assert.ok(game.endDay());
assert.equal(game.view().points, 5);
assert.ok(game.enter(106));
assert.equal(game.view().points, 4);
assert.equal(game.verify(), null);
assert.ok(game.question());
assert.equal(game.question(), null);
assert.equal(game.view().points, 3);
assert.equal(game.view().hypotheses[102], '仮説');
assert.equal(game.view().notebook.find(entry => entry.category === '住人の証言').day, 2);
assert.equal(game.view().result, null);
for (const hidden of ['hideout', 'identity', 'alert', 'roomAlert']) assert.ok(!(hidden in game.view()));
finishDays(game);
assert.ok(game.expire());
assert.equal(game.view().result.caught, false);
assert.match(game.view().result.reason, /期限/);
assert.equal(game.view().result.statements[0].honest, true);

const context = { hideout: 103, visits: {}, searches: {}, roomAlert: {}, blocked: null, visibleCaptures: [] };
const movement = (alert, changes = {}) => chooseMove({ ...context, ...changes, alert });
assert.equal(movement(49), 103);
assert.equal(movement(50), 103);
assert.equal(movement(50, { visits: { 103: 1 } }), 102);
assert.equal(movement(79, { visits: { 102: 3, 104: 2 } }), 103);
assert.equal(movement(80, { visits: { 102: 3, 104: 2 } }), 104);
assert.equal(movement(80, { hideout: 101, blocked: 101 }), 101);
assert.equal(movement(80, { blocked: 102 }), 104);
assert.equal(movement(80, { visibleCaptures: [102] }), 104);
assert.equal(movement(80, { searches: { 102: 1 } }), 104);
assert.equal(movement(80, { roomAlert: { 102: 30 } }), 104);
assert.equal(movement(80, { notebook: ['private'], hypotheses: { 104: 'private' } }), 102);

const quiet = createGame();
assert.ok(quiet.enter(103));
assert.ok(quiet.question());
assert.ok(quiet.search('clock')); // 10 + 15 + 20 = 45
assert.ok(quiet.endDay());
assert.deepEqual(quiet.view().traces, []);

const trail = createGame();
assert.ok(trail.enter(103));
assert.ok(trail.search('desk')); // 10 + 20 + 20 = 50
assert.ok(trail.endDay());
const [trace] = trail.view().traces;
assert.equal(trace.from, 103);
assert.equal(trace.night, 1);
assert.equal(trace.to, undefined);
assert.deepEqual(trail.view().mornings, [103]);
assert.equal(trail.examineTrace(trace.id), null);
assert.ok(trail.enter(102));
assert.ok(trail.question());
assert.ok(trail.view().notebook.some(entry => entry.category === '目撃情報'));
assert.ok(trail.endDay());
assert.ok(trail.enter(103));
const clue = trail.examineTrace(trace.id);
assert.equal(roomFrom(clue), 102);
assert.equal(trail.examineTrace(trace.id), null);
assert.ok(trail.view().notebook.some(entry => entry.day === 3 && entry.key === 'trace-0'));
finishDays(trail);
assert.ok(!secure(trail, roomFrom(clue)).moved);

const operation = createGame();
for (let day = 1; day <= 4; day++) assert.ok(operation.endDay());
assert.ok(operation.enter(103));
assert.ok(operation.search('desk'));
assert.ok(operation.search('closet'));
assert.ok(operation.endDay());
assert.ok(operation.place('capture', 103));
assert.ok(operation.place('capture', 104));
assert.ok(!operation.place('capture', 102));
assert.ok(operation.place('block', 102));
assert.ok(!operation.place('monitor', 102));
assert.ok(operation.place('monitor', 103));
assert.ok(!operation.place('block', 106));
assert.ok(operation.execute());
assert.deepEqual(
  [operation.view().result.caught, operation.view().result.start, operation.view().result.end, operation.view().result.monitored],
  [true, 103, 104, true]
);

const failure = createGame();
finishDays(failure);
assert.ok(failure.place('capture', 106));
assert.ok(failure.execute());
assert.equal(failure.view().result.caught, false);
const retry = createGame();
assert.deepEqual([retry.view().day, retry.view().points, retry.view().phase, retry.view().notebook.length], [1, 5, 'investigation', 0]);

let routeWins = 0;
let movements = 0;
const traceLabels = new Set();
for (let seed = 1; seed <= 800; seed++) {
  let stream = seed;
  const random = max => {
    stream = (Math.imul(stream, 1664525) + 1013904223) >>> 0;
    return Math.floor(stream / 2 ** 32 * max);
  };
  const match = createGame();
  for (let day = 1; day < 5; day++) {
    let { traces } = match.view();
    const seen = traces.length;
    assert.equal(match.view().points, 5);
    const focus = 101 + random(6);
    for (let step = 0; step < 8; step++) {
      if (random(4) === 0 || !match.view().current) match.enter(step === 0 ? focus : 101 + random(6));
      else if (random(4) === 0) match.question();
      else match.search(exhibits[random(exhibits.length)][0]);
      assert.ok(match.view().points >= 0);
    }
    assert.ok(match.endDay());
    ({ traces } = match.view());
    assert.ok(traces.length === seen || traces.length === seen + 1);
    if (traces.length > seen) {
      const latest = traces.at(-1);
      assert.equal(latest.night, day);
      assert.deepEqual(match.view().mornings, [latest.from]);
      assert.ok(match.view().notebook.some(entry => entry.category === '夜間の変化' && entry.day === day + 1 && entry.room === latest.from));
      traceLabels.add(latest.label);
      movements++;
    }
  }
  const variant = seed % 2;
  let hideout;
  if (variant === 0) {
    // Independent acoustic route remains affordable after any of the first four days.
    if (!match.view().hasAudio) {
      assert.ok(match.enter(103));
      assert.ok(match.search('desk'));
    }
    assert.ok(match.enter(106));
    hideout = roomFrom(match.verify());
  } else {
    const traces = match.view().traces;
    const latest = traces.at(-1);
    if (latest) {
      assert.ok(match.enter(latest.from));
      hideout = roomFrom(match.examineTrace(latest.id));
      assert.ok(neighbors(latest.from).includes(hideout));
    } else {
      assert.ok(match.enter(103));
      assert.ok(match.search('closet'));
      hideout = 103;
    }
  }
  assert.ok(match.endDay());
  secure(match, hideout);
  routeWins++;
}
assert.ok(movements > 0);
assert.ok(traceLabels.size >= 2);

const relentless = createGame();
for (const room of [103, 102, 101, 102]) {
  assert.ok(relentless.enter(room));
  for (const item of ['clock', 'shoes', 'window']) assert.ok(relentless.search(item));
  assert.ok(relentless.question()); // 85 alert forces an adjacent move.
  assert.ok(relentless.endDay());
  assert.equal(relentless.view().traces.at(-1).from, room);
}
assert.equal(new Set(relentless.view().traces.map(trace => trace.label)).size, 4);
console.log(`Core scenarios passed; ${routeWins} seeded investigations won using two evidence routes (${movements} overnight trace events).`);
