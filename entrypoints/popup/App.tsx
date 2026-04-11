import { useState } from 'react';
import type { DelayDuration } from '../../lib/types';

const CAPTURE_MODES = [
  {
    id: 'visible',
    label: 'Visible Area',
    icon: '🖥',
    description: 'Capture what you see',
    shortcut: 'Alt+Shift+S',
  },
  {
    id: 'fullpage',
    label: 'Full Page',
    icon: '📄',
    description: 'Scroll & capture entire page',
    shortcut: 'Alt+Shift+F',
  },
  {
    id: 'region',
    label: 'Select Region',
    icon: '✂',
    description: 'Click & drag to select area',
    shortcut: 'Alt+Shift+R',
  },
  {
    id: 'element',
    label: 'Pick Element',
    icon: '🎯',
    description: 'Click any DOM element',
    shortcut: 'Alt+Shift+E',
  },
] as const;

const DELAY_OPTIONS: DelayDuration[] = [3, 5, 10];

function App() {
  const [isCapturing, setIsCapturing] = useState(false);
  const [showDelay, setShowDelay] = useState(false);
  const [status, setStatus] = useState('');

  async function handleCapture(mode: string) {
    setIsCapturing(true);
    setStatus('Capturing...');

    try {
      const msg = { type: `CAPTURE_${mode.toUpperCase()}` };
      await browser.runtime.sendMessage(msg);
    } catch (err: unknown) {
      console.error('Elysium: capture message failed', err);
    } finally {
      window.close();
    }
  }

  async function handleDelayCapture(delay: DelayDuration) {
    setIsCapturing(true);
    setStatus(`Capturing in ${delay}s...`);

    try {
      await browser.runtime.sendMessage({ type: 'CAPTURE_DELAYED', delay });
    } catch (err: unknown) {
      console.error('Elysium: delay capture message failed', err);
    } finally {
      window.close();
    }
  }

  return (
    <div className="w-[320px] bg-gradient-to-b from-slate-900 to-slate-950 text-white font-sans">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-2 mb-1">
          <img src="/icons/icon-32.png" alt="Elysium Logo" className="w-7 h-7" />
          <h1 className="text-base font-semibold tracking-tight">Elysium Screenshot</h1>
          <span className="text-[10px] text-indigo-400 bg-indigo-950 px-1.5 py-0.5 rounded-full font-medium">
            FREE
          </span>
        </div>
        <p className="text-[11px] text-slate-400">Capture, annotate, and export — no paywalls.</p>
      </div>

      {/* Capture Modes */}
      <div className="px-3 pb-2 space-y-1.5">
        {CAPTURE_MODES.map((mode) => (
          <button
            key={mode.id}
            onClick={() => handleCapture(mode.id)}
            disabled={isCapturing}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700/50 hover:border-indigo-500/50 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed text-left group"
          >
            <span className="text-lg w-6 text-center">{mode.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white">{mode.label}</div>
              <div className="text-[10px] text-slate-400">{mode.description}</div>
            </div>
            <kbd className="text-[9px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 group-hover:text-indigo-400 group-hover:border-indigo-800 transition-colors font-mono">
              {mode.shortcut}
            </kbd>
          </button>
        ))}
      </div>

      {/* Delayed Capture */}
      <div className="px-3 pb-3">
        <button
          onClick={() => setShowDelay(!showDelay)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-800/40 hover:bg-slate-700/60 border border-slate-700/30 hover:border-amber-500/30 transition-all duration-150 text-left"
        >
          <span className="text-lg w-6 text-center">⏱</span>
          <div className="flex-1">
            <div className="text-sm font-medium text-white">Delayed Capture</div>
            <div className="text-[10px] text-slate-400">Capture after countdown</div>
          </div>
          <svg
            className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${showDelay ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showDelay && (
          <div className="mt-1.5 flex gap-2 px-1">
            {DELAY_OPTIONS.map((delay) => (
              <button
                key={delay}
                onClick={() => handleDelayCapture(delay)}
                disabled={isCapturing}
                className="flex-1 py-2 rounded-lg bg-amber-900/30 hover:bg-amber-800/40 border border-amber-700/30 hover:border-amber-500/50 text-amber-200 text-sm font-medium transition-all disabled:opacity-50"
              >
                {delay}s
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Status */}
      {status && (
        <div className="px-4 pb-2">
          <div className="text-[11px] text-center text-indigo-300 bg-indigo-950/50 rounded-md py-1.5">
            {status}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-slate-800 flex items-center justify-between">
        <span className="text-[11px] text-slate-500 font-medium">100% free, no paywalls</span>
        <button
          onClick={() => browser.tabs.create({ url: browser.runtime.getURL('/settings.html') })}
          className="flex items-center gap-1.5 px-2 py-1 -mr-2 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Settings"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-xs font-semibold">Settings</span>
        </button>
      </div>
    </div>
  );
}

export default App;
