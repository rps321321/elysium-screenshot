import { useEditorStore } from '../../../stores/editor';
import type { AnnotationTool } from '../../../lib/types';

const TOOLS: { id: AnnotationTool; icon: string; label: string }[] = [
  { id: 'pen', icon: '✏️', label: 'Pen' },
  { id: 'text', icon: 'T', label: 'Text' },
  { id: 'arrow', icon: '➜', label: 'Arrow' },
  { id: 'rect', icon: '▭', label: 'Rectangle' },
  { id: 'circle', icon: '○', label: 'Circle' },
  { id: 'line', icon: '╱', label: 'Line' },
  { id: 'blur', icon: '▦', label: 'Blur' },
  { id: 'highlight', icon: '🖍', label: 'Highlight' },
  { id: 'crop', icon: '⬔', label: 'Crop' },
  { id: 'number', icon: '#', label: 'Number' },
  { id: 'eraser', icon: '⌫', label: 'Eraser' },
];

const COLORS = [
  '#ff0000', '#ff6600', '#ffcc00', '#33cc33',
  '#0099ff', '#6633ff', '#ff33cc', '#ffffff',
  '#000000', '#888888',
];

const LINE_WIDTHS = [1, 2, 3, 5, 8, 12];

interface ToolbarProps {
  onExport: () => void;
}

export function Toolbar({ onExport }: ToolbarProps) {
  const {
    activeTool, setActiveTool,
    color, setColor,
    lineWidth, setLineWidth,
    fontSize, setFontSize,
    blurRadius, setBlurRadius,
    undo, redo,
    undoStack, redoStack,
  } = useEditorStore();

  const glass = 'bg-slate-900/60 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/40';

  return (
    <>
      {/* ─── Main floating tool pill ─── */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50">
        <div className={`${glass} rounded-2xl px-2 py-1.5 flex items-center gap-1 scale-[1.4] origin-top`}>
          {TOOLS.map((tool) => (
            <button
              key={tool.id}
              onClick={() => setActiveTool(activeTool === tool.id ? null : tool.id)}
              className={`h-8 px-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all duration-150 ${
                activeTool === tool.id
                  ? 'bg-indigo-500/90 text-white shadow-lg shadow-indigo-500/30 scale-105'
                  : 'text-slate-400 hover:text-white hover:bg-white/10'
              }`}
              title={tool.label}
            >
              <span className="text-sm">{tool.icon}</span>
              <span className="text-[10px] font-medium tracking-wide uppercase">{tool.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Color + size pill (below main toolbar, only when a tool is active) ─── */}
      {activeTool && activeTool !== 'crop' && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50">
          <div className={`${glass} rounded-2xl px-3 py-2 flex items-center gap-2 scale-[1.4] origin-top`}>
            {/* Colors */}
            <div className="flex items-center gap-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-5 h-5 rounded-full transition-all duration-150 ${
                    color === c
                      ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-900 scale-110'
                      : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>

            <div className="w-px h-5 bg-white/10" />

            {/* Line width */}
            <div className="flex items-center gap-0.5">
              {LINE_WIDTHS.map((w) => (
                <button
                  key={w}
                  onClick={() => setLineWidth(w)}
                  className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                    lineWidth === w
                      ? 'bg-white/20'
                      : 'hover:bg-white/10'
                  }`}
                  title={`${w}px`}
                >
                  <div
                    className="rounded-full bg-white"
                    style={{ width: Math.min(w + 2, 12), height: Math.min(w + 2, 12) }}
                  />
                </button>
              ))}
            </div>

            {/* Font size slider — text tool only */}
            {activeTool === 'text' && (
              <>
                <div className="w-px h-5 bg-white/10" />
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400">Aa</span>
                  <input
                    type="range"
                    min={12}
                    max={72}
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    className="w-16 accent-indigo-400 h-1"
                  />
                  <span className="text-[10px] text-slate-400 w-5">{fontSize}</span>
                </div>
              </>
            )}

            {/* Blur radius slider — blur tool only */}
            {activeTool === 'blur' && (
              <>
                <div className="w-px h-5 bg-white/10" />
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400">Blur</span>
                  <input
                    type="range"
                    min={3}
                    max={30}
                    value={blurRadius}
                    onChange={(e) => setBlurRadius(Number(e.target.value))}
                    className="w-16 accent-indigo-400 h-1"
                  />
                  <span className="text-[10px] text-slate-400 w-5">{blurRadius}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── Top-right actions pill ─── */}
      <div className="absolute top-4 right-6 z-50">
        <div className={`${glass} rounded-2xl px-2 py-1.5 flex items-center gap-1 scale-[1.4] origin-top-right`}>
          <button
            onClick={undo}
            disabled={undoStack.length === 0}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-sm text-slate-300 hover:bg-white/10 disabled:opacity-25 transition-all"
            title="Undo (Ctrl+Z)"
          >
            ↩
          </button>
          <button
            onClick={redo}
            disabled={redoStack.length === 0}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-sm text-slate-300 hover:bg-white/10 disabled:opacity-25 transition-all"
            title="Redo (Ctrl+Y)"
          >
            ↪
          </button>

          <div className="w-px h-5 bg-white/10" />

          <button
            onClick={onExport}
            className="h-8 px-3 rounded-xl bg-indigo-500/80 hover:bg-indigo-500 text-white text-xs font-medium transition-all flex items-center gap-1.5"
            title="Export (Ctrl+S)"
          >
            <span>💾</span> Export
          </button>
        </div>
      </div>
    </>
  );
}
