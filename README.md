# こっきクイズ

4歳児むけの「国旗を見て国名・首都をあてる」シンプルなフラッシュカード型クイズアプリ。

## 特徴

- 完全静的（HTML / CSS / JS のみ・ビルドツール不要）
- バックエンド・データベース・ログイン・APIキーすべてなし
- 外部通信は flagcdn.com の国旗画像取得のみ（CSPで他通信を遮断）
- 個人情報を一切扱わない
- カタカナ表記のみ（漢字は使わない）
- 約196カ国に対応

## 遊びかた

1. 大きく表示された国旗を見る
2. 子どもが国名・首都を頭の中で考える
3. 「こたえは？」ボタンを押す
4. 国名・首都が表示される
5. 「わかった！」または「もういちど」を押すと、次の国旗へ自動で進む

## 復習モード

- 「もういちど」を押した国は、自動的に**復習リスト**に登録される
- 画面上部の「ふくしゅう」タブを押すと、復習リストの国だけが出題される
- 「わかった！」を押すと、その国は復習リストから外れる
- 全てクリアすると「すごい！ぜんぶ おぼえたね！」のお祝い画面が出る
- 復習リストはブラウザの `localStorage` に保存される（個人情報なし・国コードのみ）

## ローカルで動かす

`flag-quiz-app/` フォルダで簡易HTTPサーバーを起動します（`file://` 直開きでは JSON 読み込みが CORS で失敗するため、必ずHTTP経由で開いてください）。

**重要：必ず `--bind 127.0.0.1` を付ける**（同一 Wi-Fi 内の他端末からアクセスできなくなります）。

### Python が入っている場合

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

ブラウザで [http://localhost:8000/](http://localhost:8000/) を開く。

### Node.js が入っている場合

```powershell
npx --yes http-server -a 127.0.0.1 -p 8000 -c-1
```

## GitHub Pages で公開する

1. GitHub に新しいリポジトリを作成（例：`flag-quiz`）
2. このフォルダの中身（`flag-quiz-app/` 内のファイル）をリポジトリ直下に push
3. リポジトリ Settings → Pages → Source を `Deploy from a branch` にして、ブランチ `main` / フォルダ `/ (root)` を選択
4. 数分後に `https://<ユーザー名>.github.io/<リポジトリ名>/` で公開される

**公開前のチェック：**
- リポジトリに余計なファイル（パスワードメモ・他プロジェクトの設定ファイル等）が含まれていないか
- `.gitignore` が機能しているか

## ファイル構成

```
flag-quiz-app/
├─ index.html         画面の骨組み（CSP適用）
├─ styles.css         見た目（パステル系・大きなボタン）
├─ app.js             動作（クイズロジック・国旗読み込み）
├─ data/
│   └─ countries.json 約196カ国の名前・首都データ
├─ assets/            将来のアイコン置き場（PWA化時用）
├─ .gitignore
└─ README.md
```

## セキュリティ設計

- **APIキー不使用**：flagcdn.com は鍵なしで利用可能
- **CSP（Content Security Policy）**：`<meta>` タグで通信先を厳密に制限
  - 画像は flagcdn.com からのみ取得可
  - スクリプトは同一オリジンのみ実行可
  - iframeへの埋め込み禁止
- **`innerHTML` 不使用**：すべて `textContent` で書き込み（XSS対策）
- **個人情報なし**：Cookie・LocalStorage・解析タグすべて未使用

## カスタマイズ

### 国を追加・削除する

`data/countries.json` を編集してください。形式：

```json
{ "iso2": "jp", "name": "ニホン", "capital": "トウキョウ", "region": "asia" }
```

- `iso2`: ISO 3166-1 alpha-2 コード（小文字）
- `name`: カタカナの国名
- `capital`: カタカナの首都名
- `region`: `asia` / `europe` / `north-america` / `south-america` / `africa` / `oceania`

### 色やフォントを変えたい

`styles.css` 冒頭の `:root` セクションの CSS 変数を編集。

## 将来の追加候補

- 地域別フィルタ（`region` フィールドを利用）
- 音声読み上げ（`SpeechSynthesisUtterance`、外部API不要）
- 学習履歴・お気に入り（`localStorage` で完結）
- PWA化（オフライン動作）
- 自動再生モード
