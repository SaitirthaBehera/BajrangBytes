import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Building, AccessibilityFeature, RouteResult, BuildingRoom, CrowdZone } from '../types';
import { 
  Compass, 
  Box,
  RotateCw,
  Sun,
  Moon,
  Users
} from 'lucide-react';

interface ThreeDDigitalTwinProps {
  building: Building;
  selectedFloorId: number;
  features: AccessibilityFeature[];
  rooms: BuildingRoom[];
  activeRoute: RouteResult | null;
  crowdZones?: CrowdZone[];
  showCrowdDensity?: boolean;
  onSelectFeature?: (feature: AccessibilityFeature) => void;
  onSelectFloor?: (floorId: number) => void;
  onSelectCrowdZone?: (zone: CrowdZone) => void;
}

// Helper to generate camera-facing 3D Billboard Sprite Badges
function createBadgeSprite(text: string, icon: string, bgColor: string, borderColor: string): THREE.Sprite | null {
  const canvas = document.createElement('canvas');
  canvas.width = 340;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Background rounded pill with heavy contrast
  ctx.fillStyle = bgColor;
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 6;
  
  const r = 28;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(canvas.width - r, 0);
  ctx.quadraticCurveTo(canvas.width, 0, canvas.width, r);
  ctx.lineTo(canvas.width, canvas.height - r);
  ctx.quadraticCurveTo(canvas.width, canvas.height, canvas.width - r, canvas.height);
  ctx.lineTo(r, canvas.height);
  ctx.quadraticCurveTo(0, canvas.height, 0, canvas.height - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Crisp text and emoji with solid drop shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  ctx.font = 'bold 34px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${icon} ${text}`, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ 
    map: texture, 
    transparent: true, 
    depthTest: false,
    depthWrite: false 
  });
  const sprite = new THREE.Sprite(mat);
  sprite.renderOrder = 99999;
  sprite.scale.set(15, 4.2, 1);
  return sprite;
}

export const ThreeDDigitalTwin: React.FC<ThreeDDigitalTwinProps> = ({
  building,
  selectedFloorId,
  features,
  rooms,
  activeRoute,
  crowdZones = [],
  showCrowdDensity = false,
  onSelectFeature,
  onSelectCrowdZone
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark'); // Default to Dark Mode
  const [hoveredFeature, setHoveredFeature] = useState<AccessibilityFeature | null>(null);
  const [cameraView, setCameraView] = useState<'iso' | 'top' | 'front'>('iso');

  const autoRotateRef = useRef<boolean>(false);
  const selectedFloorIdRef = useRef<number>(selectedFloorId);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const buildingGroupRef = useRef<THREE.Group | null>(null);
  const markerMeshesRef = useRef<Map<THREE.Object3D, AccessibilityFeature>>(new Map());
  const crowdMeshesRef = useRef<Map<THREE.Object3D, CrowdZone>>(new Map());

  const controlsStateRef = useRef({
    isDragging: false,
    prevMouseX: 0,
    prevMouseY: 0,
    radius: 175,
    theta: Math.PI / 4,
    phi: Math.PI / 3,
    target: new THREE.Vector3(0, 20, 0),
  });

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    selectedFloorIdRef.current = selectedFloorId;
  }, [selectedFloorId]);

  // Initial Three.js Scene Setup
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 520;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 2. Camera with expanded near-plane to avoid clipping during close inspection
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.5, 3000);
    cameraRef.current = camera;

    // 3. Renderer with hardware acceleration and anti-aliasing
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      powerPreference: "high-performance"
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);

    // Camera Orbit Controls logic
    const updateCamera = () => {
      const cs = controlsStateRef.current;
      cs.phi = Math.max(0.08, Math.min(Math.PI / 2.05, cs.phi));
      cs.radius = Math.max(40, Math.min(600, cs.radius));

      const x = cs.target.x + cs.radius * Math.sin(cs.phi) * Math.sin(cs.theta);
      const y = cs.target.y + cs.radius * Math.cos(cs.phi);
      const z = cs.target.z + cs.radius * Math.sin(cs.phi) * Math.cos(cs.theta);

      camera.position.set(x, y, z);
      camera.lookAt(cs.target);
    };

    updateCamera();

    // Mouse Navigation Listeners
    const onMouseDown = (e: MouseEvent) => {
      controlsStateRef.current.isDragging = true;
      controlsStateRef.current.prevMouseX = e.clientX;
      controlsStateRef.current.prevMouseY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      const cs = controlsStateRef.current;
      if (!cs.isDragging) {
        const rect = container.getBoundingClientRect();
        const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);

        const markers = Array.from(markerMeshesRef.current.keys()) as THREE.Object3D[];
        const intersects = raycaster.intersectObjects(markers, true);

        if (intersects.length > 0) {
          let rootObj: THREE.Object3D | null = intersects[0].object;
          while (rootObj && !markerMeshesRef.current.has(rootObj) && rootObj.parent) {
            rootObj = rootObj.parent;
          }
          if (rootObj && markerMeshesRef.current.has(rootObj)) {
            setHoveredFeature(markerMeshesRef.current.get(rootObj)!);
            container.style.cursor = 'pointer';
            return;
          }
        }
        setHoveredFeature(null);
        container.style.cursor = 'grab';
        return;
      }

      container.style.cursor = 'grabbing';
      const deltaX = e.clientX - cs.prevMouseX;
      const deltaY = e.clientY - cs.prevMouseY;

      cs.theta -= deltaX * 0.007;
      cs.phi -= deltaY * 0.007;

      cs.prevMouseX = e.clientX;
      cs.prevMouseY = e.clientY;
    };

    const onMouseUp = () => {
      controlsStateRef.current.isDragging = false;
      container.style.cursor = 'grab';
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      controlsStateRef.current.radius += e.deltaY * 0.08;
    };

    const onClick = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);

      // Check Feature Beacons first
      const markers = Array.from(markerMeshesRef.current.keys()) as THREE.Object3D[];
      const intersects = raycaster.intersectObjects(markers, true);

      if (intersects.length > 0) {
        let rootObj: THREE.Object3D | null = intersects[0].object;
        while (rootObj && !markerMeshesRef.current.has(rootObj) && rootObj.parent) {
          rootObj = rootObj.parent;
        }
        if (rootObj && markerMeshesRef.current.has(rootObj)) {
          const feat = markerMeshesRef.current.get(rootObj)!;
          if (onSelectFeature) {
            onSelectFeature(feat);
          }
          return;
        }
      }

      // Check Crowd Zone Meshes
      if (crowdMeshesRef.current.size > 0) {
        const crowdTargets = Array.from(crowdMeshesRef.current.keys()) as THREE.Object3D[];
        const crowdIntersects = raycaster.intersectObjects(crowdTargets, true);
        if (crowdIntersects.length > 0) {
          let rootObj: THREE.Object3D | null = crowdIntersects[0].object;
          while (rootObj && !crowdMeshesRef.current.has(rootObj) && rootObj.parent) {
            rootObj = rootObj.parent;
          }
          if (rootObj && crowdMeshesRef.current.has(rootObj)) {
            const zone = crowdMeshesRef.current.get(rootObj)!;
            if (onSelectCrowdZone) {
              onSelectCrowdZone(zone);
            }
          }
        }
      }
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    container.addEventListener('wheel', onWheel, { passive: false });
    container.addEventListener('click', onClick);

    const resizeObserver = new ResizeObserver(() => {
      if (!container || !camera || !renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });
    resizeObserver.observe(container);

    // Animation Render Loop (60 FPS)
    let animationFrameId: number;
    const animate = (time: number) => {
      animationFrameId = requestAnimationFrame(animate);

      if (autoRotateRef.current && !controlsStateRef.current.isDragging) {
        controlsStateRef.current.theta += 0.004;
      }

      updateCamera();

      // Gentle pulsing of feature beacons
      if (buildingGroupRef.current) {
        buildingGroupRef.current.traverse((obj) => {
          if (obj.userData && obj.userData.isBeacon) {
            const baseY = obj.userData.baseY || 5.8;
            obj.position.y = baseY + Math.sin(time * 0.003 + (obj.id % 5)) * 0.4;
          }
          if (obj.userData && obj.userData.isCrowdPulse) {
            const mat = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial;
            if (mat && mat.emissiveIntensity !== undefined) {
              mat.emissiveIntensity = 0.5 + Math.sin(time * 0.004) * 0.3;
            }
          }
        });
      }

      renderer.render(scene, camera);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('click', onClick);
      resizeObserver.disconnect();
      renderer.dispose();
    };
  }, []);

  // Rebuild 3D Model when Building, Floor, Features, Rooms, Crowd, or Theme changes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !building) return;

    // Clear old building geometry
    if (buildingGroupRef.current) {
      scene.remove(buildingGroupRef.current);
      buildingGroupRef.current.clear();
      buildingGroupRef.current = null;
    }
    markerMeshesRef.current.clear();
    crowdMeshesRef.current.clear();

    // Palette Configuration (Dark Mode default vs Soothing Cool-Slate Light Mode)
    const isLight = theme === 'light';
    scene.background = new THREE.Color(isLight ? 0xdbe4ee : 0x0a0f1d);

    // Clear old lights and grid
    const oldLights = scene.children.filter(c => c instanceof THREE.Light || c instanceof THREE.GridHelper);
    oldLights.forEach(l => scene.remove(l));

    // Studio Lighting
    const ambientLight = new THREE.AmbientLight(
      isLight ? 0xffffff : 0x93c5fd, 
      isLight ? 1.6 : 1.1
    );
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(
      isLight ? 0xfffaed : 0x60a5fa, 
      isLight ? 1.8 : 1.4
    );
    dirLight1.position.set(120, 200, 100);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = 2048;
    dirLight1.shadow.mapSize.height = 2048;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(
      isLight ? 0x93c5fd : 0x3b82f6, 
      isLight ? 0.9 : 0.8
    );
    dirLight2.position.set(-100, 100, -80);
    scene.add(dirLight2);

    // Architectural Ground Grid
    const grid = new THREE.GridHelper(
      280, 
      28, 
      isLight ? 0x94a3b8 : 0x1e3a8a, 
      isLight ? 0xcbd5e1 : 0x172554
    );
    grid.position.y = -2;
    scene.add(grid);

    // Building Group Container
    const buildingGroup = new THREE.Group();
    buildingGroupRef.current = buildingGroup;

    const floors = building.floors || [
      { floorId: 0, name: 'Ground Floor', dimensions: { width: 1600, height: 800 }, rooms: [] },
      { floorId: 1, name: 'Floor 1', dimensions: { width: 1600, height: 800 }, rooms: [] },
      { floorId: 2, name: 'Floor 2', dimensions: { width: 1600, height: 800 }, rooms: [] },
      { floorId: 3, name: 'Floor 3', dimensions: { width: 1600, height: 800 }, rooms: [] }
    ];

    const totalFloors = Math.max(1, floors.length);
    const floorHeight = 16.0; // Distance between stacked floors

    // Compute bounding box encompassing BOTH rooms and accessibility features
    const effectiveRooms = rooms.length > 0 ? rooms : (floors[0]?.rooms || []);
    
    let minX = 0, maxX = 1600, minY = 0, maxY = 800;
    if (effectiveRooms.length > 0) {
      minX = Math.min(...effectiveRooms.map(r => r.x));
      maxX = Math.max(...effectiveRooms.map(r => r.x + r.width));
      minY = Math.min(...effectiveRooms.map(r => r.y));
      maxY = Math.max(...effectiveRooms.map(r => r.y + r.height));
    }
    if (features.length > 0) {
      minX = Math.min(minX, ...features.map(f => f.x));
      maxX = Math.max(maxX, ...features.map(f => f.x));
      minY = Math.min(minY, ...features.map(f => f.y));
      maxY = Math.max(maxY, ...features.map(f => f.y));
    }

    const rawWidth = Math.max(100, maxX - minX);
    const rawHeight = Math.max(100, maxY - minY);

    const TARGET_3D_WIDTH = 85;
    const TARGET_3D_DEPTH = 55;
    const scale = Math.min(TARGET_3D_WIDTH / rawWidth, TARGET_3D_DEPTH / rawHeight);

    const buildingWidth = (rawWidth * scale) + 16;
    const buildingDepth = (rawHeight * scale) + 16;

    const to3DCoords = (x: number, y: number, w: number = 0, h: number = 0) => {
      const localX = (x - minX) * scale - (rawWidth * scale) / 2;
      const localZ = (y - minY) * scale - (rawHeight * scale) / 2;
      const localW = w * scale;
      const localD = h * scale;
      return {
        x: localX + localW / 2,
        z: localZ + localD / 2,
        w: Math.max(3.0, localW),
        d: Math.max(3.0, localD)
      };
    };

    // 1. Render Lift and Stair Columns (depthWrite: false so they never occlude/hide rooms behind them)
    const liftFeatures = features.filter(f => f.type === 'lift');
    liftFeatures.forEach((lift) => {
      const liftCoords = to3DCoords(lift.x, lift.y, 60, 60);
      const shaftGeo = new THREE.BoxGeometry(6, totalFloors * floorHeight + 6, 6);
      const shaftMat = new THREE.MeshStandardMaterial({
        color: isLight ? 0x0284c7 : 0x1e3a8a,
        transparent: true,
        opacity: isLight ? 0.35 : 0.35,
        roughness: 0.3,
        metalness: 0.8,
        depthWrite: false
      });
      const shaftMesh = new THREE.Mesh(shaftGeo, shaftMat);
      shaftMesh.position.set(liftCoords.x, (totalFloors * floorHeight) / 2 - 3, liftCoords.z);

      const shaftEdges = new THREE.EdgesGeometry(shaftGeo);
      const shaftLine = new THREE.LineSegments(
        shaftEdges, 
        new THREE.LineBasicMaterial({ color: isLight ? 0x0369a1 : 0x60a5fa, transparent: true, opacity: 0.7, depthWrite: false })
      );
      shaftMesh.add(shaftLine);
      buildingGroup.add(shaftMesh);
    });

    const stairFeatures = features.filter(f => f.type === 'stairs');
    stairFeatures.forEach((stair) => {
      const stairCoords = to3DCoords(stair.x, stair.y, 70, 70);
      const stairGeo = new THREE.BoxGeometry(7, totalFloors * floorHeight + 6, 7);
      const stairMat = new THREE.MeshStandardMaterial({
        color: isLight ? 0xd97706 : 0x78350f,
        transparent: true,
        opacity: isLight ? 0.35 : 0.30,
        roughness: 0.5,
        metalness: 0.4,
        depthWrite: false
      });
      const stairMesh = new THREE.Mesh(stairGeo, stairMat);
      stairMesh.position.set(stairCoords.x, (totalFloors * floorHeight) / 2 - 3, stairCoords.z);

      const stairEdges = new THREE.EdgesGeometry(stairGeo);
      const stairLine = new THREE.LineSegments(
        stairEdges, 
        new THREE.LineBasicMaterial({ color: isLight ? 0xb45309 : 0xf59e0b, transparent: true, opacity: 0.7, depthWrite: false })
      );
      stairMesh.add(stairLine);
      buildingGroup.add(stairMesh);
    });

    // 2. Build Each Floor
    floors.forEach((floor, fIdx) => {
      const floorGroup = new THREE.Group();
      const floorY = fIdx * floorHeight;
      floorGroup.position.y = floorY;

      const isCurrentFloor = String(floor.floorId) === String(selectedFloorId) || Number(floor.floorId) === Number(selectedFloorId);

      // Floor Slab
      const slabGeo = new THREE.BoxGeometry(buildingWidth, 1.2, buildingDepth);
      const slabMat = new THREE.MeshStandardMaterial({
        color: isCurrentFloor 
          ? 0x2563eb 
          : (isLight ? 0xffffff : 0x1e293b),
        roughness: isCurrentFloor ? 0.2 : 0.6,
        metalness: isCurrentFloor ? 0.7 : 0.2,
        transparent: true,
        opacity: isCurrentFloor ? 0.98 : (isLight ? 0.35 : 0.25),
        depthWrite: isCurrentFloor
      });
      const slab = new THREE.Mesh(slabGeo, slabMat);
      slab.receiveShadow = true;
      floorGroup.add(slab);

      // Slab Outline
      const slabEdges = new THREE.EdgesGeometry(slabGeo);
      const slabLine = new THREE.LineSegments(
        slabEdges, 
        new THREE.LineBasicMaterial({ 
          color: isCurrentFloor 
            ? (isLight ? 0x0284c7 : 0x38bdf8) 
            : (isLight ? 0x94a3b8 : 0x334155), 
          linewidth: isCurrentFloor ? 3 : 1,
          transparent: true,
          opacity: isCurrentFloor ? 1.0 : 0.45,
          depthWrite: false
        })
      );
      slab.add(slabLine);

      // Floor Label Badge on Slab
      const labelPlateGeo = new THREE.BoxGeometry(14, 2.4, 0.4);
      const labelPlateMat = new THREE.MeshBasicMaterial({ 
        color: isCurrentFloor ? 0x0284c7 : (isLight ? 0x64748b : 0x334155),
        depthWrite: false
      });
      const labelPlate = new THREE.Mesh(labelPlateGeo, labelPlateMat);
      labelPlate.position.set(-buildingWidth / 2 + 10, 1.8, buildingDepth / 2 + 0.3);
      floorGroup.add(labelPlate);

      // Rooms (uniform height 4.6 across all floors)
      effectiveRooms.forEach((r) => {
        const c = to3DCoords(r.x, r.y, r.width, r.height);
        const wallHeight = 4.6;

        const roomGeo = new THREE.BoxGeometry(c.w * 0.92, wallHeight, c.d * 0.92);
        const roomMat = new THREE.MeshStandardMaterial({
          color: isCurrentFloor 
            ? (r.isAccessible ? 0x3b82f6 : 0x1d4ed8) 
            : (isLight ? 0xe2e8f0 : 0x1e3a8a),
          transparent: true,
          opacity: isCurrentFloor ? 0.88 : (isLight ? 0.22 : 0.15),
          roughness: 0.3,
          metalness: isCurrentFloor ? 0.5 : 0.1,
          depthWrite: isCurrentFloor
        });
        const roomMesh = new THREE.Mesh(roomGeo, roomMat);
        roomMesh.position.set(c.x, wallHeight / 2 + 0.6, c.z);
        roomMesh.castShadow = isCurrentFloor;
        roomMesh.receiveShadow = true;
        floorGroup.add(roomMesh);

        const roomEdges = new THREE.EdgesGeometry(roomGeo);
        const roomWire = new THREE.LineSegments(
          roomEdges,
          new THREE.LineBasicMaterial({
            color: isCurrentFloor 
              ? (isLight ? 0x1d4ed8 : 0x67e8f9) 
              : (isLight ? 0x94a3b8 : 0x3b82f6),
            transparent: true,
            opacity: isCurrentFloor ? 0.95 : (isLight ? 0.30 : 0.20),
            depthWrite: false
          })
        );
        roomMesh.add(roomWire);
      });

      // 3. Render 3D Live Crowd Heatmap Holograms & Badges (when ON)
      if (showCrowdDensity && isCurrentFloor && crowdZones.length > 0) {
        crowdZones.forEach((zone) => {
          const c = to3DCoords(zone.x, zone.y, zone.width, zone.height);
          
          let heatColor = 0x10b981;
          let emissiveColor = 0x059669;
          let badgeBg = '#064e3b';
          let badgeBorder = '#34d399';
          let levelTag = 'Low';

          if (zone.level === 'high') {
            heatColor = 0xef4444;
            emissiveColor = 0xdc2626;
            badgeBg = '#7f1d1d';
            badgeBorder = '#f87171';
            levelTag = 'High';
          } else if (zone.level === 'moderate') {
            heatColor = 0xf59e0b;
            emissiveColor = 0xd97706;
            badgeBg = '#78350f';
            badgeBorder = '#fbbf24';
            levelTag = 'Moderate';
          }

          // Glowing 3D Heat Slab hovering over the floor
          const heatGeo = new THREE.BoxGeometry(c.w, 0.5, c.d);
          const heatMat = new THREE.MeshStandardMaterial({
            color: heatColor,
            emissive: emissiveColor,
            emissiveIntensity: zone.level === 'high' ? 0.85 : 0.55,
            transparent: true,
            opacity: zone.level === 'high' ? 0.65 : (zone.level === 'moderate' ? 0.50 : 0.38),
            depthWrite: false,
            roughness: 0.2
          });
          const heatMesh = new THREE.Mesh(heatGeo, heatMat);
          heatMesh.position.set(c.x, 0.9, c.z);
          heatMesh.userData = { isCrowdPulse: true, zone };
          floorGroup.add(heatMesh);
          crowdMeshesRef.current.set(heatMesh, zone);

          // Heat Outline Wireframe
          const heatEdges = new THREE.EdgesGeometry(heatGeo);
          const heatWire = new THREE.LineSegments(
            heatEdges,
            new THREE.LineBasicMaterial({
              color: heatColor,
              transparent: true,
              opacity: 0.9,
              depthWrite: false
            })
          );
          heatMesh.add(heatWire);

          // Floating Camera-Facing Crowd Badge
          const crowdBadge = createBadgeSprite(
            `${zone.name}: ${zone.peopleCount} ppl (${levelTag})`,
            '👥',
            badgeBg,
            badgeBorder
          );
          if (crowdBadge) {
            crowdBadge.position.set(c.x, 5.8, c.z);
            floorGroup.add(crowdBadge);
            crowdMeshesRef.current.set(crowdBadge, zone);
          }
        });
      }

      // 4. Render 3D Accessibility Markers and 3D Billboard Tags on Active Floor
      const floorFeatures = isCurrentFloor ? features : [];
      
      floorFeatures.forEach(feat => {
        const markerGroup = new THREE.Group();
        const c = to3DCoords(feat.x || 500, feat.y || 300, 0, 0);
        const my = 5.8;

        markerGroup.position.set(c.x, my, c.z);
        markerGroup.userData = { isBeacon: true, baseY: my, feature: feat };

        // Colors & Icons
        let pinColor = 0x10b981; // Green
        let tagBg = '#065f46';
        let tagBorder = '#34d399';
        let icon = '♿';

        if (feat.status === 'broken' || feat.type === 'obstacle') {
          pinColor = 0xef4444; // Red
          tagBg = '#7f1d1d';
          tagBorder = '#f87171';
          icon = '⚠️';
        } else if (feat.status === 'unverified') {
          pinColor = 0xf59e0b; // Yellow
          tagBg = '#78350f';
          tagBorder = '#fbbf24';
          icon = '❓';
        } else if (feat.type === 'lift') {
          pinColor = 0x3b82f6; // Blue
          tagBg = '#1e3a8a';
          tagBorder = '#60a5fa';
          icon = '🛗';
        } else if (feat.type === 'toilet') {
          pinColor = 0xa855f7; // Purple
          tagBg = '#581c87';
          tagBorder = '#c084fc';
          icon = '🚻';
        } else if (feat.type === 'stairs') {
          pinColor = 0xf97316; // Orange
          tagBg = '#7c2d12';
          tagBorder = '#fb923c';
          icon = '🪜';
        }

        const beaconGeo = feat.type === 'lift' 
          ? new THREE.CylinderGeometry(1.4, 1.4, 3.2, 16)
          : feat.type === 'toilet'
          ? new THREE.SphereGeometry(1.5, 16, 16)
          : new THREE.OctahedronGeometry(1.6, 0);

        const beaconMat = new THREE.MeshStandardMaterial({
          color: pinColor,
          emissive: pinColor,
          emissiveIntensity: 0.95,
          roughness: 0.1,
          metalness: 0.9
        });
        const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
        markerGroup.add(beaconMesh);

        // Ground Vertical Anchor Line
        const lineGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, -5.0, 0)
        ]);
        const lineMat = new THREE.LineBasicMaterial({ color: pinColor, transparent: true, opacity: 0.85, depthWrite: false });
        const anchorLine = new THREE.Line(lineGeo, lineMat);
        markerGroup.add(anchorLine);

        // Ground pulsing ring
        const ringGeo = new THREE.RingGeometry(0.9, 2.0, 24);
        const ringMat = new THREE.MeshBasicMaterial({ color: pinColor, side: THREE.DoubleSide, transparent: true, opacity: 0.8, depthWrite: false });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.rotation.x = Math.PI / 2;
        ringMesh.position.y = -4.9;
        markerGroup.add(ringMesh);

        // 3D Floating Camera-Facing Tag for Active Floor Features
        const badgeSprite = createBadgeSprite(feat.name || feat.type, icon, tagBg, tagBorder);
        if (badgeSprite) {
          badgeSprite.position.set(0, 4.5, 0);
          markerGroup.add(badgeSprite);
        }

        floorGroup.add(markerGroup);
        markerMeshesRef.current.set(beaconMesh, feat);
      });

      // 5. If Active Route is present and on this floor, draw 3D Glowing Spline
      if (activeRoute && isCurrentFloor) {
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(-buildingWidth / 3, 1.4, buildingDepth / 3),
          new THREE.Vector3(-10, 1.4, 10),
          new THREE.Vector3(5, 1.4, 0),
          new THREE.Vector3(20, 1.4, -10)
        ]);
        const tubeGeo = new THREE.TubeGeometry(curve, 32, 0.6, 8, false);
        const tubeMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.95 });
        const routeMesh = new THREE.Mesh(tubeGeo, tubeMat);
        floorGroup.add(routeMesh);
      }

      buildingGroup.add(floorGroup);
    });

    scene.add(buildingGroup);
    controlsStateRef.current.target.set(0, (totalFloors * floorHeight) / 3, 0);

  }, [building, selectedFloorId, features, rooms, activeRoute, crowdZones, showCrowdDensity, theme]);

  const handleSetCameraPreset = (preset: 'iso' | 'top' | 'front') => {
    setCameraView(preset);
    const cs = controlsStateRef.current;
    if (preset === 'top') {
      cs.phi = 0.09;
      cs.theta = 0;
      cs.radius = 210;
    } else if (preset === 'front') {
      cs.phi = Math.PI / 2.08;
      cs.theta = 0;
      cs.radius = 180;
    } else {
      cs.phi = Math.PI / 3;
      cs.theta = Math.PI / 4;
      cs.radius = 175;
    }
  };

  return (
    <div className="relative w-full h-full min-h-[500px] flex flex-col select-none overflow-hidden rounded-2xl">
      {/* 3D Viewport HUD Toolbar */}
      <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between pointer-events-none gap-2">
        {/* Left Status Badge */}
        <div className="flex items-center space-x-2 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/60 shadow-lg pointer-events-auto">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-xs font-bold text-slate-200">
            {building.name}
          </span>
          <span className="text-[10px] text-blue-400 font-mono">
            360° Real-time Twin
          </span>
          {showCrowdDensity && (
            <span className="bg-emerald-950 text-emerald-400 border border-emerald-700/60 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center space-x-1">
              <Users className="w-2.5 h-2.5 mr-0.5" />
              <span>3D Crowd Heatmap</span>
            </span>
          )}
        </div>

        {/* Right Camera & Theme Controls */}
        <div className="flex items-center space-x-1.5 pointer-events-auto bg-slate-900/80 backdrop-blur-md p-1 rounded-xl border border-slate-700/60 shadow-lg">
          {/* Light / Dark Mode Toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1 cursor-pointer transition-all ${
              theme === 'light'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Toggle Light Mode / Dark Mode"
          >
            {theme === 'light' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{theme === 'light' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>

          <div className="w-px h-4 bg-slate-700 mx-0.5" />

          {/* 360 Auto-Spin */}
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1 cursor-pointer transition-all ${
              autoRotate 
                ? 'bg-blue-600 text-white shadow-xs' 
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Toggle 360° Auto-Rotation"
          >
            <RotateCw className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">360° Spin</span>
          </button>

          {/* Preset Camera Views */}
          <div className="flex items-center bg-slate-800/80 rounded-lg p-0.5 space-x-0.5">
            <button
              onClick={() => handleSetCameraPreset('iso')}
              className={`px-2 py-0.5 text-[11px] font-bold rounded cursor-pointer ${
                cameraView === 'iso' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Isometric
            </button>
            <button
              onClick={() => handleSetCameraPreset('top')}
              className={`px-2 py-0.5 text-[11px] font-bold rounded cursor-pointer ${
                cameraView === 'top' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Top-Down
            </button>
            <button
              onClick={() => handleSetCameraPreset('front')}
              className={`px-2 py-0.5 text-[11px] font-bold rounded cursor-pointer ${
                cameraView === 'front' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Elevation
            </button>
          </div>
        </div>
      </div>

      {/* Main 3D Canvas Mount Point */}
      <div 
        ref={mountRef} 
        className="w-full h-full min-h-[500px] cursor-grab active:cursor-grabbing flex-1" 
      />

      {/* Hovered Feature Popup Card */}
      {hoveredFeature && (
        <div className="absolute bottom-12 left-4 z-20 bg-slate-900/90 backdrop-blur-md p-3 rounded-xl border border-slate-700 text-white shadow-2xl pointer-events-none flex items-center space-x-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
            hoveredFeature.status === 'broken' ? 'bg-rose-600' : 'bg-emerald-600'
          }`}>
            {hoveredFeature.type === 'ramp' ? '♿' : hoveredFeature.type === 'lift' ? '🛗' : hoveredFeature.type === 'toilet' ? '🚻' : '📍'}
          </div>
          <div>
            <div className="text-xs font-bold">{hoveredFeature.name}</div>
            <div className="text-[10px] text-slate-400 capitalize">Status: {hoveredFeature.status} • Click to inspect</div>
          </div>
        </div>
      )}

      {/* Orbit Helper Guide at bottom */}
      <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between text-[11px] text-slate-400 bg-slate-900/70 backdrop-blur-xs px-3.5 py-1.5 rounded-xl border border-slate-800/80 pointer-events-none">
        <div className="flex items-center space-x-3">
          <span className="flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
            <span>Left Drag: <strong>Rotate 360°</strong></span>
          </span>
          <span>•</span>
          <span>Scroll: <strong>Zoom In/Out</strong></span>
          <span>•</span>
          <span className="text-blue-300">Click Beacons or Heat Zones: <strong>Inspect</strong></span>
        </div>
        <div className="flex items-center space-x-1 text-slate-500 font-mono text-[10px]">
          <Compass className="w-3 h-3 text-blue-400" />
          <span>WebGL 60FPS</span>
        </div>
      </div>
    </div>
  );
};
