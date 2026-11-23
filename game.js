(() => {
  'use strict';
  const roles = ['村人', '占い師', '狩人', '記録係', '人狼'];
  const seats = ['村人', '村人', ...roles.slice(1)];
  const people = [
    { id: 'you', name: 'あなた' },
    { id: 'ren', name: '蓮', description: '濡れた手袋を外し、燭台に目を向ける。' },
    { id: 'mio', name: '澪', description: '長椅子の端に座り、窓の方を気にしている。' },
    { id: 'so', name: '奏', description: '戸口にもたれ、廊下の物音に耳を澄ませている。' },
    { id: 'towa', name: '十和', description: '膝の上で革表紙の帳面を開く。' },
    { id: 'yui', name: '結', description: 'ランタンを置き、両手を膝の上で重ねる。' }
  ];
  const order = people.slice(1);
  const name = id => people.find(person => person.id === id)?.name;
  const bell = '三つ目の鐘';
  const locations = { you: '北の礼拝堂', ren: '中庭', mio: '中庭', so: '礼拝堂の戸口', towa: '中庭', yui: '北の礼拝堂' };
  const guard = { target: 'you', event: '外廊下で板がきしんだ。戸口を越える者はいなかった。', seen: null };
  const ledger = { target: 'ren', place: locations.ren, action: '雨戸を閉めていた' };
  const sightings = {
    mio: { target: 'ren', place: locations.ren, action: '雨戸に手をかけていた' },
    yui: { target: 'you', place: locations.you, action: '火の消えたランタンを持っていた' }
  };
  const rules = [
    '役職の内訳は村人2人、占い師・狩人・記録係・人狼が各1人。あなたもこの6人に含まれます。',
    '人狼以外は知っている事実と自分の役職を正直に話します。人狼は真実も嘘も話せます。',
    '昨夜の三つ目の鐘は一度だけ鳴りました。その瞬間、同じ人物が離れた二つの場所にいることはできません。',
    '役職の確認は無料です。ほかの質問は全員で8回まで。一度会話を終えた相手には戻れません。'
  ];
  const common = [
    ['night', '昨夜は何をしていましたか？'],
    ['about', '私について何か知っていますか？'],
    ['suspect', '誰が怪しいと思いますか？']
  ];
  const specialties = {
    村人: [['seen', '昨夜、誰を見ましたか？'], ['where', 'どこで見ましたか？'],
      ['doing', 'その人は何をしていましたか？'], ['seenMe', '私を見かけましたか？']],
    占い師: [['divined', '誰を占いましたか？'], ['reading', '占い結果は何でしたか？'],
      ['divinedMe', '私を占いましたか？'], ['ritual', '占いの状況を詳しく教えてください。']],
    狩人: [['guarded', '誰を守りましたか？'], ['incident', '護衛中に何か起きましたか？'],
      ['guardSeen', '誰かを見かけましたか？'], ['guardedMe', '私を守りましたか？']],
    記録係: [['logged', '誰の行動を記録しましたか？'], ['logWhere', 'その人物はどこにいましたか？'],
      ['logMe', '私の行動記録はありますか？'], ['compare', '誰かの証言と記録が食い違っていますか？']],
    人狼: []
  };
  const claimQuestion = ['claim', 'あなたの役職は何ですか？'];
  const position = (person, place) => ({ kind: 'place', person, place, time: bell });
  const roleFact = (person, role) => ({ kind: 'role', person, role });
  const say = (text, ...facts) => ({ text, facts });
  const unknown = () => say('それについては知りません。');
  const at = (id, place) => say(bell + 'が鳴った時、' + name(id) + 'は' + place + 'にいました。', position(id, place));

  const cases = [
    {
      id: 'storm', title: '雨戸の証言', hint: '鐘が鳴った瞬間の居場所を照合する。',
      actual: { you: '占い師', ren: '人狼', mio: '村人', so: '狩人', towa: '記録係', yui: '村人' },
      assumed: { ren: '占い師' }, reader: 'you', reading: 'ren', forgedReading: true,
      conclusion: '残るNPCは村人2人、狩人1人、記録係1人。空いているのは占い師だけ。'
    },
    {
      id: 'seal', title: '銀の封印', hint: '館の検査記録と、昨夜の占いを照合する。',
      actual: { you: '人狼', ren: '占い師', mio: '村人', so: '狩人', towa: '記録係', yui: '村人' },
      assumed: {}, reader: 'ren', reading: 'you',
      verified: { person: 'ren', text: '公開検査記録 · 銀の封印を通過した蓮は人狼ではありません。この判定は確実です。' }
    },
    {
      id: 'guard', title: '閉ざされた戸口', hint: '護衛の話と、同じ時刻の目撃を照合する。',
      actual: { you: '狩人', ren: '人狼', mio: '村人', so: '占い師', towa: '記録係', yui: '村人' },
      assumed: { ren: '狩人' }, reader: 'so', reading: 'yui',
      conclusion: '残るNPCは村人2人、占い師1人、記録係1人。空いているのは狩人だけ。'
    }
  ];
  const catalog = cases.map(({ id, title, hint }) => ({ id, title, hint }));
  const falsePlace = '西の書斎';

  function answer(scenario, id, question, history) {
    const { actual, assumed, reader, reading, forgedReading } = scenario;
    const liar = actual[id] === '人狼';
    const sight = sightings[id];
    const divination = liar && forgedReading
      ? { target: 'you', role: '人狼', place: falsePlace }
      : { target: reading, role: actual[reading], place: locations[reader] };
    const protectedPerson = liar ? 'mio' : guard.target;
    switch (question) {
      case 'claim': {
        const role = assumed[id] || actual[id];
        return say('私は' + role + 'です。', roleFact(id, role));
      }
      case 'night':
        return liar
          ? say(bell + 'が鳴った時は、' + falsePlace + 'にいました。', position(id, falsePlace))
          : say(bell + 'の時は、' + locations[id] + 'にいました。', position(id, locations[id]));
      case 'about':
        if (id === 'ren') return say('今朝、暖炉のそばで目を覚ましたのを見ました。');
        if (actual[id] === '狩人') return say('昨夜、あなたのそばにいました。護衛の依頼があったので。');
        if (sight?.target === 'you') return at('you', sight.place);
        return unknown();
      case 'suspect':
        return say('私の見聞きしたことだけでは、誰が怪しいかは判断できません。');
      case 'seen':
        return say(name(sight.target) + 'を見ました。' + bell + 'が鳴った時です。');
      case 'where':
        return at(sight.target, sight.place);
      case 'doing':
        return say(name(sight.target) + 'が' + sight.action + 'のを見ました。', position(sight.target, sight.place));
      case 'seenMe':
        return sight.target === 'you' ? at('you', sight.place) : say('私が覚えている目撃に、あなたは含まれていません。');
      case 'divined':
        return say('占ったのは' + name(divination.target) + 'です。');
      case 'reading':
        return say('水盤に映った役職は、' + name(divination.target) + 'が' + divination.role + '。', roleFact(divination.target, divination.role));
      case 'divinedMe':
        return say(divination.target === 'you' ? 'ええ。昨夜はあなたを占いました。' : 'いいえ。昨夜は別の人を占いました。');
      case 'ritual':
        return say(bell + 'が鳴った瞬間に、' + divination.place + 'で水盤をのぞきました。', position(id, divination.place));
      case 'guarded':
        return say('護衛したのは' + name(protectedPerson) + 'です。');
      case 'incident':
        return liar ? say(bell + 'の時は、西の書斎の戸口にいました。', position(id, falsePlace)) : say(guard.event);
      case 'guardSeen':
        return guard.seen ? say(guard.seen) : say('顔を確認できた人はいません。');
      case 'guardedMe':
        return say(protectedPerson === 'you' ? 'はい。昨夜、あなたを護衛しました。' : 'いいえ。昨夜は別の人を護衛しました。');
      case 'logged':
        return say('帳面に記したのは' + name(ledger.target) + 'です。' + bell + 'の時に' + ledger.action + '。');
      case 'logWhere':
        return at(ledger.target, ledger.place);
      case 'logMe':
        return say('昨夜の帳面に、あなたの行動は記されていません。');
      case 'compare': {
        const differs = history.some(entry => entry.facts.some(fact => fact.kind === 'place' &&
          fact.person === ledger.target && fact.time === bell && fact.place !== ledger.place));
        const entry = at(ledger.target, ledger.place);
        return differs ? say('今聞かせてもらった話とは食い違います。' + entry.text, ...entry.facts) : entry;
      }
      default:
        return unknown();
    }
  }

  function enumerate(ids, remaining, layout = {}) {
    if (!ids.length) return [layout];
    return [...new Set(remaining)].flatMap(role => {
      const rest = [...remaining];
      rest.splice(rest.indexOf(role), 1);
      return enumerate(ids.slice(1), rest, { ...layout, [ids[0]]: role });
    });
  }
  const layouts = enumerate(people.map(person => person.id), seats);

  function infer(entries) {
    return layouts.filter(layout => {
      const positions = new Map();
      for (const entry of entries) {
        if (layout[entry.speaker] === '人狼') continue;
        for (const fact of entry.facts) {
          if (fact.kind === 'notWolf' && layout[fact.person] === '人狼') return false;
          if (fact.kind === 'role' && layout[fact.person] !== fact.role) return false;
          if (fact.kind === 'place') {
            const key = fact.time + ':' + fact.person;
            if (positions.has(key) && positions.get(key) !== fact.place) return false;
            positions.set(key, fact.place);
          }
        }
      }
      return true;
    }).map(layout => ({ ...layout }));
  }

  function createGame(caseId = 'storm') {
    const scenario = cases.find(entry => entry.id === caseId) || cases[0];
    const { actual, verified } = scenario;
    const publicEvidence = verified ? [{ facts: [{ kind: 'notWolf', person: verified.person }] }] : [];
    let index = 0;
    let remaining = 8;
    let phase = 'conversation';
    let result = null;
    const transcript = [];
    const claims = {};
    const notes = {};

    function available() {
      if (phase !== 'conversation') return [];
      const id = order[index].id;
      if (!claims[id]) return [claimQuestion];
      const asked = new Set(transcript.filter(entry => entry.speaker === id).map(entry => entry.id));
      return [...common, ...specialties[claims[id]]].filter(([question]) => !asked.has(question));
    }

    return {
      view() {
        const possible = infer([...publicEvidence, ...transcript]);
        const candidates = Object.fromEntries(people.map(({ id }) =>
          [id, roles.filter(role => possible.some(layout => layout[id] === role))]));
        return JSON.parse(JSON.stringify({
          phase, caseId: scenario.id, caseTitle: scenario.title, publicRecord: verified?.text, index, current: phase === 'conversation' ? order[index] : null, rules, people, roles,
          remaining, claims, notes, transcript, candidates, layouts: possible.length, result,
          questions: available().map(([id, text]) => ({ id, text, cost: Number(id !== 'claim') }))
        }));
      },
      ask(question) {
        const option = available().find(([id]) => id === question);
        if (!option || (question !== 'claim' && remaining === 0)) return false;
        const speaker = order[index].id;
        const reply = answer(scenario, speaker, question, transcript);
        if (question === 'claim') claims[speaker] = reply.facts[0].role;
        else remaining--;
        transcript.push({ speaker, id: question, question: option[1], ...reply });
        return true;
      },
      next() {
        if (phase !== 'conversation' || !claims[order[index].id]) return false;
        index++;
        if (index === order.length) phase = 'verdict';
        return true;
      },
      note(id, role) {
        if (phase === 'result' || !people.some(person => person.id === id) || (role !== '' && !roles.includes(role))) return false;
        notes[id] = role;
        return true;
      },
      submit(self, guesses = {}) {
        if (phase !== 'verdict' || !roles.includes(self)) return false;
        const optional = order.filter(person => roles.includes(guesses[person.id]));
        const wolf = people.find(person => actual[person.id] === '人狼');
        const lies = [];
        if (wolf.id !== 'you') {
          lies.push(
            { questions: '役職確認', text: wolf.name + 'は' + scenario.assumed[wolf.id] + 'を名乗った。実際には人狼。', ids: ['claim'] },
            { questions: '昨夜の行動', text: '西の書斎にいたと話したが、鐘の時は中庭にいた。', ids: ['night', 'ritual', 'incident'] }
          );
          if (scenario.forgedReading) lies.push({
            questions: '占いの対象・結果', text: 'あなたを占い、人狼と出たと話したが、蓮は誰も占っていない。',
            ids: ['divined', 'reading', 'divinedMe']
          });
          else lies.push({
            questions: '護衛対象', text: '澪を護衛したという偽の申告。蓮は護衛をしていない。', ids: ['guarded', 'guardedMe']
          });
        }
        const knowledge = {
          you: '鐘の時は北の礼拝堂にいた。目覚めた時には役職の記憶を失っていた。',
          ren: '鐘の時は中庭で雨戸を閉めていた。今朝あなたが目覚めるところを見た。',
          mio: '鐘の時に中庭で蓮が雨戸に手をかけるのを見た。',
          so: '鐘の時は礼拝堂の戸口にいた。',
          towa: '鐘の時に蓮が中庭で雨戸を閉めたことを帳面に記録した。',
          yui: '鐘の時に北の礼拝堂であなたが火の消えたランタンを持っているのを見た。'
        };
        knowledge[scenario.reader] += name(scenario.reading) + 'を占い、' + actual[scenario.reading] + 'と出た。';
        const hunter = people.find(person => actual[person.id] === '狩人').id;
        knowledge[hunter] += (hunter === 'you' ? '澪' : 'あなた') + 'を護衛していた。' + guard.event;
        const explanation = verified ? [
          '公開検査記録で、蓮が人狼ではないと確定している。',
          '蓮は占い師を名乗り、占い結果ではあなたが人狼だったと答える。人狼以外は知っていることを正直に話す。',
          'したがって、この事件でのあなたの役職は人狼。'
        ] : [
          '蓮に「昨夜の行動」を聞く。蓮は三つ目の鐘の時に西の書斎にいたと言う。',
          '澪には「どこで見ましたか？」、十和には「その人物はどこにいましたか？」を聞く。二人とも同じ鐘の時に蓮が中庭にいたと答える。',
          '蓮が正直なら、澪と十和の両方が嘘をついたことになる。人狼は一人なので、蓮が人狼。',
          scenario.conclusion
        ];
        result = {
          won: self === actual.you, self, roles: actual,
          lies: lies.map(lie => ({ ...lie, heard: transcript.some(entry => entry.speaker === wolf.id && lie.ids.includes(entry.id)) })),
          answered: optional.length, score: optional.filter(person => guesses[person.id] === actual[person.id]).length,
          events: '三つ目の鐘が鳴った時、あなたは北の礼拝堂、蓮は中庭にいた。今朝、蓮は暖炉のそばであなたが目を覚ますのを見た。',
          knowledge, explanation
        };
        phase = 'result';
        return true;
      }
    };
  }

  const api = { createGame, infer, catalog };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else globalThis.Mansion = api;
})();
