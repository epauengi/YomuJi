**English** | [日本語](./README.ja.md)

<div align="center">
<img src="./public/Logo.png" alt="YomuJi Logo" width="84" />
<h1>YomuJi (読む字)</h1>
<p>A Japanese–Vietnamese dictionary for everyday reading and learning.</p>
<p><strong><a href="https://yomuji.vercel.app">Try YomuJi</a></strong></p>
</div>

<p align="center">
<img alt="Next.js" src="https://img.shields.io/badge/Next.js_16-000000?style=flat-square&logo=nextdotjs&logoColor=white" />
<img alt="React" src="https://img.shields.io/badge/React_19-20232A?style=flat-square&logo=react&logoColor=61DAFB" />
<img alt="TypeScript" src="https://img.shields.io/badge/TypeScript_5.7-3178C6?style=flat-square&logo=typescript&logoColor=white" />
<img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind_CSS_v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" />
<img alt="Supabase" src="https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white" />
<img alt="Turso" src="https://img.shields.io/badge/Turso_libSQL-4FF8D2?style=flat-square&logo=sqlite&logoColor=black" />
</p>

## About YomuJi

YomuJi (読む字) helps Vietnamese-speaking learners look up Japanese words, explore kanji, and read Japanese texts in one place. Move from an unfamiliar word to its meaning, reading, and examples, or pick a story from the reading library and look up words as you go.

Use it directly in your browser, on a phone or computer. The interface is in Vietnamese.

## Features

- **Japanese–Vietnamese lookup** — Search using kanji, kana, romaji, or Vietnamese meanings.
- **Words in context** — See readings, Vietnamese definitions, and example sentences, with audio pronunciation for words and examples.
- **Kanji exploration** — Check meanings, on/kun readings, radicals, and animated stroke order where available.
- **Reading library** — Read Japanese works from Aozora Bunko, toggle furigana, adjust text size, and select a word or phrase to open a dictionary search.
- **Saved words and review** — Save vocabulary and kanji in your browser, then practice recalling saved vocabulary in short review sessions.
- **Reading preferences** — Switch between light, dark, and system themes to suit your reading environment.
- **AI kanji help (experimental)** — Request Vietnamese explanations and memory aids when the AI service is available.

## Before You Start

If a lookup reports that the online dictionary is unavailable, open **Thiết lập (Settings) → Tải dữ liệu offline** while connected to the internet, let the download finish, then retry. Some word details and audio may still need a connection.

Saved items stay in the current browser; review results last only for the current session. Flashcard decks are sample previews, not complete study tools. Conjugation analysis is integrated into dictionary search, with expandable form tables on word detail pages. JLPT study is not yet available.

## Development

Want to run YomuJi locally or work on the project? See the [development guide](./docs/development.md). No local setup is needed to use the [web app](https://yomuji.vercel.app).

## License & Credits

- **Dictionary and stroke data:** OmohaDictionary, KANJIDIC (Vietnamese), KanjiDictVN, animCJK, and KanjiVG, as listed in the [data manifest](./public/dict/manifest.json).
- **Community examples:** [Tatoeba API](https://api.tatoeba.org/); Japanese–Vietnamese sentences load automatically on word detail pages, without an API key. Source information is available on the legal page. Requires an internet connection.
- **Reading library:** [Aozora Bunko](https://www.aozora.gr.jp/); see the app’s [source credits and usage notes](https://yomuji.vercel.app/legal).
- **Font:** Lora, distributed under the [SIL Open Font License](./public/fonts/OFL.txt).
