// 可否判定と推定tok/sの純粋関数。UIから独立しているのでテストできる。

export const RUNTIME_OVERHEAD_GB = 0.8; // 推論ランタイム・活性値の分（概算）
export const KV_BYTES_PER_LAYER_PER_TOKEN = 4096; // GQA 8ヘッド×128次元×K/V×FP16（概算）
export const TIGHT_MARGIN = 0.1; // 空きが10%未満なら「ぎりぎり」

// 層数は公開値をすべて揃えられないので規模から概算する
export function estimateLayers(model) {
  const p = model.total;
  const moe = model.active < model.total;
  if (moe) {
    if (p <= 40) return 32;
    if (p <= 130) return 48;
    if (p <= 300) return 61;
    return 80;
  }
  if (p <= 4) return 28;
  if (p <= 10) return 32;
  if (p <= 15) return 40;
  if (p <= 35) return 64;
  if (p <= 80) return 80;
  return 96;
}

export function weightsGB(model, quant) {
  return model.total * quant.bytes;
}

export function kvCacheGB(model, ctx) {
  return (estimateLayers(model) * KV_BYTES_PER_LAYER_PER_TOKEN * ctx) / 1e9;
}

export function availableGB(gpu, count = 1) {
  return gpu.vram * (gpu.usable ?? 1) * count;
}

// 複数枚はテンソル並列を仮定し、帯域は枚数×0.8で合算する（概算）
export function effectiveBandwidth(gpu, count = 1) {
  return count > 1 ? gpu.bw * count * 0.8 : gpu.bw;
}

export function evaluate(gpu, model, quant, ctx, count = 1) {
  const available = availableGB(gpu, count);
  const weights = weightsGB(model, quant);
  const kv = kvCacheGB(model, ctx);
  const need = weights + kv + RUNTIME_OVERHEAD_GB;
  const margin = available - need;
  let status;
  if (margin < 0) status = 'no';
  else if (margin < available * TIGHT_MARGIN) status = 'tight';
  else status = 'ok';

  // 1トークンごとに読むバイト数 = 活性パラメータの重み + KVキャッシュの半分（平均位置）
  const bytesPerToken = model.active * quant.bytes + kv / 2;
  const eff = gpu.eff ?? 0.67;
  const tps = status === 'no' ? null : (effectiveBandwidth(gpu, count) * eff) / bytesPerToken;

  return { available, weights, kv, overhead: RUNTIME_OVERHEAD_GB, need, margin, status, tps };
}

// 全量子化を評価し、最初に収まるものを返す
export function evaluateAll(gpu, model, quants, ctx, count = 1) {
  const rows = quants.map((q) => ({ quant: q, ...evaluate(gpu, model, q, ctx, count) }));
  const best = rows.find((r) => r.status !== 'no') ?? null;
  return { rows, best };
}

export function fmtGB(x) {
  if (x >= 1000) return (x / 1000).toFixed(2) + ' TB';
  return x.toFixed(1) + ' GB';
}

export function fmtTps(t) {
  if (t == null) return '—';
  if (t < 0.1) return (t * 60).toFixed(1) + ' tok/分';
  if (t < 10) return t.toFixed(1) + ' tok/s';
  return Math.round(t) + ' tok/s';
}

// 量子化の品質順位（小さいほど高品質）。QUANTS の並び順に依存しないように id で引く
const QUALITY = { fp16: 0, q8: 1, q4: 2, q3: 3, iq3: 4, iq2: 5 };
const MIN_GOOD_QUALITY = QUALITY.q4; // Q4_K_M 以上で収まるものを「良い」とみなす
const MIN_GOOD_TPS = 5; // 対話に使える目安

// この機器で動くモデルを良い順に並べる。
// 基準: Q4_K_M 以上で収まり 5 tok/s 以上 → 大きいモデル優先。それ以外は後ろに回す
export function rankModelsForGpu(gpu, models, quants, ctx, count = 1) {
  const out = [];
  for (const m of models) {
    const { best } = evaluateAll(gpu, m, quants, ctx, count);
    if (!best) continue;
    const good = QUALITY[best.quant.id] <= MIN_GOOD_QUALITY && best.tps >= MIN_GOOD_TPS;
    out.push({ model: m, best, good });
  }
  out.sort((a, b) => (b.good - a.good) || (b.model.total - a.model.total) || (b.best.tps - a.best.tps));
  return out;
}

// このモデルが動く機器を良い順に並べる。単体で収まらない独立GPUは 2枚・4枚も候補に入れる。
// 基準: Q4_K_M 以上で収まり 5 tok/s 以上 → 枚数が少ない → 余裕あり → 合計メモリが小さい（安い）順。それ以外は後ろ
export function rankGpusForModel(model, gpus, quants, ctx, counts = [1, 2, 4]) {
  const out = [];
  for (const g of gpus) {
    for (const n of counts) {
      if (n > 1 && g.unified) break; // 統合メモリ機は複数枚にしない
      const { best } = evaluateAll(g, model, quants, ctx, n);
      if (!best) continue;
      const good = QUALITY[best.quant.id] <= MIN_GOOD_QUALITY && best.tps >= MIN_GOOD_TPS;
      out.push({ gpu: g, count: n, best, good });
      if (good) break; // 良い枚数が見つかったらそれ以上は増やさない
    }
  }
  // 良い → 枚数が少ない → 余裕あり（ok）が先 → 合計メモリが小さい → 速い
  const rank = (x) => (x.best.status === 'ok' ? 0 : 1);
  out.sort((a, b) => (b.good - a.good) || (a.count - b.count) || (rank(a) - rank(b)) || (a.gpu.vram * a.count - b.gpu.vram * b.count) || (b.best.tps - a.best.tps));
  return out;
}
