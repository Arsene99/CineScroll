export type StudioMode = 'selection' | 'credits' | 'subtitles';

export type ScrollDirection = 'bottom-to-top' | 'top-to-bottom' | 'fade-in' | 'star-crawl';

export type TextAlignment = 'left' | 'center' | 'right';

export type AspectRatio = '9:16' | '16:9' | '1:1';

export type BackgroundSource = 'preset' | 'color' | 'gradient' | 'image' | 'video';

export interface GradientConfig {
  colors: string[]; // 2 or 3 hex colors
  angle: number; // 0 to 360 degrees
  animated: boolean;
  animationSpeed?: number; // 0.5 to 2.5 (default 1)
}

export interface BackgroundConfig {
  source: BackgroundSource;
  value: string; // url, hex color, or preset id
  gradient?: GradientConfig;
  overlayOpacity: number; // 0 to 1
  blur: number; // in pixels
  customFileName?: string;
}

export interface AudioConfig {
  presetId: string;
  customFileUrl?: string;
  customFileName?: string;
  customFileDuration?: number;
  volume: number;
  muted: boolean;
}

export interface CreditsConfig {
  text: string;
  fontFamily: string;
  fontSize: number; // base size
  color: string;
  textGradient?: GradientConfig;
  alignment: TextAlignment;
  direction: ScrollDirection;
  speedDuration: number; // total duration in seconds (e.g. 10s - 60s)
  lineSpacing: number; // multiplier e.g. 1.6
  roleSeparation: boolean; // format "ROLE : NAME" into 2 clean aligned columns
  textShadow: boolean;
  background: BackgroundConfig;
  audio: AudioConfig;
  aspectRatio: AspectRatio;
}

export interface SubtitleItem {
  id: string;
  startTime: number; // in seconds
  endTime: number; // in seconds
  text: string;
}

export interface SubtitlesConfig {
  subtitles: SubtitleItem[];
  fontFamily: string;
  fontSize: number;
  color: string;
  backgroundColor: string;
  background: BackgroundConfig;
  audio: AudioConfig;
  aspectRatio: AspectRatio;
}
