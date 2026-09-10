// Интерактивность сайта.
// Шапка и подвал вшиты в HTML (собираются через tools/build-layout.py),
// поэтому скрипту остаётся меню и версия для слабовидящих.

document.addEventListener('DOMContentLoaded', function() {
    initDropdowns();
    initAccessibility();
    initHeaderOffset();
});

// Шапка зафиксирована сверху, а её высота зависит от ширины экрана и
// выбранного размера шрифта. Отступ подбираем по фактической высоте,
// иначе начало страницы уезжает под шапку.
function updateHeaderOffset() {
    const header = document.querySelector('.header');
    if (!header) return;

    if (getComputedStyle(header).position === 'fixed') {
        document.body.style.paddingTop = header.offsetHeight + 'px';
    } else {
        // В версии для слабовидящих шапка обычная, отступ не нужен
        document.body.style.paddingTop = '';
    }
}

function initHeaderOffset() {
    const header = document.querySelector('.header');
    if (!header) return;

    updateHeaderOffset();
    window.addEventListener('resize', updateHeaderOffset);

    if ('ResizeObserver' in window) {
        new ResizeObserver(updateHeaderOffset).observe(header);
    }
}

function initDropdowns() {
    const dropdowns = Array.from(document.querySelectorAll('.nav .dropdown'));

    dropdowns.forEach(function(drop) {
        const link = drop.querySelector('a');

        if (link) {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const isOpen = drop.classList.contains('open');
                dropdowns.forEach(d => d.classList.remove('open'));
                if (!isOpen) {
                    drop.classList.add('open');
                }
            });
        }
    });

    // Клик вне меню закрывает раскрытый пункт
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.dropdown')) {
            dropdowns.forEach(d => d.classList.remove('open'));
        }
    });
}

// Версия для слабовидящих: размер шрифта, цветовая схема и показ изображений.
// Настройки хранятся в localStorage, поэтому действуют на всех страницах.
function initAccessibility() {
    const STORAGE_KEY = 'a11y-settings';
    const DEFAULTS = { on: false, font: 'normal', theme: 'white', images: 'on' };

    const toggle = document.querySelector('.a11y-toggle');
    const panel = document.getElementById('a11y-panel');

    if (!toggle || !panel) return;

    let settings = read();
    apply();

    toggle.addEventListener('click', function() {
        settings.on = !settings.on;
        save();
        apply();
    });

    panel.querySelectorAll('[data-a11y-set]').forEach(function(button) {
        button.addEventListener('click', function() {
            settings[button.dataset.a11ySet] = button.dataset.a11yValue;
            save();
            apply();
        });
    });

    const off = panel.querySelector('.a11y-off');
    if (off) {
        off.addEventListener('click', function() {
            settings = Object.assign({}, DEFAULTS);
            save();
            apply();
        });
    }

    function read() {
        try {
            return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(STORAGE_KEY)));
        } catch (e) {
            return Object.assign({}, DEFAULTS);
        }
    }

    function save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        } catch (e) {
            // Приватный режим браузера — настройки просто не переживут перезагрузку
        }
    }

    function apply() {
        const root = document.documentElement;

        if (settings.on) {
            root.setAttribute('data-a11y', 'on');
            root.setAttribute('data-a11y-font', settings.font);
            root.setAttribute('data-a11y-theme', settings.theme);
            root.setAttribute('data-a11y-images', settings.images);
        } else {
            root.removeAttribute('data-a11y');
            root.removeAttribute('data-a11y-font');
            root.removeAttribute('data-a11y-theme');
            root.removeAttribute('data-a11y-images');
        }

        panel.hidden = !settings.on;
        toggle.setAttribute('aria-expanded', String(settings.on));
        toggle.textContent = settings.on ? 'Обычная версия' : 'Версия для слабовидящих';

        panel.querySelectorAll('[data-a11y-set]').forEach(function(button) {
            const active = settings[button.dataset.a11ySet] === button.dataset.a11yValue;
            button.setAttribute('aria-pressed', String(active));
        });

        updateHeaderOffset();
    }
}
