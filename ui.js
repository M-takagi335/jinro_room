(() => {
  'use strict';
  const app = document.querySelector('#app');
  let game;
  let screen = 'hall';
  let selected = '';
  let feedback = '';
  let trapMode = 'capture';

  const art = {
    desk: '<path fill="#68483f" d="M8 25h104v14H8zM15 40h10v46H15zm81 0h10v46H96z"/><path fill="#a87352" d="M9 24l20-13h68l16 13zM28 41h66v20H28z"/><path d="M55 50h16" stroke="#efd29b" stroke-width="3"/><path fill="#aeb99d" d="M48 19l8-6 22 1-7 7z"/>',
    shelf: '<path fill="#6c493d" d="M17 3h86v91H17z"/><path fill="#242b33" d="M24 11h72v24H24zm0 31h72v22H24zm0 29h72v15H24z"/><path stroke-width="7" stroke="#ad735f" d="M33 13v21m37 10v18M51 73v12"/><path stroke-width="7" stroke="#86a29b" d="M46 17v17m36 8v21m-16 9v14"/><path stroke-width="7" stroke="#c5a778" d="M58 12v22M40 43v20m37 9v14"/>',
    bed: '<path fill="#68483f" d="M9 18h13v73H9zm88 35h13v38H97zM21 60h77v19H21z"/><path fill="#b29c91" d="M20 43h78l12 15H20z"/><path fill="#b8bbaa" d="M22 36h26v13H22z"/><path fill="#685d70" d="M48 40h48l14 18v13H50z"/><path stroke="#aca0ac" d="M60 47h41m-39 6h43"/>',
    closet: '<path fill="#704e47" d="M16 4h88v88H16z"/><path fill="#513a3d" d="M22 11h36v74H22zm40 0h36v74H62z"/><path stroke="#aa7460" fill="none" d="M26 16h27v62H26zm41 0h26v62H67z"/><path stroke="#e2c387" stroke-width="4" d="M51 42v12m18-12v12"/>',
    bin: '<path fill="#526269" d="M35 31h50l-7 52H42z"/><path stroke="#8dafaa" stroke-width="4" d="M32 34h56m-40 7 5 34m8-34v35m11-34-4 33"/><path fill="#c4b49a" d="M43 29l8-8 10 5 8-12 13 7-5 9z"/>',
    shoes: '<path fill="#614b49" d="M7 69l13-5 9-20 12 4 1 12 13 9v12H7zm53 0 14-5 9-20 12 4 1 12 14 9v12H60z"/><path stroke="#b68b77" stroke-width="3" d="M7 80h48m5 0h50M29 55h12m40 0h13"/>',
    clock: '<circle cx="60" cy="47" r="36" fill="#a77254"/><circle cx="60" cy="47" r="29" fill="#d0bc91"/><path d="M60 25v22l13 8M60 19v5m0 46v5M32 47h5m46 0h5" stroke="#493b42" stroke-width="3" fill="none"/>',
    window: '<path fill="#6a4e4c" d="M12 5h96v85H12z"/><path fill="#263955" d="M20 13h80v69H20z"/><circle cx="76" cy="32" r="13" fill="#d6cbb0"/><path fill="#172733" d="M20 72l20-18 20 14 13-20 27 20v14H20z"/><path stroke="#80635d" stroke-width="5" d="M60 12v70M20 48h80"/>',
    trace: '<path fill="#d8ac70" d="M33 78c-14-7-6-22 2-30s18-3 13 10-5 23-15 20zm39-27c-12-7-5-21 4-29 9-7 18 1 11 12s-7 22-15 17z"/><path stroke="#d8ac70" stroke-width="4" d="M31 43l3-9m9 7 4-9m25-14 3-9m8 8 5-8"/>' 
  };
  const edge = number => number + '–' + (number + 1);
  const labels = { capture: '捕獲罠', block: '封鎖罠', monitor: '監視罠' };
  const safe = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const action = (key, label, value = '', disabled = false, cls = '') =>
    `<button type="button" class="${cls}" data-action="${key}" data-value="${value}" ${disabled ? 'disabled' : ''}>${label}</button>`;

  function hall(state, placement = false) {
    const status = room => {
      if (placement) return state.traps.capture.includes(room) ? '捕獲罠あり' : '空き';
      const count = state.notebook.filter(entry => entry.room === room).length;
      return state.mornings.includes(room) ? '入口に変化' : count ? '記録 ' + count + '件'
        : state.observed[room] ? '入室済み' : '未調査';
    };
    const doors = state.rooms.map(({ number, name }) => `<div class="door-bay">
      ${action(placement ? 'trapRoom' : 'enter', '<strong>' + number + '</strong><span class="knob"></span>', number,
        placement ? trapMode !== 'capture' : state.points < 1 && !state.entered.includes(number), 'door')}
      <span class="bay-label">${placement ? '' : name + ' · '}${status(number)}</span></div>`);
    return `<div class="hall-scroll" tabindex="0" aria-label="マンションの廊下。狭い画面では横にスクロールできます。"><div class="hall">
      <div class="doors">${doors.join('')}</div>${placement ? `<div class="passages">${state.rooms.slice(0, -1).map(({ number }) =>
      action('trapEdge', edge(number) + '<br>' + (state.traps.block === number ? '封鎖' : state.traps.monitor === number ? '監視' : '通路'),
        number, trapMode === 'capture', 'edge')).join('')}</div>` : ''}</div></div>`;
  }

  function interior(state) {
    const resident = state.rooms.find(room => room.number === state.current);
    const changes = state.traces.filter(trace => trace.from === state.current);
    const icon = key => '<svg viewBox="0 0 120 96" aria-hidden="true">' + art[key] + '</svg>';
    const selectedTrace = changes.find(trace => 'trace-' + trace.id === selected);
    const label = Mansion.exhibits.find(([key]) => key === selected)?.[1] || selectedTrace?.label;
    const inspected = state.explored[state.day + ':' + state.current + ':' + selected] ||
      selectedTrace && state.notebook.some(note => note.key === selected);
    return `<div class="room-header"><h2>${resident.number}号室</h2>${action('hall', '廊下へ')}</div>
      <div class="room-scene" aria-label="${resident.number}号室の室内">
        ${Mansion.exhibits.map(([key, name]) => action('observe', icon(key) + '<span>' + name + '</span>', key,
        false, 'prop prop-' + key + (key === selected ? ' selected' : ''))).join('')}
        ${changes.length ? '<div class="traces">' + changes.map(trace => action('trace',
          icon('trace') + '<span>' + trace.night + '日目の痕</span>', trace.id, false, 'trace')).join('') + '</div>' : ''}
      </div>
      <div class="inspection">
        <section><h3>${label || '家具を選ぶ'}</h3>
          ${label ? action('search', '詳しく調べる · 1', selected, inspected || state.points < 1) : ''}
          ${resident.number === 106 ? action('verify', '受信機で音源を照合 · 2', '', !state.hasAudio || state.points < 2 ||
            state.explored[state.day + ':106:verify']) : ''}
          ${resident.number === 106 && !state.hasAudio ? '<p>照合には事件初夜の録音が必要です。</p>' : ''}
        </section>
        <section><h3>${resident.name} <small>${resident.job}</small></h3>
          ${action('question', '聞き込み · 1', '', state.points < 1 || state.explored[state.day + ':' + state.current + ':question'])}
        </section>
      </div>`;
  }

  function notebook(state) {
    const sections = ['検証・確定', '逃走痕・確定', '物的証拠', '住人の証言', '目撃情報', '夜間の変化', '調査記録'];
    return `<h2>推理ノート</h2><p class="muted">証言と目撃情報には未確認の内容が含まれます。日付は記録日です。</p>
      <div class="notebook">${sections.map(group => {
        const entries = state.notebook.filter(entry => entry.category === group);
        return entries.length ? `<section><h3>${group}</h3><ol>${entries.map(entry =>
          `<li><strong>${entry.day}日目${entry.room ? ' · ' + entry.room + '号室' : ''}</strong> ${safe(entry.text)}</li>`).join('')}</ol></section>` : '';
      }).join('')}
      <section><h3>部屋別メモ・未確認の仮説</h3><div class="memos">${state.rooms.map(room =>
        `<label>${room.number}号室<textarea data-note="${room.number}" rows="2" maxlength="300" ${state.phase === 'ended' ? 'disabled' : ''}>${safe(state.hypotheses[room.number] || '')}</textarea></label>`).join('')}</div></section></div>`;
  }

  function placement(state) {
    return `<h2>捕獲作戦</h2><p class="muted">捕獲罠は潜伏中の部屋と逃げ込み先を押さえる。封鎖で片側の通路を閉じれば、移動先を絞れます。</p>
      <div class="toolbar">${Object.entries(labels).map(([key, label]) => action('mode', label + ' ' +
        (key === 'capture' ? state.traps.capture.length + '/2' : state.traps[key] === null ? '0/1' : '1/1'),
        key, false, key === trapMode ? 'active' : '')).join('')}</div>
      ${hall(state, true)}
      <div class="toolbar">${action('execute', '作戦を実行する', '', false, 'primary')}${action('expire', '作戦を見送る')}</div>`;
  }

  function ending(state) {
    const result = state.result;
    const culprit = state.rooms.find(room => room.number === result.identity);
    return `<section class="result ${result.caught ? 'caught' : 'escaped'}">
      <h2>${result.caught ? '捕獲成功' : '捕獲失敗'}</h2><p>${result.reason}</p>
      <p>人狼の正体は ${culprit.number}号室の${culprit.name}。</p>
      <p>${result.moved ? result.start + '号室から' + result.end + '号室へ逃走。' : result.end + '号室に留まった。'}</p>
      ${result.monitored === null ? '' : '<p>監視罠 · ' + (result.monitored ? '通過を記録した。' : '通過記録なし。') + '</p>'}
      ${result.statements.length ? '<details><summary>住人の証言の答え合わせ</summary><ul>' +
        result.statements.map(entry => '<li>' + entry.number + '号室 · ' + (entry.honest ? '真実' : '一部または全体が虚偽') +
          ' · ' + safe(entry.fact) + '</li>').join('') + '</ul></details>' : ''}
      ${action('start', '事件を調べ直す', '', false, 'primary')}</section>`;
  }

  function render(focus) {
    const scroll = app.querySelector('.hall-scroll')?.scrollLeft;
    if (!game) {
      app.innerHTML = `<section class="cover"><div class="moon" aria-hidden="true"></div>
        <h1>人狼の館</h1><p>管理人からの依頼。六室のどこかに潜む人狼を、五日目の夜までに捕らえよ。</p>
        ${action('start', '調査を始める', '', false, 'primary')}</section>`;
      return;
    }
    const state = game.view();
    const inRoom = Boolean(state.current);
    const phase = { investigation: '探索', placement: '罠配置', ended: '終幕' }[state.phase];
    app.innerHTML = `<header><h1>人狼の館</h1><div class="status"><span>${state.day} / 5 日目 · ${phase}</span>
      ${state.phase === 'investigation' ? '<span>行動力 <b>' + state.points + ' / 5</b></span>' : ''}</div>
      ${action('notebook', screen === 'note' ? '調査画面へ戻る' : '推理ノート')}</header>
      ${screen === 'note' ? notebook(state) : state.phase === 'placement' ? placement(state) :
        state.phase === 'ended' ? ending(state) : inRoom ? interior(state) : `<h2>マンションの廊下</h2>
        <p class="muted">ドアを選んで入室。初回は行動力1、同じ日の再入室は無料です。</p>${hall(state)}`}
      ${screen === 'note' ? '' : '<p class="feedback" role="status">' + safe(feedback) + '</p>'}
      ${state.phase === 'investigation' && screen !== 'note' ?
        '<div class="toolbar">' + action('endDay', state.day === 5 ? '調査を終了して罠を配置' : '調査を終えて翌朝へ', '', false, 'primary') + '</div>' : ''}`;
    if (scroll !== undefined && app.querySelector('.hall-scroll')) app.querySelector('.hall-scroll').scrollLeft = scroll;
    if (focus) {
      const replacement = [...app.querySelectorAll('button[data-action]')].find(button =>
        button.dataset.action === focus.action && button.dataset.value === focus.value && !button.disabled);
      if (replacement) replacement.focus({ preventScroll: true });
      else {
        const heading = app.querySelector('h2') || app.querySelector('h1');
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    }
  }

  app.addEventListener('input', event => {
    if (event.target.matches('[data-note]')) game.note(Number(event.target.dataset.note), event.target.value);
  });
  app.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button || button.disabled) return;
    const { action: key, value } = button.dataset;
    if (key === 'start') {
      game = Mansion.createGame();
      screen = 'hall';
      selected = '';
      trapMode = 'capture';
      feedback = '管理人のメモ · 最初の夜の足音を録音したのは大学生の佐伯さん。';
    } else if (key === 'notebook') {
      screen = screen === 'note' ? 'hall' : 'note';
    } else if (key === 'enter' && game.enter(Number(value))) {
      selected = '';
      feedback = '家具や持ち物を選ぶと、外観を無料で確認できます。';
    } else if (key === 'hall') {
      game.leave();
      feedback = '';
    } else if (key === 'observe') {
      selected = value;
      feedback = game.observe(value) || '';
    } else if (key === 'trace') {
      selected = 'trace-' + value;
      feedback = '入口の変化。詳しく調べれば、この夜の逃走方向が分かります。';
    } else if (key === 'search') {
      feedback = (value.startsWith('trace-') ? game.examineTrace(Number(value.slice(6))) : game.search(value)) || feedback;
    } else if (key === 'question') {
      feedback = game.question() || feedback;
    } else if (key === 'verify') {
      feedback = game.verify() || feedback;
    } else if (key === 'endDay' && game.endDay()) {
      selected = '';
      const state = game.view();
      feedback = state.phase === 'placement' ? '通路と部屋を選び、罠を置きます。配置は実行前まで変更できます。'
        : state.notebook.at(-1).text;
    } else if (key === 'mode') {
      trapMode = value;
    } else if (key === 'trapRoom' || key === 'trapEdge') {
      feedback = game.place(trapMode, Number(value)) ? '罠の配置を更新しました。'
        : '捕獲罠は2個までです。同じ通路に封鎖罠と監視罠は置けません。';
    } else if (key === 'execute' || key === 'expire') {
      if (!window.confirm(key === 'execute' ? 'この配置で作戦を実行しますか？ 作戦は一度だけです。' : '作戦を見送ると期限切れで敗北します。よろしいですか？')) return;
      key === 'expire' ? game.expire() : game.execute();
      feedback = '';
    }
    render({ action: key, value });
  });
  render();
})();
