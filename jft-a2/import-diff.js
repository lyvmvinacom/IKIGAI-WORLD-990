const labels = {
  instruction:'Hướng dẫn', prompt:'Câu hỏi', passage:'Bài đọc', underlined:'Từ gạch chân',
  options:'Phương án', correct:'Đáp án đúng', explanation:'Giải thích', figure:'Ảnh minh họa / poster',
  sourceView:'Ảnh bố cục gốc', furigana:'Furigana', mp3:'MP3', listenText:'Câu hỏi nghe / hội thoại'
};
const fields = ['instruction','prompt','passage','underlined','options','correct','explanation','figure','sourceView'];
const stable = value => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value==='object') return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
  return value;
};
const same = (a,b) => JSON.stringify(stable(a))===JSON.stringify(stable(b));
const listenText = ({question,questionVi,turns}) => ({question,questionVi,turns});

export function planExamUpdate(current, incoming) {
  if (current.id!==incoming.id || current.questions.length!==incoming.questions.length) throw Error('Mã đề hoặc số câu không khớp.');
  const changes = [];
  incoming.questions.forEach((q,i)=>{
    const old = current.questions[i];
    if(q.section!==old.section || q.options.length!==old.options.length) {
      throw Error(`Câu ${i+1}: cần giữ nguyên phần thi và số phương án.`);
    }
    const patch = {};
    for (const key of fields) {
      const next = key==='passage' ? q[key]??'' : q[key]??null;
      const previous = key==='passage' ? old[key]??'' : old[key]??null;
      if (!same(previous,next)) patch[key]=next;
    }
    if (!same(old.furigana?.fields??{},q.furigana?.fields??{})) patch.furigana=q.furigana?.fields??{};
    if (q.listen) {
      if (q.listen.mp3!==old.listen.mp3) patch.mp3=q.listen.mp3;
      if (!same(listenText(q.listen),listenText(old.listen))) patch.listenText=listenText(q.listen);
    }
    if (Object.keys(patch).length) changes.push({number:i+1,fields:patch});
  });
  return changes;
}

export function changeLabels(fields) {
  return Object.keys(fields).map(key=>labels[key]).join(', ');
}
