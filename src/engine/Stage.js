import * as THREE from 'three';
import { seededRandom } from './MathUtil.js';

const NEBULA_VERT = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const NEBULA_FRAG = /* glsl */`
precision highp float;
varying vec3 vDir;
uniform float uTime;
uniform float uAccent;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                 mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                 mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}

float fbm(vec3 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}

void main() {
  vec3 d = vDir;
  float t = uTime * 0.012;

  float band = fbm(d * 2.2 + vec3(0.0, t, 0.0));
  float cloud = fbm(d * 5.5 + vec3(t * 0.6, t * 0.2, -t * 0.4));
  float drift = fbm(d * 11.0 - vec3(0.0, t * 2.0, 0.0));

  vec3 deep = vec3(0.008, 0.012, 0.030);
  vec3 cool = vec3(0.05, 0.12, 0.32);
  vec3 warm = vec3(0.26, 0.12, 0.34);

  float m = smoothstep(0.40, 0.98, band);
  vec3 col = deep;
  col = mix(col, cool, m * 0.62);
  col = mix(col, warm, smoothstep(0.55, 1.0, cloud) * 0.30 * uAccent);
  col += vec3(0.03, 0.06, 0.11) * pow(drift, 3.0) * 1.6;

  // horizon darkening keeps the UI readable against the field
  col *= 0.38 + 0.62 * smoothstep(-0.9, 0.55, d.y);
  gl_FragColor = vec4(col, 1.0);
}`;

const STAR_VERT = /* glsl */`
attribute float aSize;
attribute vec3 aColor;
attribute float aPhase;
varying vec3 vColor;
varying float vTwinkle;
uniform float uTime;
uniform float uPixelRatio;
void main() {
  vColor = aColor;
  vTwinkle = 0.62 + 0.38 * sin(uTime * 1.4 + aPhase);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uPixelRatio * (240.0 / -mv.z) * (0.85 + 0.15 * vTwinkle);
  gl_Position = projectionMatrix * mv;
}`;

const STAR_FRAG = /* glsl */`
precision highp float;
varying vec3 vColor;
varying float vTwinkle;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  if (d > 0.5) discard;
  float core = smoothstep(0.5, 0.0, d);
  float glow = pow(core, 3.5);
  gl_FragColor = vec4(vColor * (0.55 + glow * 1.6), core * vTwinkle);
}`;

export class Stage {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(48, 1, 0.05, 3000);
    this.camera.position.set(6.5, 5.2, 9.5);
    this.clock = new THREE.Clock();
    this.time = 0;

    this._buildBackground();
    this._buildLights();

    /** Where lesson content is mounted. */
    this.world = new THREE.Group();
    this.scene.add(this.world);
  }

  _buildBackground() {
    this.nebulaMat = new THREE.ShaderMaterial({
      vertexShader: NEBULA_VERT,
      fragmentShader: NEBULA_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uAccent: { value: 0.8 },
      },
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 40, 24), this.nebulaMat);
    sky.renderOrder = -100;
    this.scene.add(sky);

    const rand = seededRandom(20240401);
    const COUNT = 5200;
    const pos = new Float32Array(COUNT * 3);
    const col = new Float32Array(COUNT * 3);
    const size = new Float32Array(COUNT);
    const phase = new Float32Array(COUNT);
    const c = new THREE.Color();

    for (let i = 0; i < COUNT; i++) {
      // Shell distribution: fills the sky without crowding the centre.
      const u = rand() * 2 - 1;
      const th = rand() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const r = 260 + rand() * 900;
      pos[i * 3] = Math.cos(th) * s * r;
      pos[i * 3 + 1] = u * r * 0.75;
      pos[i * 3 + 2] = Math.sin(th) * s * r;

      const tint = rand();
      c.setHSL(tint < 0.62 ? 0.58 + rand() * 0.08 : 0.08 + rand() * 0.08,
        0.45 + rand() * 0.4, 0.72 + rand() * 0.25);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;

      size[i] = 0.55 + Math.pow(rand(), 3.2) * 4.2;
      phase[i] = rand() * Math.PI * 2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));

    this.starMat = new THREE.ShaderMaterial({
      vertexShader: STAR_VERT,
      fragmentShader: STAR_FRAG,
      uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.stars = new THREE.Points(geo, this.starMat);
    this.stars.renderOrder = -90;
    this.stars.frustumCulled = false;
    this.scene.add(this.stars);
  }

  _buildLights() {
    this.scene.add(new THREE.AmbientLight(0x94b4ff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.25);
    key.position.set(6, 10, 7);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x6ee7ff, 0.75);
    rim.position.set(-7, -3, -6);
    this.scene.add(rim);
    const fill = new THREE.PointLight(0xffd479, 0.5, 60);
    fill.position.set(-4, 5, 3);
    this.scene.add(fill);
    this.lights = { key, rim, fill };
  }

  setPixelRatio(pr) {
    this.starMat.uniforms.uPixelRatio.value = pr;
  }

  /** Nebula colour mood per subject (0 = cool, 1 = warm). */
  setMood(v) {
    this.nebulaMat.uniforms.uAccent.value = v;
  }

  update(dt) {
    this.time += dt;
    this.nebulaMat.uniforms.uTime.value = this.time;
    this.starMat.uniforms.uTime.value = this.time;
    this.stars.rotation.y += dt * 0.004;
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}
