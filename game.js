(() => {
  'use strict';
  const rooms = [1, 2, 3, 4, 5, 6];
  const layouts = rooms.flatMap(a => rooms.filter(b => b > a).map(b => [a, b]));
  const adjacent = room => rooms.filter(other => Math.abs(other - room) === 1);
  const count = (wolves, alive, targets) =>
    targets.filter(room => alive.includes(room) && wolves.includes(room)).length;
  const role = (wolves, room) => wolves.includes(room) ? '人狼' : '村人';
  const truth = (claim, wolves, alive) => claim.kind === 'role'
    ? role(wolves, claim.room) === claim.value
    : count(wolves, alive, claim.targets) === claim.value;

  function infer(events) {
    return layouts.filter(wolves => events.every(event => {
      if (event.kind === 'reveal') return role(wolves, event.room) === event.role;
      if (event.kind === 'testimony' && wolves.includes(event.speaker)) return true;
      return truth(event.claim, wolves, event.alive);
    })).map(pair => [...pair]);
  }

  function canSolve(candidates, alive, budget, searched = []) {
    if (!candidates.length) return false;
    if (alive.some(room => candidates.every(pair => pair.includes(room)))) return true;
    if (!budget) return false;
    return alive.filter(room => !searched.includes(room)).some(room => {
      const targets = adjacent(room);
      const groups = [[], [], []];
      for (const pair of candidates) groups[count(pair, alive, targets)].push(pair);
      const nonempty = groups.filter(group => group.length);
      return nonempty.length > 1 && nonempty.every(group => canSolve(group, alive, budget - 1, [...searched, room]));
    });
  }

  function options(speaker) {
    const roles = rooms.filter(room => room !== speaker).flatMap(room =>
      ['人狼', '村人'].map(value => ({ kind: 'role', room, value })));
    const groups = [adjacent(speaker), [1, 2, 3], [2, 3, 4], [3, 4, 5], [4, 5, 6]];
    return [...roles, ...groups.flatMap((targets, index) =>
      Array.from({ length: Math.min(2, targets.length) + 1 }, (_, value) =>
        ({ kind: 'count', targets, value, neighbor: index === 0 })))];
  }

  function createGame(random = Math.random) {
    const pick = values => values[Math.floor(random() * values.length)];
    const wolves = pick(layouts);
    let alive = [...rooms];
    let day = 0;
    let phase;
    let remaining;
    const events = [];
    const villagers = () => alive.filter(room => !wolves.includes(room));
    const livingWolves = () => alive.filter(room => wolves.includes(room));
    const order = values => values.map(value => ({ value, roll: random() }))
      .sort((a, b) => a.roll - b.roll).map(entry => entry.value);

    function beginDay() {
      day++;
      phase = 'day';
      remaining = 2;
      const speakers = order(alive);
      const lying = new Set(livingWolves().filter(() => random() < 0.65));
      function build(fallback = false) {
        const batch = [];
        const liveWolves = order(livingWolves());
        let villagerIndex = 0;
        for (const speaker of speakers) {
          const isWolf = wolves.includes(speaker);
          const candidates = options(speaker).filter(claim =>
            truth(claim, wolves, alive) !== lying.has(speaker));
          let claim;
          if (fallback && !isWolf) {
            claim = { kind: 'role', room: liveWolves[villagerIndex++ % liveWolves.length], value: '人狼' };
          } else if (isWolf) {
            const publicPairs = infer(events);
            const ranked = order(candidates).map(candidate => {
              const plausible = publicPairs.filter(pair =>
                (!lying.has(speaker) || !pair.includes(speaker)) && truth(candidate, pair, alive)).length;
              const misdirect = candidate.kind === 'role' && alive.includes(candidate.room)
                && !truth(candidate, wolves, alive) ? 2 : 0;
              return { candidate, score: plausible + misdirect };
            }).sort((a, b) => b.score - a.score);
            claim = ranked[0].candidate;
          } else {
            claim = pick(candidates);
          }
          batch.push({ kind: 'testimony', day, speaker, claim, alive });
        }
        return batch;
      }
      for (let attempt = 0; attempt < 24; attempt++) {
        const batch = build();
        if (canSolve(infer([...events, ...batch]), alive, remaining)) {
          events.push(...batch);
          return;
        }
      }
      // Give each living wolf multiple truthful accusers if randomized clues leave ambiguity.
      events.push(...build(true));
    }

    function finish() {
      if (!livingWolves().length) phase = 'won';
      else if (villagers().length <= livingWolves().length) phase = 'lost';
      else return false;
      for (const room of alive) reveal(room, 'end');
      return true;
    }

    function reveal(room, cause) {
      events.push({ kind: 'reveal', day, room, role: role(wolves, room), cause });
      if (cause !== 'end') alive = alive.filter(other => other !== room);
    }

    const canAct = room => phase === 'day' && alive.includes(room);
    beginDay();
    return Object.freeze({
      view() {
        return JSON.parse(JSON.stringify({
          day, phase, remaining, alive, villagers: villagers().length,
          wolves: livingWolves().length, events, candidates: infer(events)
        }));
      },
      investigate(room) {
        if (!canAct(room) || !remaining ||
          events.some(event => event.kind === 'investigation' && event.day === day && event.room === room)) return false;
        const targets = adjacent(room);
        events.push({ kind: 'investigation', day, room, alive,
          claim: { kind: 'count', targets, value: count(wolves, alive, targets) } });
        remaining--;
        return true;
      },
      seal(room) {
        if (!canAct(room)) return false;
        reveal(room, 'sealed');
        if (!finish()) phase = 'night';
        return true;
      },
      advanceNight() {
        if (phase !== 'night') return false;
        if (livingWolves().length && villagers().length) {
          const ranked = order(villagers()).map(room => ({
            room, score: infer(events.filter(event =>
              !(event.kind === 'testimony' && event.speaker === room && event.day === day))).length
          })).sort((a, b) => b.score - a.score);
          reveal(ranked[0].room, 'attacked');
        } else {
          events.push({ kind: 'skipped', day, reason: livingWolves().length ? '生存村人がいません' : '生存人狼がいません' });
        }
        if (!finish()) beginDay();
        return true;
      }
    });
  }

  function describe(claim) {
    if (claim.kind === 'role') return claim.room + '号室の元の役職は' + claim.value + 'です。';
    const location = claim.neighbor ? '私の隣' :
      claim.targets[0] + '〜' + claim.targets.at(-1) + '号室';
    return location + 'に生存人狼が' + claim.value + '体います。';
  }

  const api = { createGame, infer, truth, adjacent, canSolve, describe };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else globalThis.Mansion = api;
})();
