#!/usr/bin/env python3
"""Собирает search-index.json для поиска по сайту.

Сайт статический, серверного поиска нет, поэтому страница /search.html
скачивает этот файл и ищет по нему прямо в браузере.

Запуск из корня репозитория после правки страниц:

    python3 tools/build-search-index.py
"""

import html
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent

SKIP = {
    'search.html',
    'sitemap.html',
    'services/services.html',        # «Раздел в разработке»
    'services/paid-services.html',   # «Раздел в разработке»
}

MAX_TEXT = 25000  # символов текста со страницы: хватает, чтобы проиндексировать даже прейскурант целиком


def strip_layout(markup):
    """Убирает шапку, подвал и панель настроек: они одинаковы на всех
    страницах и иначе засоряли бы выдачу совпадениями из меню."""
    markup = re.sub(r'<!-- header:start -->.*?<!-- header:end -->', ' ',
                    markup, flags=re.DOTALL)
    markup = re.sub(r'<!-- footer:start -->.*?<!-- footer:end -->', ' ',
                    markup, flags=re.DOTALL)
    return markup


def text_of(markup):
    markup = re.sub(r'<(script|style)\b.*?</\1>', ' ', markup,
                    flags=re.DOTALL | re.IGNORECASE)
    markup = re.sub(r'<[^>]+>', ' ', markup)
    return re.sub(r'\s+', ' ', html.unescape(markup)).strip()


def main():
    pages = []

    for path in sorted(ROOT.rglob('*.html')):
        rel = path.relative_to(ROOT).as_posix()
        if rel.startswith(('.git/', 'components/', 'tools/')) or rel in SKIP:
            continue

        markup = path.read_text(encoding='utf-8')
        body = strip_layout(markup)

        title = re.search(r'<title>(.*?)</title>', markup, re.DOTALL)
        title = html.unescape(title.group(1)).strip() if title else rel
        title = title.split('—')[0].strip() or title

        headings = [text_of(m) for m in
                    re.findall(r'<h[1-4][^>]*>(.*?)</h[1-4]>', body, re.DOTALL)]

        pages.append({
            'url': '/' + rel,
            'title': title,
            'headings': [h for h in headings if h][:40],
            'text': text_of(body)[:MAX_TEXT],
        })

    out = ROOT / 'search-index.json'
    out.write_text(json.dumps(pages, ensure_ascii=False), encoding='utf-8')
    print(f'search-index.json: {len(pages)} страниц, '
          f'{out.stat().st_size // 1024} КБ')


if __name__ == '__main__':
    main()
