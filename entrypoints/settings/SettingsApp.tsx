import React, { useEffect, useState } from 'react';
import { getSettings, updateSettings, resolveFilename, DEFAULT_SETTINGS } from '../../lib/settings';
import type { Settings } from '../../lib/settings';

const FORMATS = [
  { id: 'png', label: 'PNG', desc: 'Lossless, best quality' },
  { id: 'jpg', label: 'JPG', desc: 'Smaller file size' },
  { id: 'webp', label: 'WebP', desc: 'Modern, smallest size' },
] as const;

const AFTER_CAPTURE = [
  { id: 'editor', label: 'Open editor', desc: 'Opens the annotation editor in a new tab' },
  { id: 'save', label: 'Save to downloads', desc: 'Auto-saves directly — no editor, no interruption' },
  { id: 'both', label: 'Both', desc: 'Saves to downloads AND opens the editor' },
] as const;

const FILENAME_VARS = [
  { token: '{domain}', desc: 'Page hostname' },
  { token: '{timestamp}', desc: 'Full ISO timestamp' },
  { token: '{date}', desc: 'Date (YYYY-MM-DD)' },
  { token: '{time}', desc: 'Time (HH-MM-SS)' },
];

const SHORTCUTS = [
  { action: 'Capture visible area', keys: 'Alt + Shift + S' },
  { action: 'Capture full page', keys: 'Alt + Shift + F' },
  { action: 'Select region', keys: 'Alt + Shift + R' },
  { action: 'Pick element', keys: 'Alt + Shift + E' },
];

const glass = 'bg-slate-900/60 backdrop-blur-xl border border-white/10 shadow-xl';

export default function SettingsApp() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
      setLocalPattern(s.filenamePattern);
    });
  }, []);

  const [localPattern, setLocalPattern] = useState(settings.filenamePattern);

  async function update(partial: Partial<Settings>) {
    const updated = await updateSettings(partial);
    setSettings(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-2xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <img src="/icons/icon-48.png" alt="Elysium Logo" className="w-10 h-10" />
          <div>
            <h1 className="text-xl font-semibold">Elysium Settings</h1>
            <p className="text-sm text-slate-400">Configure your screenshot workflow</p>
          </div>
          <div className="flex-1" />
          {saved && (
            <span className="text-xs text-emerald-400 bg-emerald-950/50 px-3 py-1 rounded-full border border-emerald-800/30">
              Saved
            </span>
          )}
        </div>

        {/* ─── Capture Behavior ─── */}
        <Section title="Capture" icon="📷">
          <SettingRow label="Auto-copy to clipboard" desc="Automatically copy screenshot to clipboard when captured">
            <Toggle checked={settings.autoCopyToClipboard} onChange={(v) => update({ autoCopyToClipboard: v })} />
          </SettingRow>

          <div className="mt-4">
            <label className="text-sm text-slate-300 mb-2 block">After capture</label>
            <div className="grid grid-cols-3 gap-2">
              {AFTER_CAPTURE.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => update({ afterCapture: opt.id })}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    settings.afterCapture === opt.id
                      ? 'bg-indigo-600/20 border-indigo-500/50 text-white'
                      : 'bg-slate-800/40 border-white/5 text-slate-400 hover:border-white/10'
                  }`}
                >
                  <div className="text-sm font-medium">{opt.label}</div>
                  <div className="text-[11px] mt-1 opacity-70">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* ─── Export Defaults ─── */}
        <Section title="Export" icon="💾">
          <div className="mb-4">
            <label className="text-sm text-slate-300 mb-2 block">Default format</label>
            <div className="flex gap-2">
              {FORMATS.map((fmt) => (
                <button
                  key={fmt.id}
                  onClick={() => update({ defaultFormat: fmt.id })}
                  className={`flex-1 p-3 rounded-xl border text-center transition-all ${
                    settings.defaultFormat === fmt.id
                      ? 'bg-indigo-600/20 border-indigo-500/50 text-white'
                      : 'bg-slate-800/40 border-white/5 text-slate-400 hover:border-white/10'
                  }`}
                >
                  <div className="text-sm font-medium">{fmt.label}</div>
                  <div className="text-[11px] mt-0.5 opacity-70">{fmt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {settings.defaultFormat !== 'png' && (
            <SettingRow label="Default quality" desc={`${Math.round(settings.defaultQuality * 100)}%`}>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={settings.defaultQuality}
                onChange={(e) => update({ defaultQuality: Number(e.target.value) })}
                className="w-40 accent-indigo-500"
              />
            </SettingRow>
          )}

          <div className="mt-4">
            <label className="text-sm text-slate-300 mb-1 block">Filename pattern</label>
            <input
              type="text"
              value={localPattern}
              onChange={(e) => setLocalPattern(e.target.value)}
              onBlur={() => update({ filenamePattern: localPattern })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') update({ filenamePattern: localPattern });
              }}
              className="w-full bg-slate-800/60 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50"
            />
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {FILENAME_VARS.map((v) => (
                <button
                  key={v.token}
                  onClick={() => {
                    const newPattern = localPattern + v.token;
                    setLocalPattern(newPattern);
                    update({ filenamePattern: newPattern });
                  }}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 border border-white/5 text-slate-400 hover:text-white hover:border-indigo-500/30 transition-colors"
                  title={v.desc}
                >
                  {v.token}
                </button>
              ))}
            </div>
            <div className="mt-2 text-[11px] text-slate-500">
              Preview: <span className="text-slate-400">{resolveFilename(localPattern, settings.defaultFormat, 'https://www.example.com/page')}</span>
            </div>
          </div>
        </Section>

        {/* ─── Keyboard Shortcuts ─── */}
        <Section title="Keyboard Shortcuts" icon="⌨">
          <div className="space-y-2">
            {SHORTCUTS.map((s) => (
              <div key={s.action} className="flex items-center justify-between py-1.5">
                <span className="text-sm text-slate-300">{s.action}</span>
                <kbd className="text-xs text-slate-400 bg-slate-800 px-2.5 py-1 rounded-lg border border-white/5 font-mono">
                  {s.keys}
                </kbd>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Need to change these? Go to your browser's extensions page.
            </p>
            <button
              onClick={() => browser.tabs.create({ url: 'chrome://extensions/shortcuts' })}
              className="text-xs font-medium text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-white/5 transition-colors"
            >
              Configure Shortcuts ↗
            </button>
          </div>
        </Section>

        {/* ─── About ─── */}
        <Section title="About" icon="ℹ">
          <div className="flex items-center gap-3">
            <img src="/icons/icon-48.png" alt="Elysium Logo" className="w-10 h-10" />
            <div>
              <div className="text-sm font-medium">Elysium Screenshot</div>
              <div className="text-xs text-slate-500">v{browser.runtime.getManifest().version}</div>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500 leading-relaxed max-w-lg">
            The best free screenshot extension. Full-page capture, region select, element capture,
            annotation tools, blur, and more. 100% free, no paywalls, no account required.
          </p>
          <div className="mt-4 flex gap-3">
            <a
              href="https://github.com/rps321321/elysium-screenshot"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl bg-white text-slate-900 hover:bg-slate-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.699-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
              </svg>
              Star us on GitHub
            </a>
          </div>
        </Section>

        {/* Reset */}
        <div className="mt-6 text-center">
          <button
            onClick={() => update(DEFAULT_SETTINGS)}
            className="text-xs text-slate-600 hover:text-red-400 transition-colors"
          >
            Reset all settings to defaults
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Reusable components ───

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className={`${glass} rounded-2xl p-5 mb-4`}>
      <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
        <span>{icon}</span> {title}
      </h2>
      {children}
    </div>
  );
}

function SettingRow({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1">
      <div>
        <div className="text-sm text-slate-300">{label}</div>
        {desc && <div className="text-[11px] text-slate-500">{desc}</div>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-10 h-5.5 rounded-full relative transition-colors ${
        checked ? 'bg-indigo-600' : 'bg-slate-700'
      }`}
      style={{ width: 40, height: 22, padding: 2 }}
    >
      <div
        className="w-4.5 h-4.5 bg-white rounded-full transition-transform shadow-sm"
        style={{
          width: 18, height: 18,
          transform: checked ? 'translateX(18px)' : 'translateX(0)',
          transition: 'transform 0.15s ease',
        }}
      />
    </button>
  );
}
