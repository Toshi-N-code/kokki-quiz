(() => {
  'use strict';

  const FLAG_BASE = 'https://flagcdn.com/w640/';
  const HISTORY_SIZE = 30;
  const STORAGE_KEY = 'kokki-quiz:review:v1';
  const CONFETTI_COLORS = ['#ff7a59', '#ffd86b', '#4dc1ff', '#7be38b', '#c98bff', '#ff8fb1'];
  const REGION_LABELS = {
    'asia': 'アジア',
    'europe': 'ヨーロッパ',
    'north-america': '北（きた）アメリカ',
    'south-america': '南（みなみ）アメリカ',
    'africa': 'アフリカ',
    'oceania': 'オセアニア',
  };
  const SVG_NS = 'http://www.w3.org/2000/svg';
  // 元の世界地図 viewBox（SVG ファイルから読み取る基準値）
  const WORLD_VIEWBOX = { x: 0, y: 0, width: 1010, height: 666 };
  // マップ枠のアスペクト比（CSS の aspect-ratio と一致させる）
  const MAP_ASPECT_RATIO = 1010 / 666;
  // 地域 viewBox の余白（地域の幅・高さに対する割合）
  const REGION_PADDING_RATIO = 0.06;
  // 地域内で「小さい国」と判定する閾値（地域 viewBox 面積に対する国 bbox 面積の比）
  const TINY_AREA_RATIO = 0.005;
  // マーカー半径（地域 viewBox 幅に対する割合）
  const MARKER_RADIUS_RATIO = 0.025;
  // 地域 bbox 計算時に除外する外れ値カントリー（地理的に他の同地域国から極端に離れている）
  // 例：ロシアはヨーロッパ region だが東端が極東まで届くため、除外しないとヨーロッパ全体が極端に広くなる
  const REGION_BBOX_EXCLUDE = {
    'europe': new Set(['ru']),     // ロシア（東端が極東まで）
    'oceania': new Set(['ki']),    // キリバス（180度経線を跨いで両端に分布）
  };

  // クイズ画面
  const $quizScreen = document.getElementById('quiz-screen');
  const $flag = document.getElementById('flag');
  const $flagFallback = document.getElementById('flag-fallback');
  const $answerArea = document.getElementById('answer-area');
  const $countryName = document.getElementById('country-name');
  const $capitalName = document.getElementById('capital-name');
  const $regionName = document.getElementById('region-name');
  const $mapArea = document.getElementById('map-area');
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
    mapSvgElement: null, // 挿入された <svg> 要素への参照
    regionViewBoxes: {}, // 地域コード → {x, y, width, height} のキャッシュ
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

  // ---------- 世界地図 ----------
  async function loadMapSvg() {
    try {
      const res = await fetch('./assets/world-map.svg', { cache: 'force-cache' });
      if (!res.ok) throw new Error('world-map.svg の読み込みに失敗');
      const text = await res.text();

      // DOMParser で XML として安全に解析（innerHTML を使わない）
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'image/svg+xml');
      const parseError = doc.querySelector('parsererror');
      if (parseError) throw new Error('SVG パースエラー');

      const svgEl = doc.documentElement;
      if (!svgEl || svgEl.nodeName.toLowerCase() !== 'svg') {
        throw new Error('SVG ルート要素が見つかりません');
      }

      // 念のため <script> や on* 属性を除去（防御的多層化）
      svgEl.querySelectorAll('script').forEach(n => n.remove());
      svgEl.querySelectorAll('*').forEach(el => {
        for (const attr of Array.from(el.attributes)) {
          if (attr.name.toLowerCase().startsWith('on')) {
            el.removeAttribute(attr.name);
          }
        }
      });

      // 既存の中身をクリアして挿入
      while ($mapArea.firstChild) $mapArea.removeChild($mapArea.firstChild);
      $mapArea.appendChild(svgEl);
      state.mapSvgElement = svgEl;
    } catch (err) {
      console.warn('地図の読み込みに失敗:', err);
      $mapArea.classList.add('is-loading');
      $mapArea.textContent = 'ちずを よみこめませんでした';
    }
  }

  // 地域に属する全カ国の union bbox を算出して、マップ枠のアスペクト比に拡張した viewBox を返す
  function computeRegionViewBox(regionCode) {
    if (state.regionViewBoxes[regionCode]) {
      return state.regionViewBoxes[regionCode];
    }
    if (!state.mapSvgElement || state.countries.length === 0) {
      return WORLD_VIEWBOX;
    }

    const excludeSet = REGION_BBOX_EXCLUDE[regionCode] || new Set();
    const countriesInRegion = state.countries.filter(c => c.region === regionCode && !excludeSet.has(c.iso2));
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let pathFound = 0;

    for (const c of countriesInRegion) {
      const path = state.mapSvgElement.querySelector('#' + CSS.escape(c.iso2));
      if (!path) continue;
      try {
        const bb = path.getBBox();
        if (bb.width === 0 && bb.height === 0) continue;
        if (bb.x < minX) minX = bb.x;
        if (bb.y < minY) minY = bb.y;
        if (bb.x + bb.width > maxX) maxX = bb.x + bb.width;
        if (bb.y + bb.height > maxY) maxY = bb.y + bb.height;
        pathFound++;
      } catch (_) {}
    }

    if (pathFound === 0 || !isFinite(minX)) {
      // 失敗時は世界全体をフォールバック
      return WORLD_VIEWBOX;
    }

    let bx = minX;
    let by = minY;
    let bw = maxX - minX;
    let bh = maxY - minY;

    // 余白を加える（地域の幅/高さに対する割合）
    const padX = Math.max(bw * REGION_PADDING_RATIO, 30);
    const padY = Math.max(bh * REGION_PADDING_RATIO, 30);
    bx -= padX;
    by -= padY;
    bw += padX * 2;
    bh += padY * 2;

    // マップ枠のアスペクト比に拡張（letterbox を避ける）
    const bboxRatio = bw / bh;
    if (bboxRatio < MAP_ASPECT_RATIO) {
      // 枠が横長 > bbox 縦長：横方向に拡張
      const newW = bh * MAP_ASPECT_RATIO;
      bx -= (newW - bw) / 2;
      bw = newW;
    } else if (bboxRatio > MAP_ASPECT_RATIO) {
      // 枠が縦長 > bbox 横長：縦方向に拡張
      const newH = bw / MAP_ASPECT_RATIO;
      by -= (newH - bh) / 2;
      bh = newH;
    }

    const result = { x: bx, y: by, width: bw, height: bh };
    state.regionViewBoxes[regionCode] = result;
    return result;
  }

  function highlightCountryOnMap(iso2) {
    if (!state.mapSvgElement) return;
    clearMapHighlight();

    const country = state.countries.find(c => c.iso2 === iso2);
    const path = state.mapSvgElement.querySelector('#' + CSS.escape(iso2));

    // 地域ズーム適用：region が判明していれば地域 viewBox に切替、なければ世界全体
    // ロシアやキリバスのような外れ値の国は、地域全体に収まらないため世界全体表示にフォールバック
    let viewBox = WORLD_VIEWBOX;
    if (country && country.region) {
      const excludeSet = REGION_BBOX_EXCLUDE[country.region];
      if (excludeSet && excludeSet.has(iso2)) {
        viewBox = WORLD_VIEWBOX;
      } else {
        viewBox = computeRegionViewBox(country.region);
      }
    }
    state.mapSvgElement.setAttribute(
      'viewBox',
      `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`
    );

    if (!path) {
      // SVG に該当 iso2 がない場合は viewBox 設定だけして終了
      return;
    }
    path.classList.add('is-selected');

    // ズーム対応マーカー：地域面積に対する国の相対面積で判定
    try {
      const bbox = path.getBBox();
      const countryArea = bbox.width * bbox.height;
      const regionArea = viewBox.width * viewBox.height;
      if (countryArea > 0 && regionArea > 0 && (countryArea / regionArea) < TINY_AREA_RATIO) {
        const cx = bbox.x + bbox.width / 2;
        const cy = bbox.y + bbox.height / 2;
        const radius = viewBox.width * MARKER_RADIUS_RATIO;
        const circle = document.createElementNS(SVG_NS, 'circle');
        circle.setAttribute('cx', String(cx));
        circle.setAttribute('cy', String(cy));
        circle.setAttribute('r', String(radius));
        circle.setAttribute('class', 'country-marker');
        state.mapSvgElement.appendChild(circle);
      }
    } catch (_) {
      // getBBox が使えない環境ではマーカー追加をスキップ
    }
  }

  function clearMapHighlight() {
    if (!state.mapSvgElement) return;
    state.mapSvgElement.querySelectorAll('.is-selected').forEach(el => el.classList.remove('is-selected'));
    state.mapSvgElement.querySelectorAll('.country-marker').forEach(el => el.remove());
  }

  // ---------- メインフロー ----------
  function revealAnswer() {
    if (!state.current) return;
    $countryName.textContent = state.current.name;
    $capitalName.textContent = state.current.capital;
    $regionName.textContent = REGION_LABELS[state.current.region] || '';
    // 先に表示状態にする（getBBox が非表示要素では 0 を返す Chrome 仕様への対策）
    $answerArea.hidden = false;
    $revealBtn.hidden = true;
    $judgmentRow.hidden = false;
    // レイアウト強制反映してから地図ハイライト
    void $mapArea.offsetWidth;
    highlightCountryOnMap(state.current.iso2);

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
    $regionName.textContent = '';
    clearMapHighlight();
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

    // 国データと世界地図を並列で読み込み
    await Promise.all([
      loadCountries(),
      loadMapSvg(),
    ]);

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
