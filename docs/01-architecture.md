# Архитектура

## Принципы

1. **100% клиентский код.** Без бэкенда и сервера. Вся логика — в браузере;
   единственный «сервер» — шлем по USB.
2. **Строгая слоистость.** Каждый слой знает только интерфейс слоя ниже.
   ADB Core тестируется без USB (mock transport), сервисы — без протокола (mock ADB).
3. **Явные события и промисы.** Слои общаются через промисы; один EventBus —
   для сквозных событий (device lost, reconnect, лог).
4. **Одно USB-подключение, одна ADB-сессия.** Протокол мультиплексирует
   несколько сервисов (sync, shell, logcat) по одному соединению — используем.
5. **Прогресс и отмена.** Каждая длительная операция отчитывается о прогрессе
   и поддерживает отмену.

## Стек

| Компонент | Выбор | Почему |
|-----------|-------|--------|
| Сборка | Vite | быстрый dev, HMR |
| Язык | TypeScript (strict) | протокольный слой бинарный и хрупкий |
| UI | React 18 | экосистема, лёгкая передача реализации |
| Состояние | zustand | один стор: сессия, операции, лог |
| Стили | Tailwind CSS | скорость работы с UI |
| ZIP | fflate | async zip в браузере (бэкап) |
| Тесты | vitest + mock transport | юнит-тесты протокола и сервисов |

UI-фреймворк заменяем (Svelte/Preact) — границы модулей от него не зависят.

## Слои

```
UI (React)        вкладки: Device / Files / Apps / Settings / Power / Backup / Log
Features          бизнес-логика экранов (файловые операции, install-флоу, …)
Services          Shell, Sync, Device, Pm, Settings, Power, Log
ADB Core          пакеты, checksum, CNXN, мультиплексор, стримы
USB Transport     обёртка WebUSB: connect, claim, read/write, disconnect
navigator.usb     браузер (Chromium)
```

## Структура проекта

```
src/
  main.tsx
  app/        App.tsx (каркас: топбар + вкладки), store.ts (zustand), events.ts (EventBus)
  usb/        transport.ts, device.ts (поиск, переподключение)
  adb/        constants.ts, packet.ts, session.ts, stream.ts
  services/   shell.ts, sync.ts, device.ts, pm.ts, settings.ts, power.ts, log.ts, commands.ts
  features/   files/  apks/  settings/  power/  backup/  flash/
  ui/         components/  tabs/  strings.ts
  utils/      bytes.ts (hex, чанки), zip.ts, parse.ts (парсинг ls/dumpsys/pm)
```

## Потоки данных (примеры)

### Установка APK

```
UI «Установить» → features/apks
  → Sync.push(apk, /data/local/tmp/qwm/<name>-<ts>.apk)     [прогресс]
  → Shell.exec(`pm install -r -d <path>`)
  → Shell.exec(`rm <path>`)                                  (finally)
  → UI: успех / ошибка + код
```

### Перезагрузка

```
UI «Перезагрузить» → Power.reboot() → Shell.exec("reboot")
  → устройство пропадает с USB
  → store → RECONNECT_WAIT (баннер)
  → пользователь переподключает шлем, жмёт кнопку
  → полный цикл подключения заново (CNXN)
```

### Загрузка файлов

Очередь (последовательно, по одному файлу):
санитизация имени → коллизия (overwrite/skip/rename) → `Sync.push` с прогрессом.

## Очередность

- Длинные операции (push/pull, бэкап, установка) — последовательная очередь
  на уровне features: не нагружать шлем параллельными transfer'ами.
- Короткие shell-команды — можно параллельно (мультиплексор ADB Core
  гарантирует порядок внутри стрима).
