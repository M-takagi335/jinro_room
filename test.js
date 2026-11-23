'use strict';
const assert = require('node:assert/strict');
const { createGame, infer, truth, adjacent, canSolve } = require('./game.js');

const layouts = infer([]);
assert.equal(layouts.length, 15);
assert.equal(new Set(layouts.map(pair => pair.join(','))).size, 15);
const speech = new Set();
const outcomes = new Set();
let matches = 0;

for (const [index, wolves] of layouts.entries()) {
  for (let seed = 1; seed <= 80; seed++) {
    let stream = seed;
    function random() {
      stream = (Math.imul(stream, 1664525) + 1013904223) >>> 0;
      return stream / 2 ** 32;
    }
    let first = true;
    const game = createGame(() => {
      if (!first) return random();
      first = false;
      return (index + 0.5) / layouts.length;
    });
    assert.deepEqual([game.view().wolves, game.view().villagers], [2, 4]);
    let turns = 0;
    while (game.view().phase === 'day') {
      const start = game.view();
      assert.ok(++turns <= 3);
      assert.equal(start.remaining, 2);
      assert.ok(canSolve(start.candidates, start.alive, 2));
      assert.equal(start.events.filter(e => e.kind === 'testimony' && e.day === start.day).length, start.alive.length);
      assert.ok(!game.advanceNight());
      const inspected = [];
      let target;
      if (seed % 2 === 0) {
        // Choose a room using public information only.
        while (true) {
          const state = game.view();
          target = state.alive.find(room => state.candidates.every(pair => pair.includes(room)));
          if (target) break;
          assert.ok(state.remaining);
          const probe = state.alive.find(room => {
            if (inspected.includes(room)) return false;
            const groups = Map.groupBy(state.candidates, pair =>
              adjacent(room).filter(other => state.alive.includes(other) && pair.includes(other)).length);
            return groups.size > 1 && [...groups.values()].every(group =>
              canSolve(group, state.alive, state.remaining - 1, [...inspected, room]));
          });
          assert.ok(probe);
          assert.ok(game.investigate(probe));
          assert.ok(!game.investigate(probe));
          inspected.push(probe);
        }
      } else {
        for (const room of start.alive.slice(0, 2)) assert.ok(game.investigate(room));
        assert.ok(!game.investigate(start.alive[2]));
        target = start.alive[Math.floor(random() * start.alive.length)];
      }
      assert.ok(!game.seal(99));
      assert.ok(game.seal(target));
      const sealed = game.view();
      assert.ok(!game.seal(target));
      assert.ok(!game.investigate(target));
      assert.equal(sealed.villagers, start.villagers - Number(!wolves.includes(target)));
      assert.equal(sealed.wolves, start.wolves - Number(wolves.includes(target)));
      if (sealed.phase === 'night') {
        assert.ok(!game.seal(sealed.alive[0]));
        assert.ok(game.advanceNight());
        const next = game.view();
        const attacks = next.events.slice(sealed.events.length).filter(e => e.cause === 'attacked');
        assert.equal(attacks.length, 1);
        assert.ok(sealed.alive.includes(attacks[0].room) && !wolves.includes(attacks[0].room));
        assert.equal(next.villagers, sealed.villagers - 1);
        assert.equal(next.wolves, sealed.wolves);
        assert.ok(!game.advanceNight());
      }
    }

    const end = game.view();
    outcomes.add(end.phase);
    if (seed % 2 === 0) assert.equal(end.phase, 'won');
    if (end.phase === 'won') assert.equal(end.wolves, 0);
    else assert.ok(end.wolves > 0 && end.villagers <= end.wolves);
    assert.equal(end.events.filter(e => e.kind === 'reveal').length, 6);
    for (const event of end.events) {
      if (event.kind === 'reveal') {
        assert.equal(event.role, wolves.includes(event.room) ? '人狼' : '村人');
      }
      if (event.kind === 'investigation') {
        const expected = adjacent(event.room).filter(room => wolves.includes(room) && event.alive.includes(room)).length;
        assert.equal(event.claim.value, expected);
      }
      if (event.kind === 'testimony') {
        assert.ok(event.alive.includes(event.speaker));
        if (event.claim.kind === 'count') {
          assert.ok(event.claim.value <= Math.min(2, event.claim.targets.length));
        }
        const isTrue = truth(event.claim, wolves, event.alive);
        if (wolves.includes(event.speaker)) speech.add(isTrue);
        else assert.ok(isTrue);
      }
    }
    for (let n = 0; n <= end.events.length; n++) {
      assert.ok(infer(end.events.slice(0, n)).some(pair => pair.join() === wolves.join()));
    }
    for (const room of [1, 2, 3, 4, 5, 6]) {
      assert.ok(!game.investigate(room));
      assert.ok(!game.seal(room));
    }
    assert.ok(!game.advanceNight());
    assert.deepEqual(game.view(), end);
    matches++;
  }
}

assert.deepEqual(speech, new Set([true, false]));
assert.deepEqual(outcomes, new Set(['won', 'lost']));
const previous = createGame(() => 0);
assert.ok(previous.seal(1));
assert.ok(previous.advanceNight());
assert.ok(previous.seal(2));
assert.equal(previous.view().phase, 'won');
const retry = createGame(() => 0.999).view();
assert.equal(retry.day, 1);
assert.equal(retry.phase, 'day');
assert.deepEqual([retry.villagers, retry.wolves, retry.remaining], [4, 2, 2]);
assert.ok(retry.events.every(event => event.kind === 'testimony'));
assert.ok(retry.candidates.some(pair => pair.join() === '5,6'));
assert.notDeepEqual(retry.candidates, previous.view().candidates);
console.log(`${matches} matches passed across ${layouts.length} layouts; ${matches / 2} public-information solver wins.`);
