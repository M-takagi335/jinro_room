'use strict';
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const { createGame, infer } = require('./game.js');

const expected = { you: '占い師', ren: '人狼', mio: '村人', so: '狩人', towa: '記録係', yui: '村人' };
const opening = createGame().view();
assert.equal(opening.phase, 'conversation');
assert.equal(opening.remaining, 8);
assert.equal(opening.layouts, 360);
assert.equal(opening.result, null);
assert.deepEqual(opening.candidates.you, opening.roles);
assert.deepEqual(Object.keys(opening.current), ['id', 'name', 'description']);
assert.deepEqual(opening.questions.map(q => [q.id, q.cost]), [['claim', 0]]);
assert.deepEqual(opening.claims, {});

function runRoute(useQuestions, notes = null) {
  const game = createGame();
  for (const id of ['ren', 'mio', 'so', 'towa', 'yui']) {
    assert.equal(game.view().current.id, id);
    assert.ok(!game.next());
    assert.ok(!game.ask('ritual'));
    assert.ok(game.ask('claim'));
    assert.ok(!game.ask('claim'));
    if (notes) assert.ok(game.note(id, notes));
    for (const question of useQuestions[id] || []) {
      assert.ok(game.ask(question));
      assert.ok(!game.ask(question));
    }
    assert.ok(game.next());
  }
  return game;
}

const claimsOnly = runRoute({});
assert.equal(claimsOnly.view().remaining, 8);
assert.equal(claimsOnly.view().layouts, 6);
assert.deepEqual(claimsOnly.view().candidates.you, opening.roles);
assert.equal(claimsOnly.view().claims.ren, '占い師');
assert.equal(claimsOnly.view().result, null);
assert.ok(!claimsOnly.next());
assert.ok(!claimsOnly.ask('claim'));
assert.ok(!claimsOnly.submit(''));
assert.ok(claimsOnly.submit('狩人', { ren: '人狼', mio: '狩人' }));
assert.equal(claimsOnly.view().result.won, false);
assert.equal(claimsOnly.view().result.score, 1);
assert.equal(claimsOnly.view().result.answered, 2);
assert.ok(!claimsOnly.submit('占い師'));
assert.ok(!claimsOnly.note('ren', '占い師'));

const route = { ren: ['ritual'], mio: ['where'], towa: ['logWhere'] };
const solved = runRoute(route);
const evidence = solved.view().transcript;
assert.deepEqual(evidence.map(e => e.speaker), ['ren', 'ren', 'mio', 'mio', 'so', 'towa', 'towa', 'yui']);
assert.equal(solved.view().remaining, 5);
assert.deepEqual(infer(evidence), [expected]);
assert.deepEqual(solved.view().candidates.you, ['占い師']);
assert.deepEqual(runRoute(route, '人狼').view().transcript, evidence);

// Independently enumerate placements and apply only public constraints.
const alternatives = infer([]);
assert.equal(new Set(alternatives.map(layout => JSON.stringify(layout))).size, 360);
const independent = alternatives.filter(layout => {
  const claims = solved.view().claims;
  if (Object.entries(claims).some(([id, role]) => layout[id] !== '人狼' && layout[id] !== role)) return false;
  return layout.ren === '人狼' || (layout.mio === '人狼' && layout.towa === '人狼');
});
assert.deepEqual(independent, [expected]);
for (const id of ['ritual', 'where', 'logWhere']) {
  assert.ok(new Set(infer(evidence.filter(e => e.id !== id)).map(layout => layout.you)).size > 1);
}
assert.deepEqual(runRoute({ ren: ['night'], mio: ['doing'], towa: ['compare'] }).view().candidates.you, ['占い師']);
assert.ok(solved.submit('占い師', expected));
const answer = solved.view().result;
assert.equal(answer.won, true);
assert.equal(answer.score, 5);
assert.deepEqual(answer.roles, expected);
assert.equal(answer.lies.filter(lie => lie.heard).length, 2);
assert.match(answer.knowledge.you, /蓮を占い、人狼/);
assert.match(answer.explanation.at(-1), /占い師/);

const wolf = createGame();
assert.ok(wolf.ask('claim'));
assert.ok(wolf.view().questions.some(q => q.id === 'divined'));
for (const question of ['night', 'about', 'suspect', 'divined', 'reading', 'divinedMe', 'ritual']) assert.ok(wolf.ask(question));
assert.equal(wolf.view().remaining, 1);
assert.match(wolf.view().transcript.find(e => e.id === 'reading').text, /あなたが人狼/);
assert.match(wolf.view().transcript.find(e => e.id === 'about').text, /暖炉/);
assert.ok(wolf.next());
assert.ok(wolf.ask('claim'));
assert.ok(!wolf.view().questions.some(q => q.id === 'reading'));
assert.ok(wolf.view().questions.some(q => q.id === 'seen'));
assert.ok(wolf.ask('about'));
assert.match(wolf.view().transcript.at(-1).text, /知りません/);
assert.equal(wolf.view().remaining, 0);
assert.ok(!wolf.ask('where'));
assert.ok(wolf.next());
assert.ok(wolf.ask('claim'));
assert.ok(wolf.view().questions.some(q => q.id === 'guarded'));
assert.ok(wolf.next());
assert.ok(wolf.ask('claim'));
assert.ok(wolf.view().questions.some(q => q.id === 'logged'));

for (const [id, place, subject] of [['mio', '中庭', 'ren'], ['yui', '北の礼拝堂', 'you'], ['towa', '中庭', 'ren']]) {
  const questions = id === 'towa' ? ['night', 'about', 'suspect', 'logged', 'logWhere', 'logMe', 'compare'] :
    ['night', 'about', 'suspect', 'seen', 'where', 'doing', 'seenMe'];
  const review = runRoute({ [id]: questions }).view();
  const entries = review.transcript.filter(e => e.speaker === id && e.id !== 'claim');
  assert.ok(entries.some(e => e.facts.some(f => f.person === subject && f.place === place)));
  assert.ok(entries.every(e => e.facts.every(f => f.kind !== 'role')));
  assert.ok(infer(review.transcript).some(layout => JSON.stringify(layout) === JSON.stringify(expected)));
}
const guard = runRoute({ so: ['guarded', 'incident', 'guardSeen', 'guardedMe'] }).view().transcript;
assert.match(guard.find(e => e.id === 'guarded').text, /あなた/);
assert.match(guard.find(e => e.id === 'guardSeen').text, /確認できた人はいません/);
assert.deepEqual(createGame().view(), opening);

// Exercise the standalone UI event wiring without opening or previewing HTML.
const html = readFileSync(join(__dirname, 'standalone.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const handlers = {};
const stub = { focus() {} };
const app = { innerHTML: '', querySelector: () => stub, addEventListener(event, fn) { handlers[event] = fn; } };
vm.runInNewContext(script, { document: { querySelector: () => app } });
function click(act, value = '') {
  assert.ok(app.innerHTML.includes('data-act="' + act + '" data-value="' + value + '"'));
  handlers.click({ target: { closest: () => ({ dataset: { act, value } }) } });
}
click('intro');
click('start');
for (const id of ['ren', 'mio', 'so', 'towa', 'yui']) {
  click('ask', 'claim');
  for (const question of route[id] || []) click('ask', question);
  click('next');
}
click('note');
assert.match(app.innerHTML, /役職候補 · 占い師/);
click('note');
handlers.submit({ preventDefault() {}, target: {
  id: 'verdict', querySelectorAll: () => [{ dataset: { id: 'you' }, value: '占い師' }]
} });
assert.match(app.innerHTML, /正解 · 記憶/);
click('explanation');
assert.match(app.innerHTML, /事件の解説/);
click('retry');
assert.match(app.innerHTML, /1 \/ 5人目/);
console.log('Passed: 360 alternative layouts, unique 3-question solution, NPC knowledge and budget, verdicts, retry, standalone UI wiring.');
