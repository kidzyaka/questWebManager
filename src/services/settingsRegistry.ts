import { SettingsService } from './settings';

export type SettingCategory = 'display' | 'power' | 'developer' | 'audio_network';
export type SettingType = 'toggle' | 'slider' | 'select' | 'action';

export interface SettingDefinition {
  id: string;
  category: SettingCategory;
  label: string;
  description?: string;
  type: SettingType;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  actionLabel?: string;

  read?: (service: SettingsService) => Promise<string>;
  write?: (service: SettingsService, value: string) => Promise<void>;
  execute?: (service: SettingsService) => Promise<void>;
}

export const SETTINGS_REGISTRY: SettingDefinition[] = [
  // --- DISPLAY ---
  {
    id: 'screen_brightness',
    category: 'display',
    label: 'Screen Brightness',
    description: 'Adjust internal display brightness level (0 - 255)',
    type: 'slider',
    min: 0,
    max: 255,
    step: 5,
    read: async (s) => (await s.get('system', 'screen_brightness')) || '128',
    write: async (s, v) => s.put('system', 'screen_brightness', v),
  },
  {
    id: 'auto_brightness',
    category: 'display',
    label: 'Adaptive Brightness',
    description: 'Automatically adjust display brightness based on ambient light',
    type: 'toggle',
    read: async (s) => ((await s.get('system', 'screen_brightness_mode')) === '1' ? 'true' : 'false'),
    write: async (s, v) => s.put('system', 'screen_brightness_mode', v === 'true' ? '1' : '0'),
  },
  {
    id: 'screen_timeout',
    category: 'display',
    label: 'Screen Off Timeout',
    description: 'Time before the headset display turns off when idle',
    type: 'select',
    options: [
      { value: '15000', label: '15 seconds' },
      { value: '30000', label: '30 seconds' },
      { value: '60000', label: '1 minute' },
      { value: '300000', label: '5 minutes' },
      { value: '600000', label: '10 minutes' },
      { value: '1800000', label: '30 minutes' },
    ],
    read: async (s) => (await s.get('system', 'screen_off_timeout')) || '60000',
    write: async (s, v) => s.put('system', 'screen_off_timeout', v),
  },

  // --- POWER & SLEEP ---
  {
    id: 'stay_awake_plugged',
    category: 'power',
    label: 'Stay Awake While Charging',
    description: 'Screen will never sleep while headset is plugged in via USB/AC',
    type: 'toggle',
    read: async (s) => ((await s.get('global', 'stay_on_while_plugged_in')) !== '0' ? 'true' : 'false'),
    write: async (s, v) => s.put('global', 'stay_on_while_plugged_in', v === 'true' ? '3' : '0'),
  },
  {
    id: 'low_power_mode',
    category: 'power',
    label: 'Battery Saver Mode',
    description: 'Enable Android low power saver mode to extend battery life',
    type: 'toggle',
    read: async (s) => ((await s.get('global', 'low_power')) === '1' ? 'true' : 'false'),
    write: async (s, v) => s.put('global', 'low_power', v === 'true' ? '1' : '0'),
  },

  // --- DEVELOPER & SYSTEM ---
  {
    id: 'dev_options',
    category: 'developer',
    label: 'Developer Options',
    description: 'Enable or disable Android system development settings',
    type: 'toggle',
    read: async (s) => ((await s.get('global', 'development_settings_enabled')) === '1' ? 'true' : 'false'),
    write: async (s, v) => s.put('global', 'development_settings_enabled', v === 'true' ? '1' : '0'),
  },
  {
    id: 'unknown_sources',
    category: 'developer',
    label: 'Install Unknown Sources',
    description: 'Allow installation of applications outside official Meta Store',
    type: 'toggle',
    read: async (s) => ((await s.get('global', 'install_non_market_apps')) === '1' ? 'true' : 'false'),
    write: async (s, v) => s.put('global', 'install_non_market_apps', v === 'true' ? '1' : '0'),
  },
  {
    id: 'auto_time',
    category: 'developer',
    label: 'Automatic Date & Time',
    description: 'Use network-provided time synchronization',
    type: 'toggle',
    read: async (s) => ((await s.get('global', 'auto_time')) === '1' ? 'true' : 'false'),
    write: async (s, v) => s.put('global', 'auto_time', v === 'true' ? '1' : '0'),
  },

  // --- AUDIO & NETWORK ---
  {
    id: 'bluetooth_toggle',
    category: 'audio_network',
    label: 'Bluetooth',
    description: 'Toggle Bluetooth radio on or off',
    type: 'toggle',
    read: async (s) => ((await s.get('global', 'bluetooth_on')) === '1' ? 'true' : 'false'),
    write: async (s, v) => {
      const enabled = v === 'true';
      await s.execRaw(enabled ? 'cmd bluetooth_manager enable' : 'cmd bluetooth_manager disable');
      await s.put('global', 'bluetooth_on', enabled ? '1' : '0');
    },
  },
  {
    id: 'airplane_mode',
    category: 'audio_network',
    label: 'Airplane Mode',
    description: 'Disables all wireless radios (Wi-Fi, Bluetooth)',
    type: 'toggle',
    read: async (s) => ((await s.get('global', 'airplane_mode_on')) === '1' ? 'true' : 'false'),
    write: async (s, v) => {
      const enabled = v === 'true';
      await s.execRaw(enabled ? 'cmd connectivity airplane-mode enable' : 'cmd connectivity airplane-mode disable');
      await s.put('global', 'airplane_mode_on', enabled ? '1' : '0');
    },
  },
  {
    id: 'volume_up',
    category: 'audio_network',
    label: 'Volume Up',
    description: 'Increase audio output volume by 1 step',
    type: 'action',
    actionLabel: 'Vol +',
    execute: async (s) => s.sendKeyEvent(24),
  },
  {
    id: 'volume_down',
    category: 'audio_network',
    label: 'Volume Down',
    description: 'Decrease audio output volume by 1 step',
    type: 'action',
    actionLabel: 'Vol -',
    execute: async (s) => s.sendKeyEvent(25),
  },
];
