import assert from 'node:assert/strict';
import test from 'node:test';
import { groups, lessons, questions, ruby } from '../n4/kanji-trap-bank.mjs';

test('preserves all 100 groups, including both units that teach 明', () => {
  assert.equal(groups.map(group => group.kanji).join(''),
    '生上下入出行来通明開空止付冷少多大小細長早高安楽好正汚重温強閉始終集決変回動消壊割折落起寝立並届続増減直治戻返残焼沸乾濡切抜外掛乗降伝見聞曲思考話休帰遊働疲痛悲喜笑怒泣違忘読書食飲苦幸明深広軽遅進向過');
  assert.equal(lessons.length, 20);
  assert.ok(lessons.every(lesson => lesson.length === 5));
  assert.ok(lessons.slice(18).flat().every(group => group.level === 'N3 mở rộng'));
  for (const { words } of groups) {
    for (const word of words) {
      assert.ok(word.example?.includes('～') && word.type && word.meaning);
      assert.match(ruby(word.text, word.reading), /<ruby>.+<rt>.+<\/rt><\/ruby>/);
    }
  }
  assert.equal(ruby('冷める', 'さめる'), '<ruby>冷<rt>さ</rt></ruby>める');
  assert.equal(ruby('読み方', 'よみかた'), '<ruby>読<rt>よ</rt></ruby>み<ruby>方<rt>かた</rt></ruby>');
});

test('has 300 reading plus 300 usage questions with exactly one keyed answer', () => {
  const ids = new Set();
  for (const mode of ['reading', 'usage']) {
    const prompts = new Set();
    for (const [index] of lessons.entries()) {
      const bank = questions(index, mode);
      assert.equal(bank.length, 15);
      for (const question of bank) {
        assert.equal(new Set(question.options).size, 4);
        assert.equal(question.options.filter(option => option === question.answer).length, 1);
        assert.ok(question.sentence.includes('～'));
        ids.add(question.id);
        prompts.add(question.sentence.replace('～', question.word.text));
      }
    }
    assert.equal(prompts.size, 300);
  }
  assert.equal(ids.size, 600);
});

test('a full practice round logs study and retries a failed reward with the same receipt', async () => {
  const { mountKanjiTrap } = await import('../n4/kanji-trap.mjs');
  class Element {
    constructor(dataset = {}) { this.dataset = dataset; this.isConnected = true; }
    append(element) { this.retry = element; }
    focus() {}
  }
  const elements = new Map();
  const calls = [], diary = [];
  const refresh = async () => new Promise(resolve => setImmediate(resolve));
  const host = {
    classList: new Set(),
    set innerHTML(markup) {
      for (const value of elements.values()) value.isConnected = false;
      elements.clear();
      for (const [, key, value] of markup.matchAll(/data-([a-z]+)(?:="([^"]*)")?/g)) {
        elements.set(key + (value ?? ''), new Element({ [key]: value }));
      }
      elements.set('feedback', new Element());
    },
    querySelector(selector) { return elements.get(selector === '.kt-feedback' ? 'feedback' : selector.slice(6, -1)); },
    querySelectorAll(selector) {
      const key = selector.slice(6, -1);
      return [...elements.values()].filter(element => Object.hasOwn(element.dataset, key));
    },
    replaceChildren() { this.innerHTML = ''; }
  };
  host.classList.remove = key => host.classList.delete(key);

  globalThis.window = {
    IKIGAI_DIARY: { study: label => diary.push(label) },
    IKIGAI_REWARD_CLIENT: { rpc: async (name, payload) => {
      calls.push({ name, payload });
      if (calls.length === 1) throw Error('temporary network failure');
      return { coins_awarded: 50 };
    } }
  };
  globalThis.document = { createElement: () => new Element() };
  try {
    const close = mountKanjiTrap(host);
    assert.equal(host.querySelectorAll('[data-lesson]').length, 20);
    elements.get('lesson13').onclick();
    elements.get('modereading').onclick();
    for (let index = 0; index < 15; index++) {
      elements.get('option0').onclick();
      elements.get('option0').onclick();
      assert.equal(host.querySelectorAll('[data-option]').filter(option => option.dataset.result === 'correct').length, 1);
      elements.get('next').onclick();
    }
    await refresh();
    elements.get('feedback').retry.onclick();
    await refresh();
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[0], calls[1]);
    assert.equal(calls[0].payload.p_total, 15);
    assert.ok(calls[0].payload.p_correct <= 15);
    assert.match(elements.get('feedback').textContent, /50 xu/);
    assert.deepEqual(diary, [null, 'Bẫy Kanji · Bài 14 · Học từ', 'Bẫy Kanji · Bài 14 · Luyện cách đọc', null]);
    close();
    assert.ok(host.hidden && !host.classList.has('kt-host'));
  } finally {
    delete globalThis.window;
    delete globalThis.document;
  }
});

test('every example and quiz context has furigana without giving away the quiz target', async () => {
  const { exampleRuby } = await import('../n4/kanji-trap-bank.mjs');
  const withoutReadings = html => html.replace(/<rt>[^<]*<\/rt>/g, '').replace(/<[^>]+>/g, '');
  const check = (sentence, target, expected) => {
    const html = exampleRuby(sentence, target);
    assert.equal(withoutReadings(html), expected);
    assert.doesNotMatch(html.replace(/<ruby>.*?<\/ruby>/g, ''), /[一-龯々]/u);
  };
  const illustrations = [];
  for (const group of groups) {
    for (const word of group.words) {
      check(word.example, ruby(word.text, word.reading), word.example.replace('～', word.text));
      illustrations.push(word.illustration);
    }
    for (const context of group.contexts) check(context.sentence, '＿＿＿', context.sentence.replace('～', '＿＿＿'));
  }
  assert.deepEqual(illustrations, Array.from({ length: 252 }, (_, index) => index));
  assert.match(exampleRuby('魚は水の中で～。', ruby('生きる', 'いきる')), /魚<rt>さかな<\/rt>.*水<rt>みず<\/rt>.*中<rt>なか<\/rt>.*生<rt>い<\/rt>/);
});
