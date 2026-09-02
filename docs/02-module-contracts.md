# Контракты модулей (ключевые интерфейсы)

## USB-транспорт

```ts
// usb/transport.ts
interface UsbTransport {
  write(data: Uint8Array): Promise<void>;
  readPacket(): Promise<Uint8Array>;      // один полный ADB-пакет
  close(): Promise<void>;
  onDisconnect(cb: (err?: unknown) => void): void;
  onCandidateConnect(cb: (d: USBDevice) => void): void;  // для баннера reconnect
}
```

## ADB-сессия и стримы

```ts
// adb/session.ts
interface AdbSession {
  readonly state: 'handshaking' | 'ready' | 'closed';
  readonly deviceState: string;           // из CNXN: device / recovery / …
  openStream(service: string): Promise<Stream>;   // "sync:", "shell:…"
  onClosed(cb: (reason: string) => void): void;
  close(): void;
}

// adb/stream.ts
interface Stream {
  write(payload: Uint8Array): Promise<void>;
  onData(cb: (payload: Uint8Array) => void): void;
  onClose(cb: (reason?: string) => void): void;   // CLSD от устройства
  cancel(): void;
}
```

## Сервисы (кратко; подробно — в 07)

```ts
interface ShellResult { output: string; exitCode: number; ok: boolean; }
interface ShellService {
  exec(cmd: string, opts?: { timeoutMs?: number }): Promise<ShellResult>;
  stream(cmd: string, onData: (chunk: string) => void): Cancellable;
}

interface SyncService {
  push(data: Uint8Array | Blob, remotePath: string,
       opts?: { mode?: number; onProgress?: (sent: number, total: number) => void }): Promise<void>;
  pull(remotePath: string,
       opts?: { onProgress?: (received: number, total?: number) => void }): Promise<Blob>;
}

interface Cancellable { cancel(): void; readonly cancelled: boolean; }
// реализация на AbortController; features комбинируют cancel'ы для очередей
```

## События приложения

```ts
// app/events.ts
type AppEvent =
  | { type: 'log'; level: 'info' | 'warn' | 'error'; source: string; message: string }
  | { type: 'transport';
      phase: 'connecting' | 'handshake' | 'ready' | 'lost' | 'error';
      detail?: string };
```

EventBus подписывают: store (zustand), UI (баннеры/тосты), лог-таб.

## Шаблон команд (`services/commands.ts`)

Одно место для всех shell-строк (легко поправить после верификации на шлеме):

```
CMD.ls(dir)                 ls -l <dir>
CMD.mkdir(dir)              mkdir -p <dir>
CMD.rm(path)                rm -rf <path>
CMD.mv(a, b)                mv <a> <b>
CMD.pmList                  pm list packages -f
CMD.pmInstall(path, d?)     pm install -r [-d] <path>
CMD.pmUninstall(pkg, u?)    pm uninstall [--user 0] <pkg>
CMD.launch(pkg)             monkey -p <pkg> -c android.intent.category.LAUNCHER 1
CMD.forceStop(pkg)          am force-stop <pkg>
CMD.settingsGet(c, k)       settings get <c> <k>
CMD.settingsPut(c, k, v)    settings put <c> <k> <v>
CMD.settingsList(c)         settings list <c>
CMD.battery                 dumpsys battery
CMD.df                      df -h /sdcard
CMD.uptime                  cat /proc/uptime
CMD.reboot(t?)              reboot [recovery|bootloader]
CMD.shutdown                shutdown -p
CMD.logcat                  logcat -v threadtime
CMD.dumpsysPackage(pkg)     dumpsys package <pkg>
```

`shQuote(s)` — single quotes, `'` → `'\''`.
**Всегда** применять к данным пользователя (пути, значения), никогда — к
собственным константам команд.
