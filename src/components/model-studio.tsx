'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';

import {
  advanceSpinForAssets,
  applySpinToTargets,
  applyTransformToTargets,
  createAssetRecord,
  getTargetAssetIds,
  selectAsset,
  toggleAssetVisibility,
  uniqueGroups,
  type AssetControlMode,
  type Axis,
  type ModelKind,
  type StudioAsset,
  type StudioTransform,
} from '@/lib/assets';
import { formatBytes, getModelKind } from '@/lib/model-files';
import { clampFps, fpsPresets, resolutionPresets } from '@/lib/video-options';

type Tab = 'studio' | 'assets' | 'export';
type ObjectMap = Map<string, THREE.Object3D>;

function makeDemoObject() {
  const group = new THREE.Group();
  const torus = new THREE.Mesh(
    new THREE.TorusKnotGeometry(0.9, 0.28, 144, 18),
    new THREE.MeshStandardMaterial({ color: '#c6a8ff', roughness: 0.32, metalness: 0.42 }),
  );
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.55, 1),
    new THREE.MeshStandardMaterial({ color: '#7ee5ff', roughness: 0.24, metalness: 0.16, transparent: true, opacity: 0.72 }),
  );
  group.add(torus, core);
  return group;
}

function prepObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      if (!mesh.material) {
        mesh.material = new THREE.MeshStandardMaterial({ color: '#c6a8ff', roughness: 0.36, metalness: 0.22 });
      }
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });
}

function fitCameraToObjects(camera: THREE.PerspectiveCamera, objects: ObjectMap) {
  const visible = [...objects.values()].filter((object) => object.visible);
  if (!visible.length) return;
  const box = new THREE.Box3();
  visible.forEach((object) => box.expandByObject(object));
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 1);
  const distance = maxDim * 2.4;
  camera.position.set(center.x + distance, center.y + distance * 0.62, center.z + distance);
  camera.lookAt(center);
}

function applyTransform(object: THREE.Object3D, transform: StudioTransform, visible: boolean) {
  object.visible = visible;
  object.position.set(transform.position.x, transform.position.y, transform.position.z);
  object.rotation.set(
    transform.baseRotation.x + transform.spinRotation.x,
    transform.baseRotation.y + transform.spinRotation.y,
    transform.baseRotation.z + transform.spinRotation.z,
  );
  object.scale.setScalar(transform.scale);
}

function Help({ text }: { text: string }) {
  return (
    <span
      title={text}
      className="inline-grid h-5 w-5 cursor-help place-items-center rounded-full border border-[#7f6b9d]/25 text-[0.65rem] text-[#b9accf]"
      aria-label={text}
    >
      ?
    </span>
  );
}

function shortName(name: string) {
  return name.length > 24 ? `${name.slice(0, 21)}…` : name;
}

export function ModelStudio() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const objectsRef = useRef<ObjectMap>(new Map());
  const assetsRef = useRef<StudioAsset[]>([]);
  const animationRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [tab, setTab] = useState<Tab>('studio');
  const [assets, setAssetsState] = useState<StudioAsset[]>([
    createAssetRecord({ id: 'demo', name: 'demo-knot', kind: 'demo', size: 0, group: 'demo', selected: true }),
  ]);
  const [selectedId, setSelectedId] = useState('demo');
  const [controlMode, setControlMode] = useState<AssetControlMode>('selected');
  const [activeGroup, setActiveGroup] = useState('demo');
  const [resolution, setResolution] = useState<string>(resolutionPresets[0].label);
  const [fps, setFps] = useState<number>(30);
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState('Ready');

  const currentResolution = useMemo(
    () => resolutionPresets.find((item) => item.label === resolution) ?? resolutionPresets[0],
    [resolution],
  );
  const groups = useMemo(() => uniqueGroups(assets), [assets]);
  const selectedAsset = assets.find((asset) => asset.id === selectedId) ?? assets[0];
  const targetIds = useMemo(
    () => getTargetAssetIds(assets, controlMode, selectedId, activeGroup),
    [activeGroup, assets, controlMode, selectedId],
  );

  const setAssets = useCallback((next: StudioAsset[] | ((current: StudioAsset[]) => StudioAsset[])) => {
    setAssetsState((current) => {
      const resolved = typeof next === 'function' ? next(current) : next;
      assetsRef.current = resolved;
      return resolved;
    });
  }, []);

  useEffect(() => {
    assetsRef.current = assets;
  }, [assets]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#09070f');
    scene.fog = new THREE.Fog('#09070f', 8, 28);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
    camera.position.set(3, 2, 4);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;
    mount.appendChild(renderer.domElement);

    const grid = new THREE.GridHelper(7, 20, '#7f6b9d', '#21172f');
    grid.position.y = -1.1;
    scene.add(grid);
    scene.add(new THREE.HemisphereLight('#efeafc', '#2b183f', 1.5));
    const key = new THREE.DirectionalLight('#ffffff', 2.6);
    key.position.set(3, 5, 4);
    scene.add(key);
    const rim = new THREE.PointLight('#7ee5ff', 3, 12);
    rim.position.set(-3, 2, -2);
    scene.add(rim);

    const demo = makeDemoObject();
    prepObject(demo);
    scene.add(demo);
    objectsRef.current.set('demo', demo);

    let previousFrameTime = performance.now();
    const animate = (frameTime = performance.now()) => {
      const dt = Math.min((frameTime - previousFrameTime) / 1000, 0.08);
      previousFrameTime = frameTime;
      const advancedAssets = advanceSpinForAssets(assetsRef.current, dt);
      assetsRef.current = advancedAssets;
      for (const asset of advancedAssets) {
        const object = objectsRef.current.get(asset.id);
        if (!object) continue;
        applyTransform(object, asset.transform, asset.visible);
      }
      renderer.render(scene, camera);
      animationRef.current = window.requestAnimationFrame(animate);
    };
    animate();

    const onResize = () => {
      const width = mount.clientWidth;
      const height = Math.max(460, Math.min(720, window.innerHeight * 0.68));
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    onResize();
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      if (animationRef.current) window.cancelAnimationFrame(animationRef.current);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    for (const asset of assets) {
      const object = objectsRef.current.get(asset.id);
      if (object) applyTransform(object, asset.transform, asset.visible);
    }
  }, [assets]);

  const loadOneFile = useCallback(async (file: File, index: number) => {
    const kind = getModelKind(file.name) as ModelKind | null;
    if (!kind) {
      setStatus(`Skipped ${file.name}`);
      return null;
    }

    const url = URL.createObjectURL(file);
    try {
      let object: THREE.Object3D;
      if (kind === 'obj') {
        object = await new OBJLoader().loadAsync(url);
      } else if (kind === 'stl') {
        const geometry = await new STLLoader().loadAsync(url);
        geometry.center();
        object = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: '#c6a8ff', roughness: 0.34, metalness: 0.28 }));
      } else {
        const gltf = await new GLTFLoader().loadAsync(url);
        object = gltf.scene;
      }
      prepObject(object);
      const id = `${Date.now()}-${index}-${file.name.replace(/[^a-z0-9]/gi, '-')}`;
      const offset = objectsRef.current.size * 0.85;
      object.position.x = offset;
      sceneRef.current?.add(object);
      objectsRef.current.set(id, object);
      return createAssetRecord({ id, name: file.name, kind, size: file.size, group: kind });
    } finally {
      URL.revokeObjectURL(url);
    }
  }, []);

  const loadFiles = useCallback(async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (!files.length) return;
    setStatus('Loading…');
    const loaded = (await Promise.all(files.map(loadOneFile))).filter((asset): asset is StudioAsset => Boolean(asset));
    if (!loaded.length) {
      setStatus('No supported files');
      return;
    }
    setAssets((current) => {
      const keepDemo = current.length === 1 && current[0]?.id === 'demo' ? [] : current;
      return selectAsset([...keepDemo, ...loaded], loaded[0].id);
    });
    setSelectedId(loaded[0].id);
    setActiveGroup(loaded[0].group);
    setStatus(`${loaded.length} loaded`);
    setTimeout(() => fitCameraToObjects(cameraRef.current!, objectsRef.current), 80);
  }, [loadOneFile, setAssets]);

  const updateTransform = (patch: Parameters<typeof applyTransformToTargets>[1]['patch']) => {
    setAssets((current) => applyTransformToTargets(current, { mode: controlMode, selectedId, group: activeGroup, patch }));
  };

  const updateSpin = (patch: Parameters<typeof applySpinToTargets>[1]['patch']) => {
    setAssets((current) => applySpinToTargets(current, { mode: controlMode, selectedId, group: activeGroup, patch }));
  };

  const select = (id: string) => {
    const asset = assets.find((item) => item.id === id);
    setSelectedId(id);
    if (asset) setActiveGroup(asset.group);
    setAssets((current) => selectAsset(current, id));
  };

  const resetView = () => {
    const camera = cameraRef.current;
    if (camera) fitCameraToObjects(camera, objectsRef.current);
  };

  const exportPng = () => {
    const canvas = rendererRef.current?.domElement;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = 'vid-aider-frame.png';
    a.click();
    setStatus('PNG saved');
  };

  const startRecording = () => {
    const canvas = rendererRef.current?.domElement;
    if (!canvas || !('MediaRecorder' in window)) {
      setStatus('No recorder');
      return;
    }
    chunksRef.current = [];
    const stream = canvas.captureStream(clampFps(fps));
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'vid-aider-loop.webm';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus(`${currentResolution.label} WebM`);
    };
    mediaRecorderRef.current = recorder;
    recorder.start();
    setRecording(true);
    setStatus('Recording');
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#7f6b9d]/18 bg-[#0f0c17]/40 p-3">
        <a
          href="https://node.xdoes.space/interactive-apps"
          className="rounded-full border border-[#7f6b9d]/20 px-3 py-1.5 text-sm text-[#c8bcdd] hover:border-[#c6a8ff]/45 hover:text-white"
          title="Back to XDOES interactive apps"
        >
          ← Apps
        </a>
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#9f91ba]">
          <span title="Current status">{status}</span>
          <Help text="Drop multiple STL, OBJ, GLTF, or GLB files. Use Apply to target selected, all, or a group." />
          <button type="button" onClick={resetView} className="rounded-full border border-[#7f6b9d]/18 px-3 py-1.5 hover:text-white" title="Frame all visible assets">Frame</button>
          <button type="button" onClick={exportPng} className="rounded-full border border-[#7f6b9d]/18 px-3 py-1.5 hover:text-white" title="Save PNG snapshot">PNG</button>
          <button type="button" onClick={recording ? stopRecording : startRecording} className="rounded-full border border-[#c6a8ff]/30 bg-[#c6a8ff]/10 px-3 py-1.5 text-[#f3edff]" title="Record WebM loop">
            {recording ? 'Stop' : 'REC'}
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div
          className="va-panel overflow-hidden rounded-3xl"
          onDrop={(event) => {
            event.preventDefault();
            void loadFiles(event.dataTransfer.files);
          }}
          onDragOver={(event) => event.preventDefault()}
        >
          <div ref={mountRef} className="va-grid-bg min-h-[460px]" aria-label="3D model viewport" />
        </div>

        <aside className="va-panel rounded-3xl p-4">
          <div className="mb-4 flex gap-2 text-xs uppercase tracking-[0.18em]">
            {(['studio', 'assets', 'export'] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTab(item)}
                aria-pressed={tab === item}
                title={`${item} controls`}
                className={`rounded-full border px-3 py-1.5 transition ${tab === item ? 'border-[#c6a8ff]/50 bg-[#c6a8ff]/10 text-[#f3edff]' : 'border-[#7f6b9d]/15 text-[#9f91ba] hover:text-white'}`}
              >
                {item}
              </button>
            ))}
          </div>

          {tab === 'studio' && selectedAsset && (
            <div className="space-y-4" id="studio">
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-[#9f91ba]" title="Choose whether controls affect one asset, every asset, or the active group">
                  Apply
                  <select value={controlMode} onChange={(event) => setControlMode(event.target.value as AssetControlMode)} className="mt-1 w-full rounded-xl border border-[#7f6b9d]/20 bg-[#0b0811]/80 px-3 py-2 text-sm text-[#f3edff]">
                    <option value="selected">selected</option>
                    <option value="all">all</option>
                    <option value="group">group</option>
                  </select>
                </label>
                <label className="text-xs text-[#9f91ba]" title="Group target for mixed control">
                  Group
                  <select value={activeGroup} onChange={(event) => setActiveGroup(event.target.value)} className="mt-1 w-full rounded-xl border border-[#7f6b9d]/20 bg-[#0b0811]/80 px-3 py-2 text-sm text-[#f3edff]">
                    {groups.map((group) => <option key={group}>{group}</option>)}
                  </select>
                </label>
              </div>
              <div className="rounded-2xl border border-[#7f6b9d]/14 bg-[#0b0811]/35 p-3 text-xs text-[#b9accf]" title="Currently targeted assets">
                Target: {targetIds.length} · {controlMode}
              </div>
              <label className="block text-sm text-[#cfc3e6]">Scale {selectedAsset.transform.scale.toFixed(2)}
                <input className="va-slider mt-2 w-full" type="range" min="0.1" max="4" step="0.05" value={selectedAsset.transform.scale} onChange={(event) => updateTransform({ scale: Number(event.target.value) })} title="Scale target assets" />
              </label>
              <label className="block text-sm text-[#cfc3e6]">X {selectedAsset.transform.position.x.toFixed(1)}
                <input className="va-slider mt-2 w-full" type="range" min="-5" max="5" step="0.1" value={selectedAsset.transform.position.x} onChange={(event) => updateTransform({ position: { x: Number(event.target.value) } })} title="Move target assets left/right" />
              </label>
              <label className="block text-sm text-[#cfc3e6]">Y {selectedAsset.transform.position.y.toFixed(1)}
                <input className="va-slider mt-2 w-full" type="range" min="-3" max="3" step="0.1" value={selectedAsset.transform.position.y} onChange={(event) => updateTransform({ position: { y: Number(event.target.value) } })} title="Lift target assets" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-[#9f91ba]">Axis
                  <select value={selectedAsset.spin.axis} onChange={(event) => updateSpin({ axis: event.target.value as Axis })} className="mt-1 w-full rounded-xl border border-[#7f6b9d]/20 bg-[#0b0811]/80 px-3 py-2 text-sm text-[#f3edff]" title="Spin axis">
                    <option value="x">X</option><option value="y">Y</option><option value="z">Z</option>
                  </select>
                </label>
                <button type="button" onClick={() => updateSpin({ enabled: !selectedAsset.spin.enabled })} className="mt-4 rounded-xl border border-[#c6a8ff]/30 bg-[#c6a8ff]/10 px-3 py-2 text-sm text-[#f3edff]" title="Toggle spin for target assets">
                  {selectedAsset.spin.enabled ? 'Spin on' : 'Spin off'}
                </button>
              </div>
              <label className="block text-sm text-[#cfc3e6]">RPM {selectedAsset.spin.rpm}
                <input className="va-slider mt-2 w-full" type="range" min="0" max="60" value={selectedAsset.spin.rpm} onChange={(event) => updateSpin({ rpm: Number(event.target.value) })} title="Spin speed" />
              </label>
            </div>
          )}

          {tab === 'assets' && (
            <div className="space-y-3" id="assets">
              <label className="block cursor-pointer rounded-2xl border border-dashed border-[#c6a8ff]/30 bg-[#0b0811]/50 p-4 text-center text-sm text-[#f3edff] hover:border-[#c6a8ff]/55" title="Upload multiple 3D files">
                + Upload
                <input className="sr-only" type="file" multiple accept=".stl,.obj,.gltf,.glb" onChange={(event) => event.target.files && void loadFiles(event.target.files)} />
              </label>
              <div className="max-h-[30rem] space-y-2 overflow-auto pr-1">
                {assets.map((asset) => (
                  <div key={asset.id} className={`rounded-2xl border p-3 ${asset.selected ? 'border-[#c6a8ff]/45 bg-[#c6a8ff]/10' : 'border-[#7f6b9d]/16 bg-[#0b0811]/35'}`}>
                    <button type="button" onClick={() => select(asset.id)} className="block w-full text-left" title="Select asset">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-[#f3edff]">{shortName(asset.name)}</span>
                        <span className="text-[0.65rem] uppercase tracking-[0.14em] text-[#9f91ba]">{asset.kind}</span>
                      </div>
                      <div className="mt-1 text-xs text-[#8f82a8]">{asset.group} · {asset.size ? formatBytes(asset.size) : 'demo'}</div>
                    </button>
                    <div className="mt-2 flex gap-2">
                      <button type="button" onClick={() => setAssets((current) => toggleAssetVisibility(current, asset.id))} className="rounded-full border border-[#7f6b9d]/18 px-2 py-1 text-xs text-[#cfc3e6]" title="Show/hide asset">
                        {asset.visible ? 'hide' : 'show'}
                      </button>
                      <button type="button" onClick={() => { setActiveGroup(asset.group); setControlMode('group'); }} className="rounded-full border border-[#7f6b9d]/18 px-2 py-1 text-xs text-[#cfc3e6]" title="Control this group">
                        group
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'export' && (
            <div className="space-y-4" id="export">
              <label className="block text-xs text-[#9f91ba]">Size
                <select value={resolution} onChange={(event) => setResolution(event.target.value)} className="mt-1 w-full rounded-xl border border-[#7f6b9d]/20 bg-[#0b0811]/80 px-3 py-2 text-sm text-[#f3edff]" title="Export target size">
                  {resolutionPresets.map((item) => <option key={item.label}>{item.label}</option>)}
                </select>
              </label>
              <label className="block text-xs text-[#9f91ba]">FPS
                <select value={fps} onChange={(event) => setFps(Number(event.target.value))} className="mt-1 w-full rounded-xl border border-[#7f6b9d]/20 bg-[#0b0811]/80 px-3 py-2 text-sm text-[#f3edff]" title="Recording framerate">
                  {fpsPresets.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <details className="rounded-2xl border border-[#7f6b9d]/16 bg-[#0b0811]/40 p-3 text-sm text-[#b9accf]">
                <summary className="cursor-pointer text-[#f3edff]">GIF?</summary>
                <p className="mt-2 leading-6">Next step: worker GIF export so long loops do not freeze the app. WebM + PNG work now.</p>
              </details>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
