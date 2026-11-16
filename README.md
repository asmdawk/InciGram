# ZigZak Player — сайт

Русский сайт ZigZak Player с интерактивной 3D-сценой, тремя цветовыми темами, оригинальной демомелодией и прямой ссылкой на переносимую Windows-сборку.

- Сайт рассчитан на адрес: https://asmdawk.github.io/InciGram/
- Готовый плеер и исходники: https://github.com/asmdawk/mpo/releases/tag/zigzak-v1.0.0

## Сборка

Нужен Node.js 22 и npm.

```sh
npm ci
npm run check
npm run build
```

Статические файлы появятся в `dist/`. Vite использует относительный `base: './'`, поэтому ресурсы работают в подпапке `/InciGram/`. Изображения, шрифт и музыка входят в проект; сторонние CDN для них не нужны.

## Публикация на GitHub Pages

Workflow [pages.yml](.github/workflows/pages.yml) запускается при изменении `main` или вручную через GitHub Actions. Он устанавливает зависимости, проверяет JavaScript, собирает сайт и передаёт `dist/` официальному механизму GitHub Pages.

Для первой публикации администратор репозитория должен выбрать **Settings → Pages → Build and deployment → Source → GitHub Actions**:

https://github.com/asmdawk/InciGram/settings/pages

После включения Pages для публикаций достаточно штатного `GITHUB_TOKEN`; отдельные ключи в репозиторий добавлять не нужно. Workflow запрашивает только чтение содержимого, запись Pages и выпуск токена OpenID Connect для deployment.

`actions/configure-pages@v5` не может впервые включить Pages с обычным `GITHUB_TOKEN`. Параметр `enablement: true` требует другого токена: для GitHub App — разрешения `administration:write` и `pages:write`. Это ограничение описано в [официальном action.yml](https://github.com/actions/configure-pages/blob/v5/action.yml). Если Pages ещё не включён, сборка сайта выполнится, а этап публикации сообщит об отсутствии настроенного сайта. После выбора источника GitHub Actions запустите workflow повторно.

## Структура

- `index.html` — содержание и разметка страницы.
- `src/styles.css` — оформление и адаптивные состояния.
- `src/main.js` — меню, темы, демозвук и взаимодействия.
- `src/scene.js` — локальная 3D-сцена на Three.js и резервное отображение.
- `public/assets/` — снимок настоящего приложения, демомузыка, шрифт Manrope и SVG.

Скачать можно Windows 10/11 x64 portable-сборку ZigZak Player 1.0.0. Установка не требуется. Файл не подписан цифровым сертификатом; сведения о проверках и контрольные суммы находятся в GitHub Release плеера.
