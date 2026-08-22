import React, { useState, useEffect } from 'react';
import { Building, AccessibilityFeature, RouteResult, FloorMap, BuildingRoom } from '../types';
import { FeatureDetailModal } from './FeatureDetailModal';
import { api } from '../services/api';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Filter, 
  Layers, 
  HelpCircle, 
  ArrowRight
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
  const [currentFloorMap, setCurrentFloorMap] = useState<FloorMap | null>(null);
  const [dynamicFeatures, setDynamicFeatures] = useState<AccessibilityFeature[]>([]);
  const [rooms, setRooms] = useState<BuildingRoom[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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

      // If floors not yet populated, keep loading
      if (!building.floors || building.floors.length === 0) {
        setIsLoading(true);
        return;
      }
      
      console.log("[MAP STATE] selectedBuildingId:", building.id);
      
      // If building changed, make sure we have a valid floor selected
      const currentFloorId = selectedFloorId;
      const floorExists = building.floors.some(f => f.floorId === currentFloorId);
      const floorToLoad = floorExists ? currentFloorId : (building.floors[0]?.floorId);

      if (floorToLoad === undefined) {
        setIsLoading(false);
        setError("No floor data available for this building.");
        return;
      }

      // Update state if floor changed
      if (!floorExists) {
        console.log("[FLOOR STATE] Auto-selecting floor:", floorToLoad);
        setSelectedFloorId(floorToLoad);
        return; // The next effect run will handle the fetch with the correct floor
      }

      console.log("[FLOOR FETCH] buildingId:", building.id, "floorId:", floorToLoad);
      setIsLoading(true);
      setError(null);
      setCurrentFloorMap(null);
      setRooms([]);
      setDynamicFeatures([]);
      
      try {
        // Fetch floor map
        const floorMap = await api.getFloorMap(building.id, String(floorToLoad));
        
        // Fetch rooms
        console.log("[ROOM FETCH] buildingId:", building.id, "floorId:", floorToLoad);
        const floorRooms = await api.getRoomsForFloor(String(floorToLoad), building.id);
        
        // Fetch accessibility features
        const floorFeatures = await api.getAccessibilityFeatures(building.id, String(floorToLoad));
        
        if (isMounted) {
          console.log("[FLOOR RESULT] buildingId:", building.id, "floors fetched successfully");
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
    if (verification === 'unverified') {
      return {
        bg: 'bg-amber-500',
        border: 'border-amber-200',
        ring: 'ring-amber-400/30',
        icon: '🟡',
        label: 'Reported / Unverified'
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
    if (status === 'broken') {
      return {
        bg: 'bg-rose-600',
        border: 'border-rose-200',
        ring: 'ring-rose-500/40',
        icon: '🔴',
        label: 'Barrier / Not Accessible'
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
              onClick={() => setSelectedFloorId(floor.floorId)}
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
        <div className="lg:col-span-3 bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden relative min-h-[500px] flex flex-col">
          {/* Viewport Top Toolbar */}
          <div className="bg-slate-800/90 backdrop-blur-xs px-4 py-3 border-b border-slate-700 flex items-center justify-between z-10 text-white">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-blue-400">Viewing:</span>
              <span className="text-xs font-semibold">{building.name} - {currentFloor.name}</span>
            </div>

            {/* Map Action Controls */}
            <div className="flex items-center space-x-2">
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

              <button
                id="btn-pin-report"
                onClick={onOpenReportTab}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer shadow-sm"
              >
                <span>+ Report Barrier</span>
              </button>
            </div>
          </div>

          {/* SVG Digital Twin Architectural Floorplan Container */}
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
                    // Diagnostic and validation
                    const x = Number.isFinite(room.x) ? room.x : 0;
                    const y = Number.isFinite(room.y) ? room.y : 0;
                    const width = Number.isFinite(room.width) ? room.width : 10;
                    const height = Number.isFinite(room.height) ? room.height : 10;

                    console.log("MAP TRANSFORM DEBUG (Room)", {
                      name: room.name,
                      x,
                      y,
                      width,
                      height
                    });
                    return (
                      <g
                        key={`room-${index}`}
                        className="cursor-pointer group"
                        onClick={() => console.log('Room clicked:', room.name)}
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

                  {/* Active Navigation Route Layer Overlay */}
                  {showRouteLayer && activeRoute && activeRoute.pathNodeIds.length > 1 && (
                    <g key="route-layer" className="animate-in fade-in duration-300">
                      {/* Draw route lines connecting floor nodes */}
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
                    // Fallback to 1600x800 if map dimensions are missing, to avoid NaN
                    const mapWidth = (currentFloorMap && Number.isFinite(currentFloorMap.width) && currentFloorMap.width > 0) ? currentFloorMap.width : 1600;
                    const mapHeight = (currentFloorMap && Number.isFinite(currentFloorMap.height) && currentFloorMap.height > 0) ? currentFloorMap.height : 800;
                    
                    const mx = feat.x;
                    const my = feat.y;
                    
                    console.log("MAP TRANSFORM DEBUG (Marker)", {
                      featId: feat.id,
                      x: feat.x,
                      y: feat.y,
                      mx,
                      my
                    });

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
                            {/* Temporary marker */}
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
                        ) : (
                          <>
                            {/* Pulse Ring for Barriers */}
                            {feat.status === 'broken' && (
                              <circle key="pulse" r="66" fill="none" stroke="#ef4444" strokeWidth="2" className="animate-ping opacity-75" />
                            )}

                            {/* Marker Outer Circle */}
                            <circle
                              r="48"
                              className={`${style.bg} stroke-2 stroke-white shadow-lg transition-transform group-hover:scale-125`}
                            />

                            {/* Icon inside marker */}
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

                            {/* Tooltip on hover */}
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

          {/* Viewport Bottom Status Bar */}
          <div className="bg-slate-900 px-4 py-2 border-t border-slate-800 flex flex-wrap items-center justify-between text-xs text-slate-400">
            <div className="flex items-center space-x-3">
              <span>Showing <strong>{filteredFeatures.length}</strong> markers on {currentFloor.name}</span>
              <span>•</span>
              <span className="text-slate-500">Click anywhere on floorplan to pin issue</span>
            </div>
            <div className="text-blue-400 font-mono text-[11px]">
              Digital Twin Coordinate Graph: Active
            </div>
          </div>
        </div>
      </div>

      {/* Feature Detail Drawer/Modal */}
      <FeatureDetailModal
        feature={selectedFeature}
        onClose={() => setSelectedFeature(null)}
        onReportIssue={(feat) => {
          if (onReportIssueAtLocation) {
            onReportIssueAtLocation(feat.buildingId, feat.floorId, feat.x, feat.y);
          }
        }}
      />
    </div>
  );
};
