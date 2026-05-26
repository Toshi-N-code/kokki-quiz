(() => {
  'use strict';

  const FLAG_BASE = 'https://flagcdn.com/w640/';
  const HISTORY_SIZE = 30;
  const CONFETTI_COLORS = ['#ff7a59', '#ffd86b', '#4dc1ff', '#7be38b', '#c98bff', '#ff8fb1'];

  const $flag = document.getElementById('flag');
  const $flagFallback = document.getElementById('flag-fallback');
  const $answerArea = document.getElementById('answer-area');
  const $countryName = document.getElementById('country-name');
  const $capitalName = document.getElementById('capital-name');
  const $revealBtn = document.getElementById('reveal-btn');
  const $nextBtn = document.getElementById('next-btn');
  const $confetti = document.getElementById('confetti');

  const state = {
    countries: [],
    current: null,
    history: [],
  };

  async function loadCountries() {
    try {
      const res = await fetch('./data/countries.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error('countries.json の読み込みに失敗');
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('countries.json が空です');
      }
      state.countries = data;
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
  }

  function pickRandomCountry() {
    if (state.countries.length === 0) return null;

    const recent = new Set(state.history);
    const pool = state.countries.filter(c => !recent.has(c.iso2));
    const list = pool.length > 0 ? pool : state.countries;

    const idx = Math.floor(Math.random() * list.length);
    const picked = list[idx];

    state.history.push(picked.iso2);
    if (state.history.length > HISTORY_SIZE) {
      state.history.shift();
    }
    return picked;
  }

  function showFlag(country) {
    $flagFallback.hidden = true;
    $flag.hidden = false;
    $flag.classList.remove('is-pop');
    $flag.alt = 'こっき';
    $flag.src = FLAG_BASE + country.iso2 + '.png';
  }

  function handleFlagError() {
    $flag.hidden = true;
    $flagFallback.textContent = 'こっきが よみこめません。つぎの くに へ すすんでください';
    $flagFallback.hidden = false;
  }

  function revealAnswer() {
    if (!state.current) return;
    $countryName.textContent = state.current.name;
    $capitalName.textContent = state.current.capital;
    $answerArea.hidden = false;
    $revealBtn.hidden = true;
    $nextBtn.hidden = false;

    $flag.classList.remove('is-pop');
    void $flag.offsetWidth;
    $flag.classList.add('is-pop');

    spawnConfetti();
    $nextBtn.focus({ preventScroll: true });
  }

  function nextQuestion() {
    const picked = pickRandomCountry();
    if (!picked) return;
    state.current = picked;

    $answerArea.hidden = true;
    $countryName.textContent = '';
    $capitalName.textContent = '';
    $revealBtn.hidden = false;
    $nextBtn.hidden = true;
    $revealBtn.focus({ preventScroll: true });

    showFlag(picked);
  }

  function spawnConfetti() {
    const count = 28;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
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
    }, 2000);
  }

  function bindEvents() {
    $revealBtn.addEventListener('click', revealAnswer);
    $nextBtn.addEventListener('click', nextQuestion);
    $flag.addEventListener('error', handleFlagError);
  }

  async function init() {
    bindEvents();
    await loadCountries();
    nextQuestion();
  }

  init().catch(err => {
    console.error(err);
  });
})();
