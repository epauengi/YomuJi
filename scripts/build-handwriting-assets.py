#!/usr/bin/env python3
"""Build self-hosted handwriting fonts and Japanese kana SVGs from pinned sources."""

import concurrent.futures
import json
import pathlib
import re
import time
import unicodedata
import urllib.request
import xml.etree.ElementTree as ET


ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "handwriting"
SOURCES = {
    "kanjivg": {
        "repository": "https://github.com/KanjiVG/kanjivg",
        "commit": "9d7220dfca09107dca2e0b0e45f90f696185e3c3",
        "license": "CC BY-SA 3.0",
        "license_url": "https://creativecommons.org/licenses/by-sa/3.0/",
        "license_file": "licenses/KanjiVG-COPYING.txt",
    },
    "klee": {
        "repository": "https://github.com/fontworks-fonts/Klee",
        "commit": "8b0532731b63ad8a445ca341d8d7d941079b83ab",
        "license": "SIL Open Font License 1.1",
        "license_url": "https://openfontlicense.org/",
        "license_file": "licenses/Klee-OFL.txt",
    },
    "noto": {
        "repository": "https://github.com/notofonts/noto-fonts",
        "commit": "ffebf8c1ee449e544955a7e813c54f9b73848eac",
        "license": "SIL Open Font License 1.1",
        "license_url": "https://openfontlicense.org/",
        "license_file": "licenses/NotoSans-OFL.txt",
    },
}
USER_AGENT = "jpvndict-handwriting-assets/1.0"
ARPHIC_LICENSE_URL = "https://ftp.gnu.org/non-gnu/chinese-fonts-truetype/LICENSE"
HIRAGANA = "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん"
KATAKANA = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン"
CODEPOINTS = set(range(0x3041, 0x30A0)) | set(range(0x30A1, 0x3100)) | set(range(0x31F0, 0x3200))


def download(url):
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                return response.read()
        except Exception:
            if attempt == 2:
                raise
            time.sleep(attempt + 1)


def raw_url(source, path):
    info = SOURCES[source]
    return f"https://raw.githubusercontent.com/{info['repository'].split('github.com/')[1]}/{info['commit']}/{path}"


def checked_write(path, data, kind):
    if not data or data.lstrip().lower().startswith((b"<!doctype html", b"<html")):
        raise ValueError(f"Invalid {kind} download: {path}")
    if kind == "font" and data[:4] not in (b"\x00\x01\x00\x00", b"OTTO"):
        raise ValueError(f"Not a TrueType/OpenType font: {path}")
    if kind == "svg":
        try:
            root = ET.fromstring(data)
        except ET.ParseError as error:
            raise ValueError(f"Invalid SVG download: {path}") from error
        if not root.tag.endswith("svg"):
            raise ValueError(f"Not an SVG download: {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def source_entry(name, path):
    info = SOURCES[name]
    return {"repository": info["repository"], "commit": info["commit"], "path": path,
            "url": raw_url(name, path), "license": info["license"],
            "licenseUrl": info["license_url"], "licenseFile": info["license_file"]}


def main():
    tree_url = f"https://api.github.com/repos/KanjiVG/kanjivg/git/trees/{SOURCES['kanjivg']['commit']}?recursive=1"
    tree = json.loads(download(tree_url))
    if tree.get("truncated"):
        raise RuntimeError("KanjiVG source tree was truncated")
    available = {int(match.group(1), 16) for item in tree["tree"]
                 if (match := re.fullmatch(r"kanji/([0-9a-fA-F]{5})\.svg", item["path"]))}
    required = set(map(ord, HIRAGANA + KATAKANA))
    missing_required = sorted(required - available)
    if missing_required:
        raise RuntimeError("Pinned KanjiVG revision lacks required kana: " + ", ".join(f"U+{cp:04X}" for cp in missing_required))

    fonts = [
        ("klee", "fonts/ttf/KleeOne-Regular.ttf", OUT / "fonts" / "japanese.ttf"),
        ("noto", "hinted/ttf/NotoSans/NotoSans-Regular.ttf", OUT / "fonts" / "latin.ttf"),
    ]
    for source, source_path, output_path in fonts:
        checked_write(output_path, download(raw_url(source, source_path)), "font")

    kana_dir = OUT / "kana"
    kana_dir.mkdir(parents=True, exist_ok=True)
    selected = sorted(CODEPOINTS & available)
    svg_paths = {cp: f"kanji/{cp:05x}.svg" for cp in selected}
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        futures = {pool.submit(download, raw_url("kanjivg", path)): cp for cp, path in svg_paths.items()}
        for future in concurrent.futures.as_completed(futures):
            cp = futures[future]
            checked_write(kana_dir / f"{cp:05x}.svg", future.result(), "svg")
    for path in kana_dir.glob("[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F].svg"):
        if int(path.stem, 16) in CODEPOINTS and int(path.stem, 16) not in selected:
            path.unlink()

    licenses_dir = OUT / "licenses"
    notices = [
        ("kanjivg", "COPYING", "KanjiVG-COPYING.txt"),
        ("klee", "OFL.txt", "Klee-OFL.txt"),
        ("noto", "LICENSE", "NotoSans-OFL.txt"),
    ]
    for source, source_path, name in notices:
        checked_write(licenses_dir / name, download(raw_url(source, source_path)), "license")
    checked_write(licenses_dir / "Arphic-Public-License.txt", download(ARPHIC_LICENSE_URL), "license")

    available_chars = []
    for cp in selected:
        char = chr(cp)
        category = "hiragana" if 0x3040 <= cp <= 0x309F else "katakana"
        available_chars.append({"character": char, "codepoint": f"{cp:05x}",
                                "name": unicodedata.name(char, "unassigned"),
                                "category": category, "file": f"kana/{cp:05x}.svg",
                                "source": source_entry("kanjivg", svg_paths[cp])})
    missing_optional = sorted(CODEPOINTS - required - available)
    manifest = {
        "sources": {name: {"repository": info["repository"], "commit": info["commit"],
                            "license": info["license"], "licenseUrl": info["license_url"],
                            "licenseFile": info["license_file"]}
                    for name, info in SOURCES.items()},
        "fonts": {
            "japanese": {"file": "fonts/japanese.ttf", "family": "Klee One",
                         "source": source_entry("klee", fonts[0][1])},
            "latin": {"file": "fonts/latin.ttf", "family": "Noto Sans",
                      "source": source_entry("noto", fonts[1][1])},
        },
        "requiredCharacters": {"hiragana": list(HIRAGANA), "katakana": list(KATAKANA)},
        "characters": available_chars,
        "missingRequiredCharacters": [],
        "unavailableOptionalCharacters": [
            {"character": chr(cp), "codepoint": f"{cp:05x}",
             "name": unicodedata.name(chr(cp), "unassigned")}
            for cp in missing_optional
        ],
        "licenseFiles": [name for _, _, name in notices] + ["Arphic-Public-License.txt"],
        "additionalLicenses": [{"name": "Arphic Public License",
                                "url": ARPHIC_LICENSE_URL,
                                "file": "licenses/Arphic-Public-License.txt"}],
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Built {len(fonts)} fonts, {len(selected)} kana SVGs; required kana missing: 0; optional unavailable: {len(missing_optional)}")


if __name__ == "__main__":
    main()
