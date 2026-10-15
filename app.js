import { GPUS, LLMS, QUANTS, CONTEXTS } from './data.js?v=__BUILD__';
import { evaluateAll, fmtGB, fmtTps, rankModelsForGpu, rankGpusForModel } from './calc.js?v=__BUILD__';
import { DEFAULT_KEY, DEFAULT_JUDGE, SITE_URL, SITE_TITLE } from './config.js?v=__BUILD__';

const OR = 'https://openrouter.ai/api/v1';
const $ = (id) => document.getElementById(id);
const el = {
  gpu: $('gpu'), count: $('count'), llm: $('llm'), quant: $('quant'), ctx: $('ctx'), gpuNote: $('gpu-note'),
  verdict: $('verdict'), summary: $('summary'), bar: $('bar'), legend: $('legend'), qt: $('quant-table').querySelector('tbody'),
  advice: $('advice'), llmSrc: $('llm-src'),
  judgeModel: $('judge-model'), judgeBtn: $('judge-btn'), judgeOut: $('judge-out'),
  sgModels: $('sg-models').querySelector('tbody'), sgGpus: $('sg-gpus').querySelector('tbody'), sgModelsTitle: $('sg-models-title'), sgGpusTitle: $('sg-gpus-title'),
  apiKey: $('api-key'), keySave: $('key-save'), keyClear: $('key-clear'), keyStatus: $('key-status'),
};

let freeModels = []; // OpenRouter から取った無料モデル一覧
let lastResult = null;

// ---------- セレクト構築 ----------
function fillGrouped(select, items, labelOf) {
  select.innerHTML = '';
  const groups = new Map();
  for (const it of items) {
    if (!groups.has(it.group)) groups.set(it.group, []);
    groups.get(it.group).push(it);
  }
  for (const [g, list] of groups) {
    const og = document.createElement('optgroup');
    og.label = g;
    for (const it of list) {
      const o = document.createElement('option');
      o.value = it.id; o.textContent = labelOf(it);
      og.appendChild(o);
    }
    select.appendChild(og);
  }
}
function fillPlain(select, items, labelOf, valueOf = (x) => x) {
  select.innerHTML = '';
  for (const it of items) {
    const o = document.createElement('option');
    o.value = valueOf(it); o.textContent = labelOf(it);
    select.appendChild(o);
  }
}

fillGrouped(el.gpu, GPUS, (g) => `${g.name}  ${g.bw} GB/s`);
fillPlain(el.count, [1, 2, 4, 8], (n) => `${n} 枚`);
fillGrouped(el.llm, LLMS, (m) => m.name);
fillPlain(el.quant, QUANTS, (q) => q.label, (q) => q.id);
fillPlain(el.ctx, CONTEXTS, (c) => (c >= 1024 ? `${c / 1024}K トークン` : `${c}`));

// 初期値: URLハッシュ → 既定（PS5 × Qwen3.8 27B）
const hash = new URLSearchParams(location.hash.slice(1));
el.gpu.value = GPUS.some((g) => g.id === hash.get('gpu')) ? hash.get('gpu') : 'ps5';
el.llm.value = LLMS.some((m) => m.id === hash.get('llm')) ? hash.get('llm') : 'qwen3.8-27b';
el.quant.value = QUANTS.some((q) => q.id === hash.get('q')) ? hash.get('q') : 'q4';
el.ctx.value = CONTEXTS.includes(Number(hash.get('ctx'))) ? hash.get('ctx') : '8192';
el.count.value = ['1', '2', '4', '8'].includes(hash.get('n')) ? hash.get('n') : '1';

// ---------- 判定の描画 ----------
const STATUS_JA = { ok: '可能', tight: 'ぎりぎり', no: '不可' };

function current() {
  return {
    gpu: GPUS.find((g) => g.id === el.gpu.value),
    llm: LLMS.find((m) => m.id === el.llm.value),
    quant: QUANTS.find((q) => q.id === el.quant.value),
    ctx: Number(el.ctx.value),
    count: Number(el.count.value),
  };
}

function render() {
  const { gpu, llm, quant, ctx, count } = current();
  const { rows } = evaluateAll(gpu, llm, QUANTS, ctx, count);
  const sel = rows.find((r) => r.quant.id === quant.id);
  lastResult = { gpu, llm, quant, ctx, count, rows, sel };
  location.hash = new URLSearchParams({ gpu: gpu.id, llm: llm.id, q: quant.id, ctx: String(ctx), n: String(count) }).toString();

  el.gpuNote.textContent = gpu.note ? `注: ${gpu.note}` : '';
  el.llmSrc.href = `https://openrouter.ai/${llm.orId}`;

  el.verdict.className = `verdict ${sel.status}`;
  el.verdict.textContent = `${STATUS_JA[sel.status]}: ${gpu.name}${count > 1 ? ` × ${count}` : ''} で ${llm.name} を ${quant.label} で動かす`;
  el.summary.textContent = `必要 ${fmtGB(sel.need)}（重み ${fmtGB(sel.weights)} + KV ${fmtGB(sel.kv)} + ランタイム ${fmtGB(sel.overhead)}） / 使えるメモリ ${fmtGB(sel.available)}（搭載 ${fmtGB(gpu.vram * count)} × ${Math.round((gpu.usable ?? 1) * 100)}%）。推定 ${fmtTps(sel.tps)}`;

  const scale = Math.max(sel.available, sel.need) * 1.05;
  const pct = (x) => `${(x / scale) * 100}%`;
  el.bar.innerHTML = '';
  let left = 0;
  for (const [cls, v] of [['w', sel.weights], ['kv', sel.kv], ['ov', sel.overhead]]) {
    const s = document.createElement('div');
    s.className = `seg ${cls}`; s.style.left = pct(left); s.style.width = pct(v);
    el.bar.appendChild(s); left += v;
  }
  const cap = document.createElement('div');
  cap.className = 'cap'; cap.style.left = pct(sel.available);
  el.bar.appendChild(cap);
  el.legend.innerHTML = `<span><i style="background:var(--w)"></i>重み</span><span><i style="background:var(--kv)"></i>KVキャッシュ</span><span><i style="background:var(--ov)"></i>ランタイム</span><span><i style="background:var(--no)"></i>使えるメモリの上限</span>`;

  el.qt.innerHTML = '';
  for (const r of rows) {
    const tr = document.createElement('tr');
    if (r.quant.id === quant.id) tr.className = 'sel';
    tr.innerHTML = `<td>${r.quant.label}</td><td>${fmtGB(r.need)}</td><td class="st ${r.status}">${STATUS_JA[r.status]}</td><td>${fmtTps(r.tps)}</td>`;
    el.qt.appendChild(tr);
  }

  // 助言
  const best = rows.find((r) => r.status !== 'no');
  if (!best) {
    let n = count; let fit = null;
    for (n = count + 1; n <= 64; n++) {
      const { best: b } = evaluateAll(gpu, llm, QUANTS.filter((q) => q.id === 'q4'), ctx, n);
      if (b) { fit = b; break; }
    }
    el.advice.textContent = fit
      ? `どの量子化でもメモリに収まらない。同じ機器を ${n} 枚にすれば Q4_K_M で収まる（${fmtGB(fit.need)} / ${fmtGB(fit.available)}）。それ以外はより小さいモデルを選ぶか、CPUオフロードで大幅に遅くなるのを受け入れる。`
      : 'どの量子化でもメモリに収まらない。モデルを変えるしかない。';
  } else if (sel.status === 'no') {
    el.advice.textContent = `${quant.label} では収まらないが、${best.quant.label} なら ${STATUS_JA[best.status]}（${fmtGB(best.need)}、推定 ${fmtTps(best.tps)}）。`;
  } else if (gpu.eff < 0.01) {
    el.advice.textContent = '収まるが、計算律速で実用にならない速度。';
  } else if (sel.tps < 5) {
    el.advice.textContent = '収まるが、対話には遅い。MoEや小さいモデルを選ぶと速くなる。';
  } else {
    el.advice.textContent = '';
  }

  renderSuggestions(gpu, llm, ctx, count);
}

const SG_LIMIT = 10;
function renderSuggestions(gpu, llm, ctx, count) {
  el.sgModelsTitle.textContent = `${gpu.name}${count > 1 ? ` × ${count}` : ''} で動くモデル`;
  el.sgModels.innerHTML = '';
  const ms = rankModelsForGpu(gpu, LLMS, QUANTS, ctx, count).slice(0, SG_LIMIT);
  if (!ms.length) el.sgModels.innerHTML = '<tr><td colspan="3">どのモデルも収まらない</td></tr>';
  for (const x of ms) {
    const tr = document.createElement('tr');
    tr.className = 'pick';
    tr.innerHTML = `<td>${x.model.name}</td><td class="${x.good ? 'good' : 'meh'}">${x.best.quant.label}</td><td>${fmtTps(x.best.tps)}</td>`;
    tr.addEventListener('click', () => { el.llm.value = x.model.id; el.quant.value = x.best.quant.id; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    el.sgModels.appendChild(tr);
  }

  el.sgGpusTitle.textContent = `${llm.name} が動く機器`;
  el.sgGpus.innerHTML = '';
  const gs = rankGpusForModel(llm, GPUS, QUANTS, ctx).slice(0, SG_LIMIT);
  if (!gs.length) el.sgGpus.innerHTML = '<tr><td colspan="3">4枚までではどの機器にも収まらない</td></tr>';
  for (const x of gs) {
    const tr = document.createElement('tr');
    tr.className = 'pick';
    tr.innerHTML = `<td>${x.gpu.name}${x.count > 1 ? ` × ${x.count}` : ''}</td><td class="${x.good ? 'good' : 'meh'}">${x.best.quant.label}</td><td>${fmtTps(x.best.tps)}</td>`;
    tr.addEventListener('click', () => { el.gpu.value = x.gpu.id; el.count.value = String(x.count); el.quant.value = x.best.quant.id; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    el.sgGpus.appendChild(tr);
  }
}

for (const s of [el.gpu, el.count, el.llm, el.quant, el.ctx]) s.addEventListener('change', render);

// ---------- OpenRouter ----------
function apiKey() {
  try { return localStorage.getItem('or_key') || DEFAULT_KEY; } catch { return DEFAULT_KEY; }
}
function usingOwnKey() {
  try { return !!localStorage.getItem('or_key'); } catch { return false; }
}
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

function errorText(status, body) {
  let msg = body?.error?.message || body?.message || '';
  if (status === 401) return `キーが無効（401）。${msg}`;
  if (status === 402) return `キーの利用上限に達した（402）。設定から自分のキーを入れる。${msg}`;
  if (status === 429) return `レート制限か無料枠の上限（429）。少し待つか、設定から自分のキーを入れる。${msg}`;
  if (status === 404) return `モデルが見つからない（404）。${msg}`;
  return `エラー ${status}。${msg}`;
}

const JUDGE_FALLBACKS = ['nvidia/nemotron-3-super-120b-a12b:free', 'google/gemma-4-31b-it:free'];

// fallbacks を渡すと OpenRouter 側で順にフォールバックする。onReasoning は思考トークン受信時に呼ぶ
async function streamChat(model, messages, onDelta, { fallbacks = [], onReasoning = null, signal = undefined } = {}) {
  const res = await fetch(`${OR}/chat/completions`, {
    method: 'POST', signal,
    headers: {
      'Authorization': `Bearer ${apiKey()}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': SITE_URL,
      'X-Title': SITE_TITLE,
    },
    body: JSON.stringify({
      model,
      ...(fallbacks.length ? { models: [model, ...fallbacks.filter((m) => m !== model)] } : {}),
      messages, stream: true, max_tokens: 4000,
      // 思考なしで答えさせる（Nemotron 3 Ultra free で実測: 思考ありは約17秒、なしは約4秒で回答開始）
      reasoning: { enabled: false },
    }),
  });
  if (!res.ok) {
    let body = null; try { body = await res.json(); } catch {}
    throw new Error(errorText(res.status, body));
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let got = false;
  let usedModel = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]') return got;
      let j; try { j = JSON.parse(data); } catch { continue; }
      if (j.error) throw new Error(j.error.message || 'ストリーム中のエラー');
      if (j.model && onReasoning && !usedModel) { usedModel = j.model; onReasoning('', usedModel); }
      const r = j.choices?.[0]?.delta?.reasoning;
      if (r && onReasoning) onReasoning(r, usedModel);
      const d = j.choices?.[0]?.delta?.content;
      if (d) { got = true; onDelta(d); }
    }
  }
  return got;
}

async function loadFreeModels() {
  try {
    const res = await fetch(`${OR}/models`);
    const j = await res.json();
    freeModels = (j.data || []).filter((m) => m.id.endsWith(':free') && (m.architecture?.output_modalities || ['text']).includes('text'));
  } catch (e) {
    freeModels = [{ id: DEFAULT_JUDGE, name: 'NVIDIA: Nemotron 3 Ultra (free)' }];
  }
  freeModels.sort((a, b) => (a.id === DEFAULT_JUDGE ? -1 : b.id === DEFAULT_JUDGE ? 1 : a.name.localeCompare(b.name)));
  fillPlain(el.judgeModel, freeModels, (m) => m.name, (m) => m.id);
  el.judgeModel.value = freeModels.some((m) => m.id === DEFAULT_JUDGE) ? DEFAULT_JUDGE : freeModels[0]?.id;
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

## 答えてほしいこと
1. この概算は妥当か。過大・過小ならどこが違うか
2. 現実に期待できる生成速度と、その根拠
3. 落とし穴（メモリ不足、ソフトウェア対応、熱、電源、ドライバなど）
4. 代替案（量子化、モデル、機器の変更）

日本語で、見出しなしの短い段落と箇条書きで、全体で400字程度。Markdown記法（** や # など）は使わず、プレーンテキストで書いてください。わからないことは「わからない」と書いてください。`;
}

el.judgeBtn.addEventListener('click', async () => {
  el.judgeBtn.disabled = true;
  el.judgeOut.className = 'out';
  el.judgeOut.textContent = '問い合わせ中…';
  const messages = [
    { role: 'system', content: 'あなたはローカルLLM推論のハードウェアに詳しい技術者です。数値の根拠を示し、断定できないことは断定しません。' },
    { role: 'user', content: buildJudgePrompt() },
  ];
  const run = async () => {
    let first = true; let thinking = 0; let used = null;
    let raw = '';
    const got = await streamChat(el.judgeModel.value, messages, (d) => {
      if (first) { el.judgeOut.textContent = ''; first = false; }
      raw += d;
      el.judgeOut.textContent = raw.replace(/\*\*/g, '');
    }, {
      fallbacks: JUDGE_FALLBACKS,
      onReasoning: (r, m) => { used = m; thinking += r.length; if (first) el.judgeOut.textContent = `考え中…（${m || el.judgeModel.value}、思考 ${thinking} 文字）`; },
    });
    if (used && used !== el.judgeModel.value) el.judgeOut.textContent += `\n\n（${el.judgeModel.value} が応答しなかったため ${used} が答えた）`;
    return got;
  };
  try {
    let got = false;
    for (let attempt = 0; attempt < 3 && !got; attempt++) {
      try {
        got = await run();
        if (!got) el.judgeOut.textContent = `応答が空だった。再試行中（${attempt + 1}/3）…`;
      } catch (e) {
        if (attempt === 2 || !/overloaded|502|503|504|timeout/i.test(e.message)) throw e;
        el.judgeOut.textContent = `提供元が混雑中。再試行中（${attempt + 1}/3）… ${e.message}`;
        await new Promise((r) => setTimeout(r, 2500));
      }
    }
    if (!got) el.judgeOut.textContent = '応答が空だった。モデルを変えて再試行する。';
  } catch (e) {
    el.judgeOut.className = 'out err';
    el.judgeOut.textContent = `${e.message}\n時間をおいて再試行するか、別の無料モデルを選ぶ。`;
  } finally {
    el.judgeBtn.disabled = false;
  }
});

// ---------- 起動 ----------
render();
loadFreeModels();
