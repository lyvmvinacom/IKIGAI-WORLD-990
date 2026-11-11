import { demo } from './demo.js';

export async function mountJftPractice(host, {classLink, jftAccount, signal}) {
  const view = host.shadowRoot ?? host.attachShadow({mode:'open'});
  const stylesheet = new URL('./styles.css?v=jft-open-1', import.meta.url).href;
  view.innerHTML = `<link rel="stylesheet" href="${stylesheet}">
    <main id="main" tabindex="-1"><p>Đang mở phòng luyện thi…</p></main>
    <dialog id="dialog" aria-labelledby="dialog-title"></dialog>
    <div class="toast" id="toast" role="status" hidden></div>`;
  const $ = (id) => view.getElementById(id);
  const main = $('main');
  const dialog = $('dialog');
  const sections = ['Chữ viết & từ vựng', 'Hội thoại & diễn đạt', 'Nghe hiểu', 'Đọc hiểu'];
  const jaSections = ['文字と語彙', '会話と表現', '聴解', '読解'];
  const icons = {
    arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>',
    back:'<path d="M20 12H5m6-6-6 6 6 6"/>',
    book:'<path d="M4 5h6a2 2 0 0 1 2 2v13a4 4 0 0 0-3-2H4zM20 5h-6a2 2 0 0 0-2 2v13a4 4 0 0 1 3-2h5z"/>',
    chat:'<path d="M20 11a7 7 0 0 1-7 7H9l-5 3 1-5a7 7 0 0 1-1-4v-1a7 7 0 0 1 7-7h2a7 7 0 0 1 7 7zM8 11h8m-8 3h5"/>',
    headphones:'<path d="M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v6H5a1 1 0 0 1-1-1zm16 0h-3v6h2a1 1 0 0 0 1-1z"/>',
    read:'<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 12h7m-7 4h7"/>',
    clock:'<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
    flag:'<path d="M5 21V4m0 1c5-4 8 4 14 0v9c-6 4-9-4-14 0"/>',
    check:'<path d="m5 12 4 4 10-10"/>',
    play:'<path d="m8 5 11 7-11 7z"/>',
    stop:'<rect x="7" y="7" width="10" height="10" rx="1"/>',
    file:'<path d="M6 3h9l4 4v14H6zM14 3v5h5m-7 9v-6m-3 3 3-3 3 3"/>',
    person:'<circle cx="12" cy="8" r="3.5"/><path d="M4.5 21v-1a7.5 7.5 0 0 1 15 0v1"/>',
    expand:'<path d="M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4"/>'
  };
  const sectionIcons = ['book', 'chat', 'headphones', 'read'];
  const icon = (name) => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
  const esc = (value = '') => String(value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  const letter = (index) => 'ABCD'[index] ?? '—';
  const safeImage = (s) => typeof s === 'string' && /^data:image\/(?:webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(s);
  const number = (n) => String(n).padStart(2, '0');
  const classExam = (id) => !!classLink && /^sore-vol1-(?:0[1-9]|10)$/.test(id);
  const attemptKey = (id) => 'ikigai-jft-v1:' +
    (classExam(id) ? accountId ? 'account:' + accountId + ':' : 'class-link:' : '') + id;
  const attemptStorage = (id) => classExam(id) && !accountId ? sessionStorage : localStorage;
  const listenLimit = 2;
  const classTests = Array.from({length:10}, (_, i) => ({
    id:'sore-vol1-' + number(i + 1), title:'Đề ' + number(i + 1), minutes:60, questionCount:50,
    source:'SoreNihongo · Vol. 1 · IKIGAI EDUCATION'
  }));
  let examAccess = false;
  const accountId = jftAccount?.id;
  let recentRequest;
  const recentScores = new Map();
  const syncing = new Set();
  const syncFailed = new Set();
  let library = [];
  let audioNames = [];
  let active = null;
  let screen = 'lobby';
  let filter = 'all';
  let reviewOpen = false;
  let db;
  let paletteOpen;
  let audioGeneration = 0;
  let audioUrl;
  let playingAudio;
  let audioBusy = false;
  let toastTimer;

  const readLocal = (id) => {
    try { return JSON.parse(attemptStorage(id).getItem(attemptKey(id))); } catch { return null; }
  };

  function save(attempt = active) {
    if (!attempt) return;
    try {
      const {test, record} = attempt;
      const saved = readLocal(test.id);
      if (record.attemptId && saved?.attemptId === record.attemptId &&
          saved.status === 'done' && record.status === 'doing') return false;
      if (saved?.start === record.start) {
        for (const [index, count] of Object.entries(saved.listens ?? {})) {
          record.listens[index] = Math.max(record.listens[index] ?? 0, count);
        }
        record.systemResult ??= saved.systemResult;
      }
      attemptStorage(test.id).setItem(attemptKey(test.id), JSON.stringify(record));
      return true;
    } catch {
      toast('Trình duyệt không lưu được tiến độ của lượt làm này.');
      return false;
    }
  }

  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('ikigai-jft', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('data');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function storage(mode, operate) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('data', mode);
      const request = operate(tx.objectStore('data'));
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = () => reject(tx.error || new Error('Không thể lưu dữ liệu trên trình duyệt này.'));
    });
  }

  const dbGet = (key) => storage('readonly', (store) => store.get(key));
  const dbPut = (key, value) => storage('readwrite', (store) => store.put(value, key));

  function toast(message) {
    const element = $('toast');
    clearTimeout(toastTimer);
    element.textContent = message;
    element.hidden = false;
    toastTimer = setTimeout(() => { element.hidden = true; }, 4400);
  }

  function top(focus = main) {
    host.scrollTo({top:0});
    focus.focus({preventScroll:true});
  }

  function showDialog(title, body, actions, wide = false) {
    if (dialog.open) dialog.close();
    dialog.classList.toggle('wide', wide);
    dialog.innerHTML = `<h2 id="dialog-title">${esc(title)}</h2>${body}<div class="dialog-actions">${actions}</div>`;
    dialog.showModal();
  }

  function confirmAction(title, description, label, action) {
    showDialog(title, `<p>${esc(description)}</p>`, `<button class="ghost" id="dismiss" autofocus>Quay lại</button><button class="btn" id="confirm">${esc(label)}</button>`);
    $('dismiss').onclick = () => dialog.close();
    $('confirm').onclick = () => { dialog.close(); action(); };
  }

  const art = `<svg viewBox="0 0 440 325" fill="none" aria-hidden="true">
    <defs><pattern id="dot" width="15" height="15" patternUnits="userSpaceOnUse"><circle cx="1.2" cy="1.2" r="1" fill="#a3e6d7" opacity=".38"/></pattern><linearGradient id="sheet" x2="1" y2="1"><stop stop-color="#d9f2dd"/><stop offset="1" stop-color="#8fd5c5"/></linearGradient></defs>
    <path d="M31 152c0-66 80-125 185-125 108 0 208 56 208 137s-82 142-193 142S31 223 31 152Z" fill="url(#dot)" opacity=".65"/>
    <circle cx="250" cy="153" r="111" stroke="#9ed9d4" stroke-opacity=".34"/><circle cx="250" cy="153" r="134" stroke="#9ed9d4" stroke-opacity=".21"/>
    <g transform="translate(101 49) rotate(-10 68 89)"><rect x="3" y="6" width="145" height="188" rx="14" fill="#0a263c" opacity=".45"/><rect width="145" height="188" rx="14" fill="url(#sheet)"/><rect x="12" y="12" width="121" height="164" rx="7" stroke="#14625e" stroke-opacity=".3"/><text x="72.5" y="85" text-anchor="middle" fill="#113b4a" font-family="sans-serif" font-size="27" font-weight="800">日本語</text><path d="M37 114h71m-57 13h43m-51 13h59" stroke="#247a71" stroke-width="2.2" stroke-linecap="round" opacity=".65"/><circle cx="72" cy="39" r="7" fill="#1b8075"/></g>
    <g transform="translate(244 117) rotate(12 58 61)"><rect y="6" x="2" width="115" height="120" rx="16" fill="#0a263c" opacity=".5"/><rect width="115" height="120" rx="16" fill="#174260" stroke="#74d4c6"/><path d="M30 70v-8a28 28 0 0 1 56 0v8M30 70h10v15H34a4 4 0 0 1-4-4zm56 0H76v15h6a4 4 0 0 0 4-4z" stroke="#aceddc" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M46 54v5m6-11v17m6-22v26m6-21v17m6-11v5" stroke="#a2e8d4" stroke-width="2" stroke-linecap="round"/></g>
    <circle cx="335" cy="78" r="15" fill="#c9edae"/><path d="m329 78 4 4 8-9" stroke="#214f48" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M83 181v20m-10-10h20M358 259v22m-11-11h22M278 38v14m-7-7h14" stroke="#a2e8d4" opacity=".75" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`;

  function lobby() {
    stopAudio();
    screen = 'lobby';
    active = null;
    const tests = classLink ? examAccess ? classTests : [demo, ...classTests] : [demo, ...library];
    const resumable = tests.find((test) => (!test.questionCount || examAccess) && readLocal(test.id)?.status === 'doing');
    const startLabel = resumable ? 'Tiếp tục ' + resumable.title : examAccess ? 'Bắt đầu đề 01' : 'Bắt đầu bài mẫu';
    const catalogNote = classLink ? '10 đề SoreNihongo · 50 câu mỗi đề · Dành cho học viên IKIGAI.'
      : library.length ? `${library.length} đề cá nhân đã nhập trên trình duyệt này.` : 'Thử bài mẫu hoặc nhập bộ đề bạn được phép sử dụng.';
    main.innerHTML = `<section class="hero"><div class="hero-copy"><div class="kicker">Phòng luyện thi · Tiếng Nhật</div><h1>Luyện thi <span>JFT A2</span></h1><p>Làm quen với bốn phần thi. Làm bài theo thời gian, nghe tiếng Nhật và xem ngay câu nào cần ôn lại.</p><button class="btn" id="hero-start">${esc(startLabel)} ${icon('arrow')}</button></div><div class="hero-art">${art}</div></section>
      <div class="feature-strip" aria-label="Bốn phần luyện thi">${sections.map((title,i) => `<div class="feature"><span class="icon-tile">${icon(sectionIcons[i])}</span><span><strong>${title}</strong><small lang="ja">${jaSections[i]}</small></span></div>`).join('')}</div>
      <section aria-labelledby="catalog-title"><div class="section-heading"><div><h2 id="catalog-title">Chọn đề luyện</h2><p>${esc(catalogNote)}</p></div></div>
      ${examAccess && accountId ? '<p class="muted jft-system-note">Đã đăng nhập IKIGAI WORLD. Kết quả đề JFT và XP sẽ được ghi về tài khoản khi nộp bài.</p>' : ''}
      ${examAccess && jftAccount?.canSignIn ? '<p class="muted jft-system-note">Đang làm bài với tư cách khách. <button class="ghost" type="button" id="jft-sign-in">Đăng nhập game để lưu XP</button></p>' : ''}
      <div class="catalog">${tests.map((test) => {
        const locked = !!test.questionCount && !examAccess;
        const record = locked ? null : readLocal(test.id);
        const ended = record?.status === 'done';
        const started = record?.status === 'doing';
        const count = test.questionCount ?? test.questions.length;
        const badge = locked ? 'ĐĂNG NHẬP GAME' : test === demo ? 'BÀI MẪU' : examAccess ? 'ĐỀ TRUNG TÂM' : 'ĐỀ CÁ NHÂN';
        const description = !ended ? test.source : examAccess ? 'Đã hoàn thành · Xem phiếu kết quả'
          : `Lượt gần nhất · ${calculate(test, record.answers).correct}/${count} câu đúng`;
        return `<article class="card"><div class="card-meta"><span class="badge ${test === demo || locked ? 'neutral' : ''}">${badge}</span><span class="muted">${count} câu · ${test.minutes} phút</span></div><div><h3>${esc(test.title)}</h3><p>${esc(description)}</p>
        ${examAccess && accountId ? `<p data-system-exam="${esc(test.id)}" hidden></p>` : ''}</div><button class="${ended || locked ? 'ghost' : 'btn'}" data-start="${esc(test.id)}">${locked ? 'Đăng nhập game để làm bài' : ended ? 'Xem kết quả' : started ? 'Tiếp tục' : 'Vào làm bài'} ${icon('arrow')}</button></article>`;
      }).join('')}
      ${classLink || library.length ? '' : `<article class="card card-import"><span class="icon-tile">${icon('file')}</span><div><h3>Nhập bộ đề cá nhân</h3><p>Chọn tệp dữ liệu JFT. Câu hỏi và đáp án được lưu trên trình duyệt của bạn.</p></div><button class="ghost" id="catalog-import">Mở quản lý đề</button></article>`}</div></section>`;
    $('hero-start').onclick = (event) => selectTest(resumable ?? tests[0], event.currentTarget);
    if ($('jft-sign-in')) $('jft-sign-in').onclick = () => jftAccount.signIn();
    if ($('catalog-import')) $('catalog-import').onclick = manage;
    main.querySelectorAll('[data-start]').forEach((button) => {
      button.onclick = () => selectTest(tests.find((test) => test.id === button.dataset.start), button);
    });
    if (accountId && examAccess) {
      paintRecentScores();
      recentRequest ??= loadRecentScores();
    }
    top();
  }

  function paintRecentScores() {
    main.querySelectorAll('[data-system-exam]').forEach((label) => {
      const score = recentScores.get(label.dataset.systemExam);
      label.hidden = !score;
      if (score) label.textContent = `Đã lưu vào hồ sơ · ${score.score}/250 · ${score.correct_count}/50 câu đúng`;
    });
  }

  function rememberSystemScore(score) {
    const previous = recentScores.get(score.exam_id);
    if (!previous || Date.parse(score.submitted_at) >= Date.parse(previous.submitted_at)) recentScores.set(score.exam_id, score);
  }

  async function loadRecentScores() {
    try {
      const rows = await jftAccount.recent(accountId, signal);
      if (Array.isArray(rows)) rows.forEach(rememberSystemScore);
      paintRecentScores();
    } catch {}
  }

  async function selectTest(test, button) {
    if (!test.questionCount) {
      start(test);
      return;
    }
    if (!examAccess) {
      jftAccount?.signIn();
      return;
    }
    const buttons = main.querySelectorAll('#hero-start,[data-start]');
    const label = button.innerHTML;
    buttons.forEach((item) => { item.disabled = true; });
    button.setAttribute('aria-busy', 'true');
    button.textContent = 'Đang tải đề…';
    try {
      const tests = validatePackage(await classLink.load(test.id, signal));
      if (!button.isConnected) return;
      const loaded = tests[0];
      const listening = loaded.questions.filter((q) => q.section === 2);
      if (tests.length !== 1 || loaded.id !== test.id || loaded.questions.length !== test.questionCount ||
          listening.length !== 12 || listening.some((q) => !q.listen.questionVi || !q.listen.mp3)) {
        throw new Error('Đề chưa đủ dữ liệu.');
      }
      start(loaded);
    } catch {
      if (button.isConnected) toast('Chưa tải được đề. Hãy kiểm tra kết nối và thử lại.');
    } finally {
      if (button.isConnected) {
        button.innerHTML = label;
        button.removeAttribute('aria-busy');
        buttons.forEach((item) => { item.disabled = false; });
      }
    }
  }

  function start(test, fresh = false) {
    const saved = fresh ? null : readLocal(test.id);
    const usable = saved?.answers?.length === test.questions.length && ['doing','done'].includes(saved.status);
    const record = usable ? saved : {
      status:'doing',
      index:0,
      answers:Array(test.questions.length).fill(null),
      flags:Array(test.questions.length).fill(false),
      start:Date.now(),
      end:Date.now() + test.minutes * 60000
    };
    record.listens ??= {};
    if (classExam(test.id) && accountId && record.status === 'doing') record.attemptId ??= crypto.randomUUID();
    active = { test, record };
    paletteOpen = host.clientWidth >= 761;
    save();
    if (record.status === 'done') {
      filter = 'all';
      reviewOpen = false;
      result();
    } else if (record.end <= Date.now()) {
      finish(true);
    } else {
      exam();
      top($('q-heading'));
    }
  }

  const answered = () => active.record.answers.filter((answer) => answer !== null).length;
  function remaining() { return Math.max(0, Math.ceil((active.record.end - Date.now())/1000)); }

  function updateClock() {
    if (screen !== 'exam' || !active) return;
    const seconds = remaining();
    if (!seconds) { finish(true); return; }
    $('clock-value').textContent = `${number(Math.floor(seconds / 60))}:${number(seconds % 60)}`;
    $('timer').classList.toggle('urgent', seconds <= 300);
  }

  function showFigure(src) {
    showDialog('Hình minh họa và bố cục đề gốc',
      `<div class="figure-scroll"><img class="zoom-image" src="${esc(src)}" alt="Hình gốc của câu hỏi"></div>`,
      '<button class="ghost" id="dismiss" autofocus>Đóng hình</button>', true);
    $('dismiss').onclick = () => dialog.close();
  }

  function markedPrompt(q) {
    const start = q.underlined ? q.prompt.indexOf(q.underlined) : -1;
    if (start < 0) return esc(q.prompt);
    return esc(q.prompt.slice(0, start)) + '<u>' + esc(q.underlined) + '</u>' +
      esc(q.prompt.slice(start + q.underlined.length));
  }

  function questionBody(q) {
    return `<p class="instruction">${esc(q.instruction)}</p>
    ${q.figure ? `<button class="figure" data-figure aria-label="Phóng to hình minh họa"><img src="${esc(q.figure)}" alt="Hình minh họa của câu hỏi"></button>` : ''}
    ${q.passage ? `<div class="passage ja" lang="ja">${esc(q.passage)}</div>` : ''}
    ${q.prompt ? `<p class="prompt ja" lang="ja">${markedPrompt(q)}</p>` : ''}
    ${q.sourceView ? `<button class="ghost source-view" data-source>${icon('expand')} Xem bố cục gốc</button>` : ''}`;
  }

  function bindFigures(root, q) {
    const figure = root.querySelector('[data-figure]');
    const source = root.querySelector('[data-source]');
    if (figure) figure.onclick = () => showFigure(q.figure);
    if (source) source.onclick = () => showFigure(q.sourceView);
  }

  function exam() {
    screen = 'exam';
    const {test, record} = active;
    const q = test.questions[record.index];
    const total = test.questions.length;
    const audioName = q.listen && audioKey(test, record.index + 1);
    main.innerHTML = `<div class="exam-head"><h1>${esc(test.title)}</h1><p class="muted">${esc(test.source)}</p></div>
      <div class="exam-top"><button class="ghost" id="leave">${icon('back')} Danh sách đề</button><div class="exam-tools"><div class="timer" id="timer" aria-label="Thời gian còn lại">${icon('clock')}<span id="clock-value"></span></div><button class="btn" id="submit">Nộp bài</button></div></div>
      <div class="exam-grid"><article class="panel question"><div class="q-top"><div><span class="badge">${sections[q.section]}</span><h2 id="q-heading" class="q-heading" tabindex="-1">Câu ${record.index + 1} / ${total}</h2></div>
      <button class="ghost ${record.flags[record.index] ? 'flagged' : ''}" id="flag" aria-pressed="${!!record.flags[record.index]}">${icon('flag')} <span>${record.flags[record.index] ? 'Đã đánh dấu' : 'Đánh dấu'}</span></button></div>
      ${questionBody(q)}
      ${q.listen ? `<section class="listen" aria-label="Phần nghe"><div class="listen-question"><span class="listen-label">CÂU HỎI TIẾNG VIỆT</span><p>${esc(q.listen.questionVi ?? 'Hãy nhập bản đề mới để xem câu hỏi tiếng Việt.')}</p></div><div class="listen-head"><button class="btn" id="play" disabled>${icon('play')} Phát đoạn nghe</button><button class="ghost" id="stop" hidden>${icon('stop')} Dừng</button><span class="badge listen-count" id="listen-count" role="status"></span></div><p class="muted" id="listen-status" role="status">Mỗi câu có tối đa 2 lượt phát trong một lần làm đề.</p></section>` : ''}
      <div class="choices" role="group" aria-label="Phương án trả lời">${q.options.map((option,i) => `<button class="choice" data-answer="${i}" aria-pressed="${record.answers[record.index] === i}"><span class="choice-letter">${letter(i)}</span><span class="ja" lang="ja">${esc(option)}</span></button>`).join('')}</div>
      <div class="q-bottom"><button class="ghost" id="previous" ${record.index === 0 ? 'disabled' : ''}>${icon('back')} Câu trước</button><button class="btn" id="next">${record.index + 1 === total ? 'Nộp bài' : 'Câu tiếp theo'} ${icon('arrow')}</button></div></article>
      <aside class="panel palette"><details id="palette" ${paletteOpen ? 'open' : ''}><summary><span>Phiếu trả lời</span><span class="muted" id="answer-count">${answered()}/${total} đã làm</span></summary>
      <progress class="progress" id="exam-progress" value="${answered()}" max="${total}" aria-label="Tiến độ trả lời"></progress>
      ${sections.map((title,i) => `<h3>${title}</h3><div class="numbers">${test.questions.map((question,j) => question.section === i ? `<button class="num ${record.index === j ? 'current' : ''} ${record.answers[j] !== null ? 'answered' : ''} ${record.flags[j] ? 'flagged' : ''}" data-jump="${j}" ${record.index === j ? 'aria-current="step"' : ''} aria-label="Câu ${j+1}${record.answers[j] !== null ? ', đã trả lời' : ''}${record.flags[j] ? ', đánh dấu' : ''}">${j+1}</button>` : '').join('')}</div>`).join('')}
      <div class="legend"><span>Đang xem</span><span>· Đã trả lời</span><span>· Đánh dấu</span></div><button class="btn" id="submit-side">Kiểm tra và nộp bài</button></details></aside></div>`;

    $('leave').onclick = lobby;
    $('palette').ontoggle = (event) => { paletteOpen = event.currentTarget.open; };
    $('submit').onclick = requestSubmit;
    $('submit-side').onclick = requestSubmit;
    $('next').onclick = () => record.index + 1 === total ? requestSubmit() : jump(record.index + 1);
    $('previous').onclick = () => jump(record.index - 1);
    $('flag').onclick = () => {
      const flagged = record.flags[record.index] = !record.flags[record.index];
      $('flag').classList.toggle('flagged', flagged);
      $('flag').setAttribute('aria-pressed', String(flagged));
      $('flag').querySelector('span').textContent = flagged ? 'Đã đánh dấu' : 'Đánh dấu';
      updateAnswerCount();
    };
    main.querySelectorAll('[data-jump]').forEach((button) => { button.onclick = () => jump(Number(button.dataset.jump)); });
    main.querySelectorAll('[data-answer]').forEach((button) => {
      button.onclick = () => {
        if (remaining() === 0) { finish(true); return; }
        record.answers[record.index] = Number(button.dataset.answer);
        main.querySelectorAll('[data-answer]').forEach((choice) => choice.setAttribute('aria-pressed', String(choice === button)));
        updateAnswerCount();
      };
    });
    bindFigures(main, q);
    if (q.listen) {
      setupListening(q.listen, audioName, record.index);
    }
    updateClock();
  }

  function updateAnswerCount() {
    const {record, test} = active;
    const button = main.querySelector(`[data-jump="${record.index}"]`);
    button.classList.toggle('answered', record.answers[record.index] !== null);
    button.classList.toggle('flagged', !!record.flags[record.index]);
    button.setAttribute('aria-label', `Câu ${record.index + 1}${record.answers[record.index] !== null ? ', đã trả lời' : ''}${record.flags[record.index] ? ', đánh dấu' : ''}`);
    $('answer-count').textContent = `${answered()}/${test.questions.length} đã làm`;
    $('exam-progress').value = answered();
    save();
  }

  function jump(index) {
    if (index < 0 || index >= active.test.questions.length) return;
    stopAudio();
    active.record.index = index;
    save();
    exam();
    if (screen === 'exam') {
      $('q-heading').focus({preventScroll:true});
      $('q-heading').scrollIntoView({block:'center'});
    }
  }

  function requestSubmit() {
    const pending = active.test.questions.length - answered();
    confirmAction('Nộp bài luyện thi', pending ? `Bạn còn ${pending} câu chưa trả lời. Các câu bỏ trống được tính 0 điểm.` : 'Bạn đã trả lời tất cả các câu. Nộp bài để xem điểm và giải thích.', 'Nộp và xem điểm', () => finish(false));
  }

  function finish(expired) {
    if (!active || active.record.status === 'done') return;
    if (dialog.open) dialog.close();
    stopAudio();
    const saved = active.record.attemptId ? readLocal(active.test.id) : null;
    if (saved?.attemptId === active.record.attemptId && saved?.status === 'done') {
      active.record = saved;
    } else {
      active.record.status = 'done';
      active.record.expired = expired;
    }
    save();
    filter = 'all';
    reviewOpen = false;
    result();
  }

  function calculate(test, picks) {
    const totals = sections.map(() => ({correct:0, total:0}));
    let correct = 0;
    let blank = 0;
    test.questions.forEach((q,i) => {
      const selected = picks[i];
      totals[q.section].total++;
      if (selected == null) blank++;
      if (selected === q.correct) {
        correct++;
        totals[q.section].correct++;
      }
    });
    return {correct, blank, totals, percent:Math.round(correct / test.questions.length * 100)};
  }

  const scoreMinimum = 10;
  const scoreMaximum = 250;
  const assessmentLevels = [
    {point:145, name:'A1'},
    {point:175, name:'A2.1'},
    {point:200, name:'A2.2', suffix:' (A2)'}
  ];
  const scoreTicks = [{point:scoreMinimum}, ...assessmentLevels, {point:scoreMaximum}];
  const scorePosition = (points) => `${(points - scoreMinimum) / (scoreMaximum - scoreMinimum) * 100}%`;

  function practiceAssessment(correct, total) {
    const points = Math.round(scoreMinimum + (scoreMaximum - scoreMinimum) * correct / total);
    const nextIndex = assessmentLevels.findIndex((entry) => points < entry.point);
    const level = assessmentLevels[(nextIndex === -1 ? assessmentLevels.length : nextIndex) - 1];
    return {
      points,
      label: level ? level.name + (level.suffix ?? '') : 'Dưới A1',
      next: assessmentLevels[nextIndex]
    };
  }

  const candidateFields = [
    {key:'name', label:'Họ và tên', length:90},
    {key:'code', label:'Số báo danh', length:40},
    {key:'nationality', label:'Quốc tịch', length:50},
    {key:'birthDate', label:'Ngày sinh', type:'date'},
    {key:'gender', label:'Giới tính', length:40}
  ];
  const vietnamDate = new Intl.DateTimeFormat('vi-VN', {
    timeZone:'Asia/Ho_Chi_Minh', day:'2-digit', month:'2-digit', year:'numeric'
  });

  function resultReport(test, record, score, assessment) {
    const candidate = record.candidate ?? {};
    const hasPhoto = safeImage(candidate.photo);
    const examDate = Number.isFinite(record.start) ? vietnamDate.format(record.start) : '—';
    return `<header class="report-head">
      <p class="report-path">Luyện thi JFT A2 <span aria-hidden="true">›</span> <b>Kết quả</b></p>
      <h1>Phiếu kết quả luyện thi</h1>
      <p class="muted">JFT-Basic · ${esc(test.title)}${record.expired ? ' · Tự động nộp khi hết giờ' : ''}</p>
    </header>
    <div class="report-meta">
      <section class="panel report-box" aria-labelledby="candidate-title">
        <div class="report-box-head"><h2 id="candidate-title">Thông tin thí sinh</h2><button class="ghost" id="edit-candidate">${candidate.name ? 'Chỉnh sửa' : 'Điền thông tin'}</button></div>
        <div class="candidate-summary"><div class="candidate-photo">${hasPhoto ? `<img src="${esc(candidate.photo)}" alt="Ảnh thẻ thí sinh">` : `${icon('person')}<span>Ảnh thẻ</span>`}</div>
          <dl class="candidate-fields">${candidateFields.map(({key,label}) => {
            const value = candidate[key];
            const display = key === 'birthDate' && value ? value.split('-').reverse().join('/') : value;
            return `<div><dt>${label}</dt><dd>${esc(display || '—')}</dd></div>`;
          }).join('')}</dl>
        </div>
      </section>
      <section class="panel report-box" aria-labelledby="sitting-title">
        <div class="report-box-head"><h2 id="sitting-title">Thông tin dự thi</h2></div>
        <dl class="sitting-fields"><div><dt>Nơi dự thi</dt><dd>Phòng luyện thi trực tuyến</dd></div><div><dt>Ngày dự thi</dt><dd>${examDate}</dd></div><div><dt>Đề luyện</dt><dd>${esc(test.title)}</dd></div></dl>
      </section>
    </div>
    <section class="panel report-score" aria-label="Kết quả tổng hợp">
      <div class="report-score-hero">
        <div><h2 class="report-kicker">Điểm quy đổi luyện tập</h2><p class="report-score-value">${assessment.points} <small>/ ${scoreMaximum}</small></p><p class="report-score-note">${score.correct}/${test.questions.length} câu đúng · ${score.percent}% toàn bài${score.blank ? ` · ${score.blank} câu bỏ trống` : ''}</p></div>
        <div class="report-level"><h2 class="report-kicker">Mức tham chiếu</h2><p class="report-level-value">${assessment.label}</p><p class="report-score-note">${assessment.next ? `Mốc kế tiếp · ${assessment.next.point} điểm` : 'Mốc tham chiếu cao nhất'}</p></div>
      </div>
      <div class="report-scale-wrap">
        <div class="report-scale" id="report-scale" role="img" aria-label="Điểm quy đổi ${assessment.points} trên thang từ 10 đến 250. Mốc A1 145, A2.1 175, A2.2 200.">
          <div class="report-track" aria-hidden="true"><div class="report-spectrum"></div></div>
          ${scoreTicks.map(({point,name,suffix}) => `<div class="report-tick" data-score-tick="${point}" aria-hidden="true"><i></i><b>${point}</b>${name ? `<span>${name}${suffix ? `<span class="tick-suffix">${suffix}</span>` : ''}</span>` : ''}</div>`).join('')}
          <span class="report-marker" aria-hidden="true"></span><span class="report-marker-value" aria-hidden="true">${assessment.points}</span>
        </div>
        <p class="muted">Điểm quy đổi theo tỷ lệ câu đúng và mức tham chiếu dùng cho luyện tập. Điểm thi JFT-Basic chính thức được tính theo phương pháp thống kê của kỳ thi.</p>
      </div>
    </section>
    <section class="panel report-box report-skills" aria-labelledby="skills-title">
      <h2 id="skills-title">Tỷ lệ trả lời đúng theo từng phần</h2>
      <p class="muted">Số câu đúng và tỷ lệ của từng kỹ năng</p>
      <div class="report-skills-table">${score.totals.map(({correct,total},i) => total ? `<div class="report-skill">
        <span class="report-skill-number" aria-hidden="true">${number(i+1)}</span><div><h3>${sections[i]}</h3><span class="muted" lang="ja">${jaSections[i]}</span></div>
        <progress class="progress" value="${correct}" max="${total}" aria-label="${sections[i]}"></progress><span class="report-skill-count" aria-label="${correct} trên ${total} câu đúng">${correct}/${total}</span><strong>${Math.round(correct / total * 100)}%</strong>
      </div>` : '').join('')}</div>
    </section>`;
  }

  async function candidatePhoto(file) {
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      throw new Error('Hãy chọn ảnh JPG, PNG hoặc WebP tối đa 5 MB.');
    }
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const ratio = Math.min(1, 320 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
      const context = canvas.getContext('2d');
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', .82);
    } catch {
      throw new Error('Trình duyệt chưa đọc được ảnh này. Hãy chọn ảnh khác.');
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function editCandidate(record) {
    const old = record.candidate ?? {};
    showDialog('Thông tin thí sinh', `<p>Các mục đều tùy chọn và được lưu cùng kết quả trên trình duyệt này.</p>
      <form class="candidate-form" id="candidate-form">
        ${candidateFields.map(({key,label,type,length}) => `<label>${label}<input name="${key}" type="${type ?? 'text'}" ${length ? `maxlength="${length}"` : ''} value="${esc(old[key] ?? '')}"></label>`).join('')}
        <label class="candidate-upload">Ảnh thẻ <span>(JPG, PNG, WebP · tối đa 5 MB)</span><input name="photo" type="file" accept="image/jpeg,image/png,image/webp"></label>
        ${old.photo ? '<label class="candidate-remove"><input name="removePhoto" type="checkbox"> Bỏ ảnh thẻ hiện tại</label>' : ''}
        <p id="candidate-status" role="status" class="candidate-status"></p>
      </form>`, '<button class="ghost" id="dismiss">Hủy</button><button class="btn" id="candidate-save" type="submit" form="candidate-form">Lưu thông tin</button>');
    const form = $('candidate-form');
    $('dismiss').onclick = () => dialog.close();
    form.onsubmit = async (event) => {
      event.preventDefault();
      const button = $('candidate-save');
      if (button.disabled) return;
      const status = $('candidate-status');
      const data = new FormData(form);
      const candidate = Object.fromEntries(candidateFields.map(({key}) => [key, String(data.get(key) ?? '').trim()]));
      const file = data.get('photo');
      button.disabled = true;
      status.textContent = '';
      try {
        const photo = file?.size ? await candidatePhoto(file) : data.has('removePhoto') ? null : old.photo;
        if (!dialog.open || $('candidate-form') !== form || active?.record !== record) return;
        const latest = readLocal(active.test.id);
        if (latest && latest.start !== record.start) {
          throw new Error('Đã có lượt làm mới. Hãy mở lại kết quả mới nhất để điền thông tin.');
        }
        if (photo) candidate.photo = photo;
        const previous = record.candidate;
        record.candidate = candidate;
        if (!save()) {
          record.candidate = previous;
          throw new Error('Không lưu được thông tin trên trình duyệt này.');
        }
        dialog.close();
        result(true);
        $('edit-candidate').focus({preventScroll:true});
      } catch (error) {
        status.textContent = error.message;
      } finally {
        button.disabled = false;
      }
    };
  }

  function paintSystemResult() {
    const status = $('jft-sync-status');
    if (!status || !active) return;
    const {attemptId, systemResult} = active.record;
    const failed = syncFailed.has(attemptId);
    status.textContent = systemResult
      ? `Đã ghi vào hồ sơ IKIGAI WORLD · ${systemResult.score}/250 · +${systemResult.xp_awarded} XP.`
      : failed ? 'Chưa lưu lên hệ thống. Hãy bấm Gửi lại kết quả.'
        : 'Đang ghi kết quả và XP vào hồ sơ IKIGAI WORLD…';
    $('jft-sync-retry').hidden = !failed;
    $('retry').disabled = !systemResult;
  }

  async function syncResult(attempt) {
    const {test, record} = attempt;
    const id = record.attemptId;
    if (!id || record.systemResult || syncing.has(id)) return;
    syncing.add(id);
    syncFailed.delete(id);
    paintSystemResult();
    try {
      const receipt = await jftAccount.submit(accountId, test.id, id, record.answers, signal);
      record.systemResult = receipt;
      if (readLocal(test.id)?.attemptId === id) save(attempt);
      rememberSystemScore(receipt);
      paintRecentScores();
    } catch {
      syncFailed.add(id);
    } finally {
      syncing.delete(id);
      paintSystemResult();
    }
  }

  function result(preserveScroll = false) {
    screen = 'result';
    const {test, record} = active;
    const score = calculate(test, record.answers);
    const assessment = practiceAssessment(score.correct, test.questions.length);
    const y = host.scrollTop;
    const rows = test.questions.flatMap((q,i) => {
      const pick = record.answers[i];
      const status = pick === q.correct ? 'Đúng' : pick == null ? 'Bỏ trống' : 'Sai';
      if (filter === 'mistakes' && status === 'Đúng') return [];
      if (filter === 'blank' && status !== 'Bỏ trống') return [];
      return [`<details class="panel" data-review="${i}"><summary><span>Câu ${i+1}</span><span class="badge ${status === 'Sai' ? 'missed' : status === 'Bỏ trống' ? 'skipq' : ''}">${status}</span><span class="muted">${sections[q.section]}</span></summary><div class="review-body" data-review-body></div></details>`];
    });
    main.innerHTML = `${resultReport(test, record, score, assessment)}
    ${record.attemptId && accountId ? `<div class="panel jft-sync"><p id="jft-sync-status" role="status"></p>
      <button id="jft-sync-retry" class="ghost" type="button" hidden>Gửi lại kết quả</button></div>` :
      classExam(test.id) ? '<p class="muted jft-system-note">Điểm luyện tập của lượt này được xem trong tab đang mở.</p>' : ''}
    <div class="report-actions"><button class="ghost" id="result-back">${icon('back')} Danh sách đề</button><button class="ghost" id="retry">Làm lại đề</button><button class="btn" id="show-review" aria-expanded="${reviewOpen}" aria-controls="review-panel">Xem lại bài làm ${icon('arrow')}</button></div>
    <section id="review-panel" aria-labelledby="review-title" ${reviewOpen ? '' : 'hidden'}><div class="section-heading"><div><div class="review-controls"><h2 id="review-title" tabindex="-1">Xem lại bài làm</h2></div><div class="review-controls">
      ${[['all','Tất cả'],['mistakes','Sai hoặc bỏ trống'],['blank','Bỏ trống']].map(([key,label]) => `<button class="${filter === key ? 'btn' : 'ghost'}" data-filter="${key}" aria-pressed="${filter === key}">${label}</button>`).join('')}</div></div></div><div class="review-list">${rows.join('') || '<p class="muted">Không có câu nào trong nhóm này.</p>'}</div></section>`;
    const scale = $('report-scale');
    scale.style.setProperty('--score-position', scorePosition(assessment.points));
    scale.querySelectorAll('[data-score-tick]').forEach((tick) => { tick.style.left = scorePosition(Number(tick.dataset.scoreTick)); });
    $('edit-candidate').onclick = () => editCandidate(record);
    $('result-back').onclick = lobby;
    $('retry').onclick = () => confirmAction('Làm lại đề', 'Lượt mới sẽ thay kết quả gần nhất của đề này trên trình duyệt.', 'Bắt đầu lại', () => start(test, true));
    if ($('jft-sync-status')) {
      $('jft-sync-retry').onclick = () => syncResult(active);
      paintSystemResult();
      if (!syncFailed.has(record.attemptId)) void syncResult(active);
    }
    $('show-review').onclick = () => {
      reviewOpen = true;
      $('review-panel').hidden = false;
      $('show-review').setAttribute('aria-expanded', 'true');
      $('review-title').focus({preventScroll:true});
      $('review-title').scrollIntoView({block:'start'});
    };
    main.querySelectorAll('[data-filter]').forEach((button) => {
      button.onclick = () => { filter = button.dataset.filter; result(true); };
    });
    main.querySelectorAll('[data-review]').forEach((details) => {
      details.ontoggle = () => {
        if (!details.open || details.dataset.loaded) return;
        details.dataset.loaded = 'true';
        const i = Number(details.dataset.review);
        const q = test.questions[i];
        const pick = record.answers[i];
        const body = details.querySelector('[data-review-body]');
        body.innerHTML = `${questionBody(q)}
        ${q.listen ? `<div class="passage">${q.listen.questionVi ? `<p><strong>Câu hỏi</strong> · ${esc(q.listen.questionVi)}</p>` : ''}${q.listen.turns.map(([role,line]) => `<p><strong>${esc(role)}</strong> · <span lang="ja">${esc(line)}</span></p>`).join('')}<p lang="ja">${esc(q.listen.question)}</p></div>` : ''}
        <p><strong>Bạn chọn</strong> · ${pick == null ? 'Bỏ trống' : `${letter(pick)} · <span lang="ja">${esc(q.options[pick])}</span>`}</p>
        <p><strong>Đáp án</strong> · ${letter(q.correct)} · <span lang="ja">${esc(q.options[q.correct])}</span></p><p><strong>Giải thích</strong> · ${esc(q.explanation)}</p>`;
        bindFigures(body, q);
      };
    });
    if (preserveScroll) {
      host.scrollTo(0, y);
      main.querySelector(`[data-filter="${filter}"]`)?.focus({preventScroll:true});
    } else top();
  }

  const audioKey = (test, question) => `${test.id}-${number(question)}`;
  const getJaVoices = () => window.speechSynthesis?.getVoices().filter((voice) => /^ja\b/i.test(voice.lang) && voice.localService) ?? [];
  window.speechSynthesis?.getVoices();

  function listensLeft(index) {
    const saved = readLocal(active.test.id);
    if (saved?.start === active.record.start) {
      active.record.listens[index] = Math.max(active.record.listens[index] ?? 0, saved.listens?.[index] ?? 0);
    }
    return Math.max(0, listenLimit - (active.record.listens[index] ?? 0));
  }

  function updateListenControls() {
    const play = $('play');
    if (!play || screen !== 'exam') return;
    const left = listensLeft(active.record.index);
    play.disabled = audioBusy || !left || play.dataset.loading === 'true';
    $('stop').hidden = !audioBusy;
    $('listen-count').textContent = left ? `Còn ${left}/${listenLimit} lượt nghe` : 'Đã hết lượt nghe';
  }

  function stopAudio(message) {
    audioGeneration++;
    if (playingAudio) {
      playingAudio.onplaying = null;
      playingAudio.onended = null;
      playingAudio.onerror = null;
      playingAudio.pause();
    }
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = null;
    playingAudio = null;
    audioBusy = false;
    window.speechSynthesis?.cancel();
    updateListenControls();
    if (message && $('listen-status')) $('listen-status').textContent = message;
  }

  function voicePair(voices) {
    const female = /kyoko|nanami|haruka|female|京子|はるか/i;
    const male = /otoya|keita|daichi|(?<!fe)male|大地|音也/i;
    const woman = voices.find((voice) => female.test(voice.name)) ?? voices.find((voice) => !male.test(voice.name)) ?? voices[0];
    const man = voices.find((voice) => male.test(voice.name)) ?? voices.find((voice) => voice !== woman) ?? woman;
    return {Nam:man, Nữ:woman};
  }

  function speech(text, voice, onStart) {
    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.rate = .96;
      utterance.onstart = onStart;
      utterance.onend = resolve;
      utterance.onerror = reject;
      speechSynthesis.speak(utterance);
    });
  }

  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function setupListening(listen, audioName, index) {
    const play = $('play');
    const status = $('listen-status');
    const attach = audioNames.includes(audioName);
    let file = null;
    updateListenControls();
    if (attach && listensLeft(index)) {
      play.dataset.loading = 'true';
      updateListenControls();
      status.textContent = 'Đang chuẩn bị tệp âm thanh…';
      dbGet('audio:' + audioName).then((blob) => { file = blob; }).catch(() => {}).finally(() => {
        if ($('play') !== play) return;
        delete play.dataset.loading;
        status.textContent = 'Mỗi câu có tối đa 2 lượt phát trong một lần làm đề.';
        updateListenControls();
      });
    }
    play.onclick = () => playQuestion(listen, index, file);
    $('stop').onclick = () => stopAudio('Đã dừng phát.');
  }

  async function playQuestion(listen, index, file) {
    if (audioBusy || !listensLeft(index)) return;
    const generation = ++audioGeneration;
    const status = $('listen-status');
    audioBusy = true;
    updateListenControls();
    status.textContent = 'Đang chuẩn bị âm thanh…';
    let started = false;
    const markStarted = () => {
      if (generation !== audioGeneration || started) return;
      if (!listensLeft(index)) {
        stopAudio('Đã hết lượt nghe.');
        return;
      }
      started = true;
      active.record.listens[index] = (active.record.listens[index] ?? 0) + 1;
      save();
      updateListenControls();
      status.textContent = 'Đang phát đoạn nghe tiếng Nhật…';
    };
    const done = () => {
      if (generation !== audioGeneration) return;
      stopAudio(listensLeft(index) ? 'Đã phát xong. Bạn còn một lượt nghe.' : 'Đã phát xong hai lượt.');
    };
    const fail = () => {
      if (generation !== audioGeneration) return;
      stopAudio('Trình duyệt chưa phát được âm thanh. Hãy thử lại.');
    };
    try {
      const blob = file ?? (listen.mp3 ? new Blob([Uint8Array.from(atob(listen.mp3), (c) => c.charCodeAt(0))], {type:'audio/mpeg'}) : null);
      if (blob || listen.file) {
        if (blob) audioUrl = URL.createObjectURL(blob);
        playingAudio = new Audio(audioUrl ?? new URL(listen.file, import.meta.url).href);
        playingAudio.onplaying = markStarted;
        playingAudio.onended = done;
        playingAudio.onerror = fail;
        await playingAudio.play();
        return;
      }
      const voices = getJaVoices();
      if (!voices.length) throw new Error('Hãy nhập bản đề có sẵn audio hoặc gắn tệp MP3/WAV trong Quản lý đề.');
      const pair = voicePair(voices);
      for (const [role, line] of listen.turns) {
        if (generation !== audioGeneration) return;
        await speech(line, pair[role], markStarted);
        await pause(430);
      }
      done();
    } catch (error) {
      if (generation !== audioGeneration) return;
      if (error instanceof Error && !(file || listen.mp3 || listen.file)) stopAudio(error.message);
      else fail();
    }
  }

  const textWithin = (value, max) => typeof value === 'string' && value.length <= max;
  const nonempty = (value, max) => textWithin(value, max) && value.trim().length > 0;

  function validatePackage(data) {
    if (data?.format !== 'ikigai-jft-1' || !nonempty(data.source, 200) ||
        !Array.isArray(data.tests) || !data.tests.length || data.tests.length > 50) {
      throw new Error('Tệp chưa đúng định dạng dữ liệu đề IKIGAI JFT.');
    }
    const ids = new Set();
    return data.tests.map((test,i) => {
      const label = `Đề thứ ${i+1}`;
      if (!test || !/^[a-z0-9][a-z0-9-]{0,49}$/.test(test.id ?? '') || test.id === demo.id ||
          ids.has(test.id) || !nonempty(test.title,120) || !Number.isInteger(test.minutes) ||
          test.minutes < 1 || test.minutes > 180 || !Array.isArray(test.questions) ||
          !test.questions.length || test.questions.length > 150) {
        throw new Error(label + ' thiếu mã, tên, thời lượng hoặc danh sách câu hỏi hợp lệ.');
      }
      ids.add(test.id);
      const questions = test.questions.map((q,j) => {
        const validListen = q?.listen && nonempty(q.listen.question, 1500) &&
          (q.listen.questionVi == null || nonempty(q.listen.questionVi, 1500)) &&
          (q.listen.mp3 == null || (textWithin(q.listen.mp3, 850000) && /^[A-Za-z0-9+/]+={0,2}$/.test(q.listen.mp3) && q.listen.mp3.length % 4 === 0)) &&
          Array.isArray(q.listen.turns) && q.listen.turns.length >= 1 && q.listen.turns.length <= 20 &&
          q.listen.turns.every((turn) => Array.isArray(turn) && turn.length === 2 &&
            ['Nam','Nữ'].includes(turn[0]) && nonempty(turn[1], 5000));
        if (!q || !Number.isInteger(q.section) || q.section < 0 || q.section > 3 ||
            !nonempty(q.instruction,500) || !textWithin(q.prompt,3000) ||
            (q.passage != null && !textWithin(q.passage,8000)) ||
            (q.underlined != null && (!nonempty(q.underlined,200) || !q.prompt.includes(q.underlined))) ||
            (q.figure != null && !safeImage(q.figure)) || (q.sourceView != null && !safeImage(q.sourceView)) ||
            (q.section === 2 ? !validListen : !q.prompt && !q.figure && !q.passage) ||
            !Array.isArray(q.options) || q.options.length < 2 || q.options.length > 4 ||
            !q.options.every((option) => nonempty(option,2500)) || !Number.isInteger(q.correct) ||
            q.correct < 0 || q.correct >= q.options.length || !nonempty(q.explanation,5000)) {
          throw new Error(`${label}, câu ${j+1} chưa đủ dữ liệu hợp lệ.`);
        }
        const {section,instruction,prompt,passage,underlined,figure,sourceView,options,correct,explanation} = q;
        const listen = q.section === 2 ? {
          question:q.listen.question, questionVi:q.listen.questionVi, turns:q.listen.turns, mp3:q.listen.mp3
        } : undefined;
        return {section,instruction,prompt,passage,underlined,figure,sourceView,options,correct,explanation,
          listen};
      });
      return {id:test.id,title:test.title,minutes:test.minutes,questions,source:data.source};
    });
  }

  function manage() {
    stopAudio();
    screen = 'manage';
    active = null;
    main.innerHTML = `<div class="exam-top"><button class="ghost" id="manage-back">${icon('back')} Danh sách đề</button></div>
      <div class="exam-head"><h1>Quản lý đề cá nhân</h1><p class="muted">Dữ liệu đề và âm thanh chỉ nằm trên trình duyệt này.</p></div>
      <section class="panel manage-panel"><h2>Nhập bộ đề</h2><p class="muted">Chọn tệp JSON định dạng IKIGAI JFT mà bạn có quyền sử dụng. Khi nhập bản mới chỉ cập nhật phần nghe, tiến độ làm bài vẫn được giữ.</p>
        <label for="import-file"><strong>Tệp bộ đề (.json)</strong></label>
        <input type="file" id="import-file" accept=".json,application/json">
        <div class="manage-actions"><button class="btn" id="import">${icon('file')} Nhập vào trình duyệt</button>${library.length ? '<button class="ghost" id="remove-package">Xóa đề cá nhân trên máy này</button>' : ''}</div>
        <p class="muted" id="import-status" role="status">${library.length ? `Đã nhập ${library.length} đề · ${library.reduce((sum,test) => sum + test.questions.length,0)} câu.` : 'Chưa nhập bộ đề cá nhân.'}</p>
      </section>
      <section class="panel manage-panel"><h2>Gắn âm thanh tiếng Nhật</h2><p class="muted">Các đề mới có sẵn audio. Bạn cũng có thể gắn tệp riêng để thay đoạn nghe của từng câu.</p>
        <p class="privacy-note">Đặt tên tệp theo mã đề và số câu. Ví dụ <strong>sore-vol1-01-27.mp3</strong> cho Đề 01, câu 27 và <strong>ikigai-demo-05.mp3</strong> cho câu 5 của bài mẫu. Có thể chọn nhiều tệp cùng lúc.</p>
        <label for="audio-files" class="muted">Chọn tệp MP3, WAV, M4A hoặc OGG</label>
        <input type="file" id="audio-files" accept=".mp3,.wav,.m4a,.ogg,audio/*" multiple>
        <div class="manage-actions"><button class="btn" id="attach">Gắn tệp âm thanh</button></div>
        <p class="muted" id="attach-status" role="status">${audioNames.length} tệp âm thanh đã gắn trên trình duyệt này.</p>
      </section>`;
    $('manage-back').onclick = lobby;
    $('import').onclick = importPackage;
    $('attach').onclick = attachAudio;
    if ($('remove-package')) $('remove-package').onclick = () => confirmAction('Xóa đề cá nhân', 'Thao tác này xóa các đề đã nhập, tiến độ và tệp nghe liên quan trên trình duyệt này.', 'Xóa đề', removePackage);
    top();
  }

  async function importPackage() {
    const file = $('import-file').files[0];
    const button = $('import');
    const status = $('import-status');
    if (!file) { status.textContent = 'Hãy chọn tệp JSON trước.'; return; }
    if (file.size > 32 * 1024 * 1024) { status.textContent = 'Tệp vượt giới hạn 32 MB.'; return; }
    button.disabled = true;
    status.textContent = 'Đang kiểm tra dữ liệu…';
    try {
      if (!db) throw new Error('Trình duyệt đang chặn bộ nhớ cục bộ.');
      let raw;
      try { raw = JSON.parse(await file.text()); }
      catch { throw new Error('Tệp này không đọc được dưới dạng JSON.'); }
      const parsed = validatePackage(raw);
      const updatedIds = new Set(parsed.map((test) => test.id));
      const merged = [...library.filter((test) => !updatedIds.has(test.id)), ...parsed];
      if (merged.length > 50) throw new Error('Chỉ có thể lưu tối đa 50 đề trên một trình duyệt.');
      const reset = parsed.filter((test) => {
        const prior = library.find((old) => old.id === test.id);
        return prior && !sameExamQuestions(prior.questions, test.questions);
      });
      await dbPut('tests', merged);
      library = merged;
      try { for (const test of reset) localStorage.removeItem(attemptKey(test.id)); } catch {}
      const count = parsed.reduce((total, test) => total + test.questions.length, 0);
      toast(`Đã nhập ${parsed.length} đề và ${count} câu.`);
      if (screen === 'manage') lobby();
    } catch (error) {
      status.textContent = error.message || 'Không nhập được bộ đề.';
    } finally {
      button.disabled = false;
    }
  }

  function sameExamQuestions(old, current) {
    return old.length === current.length && old.every((q, i) => {
      const next = current[i];
      return q.section === next.section && q.prompt === next.prompt && q.passage === next.passage &&
        q.correct === next.correct && q.options.length === next.options.length && q.options.every((option, j) => option === next.options[j]);
    });
  }

  async function removePackage() {
    const ids = new Set(library.map((test) => test.id));
    const keys = audioNames.filter((name) => [...ids].some((id) => name.startsWith(id + '-')));
    try {
      const remainingAudio = audioNames.filter((name) => !keys.includes(name));
      await storage('readwrite', (store) => {
        store.delete('tests');
        for (const key of keys) store.delete('audio:' + key);
        return store.put(remainingAudio, 'audioNames');
      });
      audioNames = remainingAudio;
      library = [];
      try { for (const id of ids) localStorage.removeItem(attemptKey(id)); } catch {}
      toast('Đã xóa các đề cá nhân.');
      if (screen === 'manage') manage();
    } catch { toast('Chưa xóa được đề trên trình duyệt này.'); }
  }

  async function attachAudio() {
    const files = Array.from($('audio-files').files);
    const button = $('attach');
    const status = $('attach-status');
    if (!files.length) { status.textContent = 'Hãy chọn tệp âm thanh.'; return; }
    button.disabled = true;
    try {
      if (!db) throw new Error('Trình duyệt đang chặn bộ nhớ cục bộ.');
      const allowed = new Set([demo,...library].flatMap((test) => test.questions.flatMap((q,i) => q.listen ? [audioKey(test,i+1)] : [])));
      const selected = new Map();
      const rejected = [];
      for (const file of files) {
        const match = /^(.+)\.(mp3|wav|m4a|ogg)$/i.exec(file.name);
        if (!match || !allowed.has(match[1]) || file.size < 1 || file.size > 25 * 1024 * 1024) {
          rejected.push(file.name);
          continue;
        }
        const types = {mp3:'audio/mpeg',wav:'audio/wav',m4a:'audio/mp4',ogg:'audio/ogg'};
        selected.set(match[1], file.slice(0, file.size, types[match[2].toLowerCase()]));
      }
      const nextNames = [...new Set([...audioNames,...selected.keys()])];
      if (selected.size) await storage('readwrite', (store) => {
        for (const [key,blob] of selected) store.put(blob, 'audio:' + key);
        return store.put(nextNames, 'audioNames');
      });
      audioNames = nextNames;
      status.textContent = `Đã gắn ${selected.size} tệp.` + (rejected.length ? ` Kiểm tra tên, định dạng hoặc kích thước (tối đa 25 MB) của ${rejected.length} tệp: ${rejected.slice(0,3).join(', ')}.` : '');
    } catch (error) {
      status.textContent = error.message || 'Không lưu được tệp âm thanh.';
    } finally { button.disabled = false; }
  }

  window.addEventListener('storage', (event) => {
    if (active && event.key === attemptKey(active.test.id)) updateListenControls();
  }, {signal});
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopAudio('Đã dừng phát khi rời trang.');
    else updateClock();
  }, {signal});
  const clock = setInterval(updateClock, 500);
  signal.addEventListener('abort', () => {
    clearInterval(clock);
    clearTimeout(toastTimer);
    stopAudio();
    view.replaceChildren();
  }, {once:true});
  if (classLink) {
    examAccess = await classLink.verify(signal) === 'ready';
  } else {
    try {
      db = await openDB();
      [library,audioNames] = await Promise.all([dbGet('tests'),dbGet('audioNames')]);
      library ??= [];
      audioNames ??= [];
    } catch {}
  }
  if (!signal.aborted) lobby();
}
