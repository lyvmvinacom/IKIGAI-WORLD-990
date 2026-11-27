(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const panel = $('teacherExamHistory');
  const level = $('examHistoryLevel');
  const search = $('examHistorySearch');
  const student = $('examHistoryStudent');
  const exam = $('examHistoryExam');
  const status = $('examHistoryStatus');
  const results = $('examHistoryResults');
  const previous = $('examHistoryPrevious');
  const next = $('examHistoryNext');
  const close = $('examHistoryClose');
  const pageSize = 25;
  const skillNames = {
    vocabulary: 'Từ vựng', grammar: 'Ngữ pháp', reading: 'Đọc hiểu',
    listening: 'Nghe hiểu', characters: 'Chữ viết & từ vựng', conversation: 'Hội thoại & diễn đạt'
  };
  const date = new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh'
  });
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const normalize = text => text.toLocaleLowerCase('vi').normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd');

  let getContext = () => ({});
  let roster = [];
  let returnFocus;
  let requestId = 0;
  let offset = 0;

  function isTeacher() {
    const { user, role } = getContext();
    return role === 'teacher' && user?.app_metadata?.role === 'teacher';
  }

  function setOptions(select, label, entries, selected) {
    select.replaceChildren(new Option(label, ''), ...entries.map(({ id, title }) => new Option(title, id)));
    select.value = entries.some(({ id }) => id === selected) ? selected : '';
  }

  function updateStudents() {
    const query = normalize(search.value.trim());
    const selected = student.value;
    const matches = roster.filter(({ id, title }) => id === selected || normalize(title).includes(query) || id.startsWith(query));
    setOptions(student, 'Tất cả học viên', matches, selected);
  }

  function renderRow(row) {
    const skills = (row.skills ?? []).filter(skill => skillNames[skill.group] && skill.total > 0);
    const weakest = skills.reduce((low, skill) => {
      if (!low || skill.correct * low.total < low.correct * skill.total) return skill;
      return low;
    }, null);
    const needsPractice = skill => weakest && weakest.correct < weakest.total &&
      skill.correct * weakest.total === weakest.correct * skill.total;
    const priorities = skills.filter(needsPractice).map(skill => skillNames[skill.group]);
    const jft = level.value === 'jft';
    const maxScore = jft ? 250 : 180;
    const resultLabel = row.reached_target == null ? '' :
      row.reached_target ? (jft ? 'Đạt mốc A2' : 'Đạt') : (jft ? 'Dưới mốc A2' : 'Chưa đạt');

    return `<article class="exam-history-attempt">
      <header><div><h3>${escape(row.student_name)}</h3><p>${escape(row.title || row.exam_id)} · ${escape(date.format(new Date(row.submitted_at)))}</p></div>
        <div class="exam-history-score"><strong>${row.score == null ? '—' : `${Number(row.score)}/${maxScore}`}</strong>
          <span>${resultLabel}</span></div></header>
      <ul>${skills.map(skill => `<li class="${needsPractice(skill) ? 'exam-history-low' : ''}">
        <span>${skillNames[skill.group]}</span><b>${Number(skill.correct)}/${Number(skill.total)}</b>
        <small>${Math.round(skill.correct * 100 / skill.total)}%</small></li>`).join('')}</ul>
      ${priorities.length ? `<p class="exam-history-priority">Tỷ lệ đúng thấp nhất · ${priorities.join(', ')}</p>` : ''}
    </article>`;
  }

  async function load(pageOffset = 0) {
    if (!isTeacher() || panel.hidden) return;
    const current = ++requestId;
    const { client, user } = getContext();
    const filters = {
      p_level: level.value,
      p_student: student.value || null,
      p_exam: exam.value || null,
      p_offset: pageOffset
    };
    previous.disabled = next.disabled = true;
    status.textContent = 'Đang tải lịch sử thi…';
    results.replaceChildren();
    results.scrollTop = 0;
    try {
      const { data, error } = await client.rpc('ikigai_teacher_exam_history', filters);
      if (current !== requestId || !isTeacher() || getContext().user?.id !== user.id) return;
      if (error) throw error;
      if (data.students) {
        const counts = new Map();
        for (const entry of data.students) counts.set(entry.name, (counts.get(entry.name) ?? 0) + 1);
        roster = data.students.map(({ id, name }) => ({
          id, title: counts.get(name) > 1 ? `${name} · ${id.slice(0, 8)}` : name
        })).sort((a, b) => a.title.localeCompare(b.title, 'vi'));
        updateStudents();
        setOptions(exam, 'Tất cả đề thi', data.exams, filters.p_exam);
      }
      if (pageOffset && !data.rows.length) {
        void load(Math.max(0, Math.floor((data.count - 1) / pageSize) * pageSize));
        return;
      }
      offset = pageOffset;
      previous.disabled = offset === 0;
      next.disabled = offset + data.rows.length >= data.count;
      status.textContent = data.count
        ? `Lượt ${offset + 1}–${offset + data.rows.length} / ${data.count} · Mới nhất trước · Điểm thi thử`
        : 'Chưa có bài thi đã nộp theo bộ lọc này.';
      results.innerHTML = data.rows.map(renderRow).join('');
    } catch (error) {
      if (current !== requestId) return;
      status.textContent = 'Chưa tải được lịch sử thi. Bấm Tải lại để thử lại.';
      console.warn('Exam history:', error);
    }
  }

  function hide() {
    requestId++;
    panel.hidden = true;
    roster = [];
    results.replaceChildren();
    setOptions(student, 'Tất cả học viên', [], '');
    setOptions(exam, 'Tất cả đề thi', [], '');
    returnFocus?.focus();
  }

  function open(initialLevel, trigger) {
    if (!isTeacher()) return;
    returnFocus = trigger;
    level.value = initialLevel;
    search.value = '';
    panel.hidden = false;
    close.focus();
    void load();
  }

  window.IKIGAI_EXAM_HISTORY = {
    init(context) {
      getContext = context;
      $('openExamHistory').hidden = !isTeacher();
    },
    open
  };

  $('openExamHistory').onclick = event => open('n5', event.currentTarget);
  close.onclick = hide;
  level.onchange = () => {
    setOptions(exam, 'Tất cả đề thi', [], '');
    void load();
  };
  search.oninput = updateStudents;
  student.onchange = exam.onchange = $('examHistoryRefresh').onclick = () => void load();
  previous.onclick = () => void load(offset - pageSize);
  next.onclick = () => void load(offset + pageSize);

  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      hide();
    } else if (event.key === 'Tab') {
      const controls = [...panel.querySelectorAll('button:not(:disabled), input, select')];
      const boundary = event.shiftKey ? controls[0] : controls.at(-1);
      if (document.activeElement === boundary) {
        event.preventDefault();
        (event.shiftKey ? controls.at(-1) : controls[0]).focus();
      }
    }
    event.stopPropagation();
  });
})();
