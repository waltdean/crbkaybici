#!/usr/bin/env python3
"""Генерирует QR-код ссылки на реестр лицензий в виде SVG.

Готовых библиотек в окружении нет, а подключать сторонний онлайн-сервис
для картинки на сайте больницы не стоит: он может исчезнуть или начать
собирать данные посетителей. Поэтому код генерируется здесь и лежит
в репозитории обычным файлом.

Реализована версия 4 с уровнем коррекции M (33×33 модуля, до 62 байт
данных) — этого хватает для ссылки на реестр.

Запуск из корня репозитория:

    python3 tools/build-qr.py
"""

import pathlib

VERSION = 4
SIZE = 33
DATA_CODEWORDS = 64          # всего кодовых слов данных для версии 4-M
BLOCKS = 2                   # два блока по 32 слова
EC_PER_BLOCK = 18
ALIGN_CENTERS = (6, 26)
REMAINDER_BITS = 7

URL = 'https://roszdravnadzor.gov.ru/services/licenses'
OUT = pathlib.Path(__file__).resolve().parent.parent / 'data' / 'qr-license.svg'

# --- арифметика в поле Галуа GF(256) ---
EXP = [0] * 512
LOG = [0] * 256
_x = 1
for _i in range(255):
    EXP[_i] = _x
    LOG[_x] = _i
    _x <<= 1
    if _x & 0x100:
        _x ^= 0x11D
for _i in range(255, 512):
    EXP[_i] = EXP[_i - 255]


def gf_mul(a, b):
    return 0 if a == 0 or b == 0 else EXP[LOG[a] + LOG[b]]


def rs_generator(n):
    """Порождающий многочлен (x-a^0)(x-a^1)...(x-a^(n-1)).
    Коэффициенты возвращаются от старшей степени к младшей —
    в таком порядке их ждёт деление в rs_ec."""
    g = [1]
    for i in range(n):
        g = [0] + g
        for j in range(len(g) - 1):
            g[j] ^= gf_mul(g[j + 1], EXP[i])
    return g[::-1]


def rs_ec(block, n):
    gen = rs_generator(n)
    rem = list(block) + [0] * n
    for i in range(len(block)):
        factor = rem[i]
        if factor:
            for j, g in enumerate(gen):
                rem[i + j] ^= gf_mul(g, factor)
    return rem[len(block):]


def encode(data):
    """Байтовый режим -> поток кодовых слов с коррекцией ошибок."""
    payload = data.encode('utf-8')
    if len(payload) > 62:
        raise ValueError(f'слишком длинные данные: {len(payload)} байт при лимите 62')

    bits = '0100' + format(len(payload), '08b')
    bits += ''.join(format(b, '08b') for b in payload)
    bits += '0' * min(4, DATA_CODEWORDS * 8 - len(bits))
    bits += '0' * (-len(bits) % 8)

    words = [int(bits[i:i + 8], 2) for i in range(0, len(bits), 8)]
    for pad in (0xEC, 0x11):
        while len(words) < DATA_CODEWORDS:
            words.append(pad)
            pad = 0x11 if pad == 0xEC else 0xEC
    words = words[:DATA_CODEWORDS]

    per = DATA_CODEWORDS // BLOCKS
    blocks = [words[i * per:(i + 1) * per] for i in range(BLOCKS)]
    ecs = [rs_ec(b, EC_PER_BLOCK) for b in blocks]

    out = []
    for i in range(per):
        out.extend(b[i] for b in blocks)
    for i in range(EC_PER_BLOCK):
        out.extend(e[i] for e in ecs)
    return out


def base_matrix():
    """Матрица со служебными узорами; None — свободные модули."""
    m = [[None] * SIZE for _ in range(SIZE)]

    def finder(row, col):
        for r in range(-1, 8):
            for c in range(-1, 8):
                rr, cc = row + r, col + c
                if not (0 <= rr < SIZE and 0 <= cc < SIZE):
                    continue
                dark = (0 <= r <= 6 and c in (0, 6)) or (0 <= c <= 6 and r in (0, 6)) \
                    or (2 <= r <= 4 and 2 <= c <= 4)
                m[rr][cc] = 1 if dark else 0

    finder(0, 0)
    finder(0, SIZE - 7)
    finder(SIZE - 7, 0)

    for i in range(SIZE):
        if m[6][i] is None:
            m[6][i] = 1 if i % 2 == 0 else 0
        if m[i][6] is None:
            m[i][6] = 1 if i % 2 == 0 else 0

    for r in ALIGN_CENTERS:
        for c in ALIGN_CENTERS:
            if m[r][c] is not None:
                continue
            for dr in range(-2, 3):
                for dc in range(-2, 3):
                    m[r + dr][c + dc] = 1 if max(abs(dr), abs(dc)) != 1 else 0

    m[4 * VERSION + 9][8] = 1          # обязательный тёмный модуль

    for i in range(9):                 # места под информацию о формате
        if m[8][i] is None:
            m[8][i] = 0
        if m[i][8] is None:
            m[i][8] = 0
    for i in range(8):
        if m[8][SIZE - 1 - i] is None:
            m[8][SIZE - 1 - i] = 0
        if m[SIZE - 1 - i][8] is None:
            m[SIZE - 1 - i][8] = 0
    return m


def place(matrix, words):
    reserved = [[cell is not None for cell in row] for row in matrix]
    bits = ''.join(format(w, '08b') for w in words) + '0' * REMAINDER_BITS
    idx = 0
    col = SIZE - 1
    upward = True
    while col > 0:
        if col == 6:
            col -= 1
        rows = range(SIZE - 1, -1, -1) if upward else range(SIZE)
        for row in rows:
            for c in (col, col - 1):
                if reserved[row][c]:
                    continue
                matrix[row][c] = int(bits[idx]) if idx < len(bits) else 0
                idx += 1
        upward = not upward
        col -= 2
    return reserved


MASKS = [
    lambda r, c: (r + c) % 2 == 0,
    lambda r, c: r % 2 == 0,
    lambda r, c: c % 3 == 0,
    lambda r, c: (r + c) % 3 == 0,
    lambda r, c: (r // 2 + c // 3) % 2 == 0,
    lambda r, c: (r * c) % 2 + (r * c) % 3 == 0,
    lambda r, c: ((r * c) % 2 + (r * c) % 3) % 2 == 0,
    lambda r, c: ((r + c) % 2 + (r * c) % 3) % 2 == 0,
]


def penalty(m):
    score = 0
    for line in list(m) + [list(col) for col in zip(*m)]:
        run, prev = 1, line[0]
        for cell in line[1:]:
            if cell == prev:
                run += 1
            else:
                if run >= 5:
                    score += run - 2
                run, prev = 1, cell
        if run >= 5:
            score += run - 2

    for r in range(SIZE - 1):
        for c in range(SIZE - 1):
            if m[r][c] == m[r][c + 1] == m[r + 1][c] == m[r + 1][c + 1]:
                score += 3

    pattern = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0]
    for line in list(m) + [list(col) for col in zip(*m)]:
        for i in range(SIZE - 10):
            if line[i:i + 11] == pattern or line[i:i + 11] == pattern[::-1]:
                score += 40

    dark = sum(sum(row) for row in m)
    score += 10 * (abs(dark * 100 // (SIZE * SIZE) - 50) // 5)
    return score


def format_bits(mask):
    value = (0b00 << 3) | mask          # уровень коррекции M = 00
    rem = value << 10
    while rem.bit_length() > 10:
        rem ^= 0x537 << (rem.bit_length() - 11)
    return ((value << 10) | rem) ^ 0x5412


def apply_format(m, mask):
    """Информация о формате записывается дважды: вокруг левого верхнего
    поискового узора и вдоль двух других. Младшие биты идут сверху вниз
    по столбцу 8, старшие — справа налево по строке 8."""
    bits = format_bits(mask)

    def bit(i):
        return (bits >> i) & 1

    for i in range(6):                  # первая копия
        m[i][8] = bit(i)
    m[7][8] = bit(6)
    m[8][8] = bit(7)
    m[8][7] = bit(8)
    for i in range(9, 15):
        m[8][14 - i] = bit(i)

    for i in range(8):                  # вторая копия
        m[8][SIZE - 1 - i] = bit(i)
    for i in range(8, 15):
        m[SIZE - 15 + i][8] = bit(i)


def build(data):
    words = encode(data)
    best = None
    for mask in range(8):
        m = base_matrix()
        reserved = place(m, words)
        for r in range(SIZE):
            for c in range(SIZE):
                if not reserved[r][c] and MASKS[mask](r, c):
                    m[r][c] ^= 1
        apply_format(m, mask)
        score = penalty(m)
        if best is None or score < best[0]:
            best = (score, m, mask)
    return best[1], best[2]


def to_svg(m, quiet=4):
    total = SIZE + quiet * 2
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {total} {total}" '
        f'width="180" height="180" shape-rendering="crispEdges" role="img" '
        f'aria-label="QR-код со ссылкой на единый реестр лицензий">',
        f'<rect width="{total}" height="{total}" fill="#ffffff"/>',
    ]
    for r in range(SIZE):
        for c in range(SIZE):
            if m[r][c]:
                parts.append(f'<rect x="{c + quiet}" y="{r + quiet}" width="1" height="1" fill="#000000"/>')
    parts.append('</svg>')
    return '\n'.join(parts)


def main():
    matrix, mask = build(URL)
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(to_svg(matrix) + '\n', encoding='utf-8')
    print(f'{OUT.name}: версия {VERSION}-M, маска {mask}, {SIZE}×{SIZE} модулей')
    print(f'закодировано: {URL}')


if __name__ == '__main__':
    main()
