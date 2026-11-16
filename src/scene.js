import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const PALETTES = {
  aurora: { primary: '#54f1ee', secondary: '#9362ff', spark: '#d0ffb0', chrome: '#d5dce8' },
  violet: { primary: '#b58aff', secondary: '#526dff', spark: '#ffb9f8', chrome: '#e0d8ed' },
  sunset: { primary: '#ffac7c', secondary: '#ef67b7', spark: '#ffe3a0', chrome: '#e9ddd6' }
};
const TAU = Math.PI * 2;

class RibbonCurve extends THREE.Curve {
  getPoint(t, target = new THREE.Vector3()) {
    const angle = t * TAU;
    const radius = 1.33 * (2 + Math.cos(3 * angle)) * 0.5;
    return target.set(radius * Math.cos(2 * angle), radius * Math.sin(2 * angle), Math.sin(3 * angle) * 0.84);
  }
}

// A closed, bevelled elliptical ribbon, with a slow full twist along the knot.
// Its continuously changing surface gives the studio environment broad chrome highlights.
function makeRibbon() {
  const curve = new RibbonCurve();
  const length = 360;
  const radial = 28;
  const frames = curve.computeFrenetFrames(length, true);
  const vertices = [];
  const uv = [];
  const indices = [];
  const edgeA = [];
  const edgeB = [];
  const center = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const binormal = new THREE.Vector3();
  const point = new THREE.Vector3();
  for (let i = 0; i <= length; i++) {
    const t = i / length;
    curve.getPointAt(i === length ? 0 : t, center);
    const frameIndex = i === length ? 0 : i;
    const twist = TAU * t + Math.sin(TAU * t * 3) * 0.24;
    normal.copy(frames.normals[frameIndex]).multiplyScalar(Math.cos(twist)).addScaledVector(frames.binormals[frameIndex], Math.sin(twist));
    binormal.copy(frames.binormals[frameIndex]).multiplyScalar(Math.cos(twist)).addScaledVector(frames.normals[frameIndex], -Math.sin(twist));
    const width = 0.43 + Math.sin(TAU * t * 3 + 0.6) * 0.045;
    const thickness = 0.145;
    edgeA.push(center.clone().addScaledVector(normal, width));
    edgeB.push(center.clone().addScaledVector(normal, -width));
    for (let j = 0; j <= radial; j++) {
      const theta = j / radial * TAU;
      point.copy(center).addScaledVector(normal, Math.cos(theta) * width).addScaledVector(binormal, Math.sin(theta) * thickness);
      vertices.push(point.x, point.y, point.z);
      uv.push(t, j / radial);
      if (i < length && j < radial) {
        const a = i * (radial + 1) + j;
        const b = (i + 1) * (radial + 1) + j;
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const normals = geometry.getAttribute('normal');
  const seamNormal = new THREE.Vector3();
  const otherNormal = new THREE.Vector3();
  const smoothSeam = (a, b) => {
    seamNormal.fromBufferAttribute(normals, a).add(otherNormal.fromBufferAttribute(normals, b)).normalize();
    normals.setXYZ(a, seamNormal.x, seamNormal.y, seamNormal.z);
    normals.setXYZ(b, seamNormal.x, seamNormal.y, seamNormal.z);
  };
  for (let i = 0; i <= length; i++) smoothSeam(i * (radial + 1), i * (radial + 1) + radial);
  for (let j = 0; j <= radial; j++) smoothSeam(j, length * (radial + 1) + j);
  geometry.computeBoundingSphere();
  return { geometry, edgeA, edgeB };
}

function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) return null;
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.13, 'rgba(255,255,255,.58)');
  gradient.addColorStop(0.38, 'rgba(255,255,255,.16)');
  gradient.addColorStop(0.7, 'rgba(255,255,255,.035)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function randomGenerator(seed) {
  return () => {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

export function initScene(canvas, { reducedMotion = false, onReady = () => {} } = {}) {
  const noop = { setPalette() {}, destroy() {} };
  if (!canvas || typeof canvas.getContext !== 'function') return noop;
  let renderer;
  let environmentTarget;
  let resizeObserver;
  let intersectionObserver;
  let frame = 0;
  let destroyed = false;
  let contextLost = false;
  let inView = true;
  let ready = false;
  let width = 0;
  let height = 0;
  let elapsed = 0;
  let lastTime = 0;
  const listeners = [];
  const resources = new Set();
  const originalTouchAction = canvas.style.touchAction;
  const originalCursor = canvas.style.cursor;
  const originalPointerEvents = canvas.style.pointerEvents;
  const originalTabIndex = canvas.getAttribute('tabindex');
  const stage = canvas.closest('.hero-visual') || canvas.parentElement;
  const listen = (target, name, handler, options) => {
    target.addEventListener(name, handler, options);
    listeners.push(() => target.removeEventListener(name, handler, options));
  };
  const resource = value => { resources.add(value); return value; };
  const fallback = () => {
    contextLost = true;
    cancelAnimationFrame(frame);
    frame = 0;
    stage?.classList.remove('scene-ready');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.pointerEvents = 'none';
    canvas.tabIndex = -1;
  };

  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, depth: true, stencil: false, powerPreference: 'high-performance' });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
    camera.position.set(0, 0.15, 9.8);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    try {
      environmentTarget = pmrem.fromScene(room, 0.045);
      scene.environment = environmentTarget.texture;
      scene.environmentIntensity = 1.55;
    } finally {
      room.dispose();
      pmrem.dispose();
    }

    const sculpture = new THREE.Group();
    sculpture.rotation.set(0.24, -0.23, -0.32);
    scene.add(sculpture);

    const { geometry, edgeA, edgeB } = makeRibbon();
    resource(geometry);
    const chrome = resource(new THREE.MeshPhysicalMaterial({ color: '#d5dce8', metalness: 1, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 1.7, iridescence: 0.26, iridescenceIOR: 1.28, iridescenceThicknessRange: [130, 280] }));
    const body = new THREE.Mesh(geometry, chrome);
    sculpture.add(body);

    const primaryMaterials = [];
    const secondaryMaterials = [];
    function luminousEdge(points, color, materials) {
      // Closely spaced samples preserve the same silhouette as the physical ribbon.
      const path = new THREE.CatmullRomCurve3(points.slice(0, -1), true, 'centripetal');
      for (const [radius, opacity] of [[0.042, 0.075], [0.022, 0.19], [0.009, 0.92]]) {
        const edgeGeometry = resource(new THREE.TubeGeometry(path, 360, radius, 6, true));
        const material = resource(new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
        materials.push(material);
        const edge = new THREE.Mesh(edgeGeometry, material);
        edge.renderOrder = 2;
        sculpture.add(edge);
      }
    }
    luminousEdge(edgeA, PALETTES.aurora.primary, primaryMaterials);
    luminousEdge(edgeB, PALETTES.aurora.secondary, secondaryMaterials);

    const whiteKey = new THREE.DirectionalLight('#e5eeff', 4.1);
    whiteKey.position.set(-3, 6, 6);
    scene.add(whiteKey);
    const lowerFill = new THREE.DirectionalLight('#ccd8ff', 1.6);
    lowerFill.position.set(2, -4, 3);
    scene.add(lowerFill);
    const cyanLight = new THREE.PointLight(PALETTES.aurora.primary, 38, 16, 2);
    cyanLight.position.set(-3, 1.8, 3.2);
    scene.add(cyanLight);
    const violetLight = new THREE.PointLight(PALETTES.aurora.secondary, 46, 16, 2);
    violetLight.position.set(3, -0.3, 2.4);
    scene.add(violetLight);
    const backLight = new THREE.PointLight('#ffffff', 34, 14, 2);
    backLight.position.set(0, 3, -3);
    scene.add(backLight);

    const haloGroup = new THREE.Group();
    haloGroup.rotation.set(0.95, -0.14, -0.46);
    haloGroup.position.z = -0.75;
    scene.add(haloGroup);
    const haloMaterial = resource(new THREE.LineBasicMaterial({ color: PALETTES.aurora.primary, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }));
    const secondHaloMaterial = resource(new THREE.LineBasicMaterial({ color: PALETTES.aurora.secondary, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }));
    for (let k = 0; k < 2; k++) {
      const points = [];
      const radius = k ? 3.22 : 2.9;
      for (let i = 0; i < 150; i++) { const angle = i / 150 * TAU; points.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0)); }
      const orbitGeometry = resource(new THREE.BufferGeometry().setFromPoints(points));
      const orbit = new THREE.LineLoop(orbitGeometry, k ? secondHaloMaterial : haloMaterial);
      if (k) orbit.rotation.set(0.22, 0.13, 0);
      haloGroup.add(orbit);
    }

    const texture = glowTexture();
    if (texture) resource(texture);
    function glow(color, scale, opacity, position) {
      const material = resource(new THREE.SpriteMaterial({ color, map: texture, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(scale, scale, 1);
      sprite.position.copy(position);
      scene.add(sprite);
      return sprite;
    }
    const primaryGlow = glow(PALETTES.aurora.primary, 5.7, 0.10, new THREE.Vector3(-1.6, 0.5, -2));
    const secondaryGlow = glow(PALETTES.aurora.secondary, 5.1, 0.12, new THREE.Vector3(1.7, -0.2, -2.4));
    const floorGlow = glow(PALETTES.aurora.primary, 4.2, 0.13, new THREE.Vector3(0, -2.65, -0.6));
    floorGlow.scale.y = 0.68;

    const satellites = [];
    const smallSphere = resource(new THREE.SphereGeometry(1, 24, 18));
    const satelliteChrome = resource(new THREE.MeshStandardMaterial({ color: '#cbd5e5', metalness: 1, roughness: 0.12, envMapIntensity: 2 }));
    const sparkMaterial = resource(new THREE.MeshBasicMaterial({ color: PALETTES.aurora.spark, toneMapped: false }));
    for (let i = 0; i < 5; i++) {
      const dot = new THREE.Mesh(smallSphere, i < 3 ? satelliteChrome : sparkMaterial);
      const size = [0.10, 0.065, 0.14, 0.028, 0.023][i];
      dot.scale.setScalar(size);
      scene.add(dot);
      satellites.push({ mesh: dot, angle: i * 1.47 + 0.4, radius: 2.72 + i * 0.13, speed: 0.09 + i * 0.011, yScale: i % 2 ? 0.82 : 0.66 });
    }

    const random = randomGenerator(88013);
    const particlePositions = [];
    for (let i = 0; i < 84; i++) {
      const angle = random() * TAU;
      const radius = 2.65 + random() * 2.4;
      particlePositions.push(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.84, -2.5 + random() * 2.8);
    }
    const particleGeometry = resource(new THREE.BufferGeometry());
    particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(particlePositions, 3));
    const particleMaterial = resource(new THREE.PointsMaterial({ color: PALETTES.aurora.primary, size: 0.024, map: texture, transparent: true, opacity: 0.64, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, toneMapped: false }));
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    const pointer = { x: 0, y: 0 };
    const rotation = { x: 0, y: 0 };
    const targetRotation = { x: 0, y: 0 };
    let dragging = false;
    let activePointer = null;
    let startX = 0;
    let startY = 0;
    let startRotationX = 0;
    let startRotationY = 0;

    function schedule() {
      if (destroyed || contextLost || frame || !inView || document.hidden || !width || !height) return;
      frame = requestAnimationFrame(render);
    }
    function render(now) {
      frame = 0;
      if (destroyed || contextLost || !inView || document.hidden || !width || !height) return;
      const delta = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0;
      lastTime = now;
      if (!reducedMotion) elapsed += delta;
      const smoothing = reducedMotion ? 1 : Math.min(1, delta * 9 + 0.035);
      rotation.x += (targetRotation.x - rotation.x) * smoothing;
      rotation.y += (targetRotation.y - rotation.y) * smoothing;
      sculpture.rotation.set(0.24 + rotation.x + pointer.y * 0.065, -0.23 + rotation.y + elapsed * 0.095 + pointer.x * 0.08, -0.32 + Math.sin(elapsed * 0.22) * (reducedMotion ? 0 : 0.035));
      sculpture.position.y = reducedMotion ? 0 : Math.sin(elapsed * 0.65) * 0.075;
      haloGroup.rotation.z = -0.46 - elapsed * 0.032;
      particles.rotation.z = elapsed * 0.014;
      camera.position.x += (pointer.x * 0.16 - camera.position.x) * smoothing;
      camera.position.y += (0.15 - pointer.y * 0.10 - camera.position.y) * smoothing;
      camera.lookAt(0, -0.02, 0);
      satellites.forEach((satellite, i) => {
        const angle = satellite.angle + elapsed * satellite.speed;
        satellite.mesh.position.set(Math.cos(angle) * satellite.radius, Math.sin(angle) * satellite.radius * satellite.yScale, Math.sin(angle + i) * 0.9 - 0.35);
      });
      try {
        renderer.render(scene, camera);
        if (!ready) {
          ready = true;
          canvas.removeAttribute('aria-hidden');
          try { onReady(); } catch { /* A host callback must not stop the rendering loop. */ }
        }
      } catch {
        fallback();
        return;
      }
      if (!reducedMotion) schedule();
    }
    function resize() {
      if (destroyed || contextLost) return;
      const bounds = canvas.getBoundingClientRect();
      width = Math.round(bounds.width);
      height = Math.round(bounds.height);
      if (!width || !height) return;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75, Math.sqrt(1800000 / (width * height)));
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      const aspect = width / height;
      camera.aspect = aspect;
      camera.position.z = aspect < 0.86 ? 9.8 * 0.86 / aspect : 9.8;
      camera.updateProjectionMatrix();
      schedule();
    }
    function pointerMove(event) {
      const bounds = canvas.getBoundingClientRect();
      pointer.x = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1));
      pointer.y = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1));
      if (dragging && event.pointerId === activePointer) {
        const dx = event.clientX - startX;
        const dy = event.clientY - startY;
        targetRotation.y = startRotationY + dx * 0.008;
        if (event.pointerType !== 'touch') targetRotation.x = Math.max(-1.15, Math.min(1.15, startRotationX + dy * 0.006));
      }
      schedule();
    }
    function releasePointer(event) {
      if (activePointer !== null && event.pointerId !== activePointer) return;
      dragging = false;
      activePointer = null;
      canvas.style.cursor = 'grab';
      try { if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); } catch { /* The browser may already release a cancelled touch. */ }
      schedule();
    }
    canvas.style.touchAction = 'pan-y';
    canvas.style.cursor = 'grab';
    if (!canvas.hasAttribute('tabindex')) canvas.tabIndex = 0;
    if (!canvas.hasAttribute('aria-label')) canvas.setAttribute('aria-label', 'Трёхмерная хромированная скульптура ZigZak. Потяните или используйте стрелки для вращения.');
    listen(canvas, 'pointerdown', event => {
      if (event.button !== 0 || activePointer !== null) return;
      dragging = true;
      activePointer = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      startRotationX = targetRotation.x;
      startRotationY = targetRotation.y;
      canvas.style.cursor = 'grabbing';
      try { canvas.setPointerCapture(event.pointerId); } catch { /* Pointer capture is optional. */ }
      schedule();
    });
    listen(canvas, 'pointermove', pointerMove, { passive: true });
    listen(canvas, 'pointerup', releasePointer);
    listen(canvas, 'pointercancel', releasePointer);
    listen(canvas, 'lostpointercapture', event => { if (dragging) releasePointer(event); });
    listen(canvas, 'pointerleave', () => { if (!dragging) { pointer.x = pointer.y = 0; schedule(); } });
    listen(canvas, 'keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
      event.preventDefault();
      if (event.key === 'ArrowLeft') targetRotation.y -= 0.2;
      if (event.key === 'ArrowRight') targetRotation.y += 0.2;
      if (event.key === 'ArrowUp') targetRotation.x = Math.max(-1.15, targetRotation.x - 0.15);
      if (event.key === 'ArrowDown') targetRotation.x = Math.min(1.15, targetRotation.x + 0.15);
      if (event.key === 'Home') { targetRotation.x = targetRotation.y = 0; pointer.x = pointer.y = 0; }
      schedule();
    });
    listen(canvas, 'webglcontextlost', event => { event.preventDefault(); fallback(); });
    listen(document, 'visibilitychange', () => {
      if (document.hidden) { cancelAnimationFrame(frame); frame = 0; lastTime = 0; }
      else schedule();
    });
    if ('ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(canvas);
    } else listen(window, 'resize', resize, { passive: true });
    if ('IntersectionObserver' in window) {
      intersectionObserver = new IntersectionObserver(entries => {
        inView = entries[0]?.isIntersecting ?? true;
        if (inView) { lastTime = 0; schedule(); }
        else { cancelAnimationFrame(frame); frame = 0; lastTime = 0; }
      }, { rootMargin: '40px', threshold: 0 });
      intersectionObserver.observe(canvas);
    }

    function setPalette(name) {
      const palette = PALETTES[name] || PALETTES.aurora;
      primaryMaterials.forEach(material => material.color.set(palette.primary));
      secondaryMaterials.forEach(material => material.color.set(palette.secondary));
      cyanLight.color.set(palette.primary);
      violetLight.color.set(palette.secondary);
      primaryGlow.material.color.set(palette.primary);
      secondaryGlow.material.color.set(palette.secondary);
      floorGlow.material.color.set(palette.primary);
      haloMaterial.color.set(palette.primary);
      secondHaloMaterial.color.set(palette.secondary);
      particleMaterial.color.set(palette.primary);
      sparkMaterial.color.set(palette.spark);
      chrome.color.set(palette.chrome);
      schedule();
    }
    function destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      listeners.forEach(remove => remove());
      resources.forEach(item => item.dispose?.());
      environmentTarget?.dispose();
      renderer.dispose();
      canvas.style.touchAction = originalTouchAction;
      canvas.style.cursor = originalCursor;
      canvas.style.pointerEvents = originalPointerEvents;
      if (originalTabIndex === null) canvas.removeAttribute('tabindex'); else canvas.setAttribute('tabindex', originalTabIndex);
    }
    resize();
    return { setPalette, destroy };
  } catch {
    fallback();
    resizeObserver?.disconnect();
    intersectionObserver?.disconnect();
    listeners.forEach(remove => remove());
    resources.forEach(item => item.dispose?.());
    environmentTarget?.dispose();
    renderer?.dispose();
    return noop;
  }
}
