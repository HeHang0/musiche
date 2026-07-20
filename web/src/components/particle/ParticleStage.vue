<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import * as THREE from 'three';
import { DeleteFilled, Upload } from '@element-plus/icons-vue';
import type { RoomChatMessage, RoomSnapshot } from '../../utils/room';
import { LogoImage } from '../../utils/logo';
import { parseHttpProxyAddress } from '../../utils/http';
import { StorageKey, storage } from '../../utils/storage';
import ParticleVisualConsole from './ParticleVisualConsole.vue';
import {
  PARTICLE_FRAGMENT_SHADER,
  PARTICLE_VERTEX_SHADER
} from './particleShaders';
import {
  colorMap,
  colorOptions,
  createDefaultParticleStageFx,
  getCameraPreset as resolveCameraPreset,
  getParticlePresetIndex as resolveParticlePresetIndex,
  getViewPreset as resolveViewPreset,
  lyricFontOptions,
  particlePresetSettings,
  shelfCameraOptions,
  shelfModeOptions,
  shelfPresenceOptions,
  visualPresetOptions
} from './particleConfig';
import type {
  LyricFont,
  ParticleStageFx,
  ParticleStageSettings,
  SceneColor,
  VisualPreset
} from './particleConfig';
import { createParticleGeometry as buildParticleGeometry } from './particleGeometry';

type RoomCurrent = RoomSnapshot['state']['current'];

const props = withDefaults(
  defineProps<{
    snapshot: RoomSnapshot;
    current: RoomCurrent | null;
    lyric: string;
    lyricsText: string;
    position: number;
    duration: number;
    volume: number;
    playing: boolean;
    audio?: HTMLAudioElement | null;
    chatMessages: RoomChatMessage[];
    currentAvatar?: string;
    avatarResolver?: (memberId: string, avatar?: string) => string;
    songPickerOpen?: boolean;
    embedded?: boolean;
    showCards?: boolean;
    controlsVisible?: boolean;
  }>(),
  {
    embedded: false,
    showCards: true,
    controlsVisible: true
  }
);

const emit = defineEmits<{
  close: [];
  share: [];
  togglePlay: [];
  next: [];
  toggleRandom: [];
  seek: [position: number];
  setVolume: [volume: number];
  resume: [];
  removeQueue: [id: string];
  pinQueue: [id: string];
  addQueue: [music: RoomSnapshot['state']['queue'][number]['music']];
  patMember: [memberId: string];
  editProfile: [];
  requestSong: [];
  sendChat: [text: string, image?: string, avatar?: string];
}>();

const canvas = ref<HTMLCanvasElement | null>(null);
const activePanel = ref<'queue' | 'chat' | null>(null);
const settingsOpen = ref(false);
const floatingControlsVisible = ref(true);
const floatingControlsHidden = computed(() =>
  props.embedded ? !props.controlsVisible : !floatingControlsVisible.value
);
const debugCopyStatus = ref('');
const showDebugTools = import.meta.env.DEV;
const settingsTab = ref<
  'preset' | 'appearance' | 'lyrics' | 'motion' | 'advanced'
>('preset');
const chatDraft = ref('');
const queuePanel = ref<'queue' | 'history'>('queue');
const chatList = ref<HTMLElement | null>(null);
const unreadChatCount = ref(0);
const chatAtBottom = ref(true);
const emojiOpen = ref(false);
const emojiList = [
  '😀',
  '😃',
  '😄',
  '😁',
  '😆',
  '😅',
  '😂',
  '🤣',
  '😊',
  '🙂',
  '🙃',
  '😉',
  '😍',
  '🥰',
  '😘',
  '😎',
  '🤩',
  '🥳',
  '🤔',
  '🤗',
  '😴',
  '😋',
  '😭',
  '😡',
  '👍',
  '👏',
  '🎉',
  '❤️',
  '🎵',
  '🌟'
];
const density = ref(1);
const speed = ref(1);
const color = ref<SceneColor>('blue');
const lyricFont = ref<LyricFont>('body');
const visualPreset = ref<VisualPreset>('galaxy');
const shelfCenter = ref(0);
const fx = ref<ParticleStageFx>(createDefaultParticleStageFx());
const getParticlePresetIndex = (preset = visualPreset.value) =>
  resolveParticlePresetIndex(preset);
const getCameraPreset = (preset = visualPreset.value) =>
  resolveCameraPreset(preset);
const getViewPreset = (preset = visualPreset.value) =>
  resolveViewPreset(preset);
let settingsRestored = false;
let saveSettingsTimer: number | null = null;
const pointer = ref({ active: false, x: 0, y: 0 });
const pointerMode = ref<'rotate' | 'pan' | 'control' | null>(null);
const pointerStart = { x: 0, y: 0 };
const scenePointer = new THREE.Vector2(2, 2);
const raycaster = new THREE.Raycaster();
const gestureRotation = { x: 0, y: 0 };
const particleSpin = { vx: 0, vy: 0 };
const stagePan = new THREE.Vector3();
const stagePanTarget = new THREE.Vector3();
const panRight = new THREE.Vector3();
const panUp = new THREE.Vector3();
let pointerLastTime = 0;
let previousFrameTime = 0;
let cameraRadius = 9.4;
let targetCameraRadius = 9.4;
let cameraZoomOverride = false;
let cameraTheta = -0.52;
let cameraPhi = 0.34;
const cameraLookAt = new THREE.Vector3();
let hoveredCardIndex = -1;
type CardHoverAction =
  | 'play'
  | 'next'
  | 'random'
  | 'resume'
  | 'seek'
  | 'volume'
  | null;
let hoveredCardAction: CardHoverAction = null;
let pointerCardAction: CardHoverAction = null;
let shelfCenterSmooth = 0;
const audioBands = {
  bass: 0,
  mid: 0,
  treble: 0,
  energy: 0,
  beat: 0,
  previousBass: 0
};
const spectrumBands = new Float32Array(32);
let frame = 0;
let floatingControlsTimer: number | null = null;
let floatingDropdownOpen = false;
let resizeObserver: ResizeObserver | null = null;
let renderer: THREE.WebGLRenderer | null = null;
let particleRenderedFrames = 0;
let particleLastFrameAt = 0;
let particleLastErrorAt = 0;
let webglContextLost = false;
let webglContextLostHandler: ((event: Event) => void) | null = null;
let webglContextRestoredHandler: (() => void) | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let stageRoot: THREE.Group | null = null;
let particleCloud: THREE.Points | null = null;
let particlePreset = '';
let particleCoverTexture: THREE.Texture | null = null;
let particleCoverLoadToken = 0;
let lyricMesh: THREE.Mesh | null = null;
let lyricRenderToken = 0;
let renderedLyricText = '';
let sceneFontLoadKey = '';
let sceneFontLoadPromise: Promise<void> = Promise.resolve();
let lyricParticleTransition: {
  points: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  from: Float32Array;
  to: Float32Array;
  scatter: Float32Array;
  startedAt: number;
  duration: number;
} | null = null;
let cardGroup: THREE.Group | null = null;

type ParticleAudioElement = HTMLAudioElement & {
  captureStream?: () => MediaStream;
  __particleStageAnalyser?: {
    context: AudioContext;
    analyser: AnalyserNode;
    data: Uint8Array<ArrayBuffer>;
    safeCapture?: boolean;
  };
};

async function ensureAudioAnalyser() {
  const audio = props.audio as ParticleAudioElement | null | undefined;
  if (!audio) return;
  if (!audio.__particleStageAnalyser) {
    if (!audio.captureStream) return;
    try {
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.76;
      const source = context.createMediaStreamSource(audio.captureStream());
      const silentOutput = context.createGain();
      silentOutput.gain.value = 0;
      source.connect(analyser);
      analyser.connect(silentOutput);
      silentOutput.connect(context.destination);
      audio.__particleStageAnalyser = {
        context,
        analyser,
        data: new Uint8Array(analyser.frequencyBinCount),
        safeCapture: true
      };
    } catch (error) {
      console.warn('[沉浸模式] 无法接入音频频谱，使用播放状态律动', error);
      return;
    }
  }
  if (audio.__particleStageAnalyser.context.state === 'suspended') {
    await audio.__particleStageAnalyser.context.resume().catch(() => undefined);
  }
}

function readAudioBands(time: number) {
  const audio = props.audio as ParticleAudioElement | null | undefined;
  const state = audio?.__particleStageAnalyser;
  let bass = 0;
  let mid = 0;
  let treble = 0;
  const followSpectrum = (index: number, target: number) => {
    const current = spectrumBands[index];
    spectrumBands[index] =
      current + (target - current) * (target > current ? 0.62 : 0.3);
  };
  if (state?.context.state === 'running') {
    state.analyser.getByteFrequencyData(state.data);
    const frequencyBin = (frequency: number) =>
      Math.max(
        1,
        Math.round(
          (frequency * state.analyser.fftSize) / state.context.sampleRate
        )
      );
    const rms = (fromFrequency: number, toFrequency: number) => {
      const from = frequencyBin(fromFrequency);
      const to = frequencyBin(toFrequency);
      let sumSquares = 0;
      const end = Math.min(state.data.length, to);
      for (let index = from; index < end; index++) {
        const value = state.data[index] / 255;
        sumSquares += value * value;
      }
      return end > from ? Math.sqrt(sumSquares / (end - from)) : 0;
    };
    const enhance = (value: number, gain: number) =>
      THREE.MathUtils.clamp(
        1 - Math.exp(-Math.max(0, value - 0.018) * gain),
        0,
        1
      );
    bass = enhance(rms(35, 220), 3.5);
    mid = enhance(rms(220, 2500), 3.8);
    treble = enhance(rms(2500, 10000), 4.2);
    const minFrequency = 35;
    const maxFrequency = Math.min(14_000, state.context.sampleRate * 0.46);
    const frequencyRatio = maxFrequency / minFrequency;
    for (let band = 0; band < spectrumBands.length; band++) {
      const from = minFrequency * Math.pow(frequencyRatio, band / 32);
      const to = minFrequency * Math.pow(frequencyRatio, (band + 1) / 32);
      const raw = enhance(rms(from, to), 5.2);
      const lowFrequencyBoost = 1.18 - (band / 31) * 0.22;
      followSpectrum(
        band,
        THREE.MathUtils.clamp(raw * lowFrequencyBoost, 0, 1)
      );
    }
  } else if (props.playing) {
    bass = 0.24 + Math.sin(time * 0.0042) * 0.07;
    mid = 0.18 + Math.sin(time * 0.0027 + 1.4) * 0.05;
    treble = 0.12 + Math.sin(time * 0.0061 + 0.7) * 0.04;
    for (let band = 0; band < spectrumBands.length; band++) {
      const frequencyWeight = 1 - band / spectrumBands.length;
      const pulse =
        0.12 +
        frequencyWeight * bass * 0.72 +
        Math.max(0, Math.sin(time * (0.004 + band * 0.00013) + band * 0.7)) *
          mid *
          0.55;
      followSpectrum(band, pulse);
    }
  } else {
    for (let band = 0; band < spectrumBands.length; band++)
      followSpectrum(band, 0);
  }
  const follow = (
    current: number,
    target: number,
    attack = 0.24,
    release = 0.075
  ) => current + (target - current) * (target > current ? attack : release);
  audioBands.bass = follow(audioBands.bass, bass, 0.34, 0.09);
  audioBands.mid = follow(audioBands.mid, mid, 0.28, 0.075);
  audioBands.treble = follow(audioBands.treble, treble, 0.3, 0.08);
  const energy = bass * 0.48 + mid * 0.34 + treble * 0.18;
  audioBands.energy = follow(audioBands.energy, energy, 0.3, 0.07);
  const onset = Math.max(0, bass - audioBands.previousBass);
  audioBands.beat = Math.max(
    audioBands.beat * 0.88,
    onset > 0.032 ? Math.min(1, onset * 11) : 0
  );
  audioBands.previousBass = bass;
}

// 对齐源 GalaxyParticles：FLOAT_COUNT 1300 + BACK_COVER_COUNT 3000。
const particleCount = computed(() => Math.round(4300 * density.value));
const coverGridSize = computed(() => {
  let size = THREE.MathUtils.clamp(Math.round(118 * density.value), 88, 183);
  if (size % 2 === 0) size += size < 183 ? 1 : -1;
  return size;
});
const activeParticleCount = computed(() =>
  visualPreset.value === 'emily'
    ? coverGridSize.value * coverGridSize.value
    : particleCount.value
);
const percent = computed(() =>
  props.duration
    ? Math.min(100, Math.max(0, (props.position / props.duration) * 100))
    : 0
);
const isAdmin = computed(() => Boolean(props.snapshot.isAdmin));

function selectPreset(preset: VisualPreset) {
  visualPreset.value = preset;
  const presets = particlePresetSettings[preset];
  color.value = presets.color;
  density.value = presets.density;
  speed.value = presets.speed;
  fx.value.shelfMode = presets.shelfMode;
  recenterStage();
  rebuildParticleGeometry();
  if (preset === 'emily') loadParticleCover();
}

function createParticleGeometry() {
  return buildParticleGeometry(
    visualPreset.value,
    activeParticleCount.value,
    coverGridSize.value
  );
}
function resolveCoverUrl(source: string) {
  try {
    const url = new URL(source, location.href);
    return url.origin === location.origin
      ? url.href
      : parseHttpProxyAddress(source);
  } catch {
    return source;
  }
}

function loadParticleCover() {
  const material = particleCloud?.material as THREE.ShaderMaterial | undefined;
  if (!material) return;
  const source =
    props.current?.music.largeImage ||
    props.current?.music.mediumImage ||
    props.current?.music.image ||
    '';
  const loadToken = ++particleCoverLoadToken;
  material.uniforms.uHasCover.value = 0;
  if (!source) return;
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.onload = () => {
    if (loadToken !== particleCoverLoadToken) return;
    const size = 512;
    const coverCanvas = document.createElement('canvas');
    coverCanvas.width = size;
    coverCanvas.height = size;
    const context = coverCanvas.getContext('2d');
    if (!context) return;
    const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
    context.drawImage(
      image,
      (image.naturalWidth - sourceSize) / 2,
      (image.naturalHeight - sourceSize) / 2,
      sourceSize,
      sourceSize,
      0,
      0,
      size,
      size
    );
    const texture = new THREE.CanvasTexture(coverCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    particleCoverTexture?.dispose();
    particleCoverTexture = texture;
    material.uniforms.uCoverTex.value = texture;
    material.uniforms.uHasCover.value = 1;
  };
  image.onerror = () => {
    if (loadToken === particleCoverLoadToken)
      material.uniforms.uHasCover.value = 0;
  };
  image.src = resolveCoverUrl(source);
}

function rebuildParticleGeometry() {
  if (!particleCloud) return;
  const nextGeometry = createParticleGeometry();
  particleCloud.geometry.dispose();
  particleCloud.geometry = nextGeometry;
  particlePreset = visualPreset.value;
}

function sendChat() {
  const text = chatDraft.value.trim();
  if (!text) return;
  emit('sendChat', text, '', props.currentAvatar || '');
  chatDraft.value = '';
}

function formatChatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return [date.getHours(), date.getMinutes()]
    .map(item => String(item).padStart(2, '0'))
    .join(':');
}

function chatMemberId(memberId: string) {
  return String(memberId || '')
    .slice(-4)
    .toUpperCase();
}

function chatAvatar(message: RoomChatMessage) {
  return props.avatarResolver?.(message.memberId, message.avatar) || LogoImage;
}

function scrollChatToBottom(smooth = false) {
  nextTick(() => {
    const element = chatList.value;
    if (!element) return;
    element.scrollTo({
      top: element.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto'
    });
    chatAtBottom.value = true;
    unreadChatCount.value = 0;
  });
}

function updateChatScroll() {
  const element = chatList.value;
  if (!element) return;
  chatAtBottom.value =
    element.scrollHeight - element.clientHeight - element.scrollTop <= 48;
  if (chatAtBottom.value) unreadChatCount.value = 0;
}

function insertEmoji(emoji: string) {
  chatDraft.value += emoji;
  emojiOpen.value = false;
}

function resizeChatImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectURL = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      try {
        const scale = Math.min(
          1,
          200 / Math.max(image.naturalWidth, image.naturalHeight)
        );
        const output = document.createElement('canvas');
        output.width = Math.max(1, Math.round(image.naturalWidth * scale));
        output.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = output.getContext('2d');
        if (!context) throw new Error('无法处理图片');
        context.drawImage(image, 0, 0, output.width, output.height);
        resolve(output.toDataURL('image/webp', 0.82));
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(objectURL);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectURL);
      reject(new Error('无法读取图片'));
    };
    image.src = objectURL;
  });
}

async function handleChatPaste(event: ClipboardEvent) {
  const file = Array.from(event.clipboardData?.items || [])
    .find(item => item.kind === 'file' && item.type.startsWith('image/'))
    ?.getAsFile();
  if (!file) return;
  event.preventDefault();
  const image = await resizeChatImage(file).catch(() => '');
  if (image) emit('sendChat', '', image, props.currentAvatar || '');
}

function openPanel(panel: 'queue' | 'chat') {
  settingsOpen.value = false;
  activePanel.value = panel;
  if (panel === 'chat') scrollChatToBottom();
}
function togglePanel(panel: 'queue' | 'chat') {
  if (activePanel.value === panel) activePanel.value = null;
  else openPanel(panel);
}

function openSongPicker() {
  settingsOpen.value = false;
  activePanel.value = null;
  emit('requestSong');
}

watch(
  () => props.chatMessages.length,
  (length, previous = 0) => {
    if (length <= previous) return;
    if (activePanel.value === 'chat' && chatAtBottom.value)
      scrollChatToBottom();
    else unreadChatCount.value += length - previous;
  }
);

function getCurrentCardPoint(
  clientX: number,
  clientY: number,
  element: HTMLElement
) {
  if (!camera || !stageRoot || !cardGroup?.visible) return null;
  const bounds = element.getBoundingClientRect();
  scenePointer.set(
    ((clientX - bounds.left) / Math.max(1, bounds.width)) * 2 - 1,
    -((clientY - bounds.top) / Math.max(1, bounds.height)) * 2 + 1
  );
  stageRoot.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  raycaster.setFromCamera(scenePointer, camera);
  const hit = raycaster
    .intersectObjects(
      cardGroup.children.filter(child => child.visible),
      false
    )
    .sort(
      (a, b) => (b.object.renderOrder || 0) - (a.object.renderOrder || 0)
    )[0];
  if (!hit?.uv || Number(hit.object.userData.cardIndex ?? -1) !== 0)
    return null;
  return { x: hit.uv.x * 720, y: (1 - hit.uv.y) * 360 };
}

function updateCardRangeAction(action: 'seek' | 'volume', x: number) {
  if (action === 'seek' && props.duration > 0)
    emit('seek', THREE.MathUtils.clamp((x - 362) / 300, 0, 1) * props.duration);
  else if (action === 'volume')
    emit('setVolume', THREE.MathUtils.clamp((x - 622) / 46, 0, 1) * 100);
}

function hideFloatingControls() {
  if (floatingDropdownOpen) return;
  if (floatingControlsTimer !== null) {
    window.clearTimeout(floatingControlsTimer);
    floatingControlsTimer = null;
  }
  floatingControlsVisible.value = false;
}

function showFloatingControls() {
  floatingControlsVisible.value = true;
  if (floatingControlsTimer !== null)
    window.clearTimeout(floatingControlsTimer);
  if (floatingDropdownOpen) {
    floatingControlsTimer = null;
    return;
  }
  floatingControlsTimer = window.setTimeout(() => {
    floatingControlsTimer = null;
    floatingControlsVisible.value = false;
  }, 10_000);
}

function onFloatingDropdownVisible(visible: boolean) {
  floatingDropdownOpen = visible;
  showFloatingControls();
}

function dropdownLabel(
  options: readonly (readonly [string, string])[],
  value: string
) {
  return options.find(option => option[0] === value)?.[1] || value;
}

function selectLyricFont(command: string | number | object) {
  lyricFont.value = String(command) as LyricFont;
}

function selectShelfMode(command: string | number | object) {
  fx.value.shelfMode = String(command) as 'off' | 'side' | 'stage';
}

function selectShelfCameraMode(command: string | number | object) {
  fx.value.shelfCameraMode = String(command) as 'dynamic' | 'static';
}

function selectShelfPresence(command: string | number | object) {
  fx.value.shelfPresence = String(command) as 'auto' | 'always';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function restoreFxSettings(savedFx: unknown) {
  if (!savedFx || typeof savedFx !== 'object') return;
  const source = savedFx as Partial<ParticleStageFx>;
  const restored: Partial<ParticleStageFx> = {};
  for (const key of Object.keys(fx.value) as (keyof ParticleStageFx)[]) {
    const savedValue = source[key];
    const defaultValue = fx.value[key];
    if (
      typeof savedValue === typeof defaultValue &&
      (typeof savedValue !== 'number' || Number.isFinite(savedValue))
    )
      Object.assign(restored, { [key]: savedValue });
  }
  Object.assign(fx.value, restored);
}

async function restoreParticleSettings() {
  const saved = await storage.getValue<Partial<ParticleStageSettings> | null>(
    StorageKey.ParticleStageSettings,
    null
  );
  if (!saved || typeof saved !== 'object') {
    settingsRestored = true;
    return;
  }
  if (visualPresetOptions.includes(saved.visualPreset as VisualPreset))
    visualPreset.value = saved.visualPreset as VisualPreset;
  if (colorOptions.includes(saved.color as SceneColor))
    color.value = saved.color as SceneColor;
  if (lyricFontOptions.some(option => option[0] === saved.lyricFont))
    lyricFont.value = saved.lyricFont as LyricFont;
  if (isFiniteNumber(saved.density)) density.value = saved.density;
  if (isFiniteNumber(saved.speed)) speed.value = saved.speed;
  restoreFxSettings(saved.fx);
  settingsRestored = true;
}

function saveParticleSettings() {
  if (!settingsRestored) return;
  if (saveSettingsTimer !== null) window.clearTimeout(saveSettingsTimer);
  saveSettingsTimer = window.setTimeout(() => {
    saveSettingsTimer = null;
    persistParticleSettings();
  }, 180);
}

function persistParticleSettings() {
  const value: ParticleStageSettings = {
    visualPreset: visualPreset.value,
    density: density.value,
    speed: speed.value,
    color: color.value,
    lyricFont: lyricFont.value,
    fx: { ...fx.value }
  };
  void storage.setValue(StorageKey.ParticleStageSettings, value);
}

function onPointerDown(event: PointerEvent) {
  showFloatingControls();
  if (event.button !== 0 && event.button !== 1) return;
  if (event.button === 1) event.preventDefault();
  const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
  scenePointer.set(
    ((event.clientX - bounds.left) / Math.max(1, bounds.width)) * 2 - 1,
    -((event.clientY - bounds.top) / Math.max(1, bounds.height)) * 2 + 1
  );
  void ensureAudioAnalyser();
  pointer.value = { active: true, x: event.clientX, y: event.clientY };
  const cardPoint =
    event.button === 0
      ? getCurrentCardPoint(
          event.clientX,
          event.clientY,
          event.currentTarget as HTMLElement
        )
      : null;
  pointerCardAction = cardPoint
    ? getCardActionAt(cardPoint.x, cardPoint.y)
    : null;
  pointerMode.value =
    pointerCardAction === 'seek' || pointerCardAction === 'volume'
      ? 'control'
      : event.button === 1
        ? 'pan'
        : 'rotate';
  if (
    cardPoint &&
    (pointerCardAction === 'seek' || pointerCardAction === 'volume')
  )
    updateCardRangeAction(pointerCardAction, cardPoint.x);
  pointerStart.x = event.clientX;
  pointerStart.y = event.clientY;
  pointerLastTime = performance.now();
  particleSpin.vx = 0;
  particleSpin.vy = 0;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}
function onPointerMove(event: PointerEvent) {
  showFloatingControls();
  const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
  scenePointer.set(
    ((event.clientX - bounds.left) / Math.max(1, bounds.width)) * 2 - 1,
    -((event.clientY - bounds.top) / Math.max(1, bounds.height)) * 2 + 1
  );
  if (!pointer.value.active) return;
  const dx = event.clientX - pointer.value.x;
  const dy = event.clientY - pointer.value.y;
  const now = performance.now();
  const dt = Math.max(
    1 / 120,
    Math.min(0.08, (now - pointerLastTime) / 1000 || 1 / 60)
  );
  if (
    pointerMode.value === 'control' &&
    (pointerCardAction === 'seek' || pointerCardAction === 'volume')
  ) {
    const cardPoint = getCurrentCardPoint(
      event.clientX,
      event.clientY,
      event.currentTarget as HTMLElement
    );
    if (cardPoint) updateCardRangeAction(pointerCardAction, cardPoint.x);
    pointer.value.x = event.clientX;
    pointer.value.y = event.clientY;
    return;
  }
  if (pointerMode.value === 'pan' && camera) {
    camera.updateMatrixWorld(true);
    const worldPerPixel =
      (2 *
        cameraRadius *
        Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5))) /
      Math.max(1, bounds.height);
    panRight.setFromMatrixColumn(camera.matrixWorld, 0);
    panUp.setFromMatrixColumn(camera.matrixWorld, 1);
    stagePanTarget.addScaledVector(panRight, dx * worldPerPixel);
    stagePanTarget.addScaledVector(panUp, -dy * worldPerPixel);
    if (stagePanTarget.length() > 4.5) stagePanTarget.setLength(4.5);
    pointer.value.x = event.clientX;
    pointer.value.y = event.clientY;
    pointerLastTime = now;
    return;
  }
  const rx = dy * 0.0032;
  const ry = dx * 0.0034;
  gestureRotation.x += rx;
  gestureRotation.y += ry;
  particleSpin.vx = THREE.MathUtils.clamp((rx / dt) * 0.46, -6.2, 6.2);
  particleSpin.vy = THREE.MathUtils.clamp((ry / dt) * 0.46, -6.2, 6.2);
  pointer.value.x = event.clientX;
  pointer.value.y = event.clientY;
  pointerLastTime = now;
}
function onPointerUp(event: PointerEvent) {
  const wasClick =
    pointer.value.active &&
    Math.hypot(
      event.clientX - pointerStart.x,
      event.clientY - pointerStart.y
    ) <= 6;
  const wasPrimaryClick = pointerMode.value === 'rotate' && wasClick;
  pointer.value.active = false;
  pointerMode.value = null;
  pointerCardAction = null;
  if (wasPrimaryClick) handleCardClick(event);
}
function onPointerCancel() {
  pointer.value.active = false;
  pointerMode.value = null;
  pointerCardAction = null;
}
function onWheel(event: WheelEvent) {
  if (!cameraZoomOverride)
    targetCameraRadius = cameraRadius / Math.max(0.1, fx.value.cameraDistance);
  cameraZoomOverride = true;
  targetCameraRadius = THREE.MathUtils.clamp(
    targetCameraRadius + event.deltaY * 0.005,
    3.2,
    14
  );
}

function getCardActionAt(x: number, y: number): CardHoverAction {
  if (y >= 302 && y <= 342 && x >= 350 && x <= 690)
    return isAdmin.value ? 'seek' : null;
  if (y >= 246 && y <= 302 && x >= 594 && x <= 680) return 'volume';
  if (y < 246 || y > 302) return null;
  if (!isAdmin.value) return x >= 362 && x <= 486 ? 'resume' : null;
  if (x >= 362 && x <= 434) return 'play';
  if (x >= 444 && x <= 506) return 'next';
  if (x >= 516 && x <= 590) return 'random';
  return null;
}

function handleCardClick(event: PointerEvent) {
  if (!camera || !stageRoot || !cardGroup?.visible) return;
  const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
  scenePointer.set(
    ((event.clientX - bounds.left) / Math.max(1, bounds.width)) * 2 - 1,
    -((event.clientY - bounds.top) / Math.max(1, bounds.height)) * 2 + 1
  );
  stageRoot.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  raycaster.setFromCamera(scenePointer, camera);
  const hits = raycaster
    .intersectObjects(
      cardGroup.children.filter(child => child.visible),
      false
    )
    .sort((a, b) => (b.object.renderOrder || 0) - (a.object.renderOrder || 0));
  const hit = hits[0];
  if (!hit) return;
  const index = Number(hit.object.userData.cardIndex ?? -1);
  if (index !== 0) {
    shelfCenter.value = Math.max(0, index);
    return;
  }
  if (!hit.uv) return;
  const x = hit.uv.x * 720;
  const y = (1 - hit.uv.y) * 360;
  const action = getCardActionAt(x, y);
  if (action === 'seek' && props.duration > 0) {
    emit('seek', THREE.MathUtils.clamp((x - 362) / 300, 0, 1) * props.duration);
    return;
  }
  if (action === 'resume') emit('resume');
  else if (action === 'play') emit('togglePlay');
  else if (action === 'next') emit('next');
  else if (action === 'random') emit('toggleRandom');
}
function recenterStage(immediate: boolean | Event = false) {
  const applyImmediately = immediate === true;
  const viewPreset = getViewPreset();
  gestureRotation.x = viewPreset.rotation[0];
  gestureRotation.y = viewPreset.rotation[1];
  particleSpin.vx = 0;
  particleSpin.vy = 0;
  stagePanTarget.set(
    viewPreset.position[0],
    viewPreset.position[1],
    viewPreset.position[2]
  );
  shelfCenter.value = 0;
  cameraZoomOverride = viewPreset.zoomOverride;
  const cameraPreset = getCameraPreset();
  targetCameraRadius = viewPreset.radius;
  if (applyImmediately) {
    stagePan.copy(stagePanTarget);
    stageRoot?.position.copy(stagePanTarget);
    if (stageRoot) {
      stageRoot.rotation.x = gestureRotation.x;
      stageRoot.rotation.y = gestureRotation.y;
    }
    cameraRadius = viewPreset.radius;
    cameraTheta = cameraPreset.theta;
    cameraPhi = cameraPreset.phi;
  }
}

function rounded(value: number) {
  return Number(value.toFixed(4));
}

async function copyCurrentViewDebug() {
  const payload = {
    preset: visualPreset.value,
    stage: {
      position: {
        x: rounded(stagePanTarget.x),
        y: rounded(stagePanTarget.y),
        z: rounded(stagePanTarget.z)
      },
      rotation: {
        x: rounded(gestureRotation.x),
        y: rounded(gestureRotation.y),
        z: rounded(stageRoot?.rotation.z || 0)
      }
    },
    camera: {
      radius: rounded(targetCameraRadius),
      currentRadius: rounded(cameraRadius),
      theta: rounded(cameraTheta),
      phi: rounded(cameraPhi),
      zoomOverride: cameraZoomOverride,
      distanceScale: rounded(fx.value.cameraDistance)
    },
    particles: {
      scale: rounded(particleCloud?.scale.x || 1),
      depth: rounded(fx.value.depth)
    },
    lyric: {
      offsetX: rounded(fx.value.lyricOffsetX),
      offsetY: rounded(fx.value.lyricOffsetY),
      offsetZ: rounded(fx.value.lyricOffsetZ),
      scale: rounded(fx.value.lyricScale),
      tiltX: rounded(fx.value.lyricTiltX),
      tiltY: rounded(fx.value.lyricTiltY)
    }
  };
  const output = JSON.stringify(payload, null, 2);
  console.info('[沉浸模式视角参数]\n' + output);
  try {
    await navigator.clipboard.writeText(output);
    debugCopyStatus.value = '已复制';
  } catch {
    debugCopyStatus.value = '已打印';
  }
  window.setTimeout(() => (debugCopyStatus.value = ''), 1800);
}

function getBodyFontFamily() {
  return window.getComputedStyle(document.body).fontFamily || 'sans-serif';
}

function getLyricFontFamily() {
  if (lyricFont.value === 'body') return getBodyFontFamily();
  return {
    yahei: '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif',
    pingfang: '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif',
    dengxian: '"DengXian", "Microsoft YaHei", "Noto Sans SC", sans-serif',
    simhei: '"SimHei", "Heiti SC", "Noto Sans SC", sans-serif',
    kaiti: '"KaiTi", "STKaiti", "Kaiti SC", serif',
    xingkai: '"STXingkai", "华文行楷", "KaiTi", "STKaiti", cursive',
    stkaiti: '"STKaiti", "华文楷体", "KaiTi", "Kaiti SC", serif',
    simsun: '"SimSun", "Songti SC", "Noto Serif CJK SC", serif',
    stsong: '"STSong", "华文宋体", "SimSun", "Songti SC", serif',
    fangsong: '"FangSong", "STFangsong", "FangSong SC", serif',
    lishu: '"LiSu", "隶书", "STLiti", serif',
    youyuan: '"YouYuan", "幼圆", "Yuanti SC", sans-serif',
    shuti: '"FZShuTi", "方正舒体", "STXingkai", cursive',
    notoSans: '"Noto Sans SC", "Source Han Sans SC", sans-serif',
    notoSerif: '"Noto Serif SC", "Source Han Serif SC", serif'
  }[lyricFont.value];
}

async function ensureGoogleFontStylesheetReady() {
  const stylesheet = document.querySelector<HTMLLinkElement>(
    'link[href*="fonts.googleapis.com"][href*="Zen+Maru+Gothic"]'
  );
  if (!stylesheet || stylesheet.sheet) return;
  await new Promise<void>(resolve => {
    let timeout = 0;
    const finish = () => {
      window.clearTimeout(timeout);
      stylesheet.removeEventListener('load', finish);
      stylesheet.removeEventListener('error', finish);
      resolve();
    };
    stylesheet.addEventListener('load', finish, { once: true });
    stylesheet.addEventListener('error', finish, { once: true });
    timeout = window.setTimeout(finish, 5000);
    if (stylesheet.sheet) finish();
  });
}

async function ensureLyricFontLoaded(text: string) {
  if (!text.trim() || !document.fonts) return;
  if (lyricFont.value === 'body') await ensureGoogleFontStylesheetReady();
  const fontFamily = getLyricFontFamily();
  const characters = Array.from(new Set(Array.from(text))).join('');
  const fonts = [400, 500, 600, 700].map(weight =>
    document.fonts.load(`${weight} 80px ${fontFamily}`, characters)
  );
  if (
    lyricFont.value === 'body' &&
    document.documentElement.classList.contains('animal-island')
  ) {
    fonts.push(document.fonts.load('700 80px "Nunito"', characters));
    fonts.push(document.fonts.load('700 80px "Zen Maru Gothic"', characters));
  }
  await Promise.all(fonts).catch(error =>
    console.warn('[沉浸模式] 歌词字体加载失败，使用后备字体', error)
  );
}

function getSceneFontText(lyricsText: string) {
  const cardText = [props.current, ...props.snapshot.state.queue.slice(0, 2)]
    .flatMap(item => [
      item?.music.name || '',
      item?.music.singer || '',
      item?.requestedName || ''
    ])
    .join('');
  return `${lyricsText}${cardText}正在播放下一首队列播放暂停切歌随机音量`;
}

function preloadSceneFont() {
  const text = getSceneFontText(props.lyricsText);
  const musicKey = props.current
    ? `${props.current.id}:${props.current.music.type}:${props.current.music.id}`
    : '';
  const nextKey = `${lyricFont.value}:${musicKey}:${text}`;
  if (sceneFontLoadKey === nextKey) return sceneFontLoadPromise;
  sceneFontLoadKey = nextKey;
  sceneFontLoadPromise = ensureLyricFontLoaded(text);
  return sceneFontLoadPromise;
}

function createTextCanvas(text: string, width = 1400, height = 320) {
  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = width;
  textureCanvas.height = height;
  const context = textureCanvas.getContext('2d');
  if (!context) return textureCanvas;
  const fontFamily = getLyricFontFamily();
  context.clearRect(0, 0, width, height);
  const content = text.trim();
  const maxWidth = width - 120;
  const wrapText = (fontSize: number) => {
    context.font = `700 ${fontSize}px ${fontFamily}`;
    const lines: string[] = [];
    let line = '';
    for (const character of Array.from(content)) {
      if (character === '\n') {
        if (line) lines.push(line.trim());
        line = '';
        continue;
      }
      const candidate = line + character;
      if (line && context.measureText(candidate).width > maxWidth) {
        lines.push(line.trim());
        line = character.trimStart();
      } else line = candidate;
    }
    if (line) lines.push(line.trim());
    return lines.filter(Boolean);
  };
  let fontSize = 80;
  let lines = wrapText(fontSize);
  while (fontSize > 12 && lines.length * fontSize * 1.28 > height - 36) {
    fontSize -= 2;
    lines = wrapText(fontSize);
  }
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.shadowColor = 'rgba(220,235,255,.9)';
  context.shadowBlur = 24;
  context.fillStyle = '#f6f3e5';
  context.font = `700 ${fontSize}px ${fontFamily}`;
  const lineHeight = fontSize * 1.28;
  const firstY = height / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) =>
    context.fillText(line, width / 2, firstY + index * lineHeight)
  );
  return textureCanvas;
}

function createTextTexture(text: string, width = 1400, height = 320) {
  const textureCanvas = createTextCanvas(text, width, height);
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function sampleLyricParticles(text: string) {
  if (!text.trim()) return new Float32Array();
  const width = 1400;
  const height = 320;
  const textureCanvas = createTextCanvas(text, width, height);
  const context = textureCanvas.getContext('2d');
  if (!context) return new Float32Array();
  const pixels = context.getImageData(0, 0, width, height).data;
  const sampled: number[][] = [];
  const step = 7;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      if (pixels[(y * width + x) * 4 + 3] < 105) continue;
      sampled.push([
        (x / width - 0.5) * 5.8,
        (0.5 - y / height) * 1.32,
        (Math.random() - 0.5) * 0.018
      ]);
    }
  }
  const maxParticles = 5200;
  if (sampled.length > maxParticles) {
    for (let index = sampled.length - 1; index > 0; index--) {
      const target = Math.floor(Math.random() * (index + 1));
      [sampled[index], sampled[target]] = [sampled[target], sampled[index]];
    }
    sampled.length = maxParticles;
  }
  return new Float32Array(sampled.flat());
}

function disposeLyricParticleTransition() {
  if (!lyricParticleTransition) return;
  stageRoot?.remove(lyricParticleTransition.points);
  lyricParticleTransition.points.geometry.dispose();
  lyricParticleTransition.points.material.dispose();
  lyricParticleTransition = null;
}

function startLyricParticleTransition(previousText: string, nextText: string) {
  if (!stageRoot || !lyricMesh || !fx.value.lyricGlowParticles) return;
  disposeLyricParticleTransition();
  const previous = sampleLyricParticles(previousText);
  const next = sampleLyricParticles(nextText);
  const previousCount = previous.length / 3;
  const nextCount = next.length / 3;
  const count = Math.max(previousCount, nextCount);
  if (!count) return;
  const from = new Float32Array(count * 3);
  const to = new Float32Array(count * 3);
  const scatter = new Float32Array(count * 3);
  for (let index = 0; index < count; index++) {
    const fromSource = previousCount ? previous : next;
    const fromCount = previousCount || nextCount;
    const toSource = nextCount ? next : previous;
    const toCount = nextCount || previousCount;
    const previousIndex = (index % fromCount) * 3;
    const nextIndex = (index % toCount) * 3;
    for (let axis = 0; axis < 3; axis++) {
      from[index * 3 + axis] = fromSource[previousIndex + axis] ?? 0;
      to[index * 3 + axis] = toSource[nextIndex + axis] ?? 0;
    }
    if (!previousCount) {
      from[index * 3] += (Math.random() - 0.5) * 1.1;
      from[index * 3 + 1] += (Math.random() - 0.5) * 0.65;
      from[index * 3 + 2] += (Math.random() - 0.5) * 0.8;
    }
    if (!nextCount) {
      to[index * 3] += (Math.random() - 0.5) * 1.1;
      to[index * 3 + 1] += (Math.random() - 0.5) * 0.65;
      to[index * 3 + 2] += (Math.random() - 0.5) * 0.8;
    }
    const angle = Math.random() * Math.PI * 2;
    const force = 0.12 + Math.random() * 0.46;
    scatter[index * 3] = Math.cos(angle) * force;
    scatter[index * 3 + 1] = Math.sin(angle) * force * 0.52;
    scatter[index * 3 + 2] = (Math.random() - 0.5) * 0.9;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array(from), 3)
  );
  const [red, green, blue] = colorMap[color.value];
  const material = new THREE.PointsMaterial({
    color: new THREE.Color(red / 255, green / 255, blue / 255),
    size: 0.028,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.96,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending
  });
  const points = new THREE.Points(geometry, material);
  points.renderOrder = 121;
  stageRoot.add(points);
  lyricParticleTransition = {
    points,
    from,
    to,
    scatter,
    startedAt: performance.now(),
    duration: 920
  };
}

function updateLyricParticleTransition(time: number) {
  const transition = lyricParticleTransition;
  if (!transition || !lyricMesh) return;
  const progress = THREE.MathUtils.clamp(
    (time - transition.startedAt) / transition.duration,
    0,
    1
  );
  const eased = progress * progress * (3 - 2 * progress);
  const burst = Math.sin(progress * Math.PI);
  const positions = transition.points.geometry.getAttribute(
    'position'
  ) as THREE.BufferAttribute;
  const output = positions.array as Float32Array;
  for (let index = 0; index < output.length; index++)
    output[index] =
      THREE.MathUtils.lerp(
        transition.from[index],
        transition.to[index],
        eased
      ) +
      transition.scatter[index] * burst;
  positions.needsUpdate = true;
  transition.points.position.copy(lyricMesh.position);
  transition.points.rotation.copy(lyricMesh.rotation);
  transition.points.scale.copy(lyricMesh.scale);
  transition.points.visible = fx.value.particleLyrics;
  transition.points.material.opacity =
    0.72 + burst * 0.28 + audioBands.beat * 0.12;
  lyricMesh.visible = false;
  if (progress >= 1) disposeLyricParticleTransition();
}

async function renderLyricTexture(nextLyric: string) {
  const renderToken = ++lyricRenderToken;
  await preloadSceneFont();
  if (renderToken !== lyricRenderToken || !lyricMesh) return;
  const previousLyric = renderedLyricText;
  startLyricParticleTransition(previousLyric, nextLyric);
  const material = lyricMesh.material as THREE.MeshBasicMaterial;
  material.map?.dispose();
  material.map = createTextTexture(nextLyric);
  material.needsUpdate = true;
  renderedLyricText = nextLyric;
}

const cardCoverCache = new Map<string, HTMLImageElement>();
function formatCardTime(value: number) {
  const seconds = Math.max(
    0,
    value > 1000 ? Math.floor(value / 1000) : Math.floor(value)
  );
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function createCardTexture(
  item: RoomCurrent | null | undefined,
  tag: string,
  index: number,
  hoverAction: CardHoverAction = null
) {
  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = 1440;
  textureCanvas.height = 720;
  const context = textureCanvas.getContext('2d');
  if (!context) return new THREE.CanvasTexture(textureCanvas);
  context.scale(2, 2);
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  const pad = 18;
  const cardWidth = 684;
  const cardHeight = 324;
  const coverX = pad;
  const coverY = pad;
  const coverSize = cardHeight;
  const coverEdge = coverX + coverSize;
  const textX = 362;
  const fontFamily = getLyricFontFamily();
  context.fillStyle = `rgba(0,0,0,${Math.min(0.98, Math.max(0.25, fx.value.shelfBgOpacity))})`;
  context.beginPath();
  context.roundRect(pad, pad, cardWidth, cardHeight, 32);
  context.fill();
  context.save();
  context.beginPath();
  context.roundRect(pad, pad, cardWidth, cardHeight, 32);
  context.clip();
  const gradient = context.createLinearGradient(
    coverEdge,
    pad,
    pad + cardWidth,
    pad + cardHeight
  );
  gradient.addColorStop(0, 'rgba(255,255,255,.1)');
  gradient.addColorStop(1, 'rgba(255,255,255,.018)');
  context.fillStyle = gradient;
  context.fillRect(coverEdge, pad, pad + cardWidth - coverEdge, cardHeight);
  context.fillStyle = 'rgba(0,0,0,.42)';
  context.fillRect(coverX, coverY, coverSize, coverSize);
  context.restore();
  context.strokeStyle =
    index === 0 ? 'rgba(244,210,138,.72)' : 'rgba(255,255,255,.14)';
  context.lineWidth = index === 0 ? 2 : 1.1;
  context.beginPath();
  context.roundRect(pad, pad, cardWidth, cardHeight, 32);
  context.stroke();
  context.fillStyle =
    index === 0 ? 'rgba(244,210,138,.92)' : 'rgba(255,255,255,.92)';
  context.font = `700 16px ${fontFamily}`;
  context.fillText(tag, textX, 52);
  context.fillStyle = 'rgba(255,255,255,.96)';
  context.font = `700 27px ${fontFamily}`;
  context.fillText((item?.music.name || '等待点歌').slice(0, 17), textX, 89);
  context.fillStyle = 'rgba(255,255,255,.52)';
  context.font = `400 16px ${fontFamily}`;
  context.fillText((item?.music.singer || '未知歌手').slice(0, 20), textX, 126);
  context.fillStyle = 'rgba(255,255,255,.38)';
  context.font = `500 13px ${fontFamily}`;
  context.fillText(
    item ? `${item.requestedName || '匿名'} 点歌` : '当前曲目',
    textX,
    164
  );
  const drawPill = (
    x: number,
    width: number,
    label: string,
    action: CardHoverAction,
    active = false
  ) => {
    const hovered = hoverAction === action;
    context.save();
    if (hovered) {
      context.shadowColor = 'rgba(244,210,138,.72)';
      context.shadowBlur = 14;
    }
    context.fillStyle = hovered
      ? 'rgba(244,210,138,.3)'
      : active
        ? 'rgba(244,210,138,.2)'
        : 'rgba(255,255,255,.08)';
    context.strokeStyle = hovered
      ? 'rgba(255,231,170,.92)'
      : active
        ? 'rgba(244,210,138,.58)'
        : 'rgba(255,255,255,.16)';
    context.lineWidth = hovered ? 1.8 : 1.2;
    context.beginPath();
    context.roundRect(x, 256, width, 34, 16);
    context.fill();
    context.stroke();
    context.fillStyle =
      hovered || active ? 'rgba(255,239,198,.98)' : 'rgba(255,255,255,.86)';
    context.font = `600 13px ${fontFamily}`;
    context.textAlign = 'center';
    context.fillText(label, x + width / 2, 278);
    context.textAlign = 'left';
    context.restore();
  };
  if (index === 0) {
    if (isAdmin.value) {
      drawPill(362, 72, props.playing ? '暂停' : '播放', 'play', props.playing);
      drawPill(444, 62, '切歌', 'next');
      drawPill(
        516,
        74,
        '随机',
        'random',
        Boolean(props.snapshot.state.randomPlayback)
      );
    } else {
      drawPill(
        362,
        124,
        props.playing ? '正在播放' : '恢复声音',
        'resume',
        props.playing
      );
    }
    const volumeHovered = hoverAction === 'volume';
    context.save();
    if (volumeHovered) {
      context.shadowColor = 'rgba(244,210,138,.72)';
      context.shadowBlur = 12;
    }
    context.fillStyle = volumeHovered
      ? 'rgba(255,239,198,.98)'
      : 'rgba(255,255,255,.62)';
    context.font = `600 12px ${fontFamily}`;
    context.fillText(props.volume > 0 ? '音' : '静', 598, 278);
    context.lineCap = 'round';
    context.strokeStyle = volumeHovered
      ? 'rgba(255,255,255,.32)'
      : 'rgba(255,255,255,.18)';
    context.lineWidth = volumeHovered ? 6 : 4;
    context.beginPath();
    context.moveTo(622, 274);
    context.lineTo(668, 274);
    context.stroke();
    const volumeX = 622 + THREE.MathUtils.clamp(props.volume / 100, 0, 1) * 46;
    context.strokeStyle = 'rgba(244,210,138,.94)';
    context.beginPath();
    context.moveTo(622, 274);
    context.lineTo(volumeX, 274);
    context.stroke();
    context.fillStyle = '#fff0c8';
    context.beginPath();
    context.arc(volumeX, 274, volumeHovered ? 4.5 : 3.5, 0, Math.PI * 2);
    context.fill();
    context.restore();
    context.fillStyle = 'rgba(255,255,255,.42)';
    context.font = `500 11px ${fontFamily}`;
    context.fillText(formatCardTime(props.position), 362, 310);
    context.textAlign = 'right';
    context.fillText(formatCardTime(props.duration), 662, 310);
    context.textAlign = 'left';
    const progressHovered = hoverAction === 'seek';
    context.save();
    if (progressHovered) {
      context.shadowColor = 'rgba(244,210,138,.8)';
      context.shadowBlur = 12;
    }
    context.strokeStyle = progressHovered
      ? 'rgba(255,255,255,.32)'
      : 'rgba(255,255,255,.18)';
    context.lineWidth = progressHovered ? 6 : 4;
    context.beginPath();
    context.moveTo(362, 326);
    context.lineTo(662, 326);
    context.stroke();
    context.strokeStyle = 'rgba(244,210,138,.94)';
    context.beginPath();
    context.moveTo(362, 326);
    context.lineTo(362 + (percent.value / 100) * 300, 326);
    context.stroke();
    context.restore();
  }
  const coverSource =
    item?.music.largeImage ||
    item?.music.mediumImage ||
    item?.music.image ||
    '';
  if (coverSource) {
    const paintCover = (image: HTMLImageElement) => {
      const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
      const sourceX = (image.naturalWidth - sourceSize) / 2;
      const sourceY = (image.naturalHeight - sourceSize) / 2;
      context.save();
      context.beginPath();
      context.roundRect(pad, pad, cardWidth, cardHeight, 32);
      context.clip();
      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceSize,
        sourceSize,
        coverX,
        coverY,
        coverSize,
        coverSize
      );
      context.restore();
      context.strokeStyle =
        index === 0 ? 'rgba(244,210,138,.72)' : 'rgba(255,255,255,.14)';
      context.lineWidth = index === 0 ? 2 : 1.1;
      context.beginPath();
      context.roundRect(pad, pad, cardWidth, cardHeight, 32);
      context.stroke();
      texture.needsUpdate = true;
    };
    const imageUrl = new URL(coverSource, location.href);
    const sourceUrl =
      imageUrl.origin === location.origin
        ? imageUrl.href
        : parseHttpProxyAddress(coverSource);
    const cached = cardCoverCache.get(sourceUrl);
    if (cached) {
      paintCover(cached);
    } else {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => {
        cardCoverCache.set(sourceUrl, image);
        paintCover(image);
      };
      image.src = sourceUrl;
    }
  }
  return texture;
}

function refreshCardGroup() {
  if (!cardGroup) return;
  for (const child of [...cardGroup.children]) {
    const mesh = child as THREE.Mesh<
      THREE.PlaneGeometry,
      THREE.MeshBasicMaterial
    >;
    mesh.material.map?.dispose();
    mesh.material.dispose();
    mesh.geometry.dispose();
    cardGroup.remove(child);
  }
  const shelfItems = [props.current, ...props.snapshot.state.queue.slice(0, 2)];
  shelfItems.forEach((item, index) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2.05, 1.025),
      new THREE.MeshBasicMaterial({
        map: createCardTexture(
          item,
          index === 0 ? '正在播放' : index === 1 ? '下一首' : `队列 ${index}`,
          index,
          index === 0 ? hoveredCardAction : null
        ),
        transparent: true,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
        toneMapped: false,
        opacity: fx.value.shelfOpacity
      })
    );
    mesh.frustumCulled = false;
    mesh.userData.cardIndex = index;
    mesh.renderOrder = 80 - index;
    cardGroup?.add(mesh);
  });
}

function refreshCurrentCardTexture() {
  const mesh = cardGroup?.children[0] as
    | THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
    | undefined;
  if (!mesh) return;
  mesh.material.map?.dispose();
  mesh.material.map = createCardTexture(
    props.current,
    '正在播放',
    0,
    hoveredCardAction
  );
  mesh.material.needsUpdate = true;
}

function updateCardPose(
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>,
  index: number,
  center: number,
  time: number
) {
  const delta = index - center;
  const absDelta = Math.abs(delta);
  const narrow = window.innerWidth < 980;
  const portrait = window.innerHeight > window.innerWidth;
  const breath = Math.sin(time * 0.92 + index * 0.64) * 0.052;
  const breathZ = Math.cos(time * 0.78 + index * 0.52) * 0.03;
  if (fx.value.shelfMode === 'stage') {
    const stageY = portrait ? -2.46 : -2.2;
    const stageZ = portrait ? 0.84 : 1;
    const stageScale = portrait ? 0.72 : narrow ? 0.86 : 1;
    mesh.position.set(
      fx.value.shelfOffsetX + delta * 1.08,
      stageY + fx.value.shelfOffsetY + breath * 0.7,
      stageZ + fx.value.shelfOffsetZ - Math.min(2, absDelta) * 0.52 + breathZ
    );
    mesh.rotation.set(0.1 - absDelta * 0.04, -delta * 0.22, 0);
    mesh.scale.setScalar(
      (absDelta < 0.5 ? 1.2 : Math.max(0.45, 1 - absDelta * 0.22)) *
        stageScale *
        fx.value.shelfSize
    );
  } else {
    const sideX = portrait ? 1.56 : narrow ? 2.48 : 3.18;
    const sideYStep = portrait ? 0.58 : 0.74;
    const sideZStep = portrait ? 0.15 : 0.19;
    const sideScale = portrait ? 0.7 : narrow ? 0.86 : 1;
    mesh.position.set(
      sideX + absDelta * (portrait ? 0.15 : 0.18) + fx.value.shelfOffsetX,
      -delta * sideYStep +
        fx.value.shelfOffsetY +
        breath * Math.max(0.2, 1 - absDelta * 0.16),
      (portrait ? 0.78 : 0.86) -
        absDelta * sideZStep +
        fx.value.shelfOffsetZ +
        breathZ * Math.max(0, 1 - absDelta * 0.16)
    );
    mesh.rotation.set(
      -delta * (portrait ? 0.022 : 0.042),
      (portrait ? 0.12 : 0.28) + THREE.MathUtils.degToRad(fx.value.shelfAngleY),
      0
    );
    mesh.scale.setScalar(
      (absDelta < 0.5 ? 1.12 : Math.max(0.55, 1.04 - absDelta * 0.14)) *
        sideScale *
        fx.value.shelfSize
    );
  }
  mesh.visible = absDelta <= 5.5;
  mesh.material.opacity =
    fx.value.shelfOpacity *
    (absDelta < 0.5 ? 1 : Math.max(0.22, 1 - absDelta * 0.3));
}

function getParticleDebugSnapshot() {
  const el = canvas.value;
  const material = particleCloud?.material as THREE.ShaderMaterial | undefined;
  const context = renderer?.getContext();
  const style = el ? window.getComputedStyle(el) : null;
  const positionCount =
    particleCloud?.geometry.getAttribute('position')?.count ?? 0;
  const spectrumMax = spectrumBands.reduce(
    (max, value) => Math.max(max, value),
    0
  );
  const finite = (values: number[]) => values.every(Number.isFinite);
  const renderCalls = renderer?.info.render.calls ?? 0;
  const renderedPoints = renderer?.info.render.points ?? 0;
  const programs = renderer?.info.programs ?? [];
  const audioFinite = finite([
    audioBands.bass,
    audioBands.mid,
    audioBands.treble,
    audioBands.energy,
    audioBands.beat,
    ...spectrumBands
  ]);
  const diagnosis =
    webglContextLost || Boolean(context?.isContextLost())
      ? 'WEBGL_CONTEXT_LOST'
      : performance.now() - particleLastFrameAt >= 1000
        ? 'RAF_STOPPED'
        : !audioFinite
          ? 'AUDIO_UNIFORM_INVALID'
          : renderCalls === 0
            ? 'NOTHING_SUBMITTED_TO_GPU'
            : renderedPoints === 0
              ? 'PARTICLES_NOT_SUBMITTED'
              : 'GPU_IS_DRAWING';
  return {
    diagnosis,
    instance: props.embedded ? 'play-detail' : 'room',
    preset: visualPreset.value,
    raf: {
      alive: performance.now() - particleLastFrameAt < 1000,
      frames: particleRenderedFrames,
      lastFrameAgo: Math.round(performance.now() - particleLastFrameAt)
    },
    canvas: el
      ? {
          connected: el.isConnected,
          client: [el.clientWidth, el.clientHeight],
          buffer: [el.width, el.height],
          display: style?.display,
          visibility: style?.visibility,
          opacity: style?.opacity
        }
      : null,
    webgl: {
      contextLost: webglContextLost || Boolean(context?.isContextLost()),
      calls: renderCalls,
      points: renderedPoints,
      rendererFrame: renderer?.info.render.frame ?? 0,
      programs: programs.length
    },
    particles: {
      count: positionCount,
      visible: particleCloud?.visible,
      scale: particleCloud
        ? particleCloud.scale.toArray().map(value => Number(value.toFixed(3)))
        : null,
      materialVisible: material?.visible,
      opacity: material?.opacity,
      energy: material?.uniforms.uEnergy?.value,
      pointSize: material?.uniforms.uPointSize?.value
    },
    stage: stageRoot
      ? {
          visible: stageRoot.visible,
          position: stageRoot.position
            .toArray()
            .map(value => Number(value.toFixed(3))),
          rotation: stageRoot.rotation
            .toArray()
            .slice(0, 3)
            .map(value => Number((value as number).toFixed(3))),
          finite: finite([
            ...stageRoot.position.toArray(),
            stageRoot.rotation.x,
            stageRoot.rotation.y,
            stageRoot.rotation.z
          ])
        }
      : null,
    camera: camera
      ? {
          position: camera.position
            .toArray()
            .map(value => Number(value.toFixed(3))),
          radius: Number(cameraRadius.toFixed(3)),
          targetRadius: Number(targetCameraRadius.toFixed(3)),
          near: camera.near,
          far: camera.far,
          aspect: Number(camera.aspect.toFixed(3)),
          finite: finite(camera.position.toArray())
        }
      : null,
    audio: {
      ...audioBands,
      spectrumMax: Number(spectrumMax.toFixed(3)),
      finite: audioFinite
    }
  };
}

function startParticles() {
  const el = canvas.value;
  if (!el) return;
  const parent = el.parentElement;
  if (!parent) return;
  renderer = new THREE.WebGLRenderer({
    canvas: el,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  webglContextLostHandler = event => {
    event.preventDefault();
    webglContextLost = true;
  };
  webglContextRestoredHandler = () => {
    webglContextLost = false;
  };
  el.addEventListener('webglcontextlost', webglContextLostHandler);
  el.addEventListener('webglcontextrestored', webglContextRestoredHandler);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  const initialCamera = getCameraPreset();
  cameraRadius = initialCamera.radius;
  targetCameraRadius = initialCamera.radius;
  cameraLookAt.set(
    fx.value.lyricOffsetX,
    0.18 + fx.value.lyricOffsetY,
    1.48 + fx.value.lyricOffsetZ
  );
  stageRoot = new THREE.Group();
  scene.add(stageRoot);
  recenterStage(true);
  const geometry = createParticleGeometry();
  particlePreset = visualPreset.value;
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uEnergy: { value: 0 },
      uPointSize: { value: 3.2 },
      uColor: { value: new THREE.Color('#a6d2ff') },
      uBass: { value: 0 },
      uMid: { value: 0 },
      uTreble: { value: 0 },
      uBeat: { value: 0 },
      uDepth: { value: fx.value.depth },
      uHasCover: { value: 0 },
      uSpectrum: { value: spectrumBands },
      uCoverTex: { value: null },
      uPreset: {
        value: getParticlePresetIndex()
      }
    },
    vertexShader: PARTICLE_VERTEX_SHADER,
    fragmentShader: PARTICLE_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  particleCloud = new THREE.Points(geometry, material);
  // 顶点着色器会把粒子移出原始 geometry 包围球，不能使用静态包围球裁剪。
  particleCloud.frustumCulled = false;
  stageRoot.add(particleCloud);
  loadParticleCover();
  lyricMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(5.8, 1.32),
    new THREE.MeshBasicMaterial({
      map: createTextTexture(''),
      transparent: true,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
      toneMapped: false
    })
  );
  lyricMesh.position.set(0, 0.18, 1.48);
  lyricMesh.frustumCulled = false;
  lyricMesh.renderOrder = 120;
  stageRoot.add(lyricMesh);
  void renderLyricTexture(props.lyric);
  cardGroup = new THREE.Group();
  stageRoot.add(cardGroup);
  refreshCardGroup();
  const resize = () => {
    if (!renderer || !camera) return;
    const width = parent.clientWidth;
    const height = parent.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
  };
  resize();
  resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(parent);
  particleLastFrameAt = performance.now();
  particleRenderedFrames = 0;
  const draw = (time: number) => {
    frame = requestAnimationFrame(draw);
    particleLastFrameAt = performance.now();
    particleRenderedFrames++;
    if (!renderer || !scene || !camera || !particleCloud || !stageRoot) return;
    try {
      const dt = Math.max(
        1 / 120,
        Math.min(
          0.05,
          previousFrameTime ? (time - previousFrameTime) / 1000 : 1 / 60
        )
      );
      previousFrameTime = time;
      if (
        particleCloud.geometry.getAttribute('position').count !==
          activeParticleCount.value ||
        particlePreset !== visualPreset.value
      )
        rebuildParticleGeometry();
      const material = particleCloud.material as THREE.ShaderMaterial;
      readAudioBands(time);
      material.uniforms.uTime.value = time * 0.001 * speed.value;
      material.uniforms.uEnergy.value = audioBands.energy * fx.value.intensity;
      material.uniforms.uBass.value = audioBands.bass * fx.value.intensity;
      material.uniforms.uMid.value = audioBands.mid * fx.value.intensity;
      material.uniforms.uTreble.value = audioBands.treble * fx.value.intensity;
      material.uniforms.uBeat.value = audioBands.beat;
      material.uniforms.uSpectrum.value = spectrumBands;
      material.uniforms.uDepth.value = fx.value.depth;
      material.uniforms.uPointSize.value =
        (props.playing ? 3.55 : 2.8) *
        fx.value.point *
        (1 + audioBands.energy * 0.52 + audioBands.beat * 0.28);
      const [red, green, blue] = colorMap[color.value];
      (material.uniforms.uColor.value as THREE.Color).setRGB(
        red / 255,
        green / 255,
        blue / 255
      );
      material.uniforms.uPreset.value = getParticlePresetIndex();
      if (!pointer.value.active) {
        gestureRotation.x += particleSpin.vx * dt;
        gestureRotation.y += particleSpin.vy * dt;
        particleSpin.vx *= Math.pow(0.9, dt * 60);
        particleSpin.vy *= Math.pow(0.9, dt * 60);
        if (Math.abs(particleSpin.vx) < 0.01) particleSpin.vx = 0;
        if (Math.abs(particleSpin.vy) < 0.01) particleSpin.vy = 0;
      }
      stageRoot.rotation.x +=
        (gestureRotation.x - stageRoot.rotation.x) * 0.055;
      stageRoot.rotation.y +=
        (gestureRotation.y - stageRoot.rotation.y) * 0.055;
      stagePan.lerp(stagePanTarget, 0.14);
      stageRoot.position.copy(stagePan);
      particleCloud.scale.setScalar(
        visualPreset.value === 'emily' ? 1 : fx.value.depth
      );
      if (cardGroup?.visible) {
        stageRoot.updateMatrixWorld(true);
        camera.updateMatrixWorld(true);
        raycaster.setFromCamera(scenePointer, camera);
        const cardHits = raycaster
          .intersectObjects(
            cardGroup.children.filter(child => child.visible),
            false
          )
          .sort(
            (a, b) => (b.object.renderOrder || 0) - (a.object.renderOrder || 0)
          );
        hoveredCardIndex = cardHits.length
          ? Number(cardHits[0].object.userData.cardIndex ?? -1)
          : -1;
        const nextHoverAction =
          hoveredCardIndex === 0 && cardHits[0]?.uv
            ? getCardActionAt(
                cardHits[0].uv.x * 720,
                (1 - cardHits[0].uv.y) * 360
              )
            : null;
        if (nextHoverAction !== hoveredCardAction) {
          hoveredCardAction = nextHoverAction;
          refreshCurrentCardTexture();
        }
        renderer.domElement.style.cursor =
          pointerMode.value === 'pan'
            ? 'grabbing'
            : hoveredCardAction || hoveredCardIndex >= 0
              ? 'pointer'
              : pointer.value.active
                ? 'grabbing'
                : 'grab';
      } else {
        hoveredCardIndex = -1;
        if (hoveredCardAction) {
          hoveredCardAction = null;
          refreshCurrentCardTexture();
        }
      }
      shelfCenterSmooth += (shelfCenter.value - shelfCenterSmooth) * 0.16;
      const cameraPreset = getCameraPreset();
      const focusCard =
        fx.value.shelfMode !== 'off' && fx.value.shelfCameraMode === 'dynamic';
      const focusIndex = Math.round(shelfCenterSmooth);
      const desiredRadius = cameraZoomOverride
        ? targetCameraRadius * fx.value.cameraDistance
        : focusCard
          ? (fx.value.shelfMode === 'stage' ? 6.2 : 6.6) +
            Math.min(focusIndex, 3) * 0.05
          : targetCameraRadius * fx.value.cameraDistance;
      const desiredTheta = focusCard
        ? fx.value.shelfMode === 'stage'
          ? -0.08 + focusIndex * 0.08
          : 0.28
        : cameraPreset.theta;
      const desiredPhi = focusCard
        ? fx.value.shelfMode === 'stage'
          ? -0.2
          : -0.04 + (1.5 - focusIndex) * 0.025
        : cameraPreset.phi;
      const desiredLookAt = new THREE.Vector3(
        fx.value.lyricOffsetX,
        0.18 + fx.value.lyricOffsetY,
        1.48 + fx.value.lyricOffsetZ
      );
      cameraRadius += (desiredRadius - cameraRadius) * 0.07;
      cameraTheta += (desiredTheta - cameraTheta) * 0.1;
      cameraPhi += (desiredPhi - cameraPhi) * 0.1;
      cameraLookAt.lerp(desiredLookAt, 0.1);
      const cinema = fx.value.cinema ? fx.value.cinemaShake : 0;
      const theta = cameraTheta + Math.sin(time * 0.00008) * 0.012 * cinema;
      const phi = cameraPhi + Math.sin(time * 0.00006 + 1) * 0.01 * cinema;
      const cy = Math.cos(phi);
      camera.position.set(
        cameraLookAt.x + cameraRadius * cy * Math.sin(theta),
        cameraLookAt.y + cameraRadius * Math.sin(phi),
        cameraLookAt.z + cameraRadius * cy * Math.cos(theta)
      );
      camera.lookAt(cameraLookAt);
      if (lyricMesh) {
        lyricMesh.visible = fx.value.particleLyrics;
        const lyricBreath =
          Math.sin(time * 0.00092) * 0.05 +
          Math.sin(time * 0.00041 + 0.7) * 0.028;
        lyricMesh.position.set(
          fx.value.lyricOffsetX,
          0.18 + fx.value.lyricOffsetY + Math.sin(time * 0.00055) * 0.055,
          1.48 + fx.value.lyricOffsetZ + Math.cos(time * 0.00048) * 0.08
        );
        lyricMesh.scale.setScalar(
          fx.value.lyricScale *
            (0.96 +
              lyricBreath +
              audioBands.bass * 0.038 +
              audioBands.beat * 0.014)
        );
        lyricMesh.rotation.set(
          THREE.MathUtils.degToRad(fx.value.lyricTiltX),
          THREE.MathUtils.degToRad(fx.value.lyricTiltY),
          Math.sin(time * 0.00034) * 0.018
        );
        (lyricMesh.material as THREE.MeshBasicMaterial).opacity = fx.value
          .lyricGlow
          ? Math.min(
              1,
              0.55 +
                fx.value.lyricGlowStrength +
                (fx.value.lyricGlowBeat ? audioBands.beat * 0.28 : 0)
            )
          : 0.72;
        updateLyricParticleTransition(time);
      }
      if (cardGroup) {
        cardGroup.visible = props.showCards && fx.value.shelfMode !== 'off';
        cardGroup.children.forEach((child, index) => {
          const mesh = child as THREE.Mesh<
            THREE.PlaneGeometry,
            THREE.MeshBasicMaterial
          >;
          updateCardPose(mesh, index, shelfCenterSmooth, time * 0.001);
        });
      }
      renderer.render(scene, camera);
    } catch (error) {
      const now = performance.now();
      if (import.meta.env.DEV && now - particleLastErrorAt > 1000) {
        particleLastErrorAt = now;
        console.error(
          '[粒子诊断] render frame failed',
          error,
          getParticleDebugSnapshot()
        );
      }
    }
  };
  frame = requestAnimationFrame(draw);
}

watch(
  () => props.lyricsText,
  () => {
    void preloadSceneFont().then(() => {
      if (lyricMesh) void renderLyricTexture(props.lyric);
      refreshCardGroup();
    });
  }
);
watch(
  () => props.lyric,
  nextLyric => void renderLyricTexture(nextLyric)
);
watch(
  [visualPreset, density, speed, color, lyricFont, fx],
  saveParticleSettings,
  { deep: true }
);
watch(lyricFont, async () => {
  await renderLyricTexture(props.lyric);
  refreshCardGroup();
});
watch(
  () =>
    props.current?.music.largeImage ||
    props.current?.music.mediumImage ||
    props.current?.music.image ||
    '',
  () => loadParticleCover()
);
watch(
  () => [
    props.current?.id || '',
    ...props.snapshot.state.queue.slice(0, 2).map(item => item.id)
  ],
  () => {
    const cardCount = 1 + props.snapshot.state.queue.slice(0, 2).length;
    shelfCenter.value = Math.min(shelfCenter.value, cardCount - 1);
    refreshCardGroup();
    void preloadSceneFont().then(() => refreshCardGroup());
  }
);
watch(
  () => fx.value.shelfBgOpacity,
  () => refreshCardGroup()
);
watch(
  () => Math.round(props.volume),
  () => refreshCurrentCardTexture()
);
watch(
  () => [
    Math.floor(percent.value),
    props.playing,
    Boolean(props.snapshot.state.randomPlayback)
  ],
  () => refreshCardGroup()
);
onMounted(async () => {
  await restoreParticleSettings();
  startParticles();
  void preloadSceneFont().then(() => refreshCardGroup());
  showFloatingControls();
  window.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (settingsOpen.value) settingsOpen.value = false;
    else if (activePanel.value) activePanel.value = null;
    else emit('close');
  });
});
onUnmounted(() => {
  cancelAnimationFrame(frame);
  const el = canvas.value;
  if (el && webglContextLostHandler)
    el.removeEventListener('webglcontextlost', webglContextLostHandler);
  if (el && webglContextRestoredHandler)
    el.removeEventListener('webglcontextrestored', webglContextRestoredHandler);
  webglContextLostHandler = null;
  webglContextRestoredHandler = null;
  if (saveSettingsTimer !== null) {
    window.clearTimeout(saveSettingsTimer);
    persistParticleSettings();
  }
  lyricRenderToken++;
  if (floatingControlsTimer !== null)
    window.clearTimeout(floatingControlsTimer);
  disposeLyricParticleTransition();
  particleCoverLoadToken++;
  particleCoverTexture?.dispose();
  particleCoverTexture = null;
  resizeObserver?.disconnect();
  renderer?.dispose();
  scene?.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    if (Array.isArray(mesh.material))
      mesh.material.forEach(item => item.dispose());
    else if (mesh.material) mesh.material.dispose();
  });
});
</script>

<template>
  <Teleport to="body" :disabled="embedded">
    <section
      class="particle-stage"
      :class="{
        'is-panning': pointerMode === 'pan',
        'controls-hidden': floatingControlsHidden,
        'is-embedded': embedded
      }"
      aria-label="歌房沉浸模式"
      @pointerenter="showFloatingControls"
      @pointerleave="hideFloatingControls"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerCancel"
      @wheel.prevent="onWheel"
      @auxclick.prevent
      @contextmenu.prevent="recenterStage"
      @dblclick="recenterStage">
      <div
        class="particle-stage-backdrop"
        :style="{
          backgroundImage: `url(${current?.music.image || LogoImage})`
        }" />
      <canvas ref="canvas" class="particle-stage-canvas" />
      <div class="particle-stage-grid" />
      <div class="particle-stage-vignette" />

      <header
        v-if="!embedded"
        class="particle-stage-topbar particle-stage-floating-ui"
        @pointerdown.stop>
        <button class="particle-stage-exit" type="button" @click="emit('close')">
          退出沉浸
        </button>
        <span class="particle-stage-room-name"
          >{{ snapshot.room.name }} · {{ snapshot.nickname }}</span
        >
        <button class="particle-stage-exit" type="button" @click="emit('share')">
          分享
        </button>
      </header>

      <button
        v-if="!embedded && activePanel !== 'queue'"
        class="edge-button edge-left particle-stage-floating-ui"
        type="button"
        @pointerdown.stop
        @click.stop="togglePanel('queue')">
        ☷ <span>队列</span
        ><i v-if="snapshot.state.queue.length">{{
          snapshot.state.queue.length
        }}</i>
      </button>
      <button
        v-if="!embedded && activePanel !== 'chat'"
        class="edge-button edge-right particle-stage-floating-ui"
        type="button"
        @pointerdown.stop
        @click.stop="togglePanel('chat')">
        ◌ <span>聊天</span
        ><i v-if="unreadChatCount">{{
          unreadChatCount > 99 ? '99+' : unreadChatCount
        }}</i>
      </button>
      <button
        v-if="
          !embedded &&
          !songPickerOpen &&
          (snapshot.isAdmin || snapshot.allowGuestQueue)
        "
        class="edge-button song-button particle-stage-floating-ui"
        type="button"
        @pointerdown.stop
        @click.stop="openSongPicker">
        <span>♪</span>点歌
      </button>

      <div
        v-if="activePanel"
        class="drawer-mask"
        @pointerdown.stop
        @click="activePanel = null" />
      <Transition name="drawer-left">
        <aside
          v-if="activePanel === 'queue'"
          class="particle-stage-drawer drawer-left"
          @pointerdown.stop
          @wheel.stop>
          <div class="drawer-heading">
            <div><small>ROOM PLAYLIST</small><span>播放队列</span></div>
            <button type="button" title="关闭" @click="activePanel = null">
              ×
            </button>
          </div>
          <div class="drawer-tabs">
            <button
              type="button"
              :class="{ active: queuePanel === 'queue' }"
              @click="queuePanel = 'queue'">
              已点歌曲 <i>{{ snapshot.state.queue.length }}</i>
            </button>
            <button
              type="button"
              :class="{ active: queuePanel === 'history' }"
              @click="queuePanel = 'history'">
              播放历史 <i>{{ snapshot.state.history?.length || 0 }}</i>
            </button>
          </div>
          <div v-if="current" class="drawer-current">
            <img :src="current.music.image || LogoImage" alt="" />
            <div>
              <small><i />正在播放</small><b>{{ current.music.name }}</b
              ><span>{{ current.music.singer }}</span>
            </div>
          </div>
          <div class="drawer-scroll">
            <template v-if="queuePanel === 'queue'">
              <div
                v-for="(item, index) in snapshot.state.queue"
                :key="item.id"
                class="drawer-row">
                <span class="drawer-index">{{
                  String(index + 1).padStart(2, '0')
                }}</span>
                <img :src="item.music.image || LogoImage" alt="" />
                <div>
                  <b>{{ item.music.name }}</b
                  ><small
                    >{{ item.music.singer }} ·
                    {{ item.requestedName }} 点歌</small
                  >
                </div>
                <span
                  v-if="
                    snapshot.isAdmin || item.requestedBy === snapshot.memberId
                  "
                  class="drawer-actions">
                  <el-button
                    v-if="snapshot.isAdmin && index > 0"
                    type="button"
                    title="置顶到列表第一首"
                    @click="emit('pinQueue', item.id)">
                    <el-icon><Upload /></el-icon>
                  </el-button>
                  <el-button
                    type="button"
                    title="删除"
                    @click="emit('removeQueue', item.id)">
                    <el-icon><DeleteFilled /></el-icon>
                  </el-button>
                </span>
              </div>
              <p v-if="!snapshot.state.queue.length" class="drawer-empty">
                <b>♪</b>还没有人点歌
              </p>
            </template>
            <template v-else>
              <div
                v-for="(item, index) in snapshot.state.history || []"
                :key="`${item.id}-${index}`"
                class="drawer-row history-row">
                <span class="drawer-index">{{
                  String(index + 1).padStart(2, '0')
                }}</span>
                <img :src="item.music.image || LogoImage" alt="" />
                <div>
                  <b>{{ item.music.name }}</b
                  ><small
                    >{{ item.music.singer }} ·
                    {{ item.requestedName }} 点歌</small
                  >
                </div>
                <button
                  v-if="snapshot.isAdmin || snapshot.allowGuestQueue"
                  class="requeue-button"
                  type="button"
                  @click="emit('addQueue', item.music)">
                  点歌
                </button>
              </div>
              <p v-if="!snapshot.state.history?.length" class="drawer-empty">
                <b>↺</b>还没有已播歌曲
              </p>
            </template>
          </div>
        </aside>
      </Transition>

      <Transition name="drawer-right">
        <aside
          v-if="activePanel === 'chat'"
          class="particle-stage-drawer drawer-right"
          @pointerdown.stop
          @wheel.stop>
          <div class="drawer-heading">
            <div><small>LIVE CHAT</small><span>房间聊天</span></div>
            <button type="button" title="关闭" @click="activePanel = null">
              ×
            </button>
          </div>
          <button
            v-if="unreadChatCount"
            class="chat-latest"
            type="button"
            @click="scrollChatToBottom(true)">
            {{ unreadChatCount }} 条新消息 ↓
          </button>
          <div ref="chatList" class="chat-list" @scroll="updateChatScroll">
            <div
              v-for="message in chatMessages"
              :key="message.id"
              :class="[
                'chat-row',
                {
                  system: message.system,
                  self:
                    !message.system && message.memberId === snapshot.memberId
                }
              ]">
              <template v-if="message.system"
                ><span class="system-text">{{
                  message.content
                }}</span></template
              >
              <template v-else>
                <img
                  class="chat-avatar"
                  :src="chatAvatar(message)"
                  alt="用户头像"
                  :title="
                    message.memberId === snapshot.memberId
                      ? '双击修改个人信息'
                      : `双击拍一拍 ${message.nickname}`
                  "
                  @dblclick="
                    message.memberId === snapshot.memberId
                      ? emit('editProfile')
                      : emit('patMember', message.memberId)
                  " />
                <div class="chat-body">
                  <b
                    ><span
                      >{{ message.nickname }} [{{
                        chatMemberId(message.memberId)
                      }}]</span
                    ><time>{{ formatChatTime(message.createdAt) }}</time></b
                  >
                  <p v-if="message.content">{{ message.content }}</p>
                  <img
                    v-if="message.image"
                    class="chat-image"
                    :src="message.image"
                    alt="聊天图片"
                    @load="chatAtBottom && scrollChatToBottom()" />
                </div>
              </template>
            </div>
            <p v-if="!chatMessages.length" class="drawer-empty">
              <b>◌</b>还没有聊天消息
            </p>
          </div>
          <div v-if="emojiOpen" class="emoji-panel">
            <button
              v-for="emoji in emojiList"
              :key="emoji"
              type="button"
              @click="insertEmoji(emoji)">
              {{ emoji }}
            </button>
          </div>
          <form class="chat-compose" @submit.prevent="sendChat">
            <input
              v-model="chatDraft"
              maxlength="200"
              placeholder="说点什么…（可粘贴图片）"
              @paste="handleChatPaste" />
            <button
              class="emoji-button"
              type="button"
              title="表情"
              @click="emojiOpen = !emojiOpen">
              ☺
            </button>
            <button class="send-button" type="submit">发送</button>
          </form>
        </aside>
      </Transition>

      <ParticleVisualConsole
        v-model="settingsOpen"
        :embedded="embedded"
        :visible="!floatingControlsHidden">
        <div class="particle-stage-settings">
          <div class="fx-head">
            <b>视觉控制台</b>
            <div class="fx-head-actions">
              <button
                v-if="showDebugTools"
                class="fx-debug-copy"
                type="button"
                title="复制当前视角参数"
                @click="copyCurrentViewDebug">
                {{ debugCopyStatus || '复制参数' }}
              </button>
              <button
                class="fx-close"
                type="button"
                @click="settingsOpen = false">
                ×
              </button>
            </div>
          </div>
          <div class="fx-tabs">
            <button
              v-for="tab in [
                'preset',
                'appearance',
                'lyrics',
                'motion',
                'advanced'
              ] as const"
              :key="tab"
              :class="{ active: settingsTab === tab }"
              type="button"
              @click="settingsTab = tab">
              {{
                {
                  preset: '预设',
                  appearance: '外观',
                  lyrics: '歌词',
                  motion: '动态',
                  advanced: '高级'
                }[tab]
              }}
            </button>
          </div>
          <div class="fx-content">
            <template v-if="settingsTab === 'preset'"
              ><strong>视觉预设</strong>
              <div class="preset-grid">
                <button
                  v-for="preset in [
                    ['galaxy', '星河'],
                    ['topography', '声波地形'],
                    ['peaks', '节奏山脉'],
                    ['spectrum', '粒子频谱'],
                    ['ring', '频率光环'],
                    ['vinyl', '唱片'],
                    ['tunnel', '滚筒'],
                    ['emily', 'emily专辑封面']
                  ] as const"
                  :key="preset[0]"
                  :class="{ active: visualPreset === preset[0] }"
                  type="button"
                  @click="selectPreset(preset[0])">
                  {{ preset[1] }}
                </button>
              </div></template
            >
            <template v-else-if="settingsTab === 'appearance'"
              ><strong>外观</strong>
              <div class="color-options">
                <button
                  v-for="option in colorOptions"
                  :key="option"
                  :class="{ active: color === option }"
                  :data-color="option"
                  type="button"
                  @click="color = option" />
              </div>
              <label
                >场景字体
                <el-dropdown
                  popper-class="particle-stage-dropdown"
                  effect="dark"
                  trigger="click"
                  @command="selectLyricFont"
                  @visible-change="onFloatingDropdownVisible">
                  <button class="fx-dropdown-trigger" type="button">
                    {{ dropdownLabel(lyricFontOptions, lyricFont) }}
                    <span>⌄</span>
                  </button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item
                        v-for="option in lyricFontOptions"
                        :key="option[0]"
                        :class="{ active: lyricFont === option[0] }"
                        :command="option[0]">
                        {{ option[1] }}
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown></label
              >
              <label
                >色彩张力
                <input
                  v-model.number="fx.colorBoost"
                  type="range"
                  min=".5"
                  max="2"
                  step=".01" /></label
              ><label
                >背景压缩
                <input
                  v-model.number="fx.bgFade"
                  type="range"
                  min="0"
                  max="1.2"
                  step=".01" /></label
            ></template>
            <template v-else-if="settingsTab === 'lyrics'"
              ><strong>歌词开关</strong
              ><label
                >粒子歌词
                <input v-model="fx.particleLyrics" type="checkbox" /></label
              ><label
                >歌词溢光
                <input v-model="fx.lyricGlow" type="checkbox" /></label
              ><label
                >鼓点溢光
                <input v-model="fx.lyricGlowBeat" type="checkbox" /></label
              ><label
                >歌词光粒
                <input v-model="fx.lyricGlowParticles" type="checkbox" /></label
              ><label
                >歌词镜头绑定
                <input v-model="fx.lyricCameraLock" type="checkbox" /></label
              ><strong>歌词位置</strong
              ><label
                >歌词溢光
                <input
                  v-model.number="fx.lyricGlowStrength"
                  type="range"
                  min="0"
                  max=".85"
                  step=".01" /></label
              ><label
                >歌词大小
                <input
                  v-model.number="fx.lyricScale"
                  type="range"
                  min=".35"
                  max="1.65"
                  step=".01" /></label
              ><label
                >左右位置
                <input
                  v-model.number="fx.lyricOffsetX"
                  type="range"
                  min="-2"
                  max="2"
                  step=".01" /></label
              ><label
                >上下位置
                <input
                  v-model.number="fx.lyricOffsetY"
                  type="range"
                  min="-1.2"
                  max="1.35"
                  step=".01" /></label
              ><label
                >前后景深
                <input
                  v-model.number="fx.lyricOffsetZ"
                  type="range"
                  min="-1.6"
                  max="1.6"
                  step=".01" /></label
              ><label
                >上下旋转
                <input
                  v-model.number="fx.lyricTiltX"
                  type="range"
                  min="-42"
                  max="42"
                  step="1" /></label
              ><label
                >左右旋转
                <input
                  v-model.number="fx.lyricTiltY"
                  type="range"
                  min="-42"
                  max="42"
                  step="1" /></label
            ></template>
            <template v-else-if="settingsTab === 'motion'">
              <strong>画面基础</strong
              ><label
                >律动强度
                <input
                  v-model.number="fx.intensity"
                  type="range"
                  min=".2"
                  max="1.6"
                  step=".01" /></label
              ><label
                >立体感
                <input
                  v-model.number="fx.depth"
                  type="range"
                  min=".2"
                  max="1.8"
                  step=".01" /></label
              ><label
                >粒子密度
                <input
                  v-model.number="density"
                  type="range"
                  min=".4"
                  max="1.8"
                  step=".1" /></label
              ><label
                >镜头晃动
                <input
                  v-model.number="fx.cinemaShake"
                  type="range"
                  min="0"
                  max="1.8"
                  step=".01" /></label
              ><label
                >镜头远近
                <input
                  v-model.number="fx.cameraDistance"
                  type="range"
                  min=".55"
                  max="1.65"
                  step=".01" /></label
              ><strong>3D 歌单架</strong
              ><label
                >显示模式
                <el-dropdown
                  popper-class="particle-stage-dropdown"
                  effect="dark"
                  trigger="click"
                  @command="selectShelfMode"
                  @visible-change="onFloatingDropdownVisible">
                  <button class="fx-dropdown-trigger" type="button">
                    {{ dropdownLabel(shelfModeOptions, fx.shelfMode) }}
                    <span>⌄</span>
                  </button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item
                        v-for="option in shelfModeOptions"
                        :key="option[0]"
                        :class="{ active: fx.shelfMode === option[0] }"
                        :command="option[0]">
                        {{ option[1] }}
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown></label
              ><label
                >歌单架镜头
                <el-dropdown
                  popper-class="particle-stage-dropdown"
                  effect="dark"
                  trigger="click"
                  @command="selectShelfCameraMode"
                  @visible-change="onFloatingDropdownVisible">
                  <button class="fx-dropdown-trigger" type="button">
                    {{ dropdownLabel(shelfCameraOptions, fx.shelfCameraMode) }}
                    <span>⌄</span>
                  </button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item
                        v-for="option in shelfCameraOptions"
                        :key="option[0]"
                        :class="{
                          active: fx.shelfCameraMode === option[0]
                        }"
                        :command="option[0]">
                        {{ option[1] }}
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown></label
              ><label
                >显示策略
                <el-dropdown
                  popper-class="particle-stage-dropdown"
                  effect="dark"
                  trigger="click"
                  @command="selectShelfPresence"
                  @visible-change="onFloatingDropdownVisible">
                  <button class="fx-dropdown-trigger" type="button">
                    {{ dropdownLabel(shelfPresenceOptions, fx.shelfPresence) }}
                    <span>⌄</span>
                  </button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item
                        v-for="option in shelfPresenceOptions"
                        :key="option[0]"
                        :class="{ active: fx.shelfPresence === option[0] }"
                        :command="option[0]">
                        {{ option[1] }}
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown></label
              ><label
                >歌单架大小
                <input
                  v-model.number="fx.shelfSize"
                  type="range"
                  min=".65"
                  max="1.45"
                  step=".01" /></label
              ><label
                >左右位置
                <input
                  v-model.number="fx.shelfOffsetX"
                  type="range"
                  min="-1.6"
                  max="1.6"
                  step=".01" /></label
              ><label
                >上下位置
                <input
                  v-model.number="fx.shelfOffsetY"
                  type="range"
                  min="-1.6"
                  max="1.6"
                  step=".01" /></label
              ><label
                >前后景深
                <input
                  v-model.number="fx.shelfOffsetZ"
                  type="range"
                  min="-1.6"
                  max="1.6"
                  step=".01" /></label
              ><label
                >侧向角度
                <input
                  v-model.number="fx.shelfAngleY"
                  type="range"
                  min="-35"
                  max="15"
                  step="1" /></label
              ><label
                >整体透明度
                <input
                  v-model.number="fx.shelfOpacity"
                  type="range"
                  min=".2"
                  max="1"
                  step=".01" /></label
              ><label
                >背景透明度
                <input
                  v-model.number="fx.shelfBgOpacity"
                  type="range"
                  min=".15"
                  max="1"
                  step=".01"
              /></label>
            </template>
            <template v-else
              ><strong>高级</strong
              ><label
                >粒子尺寸
                <input
                  v-model.number="fx.point"
                  type="range"
                  min=".5"
                  max="2.2"
                  step=".01" /></label
              ><label
                >流速
                <input
                  v-model.number="speed"
                  type="range"
                  min=".2"
                  max="2.5"
                  step=".01" /></label
              ><label
                >扭曲
                <input
                  v-model.number="fx.twist"
                  type="range"
                  min="0"
                  max=".6"
                  step=".01" /></label
              ><label
                >粒子溢光 <input v-model="fx.bloom" type="checkbox" /></label
              ><label
                >轮廓高亮 <input v-model="fx.edge" type="checkbox" /></label
              ><label
                >电影镜头 <input v-model="fx.cinema" type="checkbox" /></label
              ><label
                >浮空粒子层
                <input v-model="fx.floatLayer" type="checkbox" /></label
            ></template>
          </div>
          <small class="fx-tips"
            >左键旋转，中键平移，滚轮缩放，右键恢复初始视角</small
          >
        </div>
      </ParticleVisualConsole>
    </section>
  </Teleport>
</template>

<style
  lang="less"
  scoped
  src="./particleStage.less"></style>
