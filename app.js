(() => {
  'use strict';

  const FLAG_BASE = 'https://flagcdn.com/w640/';
  const HISTORY_SIZE = 30;
  const STORAGE_KEY = 'kokki-quiz:review:v1';
  const CONFETTI_COLORS = ['#ff7a59', '#ffd86b', '#4dc1ff', '#7be38b', '#c98bff', '#ff8fb1'];

  // クイズ画面
  const $quizScreen = document.getElementById('quiz-screen');
  const $flag = document.getElementById('flag');
  const $flagFallback = document.getElementById('flag-fallback');
  const $answerArea = document.getElementById('answer-area');
  const $countryName = document.getElementById('country-name');
  const $capitalName = document.getElementById('capital-name');
  const $revealBtn = document.getElementById('reveal-btn');
  const $judgmentRow = document.getElementById('judgment-row');
  const $knownBtn = document.getElementById('known-btn');
  const $againBtn = document.getElementById('again-btn');
  const $confetti = document.getElementById('confetti');
  const $tabAll = document.getElementById('tab-all');
  const $tabReview = document.getElementById('tab-review');
  const $reviewBadge = document.getElementById('review-badge');
  const $celebrate = document.getElementById('celebrate');
  const $celebrateClose = document.getElementById('celebrate-close');
  const $homeBtn = document.getElementById('home-btn');

  // ホーム画面
  const $homeScreen = document.getElementById('home-screen');
  const $startAllBtn = document.getElementById('start-all-btn');
  const $startReviewBtn = document.getElementById('start-review-btn');
  const $homeAllCount = document.getElementById('home-all-count');
  const $homeReviewCount = document.getElementById('home-review-count');
  const $homeReviewHint = document.getElementById('home-review-hint');

  const state = {
    countries: [],
    current: null,
    history: [],
    mode: 'all',
    reviewSet: new Set(),
    countriesLoaded: false,
  };

  // ---------- データ読み込み ----------
  async function loadCountries() {
    try {
      const res = await fetch('./data/countries.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error('countries.json の読み込みに失敗');
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('countries.json が空です');
      }
      state.countries = data;
      state.countriesLoaded = true;
    } catch (err) {
      showLoadError();
      throw err;
    }
  }

  function showLoadError() {
    $flagFallback.textContent = 'こくデータを よみこめませんでした';
    $flagFallback.hidden = false;
    $flag.hidden = true;
    $revealBtn.disabled = true;
    $startAllBtn.disabled = true;
  }

  // ---------- 復習リストの永続化 ----------
  function loadReviewSet() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return new Set();
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return new Set();
      return new Set(arr.filter(x => typeof x === 'string'));
    } catch {
      return new Set();
    }
  }

  function saveReviewSet() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(state.reviewSet)));
    } catch {
      // ignore (privacy mode 等)
    }
  }

  // ---------- 出題プール ----------
  function getPool() {
    if (state.mode === 'review') {
      return state.countries.filter(c => state.reviewSet.has(c.iso2));
    }
    return state.countries;
  }

  function pickRandomCountry() {
    const pool = getPool();
    if (pool.length === 0) return null;

    const recent = new Set(state.history);
    let candidates = pool.filter(c => !recent.has(c.iso2));
    if (candidates.length === 0) candidates = pool;

    const idx = Math.floor(Math.random() * candidates.length);
    const picked = candidates[idx];

    state.history.push(picked.iso2);
    if (state.history.length > HISTORY_SIZE) {
      state.history.shift();
    }
    return picked;
  }

  // ---------- 国旗表示 ----------
  function showFlag(country) {
    $flagFallback.hidden = true;
    $flag.hidden = false;
    $flag.classList.remove('is-pop');
    $flag.alt = 'こっき';
    $flag.src = FLAG_BASE + country.iso2 + '.png';
  }

  function handleFlagError() {
    $flag.hidden = true;
    $flagFallback.textContent = 'こっきが よみこめません。もういちど へ すすんでください';
    $flagFallback.hidden = false;
  }

  // ---------- ホーム画面 UI ----------
  function updateHomeUI() {
    const allCount = state.countries.length;
    const reviewCount = state.reviewSet.size;
    $homeAllCount.textContent = allCount > 0 ? String(allCount) : '…';
    $homeReviewCount.textContent = String(reviewCount);

    $startAllBtn.disabled = !state.countriesLoaded;
    $startReviewBtn.disabled = !state.countriesLoaded || reviewCount === 0;

    $homeReviewHint.hidden = reviewCount > 0;
  }

  // ---------- クイズ画面 UI ----------
  function updateTabsUI() {
    const count = state.reviewSet.size;
    $reviewBadge.textContent = String(count);

    $tabAll.classList.toggle('is-active', state.mode === 'all');
    $tabAll.setAttribute('aria-selected', state.mode === 'all' ? 'true' : 'false');

    $tabReview.classList.toggle('is-active', state.mode === 'review');
    $tabReview.setAttribute('aria-selected', state.mode === 'review' ? 'true' : 'false');
    $tabReview.disabled = (count === 0 && state.mode !== 'review');
  }

  // ---------- 画面切替 ----------
  function showHome() {
    $homeScreen.hidden = false;
    $quizScreen.hidden = true;
    $celebrate.hidden = true;
    state.current = null;
    state.history = [];
    updateHomeUI();
  }

  function startQuiz(mode) {
    if (!state.countriesLoaded) return;
    if (mode === 'review' && state.reviewSet.size === 0) return;

    state.mode = mode;
    state.history = [];
    $homeScreen.hidden = true;
    $quizScreen.hidden = false;
    updateTabsUI();
    nextQuestion();
  }

  // ---------- メインフロー ----------
  function revealAnswer() {
    if (!state.current) return;
    $countryName.textContent = state.current.name;
    $capitalName.textContent = state.current.capital;
    $answerArea.hidden = false;
    $revealBtn.hidden = true;
    $judgmentRow.hidden = false;

    $flag.classList.remove('is-pop');
    void $flag.offsetWidth;
    $flag.classList.add('is-pop');

    spawnConfetti(28);
    $knownBtn.focus({ preventScroll: true });
  }

  function nextQuestion() {
    const picked = pickRandomCountry();
    if (!picked) return;
    state.current = picked;

    $answerArea.hidden = true;
    $countryName.textContent = '';
    $capitalName.textContent = '';
    $revealBtn.hidden = false;
    $judgmentRow.hidden = true;
    $revealBtn.focus({ preventScroll: true });

    showFlag(picked);
  }

  function handleKnown() {
    if (!state.current) return;
    const iso2 = state.current.iso2;
    state.reviewSet.delete(iso2);
    saveReviewSet();
    updateTabsUI();

    if (state.mode === 'review' && state.reviewSet.size === 0) {
      showCelebration();
      return;
    }
    nextQuestion();
  }

  function handleAgain() {
    if (!state.current) return;
    state.reviewSet.add(state.current.iso2);
    saveReviewSet();
    updateTabsUI();
    nextQuestion();
  }

  function setMode(mode) {
    if (mode === state.mode) return;
    if (mode === 'review' && state.reviewSet.size === 0) return;
    state.mode = mode;
    state.history = [];
    updateTabsUI();
    nextQuestion();
  }

  function showCelebration() {
    $celebrate.hidden = false;
    spawnConfetti(60);
    $celebrateClose.focus({ preventScroll: true });
  }

  function closeCelebration() {
    $celebrate.hidden = true;
    // お祝い後はホーム画面に戻す
    showHome();
  }

  // ---------- 紙吹雪 ----------
  function spawnConfetti(count) {
    const total = count || 28;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < total; i++) {
      const piece = document.createElement('span');
      piece.className = 'piece';
      const left = Math.random() * 100;
      const dx = (Math.random() - 0.5) * 240;
      const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
      const delay = Math.random() * 0.2;
      const dur = 1.1 + Math.random() * 0.6;
      piece.style.left = left + 'vw';
      piece.style.background = color;
      piece.style.setProperty('--dx', dx + 'px');
      piece.style.animationDelay = delay + 's';
      piece.style.animationDuration = dur + 's';
      frag.appendChild(piece);
    }
    $confetti.appendChild(frag);
    window.setTimeout(() => {
      while ($confetti.firstChild) $confetti.removeChild($confetti.firstChild);
    }, 2200);
  }

  // ---------- イベント ----------
  function bindEvents() {
    $startAllBtn.addEventListener('click', () => startQuiz('all'));
    $startReviewBtn.addEventListener('click', () => startQuiz('review'));
    $homeBtn.addEventListener('click', showHome);

    $revealBtn.addEventListener('click', revealAnswer);
    $knownBtn.addEventListener('click', handleKnown);
    $againBtn.addEventListener('click', handleAgain);

    $tabAll.addEventListener('click', () => setMode('all'));
    $tabReview.addEventListener('click', () => setMode('review'));

    $celebrateClose.addEventListener('click', closeCelebration);
    $flag.addEventListener('error', handleFlagError);
  }

  // ---------- 起動 ----------
  async function init() {
    bindEvents();
    state.reviewSet = loadReviewSet();

    // 起動時はホーム画面を表示（カウントは「…」で開始）
    showHome();

    await loadCountries();

    // 保存済み iso2 のうち未登録のものを除去（データ更新追従）
    const validIso2 = new Set(state.countries.map(c => c.iso2));
    let dirty = false;
    for (const iso2 of Array.from(state.reviewSet)) {
      if (!validIso2.has(iso2)) {
        state.reviewSet.delete(iso2);
        dirty = true;
      }
    }
    if (dirty) saveReviewSet();

    // 読み込み完了後にホームのカウント表示・ボタン状態を更新
    updateHomeUI();
    updateTabsUI();
  }

  init().catch(err => {
    console.error(err);
  });
})();
