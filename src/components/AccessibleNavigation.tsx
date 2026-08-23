import React, { useState, useEffect } from 'react';
import { Building, DisabilityProfile, RouteResult } from '../types';
import { 
  CAMPUS_LOCATIONS, 
  CampusLocationDef, 
  NavigationRouteResponse, 
  navigationApi, 
  BackendHealthStatus 
} from '../services/navigationApi';
import { 
  Navigation, 
  Compass, 
  Zap, 
  AlertTriangle, 
  ArrowRight, 
  CheckCircle2, 
  Volume2, 
  VolumeX, 
  RefreshCw, 
  Server, 
  MapPin, 
  Clock, 
  Footprints, 
  ShieldCheck,
  Radio
} from 'lucide-react';
import { LocationCascadeSelector } from './LocationCascadeSelector';
import { CAMPUS_NODES } from '../utils/campusGraph';

interface AccessibleNavigationProps {
  building?: Building;
  onRouteCalculated?: (route: RouteResult) => void;
  onViewOnDigitalTwin?: () => void;
}

export const AccessibleNavigation: React.FC<AccessibleNavigationProps> = ({
  building,
  onRouteCalculated,
  onViewOnDigitalTwin
}) => {
  const [startNodeId, setStartNodeId] = useState<string>('main_entrance');
  const [targetNodeId, setTargetNodeId] = useState<string>('library_entrance');
  const [profile, setProfile] = useState<'wheelchair' | 'blind' | 'standard'>('wheelchair');

  const [isCalculating, setIsCalculating] = useState(false);
  const [activeFastApiRoute, setActiveFastApiRoute] = useState<NavigationRouteResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [healthStatus, setHealthStatus] = useState<BackendHealthStatus | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  // Audio Speech state for voice navigation
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Check FastAPI backend health on mount
  const verifyBackendHealth = async () => {
    setIsCheckingHealth(true);
    try {
      const status = await navigationApi.checkHealth();
      setHealthStatus(status);
    } catch (err: any) {
      setHealthStatus({
        isOnline: false,
        url: 'http://localhost:8001',
        error: err?.message || 'Connection failed'
      });
    } finally {
      setIsCheckingHealth(false);
    }
  };

  useEffect(() => {
    verifyBackendHealth();
  }, []);

  const handleSpeakVoice = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleCalculateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsCalculating(true);

    if (isSpeaking && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }

    try {
      if (startNodeId === targetNodeId) {
        setErrorMessage('Starting location and destination cannot be the same point.');
        setIsCalculating(false);
        return;
      }

      const result = await navigationApi.findAccessibleRoute(startNodeId, targetNodeId, profile);

      if (result && (result.status === 'success' || (result.path_nodes && result.path_nodes.length > 0))) {
        setActiveFastApiRoute(result);
        setErrorMessage(null);

        // Map to RouteResult format for digital twin visualization bridge
        const startLoc = CAMPUS_LOCATIONS.find(l => l.id === result.start_location) || CAMPUS_LOCATIONS[0];
        const endLoc = CAMPUS_LOCATIONS.find(l => l.id === result.end_location) || CAMPUS_LOCATIONS[1];

        const mappedRouteResult: RouteResult = {
          fromNode: {
            id: startLoc.id,
            buildingId: 'bldg-iter-main',
            name: startLoc.name,
            floorId: 0,
            x: startLoc.coordinates.x,
            y: startLoc.coordinates.y,
            type: 'entrance',
            isAccessible: true
          },
          toNode: {
            id: endLoc.id,
            buildingId: 'bldg-iter-main',
            name: endLoc.name,
            floorId: 0,
            x: endLoc.coordinates.x,
            y: endLoc.coordinates.y,
            type: 'entrance',
            isAccessible: true
          },
          profile: profile as DisabilityProfile,
          totalDistanceMeters: result.total_distance_meters,
          estimatedMinutes: result.estimated_time_minutes,
          steps: result.step_by_step_directions.map((dir, idx) => ({
            stepNumber: idx + 1,
            instruction: dir,
            distanceMeters: Math.round(result.total_distance_meters / Math.max(1, result.step_by_step_directions.length)),
            nodeId: result.path_nodes[idx] || `step-${idx}`,
            floorId: 0,
            floorName: 'Ground Level'
          })),
          pathNodeIds: result.path_nodes,
          warnings: profile === 'wheelchair' ? [] : ['Check live weather conditions along outdoor campus walkways'],
          accessibleFeaturesUsed: startLoc.features.concat(endLoc.features).slice(0, 3)
        };

        if (onRouteCalculated) {
          onRouteCalculated(mappedRouteResult);
        }
      } else {
        setErrorMessage(result.error || 'No accessible route found matching your specific mobility constraints.');
      }
    } catch (err: any) {
      console.error('FastAPI Navigation Calculation Error:', err);
      setErrorMessage(
        err.message || 
        'Unable to connect to the FastAPI Navigation Backend at http://localhost:8000. Ensure the Python backend service is running.'
      );
    } finally {
      setIsCalculating(false);
    }
  };

  const getLocationLabel = (id: string): string => {
    if (CAMPUS_NODES[id]) {
      return CAMPUS_NODES[id].label;
    }
    const loc = CAMPUS_LOCATIONS.find(l => l.id === id);
    return loc ? loc.name : id.replace(/_/g, ' ').toUpperCase();
  };

  const startLocationObj = CAMPUS_LOCATIONS.find(l => l.id === startNodeId);
  const targetLocationObj = CAMPUS_LOCATIONS.find(l => l.id === targetNodeId);

  return (
    <div id="section-accessible-navigation" className="space-y-8">
      {/* Header with Live FastAPI Backend Status Indicator */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">
            <Navigation className="w-4 h-4" />
            <span>FastAPI & NetworkX Graph Navigation Engine</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Campus Barrier-Free Accessible Routing</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time Dijkstra & A* path computation with wheelchair ramp prioritization and tactile paving wayfinding.
          </p>
        </div>

        {/* Backend Connectivity Status Pill */}
        <div className="flex items-center space-x-2 shrink-0">
          <div className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl border text-xs font-bold ${
            healthStatus?.isOnline
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-amber-50 text-amber-900 border-amber-300'
          }`}>
            <span className={`w-2.5 h-2.5 rounded-full ${healthStatus?.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span>
              {healthStatus?.isOnline
                ? `Navigation Backend Connected (${healthStatus.latencyMs ?? 15}ms)`
                : 'Navigation Backend Offline (Port 8001)'}
            </span>
          </div>

          <button
            id="btn-refresh-backend-health"
            onClick={verifyBackendHealth}
            disabled={isCheckingHealth}
            title="Refresh backend connection status"
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isCheckingHealth ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Offline Notice Guidance (If backend not yet started) */}
      {healthStatus && !healthStatus.isOnline && (
        <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-amber-400 text-xs font-bold">
              <Server className="w-4 h-4" />
              <span>FastAPI Navigation Service Setup</span>
            </div>
            <p className="text-xs text-slate-300">
              To connect the live Python routing service, launch the backend in a separate terminal:
            </p>
            <code className="inline-block bg-slate-800 text-emerald-400 font-mono text-[11px] px-2.5 py-1 rounded border border-slate-700 mt-1">
              cd navigation-backend && python main.py
            </code>
          </div>
          <button
            id="btn-retry-backend-connection"
            onClick={verifyBackendHealth}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-xs shrink-0 cursor-pointer"
          >
            Check Connection
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Navigation Input Form */}
        <form onSubmit={handleCalculateRoute} className="lg:col-span-5 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6">
          <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <Compass className="w-5 h-5 text-blue-600" />
            <span>Route Parameters</span>
          </h3>

          {/* 3-Tier Cascading Start Location (Building -> Floor -> Room) */}
          <LocationCascadeSelector
            id="start-location-cascade"
            label="Starting Location"
            selectedNodeId={startNodeId}
            onSelectNode={(id) => {
              setStartNodeId(id);
              setErrorMessage(null);
            }}
          />

          {/* 3-Tier Cascading Destination Location (Building -> Floor -> Room) */}
          <LocationCascadeSelector
            id="target-location-cascade"
            label="Destination Location"
            selectedNodeId={targetNodeId}
            onSelectNode={(id) => {
              setTargetNodeId(id);
              setErrorMessage(null);
            }}
          />

          {/* Disability Profile Radio Buttons matching FastAPI choices */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Accessibility Profile *
            </label>

            <div className="space-y-2">
              {[
                { 
                  id: 'wheelchair', 
                  label: '👩‍🦽 Wheelchair Accessible', 
                  desc: 'Enforces ramp-only transitions, avoids all stairs, requires wide corridors' 
                },
                { 
                  id: 'blind', 
                  label: '👨‍🦯 Visually Impaired (Blind)', 
                  desc: 'Prioritizes tactile ground paths, audio guidance, and step-free hazards' 
                },
                { 
                  id: 'standard', 
                  label: '🚶 Standard Mobility', 
                  desc: 'Calculates shortest campus walking paths and standard corridors' 
                },
              ].map(item => (
                <label
                  key={item.id}
                  htmlFor={`profile-radio-${item.id}`}
                  className={`flex items-start p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    profile === item.id
                      ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    id={`profile-radio-${item.id}`}
                    type="radio"
                    name="disability-profile"
                    value={item.id}
                    checked={profile === item.id}
                    onChange={() => setProfile(item.id as 'wheelchair' | 'blind' | 'standard')}
                    className="mt-1 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="ml-3 space-y-0.5">
                    <span className="text-xs font-bold text-slate-900 block">{item.label}</span>
                    <span className="text-[11px] text-slate-500 block">{item.desc}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <button
            id="btn-find-accessible-route"
            type="submit"
            disabled={isCalculating}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-3.5 rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <Zap className="w-4 h-4 fill-white" />
            <span>{isCalculating ? 'Calculating Optimal Route via FastAPI...' : 'Find Accessible Route'}</span>
          </button>
        </form>

        {/* Calculated Route Details & Turn-by-Turn Steps */}
        <div className="lg:col-span-7 space-y-6">
          {errorMessage && (
            <div className="bg-amber-50 border border-amber-300 p-5 rounded-2xl text-amber-900 text-xs font-medium space-y-1">
              <div className="flex items-center space-x-2 font-bold text-amber-700">
                <AlertTriangle className="w-4 h-4" />
                <span>Accessibility Constraint</span>
              </div>
              <p>{errorMessage}</p>
              <p className="mt-2 text-[11px] text-amber-800">
                Note: This destination may not have step-free access for your selected accessibility profile. Please try choosing a different entrance or profile.
              </p>
            </div>
          )}

          {activeFastApiRoute ? (
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6">
              {/* Summary Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center space-x-1">
                      <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                      <span>{activeFastApiRoute.profile_used.toUpperCase()} ROUTE VERIFIED</span>
                    </span>
                    <span className="text-xs font-mono text-slate-400">FastAPI /api/navigate</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mt-2">
                    {getLocationLabel(activeFastApiRoute.start_location)} → {getLocationLabel(activeFastApiRoute.end_location)}
                  </h3>
                </div>

                {onViewOnDigitalTwin && (
                  <button
                    id="btn-view-route-on-map"
                    onClick={onViewOnDigitalTwin}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center space-x-2 cursor-pointer shrink-0"
                  >
                    <span>View on Digital Twin Map</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div className="flex items-center space-x-1.5 text-xs text-slate-500 font-medium">
                    <Footprints className="w-4 h-4 text-emerald-600" />
                    <span>Total Distance</span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 mt-1">
                    {activeFastApiRoute.total_distance_meters}m
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div className="flex items-center space-x-1.5 text-xs text-slate-500 font-medium">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <span>Estimated Time</span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 mt-1">
                    ~{activeFastApiRoute.estimated_time_minutes} min{activeFastApiRoute.estimated_time_minutes > 1 ? 's' : ''}
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 col-span-2 sm:col-span-1">
                  <div className="flex items-center space-x-1.5 text-xs text-slate-500 font-medium">
                    <Radio className="w-4 h-4 text-purple-600" />
                    <span>Path Waypoints</span>
                  </div>
                  <div className="text-2xl font-black text-purple-700 mt-1">
                    {activeFastApiRoute.path_nodes.length} Nodes
                  </div>
                </div>
              </div>

              {/* Turn-by-Turn Voice Navigation Section */}
              {(() => {
                let voiceText = activeFastApiRoute.voice_guidance || activeFastApiRoute.voice_navigation;
                if (!voiceText) {
                  const startClean = getLocationLabel(activeFastApiRoute.start_location).replace(/\(.*?\)/g, '').replace(/Block\s+[A-Z]\s*[-]\s*/gi, '').trim();
                  const endClean = getLocationLabel(activeFastApiRoute.end_location).replace(/\(.*?\)/g, '').replace(/Block\s+[A-Z]\s*[-]\s*/gi, '').trim();
                  voiceText = `Navigating from ${startClean} to ${endClean}.`;
                }

                return (
                  <div className="bg-purple-50 border border-purple-200 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2 text-xs font-bold text-purple-900">
                        <Volume2 className="w-4 h-4 text-purple-700" />
                        <span>Minimal Audio Voice Wayfinding (Human Guidance)</span>
                      </div>
                      <p className="text-xs text-purple-950 font-medium italic leading-relaxed">
                        &quot;{voiceText}&quot;
                      </p>
                    </div>

                    <button
                      id="btn-speak-voice-navigation"
                      type="button"
                      onClick={() => handleSpeakVoice(voiceText!)}
                      className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-2 cursor-pointer transition-all shrink-0 ${
                        isSpeaking
                          ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-md'
                          : 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm'
                      }`}
                    >
                      {isSpeaking ? (
                        <>
                          <VolumeX className="w-4 h-4" />
                          <span>Stop Voice</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-4 h-4" />
                          <span>Listen Voice 🔊</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })()}

              {/* Route Node Sequence Badge Strip */}
              <div className="space-y-2 pt-1">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Campus Path Sequence</h4>
                <div className="flex flex-wrap items-center gap-2">
                  {activeFastApiRoute.path_nodes.map((nodeId, idx) => (
                    <React.Fragment key={idx}>
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                        idx === 0 
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300' 
                          : idx === activeFastApiRoute.path_nodes.length - 1
                          ? 'bg-blue-100 text-blue-900 border-blue-300'
                          : 'bg-slate-100 text-slate-800 border-slate-200'
                      }`}>
                        {getLocationLabel(nodeId)}
                      </span>
                      {idx < activeFastApiRoute.path_nodes.length - 1 && (
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>


              {/* Turn-by-turn Step-by-Step Instructions Breakdown */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Step-by-Step Turn Directions ({activeFastApiRoute.step_by_step_directions.length})
                </h4>
                <div className="space-y-3 relative before:absolute before:top-3 before:bottom-3 before:left-4 before:w-0.5 before:bg-slate-200">
                  {(activeFastApiRoute.steps || activeFastApiRoute.step_by_step_directions.map((inst, i) => ({
                    stepNumber: i + 1,
                    instruction: inst,
                    featureTypeUsed: inst.toLowerCase().includes('elevator') ? 'elevator' : inst.toLowerCase().includes('bridge') ? 'bridge' : inst.toLowerCase().includes('ramp') ? 'ramp' : 'corridor',
                    floorName: 'Waypoint'
                  }))).map((step: any, idx: number) => {
                    const feat = step.featureTypeUsed || 'corridor';
                    const icon = feat === 'elevator' ? '🛗' : feat === 'bridge' ? '🌉' : feat === 'stairs' ? '🪜' : feat === 'ramp' ? '♿' : '🚶';
                    const isElevatorOrBridge = feat === 'elevator' || feat === 'bridge';

                    return (
                      <div key={idx} className="relative pl-9 flex items-start space-x-3 text-xs">
                        <div className={`absolute left-1.5 top-0.5 w-6 h-6 rounded-full font-bold flex items-center justify-center text-[11px] shadow-sm ${
                          isElevatorOrBridge ? 'bg-purple-600 text-white ring-2 ring-purple-300' : 'bg-blue-600 text-white'
                        }`}>
                          {idx + 1}
                        </div>

                        <div className={`p-3.5 rounded-xl border flex-1 space-y-1 ${
                          isElevatorOrBridge ? 'bg-purple-50/70 border-purple-200' : 'bg-slate-50 border-slate-200'
                        }`}>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 leading-relaxed flex items-center space-x-1.5">
                              <span>{icon}</span>
                              <span>{step.instruction}</span>
                            </span>
                            {step.floorName && step.floorName !== 'Waypoint' && (
                              <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded shrink-0">
                                {step.floorName}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            Waypoint {idx + 1} of {activeFastApiRoute.step_by_step_directions.length}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center space-y-3 text-slate-400">
              <Compass className="w-12 h-12 mx-auto text-slate-300" />
              <h4 className="text-base font-bold text-slate-700">No Active Route Calculated Yet</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Select your starting campus location, destination, and accessibility profile, then click &quot;Find Accessible Route&quot;.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
