import { readings } from './kanji-trap-readings.mjs?v=illustrations-1';
import { entries } from './kanji-trap-content.mjs';

// One part-of-speech marker per entry. Capital I and T mark intransitive and transitive verbs.
const labels = {
  I: 'Tự động từ', T: 'Tha động từ', v: 'Động từ', n: 'Danh từ',
  a: 'Tính từ い', b: 'Tính từ な', p: 'Phó từ', d: 'Từ bổ nghĩa danh từ', f: 'Dạng chia của động từ'
};
const special = [
  'IITIn','nITI','nITII','IT','IT','IT','Iff','ITI','aI','IvT',
  'nIIn','ITT','ITv','aITI','ap','an','adn','adn','aa','ann',
  'apn','ann','ann','aTnb','bTn','ann','aIT','anIT','aIT','anIT'
];
const ending = [
  'vnT','Tn','vn','vn','In','vn','In','In','an','aIn',
  'In','Inn','In','In','InT','Tn','Tnn','TnT','Tnn','Tnn',
  'aaI','bp','abT','aIT','aITIT','anpn','aIT','IT','vTI','IT'
];
const supplementary = {
  1: {2:'鳥が卵を～。',4:'魚を～で食べる。'},
  2: {3:'坂を～と学校がある。'},
  3: {3:'階段を～。',4:'船で川を～。'},
  11: {3:'この箱は～です。'},
  14: {1:'夜になると手足が～。'},
  24: {3:'この椅子に座ると～だ。'},
  28: {2:'二つの予定が同じ日に～。'},
  30: {3:'火を～とすぐにお湯が沸く。'},
  95: {1:'風で煙が～。',3:'その歌は若者の間で～。'},
  96: {3:'昼ご飯は～にする。'}
};
const chars = /^[一-龯々]+$/u;

const compoundReadings = {
  小川: ['お', 'がわ'], 長男: ['ちょう', 'なん'], 安心: ['あん', 'しん'], 安全: ['あん', 'ぜん'],
  正月: ['しょう', 'がつ'], 正午: ['しょう', 'ご'], 笑顔: ['え', 'がお'], 食事: ['しょく', 'じ']
};

export function ruby(text, reading) {
  const compound = compoundReadings[text];
  if (compound?.join('') === reading) {
    return Array.from(text, (character, index) => ruby(character, compound[index])).join('');
  }
  if (text === '間違える' && reading === 'まちがえる') return ruby('間', 'ま') + ruby('違', 'ちが') + 'える';
  const pieces = text.match(/[一-龯々]+|[^一-龯々]+/gu);
  if (!pieces?.some(piece => chars.test(piece))) return text;
  const pattern = pieces.map(piece => chars.test(piece) ? '(.+?)' : piece).join('');
  const match = reading.match(new RegExp('^' + pattern + '$', 'u'));
  let index = 1;
  return match
    ? pieces.map(piece => chars.test(piece) ? `<ruby>${piece}<rt>${match[index++]}</rt></ruby>` : piece).join('')
    : `<ruby>${text}<rt>${reading}</rt></ruby>`;
}

export function exampleRuby(sentence, targetMarkup) {
  return readings[sentence].map(part => part.map(token =>
    typeof token === 'string' ? token : ruby(...token)
  ).join('')).join(targetMarkup);
}

let illustration = 0;
export const groups = entries.split('\n').map((line, index) => {
  const id = index + 1;
  const [kanji, vocabulary, prompts] = line.split('|');
  const markers = id <= 30 ? special[index] : id >= 71 ? ending[id - 71] : id === 66 ? 'ITI' : 'IT';
  const contexts = prompts.split(';').map(prompt => {
    const [target, sentence] = prompt.split(':');
    return { target: Number(target), sentence };
  });
  const words = vocabulary.split(';').map((entry, wordIndex) => {
    const [text, reading, meaning] = entry.split('/');
    return {
      text, reading, meaning, illustration: illustration++, type: labels[markers[wordIndex]],
      example: contexts.find(context => context.target === wordIndex)?.sentence ?? supplementary[id]?.[wordIndex]
    };
  });
  return { id, kanji, level: id > 90 ? 'N3 mở rộng' : id <= 30 ? 'N5–N4' : 'N4', words, contexts };
});

export const lessons = Array.from({ length: 20 }, (_, index) => groups.slice(index * 5, index * 5 + 5));

export function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

export function questions(lesson, mode) {
  const reading = mode === 'reading';
  const key = reading ? 'reading' : 'text';
  return lessons[lesson].flatMap(group => group.contexts.map(({ target, sentence }, index) => {
    const word = group.words[target];
    const options = new Set([word[key]]);
    for (const distractor of [...group.words, ...lessons[lesson].flatMap(item => item.words)]) {
      options.add(distractor[key]);
      if (options.size === 4) break;
    }
    return { id: `${group.id}-${mode}-${index + 1}`, word, sentence, options: [...options], answer: word[key] };
  }));
}
