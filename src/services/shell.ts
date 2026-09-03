import type { AdbSession } from '../adb/session';

export interface ExecResult {
  stdout: string;
  exitCode: number;
}

export class ShellService {
  constructor(private session: AdbSession) {}

  async exec(command: string, timeoutMs = 15000): Promise<ExecResult> {
    const token = Math.random().toString(36).substring(2, 8);
    const commandWithExitCode = `${command}; echo __QWM_${token}__:$?`;

    const stream = await this.session.openStream(`shell:${commandWithExitCode}`);

    return new Promise((resolve, reject) => {
      const decoder = new TextDecoder();
      let output = '';

      const timer = setTimeout(async () => {
        await stream.close();
        reject(new Error(`Command timed out after ${timeoutMs}ms: ${command}`));
      }, timeoutMs);

      stream.onData((chunk) => {
        output += decoder.decode(chunk, { stream: true });
      });

      stream.onClose(() => {
        clearTimeout(timer);
        output += decoder.decode(); // flush remaining bytes

        const tokenPattern = new RegExp(`__QWM_${token}__:(\\d+)`);
        const match = output.match(tokenPattern);

        let exitCode = 0;
        let cleanStdout = output;

        if (match) {
          exitCode = parseInt(match[1], 10);
          cleanStdout = output.replace(tokenPattern, '').trimEnd();
        }

        resolve({
          stdout: cleanStdout,
          exitCode,
        });
      });
    });
  }
}
