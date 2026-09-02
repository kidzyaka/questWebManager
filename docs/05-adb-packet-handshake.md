# ADB: пакеты, handshake, мультиплексинг

> **Source of truth**: `adb_protocol.txt` из AOSP-репозитория `system/adb`.
> В M0.5 все константы и семантика arg0/arg1 сверяются с ним и с реальным
> capture (раздел «Верификация»).

## Пакет

Любое сообщение: header 16 байт + payload.

```
offset  size  field
0       4     command       4-буквенное ASCII-имя команды
4       4     arg0
8       4     arg1
12      4     payload_size
16      4     data_checksum
20      4     magic
24      …     payload (0 … 256 KB − 16)
```

- Все поля — little-endian uint32.
- `data_checksum` — сумма байтов payload (uint32). Пустой payload → 0.
- `magic` — ID пакета, на который этот является ответом
  (OPEN/OKAY/CLSD/WRITER/READ). Для CNXN — см. ниже.
- Макс. payload: **256 KB** (0x40000). Используем чанки по 64 KB.

### Команды

Поле command — 4-буквенное ASCII-имя. Кодирование в коде:
`u32le(s[0] | s[1]<<8 | s[2]<<16 | s[3]<<24)`.

| Имя | Назначение |
|-----|-----------|
| CNXN | handshake |
| OPEN | открыть сервис (стрим) |
| OKAY | подтверждение (OPEN) |
| STALL | «занято, попробуй позже» (ответ на OPEN) |
| CLSD | закрыть стрим |
| WRITER | данные на стриме |
| READ | запрос чтения (не используем) |
| SYNC | sync-сервис (файлы) |

> В M0.5 сверить с adb_protocol.txt: в доке даны hex-константы; правило
> выше должно с ними совпадать — проверить один раз, дёшево.

## Handshake (CNXN)

После готовности транспорта:

1. Клиент шлёт CNXN:
   - `arg0` = версия протокола, **0x001F0000** (сверить со спекой; если
     устройство поддерживает меньшую — использовать меньшую из двух).
   - `arg1` = 0.
   - `payload` = последовательность пар `TAG:VALUE\0`. Клиент шлёт
     `C:usb\0` (тип соединения).
   - `magic` — по спеке (сверить).
2. Ждём CNXN устройства:
   - `arg0` = выбранная устройством версия протокола.
   - `payload` = `S:device\0` (состояние: `device`, или `recovery`/`sideload`
     — запомнить, важно для flash-флоу) + прочие теги (батарея `b:…`).
3. Успех → состояние `ready`. Mismatch/timeout (5 c) → ProtocolError.

Если состояние `recovery` — соединение установлено, но сервисы другие
(sideload). UI показывает «шлем в recovery» и маршрутизирует в
ассистент прошивки (10).

## Мультиплексинг (стримы)

Одно соединение несёт несколько сервисов. Стрим = пара ID: local ID
отправителя и local ID получателя. ID выдаёт ADB Core (счётчик с 1, 0 не
используется).

```
client                                device
  |--- OPEN  (arg0=localId, arg1=remoteId, payload="sync:\0") --->|
  |<-- OKAY  (arg0=localId, arg1=remoteId) ------------------------|   стрим открыт
  |--- WRITER (arg0=localId, arg1=remoteId, payload=...) --------->|   данные
  |<-- WRITER (arg0=localId, arg1=remoteId, payload=...) ----------|
  |<-- CLSD  (arg0=localId, arg1=remoteId) ------------------------|   устройство закрыло стрим
```

- OPEN: отправитель выбирает local ID; payload — имя сервиса
  (`"sync:\0"`, `"shell:ls\0"`, …).
- OKAY: устройство подтверждает; ID — «зеркало» OPEN (arg0/arg1 поменяны
  местами) — точную семантику сверить в M0.5.
- STALL: устройство занято — ждать 250 ms и повторить OPEN, до 3 раз,
  затем ошибка.
- CLSD: стрим закрыт одной из сторон; данные in-flight отбрасываются.
  Стрим не переиспользуется — новый сервис = новый OPEN.

## Watchdog

- При активной операции нет пакета **15 c** → транспорт считается мёртвым:
  закрыть сессию → RECONNECT_WAIT.
- Нет активных операций — watchdog не активен (устройство может молчать).

## Верификация (M0.5)

1. Прочитать `adb_protocol.txt` (AOSP `system/adb`), заполнить/сверить
   `adb/constants.ts`.
2. Capture: на устройстве выполнить
   `setprop service.adb.tcp.port 5555; stop adbd; start adbd`, затем
   `tcpdump -i lo port 5555` во время штатных `adb shell`, `adb push`,
   `adb pull`. → побайтовый эталон CNXN/OPEN/OKAY/WRITER/CLSD/sync.
3. Юнит-тесты: mock transport проигрывает пойканные пакеты — handshake
   и push/pull 1 KB проходят.

> Бонус: если ADB over TCP на шлеме работает — это путь к беспроводному
> режиму v2 (локальный WebSocket-мост, без WebUSB).
