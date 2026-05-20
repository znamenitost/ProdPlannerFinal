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

## PostgreSQL на сервере

После успешного FTP в логе приложения (`logs/app.log` или stdout) должно быть:

- `PostgreSQL: Host=postgres82.1gb.ru;...;Password=***`
- `Подключение к PostgreSQL установлено.`

Если старая ошибка про `docker compose` — деплой не обновил файлы (см. FTP 550).

## Ручная проверка FTP (FileZilla)

- Хост: из панели 1gb
- Порт: 21, пассивный режим
- Папка: `/http/`
