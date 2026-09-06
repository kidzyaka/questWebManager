import { describe, it, expect } from 'vitest';
import {
  parseSettingsList,
  diffSettingsSnapshots,
  SettingsSnapshot,
} from './settings';

describe('SettingsService Utils', () => {
  it('should parse settings list output properly', () => {
    const raw = `
screen_brightness=150
development_settings_enabled=1
custom_complex=value=with=equals
invalid_line_without_equals
`;
    const parsed = parseSettingsList(raw);
    expect(parsed['screen_brightness']).toBe('150');
    expect(parsed['development_settings_enabled']).toBe('1');
    expect(parsed['custom_complex']).toBe('value=with=equals');
    expect(parsed['invalid_line_without_equals']).toBeUndefined();
  });

  it('should detect added, modified, and removed settings in diff', () => {
    const before: SettingsSnapshot = {
      timestamp: 1000,
      global: { stay_on: '0', to_delete: '123' },
      system: { brightness: '100' },
      secure: {},
    };

    const after: SettingsSnapshot = {
      timestamp: 2000,
      global: { stay_on: '3', newly_added: 'abc' },
      system: { brightness: '100' },
      secure: {},
    };

    const diffs = diffSettingsSnapshots(before, after);

    expect(diffs).toHaveLength(3);

    const modified = diffs.find((d) => d.key === 'stay_on');
    expect(modified).toBeDefined();
    expect(modified?.type).toBe('modified');
    expect(modified?.oldValue).toBe('0');
    expect(modified?.newValue).toBe('3');

    const added = diffs.find((d) => d.key === 'newly_added');
    expect(added?.type).toBe('added');
    expect(added?.newValue).toBe('abc');

    const removed = diffs.find((d) => d.key === 'to_delete');
    expect(removed?.type).toBe('removed');
    expect(removed?.oldValue).toBe('123');
  });
});
