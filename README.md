# InciGram Desktop

A custom Windows-focused fork of [AyuGram Desktop](https://github.com/AyuGram/AyuGramDesktop),
based on Telegram Desktop. GPL-3.0; upstream attribution and licenses retained.

**Status: source preview. There is no compiled InciGram executable yet.**
A download is available only after a successful Windows workflow and release upload.

## Изменения

- Новый интерфейс: светлая голубая палитра, увеличенные строки чатов и отступы,
  новая иконка, имя InciGram.exe и отдельная папка данных Windows.
- Сохранение удалённых сообщений и истории правок AyuGram включено по умолчанию.
- Ghost Mode включён для новых профилей: скрытие чтения, онлайна и индикаторов
  ввода по механизмам AyuGram. Старые настройки не перезаписываются.
- Убраны фоновые запросы за дополнительными значками/переводами и отправка дампов;
  экспорт фильтров локальный; автообновление из чужого канала отключено.

**Это не «полная анонимность».** Telegram видит аккаунт и соединение.
История доступна только для полученных и сохранённых клиентом версий сообщений.
Читайте [ограничения приватности](incigram/PRIVACY.md).

## Сборка Windows

1. Получите собственные API credentials на https://my.telegram.org.
2. В Settings → Secrets and variables → Actions добавьте `API_ID`
   и `API_HASH`. Не публикуйте значения в исходниках, issues или чате.
3. Actions → Build InciGram for Windows → Run workflow. Доступен только ручной
   запуск; workflow проверяет наличие настроек до тяжёлой подготовки библиотек.
4. После успешной сборки файлы появятся в Actions artifacts и в prerelease,
   если включён параметр publish. Готовая сборка не предполагается заранее.

Подготовлен Debug preview для x64. Workflow и Windows-сборка ещё не проверены
успешным запуском. GitHub Actions для публичных репозиториев использует стандартный
runner; лимиты, доступность и условия GitHub могут меняться. Платные runner не настроены.
Инструкция ручной сборки — [docs/building-win.md](docs/building-win.md).
Локальный помощник — [incigram/build-windows.ps1](incigram/build-windows.ps1).

Изменение палитры вложенной библиотеки хранится в `incigram/lib-ui.patch`:
помощник применяет его к закреплённому подмодулю перед сборкой. Обычный исходный ZIP
GitHub не включает подмодули — используйте `git clone --recursive` или полный архив
из prerelease исходников, когда он доступен.

## Проверка и происхождение

Проверки исходников/ресурсов не заменяют компиляцию, вход и тесты на Windows.
Изменения исходят от AyuGram commit `0f2a31bb420de98f331990432265b131b8d836b5`.
Независимый полный аудит безопасности не проводился.

Credits: AyuGram, Telegram Desktop, desktop-app libraries and all dependency authors.
See LICENSE/LEGAL and the preserved [upstream README](incigram/UPSTREAM-README.md).
This project is not an official Telegram or AyuGram release.
