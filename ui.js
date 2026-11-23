(() => {
  'use strict';
  const root = document.querySelector('#app');
  let game;
  let screen = 'title';
  let showNote = false;
  let tab = 'result';
  const guesses = {};
  const escape = value => String(value).replace(/[&<>"']/g, key =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[key]);
  const button = (action, label, value = '', classes = '', disabled = false) =>
    `<button type="button" data-act="${action}" data-value="${value}" class="${classes}" ${disabled ? 'disabled' : ''}>${label}</button>`;
  const labelRole = role => escape(role || '未回答');
  function roleSelect(state, id, mode, value) {
    return `<select data-mode="${mode}" data-id="${id}" ${state.phase === 'result' ? 'disabled' : ''}>
      <option value="">${mode === 'note' ? '仮説なし' : '未選択'}</option>
      ${state.roles.map(role => `<option ${role === value ? 'selected' : ''}>${escape(role)}</option>`).join('')}</select>`;
  }

  function conversation(state) {
    const { current } = state;
    const replies = state.transcript.filter(entry => entry.speaker === current.id);
    const last = replies.at(-1);
    return `<div class="interview">
      <section class="stage stage-${current.id}" aria-label="${current.name}との会話">
        <div class="window" aria-hidden="true"></div>
        <div class="figure figure-${current.id}" aria-hidden="true"><i></i><b></b></div>
        <div class="dialogue" role="status"><h2>${current.name}<small>${state.claims[current.id] ? '自称 ' + state.claims[current.id] : ''}</small></h2>
          ${last ? `<p>${escape(last.text)}</p>` : `<p class="muted">${escape(current.description)}</p>`}</div>
      </section>
      <section class="questions"><h2>質問を選ぶ</h2>
        <div class="choices">${state.questions.length ? state.questions.map(question =>
          button('ask', escape(question.text) + '<small>' + (question.cost ? '1回' : '無料') + '</small>',
            question.id, '', question.cost > state.remaining)).join('') : '<p>この相手への質問はすべて済みました。</p>'}</div>
        <p class="muted">${state.remaining === 0 ? '有料の質問は終了です。残りの役職確認はできます。' : '会話を終えると、この相手には戻れません。'}</p>
        ${button('next', state.index === 4 ? '最終回答へ' : '次の人との会話へ', '', 'primary', !state.claims[current.id])}
      </section></div>`;
  }

  function notebook(state) {
    return `<section class="panel"><h2>推理ノート</h2>
      <p class="muted">公開された内訳と証言に合う配置は ${state.layouts} 通り。候補は証言が増えると更新されます。仮説は自分用のメモです。</p>
      <div class="notebook">${state.people.map(person => {
        const entries = state.transcript.filter(entry => entry.speaker === person.id);
        return `<article><h3>${person.name}${person.id === 'you' ? '' : ' <small>自称 ' + escape(state.claims[person.id] || '未確認') + '</small>'}</h3>
          <p>役職候補 · ${state.candidates[person.id].join('、') || 'なし'}</p>
          <label>自分の仮説 ${roleSelect(state, person.id, 'note', state.notes[person.id])}</label>
          ${entries.length ? '<dl>' + entries.map(entry => '<dt>' + escape(entry.question) + '</dt><dd>' +
            escape(entry.text) + '</dd>').join('') + '</dl>' : ''}</article>`;
      }).join('')}</div></section>`;
  }

  function verdict(state) {
    return `<section class="panel verdict"><h2>あなたは何者だった？</h2>
      <p class="muted">自分の役職を選んでください。ほかの5人については、分かる範囲で回答できます。</p>
      <form id="verdict"><div class="verdict-fields">${state.people.map(person => `<label>${person.name}${person.id === 'you' ? '（必須）' : '（任意）'}
        ${roleSelect(state, person.id, 'guess', guesses[person.id] ?? state.notes[person.id])}</label>`).join('')}</div>
      <button type="submit" class="primary">回答を確定する</button><p id="form-message" role="status"></p></form></section>`;
  }

  function result(state) {
    const r = state.result;
    if (tab === 'explanation') {
      return `<section class="panel"><h2>事件の解説</h2>
        <p>${escape(r.events)}</p><h3>証言をどう照合するか</h3>
        <ol>${r.explanation.map(step => '<li>' + escape(step) + '</li>').join('')}</ol>
        <h3>各人物が知っていたこと</h3>
        <ul>${state.people.map(person => '<li><strong>' + person.name + '</strong> · ' + escape(r.knowledge[person.id]) + '</li>').join('')}</ul>
        <h3>人狼の嘘</h3><ul>${r.lies.map(lie => '<li><strong>' + escape(lie.questions) + '</strong> · ' + escape(lie.text) +
          ' <small>（' + (lie.heard ? '質問済み' : '会話では未確認') + '）</small></li>').join('')}</ul>
        ${button('result', '結果へ戻る')}${button('retry', 'もう一度遊ぶ', '', 'primary')}</section>`;
    }
    return `<section class="panel result ${r.won ? 'win' : 'loss'}">
      <h2>${r.won ? '正解 · 記憶の手がかりを掴んだ' : '不正解 · 証言を見直そう'}</h2>
      <p>あなたの回答は ${escape(r.self)}。真の役職は ${escape(r.roles.you)}。</p>
      <p>NPCの役職は5人中${r.score}人正解（${r.answered}人に回答）。</p>
      <ul>${state.people.map(person => '<li>' + escape(person.name) + ' · ' + labelRole(r.roles[person.id]) + '</li>').join('')}</ul>
      ${button('explanation', '事件の解説を読む', '', 'primary')}${button('retry', 'もう一度遊ぶ')}</section>`;
  }

  function render(focus) {
    if (!game) {
      root.innerHTML = screen === 'title' ? `<section class="cover">
        <div class="window" aria-hidden="true"></div><div class="cover-text"><h1>人狼の館</h1>
        <p>記憶を失ったあなたの前に、五人が待っている。<br>互いの証言を聞き、あなた自身の役職を突き止める。</p>
        ${button('intro', '目を覚ます', '', 'primary')}</div></section>`
        : `<section class="panel intro"><h1>昨夜、何があった？</h1>
          <p>聞き取りは一人ずつ。役職を名乗ってもらうと、その申告に応じた質問が開きます。</p>
          <ul>${Mansion.createGame().view().rules.map(rule => '<li>' + escape(rule) + '</li>').join('')}</ul>
          ${button('start', '聞き取りを始める', '', 'primary')}${button('title', 'タイトルへ')}</section>`;
    } else {
      const state = game.view();
      root.innerHTML = `<header class="bar"><h1>人狼の館</h1>
        <p>${state.phase === 'conversation' ? (state.index + 1) + ' / 5人目 · 残りの質問 <b>' + state.remaining + ' / 8</b>' :
          state.phase === 'verdict' ? '最終回答' : '答え合わせ'}</p>
        ${button('note', showNote ? 'ゲーム画面へ戻る' : '推理ノート')}${button('rules', '公開ルール')}</header>
        <aside id="rules" class="panel" hidden><h2>公開ルール</h2><ul>${state.rules.map(rule => '<li>' + escape(rule) + '</li>').join('')}</ul></aside>
        ${showNote ? notebook(state) : state.phase === 'conversation' ? conversation(state) :
          state.phase === 'verdict' ? verdict(state) : result(state)}`;
    }
    if (focus) {
      const element = focus === 'note' ? root.querySelector('[data-act="note"]') :
        root.querySelector('.dialogue h2, main > section h2, main > section h1') || root.querySelector('h1');
      element.tabIndex = -1;
      element.focus({ preventScroll: true });
    }
  }

  function start() {
    game = Mansion.createGame();
    showNote = false;
    tab = 'result';
    for (const id of Object.keys(guesses)) delete guesses[id];
  }
  root.addEventListener('click', event => {
    const target = event.target.closest('button[data-act]');
    if (!target || target.disabled) return;
    const { act, value } = target.dataset;
    if (act === 'intro' || act === 'title') screen = act;
    else if (act === 'start' || act === 'retry') start();
    else if (act === 'note') showNote = !showNote;
    else if (act === 'ask') game.ask(value);
    else if (act === 'next') game.next();
    else if (act === 'result' || act === 'explanation') tab = act;
    else if (act === 'rules') {
      const panel = root.querySelector('#rules');
      panel.hidden = !panel.hidden;
      target.setAttribute('aria-expanded', String(!panel.hidden));
      return;
    }
    render(act);
  });
  root.addEventListener('change', event => {
    const { mode, id } = event.target.dataset;
    if (mode === 'note') game.note(id, event.target.value);
    else if (mode === 'guess') guesses[id] = event.target.value;
  });
  root.addEventListener('submit', event => {
    if (event.target.id !== 'verdict') return;
    event.preventDefault();
    const choices = Object.fromEntries([...event.target.querySelectorAll('select')].map(select => [select.dataset.id, select.value]));
    if (game.submit(choices.you, choices)) render('result');
    else root.querySelector('#form-message').textContent = '自分の役職を選んでください。';
  });
  render();
})();
