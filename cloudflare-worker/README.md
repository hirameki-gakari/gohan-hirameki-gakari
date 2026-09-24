# hirameki-photo-proxy

Unsplash APIキーをブラウザ(index.html)から隠すためのCloudflare Worker。
以前はindex.htmlにUnsplashのAccess Keyを直書きしており、公開GitHubリポジトリに
そのままコミットされていた。誰でもブラウザの開発者ツールから読める状態だったため、
このWorkerを間に挟み、キーはCloudflare側のSecretとしてのみ保持する。

## 初回セットアップ(このフォルダで実行)

```sh
npx wrangler login
```

ブラウザが開くのでCloudflareアカウントでログインする(アカウントがなければ無料で作成)。

```sh
npx wrangler secret put UNSPLASH_ACCESS_KEY
```

プロンプトが出たら、**新しく発行し直したUnsplashのAccess Key**を貼り付ける。
(旧キー `-Es-nrgH78WhEwxwEHN-4wYh2k1jOcX4DhxijEWHBAg` はGit履歴に残っているため、
Unsplash側の管理画面で無効化 → 新規発行してから使うこと)

```sh
npx wrangler deploy
```

デプロイが終わると `https://hirameki-photo-proxy.<あなたのサブドメイン>.workers.dev`
のようなURLが表示される。このURLを `index.html` 内の `PHOTO_PROXY_BASE` に設定する。

## 更新のたびに

`worker.js` を変更したら、このフォルダで `npx wrangler deploy` を再実行する。
