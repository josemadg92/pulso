import * as THREE from 'three';
import { createSpring } from './spring.js';
import { noise3 } from './shaders/noise.js';
import { frameDue } from './render-budget.js';

const PALETTE = {
  void: new THREE.Color('#07060c'),
  violet: new THREE.Color('#8b5cf6'),
  magenta: new THREE.Color('#ff3d9a'),
  cyan: new THREE.Color('#22d3ee'),
  light: new THREE.Color('#f5f3ff'),
};

const paletteUniforms = () => ({
  uVoid: { value: PALETTE.void },
  uViolet: { value: PALETTE.violet },
  uMagenta: { value: PALETTE.magenta },
  uCyan: { value: PALETTE.cyan },
  uLight: { value: PALETTE.light },
});

export async function createScene({ canvas, screen, pointer, reduce }) {
  const lowPower = (navigator.hardwareConcurrency ?? 8) <= 4 || window.matchMedia('(pointer: coarse)').matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowPower, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowPower ? 1 : 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(0, 0, 7);

  // ---------- Fondo: nebulosa de luz de escenario ----------
  // Se calcula en un búfer a media resolución: son formas grandes y suaves, así que al
  // ampliarlo no se pierde nada y la parte más cara cuesta la cuarta parte. Media precisión
  // de coma flotante para que los degradados oscuros no hagan bandas.
  const FOG_SCALE = 0.5;
  const fogTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
  const fogScene = new THREE.Scene();
  const bgUniforms = {
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uFocus: { value: new THREE.Vector2(0.68, 0.55) },
    ...paletteUniforms(),
  };

  const background = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms: bgUniforms,
      depthTest: false,
      depthWrite: false,
      vertexShader: /* glsl */ `
        void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform float uTime;
        uniform vec2 uRes, uFocus;
        uniform vec3 uVoid, uViolet, uMagenta, uCyan, uLight;
        ${noise3}

        float fbm(vec3 p) {
          float a = 0.5, f = 0.0;
          for (int i = 0; i < ${lowPower ? 3 : 4}; i++) { f += a * snoise(p); p *= 2.02; a *= 0.5; }
          return f * 0.5 + 0.5;
        }

        void main() {
          vec2 uv = gl_FragCoord.xy / uRes;
          float aspect = uRes.x / uRes.y;
          vec2 p = (uv - 0.5) * vec2(aspect, 1.0) * 0.9;
          float t = uTime * 0.04;

          // Humo de escenario: domain warping lento
          vec2 q = vec2(fbm(vec3(p, t)), fbm(vec3(p + vec2(5.2, 1.3), -t)));
          float f = fbm(vec3(p + 1.6 * q, t * 1.5));

          vec3 col = uVoid;
          col += uViolet * smoothstep(0.42, 0.9, f) * 0.5;
          col += uMagenta * smoothstep(0.55, 0.92, q.x) * 0.28 * (1.0 - uv.y * 0.6);
          col += uCyan * smoothstep(0.68, 0.96, q.y) * 0.18;

          // Haces de luz desde el techo, como focos atravesando el humo
          float beams = 0.0;
          for (int i = 0; i < 3; i++) {
            float fi = float(i);
            float x = 0.22 + fi * 0.3 + sin(uTime * 0.11 + fi * 2.1) * 0.06;
            float w = abs((uv.x - x) * aspect + (1.0 - uv.y) * (fi - 1.0) * 0.18);
            beams += exp(-w * w * 90.0) * smoothstep(0.1, 1.0, uv.y) * (0.5 + 0.5 * f);
          }
          col += mix(uViolet, uLight, 0.25) * beams * 0.16;

          // Halo detrás de la escultura
          vec2 d = (uv - uFocus) * vec2(aspect, 1.0);
          col += uViolet * 0.5 * exp(-dot(d, d) * 5.0);
          col += uMagenta * 0.12 * exp(-dot(d, d) * 16.0);

          // Viñeta (el grano va en la pasada a resolución completa)
          col *= smoothstep(1.35, 0.2, length((uv - 0.5) * vec2(1.2, 1.0)));

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    }),
  );
  background.frustumCulled = false;
  fogScene.add(background);

  // Pasada a resolución completa: amplía la niebla y añade el grano de película píxel a píxel
  const compositeUniforms = { tFog: { value: fogTarget.texture }, uTime: bgUniforms.uTime };
  const composite = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms: compositeUniforms,
      depthTest: false,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D tFog;
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          vec3 col = texture2D(tFog, vUv).rgb;
          float grain = fract(sin(dot(gl_FragCoord.xy + fract(uTime) * 91.0, vec2(12.9898, 78.233))) * 43758.5453);
          col += (grain - 0.5) * 0.035;
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }
      `,
    }),
  );
  composite.frustumCulled = false;
  composite.renderOrder = -1;
  scene.add(composite);

  // ---------- Escultura de vidrio líquido ----------
  const blobUniforms = {
    uTime: { value: 0 },
    uEnergy: { value: 0 },
    ...paletteUniforms(),
  };

  const blob = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1, lowPower ? 40 : 72),
    new THREE.ShaderMaterial({
      uniforms: blobUniforms,
      vertexShader: /* glsl */ `
        uniform float uTime, uEnergy;
        varying vec3 vWorld;
        ${noise3}
        void main() {
          vec3 n = normalize(position);
          float amp = 0.3 + uEnergy * 0.25;
          float d = snoise(n * 0.9 + vec3(0.0, uTime * 0.28, 0.0)) * amp
                  + snoise(n * 1.9 - vec3(uTime * 0.36)) * amp * 0.18;
          vec4 world = modelMatrix * vec4(position + n * d, 1.0);
          vWorld = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform vec3 uVoid, uViolet, uMagenta, uCyan, uLight;
        varying vec3 vWorld;

        // Refleja una sala oscura iluminada con neones de la paleta PULSO
        vec3 room(vec3 r) {
          vec3 c = mix(uMagenta, uViolet, smoothstep(-0.6, 0.2, r.y));
          c = mix(c, uCyan, smoothstep(0.3, 0.9, r.y + r.x * 0.4));
          c = mix(c, uLight, smoothstep(0.86, 1.0, r.y) * 0.9);
          return mix(uVoid, c, smoothstep(-1.0, 0.1, r.z) * 0.9 + 0.1);
        }

        void main() {
          vec3 N = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
          vec3 V = normalize(cameraPosition - vWorld);
          float ndv = clamp(dot(N, V), 0.0, 1.0);
          float fres = pow(1.0 - ndv, 2.2);

          vec3 R = reflect(-V, N);
          vec3 col = mix(uVoid * 2.5, room(R), 0.4 + 0.6 * fres);

          vec3 L = normalize(vec3(-0.5, 0.8, 0.6));
          col += pow(max(dot(R, L), 0.0), 64.0) * 0.9;
          col += mix(uCyan, uMagenta, R.x * 0.5 + 0.5) * pow(fres, 3.0) * 0.9;

          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }
      `,
    }),
  );
  scene.add(blob);

  // ---------- Tamaño y composición ----------
  let baseX = 0;
  let baseY = 0;
  let running = false;
  const resize = () => {
    const rect = screen.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    const fogW = Math.max(1, Math.round(width * renderer.getPixelRatio() * FOG_SCALE));
    const fogH = Math.max(1, Math.round(height * renderer.getPixelRatio() * FOG_SCALE));
    fogTarget.setSize(fogW, fogH);
    bgUniforms.uRes.value.set(fogW, fogH);

    // En panorámico la escultura va a la derecha, por encima del titular; en vertical, centrada arriba
    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    const wide = camera.aspect > 1.15;
    baseX = wide ? Math.min(2.1, camera.aspect * 0.7) : 0;
    baseY = wide ? halfH * 0.14 : halfH * 0.42;
    blob.scale.setScalar(wide ? 1.2 : Math.min(1, camera.aspect * 1.6));
    bgUniforms.uFocus.value.set(0.5 + baseX / (2 * halfH * camera.aspect), 0.5 + baseY / (2 * halfH));
    if (!running) render(0);
  };

  // ---------- Bucle ----------
  const rotX = createSpring(0, { stiffness: 60, damping: 12 });
  const rotY = createSpring(0, { stiffness: 60, damping: 12 });
  const posX = createSpring(0, { stiffness: 70, damping: 14 });
  const posY = createSpring(0, { stiffness: 70, damping: 14 });
  let energy = 0;
  let time = reduce ? 14 : 0;

  const render = (dt) => {
    if (!reduce) {
      time += dt;
      rotY.target = pointer.x * 0.7;
      rotX.target = pointer.y * 0.45;
      posX.target = pointer.x * 0.22;
      posY.target = -pointer.y * 0.16;
      pointer.speed *= Math.exp(-dt * 2.5);
      energy += (pointer.speed - energy) * Math.min(1, dt * 4);
    }
    blob.rotation.set(rotX.step(dt) + time * 0.05, rotY.step(dt) + time * 0.08, 0);
    blob.position.set(baseX + posX.step(dt), baseY + posY.step(dt), 0);

    bgUniforms.uTime.value = time;
    blobUniforms.uTime.value = time;
    blobUniforms.uEnergy.value = energy;
    renderer.setRenderTarget(fogTarget);
    renderer.render(fogScene, camera);
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
  };

  let visible = true;
  let raf = 0;
  let prev = 0;
  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    if (!frameDue(now, prev)) return;
    const dt = Math.min(0.05, (now - prev) / 1000);
    prev = now;
    render(dt);
  };
  const play = () => {
    if (running || reduce || !visible || document.hidden) return;
    running = true;
    prev = performance.now();
    raf = requestAnimationFrame(loop);
  };
  const pause = () => {
    running = false;
    cancelAnimationFrame(raf);
  };

  // Shaders compilados en segundo plano antes del primer dibujo: compilarlos de golpe
  // congelaría el navegador un instante, y si coincide con el scroll se nota como un tirón.
  await renderer.compileAsync(fogScene, camera);
  await renderer.compileAsync(scene, camera);

  new ResizeObserver(resize).observe(screen);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    visible ? play() : pause();
  }).observe(screen);
  document.addEventListener('visibilitychange', () => (document.hidden ? pause() : play()));

  resize();
  // Esperamos un fotograma pintado antes de revelar el canvas sobre el degradado
  requestAnimationFrame(() => screen.setAttribute('data-ready', ''));
  play();
}
