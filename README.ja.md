[English](./README.md) | **日本語**

<div align="center">
<img src="./public/Logo.png" alt="YomuJi Logo" width="84" />
<h1>YomuJi (読む字)</h1>
<p>日々の読書と学習に使える、日本語・ベトナム語辞典。</p>
<p><strong><a href="https://yomuji.vercel.app">YomuJi を使う</a></strong></p>
</div>

<p align="center">
<img alt="Next.js" src="https://img.shields.io/badge/Next.js_16-000000?style=flat-square&logo=nextdotjs&logoColor=white" />
<img alt="React" src="https://img.shields.io/badge/React_19-20232A?style=flat-square&logo=react&logoColor=61DAFB" />
<img alt="TypeScript" src="https://img.shields.io/badge/TypeScript_5.7-3178C6?style=flat-square&logo=typescript&logoColor=white" />
<img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind_CSS_v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" />
<img alt="Supabase" src="https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white" />
<img alt="Turso" src="https://img.shields.io/badge/Turso_libSQL-4FF8D2?style=flat-square&logo=sqlite&logoColor=black" />
</p>

## YomuJi について

YomuJi (読む字) は、ベトナム語を使う日本語学習者のための Web アプリです。単語の検索、漢字の学習、日本語の読書を一か所で行えます。知らない単語の意味・読み方・例文を調べたり、ライブラリの作品を読みながら単語を検索したりできます。

スマートフォンやパソコンのブラウザから、そのまま利用できます。画面の表示言語はベトナム語です。

## 主な機能

- **日越辞書検索** — 漢字・かな・ローマ字・ベトナム語の意味から単語を検索できます。
- **読み方と用例** — 読み方、ベトナム語の意味、例文を確認でき、単語や例文の発音も聞けます。
- **漢字を調べる** — 意味、音読み・訓読み、部首を確認でき、対応する漢字では筆順アニメーションも見られます。
- **読書ライブラリ** — 青空文庫の日本語作品を読み、ふりがな表示や文字サイズを調整できます。単語や語句を選択すると辞書検索に移れます。
- **保存と復習** — 単語や漢字をブラウザに保存し、保存した単語の読み方と意味を短いセッションで復習できます。
- **表示の設定** — ライト・ダーク・システム連動のテーマを選べます。
- **AI 漢字解説（試験的機能）** — AI サービスが利用できる場合、ベトナム語の解説や覚え方をリクエストできます。

## 利用前のヒント

オンライン辞書が利用できないと表示された場合は、インターネット接続中に **Thiết lập（設定）→ Tải dữ liệu offline（オフラインデータをダウンロード）** を開き、ダウンロード完了後に再度検索してください。一部の単語詳細や音声には接続が必要な場合があります。

保存した項目は現在のブラウザ内に残り、復習結果はそのセッション中のみ保持されます。フラッシュカードのデッキと活用表はサンプルのプレビューで、学習ツールとしては未完成です。JLPT 学習はまだ利用できません。

## 開発

ローカルでの起動や開発については、[開発ガイド（英語）](./docs/development.md)をご覧ください。[Web アプリ](https://yomuji.vercel.app)の利用にローカル環境の準備は不要です。

## ライセンス・クレジット

- **コミュニティ用例:** [Tatoeba API](https://api.tatoeba.org/) から日本語・ベトナム語の文を単語詳細に自動表示します。API キー不要、インターネット接続が必要です。出典情報はライセンスページに記載しています。
- **辞書・筆順データ:** [データマニフェスト](./public/dict/manifest.json)に記載された OmohaDictionary、KANJIDIC (Vietnamese)、KanjiDictVN、animCJK、KanjiVG。
- **読書ライブラリ:** [青空文庫](https://www.aozora.gr.jp/)。アプリの[出典・利用上の注意](https://yomuji.vercel.app/legal)もご覧ください。
- **フォント:** Lora。[SIL Open Font License](./public/fonts/OFL.txt)に基づいて配布されています。
