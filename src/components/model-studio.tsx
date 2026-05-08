'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';

import { RecordingControls } from '@/components/recording-controls';
import { TimelinePanel } from '@/components/timeline-panel';

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
import { getCameraFarPlane, getImportScale, getLargestDimension } from '@/lib/import-normalize';
import { formatBytes, getModelKind } from '@/lib/model-files';
import { getRecorderTransition, type RecorderState } from '@/lib/recorder';
import {
  addKeyframe,
  createDefaultTimeline,
  deleteClip,
  getEnabledClipSegments,
  interpolateAssetTransform,
  interpolateCameraTransform,
  removeKeyframe,
  splitClipAtTime,
  trimClipEnd,
  trimClipStart,
  type TimelineStage,
  type TimelineState,
} from '@/lib/timeline';
import { clampFps, fpsPresets, resolutionPresets } from '@/lib/video-options';

type Tab = 'studio' | 'assets' | 'export';
type ObjectMap = Map<string, THREE.Object3D>;

function makeDemoObject() {
  const group = new THREE.Group();
  const torus = new THREE.Mesh(
    new THREE.TorusKnotGeometry(1.28, 0.38, 144, 18),
    new THREE.MeshStandardMaterial({ color: '#d8c2ff', emissive: '#3c1d73', emissiveIntensity: 0.3, roughness: 0.28, metalness: 0.5 }),
  );
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.78, 1),
    new THREE.MeshStandardMaterial({ color: '#7ee5ff', emissive: '#115566', emissiveIntensity: 0.36, roughness: 0.2, metalness: 0.18, transparent: true, opacity: 0.88 }),
  );
  group.add(torus, core);
  return group;
}

function normalizeDemoObject(object: THREE.Object3D) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;
  const center = box.getCenter(new THREE.Vector3());
  object.position.sub(center);
  object.updateMatrixWorld(true);
}

function normalizeImportedObject(object: THREE.Object3D) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return { largestDimension: 0, scale: 1 };

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = getImportScale(size, 2.2);

  object.position.sub(center);
  object.scale.multiplyScalar(scale);
  object.updateMatrixWorld(true);

  return { largestDimension: getLargestDimension(size), scale };
}

function prepObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      if (!mesh.material || Array.isArray(mesh.material)) {
        mesh.material = new THREE.MeshStandardMaterial({ color: '#c6a8ff', roughness: 0.36, metalness: 0.22 });
      }
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });
}

function getObjectsBounds(objects: THREE.Object3D[]) {
  const visible = objects.filter((object) => object.visible);
  if (!visible.length) return null;
  const box = new THREE.Box3();
  visible.forEach((object) => box.expandByObject(object));
  if (box.isEmpty()) return null;
  return box;
}

function fitCameraToBox(camera: THREE.PerspectiveCamera, box: THREE.Box3, controls?: OrbitControls | null) {
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 1);
  const distance = maxDim * 2.4;
  camera.near = Math.max(0.01, distance / 10000);
  camera.far = getCameraFarPlane(distance);
  camera.position.set(center.x + distance * 0.78, center.y + distance * 0.48, center.z + distance * 0.78);
  camera.lookAt(center);
  camera.updateProjectionMatrix();
  if (controls) {
    controls.target.copy(center);
    controls.update();
  }
}

function fitCameraToObjects(camera: THREE.PerspectiveCamera, objects: ObjectMap, controls?: OrbitControls | null) {
  const box = getObjectsBounds([...objects.values()]);
  if (box) fitCameraToBox(camera, box, controls);
}

function fitCameraToObject(camera: THREE.PerspectiveCamera, object: THREE.Object3D | undefined, controls?: OrbitControls | null) {
  if (!object) return;
  const box = getObjectsBounds([object]);
  if (box) fitCameraToBox(camera, box, controls);
}

function applyTransform(object: THREE.Object3D, transform: StudioTransform, visible: boolean) {
  object.visible = visible;
  object.position.set(transform.position.x, transform.position.y, transform.position.z);
  object.rotation.set(
    transform.baseRotation.x + transform.spinRotation.x,
    transform.baseRotation.y + transform.spinRotation.y,
    transform.baseRotation.z + transform.spinRotation.z,
  );
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
  const controlsRef = useRef<OrbitControls | null>(null);
  const objectsRef = useRef<ObjectMap>(new Map());
  const assetsRef = useRef<StudioAsset[]>([]);
  const timelineRef = useRef<TimelineState>(createDefaultTimeline());
  const recordingStateRef = useRef<RecorderState>('idle');
  const recordingUrlRef = useRef<string | null>(null);
  const selectedClipIdRef = useRef<string | null>('clip-1');
  const selectedKeyframeIdRef = useRef<string | null>(null);
  const playbackRef = useRef<{ lastFrameTime: number | null; segments: { start: number; end: number }[]; segmentIndex: number; recording: boolean }>({ lastFrameTime: null, segments: [], segmentIndex: 0, recording: false });
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
  const [timeline, setTimelineState] = useState<TimelineState>(() => createDefaultTimeline());
  const [recorderState, setRecorderState] = useState<RecorderState>('idle');
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [selectedClipId, setSelectedClipIdState] = useState<string | null>('clip-1');
  const [selectedKeyframeId, setSelectedKeyframeIdState] = useState<string | null>(null);
  const [lockTargetToSelected, setLockTargetToSelected] = useState(true);
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

  const setTimeline = useCallback((next: TimelineState | ((current: TimelineState) => TimelineState)) => {
    setTimelineState((current) => {
      const resolved = typeof next === 'function' ? next(current) : next;
      timelineRef.current = resolved;
      return resolved;
    });
  }, []);

  const setRecorder = useCallback((next: RecorderState) => {
    recordingStateRef.current = next;
    setRecorderState(next);
  }, []);

  const setSelectedClipId = useCallback((id: string | null) => {
    selectedClipIdRef.current = id;
    setSelectedClipIdState(id);
  }, []);

  const setSelectedKeyframeId = useCallback((id: string | null) => {
    selectedKeyframeIdRef.current = id;
    setSelectedKeyframeIdState(id);
  }, []);

  useEffect(() => {
    assetsRef.current = assets;
  }, [assets]);

  const applyTimelineAtTime = useCallback((time: number) => {
    const activeTimeline = timelineRef.current;
    const currentAssets = assetsRef.current.map((asset) => {
      const timelineTransform = interpolateAssetTransform(activeTimeline.keyframes, asset.id, time);
      if (!timelineTransform) return asset;
      return {
        ...asset,
        spin: timelineTransform.spin,
        transform: {
          position: timelineTransform.position,
          baseRotation: timelineTransform.rotation,
          spinRotation: { x: 0, y: 0, z: 0 },
          scale: timelineTransform.scale,
        },
      };
    });
    assetsRef.current = currentAssets;
    setAssetsState(currentAssets);

    for (const asset of currentAssets) {
      const object = objectsRef.current.get(asset.id);
      if (object) applyTransform(object, asset.transform, asset.visible);
    }

    const cameraTransform = interpolateCameraTransform(activeTimeline.keyframes, time);
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (cameraTransform && camera && controls) {
      camera.position.set(cameraTransform.cameraPosition.x, cameraTransform.cameraPosition.y, cameraTransform.cameraPosition.z);
      controls.target.set(cameraTransform.cameraTarget.x, cameraTransform.cameraTarget.y, cameraTransform.cameraTarget.z);
      camera.lookAt(controls.target);
      controls.update();
    }
  }, []);

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

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = true;
    controls.enableZoom = true;
    controlsRef.current = controls;

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
    normalizeDemoObject(demo);
    scene.add(demo);
    objectsRef.current.set('demo', demo);
    fitCameraToObjects(camera, objectsRef.current, controls);

    let previousFrameTime = performance.now();
    const animate = (frameTime = performance.now()) => {
      const dt = Math.min((frameTime - previousFrameTime) / 1000, 0.08);
      previousFrameTime = frameTime;
      const activeTimeline = timelineRef.current;
      const activePlayback = playbackRef.current;

      if (activeTimeline.playing) {
        const previousTime = activeTimeline.currentTime;
        const nextTime = previousTime + dt;
        const currentSegment = activePlayback.segments[activePlayback.segmentIndex];
        let resolvedTime = Math.min(nextTime, currentSegment?.end ?? activeTimeline.duration);
        let done = false;

        if (currentSegment && nextTime >= currentSegment.end) {
          activePlayback.segmentIndex += 1;
          const nextSegment = activePlayback.segments[activePlayback.segmentIndex];
          if (nextSegment) {
            resolvedTime = nextSegment.start;
          } else {
            done = true;
            resolvedTime = currentSegment.end;
          }
        } else if (!currentSegment && nextTime >= activeTimeline.duration) {
          done = true;
          resolvedTime = activeTimeline.duration;
        }

        const nextTimeline = { ...activeTimeline, currentTime: resolvedTime, playing: !done };
        timelineRef.current = nextTimeline;
        setTimelineState(nextTimeline);
        applyTimelineAtTime(resolvedTime);

        if (done) {
          controls.enabled = true;
          if (activePlayback.recording && mediaRecorderRef.current?.state !== 'inactive') {
            mediaRecorderRef.current?.stop();
          }
          activePlayback.recording = false;
        }
      } else {
        const hasAssetTimeline = activeTimeline.keyframes.some((keyframe) => keyframe.targetType === 'asset');
        if (!hasAssetTimeline) {
          const advancedAssets = advanceSpinForAssets(assetsRef.current, dt);
          assetsRef.current = advancedAssets;
          for (const asset of advancedAssets) {
            const object = objectsRef.current.get(asset.id);
            if (!object) continue;
            applyTransform(object, asset.transform, asset.visible);
          }
        }
        controls.enabled = recordingStateRef.current !== 'recording';
        controls.update();
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
      controls.dispose();
      controlsRef.current = null;
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [applyTimelineAtTime]);

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
      const normalized = normalizeImportedObject(object);
      const id = `${Date.now()}-${index}-${file.name.replace(/[^a-z0-9]/gi, '-')}`;
      sceneRef.current?.add(object);
      objectsRef.current.set(id, object);
      const record = createAssetRecord({ id, name: file.name, kind, size: file.size, group: kind });
      record.transform.position.x = index * 2.6;
      record.transform.scale = 1;
      object.visible = record.visible;

      const demoObject = objectsRef.current.get('demo');
      if (demoObject) demoObject.visible = true;
      fitCameraToObjects(cameraRef.current!, objectsRef.current, controlsRef.current);

      if (normalized.largestDimension === 0) setStatus(`${file.name} loaded but has empty bounds`);
      return record;
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
    setAssets((current) => selectAsset([...current, ...loaded], loaded[0].id));
    setSelectedId(loaded[0].id);
    setActiveGroup(loaded[0].group);
    setStatus(`${loaded.length} loaded`);
    setTimeout(() => fitCameraToObjects(cameraRef.current!, objectsRef.current, controlsRef.current), 80);
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
    if (lockTargetToSelected) fitCameraToObject(cameraRef.current!, objectsRef.current.get(id), controlsRef.current);
  };

  const fitAll = () => {
    const camera = cameraRef.current;
    if (camera) fitCameraToObjects(camera, objectsRef.current, controlsRef.current);
  };

  const fitSelected = () => {
    const camera = cameraRef.current;
    if (camera) fitCameraToObject(camera, objectsRef.current.get(selectedId), controlsRef.current);
  };

  const resetView = () => fitAll();

  const exportPng = () => {
    const canvas = rendererRef.current?.domElement;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = 'vid-aider-frame.png';
    a.click();
    setStatus('PNG saved');
  };

  const scrubTo = useCallback((time: number) => {
    const clamped = Math.max(0, Math.min(timelineRef.current.duration, time));
    setTimeline((current) => ({ ...current, currentTime: clamped, playing: false }));
    playbackRef.current.recording = false;
    if (controlsRef.current) controlsRef.current.enabled = true;
    applyTimelineAtTime(clamped);
  }, [applyTimelineAtTime, setTimeline]);

  const playTimeline = useCallback((recordingPlayback = false) => {
    const activeTimeline = timelineRef.current;
    const clips = recordingPlayback ? getEnabledClipSegments(activeTimeline.clips) : [];
    const start = clips[0]?.start ?? activeTimeline.currentTime;
    playbackRef.current = { lastFrameTime: null, segments: clips.map((clip) => ({ start: clip.start, end: clip.end })), segmentIndex: 0, recording: recordingPlayback };
    if (controlsRef.current) controlsRef.current.enabled = false;
    setTimeline({ ...activeTimeline, currentTime: start, playing: true });
    applyTimelineAtTime(start);
  }, [applyTimelineAtTime, setTimeline]);

  const pauseTimeline = useCallback(() => {
    setTimeline((current) => ({ ...current, playing: false }));
    if (controlsRef.current && recordingStateRef.current !== 'recording') controlsRef.current.enabled = true;
  }, [setTimeline]);

  const stopTimeline = useCallback(() => {
    playbackRef.current.recording = false;
    setTimeline((current) => ({ ...current, currentTime: 0, playing: false }));
    if (controlsRef.current) controlsRef.current.enabled = true;
    applyTimelineAtTime(0);
  }, [applyTimelineAtTime, setTimeline]);

  const addTimelineKeyframe = () => {
    const now = timelineRef.current.currentTime;
    const stage = timelineRef.current.stage;
    const id = `${stage}-${Date.now()}`;
    if (stage === 'camera-motion') {
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      if (!camera || !controls) return;
      const keyframe = {
        id,
        time: now,
        targetType: 'camera' as const,
        targetId: 'camera',
        transform: {
          cameraPosition: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
          cameraTarget: { x: controls.target.x, y: controls.target.y, z: controls.target.z },
        },
      };
      setTimeline((current) => ({ ...current, keyframes: addKeyframe(current.keyframes, keyframe) }));
      setSelectedKeyframeId(id);
      setStatus('Camera keyframe added');
      return;
    }

    const targets = targetIds.length ? targetIds : [selectedId];
    let keyframeId = id;
    setTimeline((current) => {
      let keyframes = current.keyframes;
      for (const targetId of targets) {
        const asset = assetsRef.current.find((item) => item.id === targetId);
        if (!asset) continue;
        keyframeId = `${id}-${targetId}`;
        keyframes = addKeyframe(keyframes, {
          id: keyframeId,
          time: now,
          targetType: 'asset',
          targetId,
          transform: {
            position: { ...asset.transform.position },
            rotation: { ...asset.transform.baseRotation },
            scale: asset.transform.scale,
            spin: { ...asset.spin },
          },
        });
      }
      return { ...current, keyframes };
    });
    setSelectedKeyframeId(keyframeId);
    setStatus('Object keyframe added');
  };

  const startRecording = () => {
    const canvas = rendererRef.current?.domElement;
    if (!canvas || !('MediaRecorder' in window)) {
      setStatus('No recorder');
      return;
    }
    chunksRef.current = [];
    if (recordingUrlRef.current) URL.revokeObjectURL(recordingUrlRef.current);
    recordingUrlRef.current = null;
    setRecordingUrl(null);
    const stream = canvas.captureStream(clampFps(fps));
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      recordingUrlRef.current = url;
      setRecordingUrl(url);
      setRecorder(getRecorderTransition(recordingStateRef.current, 'stop'));
      setTimeline((current) => ({ ...current, playing: false }));
      if (controlsRef.current) controlsRef.current.enabled = true;
      setStatus(`${currentResolution.label} WebM ready`);
    };
    mediaRecorderRef.current = recorder;
    recorder.start();
    setRecorder(getRecorderTransition(recordingStateRef.current, 'start'));
    setStatus('Recording enabled clips');
    playTimeline(true);
  };

  const pauseRecording = () => {
    mediaRecorderRef.current?.pause();
    pauseTimeline();
    setRecorder(getRecorderTransition(recordingStateRef.current, 'pause'));
    setStatus('Recording paused');
  };

  const resumeRecording = () => {
    mediaRecorderRef.current?.resume();
    setRecorder(getRecorderTransition(recordingStateRef.current, 'resume'));
    playTimeline(true);
    setStatus('Recording resumed');
  };

  const stopRecording = () => {
    playbackRef.current.recording = false;
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
    setTimeline((current) => ({ ...current, playing: false }));
  };

  const downloadRecording = () => {
    const url = recordingUrlRef.current;
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vid-aider-timeline.webm';
    a.click();
  };

  const updateTimelineDuration = (duration: number) => {
    if (!Number.isFinite(duration) || duration <= 0) return;
    setTimeline((current) => ({
      ...current,
      duration,
      currentTime: Math.min(current.currentTime, duration),
      clips: current.clips.length ? current.clips.map((clip) => (clip.id === 'clip-1' ? { ...clip, end: duration } : clip)) : [{ id: 'clip-1', name: 'Full timeline', start: 0, end: duration, enabled: true }],
    }));
  };

  const setTimelineStage = (stage: TimelineStage) => setTimeline((current) => ({ ...current, stage }));

  const cutAtPlayhead = () => {
    setTimeline((current) => ({ ...current, clips: splitClipAtTime(current.clips, current.currentTime) }));
    setStatus('Clip cut at playhead');
  };

  const deleteSelectedTimelineItem = () => {
    if (selectedKeyframeIdRef.current) {
      setTimeline((current) => ({ ...current, keyframes: removeKeyframe(current.keyframes, selectedKeyframeIdRef.current!) }));
      setSelectedKeyframeId(null);
      setStatus('Keyframe deleted');
      return;
    }
    if (selectedClipIdRef.current) {
      setTimeline((current) => ({ ...current, clips: deleteClip(current.clips, selectedClipIdRef.current!) }));
      setStatus('Clip disabled');
    }
  };

  const trimSelectedClipStart = () => {
    const id = selectedClipIdRef.current;
    if (!id) return;
    setTimeline((current) => ({ ...current, clips: trimClipStart(current.clips, id, current.currentTime) }));
  };

  const trimSelectedClipEnd = () => {
    const id = selectedClipIdRef.current;
    if (!id) return;
    setTimeline((current) => ({ ...current, clips: trimClipEnd(current.clips, id, current.currentTime) }));
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
          <button type="button" onClick={resetView} className="rounded-full border border-[#7f6b9d]/18 px-3 py-1.5 hover:text-white" title="Reset view to all visible assets">Reset view</button>
          <button type="button" onClick={fitSelected} className="rounded-full border border-[#7f6b9d]/18 px-3 py-1.5 hover:text-white" title="Fit selected asset">Fit selected</button>
          <button type="button" onClick={fitAll} className="rounded-full border border-[#7f6b9d]/18 px-3 py-1.5 hover:text-white" title="Fit all visible assets">Fit all</button>
          <button type="button" onClick={() => setLockTargetToSelected((value) => !value)} aria-pressed={lockTargetToSelected} className="rounded-full border border-[#7f6b9d]/18 px-3 py-1.5 hover:text-white" title="Lock OrbitControls target to selected asset">
            {lockTargetToSelected ? 'Target locked' : 'Target free'}
          </button>
          <button type="button" onClick={exportPng} className="rounded-full border border-[#7f6b9d]/18 px-3 py-1.5 hover:text-white" title="Save PNG snapshot">PNG</button>
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
              <TimelinePanel
                timeline={timeline}
                selectedClipId={selectedClipId}
                selectedKeyframeId={selectedKeyframeId}
                onStageChange={setTimelineStage}
                onPlayPause={() => (timeline.playing ? pauseTimeline() : playTimeline(false))}
                onStop={stopTimeline}
                onScrub={scrubTo}
                onDurationChange={updateTimelineDuration}
                onAddKeyframe={addTimelineKeyframe}
                onCut={cutAtPlayhead}
                onDeleteSelected={deleteSelectedTimelineItem}
                onTrimStart={trimSelectedClipStart}
                onTrimEnd={trimSelectedClipEnd}
                onSelectClip={(id) => { setSelectedClipId(id); setSelectedKeyframeId(null); }}
                onSelectKeyframe={(id) => { setSelectedKeyframeId(id); setSelectedClipId(null); }}
              />
              <RecordingControls
                state={recorderState}
                canDownload={Boolean(recordingUrl)}
                onStart={startRecording}
                onPause={pauseRecording}
                onResume={resumeRecording}
                onStop={stopRecording}
                onDownload={downloadRecording}
              />
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
                <summary className="cursor-pointer text-[#f3edff]">Editing note</summary>
                <p className="mt-2 leading-6">Cuts and trims edit the animation timeline before recording. No ffmpeg.wasm swamp today.</p>
              </details>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
