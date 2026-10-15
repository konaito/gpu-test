// GPU・LLM・量子化の定義。数値はベンダー公開仕様（カタログ値）を基本とし、
// 未確認のものは note に「概算」「報告値」と書く。
// vram: GB, bw: メモリ帯域 GB/s, usable: LLMに使える割合（統合メモリはOS分を引く）,
// eff: 帯域効率（実測tok/s ÷ 帯域÷1トークンあたり読み出し量。単体GPUは0.67、統合メモリは0.6前後の概算）

export const GPUS = [
  // NVIDIA GeForce
  { id: 'rtx5090', group: 'NVIDIA GeForce', name: 'RTX 5090 (32GB)', vram: 32, bw: 1792, usable: 0.95, eff: 0.67 },
  { id: 'rtx5080', group: 'NVIDIA GeForce', name: 'RTX 5080 (16GB)', vram: 16, bw: 960, usable: 0.95, eff: 0.67 },
  { id: 'rtx5070ti', group: 'NVIDIA GeForce', name: 'RTX 5070 Ti (16GB)', vram: 16, bw: 896, usable: 0.95, eff: 0.67 },
  { id: 'rtx5070', group: 'NVIDIA GeForce', name: 'RTX 5070 (12GB)', vram: 12, bw: 672, usable: 0.95, eff: 0.67 },
  { id: 'rtx5060ti16', group: 'NVIDIA GeForce', name: 'RTX 5060 Ti (16GB)', vram: 16, bw: 448, usable: 0.95, eff: 0.67 },
  { id: 'rtx5060', group: 'NVIDIA GeForce', name: 'RTX 5060 (8GB)', vram: 8, bw: 448, usable: 0.95, eff: 0.67 },
  { id: 'rtx4090', group: 'NVIDIA GeForce', name: 'RTX 4090 (24GB)', vram: 24, bw: 1008, usable: 0.95, eff: 0.67 },
  { id: 'rtx4080s', group: 'NVIDIA GeForce', name: 'RTX 4080 SUPER (16GB)', vram: 16, bw: 736, usable: 0.95, eff: 0.67 },
  { id: 'rtx4070tis', group: 'NVIDIA GeForce', name: 'RTX 4070 Ti SUPER (16GB)', vram: 16, bw: 672, usable: 0.95, eff: 0.67 },
  { id: 'rtx4070', group: 'NVIDIA GeForce', name: 'RTX 4070 (12GB)', vram: 12, bw: 504, usable: 0.95, eff: 0.67 },
  { id: 'rtx4060ti16', group: 'NVIDIA GeForce', name: 'RTX 4060 Ti (16GB)', vram: 16, bw: 288, usable: 0.95, eff: 0.67 },
  { id: 'rtx3090', group: 'NVIDIA GeForce', name: 'RTX 3090 (24GB)', vram: 24, bw: 936, usable: 0.95, eff: 0.67 },
  { id: 'rtx3060', group: 'NVIDIA GeForce', name: 'RTX 3060 (12GB)', vram: 12, bw: 360, usable: 0.95, eff: 0.67 },
  // NVIDIA ワークステーション / データセンター
  { id: 'rtxpro6000', group: 'NVIDIA ワークステーション / DC', name: 'RTX PRO 6000 Blackwell (96GB)', vram: 96, bw: 1792, usable: 0.95, eff: 0.67 },
  { id: 'rtx6000ada', group: 'NVIDIA ワークステーション / DC', name: 'RTX 6000 Ada (48GB)', vram: 48, bw: 960, usable: 0.95, eff: 0.67 },
  { id: 'l40s', group: 'NVIDIA ワークステーション / DC', name: 'L40S (48GB)', vram: 48, bw: 864, usable: 0.95, eff: 0.67 },
  { id: 'a100-80', group: 'NVIDIA ワークステーション / DC', name: 'A100 (80GB)', vram: 80, bw: 2039, usable: 0.95, eff: 0.67 },
  { id: 'h100sxm', group: 'NVIDIA ワークステーション / DC', name: 'H100 SXM (80GB)', vram: 80, bw: 3350, usable: 0.95, eff: 0.67 },
  { id: 'h200', group: 'NVIDIA ワークステーション / DC', name: 'H200 (141GB)', vram: 141, bw: 4800, usable: 0.95, eff: 0.67 },
  { id: 'b200', group: 'NVIDIA ワークステーション / DC', name: 'B200 (192GB)', vram: 192, bw: 8000, usable: 0.95, eff: 0.67, note: '帯域はカタログ値の概算' },
  { id: 'dgxspark', group: 'NVIDIA ワークステーション / DC', name: 'DGX Spark (GB10, 128GB 統合)', vram: 128, bw: 273, usable: 0.9, eff: 0.6, unified: true },
  { id: 'agxorin64', group: 'NVIDIA ワークステーション / DC', name: 'Jetson AGX Orin (64GB 統合)', vram: 64, bw: 204.8, usable: 0.85, eff: 0.55, unified: true },
  { id: 'orinnano', group: 'NVIDIA ワークステーション / DC', name: 'Jetson Orin Nano Super (8GB 統合)', vram: 8, bw: 102, usable: 0.8, eff: 0.55, unified: true },
  // ゲーム機
  { id: 'ps5', group: 'ゲーム機', name: 'PlayStation 5 (16GB GDDR6 統合)', vram: 16, bw: 448, usable: 0.8, eff: 0.6, unified: true, note: '報告値: GPUでQwen3.8 27Bを約20 tok/s（2026-10-14のX投稿、未検証）。帯域効率0.6はこの報告値に合わせた概算' },
  { id: 'ps5pro', group: 'ゲーム機', name: 'PlayStation 5 Pro (16GB GDDR6 統合)', vram: 16, bw: 576, usable: 0.8, eff: 0.6, unified: true },
  { id: 'ps5cpu', group: 'ゲーム機', name: 'PlayStation 5（CPUのみ、GPU不使用）', vram: 16, bw: 448, usable: 0.8, eff: 0.0008, unified: true, note: '報告値: CPUだけでは27Bが約1 tok/分。計算律速なので帯域効率を極端に下げて再現している（概算）' },
  { id: 'xsx', group: 'ゲーム機', name: 'Xbox Series X (高速プール10GB)', vram: 10, bw: 560, usable: 0.9, eff: 0.67, unified: true, note: '16GBのうち高速な10GBだけを数える' },
  { id: 'steamdeck', group: 'ゲーム機', name: 'Steam Deck OLED (16GB LPDDR5 統合)', vram: 16, bw: 102.4, usable: 0.6, eff: 0.5, unified: true },
  // AMD / Apple
  { id: 'rx7900xtx', group: 'AMD / Apple', name: 'Radeon RX 7900 XTX (24GB)', vram: 24, bw: 960, usable: 0.95, eff: 0.6 },
  { id: 'rx9070xt', group: 'AMD / Apple', name: 'Radeon RX 9070 XT (16GB)', vram: 16, bw: 640, usable: 0.95, eff: 0.6 },
  { id: 'aimax395', group: 'AMD / Apple', name: 'Ryzen AI Max+ 395 (128GB 統合)', vram: 128, bw: 256, usable: 0.75, eff: 0.6, unified: true },
  { id: 'm3ultra512', group: 'AMD / Apple', name: 'Mac Studio M3 Ultra (512GB 統合)', vram: 512, bw: 819, usable: 0.85, eff: 0.6, unified: true },
  { id: 'm4max128', group: 'AMD / Apple', name: 'MacBook Pro M4 Max (128GB 統合)', vram: 128, bw: 546, usable: 0.85, eff: 0.6, unified: true },
  { id: 'm4pro64', group: 'AMD / Apple', name: 'Mac mini M4 Pro (64GB 統合)', vram: 64, bw: 273, usable: 0.85, eff: 0.6, unified: true },
  { id: 'm4-16', group: 'AMD / Apple', name: 'Mac mini M4 (16GB 統合)', vram: 16, bw: 120, usable: 0.7, eff: 0.6, unified: true },
  // CPUのみ
  { id: 'cpu-ddr5-64', group: 'CPUのみ', name: 'デスクトップCPU + DDR5-5600 2ch 64GB', vram: 64, bw: 90, usable: 0.9, eff: 0.4, unified: true, note: 'CPU推論は計算律速になりやすく、ここの推定より遅いことが多い' },
  { id: 'cpu-ddr5-512', group: 'CPUのみ', name: 'サーバーCPU + DDR5 8ch 512GB', vram: 512, bw: 300, usable: 0.9, eff: 0.35, unified: true, note: 'CPU推論は計算律速になりやすく、ここの推定より遅いことが多い' },
];

// total/active: 10億パラメータ単位。orId: OpenRouterのモデルID（出典リンク用）。
// 数値の出典は OpenRouter のモデル説明文と各社の公開情報。
export const LLMS = [
  { id: 'qwen3.8-27b', group: 'Qwen', name: 'Qwen3.8 27B（dense）', total: 27, active: 27, orId: 'qwen/qwen3.8-27b' },
  { id: 'qwen3.8-2.4t', group: 'Qwen', name: 'Qwen3.8 2.4T A95B（MoE）', total: 2400, active: 95, orId: 'qwen/qwen3.8-2.4t-a95b' },
  { id: 'qwen3.6-27b', group: 'Qwen', name: 'Qwen3.6 27B（dense）', total: 27, active: 27, orId: 'qwen/qwen3.6-27b' },
  { id: 'qwen3.6-35b-a3b', group: 'Qwen', name: 'Qwen3.6 35B A3B（MoE）', total: 35, active: 3, orId: 'qwen/qwen3.6-35b-a3b' },
  { id: 'qwen3.5-9b', group: 'Qwen', name: 'Qwen3.5 9B（dense）', total: 9, active: 9, orId: 'qwen/qwen3.5-9b' },
  { id: 'qwen3.5-122b', group: 'Qwen', name: 'Qwen3.5 122B A10B（MoE）', total: 122, active: 10, orId: 'qwen/qwen3.5-122b-a10b' },
  { id: 'qwen3.5-397b', group: 'Qwen', name: 'Qwen3.5 397B A17B（MoE）', total: 397, active: 17, orId: 'qwen/qwen3.5-397b-a17b' },
  { id: 'qwen3-coder-next', group: 'Qwen', name: 'Qwen3 Coder Next 80B A3B（MoE）', total: 80, active: 3, orId: 'qwen/qwen3-coder-next' },
  { id: 'qwen3-32b', group: 'Qwen', name: 'Qwen3 32B（dense）', total: 32, active: 32, orId: 'qwen/qwen3-32b' },
  { id: 'qwen3-235b', group: 'Qwen', name: 'Qwen3 235B A22B 2507（MoE）', total: 235, active: 22, orId: 'qwen/qwen3-235b-a22b-2507' },
  { id: 'ds-v4-pro', group: 'DeepSeek', name: 'DeepSeek V4 Pro 1.6T A49B（MoE）', total: 1600, active: 49, orId: 'deepseek/deepseek-v4-pro-0813' },
  { id: 'ds-v4-flash', group: 'DeepSeek', name: 'DeepSeek V4 Flash 284B A13B（MoE）', total: 284, active: 13, orId: 'deepseek/deepseek-v4-flash-0731' },
  { id: 'ds-v3.2', group: 'DeepSeek', name: 'DeepSeek V3.2 671B A37B（MoE）', total: 671, active: 37, orId: 'deepseek/deepseek-v3.2' },
  { id: 'kimi-k3', group: 'Moonshot', name: 'Kimi K3 2.8T A104B（MoE）', total: 2800, active: 104, orId: 'moonshotai/kimi-k3' },
  { id: 'kimi-k2.6', group: 'Moonshot', name: 'Kimi K2.6 1T A32B（MoE）', total: 1000, active: 32, orId: 'moonshotai/kimi-k2.6' },
  { id: 'glm-5.3', group: 'Z.ai', name: 'GLM-5.3 744B A40B（MoE）', total: 744, active: 40, orId: 'z-ai/glm-5.3' },
  { id: 'glm-4.7-flash', group: 'Z.ai', name: 'GLM-4.7 Flash 30B A3B（MoE）', total: 30, active: 3, orId: 'z-ai/glm-4.7-flash' },
  { id: 'gemma4-31b', group: 'Google', name: 'Gemma 4 31B（dense）', total: 30.7, active: 30.7, orId: 'google/gemma-4-31b-it' },
  { id: 'gemma4-26b-a4b', group: 'Google', name: 'Gemma 4 26B A4B（MoE）', total: 25.2, active: 3.8, orId: 'google/gemma-4-26b-a4b-it' },
  { id: 'gpt-oss-120b', group: 'OpenAI', name: 'gpt-oss-120b 117B A5.1B（MoE）', total: 117, active: 5.1, orId: 'openai/gpt-oss-120b' },
  { id: 'gpt-oss-20b', group: 'OpenAI', name: 'gpt-oss-20b 21B A3.6B（MoE）', total: 21, active: 3.6, orId: 'openai/gpt-oss-20b' },
  { id: 'llama4-scout', group: 'Meta', name: 'Llama 4 Scout 109B A17B（MoE）', total: 109, active: 17, orId: 'meta-llama/llama-4-scout' },
  { id: 'llama4-maverick', group: 'Meta', name: 'Llama 4 Maverick 400B A17B（MoE）', total: 400, active: 17, orId: 'meta-llama/llama-4-maverick' },
  { id: 'llama3.3-70b', group: 'Meta', name: 'Llama 3.3 70B（dense）', total: 70, active: 70, orId: 'meta-llama/llama-3.3-70b-instruct' },
  { id: 'llama3.1-8b', group: 'Meta', name: 'Llama 3.1 8B（dense）', total: 8, active: 8, orId: 'meta-llama/llama-3.1-8b-instruct' },
  { id: 'mistral-small4', group: 'Mistral', name: 'Mistral Small 4 119B A6.5B（MoE）', total: 119, active: 6.5, orId: 'mistralai/mistral-small-2603' },
  { id: 'devstral2', group: 'Mistral', name: 'Devstral 2 123B（dense）', total: 123, active: 123, orId: 'mistralai/devstral-2512' },
  { id: 'nemotron3-ultra', group: 'NVIDIA', name: 'Nemotron 3 Ultra 550B A55B（MoE）', total: 550, active: 55, orId: 'nvidia/nemotron-3-ultra-550b-a55b' },
  { id: 'nemotron3-super', group: 'NVIDIA', name: 'Nemotron 3 Super 120B A12B（MoE）', total: 120, active: 12, orId: 'nvidia/nemotron-3-super-120b-a12b' },
  { id: 'nemotron3-nano', group: 'NVIDIA', name: 'Nemotron 3 Nano 30B A3B（MoE）', total: 30, active: 3, orId: 'nvidia/nemotron-3-nano-30b-a3b' },
  { id: 'nemotron3.5-lightning', group: 'NVIDIA', name: 'Nemotron 3.5 Lightning 30B A3B（MoE）', total: 30, active: 3, orId: 'nvidia/nemotron-3.5-lightning' },
  { id: 'step5', group: 'その他', name: 'Step 5 Preview 600B A27B（MoE）', total: 600, active: 27, orId: 'stepfun/step-5-preview' },
  { id: 'hy4', group: 'その他', name: 'Tencent Hy4 preview 770B A49B（MoE）', total: 770, active: 49, orId: 'tencent/hy4-preview' },
  { id: 'ling3.1-flash', group: 'その他', name: 'Ling 3.1 Flash 560B A25B（MoE）', total: 560, active: 25, orId: 'inclusionai/ling-3.1-flash' },
  { id: 'lfm2.5-24b', group: 'その他', name: 'LFM2.5 24B A2B（MoE）', total: 24, active: 2.45, orId: 'liquid/lfm-2.5-24b-a2b' },
  { id: 'phi4', group: 'その他', name: 'Phi-4 14B（dense）', total: 14, active: 14, orId: 'microsoft/phi-4' },
];

// bytes: 1パラメータあたりのバイト数（GGUFの実ファイルサイズに近い概算）
// 校正: Gemma 3 27B / Llama 3.3 70B の GGUF 実ファイルサイズ ÷ パラメータ数
export const QUANTS = [
  { id: 'fp16', label: 'FP16 / BF16', bytes: 2.0 },
  { id: 'q8', label: 'Q8_0（8bit）', bytes: 1.06 },
  { id: 'q4', label: 'Q4_K_M（約4.8bit）', bytes: 0.6 },
  { id: 'q3', label: 'Q3_K_M（約4bit）', bytes: 0.5 },
  { id: 'iq3', label: 'IQ3_XXS（約3.2bit）', bytes: 0.4 },
  { id: 'iq2', label: 'IQ2_XXS（約2.3bit）', bytes: 0.29 },
];

export const CONTEXTS = [2048, 4096, 8192, 16384, 32768, 65536, 131072];
