import test from 'node:test';
import assert from 'node:assert/strict';
import { GPUS, LLMS, QUANTS } from '../data.js';
import { evaluate, evaluateAll, kvCacheGB, weightsGB } from '../calc.js';

const gpu = (id) => GPUS.find((g) => g.id === id);
const llm = (id) => LLMS.find((m) => m.id === id);
const q = (id) => QUANTS.find((x) => x.id === id);

test('PS5: Qwen3.8 27B は IQ3 なら収まり 20 tok/s 前後（報告値に合わせた校正）', () => {
  const r = evaluate(gpu('ps5'), llm('qwen3.8-27b'), q('iq3'), 4096);
  assert.notEqual(r.status, 'no');
  assert.ok(r.tps > 15 && r.tps < 30, `tps=${r.tps}`);
});

test('PS5: Qwen3.8 27B の Q4 は VRAM に収まらない', () => {
  const r = evaluate(gpu('ps5'), llm('qwen3.8-27b'), q('q4'), 4096);
  assert.equal(r.status, 'no');
});

test('PS5 CPUのみ: 27B は tok/分 のオーダー', () => {
  const r = evaluate(gpu('ps5cpu'), llm('qwen3.8-27b'), q('q3'), 4096);
  assert.ok(r.tps < 0.1, `tps=${r.tps}`);
});

test('RTX 5090: Kimi K3 2.8T はどの量子化でも不可', () => {
  const { best, rows } = evaluateAll(gpu('rtx5090'), llm('kimi-k3'), QUANTS, 8192);
  assert.equal(best, null);
  assert.ok(rows.every((r) => r.status === 'no'));
});

test('M3 Ultra 512GB: DeepSeek V3.2 は Q4 で収まる', () => {
  const r = evaluate(gpu('m3ultra512'), llm('ds-v3.2'), q('q4'), 8192);
  assert.notEqual(r.status, 'no');
});

test('枚数を増やすと容量が増える', () => {
  const one = evaluate(gpu('rtx5090'), llm('llama3.3-70b'), q('q4'), 8192, 1);
  const two = evaluate(gpu('rtx5090'), llm('llama3.3-70b'), q('q4'), 8192, 2);
  assert.equal(one.status, 'no');
  assert.notEqual(two.status, 'no');
});

test('コンテキストを伸ばすと KV が増える', () => {
  const m = llm('llama3.3-70b');
  assert.ok(kvCacheGB(m, 32768) > kvCacheGB(m, 4096) * 7);
});

test('重みサイズ = total × bytes', () => {
  assert.equal(weightsGB(llm('llama3.1-8b'), q('fp16')), 16);
});

test('データの整合: すべての GPU/LLM に必要な項目がある', () => {
  for (const g of GPUS) assert.ok(g.vram > 0 && g.bw > 0 && g.name && g.group, g.id);
  for (const m of LLMS) assert.ok(m.total > 0 && m.active > 0 && m.active <= m.total && m.orId, m.id);
  const ids = new Set();
  for (const x of [...GPUS, ...LLMS]) { assert.ok(!ids.has(x.id), 'dup ' + x.id); ids.add(x.id); }
});

