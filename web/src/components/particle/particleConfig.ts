export const colorOptions = [
  'blue',
  'violet',
  'gold',
  'cyan',
  'rose',
  'coral',
  'emerald',
  'ice'
] as const;

export type SceneColor = (typeof colorOptions)[number];

export const colorMap: Record<SceneColor, readonly [number, number, number]> = {
  blue: [166, 210, 255],
  violet: [214, 178, 255],
  gold: [255, 224, 166],
  cyan: [122, 238, 241],
  rose: [255, 159, 205],
  coral: [255, 157, 137],
  emerald: [126, 235, 177],
  ice: [224, 244, 255]
};

export const lyricFontOptions = [
  ['body', '跟随页面'],
  ['yahei', '微软雅黑'],
  ['pingfang', '苹方'],
  ['dengxian', '等线'],
  ['simhei', '黑体'],
  ['kaiti', '楷体'],
  ['xingkai', '华文行楷'],
  ['stkaiti', '华文楷体'],
  ['simsun', '宋体'],
  ['stsong', '华文宋体'],
  ['fangsong', '仿宋'],
  ['lishu', '隶书'],
  ['youyuan', '幼圆'],
  ['shuti', '方正舒体'],
  ['notoSans', '思源黑体'],
  ['notoSerif', '思源宋体']
] as const;

export type LyricFont = (typeof lyricFontOptions)[number][0];

export const shelfModeOptions = [
  ['off', '关闭'],
  ['side', '侧栏'],
  ['stage', '舞台']
] as const;

export const shelfCameraOptions = [
  ['dynamic', '动态镜头'],
  ['static', '静态镜头']
] as const;

export const shelfPresenceOptions = [
  ['always', '常驻'],
  ['auto', '自动隐藏']
] as const;

export const visualPresetOptions = [
  'galaxy',
  'topography',
  'peaks',
  'spectrum',
  'ring',
  'vinyl',
  'tunnel',
  'emily'
] as const;

export type VisualPreset = (typeof visualPresetOptions)[number];

export type ParticleStageFx = {
  intensity: number;
  depth: number;
  point: number;
  twist: number;
  colorBoost: number;
  scatter: number;
  bgFade: number;
  bloomStrength: number;
  cinemaShake: number;
  cameraDistance: number;
  lyricGlowStrength: number;
  lyricScale: number;
  lyricOffsetX: number;
  lyricOffsetY: number;
  lyricOffsetZ: number;
  lyricTiltX: number;
  lyricTiltY: number;
  lyricGlow: boolean;
  lyricGlowBeat: boolean;
  lyricGlowParticles: boolean;
  lyricCameraLock: boolean;
  particleLyrics: boolean;
  cinema: boolean;
  floatLayer: boolean;
  bloom: boolean;
  edge: boolean;
  shelfMode: 'off' | 'side' | 'stage';
  shelfCameraMode: 'dynamic' | 'static';
  shelfPresence: 'auto' | 'always';
  shelfSize: number;
  shelfOffsetX: number;
  shelfOffsetY: number;
  shelfOffsetZ: number;
  shelfAngleY: number;
  shelfOpacity: number;
  shelfBgOpacity: number;
};

export const createDefaultParticleStageFx = (): ParticleStageFx => ({
  intensity: 0.85,
  depth: 1,
  point: 1,
  twist: 0,
  colorBoost: 1.1,
  scatter: 0,
  bgFade: 0.2,
  bloomStrength: 0.62,
  cinemaShake: 0.5,
  cameraDistance: 1,
  lyricGlowStrength: 0.28,
  lyricScale: 0.7,
  lyricOffsetX: 0,
  lyricOffsetY: 0,
  lyricOffsetZ: 0,
  lyricTiltX: 0,
  lyricTiltY: 0,
  lyricGlow: true,
  lyricGlowBeat: true,
  lyricGlowParticles: true,
  lyricCameraLock: false,
  particleLyrics: true,
  cinema: true,
  floatLayer: true,
  bloom: false,
  edge: false,
  shelfMode: 'side',
  shelfCameraMode: 'dynamic',
  shelfPresence: 'always',
  shelfSize: 1,
  shelfOffsetX: 0,
  shelfOffsetY: 0,
  shelfOffsetZ: 0,
  shelfAngleY: -15,
  shelfOpacity: 1,
  shelfBgOpacity: 0.9
});

export type ParticleStageSettings = {
  visualPreset: VisualPreset;
  density: number;
  speed: number;
  color: SceneColor;
  lyricFont: LyricFont;
  fx: ParticleStageFx;
};

export const particlePresetSettings: Record<
  VisualPreset,
  { color: SceneColor; density: number; speed: number; shelfMode: ParticleStageFx['shelfMode'] }
> = {
  galaxy: { color: 'blue', density: 1, speed: 1, shelfMode: 'side' },
  topography: { color: 'violet', density: 1.25, speed: 0.75, shelfMode: 'stage' },
  peaks: { color: 'cyan', density: 1.35, speed: 0.82, shelfMode: 'side' },
  spectrum: { color: 'rose', density: 1.25, speed: 1, shelfMode: 'side' },
  ring: { color: 'emerald', density: 1.4, speed: 1.05, shelfMode: 'side' },
  vinyl: { color: 'gold', density: 0.7, speed: 0.45, shelfMode: 'side' },
  tunnel: { color: 'violet', density: 1.5, speed: 0.65, shelfMode: 'stage' },
  emily: { color: 'blue', density: 1.55, speed: 0.8, shelfMode: 'side' }
};

export function getParticlePresetIndex(preset: VisualPreset) {
  return visualPresetOptions.indexOf(preset) < 2
    ? visualPresetOptions.indexOf(preset)
    : ({ vinyl: 2, tunnel: 3, emily: 4, peaks: 5, spectrum: 6, ring: 7 } as Partial<Record<VisualPreset, number>>)[preset] ?? 0;
}

export function getCameraPreset(preset: VisualPreset) {
  return ({
    emily: { radius: 6.6, phi: 0.08, theta: 0 },
    tunnel: { radius: 6.2, phi: 0.03, theta: 0 },
    vinyl: { radius: 6.5, phi: 0.04, theta: 0 },
    peaks: { radius: 8.2, phi: 0.32, theta: -0.18 },
    spectrum: { radius: 7.4, phi: 0.12, theta: -0.08 },
    ring: { radius: 7.2, phi: 0.05, theta: 0 },
    galaxy: { radius: 9.4, phi: 0.34, theta: -0.52 },
    topography: { radius: 9.4, phi: 0.34, theta: -0.52 }
  } as const)[preset];
}

export function getViewPreset(preset: VisualPreset) {
  const cameraPreset = getCameraPreset(preset);
  return ({
    galaxy: { position: [-0.2765, 0.2242, 0.0803], rotation: [0, 0], radius: 7.1, zoomOverride: true },
    topography: { position: [-0.0038, 0.513, 0.1067], rotation: [0, 0], radius: 9.4, zoomOverride: false },
    peaks: { position: [0, 0.12, 0], rotation: [-0.04, 0], radius: cameraPreset.radius, zoomOverride: false },
    spectrum: { position: [0, 0.18, 0], rotation: [0, 0], radius: cameraPreset.radius, zoomOverride: false },
    ring: { position: [0, 0.08, 0], rotation: [0, 0], radius: cameraPreset.radius, zoomOverride: false },
    emily: { position: [-1.3865, 0.3296, 0.3972], rotation: [0.017, 0.2109], radius: 6.6, zoomOverride: false },
    vinyl: { position: [0, 0, 0], rotation: [0, 0], radius: cameraPreset.radius, zoomOverride: false },
    tunnel: { position: [0, 0, 0], rotation: [0, 0], radius: cameraPreset.radius, zoomOverride: false }
  } as const)[preset];
}
