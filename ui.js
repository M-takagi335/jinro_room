(() => {
  'use strict';
  const app = document.querySelector('#app');
  const announcement = document.querySelector('#announcement');
  let game;
  let notice = '';
  let showPairs = false;
  const captions = { sealed: '封鎖', attacked: '襲撃', end: '試合終了時の公開' };

  function start() {
    game = Mansion.createGame();
    notice = '';
    showPairs = false;
    render();
    app.querySelector('h1').focus();
  }

  function eventText(event) {
    if (event.kind === 'reveal') return captions[event.cause] + ' · ' + event.room + '号室（' + event.role + '）';
    if (event.kind === 'skipped') return '襲撃なし · ' + event.reason;
    if (event.kind === 'investigation') return event.room + '号室を調査 · 隣接する生存人狼 ' + event.claim.value + '体';
    return event.speaker + '号室「' + Mansion.describe(event.claim) + '」';
  }

  function roomCard(room, state) {
    const report = state.events.find(event => event.kind === 'testimony' && event.day === state.day && event.speaker === room);
    const evidence = state.events.findLast(event => event.kind === 'investigation' && event.room === room);
    const reveal = state.events.find(event => event.kind === 'reveal' && event.room === room);
    const active = state.phase === 'day' && state.alive.includes(room);
    return `<article class="room ${reveal ? 'revealed' : ''}">
      <h3>${room}<small>号室</small></h3>
      <div class="portrait" aria-hidden="true"><span></span></div>
      <p class="identity">${reveal ? reveal.role + (reveal.cause === 'end' ? '' : ' · ' + captions[reveal.cause]) : '正体不明'}</p>
      <p class="speech">${report ? '「' + Mansion.describe(report.claim) + '」' : '—'}</p>
      <div class="reading">${evidence ? '<strong>' + evidence.claim.value + '</strong><span>隣接する生存人狼<br>' + evidence.day + '日目の調査</span>' : '調査結果なし'}</div>
      <div class="actions">
        <button data-action="investigate" data-room="${room}" aria-label="${room}号室を調査" ${!active || !state.remaining || evidence?.day === state.day ? 'disabled' : ''}>調査</button>
        <button class="danger" data-action="seal" data-room="${room}" aria-label="${room}号室を封鎖" ${!active ? 'disabled' : ''}>封鎖</button>
      </div>
    </article>`;
  }

  function render() {
    if (!game) {
      app.innerHTML = `<section class="cover">
        <div class="crest" aria-hidden="true">◇</div>
        <h1>人狼の館</h1>
        <p class="tagline">証言は嘘をつく。しかし、数字は嘘をつかない。</p>
        <p>6つの部屋に潜む2体の人狼を探し出せ。<br>住人の証言と隣室の調査結果が、あなたの手がかりになる。</p>
        <button data-action="start" class="primary">調査を始める</button>
      </section>`;
      return;
    }
    const state = game.view();
    const night = state.phase === 'night';
    const ended = ['won', 'lost'].includes(state.phase);
    const phase = night ? '夜' : ended ? '終幕' : '昼';
    const detailsOpen = app.querySelector('#history')?.open ?? false;
    app.innerHTML = `
      <header class="top"><h1 tabindex="-1">人狼の館</h1><span>${state.day}日目 <b>· ${phase}</b></span></header>
      <div class="stats"><span>生存村人 <b>${state.villagers}</b></span><span>生存人狼 <b>${state.wolves}</b></span><span>残り調査 <b>${night || ended ? '—' : state.remaining + ' / 2'}</b></span></div>
      ${ended ? `<section class="scene ${state.phase}"><h2>${state.phase === 'won' ? '勝利' : '敗北'}</h2>
        <p>${notice} ${state.phase === 'won' ? 'すべての人狼を封鎖しました。' : '生存村人が生存人狼以下になりました。'}</p>
        <button data-action="start" class="primary">もう一度遊ぶ</button></section>` :
        night ? `<section class="scene night"><h2>夜が訪れた</h2><p>${notice} 館の灯りが消え、人狼が動き出す。</p>
          <button data-action="night" class="primary">襲撃の結果を見る</button></section>` : ''}
      <section aria-labelledby="rooms-title">
        <div class="section-heading"><h2 id="rooms-title" tabindex="-1">館の六室</h2><p>${!ended && !night && notice ? notice : '調査で分かるのは、選んだ部屋の左右にいる生存人狼の合計です。'}</p></div>
        <div class="corridor" tabindex="0" aria-label="部屋一覧。狭い画面では横にスクロールできます。">
          <div class="rooms">${Array.from({ length: 6 }, (_, i) => roomCard(i + 1, state)).join('')}</div>
        </div>
        <p class="mobile-note">横にスクロールして全室を見る</p>
      </section>
      <section class="ledger">
        <button data-action="pairs" aria-expanded="${showPairs}">${showPairs ? '推理候補を隠す' : '推理候補を見る'}</button>
        ${showPairs ? '<div class="pairs"><p>公開された証言と調査結果に合う、開始時の人狼配置は ' + state.candidates.length + ' 通りです。</p><ul>' +
          state.candidates.map(pair => '<li>' + pair.join('・') + '号室</li>').join('') + '</ul></div>' : ''}
        <details id="history" ${detailsOpen ? 'open' : ''}><summary>調査・証言・公開の履歴</summary>
          ${Array.from({ length: state.day }, (_, i) => state.day - i).map(day =>
            '<h3>' + day + '日目</h3><ul>' + state.events.filter(event => event.day === day)
              .map(event => '<li>' + eventText(event) + '</li>').join('') + '</ul>').join('')}
        </details>
      </section>`;
  }

  app.addEventListener('click', event => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const { action, room: number } = button.dataset;
    if (action === 'start') { start(); return; }
    const room = Number(number);
    const previousScroll = app.querySelector('.corridor').scrollLeft;
    if (action === 'pairs') showPairs = !showPairs;
    if (action === 'investigate' && game.investigate(room)) {
      notice = eventText(game.view().events.at(-1));
    }
    if (action === 'seal') {
      if (!window.confirm(room + '号室を封鎖しますか？ 封鎖は1日1回です。')) return;
      if (game.seal(room)) notice = eventText(game.view().events.findLast(e => e.cause === 'sealed'));
    }
    if (action === 'night') {
      const before = game.view().events.length;
      if (game.advanceNight()) {
        const result = game.view().events.slice(before).find(e => e.cause === 'attacked' || e.kind === 'skipped');
        if (result) notice = eventText(result);
      }
    }
    render();
    app.querySelector('.corridor').scrollLeft = previousScroll;
    const target = action === 'pairs' ? app.querySelector('[data-action="pairs"]')
      : app.querySelector('.scene button') || (action === 'investigate'
        ? app.querySelector('[data-action="seal"][data-room="' + room + '"]')
        : app.querySelector('#rooms-title'));
    target?.focus({ preventScroll: true });
    if (action !== 'pairs') announcement.textContent = notice;
  });
  render();
})();
