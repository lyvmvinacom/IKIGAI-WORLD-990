import {escapeText, normalizeFields, openFuriganaEditor} from './furigana.js?v=question-editor-20261126';

const imageTypes = ['image/png', 'image/jpeg', 'image/webp'];

function readMedia(file, limit, label) {
  if (!file.size || file.size > limit) throw new Error(label);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Không đọc được tệp đã chọn.'));
    reader.readAsDataURL(file);
  });
}

export function applyQuestionEdit(question, fields, revision) {
  const {mp3, furigana, ...textAndFigure} = fields;
  Object.assign(question, textAndFigure, {editRevision:revision});
  if (mp3) Object.assign(question.listen, {mp3, audioUpdated:true});
  if (furigana) question.furigana = {fields:furigana, revision:0};
}

export function openQuestionEditor({dialog, question, examId, number, account, signal, showDialog, onApplied}) {
  const draft = structuredClone(question);
  const revision = question.editRevision ?? 0;
  const textFields = [
    ['instruction', 'Hướng dẫn', 500], ['prompt', 'Nội dung câu hỏi', 3000],
    ['passage', 'Đoạn đọc', 8000], ['underlined', 'Từ gạch chân', 200],
    ...question.options.map((_, i) => ['option'+i, 'Phương án '+String.fromCharCode(65+i), 2500]),
    ['explanation', 'Giải thích', 5000]
  ];
  let mp3, figure = question.figure ?? null;
  let audioStatus = '', figureStatus = '', furiganaChanged = false;
  const opened = () => {
    const value = key => key.startsWith('option') ? draft.options[Number(key.slice(6))] : draft[key];
    showDialog('Sửa câu hỏi · Câu '+number,
      `<form id="question-edit-form" class="question-edit-form">
        ${textFields.map(([key, label, limit]) => `<label>${label}<textarea name="${key}" maxlength="${limit}" rows="${key==='passage'?4:2}">${escapeText(value(key)??'')}</textarea></label>`).join('')}
        <label>Đáp án đúng<select name="correct">${draft.options.map((_,i)=>`<option value="${i}" ${i===draft.correct?'selected':''}>${String.fromCharCode(65+i)}</option>`).join('')}</select></label>
        <label>Ảnh minh họa / poster · PNG, JPG, WebP · tối đa 2 MB<input id="question-image" type="file" accept="${imageTypes.join(',')}"></label>
        <img id="question-image-preview" alt="Xem trước ảnh của câu hỏi" hidden>
        <div><button type="button" class="ghost" id="question-image-remove">Xóa ảnh</button><p id="question-image-status" role="status"></p></div>
        ${draft.listen ? '<label>Âm thanh · MP3 · tối đa 620 KiB<input id="question-audio" type="file" accept="audio/mpeg,.mp3"></label><audio id="question-audio-preview" controls preload="none" hidden></audio><p id="question-audio-status" role="status"></p>' : ''}
        <div><button type="button" class="ghost" id="question-ruby">Sửa / xóa furigana</button></div>
        <p id="question-edit-status" role="status"></p>
      </form>`,
      '<button type="button" class="ghost" id="question-edit-cancel">Hủy</button><button type="submit" form="question-edit-form" class="btn" id="question-edit-save">Lưu câu hỏi</button>',true);
    const $ = id => dialog.querySelector('#'+id);
    const form = $('question-edit-form');
    const save = $('question-edit-save');
    const image = $('question-image-preview');
    const audio = $('question-audio-preview');
    const status = $('question-edit-status');
    const setPreview = () => {
      if (figure) image.src = figure;
      else image.removeAttribute('src');
      image.hidden = !figure;
      $('question-image-remove').disabled = !figure;
      $('question-image-status').textContent = figureStatus;
      if (audio) {
        audio.hidden = !(mp3 || draft.listen.mp3);
        if (!audio.hidden) audio.src = 'data:audio/mpeg;base64,'+(mp3 ?? draft.listen.mp3);
        $('question-audio-status').textContent = audioStatus;
      }
    };
    const collect = () => {
      for (const [key] of textFields) {
        const value = form.elements.namedItem(key).value;
        if (key.startsWith('option')) draft.options[Number(key.slice(6))] = value;
        else draft[key] = value;
      }
      draft.underlined ||= null;
      draft.correct = Number(form.elements.namedItem('correct').value);
    };
    const bindUpload = (input, mediaStatus, update) => {
      input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;
        const controls = Array.from(form.querySelectorAll('input,button'));
        controls.forEach(control => { control.disabled = true; });
        save.disabled = true;
        try {
          await update(file);
          if (form.isConnected) setPreview();
        } catch (error) {
          if (form.isConnected) mediaStatus.textContent = error.message;
        } finally {
          controls.forEach(control => { control.disabled = false; });
          $('question-image-remove')?.toggleAttribute('disabled',!figure);
          save.disabled = false;
          input.value = '';
        }
      };
    };
    bindUpload($('question-image'), $('question-image-status'), async file => {
      const error = 'Chọn ảnh PNG, JPG hoặc WebP có dung lượng tối đa 2 MB.';
      if (!imageTypes.includes(file.type)) throw new Error(error);
      const src = await readMedia(file, 2*1024*1024, error);
      const preview = new Image();
      preview.src = src;
      await preview.decode().catch(() => { throw new Error('Không mở được ảnh đã chọn.'); });
      figure = src;
      figureStatus = file.name;
    });
    $('question-image-remove').onclick = () => { figure = null; figureStatus = 'Ảnh sẽ được xóa khi lưu.'; setPreview(); };
    if (audio) bindUpload($('question-audio'), $('question-audio-status'), async file => {
      const error = 'Chọn tệp MP3 hợp lệ có dung lượng tối đa 620 KiB.';
      if (!/\.mp3$/i.test(file.name)) throw new Error(error);
      const src = await readMedia(file, 620*1024, error);
      const data = src.slice(src.indexOf(',')+1);
      const header = atob(data.slice(0,8));
      if (!header.startsWith('ID3') && !(header.charCodeAt(0)===255 && (header.charCodeAt(1)&224)===224)) throw new Error(error);
      mp3 = data;
      audioStatus = file.name;
    });
    setPreview();
    $('question-ruby').onclick = () => {
      collect();
      openFuriganaEditor({dialog,question:draft,examId,number,signal,showDialog,
        account:{canManage:true,saveFurigana:async (_id,_number,fields)=>({fields,revision:0})},
        onApplied:()=>{furiganaChanged=true;opened();}, onBack:opened});
    };
    $('question-edit-cancel').onclick = () => dialog.close();
    form.onsubmit = async event => {
      event.preventDefault();
      collect();
      if (!draft.instruction.trim() || !draft.explanation.trim() || draft.options.some(option=>!option.trim()) ||
          (!draft.listen && !draft.prompt.trim() && !draft.passage.trim() && !figure)) {
        status.textContent = 'Hãy điền hướng dẫn, câu hỏi hoặc ảnh, các phương án và giải thích.';return;
      }
      if (draft.underlined && !draft.prompt.includes(draft.underlined)) {
        status.textContent = 'Từ gạch chân phải có trong nội dung câu hỏi.';return;
      }
      const fields = {};
      for (const key of ['instruction','prompt','passage','underlined','explanation','options','correct']) {
        if (JSON.stringify(draft[key] ?? '') !== JSON.stringify(question[key] ?? '')) fields[key] = draft[key];
      }
      if (figure !== (question.figure ?? null)) fields.figure = figure;
      if (mp3) fields.mp3 = mp3;
      if (furiganaChanged || ['instruction','prompt','passage','options'].some(key=>key in fields)) {
        fields.furigana = normalizeFields(draft,draft.furigana?.fields);
      }
      if (!Object.keys(fields).length) {status.textContent='Chưa có thay đổi.';return;}
      const controls = Array.from(dialog.querySelectorAll('button,input,select,textarea')).filter(control=>!control.disabled);
      const preventCancel = event => event.preventDefault();
      controls.forEach(control=>{control.disabled=true;});
      dialog.addEventListener('cancel',preventCancel);
      status.textContent = 'Đang lưu câu hỏi…';
      try {
        const result = await account.saveQuestionEdit(examId,number,fields,revision,signal);
        if (signal.aborted) return;
        applyQuestionEdit(question,fields,result.revision);
        if (form.isConnected) {dialog.close();onApplied();}
      } catch (error) {
        status.textContent = error.message || 'Chưa lưu được câu hỏi. Hãy thử lại.';
      } finally {
        dialog.removeEventListener('cancel',preventCancel);
        controls.forEach(control=>{control.disabled=false;});
      }
    };
  };
  opened();
}
