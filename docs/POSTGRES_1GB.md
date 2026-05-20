# PostgreSQL на 1gb.ru

## Подключение

Скопируйте `appsettings.Production.local.json.example` в `appsettings.Production.local.json` (файл в `.gitignore`).

Строка подключения для 1gb (часто без SSL внутри дата-центра):

```
Host=postgres82.1gb.ru;Port=5432;Database=xgb_bdmain;Username=xgb_bdmain;Password=***;SSL Mode=Disable;Timeout=30
```

Для GitHub Actions задайте секрет `POSTGRES_CONNECTION_STRING` в environment `FTP_SERVER`:

```bash
POSTGRES_CONNECTION_STRING='Host=postgres82.1gb.ru;...' ./scripts/set-1gb-github-secrets.sh
```

## Схема

При старте с заполненным `ConnectionStrings:DefaultConnection` приложение вызывает `Database.Migrate()` (папка `Migrations/`).

Локально без connection string — по-прежнему SQLite в `App_Data/ProductionPlanner.db`.

## Перенос данных SQLite → PostgreSQL

С вашего Mac/ПК (нужен доступ к `postgres82.1gb.ru`):

```bash
./scripts/migrate-sqlite-to-1gb.sh --clear
```

`--clear` очищает таблицы в PostgreSQL перед копированием.

Альтернатива:

```bash
dotnet run -- migrate-sqlite-to-postgres \
  --sqlite App_Data/ProductionPlanner.db \
  --postgres "Host=postgres82.1gb.ru;..."
```

Если с домашнего интернета хост недоступен — выполните команду **на сервере 1gb** (RDP), скопировав `App_Data/ProductionPlanner.db` и опубликованное приложение.

## Деплой

Workflow `deploy-1gb.yml` подставляет `POSTGRES_CONNECTION_STRING` в `appsettings.Production.json` при публикации.

После деплоя IIS при первом запросе применит миграции и создаст таблицы, если перенос данных ещё не делали.

## Безопасность

Не коммитьте пароль. Смените пароль в панели 1gb, если он попадал в чат или логи.
