import React, { useState, useEffect, useCallback } from 'react';
import {
  Sliders,
  Power,
  Search,
  Bookmark,
  Sun,
  Battery,
  Code,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Trash2,
  X,
  Volume2,
} from 'lucide-react';
import { useStore } from '../../app/store';
import {
  SETTINGS_REGISTRY,
  SettingDefinition,
  SettingCategory,
} from '../../services/settingsRegistry';
import {
  SettingsSnapshot,
  SettingDiff,
  diffSettingsSnapshots,
} from '../../services/settings';
import type { RebootTarget } from '../../services/power';

export const SettingsTab: React.FC = () => {
  const { settingsService, reboot, shutdown, presets, savePreset, deletePreset } = useStore();

  const [activeSection, setActiveSection] = useState<'tweaks' | 'power' | 'inspector' | 'presets'>('tweaks');

  // --- TWEAKS STATE ---
  const [settingValues, setSettingValues] = useState<Record<string, string>>({});
  const [loadingValues, setLoadingValues] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ msg: string; isError: boolean } | null>(null);

  // --- POWER STATE ---
  const [powerModal, setPowerModal] = useState<{ type: 'reboot' | 'shutdown'; target?: RebootTarget } | null>(null);

  // --- INSPECTOR STATE ---
  const [snapshot1, setSnapshot1] = useState<SettingsSnapshot | null>(null);
  const [snapshot2, setSnapshot2] = useState<SettingsSnapshot | null>(null);
  const [diffResults, setDiffResults] = useState<SettingDiff[]>([]);
  const [inspectorLoading, setInspectorLoading] = useState(false);
  const [diffSearch, setDiffSearch] = useState('');

  // --- PRESETS STATE ---
  const [newPresetModal, setNewPresetModal] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [presetApplying, setPresetApplying] = useState(false);

  // Load all registered setting values
  const loadSettingsValues = useCallback(async () => {
    if (!settingsService) return;
    setLoadingValues(true);
    const values: Record<string, string> = {};

    await Promise.all(
      SETTINGS_REGISTRY.map(async (def) => {
        if (def.read) {
          try {
            values[def.id] = await def.read(settingsService);
          } catch (e) {
            console.warn(`Failed reading setting ${def.id}:`, e);
          }
        }
      })
    );

    setSettingValues(values);
    setLoadingValues(false);
  }, [settingsService]);

  useEffect(() => {
    loadSettingsValues();
  }, [loadSettingsValues]);

  // Handle setting write
  const handleSettingChange = async (def: SettingDefinition, newValue: string) => {
    if (!settingsService) return;
    setUpdatingId(def.id);
    setFeedback(null);

    // Optimistic UI update
    setSettingValues((prev) => ({ ...prev, [def.id]: newValue }));

    try {
      if (def.write) {
        await def.write(settingsService, newValue);
      }
      setFeedback({ msg: `${def.label} updated successfully`, isError: false });
    } catch (err: any) {
      setFeedback({ msg: `Failed updating ${def.label}: ${err.message}`, isError: true });
      if (def.read) {
        const current = await def.read(settingsService);
        setSettingValues((prev) => ({ ...prev, [def.id]: current }));
      }
    } finally {
      setUpdatingId(null);
    }
  };

  // Handle action button click (e.g. Volume up/down)
  const handleActionExecute = async (def: SettingDefinition) => {
    if (!settingsService || !def.execute) return;
    setUpdatingId(def.id);
    try {
      await def.execute(settingsService);
      setFeedback({ msg: `${def.label} executed`, isError: false });
    } catch (err: any) {
      setFeedback({ msg: `Error: ${err.message}`, isError: true });
    } finally {
      setUpdatingId(null);
    }
  };

  // Inspector handlers
  const handleCaptureSnapshot1 = async () => {
    if (!settingsService) return;
    setInspectorLoading(true);
    try {
      const snap = await settingsService.snapshot();
      setSnapshot1(snap);
      setSnapshot2(null);
      setDiffResults([]);
      setFeedback({ msg: 'Baseline snapshot recorded. Now toggle a setting in your headset.', isError: false });
    } catch (e: any) {
      setFeedback({ msg: `Snapshot error: ${e.message}`, isError: true });
    } finally {
      setInspectorLoading(false);
    }
  };

  const handleCaptureSnapshot2AndCompare = async () => {
    if (!settingsService || !snapshot1) return;
    setInspectorLoading(true);
    try {
      const snap2 = await settingsService.snapshot();
      setSnapshot2(snap2);
      const diffs = diffSettingsSnapshots(snapshot1, snap2);
      setDiffResults(diffs);
      setFeedback({
        msg: `Comparison complete: ${diffs.length} changed setting key(s) detected.`,
        isError: false,
      });
    } catch (e: any) {
      setFeedback({ msg: `Comparison error: ${e.message}`, isError: true });
    } finally {
      setInspectorLoading(false);
    }
  };

  // Presets handlers
  const handleSaveCurrentAsPreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!presetName.trim()) return;

    const valuesToSave: Record<string, string> = {};
    for (const def of SETTINGS_REGISTRY) {
      if (def.write && settingValues[def.id] !== undefined) {
        valuesToSave[def.id] = settingValues[def.id];
      }
    }

    savePreset(presetName.trim(), valuesToSave);
    setNewPresetModal(false);
    setPresetName('');
    setFeedback({ msg: 'Preset saved successfully', isError: false });
  };

  const handleApplyPreset = async (values: Record<string, string>) => {
    if (!settingsService) return;
    setPresetApplying(true);
    setFeedback(null);

    let successCount = 0;
    let failCount = 0;

    for (const [id, val] of Object.entries(values)) {
      const def = SETTINGS_REGISTRY.find((s) => s.id === id);
      if (def && def.write) {
        try {
          await def.write(settingsService, val);
          successCount++;
        } catch (e) {
          console.warn(`Failed applying setting ${id}:`, e);
          failCount++;
        }
      }
    }

    await loadSettingsValues();
    setPresetApplying(false);
    setFeedback({
      msg: `Preset applied (${successCount} updated${failCount > 0 ? `, ${failCount} failed` : ''})`,
      isError: failCount > 0,
    });
  };

  // Render Category of Tweaks
  const renderCategorySection = (cat: SettingCategory, title: string, icon: React.ReactNode) => {
    const list = SETTINGS_REGISTRY.filter((s) => s.category === cat);
    if (list.length === 0) return null;

    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-neutral-800 text-neutral-200 font-medium text-xs uppercase tracking-wider">
          {icon}
          <span>{title}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {list.map((def) => {
            const currentVal = settingValues[def.id] ?? '';
            const isUpdating = updatingId === def.id;

            return (
              <div
                key={def.id}
                className="bg-neutral-950 border border-neutral-800/80 rounded-lg p-3.5 flex flex-col justify-between"
              >
                <div className="mb-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-neutral-200">{def.label}</span>
                    {isUpdating && (
                      <RefreshCw className="w-3 h-3 animate-spin text-neutral-400" />
                    )}
                  </div>
                  {def.description && (
                    <p className="text-[11px] text-neutral-500 mt-0.5 leading-relaxed">
                      {def.description}
                    </p>
                  )}
                </div>

                {/* Controls */}
                <div className="pt-1">
                  {def.type === 'toggle' && (
                    <button
                      type="button"
                      disabled={isUpdating || loadingValues}
                      onClick={() =>
                        handleSettingChange(def, currentVal === 'true' ? 'false' : 'true')
                      }
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        currentVal === 'true' ? 'bg-neutral-100' : 'bg-neutral-800'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full shadow transition duration-200 ease-in-out ${
                          currentVal === 'true'
                            ? 'translate-x-4 bg-neutral-900'
                            : 'translate-x-0 bg-neutral-400'
                        }`}
                      />
                    </button>
                  )}

                  {def.type === 'slider' && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-neutral-500 font-mono">
                        <span>{def.min}</span>
                        <span className="text-neutral-200 font-semibold">{currentVal || def.min}</span>
                        <span>{def.max}</span>
                      </div>
                      <input
                        type="range"
                        min={def.min}
                        max={def.max}
                        step={def.step || 1}
                        value={currentVal || def.min || 0}
                        disabled={isUpdating || loadingValues}
                        onChange={(e) => handleSettingChange(def, e.target.value)}
                        className="w-full accent-neutral-200 cursor-pointer"
                      />
                    </div>
                  )}

                  {def.type === 'select' && (
                    <select
                      value={currentVal}
                      disabled={isUpdating || loadingValues}
                      onChange={(e) => handleSettingChange(def, e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-md px-2.5 py-1 text-xs text-neutral-200 focus:outline-none focus:border-neutral-500"
                    >
                      {def.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  )}

                  {def.type === 'action' && (
                    <button
                      onClick={() => handleActionExecute(def)}
                      disabled={isUpdating}
                      className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded text-xs font-medium border border-neutral-700 transition-colors flex items-center gap-1.5"
                    >
                      <Play className="w-3 h-3 text-neutral-300" />
                      <span>{def.actionLabel || 'Trigger'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Sub-Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-neutral-900 border border-neutral-800 p-2.5 rounded-xl shadow-sm">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveSection('tweaks')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeSection === 'tweaks'
                ? 'bg-neutral-800 text-white border border-neutral-700'
                : 'bg-neutral-950 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Quick Tweaks</span>
          </button>

          <button
            onClick={() => setActiveSection('power')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeSection === 'power'
                ? 'bg-neutral-800 text-white border border-neutral-700'
                : 'bg-neutral-950 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            <span>Power Controls</span>
          </button>

          <button
            onClick={() => setActiveSection('inspector')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeSection === 'inspector'
                ? 'bg-neutral-800 text-white border border-neutral-700'
                : 'bg-neutral-950 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Inspector (Diff Tool)</span>
          </button>

          <button
            onClick={() => setActiveSection('presets')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeSection === 'presets'
                ? 'bg-neutral-800 text-white border border-neutral-700'
                : 'bg-neutral-950 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Presets</span>
          </button>
        </div>

        {activeSection === 'tweaks' && (
          <button
            onClick={loadSettingsValues}
            disabled={loadingValues}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium rounded-lg border border-neutral-700 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${loadingValues ? 'animate-spin text-neutral-400' : ''}`} />
            Refresh
          </button>
        )}
      </div>

      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
            feedback.isError
              ? 'bg-red-950/40 border-red-900/40 text-red-400'
              : 'bg-neutral-900 border-neutral-700 text-neutral-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.isError ? (
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            )}
            <span>{feedback.msg}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="opacity-70 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SECTION 1: TWEAKS */}
      {activeSection === 'tweaks' && (
        <div className="space-y-4">
          {renderCategorySection('display', 'Display & Brightness', <Sun className="w-3.5 h-3.5 text-neutral-400" />)}
          {renderCategorySection('power', 'Power & Sleep', <Battery className="w-3.5 h-3.5 text-neutral-400" />)}
          {renderCategorySection('developer', 'Developer & System', <Code className="w-3.5 h-3.5 text-neutral-400" />)}
          {renderCategorySection('audio_network', 'Sound & Connectivity', <Volume2 className="w-3.5 h-3.5 text-neutral-400" />)}
        </div>
      )}

      {/* SECTION 2: POWER CONTROLS */}
      {activeSection === 'power' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-neutral-900 border border-neutral-800 p-5 rounded-xl space-y-2.5">
            <div className="flex items-center gap-2 text-neutral-200 font-medium text-sm">
              <RotateCcw className="w-4 h-4 text-neutral-400" />
              <span>Standard Reboot</span>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Gracefully reboots the Quest operating system. USB connection will drop momentarily.
            </p>
            <button
              onClick={() => setPowerModal({ type: 'reboot', target: 'normal' })}
              className="px-3.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium rounded-lg border border-neutral-700 transition-colors"
            >
              Reboot Headset
            </button>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 p-5 rounded-xl space-y-2.5">
            <div className="flex items-center gap-2 text-neutral-200 font-medium text-sm">
              <Power className="w-4 h-4 text-red-400" />
              <span>Power Off (Shutdown)</span>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Completely shuts down the headset. Headset must be turned back on manually via the physical button.
            </p>
            <button
              onClick={() => setPowerModal({ type: 'shutdown' })}
              className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors"
            >
              Turn Off Device
            </button>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 p-5 rounded-xl space-y-2.5">
            <div className="flex items-center gap-2 text-neutral-200 font-medium text-sm">
              <RotateCcw className="w-4 h-4 text-neutral-400" />
              <span>Reboot to Recovery</span>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Restarts the device into Android Recovery (used for sideloading update firmware packages).
            </p>
            <button
              onClick={() => setPowerModal({ type: 'reboot', target: 'recovery' })}
              className="px-3.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium rounded-lg border border-neutral-700 transition-colors"
            >
              Reboot into Recovery
            </button>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 p-5 rounded-xl space-y-2.5">
            <div className="flex items-center gap-2 text-neutral-200 font-medium text-sm">
              <RotateCcw className="w-4 h-4 text-neutral-400" />
              <span>Reboot to Bootloader</span>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Restarts into Fastboot/Bootloader mode (if supported on your device firmware).
            </p>
            <button
              onClick={() => setPowerModal({ type: 'reboot', target: 'bootloader' })}
              className="px-3.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium rounded-lg border border-neutral-700 transition-colors"
            >
              Reboot to Bootloader
            </button>
          </div>
        </div>
      )}

      {/* SECTION 3: INSPECTOR (DIFF TOOL) */}
      {activeSection === 'inspector' && (
        <div className="space-y-5">
          <div className="bg-neutral-900 border border-neutral-800 p-5 rounded-xl shadow-sm space-y-3">
            <div>
              <h3 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
                <Search className="w-4 h-4 text-neutral-400" />
                Settings Inspector & Diff Tool
              </h3>
              <p className="text-xs text-neutral-400 mt-1 max-w-2xl leading-relaxed">
                Discover undocumented Quest settings! Take a baseline snapshot, change any setting in your VR headset interface, then take a second snapshot to reveal the changed keys.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                onClick={handleCaptureSnapshot1}
                disabled={inspectorLoading}
                className="px-3.5 py-1.5 bg-neutral-100 hover:bg-white disabled:opacity-50 text-neutral-900 text-xs font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                {inspectorLoading && !snapshot1 ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <span className="w-4 h-4 rounded-full bg-neutral-300 text-neutral-900 flex items-center justify-center text-[10px] font-bold">1</span>
                )}
                <span>Capture Baseline</span>
              </button>

              <button
                onClick={handleCaptureSnapshot2AndCompare}
                disabled={inspectorLoading || !snapshot1}
                className="px-3.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed text-neutral-200 text-xs font-medium rounded-lg transition-colors border border-neutral-700 flex items-center gap-2"
              >
                {inspectorLoading && snapshot1 ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <span className="w-4 h-4 rounded-full bg-neutral-700 text-neutral-200 flex items-center justify-center text-[10px] font-bold">2</span>
                )}
                <span>Capture & Compare</span>
              </button>

              {snapshot1 && (
                <span className="text-xs text-neutral-500 font-mono">
                  Baseline: {Object.keys(snapshot1.global).length + Object.keys(snapshot1.system).length + Object.keys(snapshot1.secure).length} keys
                </span>
              )}
            </div>
          </div>

          {/* Results Table */}
          {snapshot2 && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-sm space-y-3 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <h4 className="text-xs font-semibold text-neutral-200">
                  Detected Setting Changes ({diffResults.length})
                </h4>

                <input
                  type="text"
                  value={diffSearch}
                  onChange={(e) => setDiffSearch(e.target.value)}
                  placeholder="Filter keys..."
                  className="bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-neutral-600 w-52"
                />
              </div>

              {diffResults.length === 0 ? (
                <p className="text-xs text-neutral-500 py-6 text-center">
                  No differences found between snapshots. Try toggling a setting on your headset and comparing again.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-neutral-300">
                    <thead className="bg-neutral-950/60 text-[10px] uppercase tracking-wider text-neutral-500 border-b border-neutral-800">
                      <tr>
                        <th className="px-3.5 py-2">Category</th>
                        <th className="px-3.5 py-2">Key</th>
                        <th className="px-3.5 py-2">Old Value</th>
                        <th className="px-3.5 py-2">New Value</th>
                        <th className="px-3.5 py-2 text-right">Type</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/60 font-mono text-[11px]">
                      {diffResults
                        .filter((d) => !diffSearch || d.key.toLowerCase().includes(diffSearch.toLowerCase()))
                        .map((diff) => (
                          <tr key={`${diff.category}_${diff.key}`} className="hover:bg-neutral-800/40">
                            <td className="px-3.5 py-2 text-neutral-500 uppercase text-[10px]">
                              {diff.category}
                            </td>
                            <td className="px-3.5 py-2 text-neutral-200 font-medium">
                              {diff.key}
                            </td>
                            <td className="px-3.5 py-2 text-neutral-500 line-through">
                              {diff.oldValue || '--'}
                            </td>
                            <td className="px-3.5 py-2 text-emerald-400 font-semibold">
                              {diff.newValue || '--'}
                            </td>
                            <td className="px-3.5 py-2 text-right font-sans">
                              <span
                                className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${
                                  diff.type === 'modified'
                                    ? 'bg-amber-950/60 text-amber-400 border border-amber-800/40'
                                    : diff.type === 'added'
                                    ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                                    : 'bg-red-950/60 text-red-400 border border-red-800/40'
                                }`}
                              >
                                {diff.type}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SECTION 4: PRESETS */}
      {activeSection === 'presets' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-neutral-900 border border-neutral-800 p-4 rounded-xl shadow-sm">
            <div>
              <h4 className="text-xs font-bold text-neutral-100">Saved Presets</h4>
              <p className="text-xs text-neutral-400">Quickly apply preconfigured settings to your Quest</p>
            </div>
            <button
              onClick={() => setNewPresetModal(true)}
              className="px-3 py-1.5 bg-neutral-100 hover:bg-white text-neutral-900 text-xs font-medium rounded-lg transition-colors"
            >
              + Save Current State
            </button>
          </div>

          {presets.length === 0 ? (
            <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-xl text-center text-neutral-500 text-xs">
              No saved presets yet. Click "+ Save Current State" to create your first configuration preset!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {presets.map((preset) => (
                <div
                  key={preset.id}
                  className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 shadow-sm space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <h5 className="font-semibold text-neutral-200 text-xs">{preset.name}</h5>
                    <button
                      onClick={() => deletePreset(preset.id)}
                      className="text-neutral-500 hover:text-red-400 transition-colors"
                      title="Delete Preset"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className="text-[11px] text-neutral-500">
                    {Object.keys(preset.values).length} setting(s) • Saved{' '}
                    {new Date(preset.timestamp).toLocaleDateString()}
                  </p>

                  <div className="pt-1 flex justify-end">
                    <button
                      onClick={() => handleApplyPreset(preset.values)}
                      disabled={presetApplying}
                      className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-neutral-200 text-xs font-medium rounded-lg transition-colors border border-neutral-700 flex items-center gap-1.5"
                    >
                      <Play className="w-3 h-3" />
                      <span>Apply Preset</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL: Power Confirmation */}
      {powerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-red-400">
              <Power className="w-5 h-5" />
              <h3 className="text-sm font-bold text-neutral-100">
                {powerModal.type === 'shutdown' ? 'Shut Down Headset?' : `Reboot to ${powerModal.target || 'System'}?`}
              </h3>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              {powerModal.type === 'shutdown'
                ? 'Your Meta Quest will power off completely. You will need to press the physical power button on the headset to turn it back on.'
                : `Your headset will restart into ${powerModal.target || 'normal'} mode. USB communication will be interrupted during the boot process.`}
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setPowerModal(null)}
                className="px-3.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium rounded-lg border border-neutral-700"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const m = powerModal;
                  setPowerModal(null);
                  if (m.type === 'shutdown') {
                    shutdown();
                  } else {
                    reboot(m.target);
                  }
                }}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Save Preset */}
      {newPresetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <form
            onSubmit={handleSaveCurrentAsPreset}
            className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-100">Save Preset</h3>
              <button
                type="button"
                onClick={() => setNewPresetModal(false)}
                className="text-neutral-500 hover:text-neutral-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="text-xs text-neutral-400 block mb-1.5">Preset Name</label>
              <input
                type="text"
                autoFocus
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="e.g. Max Battery"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-neutral-600"
              />
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setNewPresetModal(false)}
                className="px-3.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium rounded-lg border border-neutral-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!presetName.trim()}
                className="px-3.5 py-1.5 bg-neutral-100 hover:bg-white disabled:opacity-50 text-neutral-900 text-xs font-medium rounded-lg"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
