#!/usr/bin/env python3
"""Собирает sitemap.xml по страницам и документам сайта.

Запуск из корня репозитория:

    python3 tools/build-sitemap.py

Страницы-заглушки перечислены в SKIP: их не нужно отдавать ни поисковикам,
ни проверяющим системам, пока в них нет содержания.
"""

import datetime
import pathlib
import subprocess
import urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = 'https://crbkaybitsy.ru'

SKIP = {
    'services/services.html',        # «Раздел в разработке»
    'services/paid-services.html',   # «Раздел в разработке»
}

DOC_SUFFIXES = {'.pdf', '.doc', '.docx', '.xls', '.xlsx'}

# Главная важнее внутренних страниц, документы — наименее приоритетны
PRIORITY = {'index.html': '1.0'}


def git_date(path):
    """Дата последнего изменения файла по git, иначе — с диска."""
    try:
        out = subprocess.run(
            ['git', 'log', '-1', '--format=%cs', '--', str(path)],
            cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()
        if out:
            return out
    except subprocess.CalledProcessError:
        pass
    return datetime.date.fromtimestamp(path.stat().st_mtime).isoformat()


def collect():
    for path in sorted(ROOT.rglob('*')):
        if not path.is_file():
            continue
        rel = path.relative_to(ROOT).as_posix()
        if rel.startswith(('.git/', 'components/', 'tools/')) or rel in SKIP:
            continue
        if path.suffix == '.html' or path.suffix.lower() in DOC_SUFFIXES:
            yield rel, path


def main():
    entries = []
    for rel, path in collect():
        loc = SITE + '/' + urllib.parse.quote(rel)
        priority = PRIORITY.get(rel, '0.8' if path.suffix == '.html' else '0.5')
        entries.append(
            '    <url>\n'
            f'        <loc>{loc}</loc>\n'
            f'        <lastmod>{git_date(path)}</lastmod>\n'
            f'        <priority>{priority}</priority>\n'
            '    </url>')

    xml = ('<?xml version="1.0" encoding="UTF-8"?>\n'
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
           + '\n'.join(entries) + '\n</urlset>\n')
    (ROOT / 'sitemap.xml').write_text(xml, encoding='utf-8')

    pages = sum(1 for rel, p in collect() if p.suffix == '.html')
    print(f'sitemap.xml: {len(entries)} адресов '
          f'({pages} страниц, {len(entries) - pages} документов)')


if __name__ == '__main__':
    main()
