import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Heart, Sparkles, Compass, Layers, EyeOff, Eye, Globe2, ShieldCheck } from 'lucide-react';

// Pre-allocated math helpers at module scope (Zero GC in the render loop)
const _dummyObj = new THREE.Object3D();
const _color = new THREE.Color();
const _targetCamPos = new THREE.Vector3();
const _lookAtPos = new THREE.Vector3(0, 0.15, 0);

export type CameraPreset = 'overview' | 'lattice' | 'beacon' | 'zenith';

interface SabaiBrandHero3DProps {
  onOpenDonate: () => void;
  onLoadSampleReport?: () => void;
}

export const SabaiBrandHero3D: React.FC<SabaiBrandHero3DProps> = ({
  onOpenDonate,
  onLoadSampleReport,
}) => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);

  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('overview');
  const [explodeFactor, setExplodeFactor] = useState<number>(0);
  const [themeFinish, setThemeFinish] = useState<'cobalt-gold' | 'emerald-brass' | 'obsidian-cyan'>('cobalt-gold');
  const [hudCollapsed, setHudCollapsed] = useState<boolean>(false);

  // Store mutable control targets in refs so React UI updates never recreate the WebGL context
  const stateRef = useRef({
    cameraPreset: 'overview' as CameraPreset,
    explodeTarget: 0,
    explodeCurrent: 0,
    themeFinish: 'cobalt-gold' as 'cobalt-gold' | 'emerald-brass' | 'obsidian-cyan',
    pointerX: 0,
    pointerY: 0,
  });

  useEffect(() => {
    stateRef.current.cameraPreset = cameraPreset;
  }, [cameraPreset]);

  useEffect(() => {
    stateRef.current.explodeTarget = explodeFactor;
  }, [explodeFactor]);

  useEffect(() => {
    stateRef.current.themeFinish = themeFinish;
  }, [themeFinish]);

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    // 1. Detect software WebGL from GPU renderer string
    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 260);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const bgHex = 0x090d16;
    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.FogExp2(bgHex, 0.065);

    // 2. Mandatory Studio Environment Reflection (RoomEnvironment)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 1.35, 5.4);
    camera.lookAt(_lookAtPos);

    // 3. Balanced 3-Point Studio Lighting Rig + Warm/Cool Contrast
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x1e1b4b, 0.85);
    hemiLight.position.set(0, 8, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff3d6, 2.4);
    keyLight.position.set(4.5, 6.5, 4.0);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 18;
    const d = 4.5;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.65);
    rimLight.position.set(-5.0, 3.5, -4.5);
    scene.add(rimLight);

    // Procedural radial contact shadow texture
    const createContactShadowTexture = () => {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 256;
      const ctx = c.getContext('2d');
      if (ctx) {
        const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 120);
        grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
        grad.addColorStop(0.55, 'rgba(5, 10, 25, 0.32)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 256, 256);
      }
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      return tex;
    };

    // Procedural dial/compass chapter ring texture
    const createChapterDialTexture = () => {
      const c = document.createElement('canvas');
      c.width = 512;
      c.height = 512;
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, 512, 512);
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.38)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(256, 256, 230, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(256, 256, 185, 0, Math.PI * 2);
        ctx.stroke();

        for (let i = 0; i < 72; i++) {
          const angle = (i / 72) * Math.PI * 2;
          const innerR = i % 6 === 0 ? 192 : 210;
          const outerR = 228;
          ctx.strokeStyle = i % 6 === 0 ? 'rgba(251, 191, 36, 0.75)' : 'rgba(148, 163, 184, 0.35)';
          ctx.lineWidth = i % 6 === 0 ? 3 : 1.5;
          ctx.beginPath();
          ctx.moveTo(256 + Math.cos(angle) * innerR, 256 + Math.sin(angle) * innerR);
          ctx.lineTo(256 + Math.cos(angle) * outerR, 256 + Math.sin(angle) * outerR);
          ctx.stroke();
        }
      }
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      return tex;
    };

    const contactShadowTex = createContactShadowTexture();
    const dialTex = createChapterDialTexture();

    // 4. Composite 9-Part Procedural Hero Model (THREE.Group)
    // SABAI Foundation: "Open Information Observatory & Knowledge Beacon"
    // Pivoted at bottom-center (Y = -1.25)
    const rootGroup = new THREE.Group();
    rootGroup.position.set(0, -1.25, 0);
    scene.add(rootGroup);

    // Floor Grid / Platform Plane
    const floorGeo = new THREE.CircleGeometry(6.5, 64);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.85,
      metalness: 0.15,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = 0;
    floorMesh.receiveShadow = !isSoftwareGl;
    rootGroup.add(floorMesh);

    // Contact Shadow Plane (offset on Y to prevent coplanar Z-fighting)
    const shadowGeo = new THREE.PlaneGeometry(4.2, 4.2);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.65,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.02;
    rootGroup.add(shadowPlane);

    // Chapter Ring Decal Plane (offset on Y = 0.03)
    const dialGeo = new THREE.PlaneGeometry(3.8, 3.8);
    const dialMat = new THREE.MeshBasicMaterial({
      map: dialTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.85,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const dialPlane = new THREE.Mesh(dialGeo, dialMat);
    dialPlane.rotation.x = -Math.PI / 2;
    dialPlane.position.y = 0.03;
    rootGroup.add(dialPlane);

    // Materials with distinct roughness (>= 0.25 variation) and metalness
    const baseMetalMat = new THREE.MeshPhysicalMaterial({
      color: 0x1e293b,
      metalness: 0.88,
      roughness: 0.42,
      clearcoat: 0.3,
    });

    const goldAccentMat = new THREE.MeshPhysicalMaterial({
      color: 0xf59e0b,
      metalness: 0.95,
      roughness: 0.15,
      anisotropy: 0.75,
      clearcoat: 0.6,
    });

    const primaryCobaltMat = new THREE.MeshPhysicalMaterial({
      color: 0x2563eb,
      metalness: 0.75,
      roughness: 0.22,
      clearcoat: 0.85,
      clearcoatRoughness: 0.12,
    });

    const coreCrystalMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.35,
      metalness: 0.1,
      roughness: 0.08,
      transmission: isSoftwareGl ? 0 : 0.92,
      transparent: true,
      opacity: isSoftwareGl ? 0.78 : 1.0,
      ior: 1.65,
      thickness: 1.4,
      clearcoat: 1.0,
    });

    // Part 1 (Primary Silhouette): Stepped Octagonal Pedestal Plinth
    const plinthGeo = new THREE.CylinderGeometry(1.15, 1.38, 0.28, 8);
    const plinthMesh = new THREE.Mesh(plinthGeo, baseMetalMat);
    plinthMesh.position.y = 0.14;
    plinthMesh.castShadow = !isSoftwareGl;
    plinthMesh.receiveShadow = !isSoftwareGl;
    rootGroup.add(plinthMesh);

    // Part 2 (Primary Silhouette): Upper Beveled Collar Ring
    const collarGeo = new THREE.CylinderGeometry(0.86, 1.05, 0.2, 16);
    const collarMesh = new THREE.Mesh(collarGeo, goldAccentMat);
    collarMesh.position.y = 0.38;
    collarMesh.castShadow = !isSoftwareGl;
    rootGroup.add(collarMesh);

    // Part 3 (Primary Silhouette): Central Knowledge Spire Column
    const spirePoints = [
      new THREE.Vector2(0.38, 0),
      new THREE.Vector2(0.24, 0.35),
      new THREE.Vector2(0.16, 0.85),
      new THREE.Vector2(0.28, 1.15),
      new THREE.Vector2(0.08, 1.35),
    ];
    const spireGeo = new THREE.LatheGeometry(spirePoints, 24);
    const spireMesh = new THREE.Mesh(spireGeo, baseMetalMat);
    spireMesh.position.y = 0.45;
    spireMesh.castShadow = !isSoftwareGl;
    rootGroup.add(spireMesh);

    // Observatory Assembly Group (elevates on exploded view)
    const observatoryGroup = new THREE.Group();
    observatoryGroup.position.y = 1.62;
    rootGroup.add(observatoryGroup);

    // Part 4 (Primary Silhouette): Faceted Sapphire Knowledge Core
    const coreGeo = new THREE.IcosahedronGeometry(0.56, 1);
    const coreMesh = new THREE.Mesh(coreGeo, coreCrystalMat);
    coreMesh.castShadow = !isSoftwareGl;
    observatoryGroup.add(coreMesh);

    // Part 5 (Secondary Read): Inner Luminous Nucleus
    const nucleusGeo = new THREE.OctahedronGeometry(0.3, 0);
    const nucleusMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.2,
      roughness: 0.2,
      metalness: 0.5,
    });
    const nucleusMesh = new THREE.Mesh(nucleusGeo, nucleusMat);
    observatoryGroup.add(nucleusMesh);

    // Part 6 (Secondary Read): Outer Brushed-Gold Gimbal Ring
    const outerGimbalGeo = new THREE.TorusGeometry(1.08, 0.045, 20, 64);
    const outerGimbalMesh = new THREE.Mesh(outerGimbalGeo, goldAccentMat);
    outerGimbalMesh.castShadow = !isSoftwareGl;
    observatoryGroup.add(outerGimbalMesh);

    // Part 7 (Secondary Read): Tilted Anodized Cobalt Data Meridian Ring
    const innerGimbalGeo = new THREE.TorusGeometry(0.84, 0.036, 18, 56);
    const innerGimbalMesh = new THREE.Mesh(innerGimbalGeo, primaryCobaltMat);
    innerGimbalMesh.rotation.x = Math.PI / 3;
    innerGimbalMesh.castShadow = !isSoftwareGl;
    observatoryGroup.add(innerGimbalMesh);

    // Part 8 (Accent Detail): Equatorial Information Weave (TorusKnot)
    const weaveGeo = new THREE.TorusKnotGeometry(0.68, 0.016, 84, 12, 2, 3);
    const weaveMesh = new THREE.Mesh(weaveGeo, goldAccentMat);
    observatoryGroup.add(weaveMesh);

    // Part 9 (Accent Detail): InstancedMesh of 42 Civic Data Constellation Nodes
    const nodeCount = 42;
    const nodeGeo = new THREE.OctahedronGeometry(0.055, 0);
    const nodeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.2,
      metalness: 0.85,
    });
    const nodesInstanced = new THREE.InstancedMesh(nodeGeo, nodeMat, nodeCount);
    nodesInstanced.frustumCulled = false;

    const nodeOrbits: Array<{ radius: number; angle: number; yOffset: number; speed: number; scale: number }> = [];
    for (let i = 0; i < nodeCount; i++) {
      const radius = 1.25 + (i % 3) * 0.28;
      const angle = (i / nodeCount) * Math.PI * 2;
      const yOffset = ((i % 7) - 3) * 0.22;
      const scale = 0.85 + (i % 5) * 0.08;
      nodeOrbits.push({
        radius,
        angle,
        yOffset,
        speed: 0.25 + (i % 4) * 0.08,
        scale,
      });

      _dummyObj.position.set(
        Math.cos(angle) * radius,
        yOffset,
        Math.sin(angle) * radius
      );
      _dummyObj.scale.setScalar(scale);
      _dummyObj.updateMatrix();
      nodesInstanced.setMatrixAt(i, _dummyObj.matrix);

      // Subtle per-instance tint variation
      if (i % 3 === 0) _color.setHex(0xfbbf24);
      else if (i % 3 === 1) _color.setHex(0x60a5fa);
      else _color.setHex(0x34d399);
      nodesInstanced.setColorAt(i, _color);
    }
    nodesInstanced.instanceMatrix.needsUpdate = true;
    if (nodesInstanced.instanceColor) nodesInstanced.instanceColor.needsUpdate = true;
    nodesInstanced.computeBoundingSphere();
    observatoryGroup.add(nodesInstanced);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Pointer interaction handler
    const handlePointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        stateRef.current.pointerX = nx;
        stateRef.current.pointerY = ny;
      }
    };

    container.addEventListener('pointermove', handlePointerMove, { passive: true });

    // Resize handler
    const handleResize = () => {
      if (!container) return;
      const newW = Math.max(container.clientWidth, 320);
      const newH = Math.max(container.clientHeight, 260);
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };
    window.addEventListener('resize', handleResize);

    // 5. Render Loop with Software-WebGL fenceSync Pacing
    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;

    function afterDraw(cb: () => void) {
      if (disposed) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();

      // Update material theme palette smoothly
      const finish = stateRef.current.themeFinish;
      if (finish === 'cobalt-gold') {
        primaryCobaltMat.color.setHex(0x2563eb);
        goldAccentMat.color.setHex(0xf59e0b);
        coreCrystalMat.color.setHex(0x38bdf8);
      } else if (finish === 'emerald-brass') {
        primaryCobaltMat.color.setHex(0x059669);
        goldAccentMat.color.setHex(0xeab308);
        coreCrystalMat.color.setHex(0x34d399);
      } else {
        primaryCobaltMat.color.setHex(0x6366f1);
        goldAccentMat.color.setHex(0x22d3ee);
        coreCrystalMat.color.setHex(0xa855f7);
      }

      // Smooth exponential damping for Exploded View separation
      stateRef.current.explodeCurrent = THREE.MathUtils.damp(
        stateRef.current.explodeCurrent,
        stateRef.current.explodeTarget,
        5.5,
        delta
      );
      const exp = stateRef.current.explodeCurrent;

      collarMesh.position.y = 0.38 + exp * 0.22;
      spireMesh.position.y = 0.45 + exp * 0.35;
      observatoryGroup.position.y = 1.62 + exp * 0.55;
      outerGimbalMesh.scale.setScalar(1 + exp * 0.25);
      innerGimbalMesh.scale.setScalar(1 + exp * 0.14);

      // Smooth orbital rotations
      coreMesh.rotation.y = elapsed * 0.35;
      coreMesh.rotation.x = Math.sin(elapsed * 0.5) * 0.15;
      nucleusMesh.rotation.y = -elapsed * 0.7;
      nucleusMesh.rotation.z = elapsed * 0.4;

      outerGimbalMesh.rotation.y = elapsed * 0.28 + stateRef.current.pointerX * 0.35;
      outerGimbalMesh.rotation.x = Math.sin(elapsed * 0.4) * 0.22 + stateRef.current.pointerY * 0.25;

      innerGimbalMesh.rotation.z = -elapsed * 0.42;
      innerGimbalMesh.rotation.y = Math.cos(elapsed * 0.35) * 0.35;

      weaveMesh.rotation.y = -elapsed * 0.22;
      weaveMesh.rotation.x = elapsed * 0.18;

      dialPlane.rotation.z = elapsed * 0.06;

      // Update InstancedMesh constellation nodes
      const radialBoost = 1 + exp * 0.35;
      for (let i = 0; i < nodeCount; i++) {
        const orb = nodeOrbits[i];
        const a = orb.angle + elapsed * orb.speed * 0.5;
        _dummyObj.position.set(
          Math.cos(a) * orb.radius * radialBoost,
          orb.yOffset * radialBoost + Math.sin(elapsed * 1.2 + i) * 0.05,
          Math.sin(a) * orb.radius * radialBoost
        );
        _dummyObj.rotation.y = a;
        _dummyObj.rotation.x = elapsed * 0.5;
        _dummyObj.scale.setScalar(orb.scale);
        _dummyObj.updateMatrix();
        nodesInstanced.setMatrixAt(i, _dummyObj.matrix);
      }
      nodesInstanced.instanceMatrix.needsUpdate = true;

      // Smooth camera preset damping
      const preset = stateRef.current.cameraPreset;
      if (preset === 'overview') {
        _targetCamPos.set(
          stateRef.current.pointerX * 0.55,
          1.35 + stateRef.current.pointerY * 0.3,
          5.35
        );
      } else if (preset === 'lattice') {
        _targetCamPos.set(2.4, 0.95, 3.3);
      } else if (preset === 'beacon') {
        _targetCamPos.set(-1.8, 1.85, 3.6);
      } else {
        _targetCamPos.set(0.2, 3.8, 2.6);
      }

      camera.position.x = THREE.MathUtils.damp(camera.position.x, _targetCamPos.x, 4.2, delta);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, _targetCamPos.y, 4.2, delta);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, _targetCamPos.z, 4.2, delta);
      camera.lookAt(_lookAtPos);

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      container.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('resize', handleResize);

      // Dispose geometries, materials, and textures
      floorGeo.dispose();
      floorMat.dispose();
      shadowGeo.dispose();
      shadowMat.dispose();
      contactShadowTex.dispose();
      dialGeo.dispose();
      dialMat.dispose();
      dialTex.dispose();
      plinthGeo.dispose();
      collarGeo.dispose();
      spireGeo.dispose();
      coreGeo.dispose();
      nucleusGeo.dispose();
      nucleusMat.dispose();
      outerGimbalGeo.dispose();
      innerGimbalGeo.dispose();
      weaveGeo.dispose();
      nodeGeo.dispose();
      nodeMat.dispose();
      baseMetalMat.dispose();
      goldAccentMat.dispose();
      primaryCobaltMat.dispose();
      coreCrystalMat.dispose();
      envTarget.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <section className="mx-auto max-w-screen-2xl w-full px-4 sm:px-6 pt-3">
      <div className="rounded-3xl border border-neutral-800 bg-[#090d16] text-white shadow-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        {/* Left Editorial Identity Column: SABAI Foundation Branding */}
        <div className="lg:col-span-6 p-6 sm:p-8 lg:p-10 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-neutral-800/80 bg-[#090d16]">
          <div className="space-y-5">
            {/* Promoter Badge */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono tracking-wider uppercase text-amber-300">
              <Globe2 className="h-4 w-4 text-amber-400 shrink-0" />
              <span>SABAI Foundation</span>
              <span className="text-neutral-600">·</span>
              <span className="text-sky-300">Public-Interest Data Initiative</span>
            </div>

            {/* Full Promoter Organization Title & Mission */}
            <div className="space-y-2.5">
              <div className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-neutral-400">
                Society for Awareness and Better Access to Information
              </div>
              <h1 className="text-2xl sm:text-3xl xl:text-4xl font-bold tracking-tight text-white leading-[1.12]">
                Democratizing Data Intelligence & Visual Storytelling for Every Citizen
              </h1>
              <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed max-w-xl">
                Promoted by the <strong className="text-white font-semibold">SABAI Foundation</strong>, this open intelligence platform transforms complex CSV datasets into transparent statistical trends, high-craft infographics, and civic social narratives.
              </p>
            </div>

            {/* Key Foundation Pillars (Unboxed metadata strip with · separators) */}
            <div className="pt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-neutral-400 font-mono">
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                Open Data Literacy
              </span>
              <span>·</span>
              <span>Autonomous Statistical Auditing</span>
              <span>·</span>
              <span>MCP Visual & Social Publishing</span>
            </div>
          </div>

          {/* Primary Action Bar */}
          <div className="pt-6 mt-6 border-t border-neutral-800/90 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onOpenDonate}
                className="flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 px-5 py-2.5 text-xs sm:text-sm font-bold text-neutral-950 shadow-sm transition cursor-pointer whitespace-nowrap shrink-0"
              >
                <Heart className="h-4 w-4 fill-neutral-950 text-neutral-950" />
                <span>Donate Now · QR Code</span>
              </button>

              {onLoadSampleReport && (
                <button
                  type="button"
                  onClick={onLoadSampleReport}
                  className="flex items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white transition cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Sparkles className="h-4 w-4 text-sky-400" />
                  <span>Explore Live Demo Report</span>
                </button>
              )}
            </div>

            <div className="text-[11px] font-mono text-neutral-400 tabular-nums">
              100% Open Access · Civic Impact Fund
            </div>
          </div>
        </div>

        {/* Right 3D Interactive Viewport: SABAI Open-Information Observatory */}
        <div className="lg:col-span-6 relative min-h-[340px] sm:min-h-[390px] bg-[#090d16] flex flex-col justify-between">
          {/* Dedicated isolated WebGL Canvas Mount */}
          <div
            ref={canvasMountRef}
            className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
          />

          {/* Minimal Top-Left Spec Badge (Zero Center Occlusion) */}
          <div className="relative z-10 p-4 pointer-events-none flex items-center justify-between">
            <div className="inline-flex items-center gap-2 rounded-xl bg-neutral-900/90 border border-neutral-800 px-3 py-1.5 text-[11px] font-mono text-neutral-300">
              <Compass className="h-3.5 w-3.5 text-amber-400" />
              <span>SABAI Knowledge Beacon · 3D PBR Observatory</span>
            </div>
          </div>

          {/* Unified Collapsible Bottom Control Dock (No backdrop-filter over WebGL) */}
          <div className="relative z-10 p-3 flex flex-col items-center">
            <button
              type="button"
              onClick={() => setHudCollapsed((prev) => !prev)}
              className="mb-1.5 flex items-center gap-1.5 rounded-lg bg-neutral-900/95 border border-neutral-800 px-3 py-1 text-[11px] font-mono text-neutral-300 hover:text-white transition cursor-pointer whitespace-nowrap shrink-0"
            >
              {hudCollapsed ? (
                <>
                  <Eye className="h-3 w-3 text-amber-400" />
                  <span>▴ Show 3D Controls</span>
                </>
              ) : (
                <>
                  <EyeOff className="h-3 w-3 text-neutral-400" />
                  <span>▾ Hide Controls</span>
                </>
              )}
            </button>

            {!hudCollapsed && (
              <div className="w-full max-w-[96%] rounded-2xl bg-neutral-900/95 border border-neutral-800 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                {/* Camera View Presets */}
                <div className="flex items-center gap-1">
                  {(
                    [
                      { id: 'overview', label: 'Orbit' },
                      { id: 'lattice', label: 'Lattice' },
                      { id: 'beacon', label: 'Spire' },
                      { id: 'zenith', label: 'Zenith' },
                    ] as const
                  ).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setCameraPreset(p.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                        cameraPreset === p.id
                          ? 'bg-amber-500 text-neutral-950 font-bold'
                          : 'text-neutral-300 hover:bg-neutral-800'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Exploded Assembly Slider */}
                <div className="flex items-center gap-2">
                  <Layers className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                  <span className="text-[11px] font-mono text-neutral-400 whitespace-nowrap shrink-0">
                    Explode
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.02}
                    value={explodeFactor}
                    onChange={(e) => setExplodeFactor(parseFloat(e.target.value))}
                    className="w-20 accent-amber-400 cursor-pointer"
                    aria-label="Exploded view separation"
                  />
                </div>

                {/* PBR Material Finish Swatches */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setThemeFinish('cobalt-gold')}
                    title="Cobalt & Brushed Gold"
                    className={`h-4 w-4 rounded-full bg-blue-500 border-2 cursor-pointer ${
                      themeFinish === 'cobalt-gold' ? 'border-amber-300 scale-110' : 'border-neutral-700'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setThemeFinish('emerald-brass')}
                    title="Emerald & Brass"
                    className={`h-4 w-4 rounded-full bg-emerald-500 border-2 cursor-pointer ${
                      themeFinish === 'emerald-brass' ? 'border-amber-300 scale-110' : 'border-neutral-700'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setThemeFinish('obsidian-cyan')}
                    title="Amethyst & Cyan"
                    className={`h-4 w-4 rounded-full bg-purple-500 border-2 cursor-pointer ${
                      themeFinish === 'obsidian-cyan' ? 'border-cyan-300 scale-110' : 'border-neutral-700'
                    }`}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
