// Поиск по сайту. Сайт статический, поэтому ищем на стороне браузера
// по индексу search-index.json (собирается tools/build-search-index.py).

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('search-form');
    const input = document.getElementById('search-input');
    const status = document.getElementById('search-status');
    const results = document.getElementById('search-results');

    if (!form || !input || !status || !results) return;

    let index = null;

    // Запрос может прийти из строки поиска в шапке: /search.html?q=...
    const query = new URLSearchParams(window.location.search).get('q') || '';
    if (query) {
        input.value = query;
        run(query);
    }

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        const value = input.value.trim();
        const url = value ? '?q=' + encodeURIComponent(value) : location.pathname;
        history.replaceState(null, '', url);
        run(value);
    });

    async function load() {
        if (index) return index;
        const response = await fetch('/search-index.json');
        if (!response.ok) throw new Error('HTTP ' + response.status);
        index = await response.json();
        return index;
    }

    async function run(value) {
        const words = value.toLowerCase().split(/\s+/).filter(Boolean);

        if (!words.length) {
            status.textContent = 'Введите запрос — поиск идёт по всем страницам сайта.';
            results.innerHTML = '';
            return;
        }

        status.textContent = 'Идёт поиск…';
        results.innerHTML = '';

        let pages;
        try {
            pages = await load();
        } catch (e) {
            status.textContent = 'Не удалось загрузить поисковый индекс. ' +
                'Воспользуйтесь картой сайта.';
            return;
        }

        const found = pages
            .map(page => score(page, words))
            .filter(item => item.hits === words.length)
            .sort((a, b) => b.weight - a.weight);

        if (!found.length) {
            status.textContent = 'По запросу «' + value + '» ничего не найдено.';
            return;
        }

        status.textContent = 'Найдено страниц: ' + found.length + '.';
        results.innerHTML = found.map(item => card(item, words)).join('');
    }

    // Совпадение в заголовке весит больше, чем в тексте страницы
    function score(page, words) {
        const title = page.title.toLowerCase();
        const headings = page.headings.join(' ').toLowerCase();
        const text = page.text.toLowerCase();
        let hits = 0;
        let weight = 0;

        words.forEach(function(word) {
            let matched = false;
            if (title.includes(word)) { weight += 10; matched = true; }
            if (headings.includes(word)) { weight += 5; matched = true; }
            if (text.includes(word)) { weight += 1; matched = true; }
            if (matched) hits += 1;
        });

        return { page, hits, weight };
    }

    function card(item, words) {
        const page = item.page;
        return '<article class="search-result">' +
            '<h3><a href="' + escape(page.url) + '">' + escape(page.title) + '</a></h3>' +
            '<p>' + snippet(page.text, words) + '</p>' +
            '</article>';
    }

    // Кусок текста вокруг первого совпадения, найденное слово подсвечиваем
    function snippet(text, words) {
        const lower = text.toLowerCase();
        let at = -1;
        for (const word of words) {
            const found = lower.indexOf(word);
            if (found !== -1 && (at === -1 || found < at)) at = found;
        }
        if (at === -1) at = 0;

        const from = Math.max(0, at - 90);
        const piece = text.slice(from, from + 260);
        let out = escape((from > 0 ? '…' : '') + piece + (from + 260 < text.length ? '…' : ''));

        words.forEach(function(word) {
            const pattern = new RegExp('(' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
            out = out.replace(pattern, '<mark>$1</mark>');
        });

        return out;
    }

    function escape(value) {
        const div = document.createElement('div');
        div.textContent = value;
        return div.innerHTML;
    }
});
