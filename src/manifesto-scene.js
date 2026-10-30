import * as THREE from 'three';
import { frameDue } from './render-budget.js';

// Una esfera de esquirlas que gira (01), estalla (02) y se recompone en un anillo-portal (03).
export function createManifestoScene({ canvas, section, state, reduce }) {
  const lowPower = (navigator.hardwareConcurrency ?? 8) <= 4 || window.matchMedia('(pointer: coarse)').matches;
  const COUNT = lowPower ? 900 : 1800;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowPower, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowPower ? 1 : 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
  camera.position.set(0, 0, 7.5);

  const base = new THREE.TetrahedronGeometry(0.075);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = base.index;
  geometry.attributes.position = base.attributes.position;
  geometry.attributes.normal = base.attributes.normal;
  geometry.instanceCount = COUNT;

  const sphere = new Float32Array(COUNT * 3);
  const torus = new Float32Array(COUNT * 3);
  const rand = new Float32Array(COUNT * 4);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < COUNT; i++) {
    // Esfera de Fibonacci: reparto uniforme de esquirlas
    const y = 1 - (i / (COUNT - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const a = golden * i;
    sphere.set([Math.cos(a) * r * 1.45, y * 1.45, Math.sin(a) * r * 1.45], i * 3);

    // Toro: el portal final
    const u = (i / COUNT) * Math.PI * 2;
    const v = ((i * 0.618034 * 13) % 1) * Math.PI * 2;
    const R = 1.5;
    const tube = 0.28 + Math.random() * 0.12;
    torus.set([(R + tube * Math.cos(v)) * Math.cos(u), (R + tube * Math.cos(v)) * Math.sin(u), tube * Math.sin(v)], i * 3);

    rand.set([Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random()], i * 4);
  }
  geometry.setAttribute('aSphere', new THREE.InstancedBufferAttribute(sphere, 3));
  geometry.setAttribute('aTorus', new THREE.InstancedBufferAttribute(torus, 3));
  geometry.setAttribute('aRand', new THREE.InstancedBufferAttribute(rand, 4));

  const uniforms = {
    uP: { value: state.progress },
    uTime: { value: 0 },
    uViolet: { value: new THREE.Color('#8b5cf6') },
    uMagenta: { value: new THREE.Color('#ff3d9a') },
    uCyan: { value: new THREE.Color('#22d3ee') },
    uLight: { value: new THREE.Color('#f5f3ff') },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      uniform float uP, uTime;
      attribute vec3 aSphere, aTorus;
      attribute vec4 aRand;
      varying vec3 vNormal, vView;
      varying float vBurst, vMorph, vSeed;

      mat3 rotAxis(vec3 axis, float a) {
        float s = sin(a), c = cos(a), oc = 1.0 - c;
        return mat3(oc * axis.x * axis.x + c, oc * axis.x * axis.y + axis.z * s, oc * axis.z * axis.x - axis.y * s,
                    oc * axis.x * axis.y - axis.z * s, oc * axis.y * axis.y + c, oc * axis.y * axis.z + axis.x * s,
                    oc * axis.z * axis.x + axis.y * s, oc * axis.y * axis.z - axis.x * s, oc * axis.z * axis.z + c);
      }

      void main() {
        float burst = sin(3.14159 * smoothstep(0.22, 0.78, uP));
        float morph = smoothstep(0.55, 0.92, uP);
        vec3 dir = normalize(aSphere + aRand.xyz * 0.6);
        vec3 center = mix(aSphere, aTorus, morph) + dir * burst * (0.35 + aRand.w * 1.3);

        mat3 rot = rotAxis(normalize(aRand.xyz + 0.001), uTime * (0.2 + aRand.w) + uP * 10.0 * (aRand.w + 0.3));
        vec3 local = rot * position * (1.0 + burst * 0.35 + aRand.w * 0.5);

        vec4 world = modelMatrix * vec4(center + local, 1.0);
        vNormal = normalize(mat3(modelMatrix) * (rot * normal));
        vView = normalize(cameraPosition - world.xyz);
        vBurst = burst;
        vMorph = morph;
        vSeed = aRand.w;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uViolet, uMagenta, uCyan, uLight;
      varying vec3 vNormal, vView;
      varying float vBurst, vMorph, vSeed;

      void main() {
        vec3 N = normalize(vNormal);
        float fres = pow(1.0 - abs(dot(N, vView)), 2.0);
        float lit = max(dot(N, normalize(vec3(-0.4, 0.8, 0.5))), 0.0);

        vec3 col = mix(uViolet, uCyan, smoothstep(0.3, 1.0, vSeed + N.y * 0.3));
        col = mix(col, uMagenta, vBurst * smoothstep(0.4, 0.9, vSeed));
        col = mix(col, uLight, vMorph * 0.25);
        col = col * (0.35 + lit * 0.9) + fres * mix(uCyan, uMagenta, vSeed) * 0.8;

        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  scene.add(mesh);

  const resize = () => {
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // En vertical alejamos la cámara para que el anillo quepa entero
    camera.position.z = camera.aspect < 1 ? 7.5 / Math.max(0.55, camera.aspect) : 7.5;
    // En panorámico la figura deja sitio al texto a la izquierda; en vertical sube por encima
    mesh.position.set(camera.aspect > 1.2 ? Math.min(2.2, camera.aspect * 0.95) : 0, camera.aspect > 1.2 ? 0.1 : 1.1, 0);
    camera.updateProjectionMatrix();
    if (!running) render(0);
  };

  let time = 0;
  let p = state.progress;
  const render = (dt) => {
    time += reduce ? 0 : dt;
    // Suavizado exponencial del progreso: el scroll a saltos no se nota en la figura
    p += (state.progress - p) * (reduce ? 1 : Math.min(1, dt * 8));
    uniforms.uP.value = p;
    uniforms.uTime.value = time;
    // Al formarse el anillo, la figura deja de girar y se encara a cámara: un portal, no una columna
    const morph = THREE.MathUtils.smoothstep(p, 0.55, 0.92);
    const free = 1 - morph;
    mesh.rotation.set(
      (0.35 + p * 0.9) * free + Math.sin(time * 0.4) * 0.08 * morph,
      (time * 0.08 + p * Math.PI * 1.6) * free + Math.cos(time * 0.3) * 0.12 * morph,
      time * 0.05 * morph,
    );
    renderer.render(scene, camera);
  };

  let running = false;
  let raf = 0;
  let prev = 0;
  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    if (!frameDue(now, prev)) return;
    render(Math.min(0.05, (now - prev) / 1000));
    prev = now;
  };
  const play = () => {
    if (running || reduce || document.hidden) return;
    running = true;
    prev = performance.now();
    raf = requestAnimationFrame(loop);
  };
  const pause = () => {
    running = false;
    cancelAnimationFrame(raf);
  };

  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([entry]) => (entry.isIntersecting ? play() : pause())).observe(section);
  document.addEventListener('visibilitychange', () => (document.hidden ? pause() : play()));
  resize();
  canvas.setAttribute('data-ready', '');
}
