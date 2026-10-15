import { GPUS, LLMS, QUANTS, CONTEXTS } from './data.js?v=__BUILD__';
import { evaluateAll, fmtGB, fmtTps } from './calc.js?v=__BUILD__';
import { DEFAULT_KEY, DEFAULT_JUDGE, SITE_URL, SITE_TITLE } from './config.js?v=__BUILD__';

const OR = 'https://openrouter.ai/api/v1';
const $ = (id) => document.getElementById(id);
const el = {
  gpu: $('gpu'), count: $('count'), llm: $('llm'), quant: $('quant'), ctx: $('ctx'),
  judgeBtn: $('judge-btn'), judgeModel: $('judge-model'), judgeBody: $('judge-body'),
  heroIcon: $('hero-icon'), heroWord: $('hero-word'), heroText: $('hero-text'), heroNote: $('hero-note'),
  jMain: $('j-main'), jRisks: $('j-risks'), jAlts: $('j-alts'), jStatus: $('j-status'),
  verdictIcon: $('verdict-icon'), verdictWord: $('verdict-word'), verdictText: $('verdict-text'),
  stNeed: $('st-need'), stAvail: $('st-avail'), stTps: $('st-tps'), detailBtn: $('detail-btn'), detail: $('detail'),
  summary: $('summary'), bar: $('bar'), legend: $('legend'), qt: $('quant-table').querySelector('tbody'), advice: $('advice'), gpuNote: $('gpu-note'), llmSrc: $('llm-src'),
  help: $('help'), helpBtn: $('help-btn'), helpClose: $('help-close'), themeBtn: $('theme-btn'),
  apiKey: $('api-key'), keySave: $('key-save'), keyClear: $('key-clear'), keyStatus: $('key-status'),
};

// 所見に使う無料モデル。2026-10-15 に同じ質問を各2回投げた実測で、安定して答えたものを順に並べた。
// 先頭が本命で、落ちたら OpenRouter 側で次に回す
const JUDGE_MODELS = [
  'nvidia/nemotron-3-super-120b-a12b:free',
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'nvidia/nemotron-3.5-lightning:free',
  'cohere/north-mini-code:free',
  'poolside/laguna-s-2.1:free',
];

const state = { gpu: 'ps5', llm: 'qwen3.8-27b', quant: 'q4', ctx: 8192, count: 1 };
let lastResult = null;
let freeModels = [];

// ---------- 入力 ----------
function fillGrouped(select, items, labelOf) {
  select.innerHTML = '';
  const groups = new Map();
  for (const it of items) { if (!groups.has(it.group)) groups.set(it.group, []); groups.get(it.group).push(it); }
  for (const [g, list] of groups) {
    const og = document.createElement('optgroup'); og.label = g;
    for (const it of list) { const o = document.createElement('option'); o.value = it.id; o.textContent = labelOf(it); og.appendChild(o); }
    select.appendChild(og);
  }
}
function fillSeg(container, values, labelOf, key) {
  container.innerHTML = '';
  for (const v of values) {
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role', 'radio'); b.dataset.value = String(v); b.textContent = labelOf(v);
    b.addEventListener('click', () => { state[key] = v; syncSeg(container, v); render(); });
    container.appendChild(b);
  }
}
function syncSeg(container, v) {
  for (const b of container.children) b.setAttribute('aria-checked', String(b.dataset.value === String(v)));
}

fillGrouped(el.gpu, GPUS, (g) => g.name);
fillGrouped(el.llm, LLMS, (m) => m.name);
el.quant.innerHTML = '';
for (const q of QUANTS) { const o = document.createElement('option'); o.value = q.id; o.textContent = q.label; el.quant.appendChild(o); }
fillSeg(el.count, [1, 2, 4, 8], (n) => `${n} 枚`, 'count');
fillSeg(el.ctx, CONTEXTS, (c) => `${c / 1024}K`, 'ctx');

// URLハッシュから復元
const hash = new URLSearchParams(location.hash.slice(1));
if (GPUS.some((g) => g.id === hash.get('gpu'))) state.gpu = hash.get('gpu');
if (LLMS.some((m) => m.id === hash.get('llm'))) state.llm = hash.get('llm');
if (QUANTS.some((q) => q.id === hash.get('q'))) state.quant = hash.get('q');
if (CONTEXTS.includes(Number(hash.get('ctx')))) state.ctx = Number(hash.get('ctx'));
if ([1, 2, 4, 8].includes(Number(hash.get('n')))) state.count = Number(hash.get('n'));
el.gpu.value = state.gpu; el.llm.value = state.llm; el.quant.value = state.quant;
syncSeg(el.count, state.count); syncSeg(el.ctx, state.ctx);

el.gpu.addEventListener('change', () => { state.gpu = el.gpu.value; render(); });
el.llm.addEventListener('change', () => { state.llm = el.llm.value; render(); });
el.quant.addEventListener('change', () => { state.quant = el.quant.value; render(); });

// ---------- 判定 ----------
const STATUS_JA = { ok: '可能', tight: 'ぎりぎり', no: '不可' };
const STATUS_ICON = { ok: '✓', tight: '!', no: '×' };

function current() {
  return {
    gpu: GPUS.find((g) => g.id === state.gpu),
    llm: LLMS.find((m) => m.id === state.llm),
    quant: QUANTS.find((q) => q.id === state.quant),
    ctx: state.ctx, count: state.count,
  };
}

function render() {
  const { gpu, llm, quant, ctx, count } = current();
  const { rows } = evaluateAll(gpu, llm, QUANTS, ctx, count);
  const sel = rows.find((r) => r.quant.id === quant.id);
  lastResult = { gpu, llm, quant, ctx, count, rows, sel };
  location.hash = new URLSearchParams({ gpu: gpu.id, llm: llm.id, q: quant.id, ctx: String(ctx), n: String(count) }).toString();

  const devName = `${gpu.name.replace(/\s*\(.*?\)\s*$/, '')}${count > 1 ? ` × ${count}枚` : ''}`;
  el.verdictIcon.className = `vicon ${sel.status}`; el.verdictIcon.textContent = STATUS_ICON[sel.status];
  el.verdictWord.className = `vword ${sel.status}`;
  el.verdictWord.textContent = `計算上は${STATUS_JA[sel.status]}`;
  el.verdictText.textContent = sel.status === 'no'
    ? `${devName} の使えるメモリに ${llm.name}（${quant.label}）は収まらない試算。${fmtGB(-sel.margin)} 足りない。`
    : sel.status === 'tight'
      ? `${devName} の使えるメモリに ${llm.name}（${quant.label}）は収まる試算だが、空きは ${fmtGB(sel.margin)} しかない。`
      : `${devName} の使えるメモリに ${llm.name}（${quant.label}）は収まる試算。実際に動くかはソフトウェア対応や実行環境による。`;
  el.stNeed.textContent = fmtGB(sel.need);
  el.stAvail.textContent = fmtGB(sel.available);
  el.stTps.textContent = fmtTps(sel.tps);

  // 詳細
  el.summary.textContent = `重み ${fmtGB(sel.weights)} + KVキャッシュ ${fmtGB(sel.kv)} + ランタイム ${fmtGB(sel.overhead)} = ${fmtGB(sel.need)}。搭載 ${fmtGB(gpu.vram * count)} × ${Math.round((gpu.usable ?? 1) * 100)}% = 使える ${fmtGB(sel.available)}。`;
  const scale = Math.max(sel.available, sel.need) * 1.05;
  const pct = (x) => `${(x / scale) * 100}%`;
  el.bar.innerHTML = '';
  let left = 0;
  for (const [cls, v] of [['w', sel.weights], ['kv', sel.kv], ['ov', sel.overhead]]) {
    const s = document.createElement('span'); s.className = `seg ${cls}`; s.style.left = pct(left); s.style.width = pct(v);
    el.bar.appendChild(s); left += v;
  }
  const cap = document.createElement('span'); cap.className = 'cap'; cap.style.left = pct(sel.available); el.bar.appendChild(cap);
  el.legend.innerHTML = `<span><i style="background:var(--w)"></i>重み</span><span><i style="background:var(--kv)"></i>KVキャッシュ</span><span><i style="background:var(--ov)"></i>ランタイム</span><span><i style="background:var(--no)"></i>使えるメモリの上限</span>`;
  el.qt.innerHTML = '';
  for (const r of rows) {
    const tr = document.createElement('tr');
    if (r.quant.id === quant.id) tr.className = 'sel';
    tr.innerHTML = `<td>${r.quant.label}</td><td>${fmtGB(r.need)}</td><td class="st ${r.status}">${STATUS_JA[r.status]}</td><td>${fmtTps(r.tps)}</td>`;
    el.qt.appendChild(tr);
  }
  const best = rows.find((r) => r.status !== 'no');
  if (!best) {
    let n; let fit = null;
    for (n = count + 1; n <= 64; n++) {
      const { best: b } = evaluateAll(gpu, llm, QUANTS.filter((q) => q.id === 'q4'), ctx, n);
      if (b) { fit = b; break; }
    }
    el.advice.textContent = fit
      ? `どの量子化でも収まらない。同じ機器を ${n} 枚にすれば Q4_K_M で収まる（${fmtGB(fit.need)} / ${fmtGB(fit.available)}）。`
      : 'どの量子化でも収まらない。モデルを変えるしかない。';
  } else if (sel.status === 'no') {
    el.advice.textContent = `${quant.label} では収まらないが、${best.quant.label} なら ${STATUS_JA[best.status]}（${fmtGB(best.need)}、推定 ${fmtTps(best.tps)}）。`;
  } else if (gpu.eff < 0.01) {
    el.advice.textContent = '収まるが、計算律速で実用にならない速度。';
  } else if (sel.tps < 5) {
    el.advice.textContent = '収まるが、対話には遅い。MoEや小さいモデルを選ぶと速くなる。';
  } else {
    el.advice.textContent = '';
  }
  el.gpuNote.textContent = gpu.note ? `注: ${gpu.note}` : '';
  el.llmSrc.href = `https://openrouter.ai/${llm.orId}`;
  if (judgedKey && judgedKey !== location.hash) {
    el.heroNote.textContent = '組み合わせを変えました。上の所見は前の組み合わせへのものです。もう一度「判定して、AIの所見を聞く」を押してください。';
  }
}
let judgedKey = null;

el.detailBtn.addEventListener('click', () => {
  const open = el.detail.hidden;
  el.detail.hidden = !open;
  el.detailBtn.setAttribute('aria-expanded', String(open));
  el.detailBtn.innerHTML = `${open ? '閉じる' : '詳細を見る'} <span class="chev-v">⌄</span>`;
});

// ---------- 使い方・テーマ・キー ----------
el.helpBtn.addEventListener('click', () => el.help.showModal());
el.helpClose.addEventListener('click', () => el.help.close());
el.help.addEventListener('click', (e) => { if (e.target === el.help) el.help.close(); });

function applyTheme(t) { if (t === 'dark') document.documentElement.dataset.theme = 'dark'; else delete document.documentElement.dataset.theme; }
try { applyTheme(localStorage.getItem('theme')); } catch {}
el.themeBtn.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  try { localStorage.setItem('theme', next); } catch {}
});

function apiKey() { try { return localStorage.getItem('or_key') || DEFAULT_KEY; } catch { return DEFAULT_KEY; } }
function usingOwnKey() { try { return !!localStorage.getItem('or_key'); } catch { return false; } }
function refreshKeyStatus() {
  el.keyStatus.textContent = usingOwnKey() ? '自分のキーを使用中' : DEFAULT_KEY ? '既定の公開キーを使用中' : '既定キーなし。自分のキーを入れる必要がある';
}
el.keySave.addEventListener('click', () => {
  const v = el.apiKey.value.trim();
  if (!v.startsWith('sk-or-')) { el.keyStatus.textContent = 'sk-or- で始まるキーを入れる'; return; }
  try { localStorage.setItem('or_key', v); } catch {}
  el.apiKey.value = ''; refreshKeyStatus();
});
el.keyClear.addEventListener('click', () => { try { localStorage.removeItem('or_key'); } catch {} el.apiKey.value = ''; refreshKeyStatus(); });
refreshKeyStatus();

// ---------- OpenRouter ----------
function errorText(status, body) {
  const msg = body?.error?.message || body?.message || '';
  if (status === 401) return `キーが無効（401）。${msg}`;
  if (status === 402) return `キーの利用上限に達した（402）。「使い方」から自分のキーを入れる。${msg}`;
  if (status === 429) return `レート制限か無料枠の上限（429）。少し待つか、「使い方」から自分のキーを入れる。${msg}`;
  if (status === 404) return `モデルが見つからない（404）。${msg}`;
  return `エラー ${status}。${msg}`;
}

// fallbacks を渡すと OpenRouter 側で順にフォールバックする。思考なしで答えさせる
async function streamChat(model, messages, onDelta, { fallbacks = [], onModel = null } = {}) {
  const res = await fetch(`${OR}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey()}`, 'Content-Type': 'application/json', 'HTTP-Referer': SITE_URL, 'X-Title': SITE_TITLE },
    body: JSON.stringify({
      model,
      ...(fallbacks.length ? { models: [model, ...fallbacks.filter((m) => m !== model)] } : {}),
      messages, stream: true, max_tokens: 2000,
      reasoning: { enabled: false },
    }),
  });
  if (!res.ok) { let body = null; try { body = await res.json(); } catch {} throw new Error(errorText(res.status, body)); }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = ''; let got = false; let usedModel = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]') return { got, usedModel };
      let j; try { j = JSON.parse(data); } catch { continue; }
      if (j.error) throw new Error(j.error.message || 'ストリーム中のエラー');
      if (j.model && !usedModel) { usedModel = j.model; onModel?.(usedModel); }
      const d = j.choices?.[0]?.delta?.content;
      if (d) { got = true; onDelta(d); }
    }
  }
  return { got, usedModel };
}

async function loadFreeModels() {
  try {
    const res = await fetch(`${OR}/models`);
    const j = await res.json();
    freeModels = (j.data || []).filter((m) => m.id.endsWith(':free'));
  } catch { freeModels = []; }
  el.judgeModel.innerHTML = '';
  for (const id of JUDGE_MODELS) {
    const m = freeModels.find((x) => x.id === id);
    if (freeModels.length && !m) continue; // 一覧から消えたものは出さない
    const o = document.createElement('option'); o.value = id; o.textContent = m?.name || id; el.judgeModel.appendChild(o);
  }
  if (!el.judgeModel.options.length) { const o = document.createElement('option'); o.value = DEFAULT_JUDGE; o.textContent = DEFAULT_JUDGE; el.judgeModel.appendChild(o); }
}

// ---------- 所見 ----------
function buildJudgePrompt() {
  const { gpu, llm, quant, ctx, count, rows, sel } = lastResult;
  const table = rows.map((r) => `- ${r.quant.label}: 必要 ${fmtGB(r.need)} → ${STATUS_JA[r.status]}${r.tps != null ? `、推定 ${fmtTps(r.tps)}` : ''}`).join('\n');
  return `次の組み合わせでローカルLLM推論ができるか、ハードウェアの観点で所見を述べてください。

## 機器
- ${gpu.name}${count > 1 ? ` × ${count}枚` : ''}
- メモリ ${gpu.vram} GB${gpu.unified ? '（統合メモリ）' : ''}、帯域 ${gpu.bw} GB/s
${gpu.note ? `- 注: ${gpu.note}` : ''}

## モデル
- ${llm.name}（総パラメータ ${llm.total}B、活性 ${llm.active}B）
- 想定する量子化: ${quant.label}、コンテキスト長 ${ctx} トークン

## このページの概算（帯域ベースの机上計算）
${table}
選択した ${quant.label} の判定: ${STATUS_JA[sel.status]}（必要 ${fmtGB(sel.need)} / 使える ${fmtGB(sel.available)}）

## 判断の方針
「計算上収まる」と「実際に動く」は別です。メモリと帯域の試算は根拠の一つにすぎません。ソフトウェア対応（その機器で動く推論ランタイムが存在するか、公式か非公式か、改造や脱獄が要るか）、ドライバ、OSの制約、熱と電源、実例の有無まで含めて、実際に動くかを判断してください。

## 出力形式
次の4つの見出し行をこの順でそのまま書き、その下に内容を書いてください。見出し以外の記号（**、#、番号付き見出し）は使わないでください。

【実用判定】
1行目に「動く見込み」「条件付きで動く」「動かない見込み」「わからない」のどれか1つだけを書く。2行目に、その判断の最大の理由を1文で書く。

【所見】
この概算が妥当か（過大・過小ならどこが違うか）と、現実に期待できる生成速度とその根拠を、短い段落2つ程度で。

【リスク】
落とし穴（メモリ不足、ソフトウェア対応、熱、電源、ドライバなど）を「- 」で始まる箇条書き3〜5個。各行は「項目名：説明」の形。

【代替案】
量子化、モデル、機器の変更案を「- 」で始まる箇条書き3〜4個。

全体で500字程度の日本語。わからないことは「わからない」と書いてください。`;
}

const VERDICTS = [
  ['動く見込み', 'ok', '✓'],
  ['条件付きで動く', 'tight', '!'],
  ['動かない見込み', 'no', '×'],
  ['わからない', 'none', '?'],
];
function renderHero(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return;
  const hit = VERDICTS.find(([w]) => lines[0].includes(w)) || VERDICTS[3];
  el.heroIcon.className = `vicon ${hit[1]}`; el.heroIcon.textContent = hit[2];
  el.heroWord.className = `vword ${hit[1]}`; el.heroWord.textContent = hit[0];
  el.heroText.textContent = lines.slice(1).join(' ') || '';
  el.heroNote.textContent = `${nameOfModel(el.judgeModel.value)} の推測であり、動作保証ではありません。計算上の試算は下の「計算上の判定」にあります。`;
}
function nameOfModel(id) { return freeModels.find((x) => x.id === id)?.name || id; }

function stripMd(s) { return s.replace(/\*\*/g, '').replace(/^#+\s*/gm, ''); }

// 蓄積テキストを【所見】【リスク】【代替案】に分けて描画する
function renderJudge(raw) {
  const text = stripMd(raw);
  const sec = { verdict: '', main: '', risks: '', alts: '' };
  const re = /【(実用判定|所見|リスク|代替案)】/g;
  const marks = [...text.matchAll(re)];
  if (!marks.length) sec.main = text;
  else {
    sec.main = text.slice(0, marks[0].index);
    for (let i = 0; i < marks.length; i++) {
      const body = text.slice(marks[i].index + marks[i][0].length, marks[i + 1]?.index ?? text.length);
      const key = marks[i][1] === '実用判定' ? 'verdict' : marks[i][1] === '所見' ? 'main' : marks[i][1] === 'リスク' ? 'risks' : 'alts';
      sec[key] += body;
    }
  }
  renderHero(sec.verdict);
  el.jMain.textContent = sec.main.trim();
  for (const [key, box] of [['risks', el.jRisks], ['alts', el.jAlts]]) {
    const items = sec[key].split('\n').map((l) => l.replace(/^\s*[-・•*]\s*/, '').trim()).filter(Boolean);
    box.hidden = items.length === 0;
    const ul = box.querySelector('ul');
    ul.innerHTML = '';
    for (const it of items) { const li = document.createElement('li'); li.textContent = it; ul.appendChild(li); }
  }
}

el.judgeBtn.addEventListener('click', async () => {
  el.judgeBtn.disabled = true;
  el.judgeBody.hidden = false;
  el.jMain.textContent = ''; el.jRisks.hidden = true; el.jAlts.hidden = true;
  el.heroIcon.className = 'vicon none'; el.heroIcon.textContent = '…';
  el.heroWord.className = 'vword none'; el.heroWord.textContent = '判定中';
  el.heroText.textContent = '';
  el.heroNote.textContent = 'AIの回答は推測であり、動作保証ではありません。';
  judgedKey = location.hash;
  el.jStatus.className = 'j-status';
  el.jStatus.innerHTML = '<span class="dots"><i></i><i></i><i></i></span> 問い合わせ中…';
  window.scrollTo({ top: 0, behavior: 'smooth' });
  const messages = [
    { role: 'system', content: 'あなたはローカルLLM推論のハードウェアに詳しい技術者です。数値の根拠を示し、断定できないことは断定しません。' },
    { role: 'user', content: buildJudgePrompt() },
  ];
  const primary = el.judgeModel.value;
  const fallbacks = JUDGE_MODELS.filter((m) => m !== primary).slice(0, 2); // OpenRouter の models 配列は3件まで
  const nameOf = nameOfModel;
  try {
    let result = { got: false, usedModel: null };
    for (let attempt = 0; attempt < 3 && !result.got; attempt++) {
      let raw = '';
      try {
        result = await streamChat(primary, messages, (d) => { raw += d; renderJudge(raw); }, {
          fallbacks,
          onModel: (m) => { el.jStatus.innerHTML = `<span class="dots"><i></i><i></i><i></i></span> ストリーミング中…（${nameOf(m)}）`; },
        });
        if (!result.got) el.jStatus.textContent = `応答が空だった。再試行中（${attempt + 1}/3）…`;
        else if (result.usedModel && result.usedModel !== el.judgeModel.value) el.heroNote.textContent = `${nameOf(result.usedModel)} の推測であり、動作保証ではありません。計算上の試算は下の「計算上の判定」にあります。`;
      } catch (e) {
        if (attempt === 2 || !/overloaded|502|503|504|timeout|ストリーム中/i.test(e.message)) throw e;
        el.jStatus.textContent = `提供元が混雑中。再試行中（${attempt + 1}/3）…`;
        await new Promise((r) => setTimeout(r, 2500));
      }
    }
    if (!result.got) { el.jStatus.className = 'j-status err'; el.jStatus.textContent = '応答が空だった。モデルを変えて再試行する。'; el.heroWord.textContent = '未判定'; el.heroIcon.textContent = '?'; }
    else {
      const used = result.usedModel || primary;
      el.jStatus.textContent = used !== primary ? `完了（${nameOf(primary)} が応答しなかったため ${nameOf(used)} が答えた）` : `完了（${nameOf(used)}）`;
    }
  } catch (e) {
    el.jStatus.className = 'j-status err';
    el.jStatus.textContent = `${e.message}\n時間をおいて再試行するか、別の無料モデルを選ぶ。`;
    el.heroWord.textContent = '未判定'; el.heroIcon.textContent = '?';
  } finally {
    el.judgeBtn.disabled = false;
  }
});

// ---------- 起動 ----------
render();
loadFreeModels();
