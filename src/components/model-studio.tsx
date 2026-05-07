'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';

import { formatBytes, getModelKind } from '@/lib/model-files';
import { clampFps, fpsPresets, resolutionPresets } from '@/lib/video-options';

type Axis = 'x' | 'y' | 'z';
type Tab = 'studio' | 'assets' | 'export' | 'plan';

type AssetRecord = {
  name: string;
  size: string;
  kind: string;
  status: 'loaded' | 'error';
  message: string;
};

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

function fitCameraToObject(camera: THREE.PerspectiveCamera, object: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 1);
  const distance = maxDim * 2.25;
  camera.position.set(center.x + distance, center.y + distance * 0.55, center.z + distance);
  camera.lookAt(center);
}

export function ModelStudio() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  const animationRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [tab, setTab] = useState<Tab>('studio');
  const [asset, setAsset] = useState<AssetRecord>({
    name: 'demo torus knot',
    size: 'built-in',
    kind: 'demo',
    status: 'loaded',
    message: 'Ready. Drop an STL, OBJ, GLTF, or GLB file to replace it.',
  });
  const [autoSpin, setAutoSpin] = useState(true);
  const [axis, setAxis] = useState<Axis>('y');
  const [rpm, setRpm] = useState(8);
  const [scale, setScale] = useState(1);
  const [positionY, setPositionY] = useState(0);
  const [resolution, setResolution] = useState<string>(resolutionPresets[0].label);
  const [fps, setFps] = useState<number>(30);
  const [recording, setRecording] = useState(false);
  const [exportMessage, setExportMessage] = useState('PNG snapshots and WebM loop recording run entirely in your browser.');

  const currentResolution = useMemo(
    () => resolutionPresets.find((item) => item.label === resolution) ?? resolutionPresets[0],
    [resolution],
  );

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
    renderer.setSize(mount.clientWidth, Math.max(420, Math.min(620, window.innerHeight * 0.58)));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;
    mount.appendChild(renderer.domElement);

    const grid = new THREE.GridHelper(6, 18, '#7f6b9d', '#21172f');
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
    scene.add(demo);
    modelRef.current = demo;

    const clock = new THREE.Clock();
    const animate = () => {
      const dt = clock.getDelta();
      const model = modelRef.current;
      if (model) {
        model.scale.setScalar(scale);
        model.position.y = positionY;
        if (autoSpin) {
          model.rotation[axis] += (rpm * Math.PI * 2 * dt) / 60;
        }
      }
      renderer.render(scene, camera);
      animationRef.current = window.requestAnimationFrame(animate);
    };
    animate();

    const onResize = () => {
      const width = mount.clientWidth;
      const height = Math.max(420, Math.min(620, window.innerHeight * 0.58));
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
  }, [autoSpin, axis, positionY, rpm, scale]);

  const replaceModel = useCallback((object: THREE.Object3D) => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!scene || !camera) return;
    const existing = modelRef.current;
    if (existing) scene.remove(existing);
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
    scene.add(object);
    modelRef.current = object;
    fitCameraToObject(camera, object);
  }, []);

  const loadFile = useCallback(async (file: File) => {
    const kind = getModelKind(file.name);
    if (!kind) {
      setAsset({ name: file.name, size: formatBytes(file.size), kind: 'unknown', status: 'error', message: 'Unsupported file. Use STL, OBJ, GLTF, or GLB.' });
      return;
    }

    try {
      const url = URL.createObjectURL(file);
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
      URL.revokeObjectURL(url);
      replaceModel(object);
      setAsset({ name: file.name, size: formatBytes(file.size), kind: kind.toUpperCase(), status: 'loaded', message: 'Loaded into the viewport. Tune spin, scale, and recording settings next.' });
    } catch (error) {
      setAsset({ name: file.name, size: formatBytes(file.size), kind: kind.toUpperCase(), status: 'error', message: error instanceof Error ? error.message : 'Could not parse this model.' });
    }
  }, [replaceModel]);

  const onFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void loadFile(file);
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) void loadFile(file);
  };

  const exportPng = () => {
    const canvas = rendererRef.current?.domElement;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vid-aider-frame.png';
    a.click();
    setExportMessage('Exported current viewport as a PNG frame.');
  };

  const startRecording = () => {
    const canvas = rendererRef.current?.domElement;
    if (!canvas || !('MediaRecorder' in window)) {
      setExportMessage('MediaRecorder is not available in this browser. Try Chromium/Chrome.');
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
      setExportMessage(`Saved a ${currentResolution.label} WebM loop target at ${clampFps(fps)}fps. Browser canvas is preview-sized for MVP; render-size matching is next.`);
    };
    mediaRecorderRef.current = recorder;
    recorder.start();
    setRecording(true);
    setExportMessage('Recording the canvas loop now… stop when the spin looks right.');
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  return (
    <section className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="va-panel overflow-hidden rounded-3xl">
          <div
            ref={mountRef}
            onDrop={onDrop}
            onDragOver={(event) => event.preventDefault()}
            className="va-grid-bg min-h-[420px]"
            aria-label="3D model viewport"
          />
        </div>

        <aside className="va-panel rounded-3xl p-5" id="studio">
          <div className="flex flex-wrap gap-2 border-b border-[#7f6b9d]/15 pb-4 text-xs uppercase tracking-[0.18em] text-[#8f82a8]">
            {(['studio', 'assets', 'export', 'plan'] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTab(item)}
                aria-pressed={tab === item}
                className={`rounded-full border px-3 py-1.5 transition ${tab === item ? 'border-[#c6a8ff]/50 bg-[#c6a8ff]/10 text-[#f3edff]' : 'border-[#7f6b9d]/15 text-[#9f91ba] hover:text-white'}`}
              >
                {item}
              </button>
            ))}
          </div>

          {tab === 'studio' && (
            <div className="space-y-5 pt-5">
              <label className="block text-sm text-[#cfc3e6]">
                Spin axis
                <select value={axis} onChange={(event) => setAxis(event.target.value as Axis)} className="mt-2 w-full rounded-2xl border border-[#7f6b9d]/20 bg-[#0b0811]/80 px-3 py-2 text-[#f3edff]">
                  <option value="x">X axis</option>
                  <option value="y">Y axis</option>
                  <option value="z">Z axis</option>
                </select>
              </label>
              <label className="block text-sm text-[#cfc3e6]">RPM: {rpm}
                <input className="va-slider mt-2 w-full" type="range" min="0" max="48" value={rpm} onChange={(event) => setRpm(Number(event.target.value))} />
              </label>
              <label className="block text-sm text-[#cfc3e6]">Scale: {scale.toFixed(2)}
                <input className="va-slider mt-2 w-full" type="range" min="0.2" max="3" step="0.05" value={scale} onChange={(event) => setScale(Number(event.target.value))} />
              </label>
              <label className="block text-sm text-[#cfc3e6]">Lift: {positionY.toFixed(2)}
                <input className="va-slider mt-2 w-full" type="range" min="-2" max="2" step="0.05" value={positionY} onChange={(event) => setPositionY(Number(event.target.value))} />
              </label>
              <button type="button" onClick={() => setAutoSpin((value) => !value)} className="w-full rounded-2xl border border-[#c6a8ff]/30 bg-[#c6a8ff]/10 px-4 py-3 text-sm font-semibold text-[#f3edff] hover:bg-[#c6a8ff]/15">
                {autoSpin ? 'Pause spin loop' : 'Start spin loop'}
              </button>
            </div>
          )}

          {tab === 'assets' && (
            <div className="space-y-4 pt-5" id="assets">
              <label className="block rounded-2xl border border-dashed border-[#c6a8ff]/30 bg-[#0b0811]/50 p-5 text-center text-sm text-[#cfc3e6] hover:border-[#c6a8ff]/55">
                <span className="block font-semibold text-[#f3edff]">Import a 3D model</span>
                <span className="mt-1 block text-xs text-[#9f91ba]">STL, OBJ, GLTF, GLB — all parsed locally in browser.</span>
                <input className="sr-only" type="file" accept=".stl,.obj,.gltf,.glb" onChange={onFileInput} />
              </label>
              <div className="rounded-2xl border border-[#7f6b9d]/18 bg-[#0b0811]/45 p-4 text-sm">
                <div className="text-[#f3edff]">{asset.name}</div>
                <div className="mt-1 text-xs uppercase tracking-[0.16em] text-[#8f82a8]">{asset.kind} · {asset.size} · {asset.status}</div>
                <p className="mt-3 leading-6 text-[#b9accf]">{asset.message}</p>
              </div>
            </div>
          )}

          {tab === 'export' && (
            <div className="space-y-4 pt-5" id="export">
              <label className="block text-sm text-[#cfc3e6]">Resolution target
                <select value={resolution} onChange={(event) => setResolution(event.target.value)} className="mt-2 w-full rounded-2xl border border-[#7f6b9d]/20 bg-[#0b0811]/80 px-3 py-2 text-[#f3edff]">
                  {resolutionPresets.map((item) => <option key={item.label}>{item.label}</option>)}
                </select>
              </label>
              <label className="block text-sm text-[#cfc3e6]">FPS
                <select value={fps} onChange={(event) => setFps(Number(event.target.value))} className="mt-2 w-full rounded-2xl border border-[#7f6b9d]/20 bg-[#0b0811]/80 px-3 py-2 text-[#f3edff]">
                  {fpsPresets.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={exportPng} className="rounded-2xl border border-[#7f6b9d]/22 px-3 py-3 text-sm text-[#f3edff] hover:border-[#c6a8ff]/45">PNG frame</button>
                <button type="button" onClick={recording ? stopRecording : startRecording} className="rounded-2xl border border-[#c6a8ff]/30 bg-[#c6a8ff]/10 px-3 py-3 text-sm font-semibold text-[#f3edff] hover:bg-[#c6a8ff]/15">
                  {recording ? 'Stop WebM' : 'Record WebM'}
                </button>
              </div>
              <p className="text-sm leading-6 text-[#b9accf]">{exportMessage}</p>
              <p className="rounded-2xl border border-[#7f6b9d]/16 bg-[#0b0811]/40 p-3 text-xs leading-5 text-[#9f91ba]">GIF export is staged as the next browser-worker feature so big loops do not freeze the UI. WebM works now in modern Chromium browsers.</p>
            </div>
          )}

          {tab === 'plan' && (
            <div className="space-y-3 pt-5" id="plan">
              {['Timeline keyframes for camera + model transforms', 'GIF worker export with palette controls', 'Transparent background renders for overlays', 'Shot presets for Shorts, YouTube, and marketplace product loops'].map((item) => (
                <div key={item} className="rounded-2xl border border-[#7f6b9d]/16 bg-[#0b0811]/40 p-3 text-sm leading-6 text-[#cfc3e6]">{item}</div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
