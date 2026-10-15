# GPU × ローカルLLM 可否チェック

GPUやゲーム機とオープンウェイトLLMの組み合わせを選ぶと、メモリに収まるかと推定tok/sをブラウザ内で概算する。あわせてOpenRouterの無料モデルに所見を聞いたり、同じモデルの無料版と会話したりできる。

公開ページ: https://konaito.github.io/gpu-test/

## できること

- GPU（GeForce、ワークステーション、Jetson、PS5、Xbox、Steam Deck、Radeon、Apple、CPUのみ）を選ぶ
- LLM（Qwen、DeepSeek、Kimi、GLM、Gemma、gpt-oss、Llama、Mistral、Nemotronなど）を選ぶ
- 量子化・コンテキスト長・枚数を変えて、必要メモリと推定tok/sを見る
- 収まらない組み合わせは「不可」と出し、何枚なら収まるかを示す
- OpenRouterの無料モデル（既定はNemotron 3 Ultra）に組み合わせの所見を聞く
- 選んだLLMに無料エンドポイントがあれば、そのモデルと直接会話する

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
