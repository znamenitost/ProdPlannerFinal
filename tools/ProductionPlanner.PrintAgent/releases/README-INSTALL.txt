ProductionPlanner Print Agent — установка
========================================

1. Распакуйте ВЕСЬ ZIP в отдельную папку, например:
   C:\ProductionPlanner\PrintAgent\

2. В папке должны быть рядом:
   - ProductionPlanner.PrintAgent.exe
   - ProductionPlanner.PrintAgent.exe.config
   - много файлов .dll

   Не запускайте exe прямо из окна ZIP — Windows не подхватит dll.

3. Нужен .NET Framework 4.8 (обычно уже есть на Windows 10/11).

4. Запустите ProductionPlanner.PrintAgent.exe
   Должно открыться окно настроек и значок у часов (трей).

5. Укажите адрес сайта (например https://app-mainstream.ru),
   принтер → Сохранить → Подключить.

Если окно не появляется:
- Диспетчер задач → снять ProductionPlanner.PrintAgent
- Запустить exe снова
- При ошибке появится сообщение с текстом — пришлите его
