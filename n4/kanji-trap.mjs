import { exampleRuby, lessons, questions, ruby, shuffle } from './kanji-trap-bank.mjs?v=illustrations-1';

const cold = {
  冷たい: ['Lạnh khi chạm hoặc uống.', 'Nước này rất lạnh.', 0],
  冷える: ['Cơ thể hoặc vật trở nên lạnh.', 'Đến tối, tay chân trở nên lạnh.', 1],
  冷める: ['Đồ nóng tự nguội đi.', 'Đợi đến khi trà nóng nguội.', 2],
  冷やす: ['Chủ động làm cho lạnh.', 'Làm lạnh nước ép trong tủ lạnh.', 3]
};

function wordCard(group, word) {
  const note = group === 14 ? cold[word.text] : null;
  const tile = word.illustration % 28;
  const sheet = note ? 'cold' : Math.floor(word.illustration / 28) + 1;
  const columns = note ? 2 : 7;
  const rows = note ? 2 : 4;
  const cell = note ? note[2] : tile;
  const image = new URL(`./kanji-trap-art-${sheet}.webp`, import.meta.url).href;
  const left = -(cell % columns) * 100;
  const top = -Math.floor(cell / columns) * 100;
  const title = ruby(word.text, word.reading);
  return `<article class="kt-word-card">
    <div class="kt-word-art" aria-hidden="true"><div class="kt-art-tile">
      <img src="${image}" alt="" decoding="async" style="width:${columns * 100}%;height:${rows * 100}%;left:${left}%;top:${top}%">
    </div></div>
    <h4 lang="ja">${title}</h4>
    <small class="kt-type">${word.type}</small><p>${note?.[0] ?? word.meaning}</p>
    <div class="kt-example"><span lang="ja">${exampleRuby(word.example, title)}</span>${note ? `<small>${note[1]}</small>` : ''}</div>
  </article>`;
}

export function mountKanjiTrap(host, onClose) {
  host.hidden = false;
  host.classList.add('kt-host');
  let lesson = 0;
  let alive = true;
  const diary = label => window.IKIGAI_DIARY?.study(label, host);
  const close = () => {
    if (!alive) return;
    alive = false;
    diary(null);
    host.hidden = true;
    host.classList.remove('kt-host');
    host.replaceChildren();
    onClose?.();
  };
  function render(title, body, back) {
    host.innerHTML = `<section class="kt-shell" aria-label="Bẫy Kanji"><header class="kt-header">
      ${back ? '<button type="button" data-back>← Quay lại</button>' : ''}
      <h2>${title}</h2><button type="button" data-close aria-label="Đóng Bẫy Kanji">×</button></header>
      <div class="kt-body">${body}</div></section>`;
    host.querySelector('[data-close]').onclick = close;
    if (back) host.querySelector('[data-back]').onclick = back;
  }
  function menu() {
    diary(null);
    render('KANJI TRAP · Bẫy Kanji', `<div class="kt-cover" aria-hidden="true"></div><div class="kt-grid">${lessons.map((items, index) => `
      <button type="button" data-lesson="${index}">
        <i class="kt-thumbnail" aria-hidden="true" style="--kt-x:${(index % 5)*25}%;--kt-y:${Math.floor(index / 5)*100/3}%"></i>
        <span>Bài ${index + 1}${index >= 18 ? ' · N3 mở rộng' : ''}</span>
        <strong lang="ja">${items.map(group => group.kanji).join(' ')}</strong>
      </button>`).join('')}</div>`);
    for (const button of host.querySelectorAll('[data-lesson]')) {
      button.onclick = () => { lesson = Number(button.dataset.lesson); study(); };
    }
  }
  function log(label) {
    diary(`Bẫy Kanji · Bài ${lesson + 1} · ${label}`);
  }
  function study() {
    log('Học từ');
    render(`Bài ${lesson + 1} · Học từ`, `<nav class="kt-modes">
      <button type="button" data-mode="reading">Luyện cách đọc · 15 câu</button>
      <button type="button" data-mode="usage">Luyện cách dùng · 15 câu</button></nav>
      <div class="kt-study-groups">${lessons[lesson].map(group => `<section class="kt-study-group">
        <h3><span lang="ja">${group.kanji}</span> <small>Nhóm ${group.id}/100 · ${group.level}</small></h3>
        <div class="kt-word-grid">${group.words.map(word => wordCard(group.id, word)).join('')}</div>
      </section>`).join('')}</div>`, menu);
    for (const button of host.querySelectorAll('[data-mode]')) button.onclick = () => practice(button.dataset.mode);
  }
  function practice(mode) {
    const reading = mode === 'reading';
    const title = reading ? 'Luyện cách đọc' : 'Luyện cách dùng';
    const bank = shuffle(questions(lesson, mode));
    const attempt = crypto.randomUUID();
    let position = 0;
    let score = 0;
    log(title);

    function finish() {
      diary(null);
      render(title, `<div class="kt-result"><h3>${score}/${bank.length} câu đúng</h3>
        <p class="kt-feedback" role="status"></p><button type="button" data-replay>Luyện lại</button></div>`, study);
      host.querySelector('[data-replay]').onclick = () => practice(mode);
      const status = host.querySelector('.kt-feedback');
      const sync = async () => {
        status.textContent = 'Đang đồng bộ EXP và xu…';
        try {
          const award = await window.IKIGAI_REWARD_CLIENT.rpc('ikigai_award_quiz', {
            p_xp: score * 10, p_coins: 50, p_correct: score, p_total: bank.length, p_attempt_id: attempt
          });
          if (!status.isConnected) return;
          status.textContent = award?.guest ? 'Tài khoản này luyện tập không nhận thưởng.'
            : `Đã ghi ${score * 10} EXP và ${award.coins_awarded ?? 0} xu.`;
        } catch {
          if (!status.isConnected) return;
          status.textContent = 'Đồng bộ thưởng chưa thành công. ';
          const retry = document.createElement('button');
          retry.type = 'button';
          retry.textContent = 'Thử lại';
          retry.onclick = sync;
          status.append(retry);
        }
      };
      void sync();
    }
    function display() {
      const question = bank[position];
      const prompt = exampleRuby(question.sentence, reading ? `<strong>${question.word.text}</strong>` : '＿＿＿');
      const options = shuffle(question.options);
      render(title, `<div class="kt-question">
        <small>Bài ${lesson + 1} · Câu ${position + 1}/${bank.length}</small>
        <p lang="ja">${prompt}</p>
        <span>${reading ? 'Chọn cách đọc của từ in đậm.' : `Chọn từ phù hợp · ${question.word.meaning}`}</span>
        <div class="kt-options">${options.map((option, index) => `<button type="button" lang="ja" data-option="${index}">${option}</button>`).join('')}</div>
        <div class="kt-feedback" role="status"></div><button type="button" data-next hidden>Câu tiếp</button>
      </div>`, study);
      const buttons = Array.from(host.querySelectorAll('[data-option]'));
      const next = host.querySelector('[data-next]');
      for (const [index, button] of buttons.entries()) {
        button.onclick = () => {
          if (button.disabled) return;
          buttons.forEach(item => { item.disabled = true; });
          const correct = options[index] === question.answer;
          if (correct) score++;
          button.dataset.result = correct ? 'correct' : 'wrong';
          buttons[options.indexOf(question.answer)].dataset.result = 'correct';
          host.querySelector('.kt-feedback').innerHTML = `${correct ? 'Chính xác' : 'Đáp án'} ·
            <span lang="ja">${ruby(question.word.text, question.word.reading)}</span> · ${question.word.meaning}`;
          next.hidden = false;
          next.textContent = position + 1 === bank.length ? 'Xem kết quả' : 'Câu tiếp';
          next.focus();
        };
      }
      next.onclick = () => { position++; if (position === bank.length) finish(); else display(); };
    }
    display();
  }
  menu();
  return close;
}
