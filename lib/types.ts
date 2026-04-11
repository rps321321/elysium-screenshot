export type CaptureMode = 'visible' | 'fullpage' | 'region' | 'element' | 'delayed';

export type DelayDuration = 3 | 5 | 10;

export type ExportFormat = 'png' | 'jpg' | 'webp' | 'pdf';

export type AnnotationTool =
  | 'pen'
  | 'text'
  | 'arrow'
  | 'rect'
  | 'circle'
  | 'line'
  | 'blur'
  | 'highlight'
  | 'crop'
  | 'number'
  | 'eraser';

export interface Point {
  x: number;
  y: number;
}

export interface Annotation {
  id: string;
  tool: AnnotationTool;
  color: string;
  lineWidth: number;
  fontSize?: number;
  text?: string;
  points?: Point[];
  startPoint?: Point;
  endPoint?: Point;
  number?: number;
  blurRadius?: number;
  bounds?: { minX: number; minY: number; maxX: number; maxY: number };
  /** Cached eraser composite — avoids re-creating a scratch canvas every frame */
  scratchMask?: HTMLCanvasElement | OffscreenCanvas;
  /** Position offset for blitting the cached scratchMask onto the main canvas */
  scratchOffset?: { x: number; y: number };
}

export interface CaptureResult {
  dataUrl: string;
  width: number;
  height: number;
  timestamp: number;
  url: string;
  title: string;
  mode: CaptureMode;
  blobId?: string;
}

export interface ScreenshotHistoryItem {
  id: string;
  thumbnail: string;
  width: number;
  height: number;
  timestamp: number;
  url: string;
  title: string;
  mode: CaptureMode;
}

export type MessageType =
  | { type: 'CAPTURE_VISIBLE' }
  | { type: 'CAPTURE_FULLPAGE' }
  | { type: 'CAPTURE_REGION' }
  | { type: 'CAPTURE_ELEMENT' }
  | { type: 'CAPTURE_DELAYED'; delay: DelayDuration }
  | { type: 'START_REGION_SELECT' }
  | { type: 'START_ELEMENT_SELECT' }
  | { type: 'REGION_SELECTED'; rect: { x: number; y: number; width: number; height: number } }
  | { type: 'ELEMENT_SELECTED'; rect: { x: number; y: number; width: number; height: number } }
  | { type: 'SHOW_COUNTDOWN'; seconds: number }
  | { type: 'SCROLL_CAPTURE_STEP'; scrollY: number }
  | { type: 'GET_PAGE_DIMENSIONS' }
  | { type: 'HIDE_SCROLLBAR' }
  | { type: 'SHOW_SCROLLBAR' }
  | { type: 'PING' };
