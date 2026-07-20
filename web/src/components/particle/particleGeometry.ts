import * as THREE from 'three';
import type { VisualPreset } from './particleConfig';

function buildParticlePositions(preset: VisualPreset, count: number) {
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index++) {
    const u = index / Math.max(1, count - 1);
    let x = 0;
    let y = 0;
    let z = 0;
    if (preset === 'galaxy') {
      const arm = index % 4;
      const radius = 0.25 + Math.pow(Math.random(), 0.62) * 4.9;
      const angle =
        radius * 1.45 + (arm * Math.PI) / 2 + (Math.random() - 0.5) * 0.55;
      x = Math.cos(angle) * radius;
      y = Math.sin(angle) * radius * 0.48 + (Math.random() - 0.5) * 0.55;
      z = (Math.random() - 0.5) * 2.6;
    } else if (preset === 'topography') {
      const columns = Math.ceil(Math.sqrt(count));
      const gx = (index % columns) / columns - 0.5;
      const gz = Math.floor(index / columns) / columns - 0.5;
      x = gx * 9;
      z = gz * 6;
      y = Math.sin(gx * 15 + gz * 8) * 0.35 + Math.cos(gz * 18) * 0.22;
    } else if (preset === 'peaks') {
      const columns = Math.ceil(Math.sqrt(count));
      const rows = Math.ceil(count / columns);
      const gx = (index % columns) / Math.max(1, columns - 1) - 0.5;
      const gz = Math.floor(index / columns) / Math.max(1, rows - 1) - 0.5;
      x = gx * 9.6;
      z = gz * 6.4;
      const peak = (cx: number, cz: number, wx: number, wz: number) =>
        Math.exp(-((x - cx) ** 2 * wx + (z - cz) ** 2 * wz));
      y =
        -1.22 +
        peak(-3.25, -0.8, 0.72, 1.05) * 1.35 +
        peak(-1.15, 0.95, 1, 0.78) * 1.65 +
        peak(1.15, -0.65, 0.82, 1.2) * 1.5 +
        peak(3.2, 0.75, 0.95, 0.9) * 1.28 +
        Math.sin(x * 2.1 + z * 1.35) * 0.055;
    } else if (preset === 'spectrum') {
      const bandCount = 32;
      const levelCount = Math.max(10, Math.floor(count / (bandCount * 4)));
      const layerCount = Math.max(1, Math.ceil(count / (bandCount * levelCount)));
      const band = index % bandCount;
      const level = Math.floor(index / bandCount) % levelCount;
      const layer = Math.floor(index / (bandCount * levelCount));
      x = (band / (bandCount - 1) - 0.5) * 9.2;
      y = level / Math.max(1, levelCount - 1);
      z =
        (layer / Math.max(1, layerCount - 1) - 0.5) * 0.9 +
        (Math.random() - 0.5) * 0.035;
    } else if (preset === 'ring') {
      const sectorCount = 320;
      const sector = index % sectorCount;
      const localIndex = Math.floor(index / sectorCount);
      const pointsPerSector = Math.max(6, Math.ceil(count / sectorCount));
      const innerPoints = Math.max(2, Math.round(pointsPerSector * 0.28));
      const angle =
        (sector / sectorCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.004;
      let radius = 0;
      if (localIndex < innerPoints) {
        const layer = localIndex / Math.max(1, innerPoints - 1) - 0.5;
        radius = 1.72 + layer * 0.055 + (Math.random() - 0.5) * 0.008;
      } else {
        const outerIndex = localIndex - innerPoints;
        const outerCount = Math.max(1, pointsPerSector - innerPoints);
        const layer = outerIndex / Math.max(1, outerCount - 1) - 0.5;
        radius = 1.96 + layer * 0.11 + (Math.random() - 0.5) * 0.006;
      }
      x = Math.cos(angle) * radius;
      y = Math.sin(angle) * radius;
      z = ((localIndex % 3) - 1) * 0.035 + (Math.random() - 0.5) * 0.018;
    } else if (preset === 'vinyl') {
      const radius = 0.55 + Math.sqrt(Math.random()) * 4.5;
      const angle = Math.random() * Math.PI * 2;
      x = Math.cos(angle) * radius;
      y = Math.sin(angle) * radius;
      z = Math.sin(radius * 4) * 0.08 + (Math.random() - 0.5) * 0.12;
    } else if (preset === 'tunnel') {
      const angle = Math.random() * Math.PI * 2;
      const radius = 1.1 + Math.random() * 3.8;
      x = Math.cos(angle) * radius;
      y = Math.sin(angle) * radius;
      z = (u - 0.5) * 9;
    } else {
      x = (Math.random() - 0.5) * 8.2;
      y = (Math.random() - 0.5) * 5.2;
      z = (Math.random() - 0.5) * 1.4 + Math.sin(x * 1.2) * 0.35;
    }
    positions[index * 3] = x;
    positions[index * 3 + 1] = y;
    positions[index * 3 + 2] = z;
  }
  return positions;
}

export function createParticleGeometry(
  preset: VisualPreset,
  count: number,
  coverGridSize: number
) {
  const geometry = new THREE.BufferGeometry();
  const seeds = new Float32Array(count);
  const spectrumBandAttributes = new Float32Array(count);
  const coverUvs = new Float32Array(count * 2);
  let positions: Float32Array;
  if (preset === 'emily') {
    const planeSize = 4.8;
    positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index++) {
      const column = index % coverGridSize;
      const row = Math.floor(index / coverGridSize);
      const u = column / Math.max(1, coverGridSize - 1);
      const v = row / Math.max(1, coverGridSize - 1);
      positions[index * 3] = (u - 0.5) * planeSize;
      positions[index * 3 + 1] = (v - 0.5) * planeSize;
      positions[index * 3 + 2] = 0;
      coverUvs[index * 2] = u;
      coverUvs[index * 2 + 1] = v;
      seeds[index] = Math.random();
    }
  } else {
    positions = buildParticlePositions(preset, count);
    for (let index = 0; index < count; index++) {
      coverUvs[index * 2] = Math.random();
      coverUvs[index * 2 + 1] = Math.random();
      seeds[index] = Math.random();
      if (preset === 'spectrum') spectrumBandAttributes[index] = index % 32;
      else if (preset === 'ring') {
        const phase = (index % 320) / 319;
        spectrumBandAttributes[index] = (phase <= 0.5 ? phase * 2 : (1 - phase) * 2) * 31;
      }
    }
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute('aSpectrumBand', new THREE.BufferAttribute(spectrumBandAttributes, 1));
  geometry.setAttribute('aCoverUv', new THREE.BufferAttribute(coverUvs, 2));
  return geometry;
}
