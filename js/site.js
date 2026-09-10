// Интерактивность сайта.
// Шапка и подвал вшиты в HTML (собираются через tools/build-layout.py),
// поэтому скрипту остаётся только раскрывать выпадающие пункты меню.

document.addEventListener('DOMContentLoaded', function() {
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
});
