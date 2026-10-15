// 公開用の既定キー。リポジトリには置かず、GitHub Actions のデプロイ時に secret OPENROUTER_PUBLIC_KEY で置換する。
// OpenRouter 側で利用上限 0.1 USD に固定してある（無料モデルの利用は 0 USD で、1日あたりのリクエスト数に上限がある）。
// 置換されていない（ローカル実行など）ときは空になり、画面の設定から自分のキーを入れて使う。
const injected = '__OPENROUTER_PUBLIC_KEY__';
export const DEFAULT_KEY = injected.startsWith('sk-or-') ? injected : '';
export const DEFAULT_JUDGE = 'nvidia/nemotron-3-ultra-550b-a55b:free';
export const SITE_URL = 'https://konaito.github.io/gpu-test/';
export const SITE_TITLE = 'GPU x Local LLM Check';
