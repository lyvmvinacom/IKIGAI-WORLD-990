(() => {
  'use strict';

  const rooms = { class: 'Lớp học IKIGAI', n5: 'Phòng N5', n4: 'Phòng N4', jft: 'Phòng JFT' };
  const groups = {
    vocabulary: 'Từ vựng', grammar: 'Ngữ pháp / Hyōgen', kanji: 'Kanji',
    kaiwa: 'Kaiwa', reading: 'Đọc hiểu', mock: 'Thi thử'
  };
  const headers = ['Mã câu', 'Chuyên mục', 'Bài', 'Câu hỏi', 'A', 'B', 'C', 'D', 'Đáp án', 'Giải thích'];
  const sheetName = 'Câu hỏi';
  const limit = 1000;
  const categories = room => room === 'class'
    ? ['grammar','kaiwa']
    : ['vocabulary','grammar','kanji','reading','mock'];
  const clean = value => String(value ?? '').trim();
  let spreadsheet;

  function loadSpreadsheet() {
    if (!spreadsheet) {
      spreadsheet = import('https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs')
        .catch(error => { spreadsheet = null; throw error; });
    }
    return spreadsheet;
  }

  async function load(client, room, defaults) {
    const {data, error} = await client.rpc('ikigai_get_room_questions', {p_room:room});
    if (error) throw error;
    const merged = new Map(data.use_defaults ? defaults.map(row => [String(row.id), row]) : []);
    for (const row of data.questions) merged.set(row.id,row);
    return {rows:[...merged.values()].filter(row=>room!=='class'||!['vocabulary','kanji'].includes(row.group)), usesDefaults:data.use_defaults};
  }

  function questionFromCells(cells, room) {
    const [id, rawGroup, lesson, question, a, b, c, d, answer, explanation] =
      Array.from({length: headers.length}, (_, i) => clean(cells[i]));
    const group=room==='jft'&&rawGroup==='hyogen'?'grammar':rawGroup;
    const options = [a,b,c,d];
    const correct = answer.toUpperCase();
    if (!/^[A-Za-z0-9_.:-]{1,64}$/.test(id)) throw Error('Mã câu cần từ 1–64 ký tự, không dấu và không có khoảng trắng.');
    if (!categories(room).includes(group)) throw Error('Chuyên mục không hợp lệ cho phòng này.');
    if (!/^([1-9]|1[0-9]|2[0-5])$/.test(lesson)) throw Error('Bài phải là số nguyên từ 1 đến 25.');
    if (!question || question.length > 2000) throw Error('Câu hỏi cần từ 1–2.000 ký tự.');
    if (options.some(o => !o || o.length > 500) || new Set(options).size !== 4) throw Error('Cần đủ 4 lựa chọn khác nhau, mỗi lựa chọn tối đa 500 ký tự.');
    if (!/^[ABCD]$/.test(correct)) throw Error('Đáp án đúng phải là A, B, C hoặc D.');
    if (explanation.length > 2000) throw Error('Giải thích tối đa 2.000 ký tự.');
    return {room,id,group,lesson:Number(lesson),question,options,correct,explanation};
  }

  async function downloadTemplate(room) {
    const xlsx = await loadSpreadsheet();
    const book = xlsx.utils.book_new();
    const sheet = xlsx.utils.aoa_to_sheet([headers]);
    sheet['!cols'] = [18,16,8,50,24,24,24,24,12,44].map(wch => ({wch}));
    xlsx.utils.book_append_sheet(book, sheet, sheetName);
    const guide = xlsx.utils.aoa_to_sheet([
      ['Phòng áp dụng', rooms[room]],
      ['Mã câu', 'Dùng mã riêng không dấu. Nạp lại cùng mã trong cùng phòng sẽ cập nhật câu đó.'],
      ['Chuyên mục', 'Điền mã ở cột bên dưới.'],
      ['Bài', 'Nhập số 1 đến 25.'],
      ['A, B, C, D', 'Nhập đủ bốn lựa chọn khác nhau.'],
      ['Đáp án', 'Nhập A, B, C hoặc D.'],
      ['Giải thích', 'Có thể để trống.'],
      ['Nạp dữ liệu', 'Giữ nguyên dòng tiêu đề và chọn đúng phòng trong game. Tối đa 1.000 câu mỗi lần.'],
      ['Thay toàn bộ', 'Chỉ dùng khi file chứa toàn bộ ngân hàng mới của phòng. Câu cũ và câu có sẵn sẽ ngừng xuất hiện trong phòng.'],
      [], ['Mã chuyên mục', 'Tên chuyên mục'],
      ...categories(room).map(key => [key,groups[key]])
    ]);
    guide['!cols'] = [{wch:24},{wch:96}];
    xlsx.utils.book_append_sheet(book, guide, 'Hướng dẫn');
    xlsx.writeFile(book, `IKIGAI-Mau-cau-hoi-${room.toUpperCase()}.xlsx`, {compression:true});
  }

  async function readWorkbook(file, room) {
    if (!/\.xlsx$/i.test(file.name) || file.size > 5 * 1024 * 1024) throw Error('Chọn file .xlsx không quá 5 MB.');
    const xlsx = await loadSpreadsheet();
    const book = xlsx.read(await file.arrayBuffer(), {sheetRows:limit+2,sheets:[sheetName,'Hướng dẫn']});
    const templateRoom = book.Sheets['Hướng dẫn']?.B1?.v;
    if (templateRoom && templateRoom !== rooms[room]) throw Error('File này thuộc '+templateRoom+'. Hãy chọn đúng phòng trước khi nạp.');
    const sheet = book.Sheets[sheetName];
    if (!sheet?.['!ref']) throw Error('Không thấy tab “Câu hỏi”. Hãy dùng mẫu tải trong game.');
    const end = xlsx.utils.decode_range(sheet['!fullref'] || sheet['!ref']).e.r;
    if (end > limit) throw Error('File có quá 1.000 dòng dữ liệu. Hãy chia thành nhiều file.');
    const rows = xlsx.utils.sheet_to_json(sheet, {header:1,defval:'',raw:true,blankrows:true,range:`A1:J${end+1}`});
    if (!headers.every((header,i) => clean(rows[0]?.[i]) === header)) throw Error('Dòng tiêu đề không khớp mẫu Excel.');
    const seen = new Set();
    const questions = [];
    for (const [index, cells] of rows.slice(1).entries()) {
      if (!cells.some(cell => clean(cell))) continue;
      try {
        const row = questionFromCells(cells,room);
        if (seen.has(row.id)) throw Error(`Mã ${row.id} bị trùng trong file.`);
        seen.add(row.id);
        questions.push(row);
      } catch(error) {
        throw Error(`Dòng ${index+2} · ${error.message}`);
      }
    }
    if (!questions.length) throw Error('File chưa có câu hỏi.');
    return questions;
  }

  function open({client, room, defaults, trigger, escape}) {
    if (document.getElementById('questionManager')) return;
    const manager = document.createElement('div');
    manager.id = 'questionManager';
    manager.innerHTML = `<section role="dialog" aria-modal="true" aria-labelledby="questionManagerTitle">
      <header><h2 id="questionManagerTitle">Ngân hàng câu hỏi</h2><button type="button" id="questionClose">✕ Đóng</button></header>
      <fieldset id="questionActions">
        <div class="question-tools">
          <label>Phòng <select id="questionRoom">${Object.entries(rooms).map(([key,label]) => `<option value="${key}">${label}</option>`).join('')}</select></label>
          <button type="button" id="questionTemplate">Tải mẫu Excel</button>
          <label class="question-file">Chọn file .xlsx <input type="file" id="questionFile" accept=".xlsx"></label>
          <button type="button" id="questionImport" hidden></button>
          <button type="button" id="questionReplace" hidden>Thay toàn bộ câu hỏi</button>
        </div>
        <div class="question-tools">
          <label>Tìm theo mã hoặc nội dung <input id="questionSearch" type="search"></label>
          <label>Câu hỏi <select id="questionList"><option value="">Chọn câu để sửa</option></select></label>
          <button type="button" id="questionNew">+ Thêm câu</button>
        </div>
      </fieldset>
      <p id="questionStatus" role="status"></p>
      <form id="questionForm" hidden>
        <fieldset id="questionFields">
          <div class="question-form-grid">
            <label>Mã câu <input name="id" required maxlength="64" pattern="[A-Za-z0-9_.:\\-]{1,64}"></label>
            <label>Chuyên mục <select name="group"></select></label>
            <label>Bài <input name="lesson" required type="number" min="1" max="25" value="1"></label>
            <label class="question-wide">Câu hỏi <textarea name="question" required maxlength="2000"></textarea></label>
            ${['A','B','C','D'].map(key => `<label>${key} <input name="${key}" required maxlength="500"></label>`).join('')}
            <label>Đáp án đúng <select name="correct">${['A','B','C','D'].map(key => `<option>${key}</option>`).join('')}</select></label>
            <label class="question-wide">Giải thích <textarea name="explanation" maxlength="2000"></textarea></label>
          </div>
          <button class="gold" type="submit">Lưu câu hỏi</button>
        </fieldset>
      </form>
    </section>`;
    document.getElementById('game').append(manager);
    const el = id => manager.querySelector('#'+id);
    const form = el('questionForm');
    const roomPicker = el('questionRoom');
    const list = el('questionList');
    const status = el('questionStatus');
    const close = el('questionClose');
    const importButton = el('questionImport');
    const replaceButton = el('questionReplace');
    let rows = [], pending = [], busy = false, dirty = false;
    roomPicker.value = rooms[room] ? room : 'class';

    function lock(value) {
      busy = value;
      el('questionActions').disabled = value;
      el('questionFields').disabled = value;
      close.disabled = value;
    }
    function renderList() {
      const query = clean(el('questionSearch').value).toLocaleLowerCase('vi');
      const matches = rows.filter(row => (row.id+' '+row.question).toLocaleLowerCase('vi').includes(query));
      list.innerHTML = '<option value="">Chọn câu để sửa</option>' + matches.slice(0,100).map(row =>
        `<option value="${escape(row.id)}">${escape(row.id)} · ${escape(row.question.slice(0,110))}</option>`).join('');
      if (matches.length > 100) list.add(new Option(`Hiện 100/${matches.length} câu · nhập mã để tìm thêm`, '', false, false));
    }
    function clearPending() {
      pending = [];
      importButton.hidden = true;
      replaceButton.hidden = true;
    }
    async function refresh(message) {
      const selectedRoom = roomPicker.value;
      const bank = await load(client,selectedRoom,defaults(selectedRoom));
      rows = bank.rows;
      renderList();
      status.textContent = message || `${rows.length.toLocaleString('vi-VN')} câu trong phòng. ${bank.usesDefaults?'Đang dùng cả câu có sẵn.':'Chỉ dùng ngân hàng đã lưu của phòng.'}`;
    }
    function showQuestion(row) {
      form.reset();
      const fields = form.elements;
      fields.group.innerHTML = categories(roomPicker.value).map(key => `<option value="${key}">${groups[key]}</option>`).join('');
      fields.id.readOnly = Boolean(row);
      if (row) {
        for (const key of ['id','group','lesson','question','correct','explanation']) fields[key].value = row[key] ?? '';
        row.options.forEach((option,i) => { fields['ABCD'[i]].value = option; });
      }
      form.hidden = false;
      dirty = false;
      fields[row ? 'question' : 'id'].focus();
    }
    async function run(work) {
      if (busy) return;
      lock(true);
      try { await work(); }
      catch (error) {
        status.textContent = ['PGRST202','PGRST205','42883','42P01'].includes(error.code)
          ? 'Hãy chạy bản mới của file supabase-room-questions.sql trong Supabase.'
          : error.message || 'Không thể xử lý dữ liệu.';
      }
      finally { lock(false); }
    }
    function discardEdit() {
      return !dirty || confirm('Bỏ các thay đổi chưa lưu trong câu hỏi này?');
    }
    async function store(batch, message, replace = false) {
      const {error} = replace
        ? await client.rpc('ikigai_replace_room_questions', {p_room:roomPicker.value,p_questions:batch})
        : await client.from('ikigai_room_questions').upsert(batch, {onConflict:'room,id'});
      if (error) throw Error('Supabase chưa lưu câu hỏi: '+error.message);
      clearPending();
      dirty = false;
      form.hidden = true;
      status.textContent = message;
      try { await refresh(message); }
      catch (error) { status.textContent = message+' Không tải lại được danh sách: '+error.message; }
    }

    let lastRoom = roomPicker.value;
    roomPicker.onchange = () => {
      if (!discardEdit()) { roomPicker.value = lastRoom; return; }
      lastRoom = roomPicker.value;
      dirty = false;
      clearPending();
      form.hidden = true;
      rows = [];
      el('questionSearch').value = '';
      renderList();
      status.textContent = 'Đang tải câu hỏi…';
      run(() => refresh());
    };
    el('questionSearch').oninput = renderList;
    list.onchange = () => {
      const row = rows.find(q => String(q.id) === list.value);
      if (row && discardEdit()) showQuestion(row);
    };
    el('questionNew').onclick = () => { if (discardEdit()) showQuestion(null); };
    form.oninput = () => { dirty = true; };
    form.onsubmit = event => {
      event.preventDefault();
      run(async () => {
        const fields = form.elements;
        const question = questionFromCells(
          ['id','group','lesson','question','A','B','C','D','correct','explanation'].map(key => fields[key].value), roomPicker.value
        );
        if (!fields.id.readOnly && rows.some(row => String(row.id) === question.id)) throw Error('Mã đã tồn tại. Hãy chọn câu đó trong danh sách để sửa.');
        await store([question],'Đã lưu câu '+question.id+'.');
      });
    };
    el('questionTemplate').onclick = () => run(() => downloadTemplate(roomPicker.value));
    el('questionFile').onchange = event => {
      const file = event.target.files[0];
      event.target.value = '';
      if (!file) return;
      clearPending();
      run(async () => {
        status.textContent = 'Đang kiểm tra file Excel…';
        pending = await readWorkbook(file,roomPicker.value);
        const existing = new Set(rows.map(row => String(row.id)));
        const updated = pending.filter(row => existing.has(row.id)).length;
        status.textContent = `File có ${pending.length} câu cho ${rooms[roomPicker.value]}. Nạp bổ sung sẽ thêm ${pending.length-updated} câu và cập nhật ${updated} câu trùng mã.`;
        importButton.textContent = `Nạp bổ sung`;
        importButton.hidden = false;
        replaceButton.hidden = false;
      });
    };
    importButton.onclick = () => {
      if (pending.length && discardEdit()) run(() => store(pending,`Đã nạp ${pending.length} câu vào ${rooms[roomPicker.value]}.`));
    };
    replaceButton.onclick = () => {
      if (!pending.length || !discardEdit()) return;
      const name = rooms[roomPicker.value];
      if (!confirm(`Thay toàn bộ câu hỏi của ${name} bằng ${pending.length} câu trong file này? Các câu cũ của phòng sẽ ngừng xuất hiện.`)) return;
      run(() => store(pending,`${name} hiện chỉ dùng ${pending.length} câu từ file mới.`,true));
    };
    close.onclick = () => {
      if (busy || !discardEdit()) return;
      manager.remove();
      trigger?.focus();
    };
    manager.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.key === 'Escape') close.click();
      if (event.key !== 'Tab') return;
      const controls = [...manager.querySelectorAll('button,input,select,textarea')]
        .filter(control => !control.matches(':disabled') && control.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (!first || event.shiftKey && document.activeElement === first || !event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
      }
    });
    close.focus();
    status.textContent = 'Đang tải câu hỏi…';
    run(() => refresh());
  }

  window.IKIGAI_ROOM_QUESTIONS = {load,open};
})();

