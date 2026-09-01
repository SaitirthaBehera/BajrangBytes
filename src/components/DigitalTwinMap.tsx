import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Building, AccessibilityFeature, RouteResult, FloorMap, BuildingRoom, CrowdZone } from '../types';
import { FeatureDetailModal } from './FeatureDetailModal';
import { ThreeDDigitalTwin } from './ThreeDDigitalTwin';
import { api } from '../services/api';
import { getCrowdZonesForFloor, getCrowdLevelTheme } from '../data/crowdDensityData';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Filter, 
  Layers, 
  ArrowRight,
  Users,
  Activity,
  X,
  Info,
  Sparkles,
  Video,
  Camera,
  Box,
  Map as MapIcon
} from 'lucide-react';

interface DigitalTwinMapProps {
  building: Building | null;
  features: AccessibilityFeature[];
  activeRoute: RouteResult | null;
  onReportIssueAtLocation?: (buildingId: string, floorId: number, x: number, y: number) => void;
  onOpenReportTab?: () => void;
  onNavigateToRoute?: () => void;
}

export const DigitalTwinMap: React.FC<DigitalTwinMapProps> = ({
  building,
  features,
  activeRoute,
  onReportIssueAtLocation,
  onOpenReportTab,
  onNavigateToRoute
}) => {
  const [selectedFloorId, setSelectedFloorId] = useState<number>(0);
  const [selectedFeature, setSelectedFeature] = useState<AccessibilityFeature | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [showRouteLayer, setShowRouteLayer] = useState<boolean>(true);
  const [showCrowdDensity, setShowCrowdDensity] = useState<boolean>(false);
  const [selectedCrowdZone, setSelectedCrowdZone] = useState<CrowdZone | null>(null);
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('3d'); // 3D Twin is default!
  const [currentFloorMap, setCurrentFloorMap] = useState<FloorMap | null>(null);
  const [dynamicFeatures, setDynamicFeatures] = useState<AccessibilityFeature[]>([]);
  const [rooms, setRooms] = useState<BuildingRoom[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Dynamic Live Telemetry State
  const [liveCrowdData, setLiveCrowdData] = useState<Record<string, { peopleCount: number; density: number; level: 'low' | 'moderate' | 'high'; lastUpdated?: string; source?: string; camera_zones?: Record<string, number> }>>({});
  const [, setCrowdApiStatus] = useState<'idle' | 'live' | 'polling' | 'offline'>('idle');
  const [lastTelemetryTimestamp, setLastTelemetryTimestamp] = useState<string | null>(null);
  const [currentTelemetrySource, setCurrentTelemetrySource] = useState<'yolo_video' | 'mock'>('mock');
  const [currentCameraId, setCurrentCameraId] = useState<string | null>(null);
  const [currentTotalPeople, setCurrentTotalPeople] = useState<number | null>(null);
  const [currentCameraZones, setCurrentCameraZones] = useState<Record<string, number> | null>(null);

  // Base spatial crowd zones from static layout geometry
  const baseCrowdZones: CrowdZone[] = building
    ? getCrowdZonesForFloor(building.id, selectedFloorId)
    : [];

  // Compute live merged crowd density zones with dynamic telemetry from FastAPI
  const crowdZones: CrowdZone[] = baseCrowdZones.map(zone => {
    const live = liveCrowdData[zone.id];
    if (live) {
      return {
        ...zone,
        peopleCount: live.peopleCount,
        density: live.density,
        level: live.level,
        lastUpdated: live.lastUpdated || zone.lastUpdated,
        source: (live.source as any) || 'mock',
        camera_zones: live.camera_zones
      };
    }
    return zone;
  });

  // Keep selected zone popover in sync with live dynamic stream
  const activeSelectedCrowdZone = selectedCrowdZone
    ? crowdZones.find(z => z.id === selectedCrowdZone.id) || selectedCrowdZone
    : null;

  // ESC key listener to dismiss selected crowd zone modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedCrowdZone) {
        setSelectedCrowdZone(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCrowdZone]);

  // Real-time polling effect when crowd density layer is active (every 3.5s)
  useEffect(() => {
    if (!showCrowdDensity || !building) {
      setCrowdApiStatus('idle');
      return;
    }

    let isSubscribed = true;

    const fetchLiveTelemetry = async () => {
      try {
        const telemetry = await api.getCrowdDensity(selectedFloorId, building.id);
        if (!isSubscribed) return;

        if (telemetry && telemetry.zones && telemetry.zones.length > 0) {
          const map: Record<string, { peopleCount: number; density: number; level: 'low' | 'moderate' | 'high'; lastUpdated?: string; source?: string; camera_zones?: Record<string, number> }> = {};
          
          const timeStr = telemetry.timestamp
            ? new Date(telemetry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

          const isYolo = telemetry.source === 'yolo_video';
          setCurrentTelemetrySource(isYolo ? 'yolo_video' : 'mock');
          setCurrentCameraId(telemetry.camera_id || (isYolo ? 'CAM-01' : null));
          setCurrentTotalPeople(telemetry.total_people !== undefined ? telemetry.total_people : null);
          setCurrentCameraZones(telemetry.camera_zones || telemetry.camera_telemetry?.zones || null);

          telemetry.zones.forEach(z => {
            map[z.zone_id] = {
              peopleCount: z.people_count,
              density: z.density,
              level: z.level,
              lastUpdated: isYolo ? `YOLO Video (${timeStr})` : `Live (${timeStr})`,
              source: telemetry.source || 'mock',
              camera_zones: z.camera_zones || (isYolo ? telemetry.camera_zones : undefined)
            };
          });

          setLiveCrowdData(map);
          setLastTelemetryTimestamp(timeStr);
          setCrowdApiStatus('live');
        } else {
          setCrowdApiStatus('live');
        }
      } catch (err) {
        if (isSubscribed) {
          console.warn('[DigitalTwinMap] Crowd telemetry notice:', err);
          setCrowdApiStatus('offline');
        }
      }
    };

    fetchLiveTelemetry();
    const interval = setInterval(fetchLiveTelemetry, 3500);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [showCrowdDensity, building?.id, selectedFloorId]);

  useEffect(() => {
    if (building && building.floors && building.floors.length > 0) {
      setSelectedFloorId(building.floors[0].floorId);
    }
  }, [building]);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function loadFloorData() {
      if (!building) return;

      if (!building.floors || building.floors.length === 0) {
        setIsLoading(true);
        return;
      }
      
      const currentFloorId = selectedFloorId;
      const floorExists = building.floors.some(f => f.floorId === currentFloorId);
      const floorToLoad = floorExists ? currentFloorId : (building.floors[0]?.floorId);

      if (floorToLoad === undefined) {
        setIsLoading(false);
        setError("No floor data available for this building.");
        return;
      }

      if (!floorExists) {
        setSelectedFloorId(floorToLoad);
        return;
      }

      setIsLoading(true);
      setError(null);
      setCurrentFloorMap(null);
      setRooms([]);
      setDynamicFeatures([]);
      
      try {
        const floorMap = await api.getFloorMap(building.id, String(floorToLoad));
        const floorRooms = await api.getRoomsForFloor(String(floorToLoad), building.id);
        const floorFeatures = await api.getAccessibilityFeatures(building.id, String(floorToLoad));
        
        if (isMounted) {
          setCurrentFloorMap(floorMap);
          setRooms(floorRooms);
          setDynamicFeatures(floorFeatures);
        }
      } catch (err) {
        if (isMounted) {
          console.error('[DEBUG] Failed to load floor data:', err);
          setError('Failed to load floor map data. Please try again.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }
    
    loadFloorData();
    return () => { isMounted = false; controller.abort(); };
  }, [building?.id, selectedFloorId]);

  if (!building) {
    return (
      <div className="text-center py-20 text-slate-500">
        Please select a building to view the Digital Twin map.
      </div>
    );
  }
  
  const currentFloor = building.floors.find(f => f.floorId === selectedFloorId) || building.floors[0];
  const floorFeatures = dynamicFeatures;

  if (!currentFloor) {
    return (
      <div className="text-center py-20 text-slate-500">
        No floor data available for this building.
      </div>
    );
  }

  // Filter features
  const filteredFeatures = floorFeatures.filter(f => {
    if (selectedCategoryFilter === 'all') return true;
    if (selectedCategoryFilter === 'wheelchair') return f.type === 'ramp' || f.type === 'lift' || f.type === 'toilet' || f.type === 'parking';
    if (selectedCategoryFilter === 'visual') return f.type === 'tactile_path' || f.type === 'signage';
    if (selectedCategoryFilter === 'hearing') return f.type === 'signage';
    if (selectedCategoryFilter === 'elderly') return f.type === 'ramp' || f.type === 'lift';
    return f.type === selectedCategoryFilter;
  });

  // Get marker color & symbol
  const getMarkerStyle = (status: string, verification: string) => {
    if (status === 'unverified' || verification === 'unverified') {
      return {
        bg: 'bg-amber-500',
        border: 'border-amber-200',
        ring: 'ring-amber-400/30',
        icon: '❓',
        label: 'Unverified Report'
      };
    }
    if (status === 'working') {
      return {
        bg: 'bg-emerald-500',
        border: 'border-emerald-200',
        ring: 'ring-emerald-400/30',
        icon: '🟢',
        label: 'Accessible / Working'
      };
    }
    if (status === 'broken' || status === 'temporary') {
      return {
        bg: 'bg-rose-600',
        border: 'border-rose-200',
        ring: 'ring-rose-500/40',
        icon: '🔴',
        label: 'Barrier / Broken'
      };
    }
    return {
      bg: 'bg-slate-700',
      border: 'border-slate-300',
      ring: 'ring-slate-500/30',
      icon: '⚫',
      label: 'Unknown Status'
    };
  };

  const handleFloorPlanClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);

    if (onReportIssueAtLocation) {
      onReportIssueAtLocation(building.id, selectedFloorId, x, y);
    }
  };

  return (
    <div id="section-digital-twin" className="space-y-6">
      {/* Header bar */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
            <Layers className="w-4 h-4" />
            <span>Digital Twin Spatial Model</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">{building.name}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{building.address}</p>
        </div>

        {/* Floor switcher tabs */}
        <div className="flex items-center space-x-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200 overflow-x-auto">
          {building.floors.map(floor => (
            <button
              key={floor.floorId}
              id={`btn-floor-tab-${floor.floorId}`}
              onClick={() => {
                setSelectedFloorId(floor.floorId);
                setSelectedCrowdZone(null);
              }}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                selectedFloorId === floor.floorId
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
              }`}
            >
              {floor.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main Map Viewer & Control Panel Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Control Panel / Filters */}
        <div className="lg:col-span-1 space-y-5">
          {/* Legend */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Status Legend</span>
              <span className="text-[10px] text-slate-400">4 Marker Types</span>
            </h3>
            <div className="space-y-2 text-xs font-medium">
              <div className="flex items-center space-x-2.5 p-1.5 rounded-lg bg-emerald-50/60 border border-emerald-100">
                <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 shadow-xs flex items-center justify-center text-[8px] text-white font-bold">✓</span>
                <span className="text-emerald-900 font-semibold">🟢 Green = Accessible / Working</span>
              </div>
              <div className="flex items-center space-x-2.5 p-1.5 rounded-lg bg-rose-50/60 border border-rose-100">
                <span className="w-3.5 h-3.5 rounded-full bg-rose-600 shadow-xs flex items-center justify-center text-[8px] text-white font-bold">✕</span>
                <span className="text-rose-900 font-semibold">🔴 Red = Barrier / Broken</span>
              </div>
              <div className="flex items-center space-x-2.5 p-1.5 rounded-lg bg-amber-50/60 border border-amber-100">
                <span className="w-3.5 h-3.5 rounded-full bg-amber-500 shadow-xs flex items-center justify-center text-[8px] text-white font-bold">?</span>
                <span className="text-amber-900 font-semibold">🟡 Yellow = Unverified Report</span>
              </div>
              <div className="flex items-center space-x-2.5 p-1.5 rounded-lg bg-slate-100 border border-slate-200">
                <span className="w-3.5 h-3.5 rounded-full bg-slate-700 shadow-xs"></span>
                <span className="text-slate-700 font-semibold">⚫ Black/Grey = No Data</span>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center">
                <Filter className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                <span>Accessibility Filter</span>
              </h3>
              {selectedCategoryFilter !== 'all' && (
                <button
                  onClick={() => setSelectedCategoryFilter('all')}
                  className="text-[11px] text-blue-600 hover:underline font-semibold cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>

            <div className="space-y-1.5 text-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Profile Profiles</span>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'all', label: 'All Features' },
                  { id: 'wheelchair', label: 'Wheelchair' },
                  { id: 'visual', label: 'Visual' },
                  { id: 'elderly', label: 'Elderly' },
                ].map(item => (
                  <button
                    key={item.id}
                    id={`filter-profile-${item.id}`}
                    onClick={() => setSelectedCategoryFilter(item.id)}
                    className={`px-2.5 py-1.5 rounded-lg font-medium text-left transition-all cursor-pointer ${
                      selectedCategoryFilter === item.id
                        ? 'bg-blue-600 text-white font-semibold shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/60'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <span className="text-[11px] font-bold text-slate-500 uppercase pt-2 block">Feature Types</span>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'ramp', label: 'Ramps' },
                  { id: 'lift', label: 'Lifts' },
                  { id: 'toilet', label: 'Toilets' },
                  { id: 'signage', label: 'Signage' },
                  { id: 'parking', label: 'Parking' },
                  { id: 'stairs', label: 'Stairs' },
                ].map(item => (
                  <button
                    key={item.id}
                    id={`filter-type-${item.id}`}
                    onClick={() => setSelectedCategoryFilter(item.id)}
                    className={`px-2.5 py-1.5 rounded-lg font-medium text-left transition-all cursor-pointer ${
                      selectedCategoryFilter === item.id
                        ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/60'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Live Sensor & Crowd Density Layer Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center">
                <Activity className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                <span>Live Sensor Layers</span>
              </h3>
              {currentTelemetrySource === 'yolo_video' ? (
                <span className="text-[10px] font-bold uppercase bg-cyan-950 text-cyan-300 border border-cyan-700/60 px-2 py-0.5 rounded-full flex items-center space-x-1 shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                  <span className="flex items-center space-x-1">
                    <Video className="w-2.5 h-2.5 mr-0.5" />
                    <span>LIVE / YOLO VIDEO</span>
                  </span>
                </span>
              ) : (
                <span className="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>MOCK LIVE SENSOR</span>
                </span>
              )}
            </div>

            {/* Crowd Density Toggle Box */}
            <div 
              id="sidebar-crowd-density-card"
              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                showCrowdDensity 
                  ? 'bg-slate-900 text-white border-slate-800 shadow-sm' 
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
              onClick={() => {
                const nextState = !showCrowdDensity;
                setShowCrowdDensity(nextState);
                if (!nextState) setSelectedCrowdZone(null);
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    showCrowdDensity ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-slate-200 text-slate-600'
                  }`}>
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold flex items-center space-x-1.5">
                      <span>Live Crowd Density</span>
                      {showCrowdDensity && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      )}
                    </div>
                    <p className={`text-[10px] ${showCrowdDensity ? 'text-slate-400' : 'text-slate-500'}`}>
                      {showCrowdDensity 
                        ? (currentTelemetrySource === 'yolo_video' 
                            ? `YOLO CCTV (${currentCameraId || 'CAM-01'} • ${currentTotalPeople ?? 7} ppl)` 
                            : 'Streaming Active (3.5s poll)')
                        : 'Click to overlay crowd heat zones'}
                    </p>
                  </div>
                </div>

                <div className={`w-9 h-5 rounded-full transition-colors relative p-0.5 ${
                  showCrowdDensity ? 'bg-emerald-500' : 'bg-slate-300'
                }`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform transform ${
                    showCrowdDensity ? 'translate-x-4' : 'translate-x-0'
                  }`} />
                </div>
              </div>

              {/* Dedicated Legend when ON */}
              {showCrowdDensity && (
                <div id="crowd-density-legend" className="mt-3 pt-3 border-t border-slate-800 space-y-2 text-[11px]">
                  <div className="flex items-center justify-between text-slate-400 font-semibold text-[10px] uppercase">
                    <span>Live Density Legend</span>
                    <span className="text-emerald-400 font-mono">{crowdZones.length} Zones</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 text-center">
                    <div className="flex flex-col items-center justify-center bg-emerald-950/70 border border-emerald-800/60 p-1.5 rounded-lg text-emerald-300">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 mb-0.5"></span>
                      <span className="font-bold text-[10px]">Low</span>
                    </div>
                    <div className="flex flex-col items-center justify-center bg-amber-950/70 border border-amber-800/60 p-1.5 rounded-lg text-amber-300">
                      <span className="w-2 h-2 rounded-full bg-amber-400 mb-0.5"></span>
                      <span className="font-bold text-[10px]">Moderate</span>
                    </div>
                    <div className="flex flex-col items-center justify-center bg-rose-950/70 border border-rose-800/60 p-1.5 rounded-lg text-rose-300">
                      <span className="w-2 h-2 rounded-full bg-rose-400 mb-0.5"></span>
                      <span className="font-bold text-[10px]">High</span>
                    </div>
                  </div>

                  {/* Real YOLO Video Camera Zone Breakdown Pill Box */}
                  {currentTelemetrySource === 'yolo_video' && currentCameraZones && (
                    <div className="bg-slate-950/90 border border-cyan-900/60 rounded-xl p-2.5 space-y-1.5 mt-2">
                      <div className="flex items-center justify-between text-[10px] text-cyan-400 font-bold uppercase">
                        <span className="flex items-center space-x-1">
                          <Camera className="w-3 h-3 mr-0.5" />
                          <span>{currentCameraId || 'CAM-01'} Vision Subzones</span>
                        </span>
                        <span className="text-white font-mono">{currentTotalPeople ?? 7} people</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-[10px]">
                        <div className="flex justify-between bg-slate-900 px-1.5 py-1 rounded text-slate-300">
                          <span>Foyer:</span>
                          <span className="font-bold text-white">{currentCameraZones.entrance_foyer ?? 0}</span>
                        </div>
                        <div className="flex justify-between bg-slate-900 px-1.5 py-1 rounded text-slate-300">
                          <span>Steps:</span>
                          <span className="font-bold text-white">{currentCameraZones.main_steps ?? 0}</span>
                        </div>
                        <div className="flex justify-between bg-slate-900 px-1.5 py-1 rounded text-slate-300">
                          <span>Ramp:</span>
                          <span className="font-bold text-emerald-400">{currentCameraZones.accessible_ramp ?? 0}</span>
                        </div>
                        <div className="flex justify-between bg-slate-900 px-1.5 py-1 rounded text-slate-300">
                          <span>Approach:</span>
                          <span className="font-bold text-white">{currentCameraZones.outside_approach ?? 0}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                    {currentTelemetrySource === 'yolo_video' ? (
                      <span className="flex items-center space-x-1 text-cyan-400 font-medium">
                        <Video className="w-3 h-3" />
                        <span>YOLO CCTV ({currentCameraId || 'CAM-01'})</span>
                      </span>
                    ) : (
                      <span className="flex items-center space-x-1 text-emerald-400 font-medium">
                        <Sparkles className="w-3 h-3" />
                        <span>MOCK LIVE SENSOR</span>
                      </span>
                    )}
                    <span className="text-slate-500 font-mono">
                      {lastTelemetryTimestamp ? `Polled ${lastTelemetryTimestamp}` : '1600×800 Grid'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Active Route info card if route calculated */}
          {activeRoute && (
            <div className="bg-gradient-to-br from-indigo-900 to-blue-900 text-white p-5 rounded-2xl shadow-md space-y-3">
              <div className="flex items-center justify-between">
                <span className="bg-indigo-700 text-indigo-100 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                  Active Accessible Route
                </span>
                <button
                  onClick={() => setShowRouteLayer(!showRouteLayer)}
                  className="text-xs text-indigo-200 hover:text-white underline"
                >
                  {showRouteLayer ? 'Hide Route' : 'Show Route'}
                </button>
              </div>
              <div>
                <p className="text-xs text-indigo-200">From: {activeRoute.fromNode.name}</p>
                <p className="text-xs font-semibold text-white">To: {activeRoute.toNode.name}</p>
              </div>
              <div className="flex items-center justify-between text-xs pt-2 border-t border-indigo-700/60">
                <span>Dist: {activeRoute.totalDistanceMeters}m</span>
                <span>Time: ~{activeRoute.estimatedMinutes} mins</span>
              </div>
              {onNavigateToRoute && (
                <button
                  id="btn-view-navigation-tab"
                  onClick={onNavigateToRoute}
                  className="w-full mt-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold text-xs py-2 rounded-lg transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                >
                  <span>View Step-by-Step Directions</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Interactive Canvas Viewport */}
        <div className="lg:col-span-3 bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden relative min-h-[520px] flex flex-col">
          {/* Viewport Top Toolbar */}
          <div className="bg-slate-800/90 backdrop-blur-xs px-4 py-3 border-b border-slate-700 flex flex-wrap items-center justify-between z-10 text-white gap-2">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-blue-400">Viewing:</span>
              <span className="text-xs font-semibold">{building.name} - {currentFloor.name}</span>
            </div>

            {/* Map Action Controls */}
            <div className="flex items-center space-x-2 flex-wrap">
              {/* 2D vs 3D View Mode Toggle */}
              <div className="flex items-center bg-slate-900/90 p-1 rounded-lg border border-slate-700 shadow-inner">
                <button
                  id="btn-view-mode-2d"
                  onClick={() => setViewMode('2d')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                    viewMode === '2d'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="2D Floor Plan View"
                >
                  <MapIcon className="w-3.5 h-3.5" />
                  <span>2D Plan</span>
                </button>
                <button
                  id="btn-view-mode-3d"
                  onClick={() => setViewMode('3d')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                    viewMode === '3d'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Interactive 3D Digital Twin (360°)"
                >
                  <Box className="w-3.5 h-3.5" />
                  <span>3D Twin (360°)</span>
                </button>
              </div>

              {/* Quick Toggle for Live Crowd Density */}
              <button
                id="btn-toggle-crowd-density"
                onClick={() => {
                  const nextState = !showCrowdDensity;
                  setShowCrowdDensity(nextState);
                  if (!nextState) setSelectedCrowdZone(null);
                }}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs border ${
                  showCrowdDensity 
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500 shadow-emerald-950/40' 
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-200 border-slate-600'
                }`}
                title="Toggle Live Crowd Density Layer"
              >
                <Users className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Live Crowd Density</span>
                <span className="sm:hidden">Crowd</span>
                {showCrowdDensity && (
                  <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse"></span>
                )}
              </button>

              {/* 2D Zoom Controls (shown only in 2D mode) */}
              {viewMode === '2d' && (
                <div className="flex items-center bg-slate-700 rounded-lg p-1 space-x-1 border border-slate-600">
                  <button
                    id="btn-zoom-out"
                    onClick={() => setZoomLevel(Math.max(0.8, zoomLevel - 0.2))}
                    className="p-1 text-slate-300 hover:text-white hover:bg-slate-600 rounded transition-colors cursor-pointer"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-mono px-1">{Math.round(zoomLevel * 100)}%</span>
                  <button
                    id="btn-zoom-in"
                    onClick={() => setZoomLevel(Math.min(2.0, zoomLevel + 0.2))}
                    className="p-1 text-slate-300 hover:text-white hover:bg-slate-600 rounded transition-colors cursor-pointer"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button
                    id="btn-zoom-reset"
                    onClick={() => setZoomLevel(1)}
                    className="p-1 text-slate-300 hover:text-white hover:bg-slate-600 rounded transition-colors cursor-pointer"
                    title="Reset Zoom"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              )}

              <button
                id="btn-pin-report"
                onClick={onOpenReportTab}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer shadow-sm"
              >
                <span>+ Report Barrier</span>
              </button>
            </div>
          </div>

          {/* Canvas Container: 3D Digital Twin vs 2D SVG Plan */}
          {viewMode === '3d' ? (
            <div className="flex-1 w-full h-full min-h-[500px]">
              <ThreeDDigitalTwin
                building={building}
                selectedFloorId={selectedFloorId}
                features={dynamicFeatures}
                rooms={rooms}
                activeRoute={activeRoute}
                crowdZones={crowdZones}
                showCrowdDensity={showCrowdDensity}
                onSelectFeature={(feat) => setSelectedFeature(feat)}
                onSelectFloor={(floorId) => setSelectedFloorId(floorId)}
                onSelectCrowdZone={(zone) => setSelectedCrowdZone(zone)}
              />
            </div>
          ) : (
            <div className="flex-1 relative overflow-auto p-4 flex items-center justify-center bg-slate-950">
              <div 
                style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center', transition: 'transform 0.2s ease-out' }}
                className="w-full max-w-[900px] aspect-[10/6] relative bg-slate-900 rounded-xl border border-slate-800 shadow-2xl p-2 select-none"
              >
                {isLoading ? (
                  <div className="text-white flex items-center justify-center h-full">Loading floor map...</div>
                ) : error ? (
                  <div className="text-rose-500 flex items-center justify-center h-full p-4 text-center">
                    {error}
                  </div>
                ) : currentFloorMap ? (
                  <svg
                    viewBox={`0 0 ${currentFloorMap.width} ${currentFloorMap.height}`}
                    className="w-full h-full cursor-crosshair"
                    onClick={handleFloorPlanClick}
                  >
                    {/* Reconstructed Floor Plan Layout */}
                    {rooms.map((room, index) => {
                      const x = Number.isFinite(room.x) ? room.x : 0;
                      const y = Number.isFinite(room.y) ? room.y : 0;
                      const width = Number.isFinite(room.width) ? room.width : 10;
                      const height = Number.isFinite(room.height) ? room.height : 10;

                      return (
                        <g
                          key={`room-${index}`}
                          className="cursor-pointer group"
                        >
                          <rect
                            x={x}
                            y={y}
                            width={width}
                            height={height}
                            fill={room.isAccessible ? "#334155" : "#1e293b"}
                            stroke="#475569"
                            strokeWidth="2"
                            className="transition-colors group-hover:fill-blue-800"
                          />
                          <text
                            x={x + width / 2}
                            y={y + height / 2}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize="14"
                            fill="#cbd5e1"
                            className="pointer-events-none select-none"
                          >
                            {room.name}
                          </text>
                        </g>
                      );
                    })}

                    {/* Live Crowd Density Overlay Layer (When Toggle is ON) */}
                    {showCrowdDensity && crowdZones.length > 0 && (
                      <g key="crowd-density-layer">
                        {crowdZones.map((zone) => {
                          const theme = getCrowdLevelTheme(zone.level);
                          const isSelected = selectedCrowdZone?.id === zone.id;

                          return (
                            <g
                              key={`cz-${zone.id}`}
                              id={`crowd-zone-${zone.id}`}
                              className="cursor-pointer group/zone"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCrowdZone(zone);
                              }}
                            >
                              {/* Main Zone Heat Area Rect */}
                              <rect
                                x={zone.x}
                                y={zone.y}
                                width={zone.width}
                                height={zone.height}
                                rx={10}
                                fill={theme.svgFill}
                                fillOpacity={isSelected ? 0.48 : theme.svgFillOpacity}
                                stroke={isSelected ? '#ffffff' : theme.svgStroke}
                                strokeWidth={isSelected ? 3 : theme.svgStrokeWidth}
                                strokeDasharray={zone.level === 'high' ? '6 3' : undefined}
                                className="transition-all duration-200 group-hover/zone:fill-opacity-50"
                              />

                              {/* Top Left Zone Name Pill */}
                              <g transform={`translate(${zone.x + 8}, ${zone.y + 8})`} className="pointer-events-none">
                                <rect
                                  x="0"
                                  y="0"
                                  width={Math.min(Math.max(zone.name.length * 6.5 + 24, 120), Math.max(zone.width - 16, 60))}
                                  height="20"
                                  rx="4"
                                  fill="#0f172a"
                                  fillOpacity="0.9"
                                  stroke={theme.svgStroke}
                                  strokeWidth="1"
                                />
                                <circle cx="9" cy="10" r="3.5" fill={theme.svgFill} />
                                {zone.level === 'high' && (
                                  <circle cx="9" cy="10" r="5.5" fill="none" stroke={theme.svgFill} strokeWidth="1" className="animate-ping" />
                                )}
                                <text
                                  x="18"
                                  y="14"
                                  fill="#f8fafc"
                                  fontSize="10"
                                  fontWeight="bold"
                                >
                                  {zone.name.length > 25 ? zone.name.slice(0, 23) + '...' : zone.name}
                                </text>
                              </g>

                              {/* Occupancy Indicator Badge in Zone */}
                              {zone.width > 120 && zone.height > 40 && (
                                <g transform={`translate(${zone.x + zone.width - 86}, ${zone.y + zone.height - 24})`} className="pointer-events-none">
                                  <rect
                                    x="0"
                                    y="0"
                                    width="78"
                                    height="18"
                                    rx="4"
                                    fill="#0f172a"
                                    fillOpacity="0.92"
                                    stroke={theme.svgStroke}
                                    strokeWidth="1"
                                  />
                                  <text
                                    x="39"
                                    y="12.5"
                                    fill="#f8fafc"
                                    fontSize="9.5"
                                    fontWeight="bold"
                                    textAnchor="middle"
                                  >
                                    {zone.peopleCount} ppl • {theme.shortLabel}
                                  </text>
                                </g>
                              )}
                            </g>
                          );
                        })}
                      </g>
                    )}

                    {/* Active Navigation Route Layer Overlay */}
                    {showRouteLayer && activeRoute && activeRoute.pathNodeIds.length > 1 && (
                      <g key="route-layer" className="animate-in fade-in duration-300">
                        <path
                          d="M 120 270 L 320 270 L 520 270 L 720 180"
                          fill="none"
                          stroke="#38bdf8"
                          strokeWidth="6"
                          strokeDasharray="8 8"
                          strokeLinecap="round"
                          className="animate-pulse"
                        />
                      </g>
                    )}

                    {/* Render Interactive Accessibility Markers */}
                    {filteredFeatures.map((feat) => {
                      const mx = feat.x;
                      const my = feat.y;
                      const style = getMarkerStyle(feat.status, feat.verificationStatus);

                      return (
                        <g
                          key={`feat-${feat.id}-${feat.floorId}`}
                          transform={`translate(${Number.isFinite(mx) ? mx : 0}, ${Number.isFinite(my) ? my : 0})`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFeature(feat);
                          }}
                          className="cursor-pointer group"
                        >
                          {feat.status === 'temporary' ? (
                            <>
                              <circle r="48" fill="#fef3c7" stroke="#f59e0b" strokeWidth="3" />
                              <path
                                d="M0 -25 L25 20 L-25 20 Z"
                                fill="#fef08a"
                                stroke="#b45309"
                                strokeWidth="2"
                                transform="translate(0, -5)"
                              />
                              <text
                                y="10"
                                fontSize="24"
                                textAnchor="middle"
                                fill="#78350f"
                                fontWeight="bold"
                                pointerEvents="none"
                              >
                                !
                              </text>
                              <text
                                y="70"
                                fontSize="14"
                                textAnchor="middle"
                                fill="#b45309"
                                fontWeight="bold"
                                pointerEvents="none"
                              >
                                Temporarily Unavailable
                              </text>
                            </>
                          ) : feat.status === 'unverified' ? (
                            <>
                              <circle
                                r="48"
                                className={`${style.bg} stroke-2 stroke-white shadow-lg transition-transform group-hover:scale-125`}
                              />
                              <text
                                y="12"
                                fontSize="36"
                                textAnchor="middle"
                                fill="#ffffff"
                                fontWeight="bold"
                                pointerEvents="none"
                              >
                                ?
                              </text>
                              <text
                                y="70"
                                fontSize="14"
                                textAnchor="middle"
                                fill="#b45309"
                                fontWeight="bold"
                                pointerEvents="none"
                              >
                                User Reported
                              </text>
                              <g className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                <rect x="-70" y="-45" width="140" height="26" rx="6" fill="#0f172a" stroke="#475569" strokeWidth="1" />
                                <text x="0" y="-28" fill="#f8fafc" fontSize="10" fontWeight="bold" textAnchor="middle">
                                  {feat.name}
                                </text>
                              </g>
                            </>
                          ) : (
                            <>
                              {feat.status === 'broken' && (
                                <circle key="pulse" r="66" fill="none" stroke="#ef4444" strokeWidth="2" className="animate-ping opacity-75" />
                              )}
                              <circle
                                r="48"
                                className={`${style.bg} stroke-2 stroke-white shadow-lg transition-transform group-hover:scale-125`}
                              />
                              <text
                                y="12"
                                fontSize="36"
                                textAnchor="middle"
                                fill="#ffffff"
                                fontWeight="bold"
                                pointerEvents="none"
                              >
                                {feat.type === 'ramp' ? '♿' : feat.type === 'lift' ? '🛗' : feat.type === 'toilet' ? '🚻' : feat.type === 'stairs' ? '🪜' : '📍'}
                              </text>
                              <g className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                <rect x="-70" y="-45" width="140" height="26" rx="6" fill="#0f172a" stroke="#475569" strokeWidth="1" />
                                <text x="0" y="-28" fill="#f8fafc" fontSize="10" fontWeight="bold" textAnchor="middle">
                                  {feat.name}
                                </text>
                              </g>
                            </>
                          )}
                        </g>
                      );
                    })}
                  </svg>
                ) : (
                  <div className="text-white flex items-center justify-center h-full">Floor map unavailable for this floor.</div>
                )}
              </div>
            </div>
          )}

          {/* Viewport Bottom Status Bar */}
          <div className="bg-slate-900 px-4 py-2 border-t border-slate-800 flex flex-wrap items-center justify-between text-xs text-slate-400">
            <div className="flex items-center space-x-3">
              <span>Showing <strong>{filteredFeatures.length}</strong> markers on {currentFloor.name}</span>
              {showCrowdDensity && (
                <>
                  <span>•</span>
                  <span className="text-emerald-400 font-medium flex items-center space-x-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Crowd Layer Active ({crowdZones.length} Zones)</span>
                  </span>
                </>
              )}
              <span>•</span>
              <span className="text-slate-500">Click anywhere on floorplan to pin issue</span>
            </div>
            <div className="text-blue-400 font-mono text-[11px]">
              Digital Twin Coordinate Graph: 1600 × 800
            </div>
          </div>
        </div>
      </div>

      {/* Feature Detail Drawer/Modal */}
      <FeatureDetailModal
        feature={selectedFeature}
        buildingName={building.name}
        floorName={
          (selectedFeature && building.floors?.find(f => String(f.floorId) === String(selectedFeature.floorId))?.name) ||
          currentFloor?.name
        }
        onClose={() => setSelectedFeature(null)}
        onReportIssue={(feat) => {
          if (onReportIssueAtLocation) {
            onReportIssueAtLocation(feat.buildingId, feat.floorId, feat.x, feat.y);
          }
        }}
      />

      {/* Centered Crowd Zone Details Modal Dialog */}
      <AnimatePresence>
        {showCrowdDensity && activeSelectedCrowdZone && (
          <div 
            id="crowd-zone-modal-backdrop"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm"
            onClick={() => setSelectedCrowdZone(null)}
          >
            <motion.div 
              id="crowd-zone-detail-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="crowd-zone-modal-title"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-slate-900/95 backdrop-blur-md text-white rounded-2xl border border-slate-700 shadow-2xl p-5"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border flex items-center space-x-1 ${
                      getCrowdLevelTheme(activeSelectedCrowdZone.level).badgeBg
                    }`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
                      <span>{getCrowdLevelTheme(activeSelectedCrowdZone.level).label}</span>
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                      Zone: {activeSelectedCrowdZone.id.replace('cz-', '').toUpperCase()}
                    </span>
                  </div>
                  <h4 id="crowd-zone-modal-title" className="font-bold text-base text-white mt-1.5 leading-snug">
                    {activeSelectedCrowdZone.name}
                  </h4>
                </div>
                <button
                  id="btn-close-crowd-popover"
                  onClick={() => setSelectedCrowdZone(null)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  title="Close Details"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Density and Headcount Stats Grid */}
              <div className="grid grid-cols-2 gap-3 my-3.5">
                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">Live Headcount</span>
                  <div className="flex items-baseline space-x-1 mt-0.5">
                    <span className="text-2xl font-extrabold text-white transition-all">{activeSelectedCrowdZone.peopleCount}</span>
                    <span className="text-xs text-slate-400 font-medium">people</span>
                  </div>
                </div>
                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">Live Density</span>
                  <div className="flex items-baseline space-x-1 mt-0.5">
                    <span className="text-2xl font-extrabold text-white transition-all">{activeSelectedCrowdZone.density}</span>
                    <span className="text-xs text-slate-400 font-medium">ppl/m²</span>
                  </div>
                </div>
              </div>

              {/* Description / Transit Guidance */}
              <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50 space-y-1 mb-3.5 text-xs">
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider flex items-center space-x-1">
                  <Info className="w-3.5 h-3.5" />
                  <span>Zone Transit Guidance</span>
                </span>
                <p className="text-slate-300 text-xs leading-relaxed">
                  {activeSelectedCrowdZone.description || 'Monitored digital twin concourse.'}
                </p>
              </div>

              {/* Real Camera Subzone breakdown if available (CAM-01) */}
              {activeSelectedCrowdZone.camera_zones && (
                <div className="bg-slate-950/90 p-3 rounded-xl border border-cyan-900/50 mb-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-[10px] font-bold text-cyan-300 uppercase tracking-wider">
                    <span className="flex items-center space-x-1">
                      <Camera className="w-3.5 h-3.5 mr-1" />
                      <span>Camera Sub-Zone Counts</span>
                    </span>
                    <span className="font-mono text-cyan-400">{currentCameraId || 'CAM-01'}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                    <div className="bg-slate-900/90 px-2.5 py-1.5 rounded border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-400">Entrance Foyer:</span>
                      <span className="font-bold text-white">{activeSelectedCrowdZone.camera_zones.entrance_foyer ?? 0}</span>
                    </div>
                    <div className="bg-slate-900/90 px-2.5 py-1.5 rounded border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-400">Main Steps:</span>
                      <span className="font-bold text-white">{activeSelectedCrowdZone.camera_zones.main_steps ?? 0}</span>
                    </div>
                    <div className="bg-slate-900/90 px-2.5 py-1.5 rounded border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-400">Accessible Ramp:</span>
                      <span className="font-bold text-emerald-400">{activeSelectedCrowdZone.camera_zones.accessible_ramp ?? 0}</span>
                    </div>
                    <div className="bg-slate-900/90 px-2.5 py-1.5 rounded border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-400">Outside Approach:</span>
                      <span className="font-bold text-white">{activeSelectedCrowdZone.camera_zones.outside_approach ?? 0}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Telemetry Source Notice & Status */}
              <div className="flex items-center justify-between text-[11px] pt-2.5 border-t border-slate-800 text-slate-400">
                {activeSelectedCrowdZone.source === 'yolo_video' || (activeSelectedCrowdZone.id === 'cz-e0-entrance' && currentTelemetrySource === 'yolo_video') ? (
                  <span className="flex items-center space-x-1.5 text-cyan-400 font-semibold text-[10px]">
                    <Video className="w-3.5 h-3.5" />
                    <span>LIVE / YOLO VIDEO ({currentCameraId || 'CAM-01'})</span>
                  </span>
                ) : (
                  <span className="flex items-center space-x-1.5 text-emerald-400 font-semibold text-[10px]">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>MOCK LIVE SENSOR</span>
                  </span>
                )}
                <span className="text-[10px] text-slate-500 font-mono">
                  {activeSelectedCrowdZone.lastUpdated || 'Live'}
                </span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
