import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Building, AccessibilityFeature, RouteResult, BuildingRoom } from '../types';
import { 
  Compass, 
  Box,
  RotateCw,
  Sun,
  Moon
} from 'lucide-react';

interface ThreeDDigitalTwinProps {
  building: Building;
  selectedFloorId: number;
  features: AccessibilityFeature[];
  rooms: BuildingRoom[];
  activeRoute: RouteResult | null;
  onSelectFeature?: (feature: AccessibilityFeature) => void;
  onSelectFloor?: (floorId: number) => void;
}

// Helper to generate camera-facing 3D Billboard Sprite Badges
function createBadgeSprite(text: string, icon: string, bgColor: string, borderColor: string): THREE.Sprite | null {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
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
  ctx.font = 'bold 36px sans-serif';
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
  sprite.scale.set(14, 4.2, 1);
  return sprite;
}

export const ThreeDDigitalTwin: React.FC<ThreeDDigitalTwinProps> = ({
  building,
  selectedFloorId,
  features,
  rooms,
  activeRoute,
  onSelectFeature,
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

  const controlsStateRef = useRef({
    isDragging: false,
    prevMouseX: 0,
    prevMouseY: 0,
    theta: Math.PI / 4,
    phi: Math.PI / 3.5,
    radius: 140,
    target: new THREE.Vector3(0, 10, 0)
  });

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    selectedFloorIdRef.current = selectedFloorId;
  }, [selectedFloorId]);

  // 1. Initial Scene Setup
  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 520;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 2000);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    container.replaceChildren(renderer.domElement);

    // Balanced Soothing Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
    dirLight.position.set(80, 140, 60);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const blueRimLight = new THREE.PointLight(0x38bdf8, 2.0, 280);
    blueRimLight.position.set(-80, 50, -80);
    scene.add(blueRimLight);

    const indigoRimLight = new THREE.PointLight(0x818cf8, 1.8, 280);
    indigoRimLight.position.set(80, 40, 80);
    scene.add(indigoRimLight);

    // Animation Loop
    let reqAnimId: number;
    const animate = () => {
      reqAnimId = requestAnimationFrame(animate);

      const cs = controlsStateRef.current;
      if (autoRotateRef.current && !cs.isDragging) {
        cs.theta += 0.003;
      }

      cs.phi = Math.max(0.08, Math.min(Math.PI / 2 - 0.05, cs.phi));
      cs.radius = Math.max(50, Math.min(280, cs.radius));

      const x = cs.target.x + cs.radius * Math.sin(cs.phi) * Math.sin(cs.theta);
      const y = cs.target.y + cs.radius * Math.cos(cs.phi);
      const z = cs.target.z + cs.radius * Math.sin(cs.phi) * Math.cos(cs.theta);

      camera.position.set(x, y, z);
      camera.lookAt(cs.target);

      // Pulse Beacons
      markerMeshesRef.current.forEach((feat, mesh) => {
        if (mesh.userData?.isBeacon) {
          const time = Date.now() * 0.003;
          mesh.position.y = mesh.userData.baseY + Math.sin(time + (feat.x || 0)) * 0.6;
          mesh.rotation.y += 0.02;
        }
      });

      renderer.render(scene, camera);
    };
    animate();

    // Mouse Events
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        controlsStateRef.current.isDragging = true;
        controlsStateRef.current.prevMouseX = e.clientX;
        controlsStateRef.current.prevMouseY = e.clientY;
      }
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

    return () => {
      cancelAnimationFrame(reqAnimId);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('click', onClick);
      resizeObserver.disconnect();
      renderer.dispose();
    };
  }, []);

  // 2. Build 3D Building Geometry (Re-runs on building, floor, theme or features change)
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !building) return;

    const isLight = theme === 'light';

    // Soft Matte Background Colors (Eye-Soothing Cool Slate in light mode, Dark Slate in dark mode)
    const bgColor = isLight ? 0xdbe4ee : 0x0f172a;
    scene.background = new THREE.Color(bgColor);
    scene.fog = new THREE.FogExp2(bgColor, isLight ? 0.0022 : 0.0025);

    if (buildingGroupRef.current) {
      scene.remove(buildingGroupRef.current);
    }
    markerMeshesRef.current.clear();

    const buildingGroup = new THREE.Group();
    buildingGroupRef.current = buildingGroup;

    // Soft Ground Grid & Base Plate
    const gridColor1 = isLight ? 0x94a3b8 : 0x1e293b;
    const gridColor2 = isLight ? 0xcbd5e1 : 0x0a101d;
    const gridHelper = new THREE.GridHelper(260, 52, gridColor1, gridColor2);
    gridHelper.position.y = -8;
    buildingGroup.add(gridHelper);

    const baseGeo = new THREE.CylinderGeometry(115, 120, 2.5, 48);
    const baseMat = new THREE.MeshStandardMaterial({ 
      color: isLight ? 0xc5d2e0 : 0x0b1329, 
      roughness: 0.8, 
      metalness: 0.1 
    });
    const basePlate = new THREE.Mesh(baseGeo, baseMat);
    basePlate.position.y = -9;
    basePlate.receiveShadow = true;
    buildingGroup.add(basePlate);

    const floors = building.floors || [{ floorId: 0, name: 'Ground Floor', dimensions: { width: 1000, height: 600 }, rooms: [] }];
    const totalFloors = Math.max(floors.length, 1);
    const floorHeight = 13;

    // Calculate Dynamic Bounding Box
    const effectiveRooms = (rooms && rooms.length > 0) ? rooms : (building.floors?.[0]?.rooms || []);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    if (effectiveRooms.length > 0) {
      effectiveRooms.forEach(r => {
        const rx = Number.isFinite(r.x) ? r.x : 0;
        const ry = Number.isFinite(r.y) ? r.y : 0;
        const rw = Number.isFinite(r.width) ? r.width : 50;
        const rh = Number.isFinite(r.height) ? r.height : 50;
        minX = Math.min(minX, rx);
        maxX = Math.max(maxX, rx + rw);
        minY = Math.min(minY, ry);
        maxY = Math.max(maxY, ry + rh);
      });
    }

    if (features && features.length > 0) {
      features.forEach(f => {
        if (Number.isFinite(f.x) && Number.isFinite(f.y)) {
          minX = Math.min(minX, f.x - 40);
          maxX = Math.max(maxX, f.x + 40);
          minY = Math.min(minY, f.y - 40);
          maxY = Math.max(maxY, f.y + 40);
        }
      });
    }

    if (!Number.isFinite(minX) || maxX <= minX) {
      minX = 0;
      maxX = 1000;
    }
    if (!Number.isFinite(minY) || maxY <= minY) {
      minY = 0;
      maxY = 600;
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
        depthWrite: false // Prevents occluding geometry behind shaft during 360 rotation
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
        depthWrite: false // Prevents occluding geometry behind stair during 360 rotation
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

      // Floor Slab (depthWrite: false on inactive slabs so lower/upper floors are never occluded!)
      const slabGeo = new THREE.BoxGeometry(buildingWidth, 1.2, buildingDepth);
      const slabMat = new THREE.MeshStandardMaterial({
        color: isCurrentFloor 
          ? 0x2563eb 
          : (isLight ? 0xffffff : 0x1e293b),
        roughness: isCurrentFloor ? 0.2 : 0.6,
        metalness: isCurrentFloor ? 0.7 : 0.2,
        transparent: true,
        opacity: isCurrentFloor ? 0.98 : (isLight ? 0.35 : 0.25),
        depthWrite: isCurrentFloor // Only active floor writes to depth buffer
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

      // Rooms (depthWrite: false on inactive rooms so they never block view during 360 rotation!)
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
          depthWrite: isCurrentFloor // Inactive rooms won't occlude other elements
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

      // 3. Render 3D Accessibility Markers and 3D Billboard Tags on Active Floor
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

      // 4. If Active Route is present and on this floor, draw 3D Glowing Spline
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

  }, [building, selectedFloorId, features, rooms, activeRoute, theme]);

  const handleSetCameraPreset = (preset: 'iso' | 'top' | 'front') => {
    setCameraView(preset);
    const cs = controlsStateRef.current;
    if (preset === 'iso') {
      cs.theta = Math.PI / 4;
      cs.phi = Math.PI / 3.5;
      cs.radius = 140;
    } else if (preset === 'top') {
      cs.theta = 0;
      cs.phi = 0.12;
      cs.radius = 150;
    } else if (preset === 'front') {
      cs.theta = 0;
      cs.phi = Math.PI / 2.2;
      cs.radius = 130;
    }
  };

  const isLight = theme === 'light';

  return (
    <div className={`relative w-full h-[520px] rounded-xl overflow-hidden border shadow-2xl select-none transition-colors duration-300 ${
      isLight ? 'bg-slate-200/80 border-slate-300' : 'bg-slate-950 border-slate-800'
    }`}>
      {/* 3D Canvas Mount */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Floating 3D HUD Top Toolbar */}
      <div className="absolute top-3 left-3 right-3 flex flex-wrap items-center justify-between pointer-events-none gap-2">
        {/* Left Status Badge */}
        <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border shadow-lg pointer-events-auto text-xs backdrop-blur-md ${
          isLight 
            ? 'bg-slate-100/90 border-slate-300 text-slate-800' 
            : 'bg-slate-900/80 border-slate-700/70 text-white'
        }`}>
          <Box className="w-4 h-4 text-blue-500 animate-pulse" />
          <span className="font-bold">{building.name}</span>
          <span className={isLight ? 'text-slate-400' : 'text-slate-500'}>•</span>
          <span className="text-blue-600 font-mono font-semibold">360° Real-time Twin</span>
        </div>

        {/* Right Camera & Theme Tools */}
        <div className={`flex items-center space-x-1.5 p-1 rounded-lg border shadow-lg pointer-events-auto text-xs backdrop-blur-md ${
          isLight 
            ? 'bg-slate-100/90 border-slate-300 text-slate-700' 
            : 'bg-slate-900/80 border-slate-700/70 text-white'
        }`}>
          {/* Light / Dark Mode Toggle */}
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className={`px-2.5 py-1 rounded-md transition-all flex items-center space-x-1 font-semibold cursor-pointer ${
              isLight 
                ? 'bg-slate-300/80 text-slate-900 hover:bg-slate-300' 
                : 'bg-indigo-900/80 text-indigo-200 hover:bg-indigo-800'
            }`}
            title="Toggle Light / Dark 3D Theme"
          >
            {isLight ? <Moon className="w-3.5 h-3.5 text-slate-700" /> : <Sun className="w-3.5 h-3.5 text-amber-400" />}
            <span>{isLight ? 'Dark Mode' : 'Light Mode'}</span>
          </button>

          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`px-2.5 py-1 rounded-md transition-all flex items-center space-x-1 font-medium cursor-pointer ${
              autoRotate 
                ? 'bg-blue-600 text-white shadow-xs' 
                : (isLight ? 'text-slate-700 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-slate-800')
            }`}
            title="Toggle 360 Auto-Rotation"
          >
            <RotateCw className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin' : ''}`} style={{ animationDuration: '8s' }} />
            <span>360° Spin</span>
          </button>

          <div className={`h-4 w-px mx-1 ${isLight ? 'bg-slate-300' : 'bg-slate-700'}`} />

          {/* Camera Angles */}
          <button
            onClick={() => handleSetCameraPreset('iso')}
            className={`px-2 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer ${
              cameraView === 'iso' 
                ? (isLight ? 'bg-blue-600 text-white' : 'bg-slate-700 text-cyan-300') 
                : (isLight ? 'text-slate-700 hover:bg-slate-200' : 'text-slate-400 hover:text-white')
            }`}
          >
            Isometric
          </button>
          <button
            onClick={() => handleSetCameraPreset('top')}
            className={`px-2 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer ${
              cameraView === 'top' 
                ? (isLight ? 'bg-blue-600 text-white' : 'bg-slate-700 text-cyan-300') 
                : (isLight ? 'text-slate-700 hover:bg-slate-200' : 'text-slate-400 hover:text-white')
            }`}
          >
            Top-Down
          </button>
          <button
            onClick={() => handleSetCameraPreset('front')}
            className={`px-2 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer ${
              cameraView === 'front' 
                ? (isLight ? 'bg-blue-600 text-white' : 'bg-slate-700 text-cyan-300') 
                : (isLight ? 'text-slate-700 hover:bg-slate-200' : 'text-slate-400 hover:text-white')
            }`}
          >
            Elevation
          </button>
        </div>
      </div>

      {/* Hovered Feature Tooltip Card */}
      {hoveredFeature && (
        <div className={`absolute top-16 left-4 p-3.5 rounded-xl border shadow-2xl max-w-xs pointer-events-none animate-in fade-in zoom-in duration-200 backdrop-blur-md ${
          isLight 
            ? 'bg-white/95 border-blue-400 text-slate-900' 
            : 'bg-slate-900/90 border-blue-500/50 text-white'
        }`}>
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-base">
              {hoveredFeature.type === 'ramp' ? '♿' : hoveredFeature.type === 'lift' ? '🛗' : hoveredFeature.type === 'toilet' ? '🚻' : '⚠️'}
            </span>
            <span className="font-bold text-xs text-blue-600">{hoveredFeature.name}</span>
          </div>
          <p className={`text-[11px] leading-relaxed line-clamp-2 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
            {hoveredFeature.description || 'Verified accessibility feature in digital twin graph.'}
          </p>
          <div className={`flex items-center justify-between mt-2 pt-2 border-t text-[10px] ${
            isLight ? 'border-slate-200 text-slate-500' : 'border-slate-800 text-slate-400'
          }`}>
            <span>Status: <strong className="text-emerald-600 uppercase">{hoveredFeature.status}</strong></span>
            <span className="text-blue-600 font-semibold">Click for details ↗</span>
          </div>
        </div>
      )}

      {/* 3D Navigation Guide Helper Overlay */}
      <div className={`absolute bottom-3 left-3 px-3 py-2 rounded-lg border text-[11px] flex items-center space-x-4 shadow-lg pointer-events-none backdrop-blur-md ${
        isLight 
          ? 'bg-slate-100/90 border-slate-300 text-slate-700' 
          : 'bg-slate-900/80 border-slate-800 text-slate-400'
      }`}>
        <div className="flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
          <span className={`font-medium ${isLight ? 'text-slate-900' : 'text-slate-300'}`}>🖱️ Left Drag: Rotate 360°</span>
        </div>
        <span>•</span>
        <span>📜 Scroll: Zoom In/Out</span>
        <span>•</span>
        <span className="text-blue-600 font-semibold">💎 Click Beacons: Inspect</span>
      </div>

      {/* Compass / Orientation Rose */}
      <div className={`absolute bottom-3 right-3 p-2 rounded-full border shadow-lg pointer-events-none flex items-center justify-center backdrop-blur-md ${
        isLight 
          ? 'bg-slate-100/90 border-slate-300 text-slate-700' 
          : 'bg-slate-900/80 border-slate-800 text-slate-400'
      }`}>
        <Compass className="w-5 h-5 text-blue-500" />
      </div>
    </div>
  );
};
