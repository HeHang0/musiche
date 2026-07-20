export const PARTICLE_VERTEX_SHADER = `
  uniform float uTime;
  uniform float uEnergy;
  uniform float uBass;
  uniform float uMid;
  uniform float uTreble;
  uniform float uBeat;
  uniform float uPointSize;
  uniform float uPreset;
  uniform float uDepth;
  uniform float uHasCover;
  uniform float uSpectrum[32];
  uniform vec3 uColor;
  uniform sampler2D uCoverTex;
  attribute float aSeed;
  attribute float aSpectrumBand;
  attribute vec2 aCoverUv;
  varying float vGlow;
  varying vec3 vParticleColor;
  varying float vParticleAlpha;
  void main() {
    vec3 p = position;
    float seed = aSeed;
    float spectrumGlow = 0.0;
    vParticleColor = uColor;
    vParticleAlpha = 1.0;
    if (uPreset < 0.5) {
      float a = uTime * (0.03 + seed * 0.03);
      p.xy = mat2(cos(a), -sin(a), sin(a), cos(a)) * p.xy;
      p.xy *= 1.0 + uBass * (.055 + seed * .045);
      p.z += sin(uTime * .5 + seed * 12.0) * (.15 + uMid * .86);
    } else if (uPreset < 1.5) {
      p.y += sin(p.x * 1.8 + uTime * .7) * (.18 + uBass * 1.12) + cos(p.z * 2.2 + uTime * .45) * (.14 + uTreble * .54);
    } else if (uPreset < 2.5) {
      p.xy = mat2(cos(uTime * .12), -sin(uTime * .12), sin(uTime * .12), cos(uTime * .12)) * p.xy;
      p.xy *= 1.0 + uBass * .075 + uBeat * .035;
      p.z += sin(length(p.xy) * 5.0 - uTime * 2.0) * (.08 + uBass * .58);
    } else if (uPreset < 3.5) {
      p.xy *= 1.0 + uBass * .07 + uBeat * .04;
      p.z += uTime * (.5 + seed * .4 + uEnergy * 1.1);
      p.z = mod(p.z + 4.5, 9.0) - 4.5;
    } else if (uPreset < 4.5) {
      vec3 coverColor = texture2D(uCoverTex, aCoverUv).rgb;
      float luminance = dot(coverColor, vec3(.299, .587, .114));
      float midWave = sin(p.x * 2.7 + uTime * .7 + seed * 4.0) * uMid * .62;
      float detail = sin((p.x + p.y) * 7.0 + uTime * 2.5 + seed * 15.0) * uTreble * .18;
      float bassWave = sin(p.x * .8 + p.y * .65 + uTime * .45) * uBass * .58;
      p.z += (luminance - .5) * uDepth * .65 + midWave + detail + bassWave;
      p.xy *= 1.0 + uBass * .065 + uBeat * .04;
      vParticleColor = mix(uColor, coverColor, uHasCover);
      vParticleAlpha = mix(.75, clamp(.18 + luminance * 1.05, .16, 1.0), uHasCover);
    } else if (uPreset < 5.5) {
      float peakA = exp(-((p.x + 3.25) * (p.x + 3.25) * .72 + (p.z + .8) * (p.z + .8) * 1.05));
      float peakB = exp(-((p.x + 1.15) * (p.x + 1.15) * 1.0 + (p.z - .95) * (p.z - .95) * .78));
      float peakC = exp(-((p.x - 1.15) * (p.x - 1.15) * .82 + (p.z + .65) * (p.z + .65) * 1.2));
      float peakD = exp(-((p.x - 3.2) * (p.x - 3.2) * .95 + (p.z - .75) * (p.z - .75) * .9));
      float ridges = peakA + peakB + peakC + peakD;
      float bassLift = (peakA + peakC) * (uBass * 1.75 + uBeat * 1.05);
      float midLift = (peakB + peakD) * (uMid * 1.5 + uEnergy * .72);
      float travelingWave = sin(p.x * 2.35 + p.z * 1.55 - uTime * 2.1 + seed * .8)
        * (.08 + uMid * .34 + uTreble * .2) * (.3 + ridges);
      float ripple = sin(length(p.xz) * 3.4 - uTime * 2.7)
        * (uBeat * .24 + uBass * .12);
      p.y += bassLift + midLift + travelingWave + ripple;
      p.xz *= 1.0 + uBeat * .025;
      float summit = clamp((p.y + 1.0) * .18 + uTreble * .28 + uBeat * .22, 0.0, .62);
      vParticleColor = mix(uColor, vec3(1.0), summit);
    } else if (uPreset < 6.5) {
      int bandIndex = int(clamp(floor(aSpectrumBand + .5), 0.0, 31.0));
      float amplitude = pow(clamp(uSpectrum[bandIndex], 0.0, 1.0), .68);
      float level = clamp(p.y, 0.0, 1.0);
      float lowBand = 1.0 - smoothstep(1.0, 11.0, aSpectrumBand);
      float visibleHeight = clamp(.035 + amplitude * .92 + uBeat * lowBand * .16, .035, 1.0);
      float activePoint = 1.0 - smoothstep(visibleHeight, visibleHeight + .035, level);
      float peakLine = 1.0 - smoothstep(.025, .09, abs(level - visibleHeight));
      p.y = -1.72 + level * 4.7;
      p.z += sin(aSpectrumBand * 1.7 + level * 8.0 + uTime * 2.4) * amplitude * .045;
      p.x *= 1.0 + uBeat * lowBand * .018;
      float hot = clamp(level * .36 + amplitude * .42 + peakLine * .34 + uBeat * lowBand * .2, 0.0, .88);
      vParticleColor = mix(uColor, vec3(1.0, .72, .92), hot);
      vParticleAlpha = activePoint * (.48 + amplitude * .52);
      spectrumGlow = activePoint * (amplitude * .85 + peakLine * .35 + uBeat * lowBand * .5);
    } else {
      float bandCoordinate = clamp(aSpectrumBand, 0.0, 31.0);
      int bandIndex = int(floor(bandCoordinate));
      int nextBandIndex = min(31, bandIndex + 1);
      float amplitude = pow(
        clamp(mix(uSpectrum[bandIndex], uSpectrum[nextBandIndex], fract(bandCoordinate)), 0.0, 1.0),
        .72
      );
      float radius = max(.001, length(p.xy));
      vec2 radial = p.xy / radius;
      float lowBand = 1.0 - smoothstep(1.0, 11.0, aSpectrumBand);
      float innerRing = 1.0 - smoothstep(1.82, 1.88, radius);
      float outerRing = 1.0 - innerRing;
      float outerThickness = radius - 1.96;
      float waveformRadius = 1.96 + amplitude * 1.34 + uBeat * lowBand * .16;
      float microRipple = sin(atan(p.y, p.x) * 6.0 - uTime * 2.0 + bandCoordinate * .12)
        * amplitude * .025;
      float targetRadius = mix(radius, waveformRadius + outerThickness + microRipple, outerRing);
      p.xy = radial * targetRadius;
      p.z += outerRing * sin(atan(p.y, p.x) * 3.0 + uTime * 1.2) * amplitude * .045;
      float hot = clamp(amplitude * .56 + outerRing * .12 + uBeat * lowBand * .2, 0.0, .82);
      vParticleColor = mix(uColor, vec3(1.0), hot);
      vParticleAlpha = innerRing * .88 + outerRing * (.48 + amplitude * .52);
      spectrumGlow = innerRing * .26 + outerRing * (amplitude * .92 + .12);
    }
    p *= 1.0 + uEnergy * (.14 + seed * .2) + uBeat * .1;
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    float distanceToCamera = max(.5, -mvPosition.z);
    gl_PointSize = clamp(uPointSize * (30.0 / distanceToCamera), 1.2, 11.0);
    gl_Position = projectionMatrix * mvPosition;
    vGlow = clamp(.3 + uEnergy * .68 + uTreble * .42 + uBeat * .58 + spectrumGlow + sin(uTime * (1.0 + seed) + seed * 20.0) * .16, .18, 1.7);
  }
`;

export const PARTICLE_FRAGMENT_SHADER = `
  varying float vGlow;
  varying vec3 vParticleColor;
  varying float vParticleAlpha;
  void main() {
    vec2 point = gl_PointCoord - .5;
    float edge = 1.0 - smoothstep(.18, .5, length(point));
    if (edge < .01) discard;
    gl_FragColor = vec4(vParticleColor, edge * vGlow * vParticleAlpha);
  }
`;
