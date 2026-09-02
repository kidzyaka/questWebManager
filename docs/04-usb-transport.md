# USB-транспорт (WebUSB)

## Требования

- Chrome/Edge 89+ (WebUSB stable с Chrome 89).
- Secure context: `https://` или `http://localhost`.
- Десктоп: Windows 10+, macOS 11+, Linux. Мобильные — вне v1.

## ADB-интерфейс шлема

При включённом ADB (Настройки → Для разработчиков → ADB) Quest представляет
себя как USB-композитное устройство с ADB-интерфейсом:

| Поле | Значение |
|------|----------|
| Class | 0xFF (Vendor Specific) |
| Subclass | 0x42 |
| Protocol | 0x01 |
| VID (Meta) | 0x2B92 |
| PID | зависит от модели (не хардкодить) |
| Эндпоинты | 2 bulk: IN (device→host), OUT (host→device) |

```ts
const ADB_FILTER = {
  interfaceClass: 0xff,
  interfaceSubClass: 0x42,
  interfaceProtocol: 1,
};
// VID 0x2B92 — опциональное сужение для UI, не жёсткое требование.
```

> Шлем может иметь несколько интерфейсов (ADB, MTP, …) — claim только ADB
> (0xFF/42/01).

## Последовательность подключения

1. `navigator.usb.requestDevice({ filters: [ADB_FILTER] })` — браузерный
   picker устройств (без промпта, если разрешение уже выдано).
2. `device.open()`.
3. `device.selectConfiguration(device.configurations[0])`.
4. Найти интерфейс: class 0xFF, subclass 42, protocol 1.
5. `device.claimInterface(iface)`.
6. Сопоставить `iface.altSetting.endpoints` → bulkIn / bulkOut.
7. Транспорт готов → ADB Core начинает handshake (CNXN).

## Передача данных

```ts
await device.transferBulkOut(outEp, chunk);         // host → device
const buf = await device.transferBulkIn(inEp, len); // device → host
```

- Пакет: header 16 байт + payload ≤ 256 KB. Читаем 16 байт, парсим
  `payload_size`, читаем payload.
- Рабочий chunk записи: **64 KB** (браузер быстрее на меньших, чем на
  протокольном максимуме).
- У `transferBulkIn` нет встроенного timeout — watchdog в ADB Core
  (05, «Watchdog»).

## Отключение и переподключение

События:
- `device.addEventListener('disconnect', …)` — устройство ушло (отключили, reboot).
- `navigator.usb.addEventListener('connect' | 'disconnect', …)` — любые USB;
  фильтруем по дескриптору.

Поведение:
1. Отключение → ADB Core закрывает все стримы → store → RECONNECT_WAIT.
2. UI: баннер «Шлем отключился. Подключите и нажмите здесь».
3. Пользователь втыкает обратно → событие `connect` с подходящим дескриптором
   → баннер подсвечивается.
4. Клик → `requestDevice` (без промпта — разрешение на устройство запомнено)
   → полная последовательность.
5. `requestDevice` требует user gesture — «авто-reconnect» нет, только кнопка.

Разрешение привязано к (origin, device). Снято в `chrome://usb` → промпт снова.

## ОС-специфика

- **Windows**: ADB-интерфейсу нужен драйвер WinUSB (или WebUSB). Если
  platform-tools `adb` первым занял интерфейс — драйвер надо переключить
  (браузер предложит «Use a different device driver»). Пошаговый гайд —
  в состоянии ERROR (11).
- **macOS**: обычно работает из коробки; браузер один раз просит разрешение.
- **Linux**: обычно работает; если нет — udev-правила.

## Пропускная способность

- USB 2.0 bulk: реалистично ~25–35 MB/s; USB 3.x: 100+ MB/s
  (зависит от кабеля/хаба/порта шлема).
- Не обещать числа в UI — показывать измеренную скорость.
- Файл 1 GB: ~30–60 c на USB 3.0.

## Подводные камни

| Камень | Митигация |
|--------|-----------|
| Шлем уснул/заблокировался — ADB упал | watchdog + баннер; «не блокируйте во время бэкапа» |
| Дешёвый кабель/хаб | подсказка при частых обрывах |
| Фоновая вкладка — троттлинг JS | transfer'ы не троттлятся, троттлятся таймеры; предупреждение |
| Несколько конфигураций | брать первую с ADB-интерфейсом |
| claim упал (device in use) | подсказка про драйвер / adb-сервер |
