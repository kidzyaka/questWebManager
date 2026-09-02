# Сервисы: высокоуровневый API

Сервисы — единственный путь features к устройству. Строятся на одной
`AdbSession` (фабрика в `services/index.ts`).

## DeviceService

```ts
interface DeviceService { info(): Promise<DeviceInfo>; }
```

- Модель/сериал/Android/build: один вызов
  `getprop ro.product.model ro.serialno ro.build.version.release ro.build.display.id`
  (toybox getprop принимает несколько ключей и печатает по строке —
  **к проверке** в M1; fallback: отдельные вызовы).
- Батарея: `dumpsys battery` (парсинг `level:`, `plugged:`,
  `temperature:` — десятые градуса, `health:`).
- Хранилище: `df -h /sdcard` (**к проверке** формат вывода).
- Uptime: `cat /proc/uptime` (первое поле).

## PmService

```ts
interface PmService {
  listApps(): Promise<AppInfo[]>;
  appInfo(pkg: string): Promise<AppInfo>;
  install(apk: Blob, opts?: {
    downgrade?: boolean;
    onProgress?: (stage: string, sent: number, total: number) => void;
  }): Promise<InstallResult>;
  uninstall(pkg: string, userOnly?: boolean): Promise<void>;
  launch(pkg: string): Promise<void>;
  forceStop(pkg: string): Promise<void>;
}
```

- `listApps`: `pm list packages -f` → строки `package:<path>=<pkg>`.
  `system` = путь не под `/data` (system-APK лежат в `/system`, `/product`,
  `/vendor`).
- `appInfo`: `dumpsys package <pkg>` → парсинг `versionName=`,
  `versionCode=`, `lastUpdateTime`, `codePath`. Вывод большой (десятки KB) —
  timeout 10 c, кэш 60 s.
- `install`: push в `/data/local/tmp/qwm/<name>-<ts>.apk` (стадия «загрузка»)
  → `pm install -r [-d] <path>` (стадия «установка»; парсинг `Success` /
  `Failure [INSTALL_FAILED_*]`) → `rm` (finally).
- `uninstall`: `pm uninstall <pkg>` (third-party);
  `pm uninstall --user 0 <pkg>` (system, «скрыть»).
- `launch`: `monkey -p <pkg> -c android.intent.category.LAUNCHER 1`.
- `forceStop`: `am force-stop <pkg>`.

## SettingsService

```ts
type SettingsCategory = 'global' | 'system' | 'secure';
interface SettingsService {
  get(c: SettingsCategory, key: string): Promise<string>;
  put(c: SettingsCategory, key: string, value: string): Promise<void>;
  list(c: SettingsCategory): Promise<Record<string, string>>;
  snapshot(): Promise<Record<SettingsCategory, Record<string, string>>>;
  apply(map: Record<string, string>): Promise<ApplyReport>; // ключ → "cat:key"
}
```

- Команды: `settings get/put/list <cat> …`; `list` — парсинг строк
  `key=value`.
- `apply` — последовательно, собирать успех/неуспех (non-zero exit не
  фатален).
- Реестр «известных настроек» (UI → команды) — в 09, отдельный файл
  `services/settingsRegistry.ts`.

## PowerService

```ts
interface PowerService {
  reboot(target?: 'normal' | 'recovery' | 'bootloader'): Promise<void>;
  shutdown(): Promise<void>;
}
```

- `reboot`: `reboot` / `reboot recovery` / `reboot bootloader`
  (bootloader — **к проверке**; не поддерживается → ошибка «недоступно»).
- `shutdown`: `shutdown -p` (**к проверке**; fallback `poweroff`).
- После вызова — ожидаем отключение; сервис на него не ждёт.

## LogService

```ts
interface LogService { tail(opts?: { buffer?: number }): Cancellable; }
```

- `shell:logcat -v threadtime` (стриминг). Буфер последних N строк в памяти
  (по умолчанию 2000). Один tail за раз.
