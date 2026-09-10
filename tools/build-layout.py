#!/usr/bin/env python3
"""Встраивает шапку и подвал из components/ во все страницы сайта.

Раньше шапка и подвал подгружались из JavaScript, поэтому поисковые роботы
и системы проверки сайта, которые не выполняют JS, не видели ни меню, ни
ссылок на внутренние страницы. Теперь разметка вшита прямо в HTML, а этот
скрипт — единственный способ её обновлять.

Как пользоваться: правим components/header.html или components/footer.html,
затем из корня репозитория выполняем

    python3 tools/build-layout.py

Скрипт сам обновит блоки между маркерами во всех страницах.
Ссылки в компонентах пишем с плейсхолдером {BASE_PATH} — он заменяется
на «/», то есть все пути получаются абсолютными от корня сайта.
"""

import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

MARKERS = {
    'header': ('<!-- header:start -->', '<!-- header:end -->'),
    'footer': ('<!-- footer:start -->', '<!-- footer:end -->'),
}

NOTE = '<!-- Не редактировать вручную: собирается из components/{name}.html через tools/build-layout.py -->'


def component(name):
    html = (ROOT / 'components' / f'{name}.html').read_text(encoding='utf-8').strip()
    return html.replace('{BASE_PATH}', '/')


def block(name, indent='    '):
    start, end = MARKERS[name]
    body = component(name)
    lines = [start, NOTE.format(name=name)] + body.splitlines() + [end]
    return '\n'.join(indent + line if line else line for line in lines).strip()


def pages():
    for path in sorted(ROOT.rglob('*.html')):
        rel = path.relative_to(ROOT)
        if rel.parts[0] in {'.git', 'components', 'tools'}:
            continue
        yield path


def main():
    header, footer = block('header'), block('footer')
    changed = []

    for path in pages():
        text = original = path.read_text(encoding='utf-8')

        for name, html in (('header', header), ('footer', footer)):
            start, end = MARKERS[name]
            pattern = re.compile(
                re.escape(start) + '.*?' + re.escape(end), re.DOTALL)
            if pattern.search(text):
                text = pattern.sub(lambda _m, h=html: h, text, count=1)
            else:
                placeholder = f'<div id="{name}-placeholder"></div>'
                if placeholder not in text:
                    print(f'!! {path.relative_to(ROOT)}: не найден ни маркер, '
                          f'ни {placeholder}', file=sys.stderr)
                    return 1
                text = text.replace(placeholder, html, 1)

        if text != original:
            path.write_text(text, encoding='utf-8')
            changed.append(path.relative_to(ROOT))

    for rel in changed:
        print(f'обновлено: {rel}')
    print(f'\nстраниц изменено: {len(changed)}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
