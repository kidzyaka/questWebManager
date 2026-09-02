# Фичи: настройки и питание

## Настройки

### Принцип

- Настройка в UI = **запись реестра**: контрол + команда чтения + команда
  записи.
- Реестр — `services/settingsRegistry.ts`:

```ts
interface SettingDef {
  id: string;
  category: 'general' | 'display' | 'audio' | 'network' | 'system' | 'developer';
  label: string;
  type: 'toggle' | 'slider' | 'select' | 'text' | 'action';
  read?: { cmd: string; parse: (out: string) => string | undefined };
  write?: (value: string) => string;   // команда
  options?: { value: string; label: string }[];
  min?: number; max?: number; step?: number;
  verified?: boolean;    // проверено на шлеме
}
```

- Состояние контрола = результат `read` (fetch при открытии вкладки +
  после записи).
- Запись — immediate, тост успеха/ошибки на каждую настройку.

### Реестр v1

> Всё, что помечено **«к проверке»**, верифицируется на шлеме в M3
> (протокол: поменял в UI → diff `settings list` → нашёл ключ).

| id | Подпись | Тип | Запись | Статус |
|----|---------|-----|--------|--------|
| dev-options | Для разработчиков | toggle | `settings put global development_settings_enabled 1/0` | к проверке |
| unknown-sources | Установка из неизвестных источников | toggle | `settings put global install_non_market_apps 1/0` | к проверке |
| brightness | Яркость | slider 0–255 | `settings put system screen_brightness <v>` | к проверке |
| auto-brightness | Автояркость | toggle | `settings put system screen_brightness_mode 0/1` | к проверке |
| screen-timeout | Сбрасывание экрана | select (10 с–30 мин) | `settings put system screen_off_timeout <ms>` | к проверке |
| stay-awake | Не гасить при зарядке | toggle | `settings put global stay_on_while_plugged_in -1/0` | к проверке |
| airplane | Авиарежим | toggle | `cmd connectivity airplane-mode enable/disable` | к проверке |
| auto-time | Автосинхр. времени | toggle | `settings put global auto_time 0/1` | к проверке |
| timezone | Часовой пояс | text | `settings put global auto_time_zone 0` + `settings put global time_zone <tz>` | к проверке |
| low-power | Экономия заряда | toggle | `settings put global low_power 0/1` | к проверке |
| volume-media | Громкость | action (вверх/вниз) | `input keyevent 24` / `25` | чтения нет |
| wifi-scan | Сканировать Wi-Fi | action | `cmd wifi scan-start` | к проверке |
| wifi-connect | Подключиться к Wi-Fi | text (ssid+pass) | `cmd wifi connect-network "<ssid>" WPA "<pass>"` | к проверке |
| bluetooth | Bluetooth | toggle | `cmd bluetooth_manager enable/disable` | к проверке |

> Громкость: в `settings` ключа для media volume нет; надёжный путь —
> keyevent вверх/вниз. «Установить в N» — v2.

### Режим исследования (инструмент в приложении)

1. «Снимок» — `settings list global/system/secure` (+ опционально
   `dumpsys <service>`) → сохранение в файл.
2. Пользователь меняет настройку на шлеме.
3. «Снимок» повторно → приложение показывает **diff** (изменённые ключи)
   → «Создать запись реестра» (черновик с ключом).
4. Ручная проверка записи.

Первоклассная фича (секция «Исследование» во вкладке Настройки) —
пользователь расширяет реестр без кода.

### Пресеты

- Пресет = JSON `{ id, name, entries: { "global.<key>": "<value>", … } }`.
- Сохранить текущее состояние / применить (последовательно, отчёт) /
  удалить. Хранение: localStorage.

### Что точно не в v1

- Guardian (калибровка зоны) — нет shell-интерфейса.
- Passthrough / VR-среда — нет интерфейса.

## Питание

| Управление | Команда | Примечание |
|------------|---------|------------|
| Перезагрузка | `reboot` | ожидаем отключение |
| Перезагрузка в recovery | `reboot recovery` | для ассистента прошивки (к проверке) |
| Перезагрузка в bootloader | `reboot bootloader` | к проверке |
| Выключение | `shutdown -p` | к проверке (fallback `poweroff`) |
| **Включение** | — | **невозможно**: ADB работает только при включённом устройстве |

- Диалог подтверждения для shutdown/reboot: «соединение будет потеряно».
- После reboot: баннер «Ожидание шлема…» (RECONNECT_WAIT).

### Статусы (вкладка Device)

- Батарея: `dumpsys battery` → level (0–100), plugged (0/1/2/4),
  temperature (0.1 °C), health (2 = good).
- Хранилище: `df -h /sdcard` → total/free GB.
- Uptime: `cat /proc/uptime` → «3 д 4 ч».
- Модель/сериал/Android/build: `getprop`.
- Refresh: кнопка + авто каждые 30 c.
