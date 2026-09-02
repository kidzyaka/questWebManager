# ADB: sync- и shell-сервисы

## Sync-сервис (файлы)

Имя сервиса: `"sync:\0"`. Каждый payload начинается с 4-буквенной
подкоманды.

### Push (загрузка)

```
client → device:
  "SYNC" + localPath\0 + remotePath\0 + mode(u32) + mtime(u32)
  "DATA" + chunk (≤ 64 KB)         × N
  "DONE" + mtime(u32)
device → client:
  "OKAY"            успех
  "FAIL" + reason   ошибка, reason — 4 буквы (EACC, ENOS, EEXI, …)
```

- `localPath` — произвольный ярлык (передаём имя файла).
- `remotePath` — абсолютный путь на устройстве.
- `mode` — напр. `0o644` (в dec 420).
- `mtime` — 0 = «сейчас».
- Каталог должен существовать (создать заранее `mkdir -p`), иначе FAIL.

### Pull (скачивание)

```
client → device:
  "RECV" + remotePath\0
device → client:
  "DATA" + size(u32)    полный размер файла
  "DATA" + chunk        × N
  "OKAY" | "FAIL" + reason
```

### Checksum и закрытие

```
"IDST" + path\0  →  "OKAY" + checksum(u32)  |  "FAIL"
"QUIT"           →  CLSD
```

### Ошибки

- Причины `FAIL`: `EACC` (нет прав), `ENOS` (нет места), `EEXI` (файл есть).
  Семантика перезаписи существующего файла — сверить в M2; если sync не
  перезаписывает — предшествующий `rm` (приложение реализует «overwrite»
  так).
- Обрыв во время transfer'а → операция отменяется, частичный файл на
  устройстве (приложение убирает его).

## Shell-сервис (команды)

### One-shot (основной режим)

Имя сервиса: `"shell:" + command + "\0"`.

```
client → OPEN "shell:ls -l /sdcard; echo __QWM_ab12__:$?\0"
device → WRITER* (stdout+stderr, не разделены)
device → CLSD
```

- Устройство выполняет `sh -c <command>`; сессия закрывается после
  завершения команды.
- **Exit code**: дописываем `; echo __QWM_<rand>__:$?` (случайный
  6-символьный суффикс на запрос). Парсинг: последняя строка
  `__QWM_<rand>__:(\d+)`; всё до неё — вывод.
- **stdout/stderr**: протокол не разделяет. Где важно — перенаправлять
  в команде (`2>/dev/null`); в v1 — один поток, показываем в логе.
- **Timeout**: на уровне сервиса (по умолчанию 10 c, `pm install` — 120 c);
  timeout → CLSD + TimeoutError.

### Стриминг (logcat, долгие команды)

Та же one-shot-форма, но не ждём CLSD, а читаем поток:

```
OPEN "shell:logcat -v threadtime\0" → onData (UTF-8 строки) → cancel() (CLSD)
```

- UTF-8 decode с буфером частичных чанков (строка может резаться между
  пакетами).
- Отмена: клиент шлёт CLSD; устройство убивает процесс.

### PTY (интерактивная консоль, v2)

`"shell:V=terminal-size:80x24;TERM=xterm;<cmd>\0"` — PTY с escape-кодами.
В v1 не делаем.
