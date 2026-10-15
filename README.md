# LLM Check

そのGPUで、そのモデルは動く？ GPUやゲーム機とオープンウェイトLLMの組み合わせを選ぶと、メモリと帯域の試算（計算上の判定）を出し、OpenRouterの無料モデルにソフトウェア対応や実行環境まで含めた「実際に動くか」の見立てを聞く。

公開ページ: https://konaito.github.io/gpu-test/

## 設計の軸

「計算上は可能」と「実際に動く」を分ける。メモリと帯域の試算は根拠にすぎず、画面では下に置く。主役はAIの実用判定（動く見込み／条件付きで動く／動かない見込み／わからない）で、一番上に出す。AIの回答も推測であり、動作保証ではないことを常に表示する。

## できること

- GPU（GeForce、ワークステーション、Jetson、PS5、Xbox、Steam Deck、Radeon、Apple、CPUのみ）を選ぶ
- LLM（Qwen、DeepSeek、Kimi、GLM、Gemma、gpt-oss、Llama、Mistral、Nemotronなど）を選ぶ
- 量子化・コンテキスト長・枚数を変えて、必要メモリと推定tok/sを見る
- 収まらない組み合わせは「計算上は不可」と出し、何枚なら収まるかを示す
- 「判定して、AIの所見を聞く」で、組み合わせと試算をOpenRouterの無料モデルに送り、実用判定・所見・リスク・代替案をストリーミングで表示する

## 所見に使う無料モデル

2026-10-15 に同じ質問を各2回投げた実測で、安定して答えたものを順に使う。本命は Nemotron 3 Super、落ちたら OpenRouter 側で次の2つに回す。

| モデル | 成功 | 最初の文字まで | 全文まで |
|---|---|---|---|
| Nemotron 3 Super | 2/2 | 0.5〜0.8秒 | 21秒 |
| Nemotron 3 Ultra | 2/2 | 1.3〜2.9秒 | 24秒 |
| Nemotron 3.5 Lightning | 2/2 | 0.5〜0.9秒 | 7〜19秒 |
| Cohere North Mini Code | 2/2 | 0.6〜0.8秒 | 17〜23秒 |
| Poolside Laguna S 2.1 | 1/2 | 0.9秒 | 10秒 |

Gemma 4 は 429、Inkling は 403、Dots3 / LFM2.5 / Nano Omni はエラーが多く外した。

## 計算の前提

- 必要メモリ = 総パラメータ数 × 量子化のバイト数 + KVキャッシュ + ランタイム0.8 GB
- 推定tok/s = 帯域 × 帯域効率 ÷ 1トークンあたりの読み出し量（活性パラメータ + KVの半分）
- 量子化のバイト数はGemma 3 27BとLlama 3.3 70BのGGUFファイルサイズで校正した
- PS5の帯域効率は「GPUで27Bを約20 tok/s」というX投稿の報告値に合わせた。未検証

どれも概算で、実測ではない。数値は `data.js` にあり、出典はOpenRouterのモデルページと各社の公開仕様。

## APIキー

公開ページの既定キーは、リポジトリには置かず、GitHub Actionsのデプロイ時にsecret `OPENROUTER_PUBLIC_KEY` から `config.js` に埋め込む。OpenRouter側で利用上限を0.1 USDに固定してある。無料モデルは0 USDで動くが、1日あたりのリクエスト数に上限がある。枠が尽きたら画面の設定から自分のキーを入れる。キーはブラウザのlocalStorageにだけ保存する。

ローカルで開いたときは既定キーが空なので、設定から自分のキーを入れる。

## 開発

ビルドは不要。静的ファイルをそのまま配信する。

```sh
python3 -m http.server 8080
node --test "test/**/*.test.mjs"
```
