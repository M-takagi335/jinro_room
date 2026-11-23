(() => {
  'use strict';

  const residents = [
    ['相沢 澪', '夜勤の看護師', '窓辺の椅子で夜明けを待っていた。', '明け方まで起きていた。廊下はよく響くわ。', true],
    ['三崎 律', '会社員', '夜中に会社の書類を裁断した。', '夜中は寝ていました。紙の音なんて知りません。', false],
    ['佐伯 灯', '大学生', '廊下の環境音を課題用に録音した。', '最初の夜、私のドアの向こうで重い足音を録音したよ。', true],
    ['野上 駿', '配達員', '夜間配達の副業で外出した。', '夜中ずっと部屋にいたよ。', false],
    ['倉橋 燈子', '古書店員', '獣化後に103号室へ潜んだ。古書店の帳簿は机に置いた。', '帳簿なら机にあります。真夜中に103号室へは行っていません。', false],
    ['久世 透', '無職の青年', '管理用の音響受信機を修理した。', '受信機を直したよ。録音の照合には佐伯さんの音源が要る。', true]
  ];
  const rooms = residents.map(([name, job], index) => ({ number: 101 + index, name, job }));
  const identity = 105;
  const initialHideout = 103;
  const roomExists = number => rooms.some(room => room.number === number);
  const neighbors = number => [number - 1, number + 1].filter(roomExists);
  const passage = (a, b) => Math.min(a, b);
  const exhibits = [
    ['desk', '机'], ['shelf', '本棚'], ['bed', 'ベッド'], ['closet', 'クローゼット'],
    ['bin', 'ゴミ箱'], ['shoes', '靴'], ['clock', '時計'], ['window', '窓']
  ];
  const unique = {
    101: { window: '窓枠に夜勤明けのシフト票が挟まっている。', bed: '夜勤用の仮眠記録。足音を聞いた時刻と一致する。' },
    102: { bin: '裁断された取引書類。三崎は深夜も起きていた。' },
    103: { desk: '最初の夜の録音。103号室内で、二重に響く足音が途切れている。', closet: '床板の下に古い寝床。最初の夜に獣が103号室に潜んでいた。' },
    104: { shoes: '配達靴の底に深夜の配達票。野上の在室証言と矛盾する。' },
    105: { desk: '帳簿に倉橋の筆跡で「獣化したら103の床下へ」とある。変身した住人と最初の潜伏先が分かる。', closet: '古着の内側に獣毛。修繕札には倉橋の名前がある。' },
    106: { shelf: '久世が修理した受信機の作業記録。最初の録音と照合すると二重の足音を識別できる。' }
  };
  const traceTypes = [
    ['泥の足跡', '泥の爪先が'], ['扉の爪痕', '扉に残った削りくずが'],
    ['落ちた獣毛', '敷居に絡んだ毛の列が'], ['ずれた家具', '家具の擦過痕が']
  ];

  // The NPC receives only its own observations and publicly visible barriers.
  function chooseMove({ hideout, alert, visits, searches, roomAlert, blocked, visibleCaptures }) {
    if (alert < 50) return hideout;
    const risk = room => (visits[room] || 0) * 3 + (searches[room] || 0) * 5
      + (roomAlert[room] || 0) / 10 + (visibleCaptures.includes(room) ? 100 : 0);
    const choices = neighbors(hideout).filter(room => passage(room, hideout) !== blocked)
      .sort((a, b) => risk(a) - risk(b) || a - b);
    if (!choices.length || (alert < 80 && risk(choices[0]) >= risk(hideout))) return hideout;
    return choices[0];
  }

  function createGame() {
    let day = 1;
    let points = 5;
    let phase = 'investigation';
    let current = null;
    let hideout = initialHideout;
    let alert = 0;
    let result = null;
    let entered = new Set();
    let mornings = [];
    const visits = {};
    const searches = {};
    const roomAlert = {};
    const observed = {};
    const explored = {};
    const notebook = [];
    const traces = [];
    const hypotheses = {};
    const facts = new Set();
    const traps = { capture: [], block: null, monitor: null };

    function record(category, room, text, key) {
      notebook.push({ day, category, room, text, key });
      return text;
    }

    function spend(amount) {
      if (phase !== 'investigation' || points < amount || !current) return false;
      points -= amount;
      return true;
    }

    function raise(amount) {
      if (current !== hideout) return;
      alert = Math.min(100, alert + amount);
      roomAlert[current] = Math.min(100, (roomAlert[current] || 0) + amount);
    }

    function investigate(key, cost, action) {
      const id = day + ':' + current + ':' + key;
      if (explored[id] || !spend(cost)) return null;
      const message = action();
      explored[id] = true;
      return message;
    }

    function reviewStatements() {
      return rooms.filter(room => notebook.some(entry => entry.category === '住人の証言' && entry.room === room.number))
        .map(({ number }) => {
          const [, , fact, , honest] = residents[number - 101];
          return { number, fact, honest };
        });
    }

    function move(nextDay, blocked = null, visibleCaptures = []) {
      const from = hideout;
      hideout = chooseMove({ hideout, alert, visits, searches, roomAlert, blocked, visibleCaptures });
      if (from === hideout) return null;
      const index = traces.length % traceTypes.length;
      const [label] = traceTypes[index];
      const trace = { id: traces.length, night: day, available: nextDay, from, to: hideout, label, index };
      traces.push(trace);
      return trace;
    }

    return {
      view() {
        return JSON.parse(JSON.stringify({
          day, points, phase, current, rooms, entered: [...entered], observed, explored, notebook,
          hypotheses, mornings, traps, result, hasAudio: facts.has('audio'),
          traces: traces.filter(trace => trace.available <= day).map(({ id, night, from, label }) => ({ id, night, from, label }))
        }));
      },
      enter(room) {
        if (phase !== 'investigation' || !roomExists(room)) return false;
        if (!entered.has(room)) {
          if (points < 1) return false;
          points--;
          entered.add(room);
          visits[room] = (visits[room] || 0) + 1;
          current = room;
          raise(10);
          observed[room] = day;
        }
        current = room;
        return true;
      },
      leave() { current = null; },
      observe(item) {
        if (phase !== 'investigation' || !current || !exhibits.some(([key]) => key === item)) return null;
        const hints = {
          desk: '天板には埃。引き出しは閉まっている。', shelf: '背表紙が少しずれている。',
          bed: '掛け布団は整えてある。', closet: '扉に取っ手がある。中はここから見えない。',
          bin: '紙くずが入っている。', shoes: '玄関に靴が揃えてある。',
          clock: '秒針が廊下の音に重なる。', window: 'ガラスが外気で曇っている。'
        };
        return hints[item];
      },
      search(item) {
        if (!exhibits.some(([key]) => key === item)) return null;
        return investigate(item, 1, () => {
          searches[current] = (searches[current] || 0) + 1;
          raise(20);
          const clue = unique[current]?.[item];
          if (clue) {
            if (current === 103 && item === 'desk') facts.add('audio');
            if ((current === 103 && ['desk', 'closet'].includes(item)) || (current === 105 && item === 'desk')) raise(20);
          }
          return record(clue ? '物的証拠' : '調査記録', current, clue || '詳しく確認したが、事件に結びつく痕跡は見つからない。', item);
        });
      },
      question() {
        return investigate('question', 1, () => {
          raise(15);
          const witness = traces.findLast(trace => trace.available === day && neighbors(current).includes(trace.from));
          const [, , , statement] = residents[current - 101];
          record('住人の証言', current, statement, 'question');
          if (witness) return record('目撃情報', current, '昨夜、' + witness.from + '号室の扉の前から足音がした。誰だったかまでは分からない。');
          return statement;
        });
      },
      examineTrace(id) {
        const trace = traces.find(entry => entry.id === id && entry.from === current && entry.available <= day);
        if (!trace || notebook.some(entry => entry.key === 'trace-' + id)) return null;
        return investigate('trace-' + id, 1, () => {
          searches[current] = (searches[current] || 0) + 1;
          raise(20);
          raise(20);
          return record('逃走痕・確定', current, trace.night + '日目の夜、' + trace.from + '号室から ' + trace.to +
            '号室へ。' + traceTypes[trace.index][1] + 'その方向に続いている。', 'trace-' + id);
        });
      },
      verify() {
        if (current !== 106 || !facts.has('audio')) return null;
        return investigate('verify', 2, () => {
          raise(20);
          raise(20);
          return record('検証・確定', current, '音源照合の結果、' + day + '日目の昼の潜伏先は ' + hideout + '号室。', 'verify');
        });
      },
      note(room, text) {
        if (!roomExists(room) || typeof text !== 'string' || phase === 'ended') return false;
        hypotheses[room] = text.slice(0, 300);
        return true;
      },
      endDay() {
        if (phase !== 'investigation') return false;
        current = null;
        if (day === 5) {
          phase = 'placement';
          return true;
        }
        const trace = move(day + 1);
        day++;
        points = 5;
        entered = new Set();
        alert = trace ? 0 : Math.max(0, alert - 15);
        mornings = trace ? [trace.from] : [];
        if (trace) record('夜間の変化', trace.from, trace.night + '日目の夜、' + trace.from + '号室の入口に「' +
          trace.label + '」。逃走元は判明。行き先は現地で詳しく調べられる。');
        else record('夜間の変化', null, '昨夜、逃走痕の新たな発生はなかった。');
        return true;
      },
      place(type, target) {
        if (phase !== 'placement') return false;
        if (type === 'capture' && roomExists(target)) {
          const index = traps.capture.indexOf(target);
          if (index >= 0) traps.capture.splice(index, 1);
          else if (traps.capture.length < 2) traps.capture.push(target);
          else return false;
          return true;
        }
        if ((type !== 'block' && type !== 'monitor') || !roomExists(target) || target === 106) return false;
        const other = type === 'block' ? 'monitor' : 'block';
        if (target === traps[other]) return false;
        traps[type] = traps[type] === target ? null : target;
        return true;
      },
      execute() {
        if (phase !== 'placement') return false;
        const start = hideout;
        // A loop in a room visited repeatedly by the player is conspicuous to a wolf hiding there.
        const visible = traps.capture.filter(room => room === start && (visits[room] || 0) >= 2);
        const approachAlert = Math.min(100, alert + 35 + (visible.length ? 25 : 0));
        alert = approachAlert;
        const trace = move(day, traps.block, visible);
        if (trace) record('逃走痕・確定', trace.from, '作戦中、' + trace.from + '号室から ' + trace.to + '号室へ。' + trace.label + 'を確認。');
        const caught = traps.capture.includes(hideout);
        result = {
          caught, identity, start, end: hideout, moved: Boolean(trace), statements: reviewStatements(),
          monitored: traps.monitor === null ? null : Boolean(trace && passage(trace.from, trace.to) === traps.monitor),
          reason: caught ? '潜伏先に仕掛けた捕獲罠が作動した。' :
            traps.capture.length ? '人狼は捕獲罠に接触せず、作戦時間が終了した。' : '捕獲罠が用意されないまま、作戦時間が終了した。'
        };
        phase = 'ended';
        return true;
      },
      expire() {
        if (phase !== 'placement') return false;
        result = {
          caught: false, identity, start: hideout, end: hideout, moved: false,
          monitored: null, reason: '期限までに捕獲作戦を実行しなかった。',
          statements: reviewStatements()
        };
        phase = 'ended';
        return true;
      }
    };
  }

  const api = { createGame, chooseMove, exhibits, neighbors };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else globalThis.Mansion = api;
})();
