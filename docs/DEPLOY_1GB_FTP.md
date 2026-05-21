# Деплой на 1gb.ru и ошибка FTP 550

## FTP 550 Access denied

Чаще всего:

1. **Неверный пароль FTP** — обновите секрет `FTP_PASSWORD` в Environment FTP_SERVER.
2. **Неверная папка** — по умолчанию `/http/`. Если в панели 1gb другой путь, задайте секрет `FTP_SERVER_DIR` (например `/http/` или `http/`).
3. **Занятые папки** — не загружаем `logs/` и `App_Data/` (IIS держит файлы, FTP отвечает 550).

Секреты в GitHub → Settings → Environments → **FTP_SERVER**:

| Секрет | Пример |
|--------|--------|
| FTP_SERVER | ftp.team-mainb6d.1gb.ru |
| FTP_USERNAME | 1gb_team-mainb6d |
| FTP_PASSWORD | из панели 1gb |
| FTP_SERVER_DIR | /http/ (опционально) |
| POSTGRES_CONNECTION_STRING | Host=postgres82.1gb.ru;...;SSL Mode=Disable;Timeout=30 |

## Проверка, что на сайте новая сборка

После зелёного **Deploy to 1gb.ru**:

1. Откройте http://team-mainb6d.1gb.ru/wwwroot/deploy-version.txt — в `sha` должен быть коммит из Actions.
2. Откройте http://team-mainb6d.1gb.ru/api/deploy-info — тот же `sha` и `bundle` (имя `index-*.js`).
3. На главной: **Просмотр кода страницы** → в `<head>` комментарий `deploy-sha:...`.
4. **Ctrl+Shift+R** (жёсткое обновление). Без этого браузер может держать старый `index.html` и грузить старый `index-*.js`.

Коммит `f77c748` менял только CI/backend-предупреждения — **UI не меняется**, если на FTP уже лежит тот же `index-*.js`. Если UX нет, смотрите: job был зелёный до шага FTP; в `deploy-version.txt` на FTP актуальный `sha`; вы на **Таблица задач** (меню ⋮) и под нужной ролью (Admin или своя задача без дочерних).

## PostgreSQL на сервере

После успешного FTP в логе приложения (`logs/app.log` или stdout) должно быть:

- `PostgreSQL: Host=postgres82.1gb.ru;...;Password=***`
- `Подключение к PostgreSQL установлено.`

Если старая ошибка про `docker compose` — деплой не обновил файлы (см. FTP 550).

## Ручная проверка FTP (FileZilla)

- Хост: из панели 1gb
- Порт: 21, пассивный режим
- Папка: `/http/`
## FTP 550 при перезаписи exe

На IIS файл `ProductionPlanner.exe` заблокирован работающим сайтом. Workflow перед деплоем загружает `app_offline.htm` (останавливает приложение), ждёт 15 с, затем заливает файлы и удаляет `app_offline.htm`.

Если 550 остаётся — проверьте **FTP_PASSWORD** (не путать с паролем PostgreSQL) и каталог **FTP_SERVER_DIR** (`/http/`).
