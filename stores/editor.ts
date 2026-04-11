import { create } from 'zustand';
import type { Annotation, AnnotationTool, Point, ExportFormat } from '../lib/types';

const MAX_STACK_SIZE = 50;

interface EditorState {
  // Image
  imageDataUrl: string | null;
  imageWidth: number;
  imageHeight: number;

  // Capture metadata (for filename resolution)
  captureUrl: string;

  // Tool state
  activeTool: AnnotationTool | null;
  color: string;
  lineWidth: number;
  fontSize: number;
  blurRadius: number;

  // Annotations
  annotations: Annotation[];
  undoStack: Annotation[][];
  redoStack: Annotation[][];
  nextNumber: number;

  // Crop
  isCropping: boolean;
  cropRect: { x: number; y: number; width: number; height: number } | null;

  // Export
  exportFormat: ExportFormat;
  exportQuality: number;

  // Zoom/Pan
  zoom: number;
  panOffset: Point;

  // Actions
  setImage: (dataUrl: string, width: number, height: number) => void;
  setCaptureUrl: (url: string) => void;
  setActiveTool: (tool: AnnotationTool | null) => void;
  setColor: (color: string) => void;
  setLineWidth: (width: number) => void;
  setFontSize: (size: number) => void;
  setBlurRadius: (radius: number) => void;
  addAnnotation: (annotation: Annotation) => void;
  undo: () => void;
  redo: () => void;
  setCropRect: (rect: { x: number; y: number; width: number; height: number } | null) => void;
  applyCrop: () => void;
  setExportFormat: (format: ExportFormat) => void;
  setExportQuality: (quality: number) => void;
  setZoom: (zoom: number) => void;
  setPanOffset: (offset: Point) => void;
  setView: (zoom: number, offset: Point) => void;
  reset: () => void;
}

const initialState = {
  imageDataUrl: null,
  imageWidth: 0,
  imageHeight: 0,
  captureUrl: '',
  activeTool: null as AnnotationTool | null,
  color: '#ff0000',
  lineWidth: 3,
  fontSize: 20,
  blurRadius: 10,
  annotations: [] as Annotation[],
  undoStack: [] as Annotation[][],
  redoStack: [] as Annotation[][],
  nextNumber: 1,
  isCropping: false,
  cropRect: null as { x: number; y: number; width: number; height: number } | null,
  exportFormat: 'png' as ExportFormat,
  exportQuality: 0.92,
  zoom: 1,
  panOffset: { x: 0, y: 0 },
};

export const useEditorStore = create<EditorState>((set, get) => ({
  ...initialState,

  setImage: (dataUrl, width, height) =>
    set({ imageDataUrl: dataUrl, imageWidth: width, imageHeight: height }),

  setCaptureUrl: (url) => set({ captureUrl: url }),

  setActiveTool: (tool) =>
    set({ activeTool: tool, isCropping: tool === 'crop' }),

  setColor: (color) => set({ color }),
  setLineWidth: (width) => set({ lineWidth: width }),
  setFontSize: (size) => set({ fontSize: size }),
  setBlurRadius: (radius) => set({ blurRadius: radius }),

  addAnnotation: (annotation) => {
    const state = get();
    const newUndoStack = [...state.undoStack, state.annotations];
    if (newUndoStack.length > MAX_STACK_SIZE) newUndoStack.shift();
    const newAnnotations = [...state.annotations, annotation];
    const nextNumber = annotation.tool === 'number' ? state.nextNumber + 1 : state.nextNumber;
    set({
      annotations: newAnnotations,
      undoStack: newUndoStack,
      redoStack: [],
      nextNumber,
    });
  },

  undo: () => {
    const state = get();
    if (state.undoStack.length === 0) return;
    const prev = state.undoStack[state.undoStack.length - 1];
    const newRedoStack = [...state.redoStack, state.annotations];
    if (newRedoStack.length > MAX_STACK_SIZE) newRedoStack.shift();
    set({
      redoStack: newRedoStack,
      annotations: prev,
      undoStack: state.undoStack.slice(0, -1),
    });
  },

  redo: () => {
    const state = get();
    if (state.redoStack.length === 0) return;
    const next = state.redoStack[state.redoStack.length - 1];
    const newUndoStack = [...state.undoStack, state.annotations];
    if (newUndoStack.length > MAX_STACK_SIZE) newUndoStack.shift();
    set({
      undoStack: newUndoStack,
      annotations: next,
      redoStack: state.redoStack.slice(0, -1),
    });
  },

  setCropRect: (rect) => set({ cropRect: rect }),

  applyCrop: () => {
    // Crop is applied at export time by rendering only the cropped region
    set({ isCropping: false, activeTool: null });
  },

  setExportFormat: (format) => set({ exportFormat: format }),
  setExportQuality: (quality) => set({ exportQuality: quality }),
  setZoom: (zoom) => set({ zoom: Math.max(0.01, Math.min(5, zoom)) }),
  setPanOffset: (offset) => set({ panOffset: offset }),
  setView: (zoom, offset) => set({ zoom: Math.max(0.01, Math.min(5, zoom)), panOffset: offset }),
  reset: () => set(initialState),
}));
