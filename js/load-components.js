// Функция для определения базового пути в зависимости от текущей страницы
function getBasePath() {
    // Используем location.pathname или location.href
    let path = window.location.pathname;
    
    // Если pathname пустой (file:// протокол), используем href
    if (!path || path === '/') {
        try {
            const url = new URL(window.location.href);
            path = url.pathname;
        } catch (e) {
            // Если не удалось создать URL, используем путь из href напрямую
            const href = window.location.href;
            const match = href.match(/\/[^\/]+\.html/);
            if (match) {
                path = match[0];
            }
        }
    }
    
    // Убираем начальный и конечный слэш
    let cleanPath = path.replace(/^\/|\/$/g, '');
    
    // Если путь пустой или это index.html в корне
    if (!cleanPath || cleanPath === 'index.html' || cleanPath === '' || cleanPath.endsWith('/index.html')) {
        return '';
    }
    
    // Разбиваем путь на части
    const parts = cleanPath.split('/').filter(p => p && p !== 'index.html');
    
    // Если последняя часть - это HTML файл, убираем её
    if (parts.length > 0 && parts[parts.length - 1].endsWith('.html')) {
        parts.pop();
    }
    
    // Количество уровней вложенности = количество папок
    const depth = parts.length;
    
    // Если страница в подпапке, возвращаем '../' * depth
    const basePath = depth > 0 ? '../'.repeat(depth) : '';
    
    console.log('Path calculation:', {
        originalPath: path,
        cleanPath: cleanPath,
        parts: parts,
        depth: depth,
        basePath: basePath
    });
    
    return basePath;
}

// Глобальная переменная для базового пути
let globalBasePath = null;

// Функция для загрузки компонента
async function loadComponent(componentPath, targetSelector, customBasePath = null) {
    try {
        let basePath = customBasePath || globalBasePath || getBasePath();
        
        // Если базовый путь не определен, пробуем определить из скрипта
        if (!basePath) {
            basePath = getBasePathFromScript();
        }
        
        const fullPath = basePath + componentPath;
        console.log('Loading component from:', fullPath);
        console.log('Base path used:', basePath);
        console.log('Protocol:', window.location.protocol);
        
        // Проверяем протокол - если file://, fetch не будет работать
        if (window.location.protocol === 'file:') {
            console.warn('File protocol detected. Using XHR instead of fetch.');
            // Пытаемся использовать XMLHttpRequest как fallback
            return await loadComponentXHR(componentPath, targetSelector, basePath);
        }
        
        const response = await fetch(fullPath);
        if (!response.ok) {
            // Если получили 404, пробуем альтернативные пути
            if (response.status === 404) {
                console.warn('404 error, trying alternative paths...');
                // Пробуем без базового пути
                if (basePath) {
                    console.log('Trying without base path:', componentPath);
                    const altResponse = await fetch(componentPath);
                    if (altResponse.ok) {
                        let html = await altResponse.text();
                        html = html.replace(/{BASE_PATH}/g, '');
                        const target = document.querySelector(targetSelector);
                        if (target) {
                            target.innerHTML = html;
                            console.log('Component loaded from alternative path');
                            if (componentPath.includes('header')) {
                                setTimeout(() => initDropdowns(), 100);
                            }
                            return;
                        }
                    }
                }
            }
            throw new Error(`Failed to load ${componentPath}: ${response.status} ${response.statusText}`);
        }
        let html = await response.text();
        
        if (!html || html.trim() === '') {
            throw new Error('Empty response from server');
        }
        
        // Заменяем {BASE_PATH} на правильный путь
        html = html.replace(/{BASE_PATH}/g, basePath);
        
        // Вставляем HTML в целевой элемент
        const target = document.querySelector(targetSelector);
        if (target) {
            target.innerHTML = html;
            console.log('Component loaded successfully:', componentPath);
            
            // После загрузки header, инициализируем dropdown меню
            if (componentPath.includes('header')) {
                // Небольшая задержка для гарантии, что DOM обновлен
                setTimeout(() => {
                    initDropdowns();
                }, 100);
            }
            
            // После загрузки footer, проверяем hash и прокручиваем к контактам
            if (componentPath.includes('footer')) {
                setTimeout(() => {
                    scrollToContactsIfNeeded();
                }, 100);
            }
        } else {
            console.error('Target element not found:', targetSelector);
            throw new Error('Target element not found: ' + targetSelector);
        }
    } catch (error) {
        console.error(`Error loading component ${componentPath}:`, error);
        // Пытаемся использовать XMLHttpRequest как fallback
        try {
            await loadComponentXHR(componentPath, targetSelector, customBasePath);
        } catch (xhrError) {
            console.error('Both fetch and XHR failed:', xhrError);
            // Показываем ошибку пользователю
            const target = document.querySelector(targetSelector);
            if (target) {
                target.innerHTML = `<div style="padding: 20px; background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; border-radius: 4px;">
                    <strong>Ошибка загрузки компонента:</strong> ${error.message}<br>
                    <small>Проверьте консоль браузера для подробностей</small>
                </div>`;
            }
        }
    }
}

// Альтернативный способ загрузки через XMLHttpRequest
function loadComponentXHR(componentPath, targetSelector, customBasePath = null) {
    return new Promise((resolve, reject) => {
        const basePath = customBasePath || globalBasePath || getBasePath();
        const fullPath = basePath + componentPath;
        console.log('Trying XHR for:', fullPath);
        console.log('Full URL would be:', window.location.origin + '/' + fullPath);
        
        const xhr = new XMLHttpRequest();
        xhr.open('GET', fullPath, true);
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                console.log('XHR status:', xhr.status, 'for', fullPath);
                if (xhr.status === 200 || xhr.status === 0) { // 0 для file://
                    let html = xhr.responseText;
                    if (!html || html.trim() === '') {
                        console.error('Empty response for:', fullPath);
                        reject(new Error('Empty response'));
                        return;
                    }
                    // Заменяем {BASE_PATH} на правильный путь
                    html = html.replace(/{BASE_PATH}/g, basePath);
                    
                    const target = document.querySelector(targetSelector);
                    if (target) {
                        target.innerHTML = html;
                        console.log('Component loaded successfully via XHR:', componentPath);
                        
                        if (componentPath.includes('header')) {
                            setTimeout(() => {
                                initDropdowns();
                            }, 100);
                        }
                        
                        if (componentPath.includes('footer')) {
                            setTimeout(() => {
                                scrollToContactsIfNeeded();
                            }, 100);
                        }
                        resolve();
                    } else {
                        console.error('Target element not found:', targetSelector);
                        reject(new Error('Target element not found'));
                    }
                } else {
                    const error = new Error(`Failed to load ${componentPath}: ${xhr.status}`);
                    console.error('XHR error:', error);
                    console.error('Tried to load from:', fullPath);
                    reject(error);
                }
            }
        };
        xhr.onerror = function() {
            const error = new Error(`Network error loading ${componentPath}`);
            console.error('XHR network error:', error);
            console.error('Tried to load from:', fullPath);
            reject(error);
        };
        xhr.send();
    });
}

// Прокрутка к контактам, если в URL есть hash #contacts
function scrollToContactsIfNeeded() {
    if (window.location.hash === '#contacts') {
        const contactsElement = document.getElementById('contacts');
        if (contactsElement) {
            setTimeout(() => {
                contactsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 200);
        }
    }
}

// Обработчик для ссылок с якорями на главной странице
function initAnchorLinks() {
    // Находим все ссылки с якорями
    const anchorLinks = document.querySelectorAll('a[href*="#contacts"]');
    anchorLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            // Если ссылка ведет на index.html#contacts или просто #contacts
            if (href.includes('#contacts')) {
                // Если мы уже на главной странице
                const isMainPage = window.location.pathname.endsWith('index.html') || 
                                  window.location.pathname === '/' || 
                                  window.location.pathname.endsWith('/');
                
                if (isMainPage) {
                    e.preventDefault();
                    // Устанавливаем hash
                    window.location.hash = '#contacts';
                    // Ждем загрузки футера и прокручиваем
                    setTimeout(() => {
                        scrollToContactsIfNeeded();
                    }, 300);
                }
            }
        });
    });
}

// Инициализация dropdown меню
function initDropdowns() {
    const dropdowns = Array.from(document.querySelectorAll('.nav .dropdown'));
    dropdowns.forEach(drop => {
        const link = drop.querySelector('a');
        if (link) {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const isOpen = drop.classList.contains('open');
                dropdowns.forEach(d => d.classList.remove('open'));
                if (!isOpen) drop.classList.add('open');
            });
        }
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.dropdown')) {
            dropdowns.forEach(d => d.classList.remove('open'));
        }
    });
    
    // Инициализируем обработчики для якорных ссылок
    initAnchorLinks();
}

// Альтернативный способ определения пути на основе расположения скрипта
function getBasePathFromScript() {
    // Находим все скрипты с load-components.js
    const scripts = document.querySelectorAll('script[src*="load-components.js"]');
    if (scripts.length > 0) {
        const scriptSrc = scripts[0].getAttribute('src');
        console.log('Script src:', scriptSrc);
        
        // Если скрипт в подпапке (например, ../js/load-components.js), значит страница в подпапке
        if (scriptSrc.startsWith('../')) {
            // Извлекаем все '../' в начале строки
            // Например: ../js/load-components.js -> базовый путь ../
            // Структура: news/news.html использует ../js/load-components.js
            // Значит мы в news/, и чтобы попасть в корень (где components/), нужен путь ../
            const match = scriptSrc.match(/^(\.\.\/)+/);
            if (match && match[0]) {
                const result = match[0];
                console.log('Base path from script (from ../):', result);
                return result;
            }
        } else if (scriptSrc === 'js/load-components.js' || scriptSrc.startsWith('js/')) {
            // Скрипт в корне (js/load-components.js), значит страница в корне
            // components/ тоже в корне, поэтому базовый путь пустой
            console.log('Script in root, base path is empty');
            return '';
        }
    }
    console.log('Could not determine base path from script');
    return '';
}

// Загрузка компонентов при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, starting component loading...');
    console.log('Current pathname:', window.location.pathname);
    console.log('Current href:', window.location.href);
    console.log('Protocol:', window.location.protocol);
    
    // Пробуем определить путь двумя способами
    // Приоритет отдаем функции на основе скрипта, так как она более надежна
    const basePath1 = getBasePath();
    const basePath2 = getBasePathFromScript();
    // Используем путь из скрипта, если он есть, иначе из URL
    const basePath = basePath2 || basePath1;
    
    // Сохраняем в глобальную переменную
    globalBasePath = basePath;
    
    console.log('Base path (from URL):', basePath1);
    console.log('Base path (from script):', basePath2);
    console.log('Using base path:', basePath);
    console.log('Full path to header would be:', basePath + 'components/header.html');
    console.log('Full path to footer would be:', basePath + 'components/footer.html');
    
    // Загружаем header, если есть элемент с id="header-placeholder"
    const headerPlaceholder = document.getElementById('header-placeholder');
    if (headerPlaceholder) {
        console.log('Header placeholder found, loading header...');
        loadComponent('components/header.html', '#header-placeholder', basePath);
    } else {
        console.warn('Header placeholder not found!');
    }
    
    // Загружаем footer, если есть элемент с id="footer-placeholder"
    const footerPlaceholder = document.getElementById('footer-placeholder');
    if (footerPlaceholder) {
        console.log('Footer placeholder found, loading footer...');
        loadComponent('components/footer.html', '#footer-placeholder', basePath);
    } else {
        console.warn('Footer placeholder not found!');
    }
    
    // Проверяем hash при загрузке страницы и прокручиваем к контактам
    if (window.location.hash === '#contacts') {
        // Небольшая задержка для загрузки компонентов
        setTimeout(() => {
            scrollToContactsIfNeeded();
        }, 1000);
    }
});

