import React, { useState, useEffect } from 'react';
import { Building, BuildingFloor, BuildingRoom, AccessibilityReport, FeatureType, FeatureStatus } from '../types';
import { api } from '../services/api';
import { FloorMap } from './FloorMap';
import { 
  AlertTriangle, 
  Upload, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  MapPin, 
  FileText, 
  Camera, 
  Filter,
  Layers,
  Sparkles,
  Info,
  XCircle,
  LayoutGrid,
  List
} from 'lucide-react';

interface ReportIssueProps {
  buildings: Building[];
  selectedBuilding: Building | null;
  reports: AccessibilityReport[];
  onReportSubmitted: (newReport: AccessibilityReport) => void;
  prefilledLocation?: { buildingId: string; floorId: number; x: number; y: number } | null;
}

export const ReportIssue: React.FC<ReportIssueProps> = ({
  buildings,
  selectedBuilding,
  reports,
  onReportSubmitted,
  prefilledLocation
}) => {
  const [buildingId, setBuildingId] = useState(prefilledLocation?.buildingId || selectedBuilding?.id || '');

  useEffect(() => {
    if (selectedBuilding && selectedBuilding.id !== buildingId) {
      handleBuildingChange(selectedBuilding.id);
    }
  }, [selectedBuilding]);

  const selectedBuildingData = buildings.find(b => b.id === buildingId) || (selectedBuilding?.id === buildingId ? selectedBuilding : null) || buildings[0];

  const [buildingFloors, setBuildingFloors] = useState<BuildingFloor[]>(() => {
    return selectedBuildingData?.floors || [];
  });

  const availableFloors = buildingFloors.length > 0 ? buildingFloors : (selectedBuildingData?.floors || []);

  const [floorId, setFloorId] = useState<string | number>(() => {
    if (prefilledLocation?.floorId !== undefined) return prefilledLocation.floorId;
    return availableFloors[0]?.floorId ?? '';
  });

  // Keep floors synchronized with selected building
  useEffect(() => {
    let isMounted = true;
    async function syncFloors() {
      if (!buildingId) return;

      const bldg = buildings.find(b => b.id === buildingId) || (selectedBuilding?.id === buildingId ? selectedBuilding : null);
      if (bldg?.floors && bldg.floors.length > 0) {
        if (isMounted) {
          setBuildingFloors(bldg.floors);
          setFloorId(prev => {
            const exists = bldg.floors.some(f => String(f.floorId) === String(prev));
            return exists ? prev : bldg.floors[0].floorId;
          });
        }
      } else {
        try {
          const fList = await api.getFloorsForBuilding(buildingId);
          if (isMounted) {
            setBuildingFloors(fList);
            if (fList.length > 0) {
              setFloorId(prev => {
                const exists = fList.some(f => String(f.floorId) === String(prev));
                return exists ? prev : fList[0].floorId;
              });
            } else {
              setFloorId('');
            }
          }
        } catch (e) {
          console.error('Error fetching floors for building:', buildingId, e);
        }
      }
    }
    syncFloors();
    return () => { isMounted = false; };
  }, [buildingId, buildings, selectedBuilding]);

  const selectedFloorData = availableFloors.find(f => String(f.floorId) === String(floorId)) || availableFloors[0];

  // Helper to find inside room or nearest mapped room
  const findRoomOrNearest = (x: number, y: number, roomsList?: BuildingRoom[]): BuildingRoom | null => {
    if (!roomsList || roomsList.length === 0) return null;
    const inside = roomsList.find(
      r => x >= r.x && x <= (r.x + r.width) && y >= r.y && y <= (r.y + r.height)
    );
    if (inside) return inside;

    let nearest: BuildingRoom | null = null;
    let minDistance = Infinity;
    for (const r of roomsList) {
      const rx = Number.isFinite(r.x) ? r.x : 0;
      const ry = Number.isFinite(r.y) ? r.y : 0;
      const rw = Number.isFinite(r.width) ? r.width : 100;
      const rh = Number.isFinite(r.height) ? r.height : 60;
      const closestX = Math.max(rx, Math.min(x, rx + rw));
      const closestY = Math.max(ry, Math.min(y, ry + rh));
      const dist = Math.hypot(x - closestX, y - closestY);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = r;
      }
    }
    return nearest;
  };

  // Try to find initial room if prefilledLocation exists
  const initialRoom = prefilledLocation && selectedFloorData
    ? findRoomOrNearest(prefilledLocation.x, prefilledLocation.y, selectedFloorData.rooms)
    : null;

  const [selectedRoom, setSelectedRoom] = useState<BuildingRoom | null>(initialRoom);
  const [featureName, setFeatureName] = useState(initialRoom?.name || '');
  const [featureType, setFeatureType] = useState<string>('');
  const [availableFeatureOptions, setAvailableFeatureOptions] = useState<{ label: string; value: string }[]>([]);
  const [status, setStatus] = useState<FeatureStatus>('broken');
  const [description, setDescription] = useState('');
  const [reporterName, setReporterName] = useState('');

  // Pin location is null by default unless prefilledLocation is provided
  const [pinLocation, setPinLocation] = useState<{ x: number; y: number } | null>(
    prefilledLocation ? { x: prefilledLocation.x, y: prefilledLocation.y } : null
  );

  const [locationError, setLocationError] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccessInfo, setSubmitSuccessInfo] = useState<AccessibilityReport | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // 1. Building Change Handler -> Resets floor, clears room, location name, and pin
  const handleBuildingChange = async (newBuildingId: string) => {
    setBuildingId(newBuildingId);
    setPinLocation(null);
    setSelectedRoom(null);
    setFeatureName('');
    setLocationError(null);

    const newBldg = buildings.find(b => b.id === newBuildingId) || (selectedBuilding?.id === newBuildingId ? selectedBuilding : null);
    if (newBldg?.floors && newBldg.floors.length > 0) {
      setBuildingFloors(newBldg.floors);
      setFloorId(newBldg.floors[0].floorId);
    } else {
      try {
        const newFloors = await api.getFloorsForBuilding(newBuildingId);
        setBuildingFloors(newFloors);
        if (newFloors.length > 0) {
          setFloorId(newFloors[0].floorId);
        } else {
          setFloorId('');
        }
      } catch (err) {
        console.error('Failed to load floors for building', newBuildingId, err);
      }
    }
  };

  // 2. Floor Change Handler -> Clears room, location name, and pin
  const handleFloorChange = (newFloorId: string | number) => {
    setFloorId(newFloorId);
    setPinLocation(null);
    setSelectedRoom(null);
    setFeatureName('');
    setLocationError(null);
  };

  // 3. Location & Room Select Handler
  const handleSelectLocation = (loc: { x: number; y: number }, room: BuildingRoom | null) => {
    const resolvedRoom = room || findRoomOrNearest(loc.x, loc.y, selectedFloorData?.rooms);

    setPinLocation(loc);
    setLocationError(null);

    if (resolvedRoom) {
      setSelectedRoom(resolvedRoom);
      setFeatureName(resolvedRoom.name);
    } else {
      setSelectedRoom(null);
      setFeatureName(`Location (${loc.x}, ${loc.y})`);
    }
  };

  // Sync available features when building/floor changes
  useEffect(() => {
    if (!buildingId || floorId === '') {
      setAvailableFeatureOptions([]);
      return;
    }

    api.getAvailableFeatureColumns(String(floorId)).then((features) => {
      const options = features.map(colName => ({ label: colName, value: colName }));
      setAvailableFeatureOptions(options);
    });
  }, [buildingId, floorId]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // 4. Submit Handler with strict validation
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!pinLocation) {
      setLocationError('Please select a location on the floor map.');
      return;
    }

    if (!featureType) {
      setLocationError('Please select a feature type.');
      return;
    }

    if (!description.trim()) return;

    const resolvedRoom = selectedRoom || findRoomOrNearest(pinLocation.x, pinLocation.y, selectedFloorData?.rooms);
    const finalFeatureName = featureName || resolvedRoom?.name || 'Reported Location';
    const finalFeatureId = resolvedRoom?.id || `loc-${pinLocation.x}-${pinLocation.y}`;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const newReport = await api.submitReport({
        buildingId,
        buildingName: selectedBuildingData?.name || 'Unknown Building',
        featureName: finalFeatureName,
        featureId: finalFeatureId,
        featureType: featureType as FeatureType,
        status,
        description: description.trim(),
        floorId: String(floorId),
        floorName: selectedFloorData?.name || `Floor ${floorId}`,
        location: pinLocation,
        photoUrl: photoPreview || undefined,
        reporterName: reporterName.trim() || 'Anonymous Campus Reporter'
      });

      setIsSubmitting(false);
      setSubmitSuccessInfo(newReport);
      setSubmitError(null);
      onReportSubmitted(newReport);

      // Completely reset form fields and selection after successful submission
      setSelectedRoom(null);
      setFeatureName('');
      setFeatureType('');
      setStatus('broken');
      setDescription('');
      setReporterName('');
      setPhotoPreview(null);
      setPinLocation(null);
      setLocationError(null);
    } catch (error: any) {
      console.error('Error submitting accessibility report:', error);
      setIsSubmitting(false);
      setSubmitError(error?.message || 'Failed to submit report to Supabase. Please ensure the database schema is applied and try again.');
    }
  };

  const filteredHistory = reports.filter(r => {
    const isResolved = r.status === 'resolved' || r.resolutionStatus === 'resolved';
    const isRejected = (r.status === 'rejected' || r.verificationStatus === 'rejected') && !isResolved;
    const isVerified = (r.verificationStatus === 'admin_verified' || r.verificationStatus === 'verified' || r.status === 'verified') && !isResolved && !isRejected;
    const isPending = !isVerified && !isResolved && !isRejected;

    if (historyFilter === 'all') return true;
    if (historyFilter === 'pending') return isPending;
    if (historyFilter === 'verified') return isVerified;
    if (historyFilter === 'resolved') return isResolved;
    if (historyFilter === 'rejected') return isRejected;
    return true;
  });

  const isSuccessReportVerified = submitSuccessInfo && (
    submitSuccessInfo.verificationStatus === 'admin_verified' || 
    submitSuccessInfo.verificationStatus === 'verified' || 
    submitSuccessInfo.status === 'verified'
  );
  const isSuccessReportMerged = submitSuccessInfo && (submitSuccessInfo.confirmationsCount || 1) > 1;

  return (
    <div id="section-report-issue" className="space-y-10">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-bold text-rose-600 uppercase tracking-wider mb-1">
            <AlertTriangle className="w-4 h-4" />
            <span>Crowdsourced Accessibility Reporting</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Report an Accessibility Issue or Barrier</h2>
          <p className="text-xs text-slate-500 mt-0.5">Help keep campus digital twins accurate. Select building, floor level, and pin precise map location.</p>
        </div>
      </div>

      {/* Submission Error Banner */}
      {submitError && (
        <div className="bg-rose-50 border border-rose-300 p-5 rounded-2xl flex items-start space-x-3 text-rose-900 animate-in fade-in duration-300">
          <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-base font-bold">Failed to save report to Supabase</h4>
            <p className="text-xs text-rose-700">{submitError}</p>
            <button
              onClick={() => setSubmitError(null)}
              className="text-xs font-bold text-rose-800 underline mt-1 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Submission Success Banner */}
      {submitSuccessInfo && (
        <div className="bg-emerald-50 border border-emerald-300 p-5 rounded-2xl flex items-start space-x-3 text-emerald-900 animate-in fade-in duration-300">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-base font-bold">
              {isSuccessReportVerified
                ? 'Report merged with Active Verified issue (Confidence: 100% HIGH)'
                : isSuccessReportMerged
                ? `Report merged with Active issue (Confidence increased to ${submitSuccessInfo.confidenceScore}% ${submitSuccessInfo.confidenceLevel})`
                : 'Report submitted successfully. Status: Pending Verification (Confidence: 40% LOW).'}
            </h4>
            <p className="text-xs text-emerald-700">
              {isSuccessReportVerified
                ? `Your submission has been recorded for ${submitSuccessInfo.buildingName || selectedBuildingData?.name || 'Unknown Building'} (${submitSuccessInfo.floorName || selectedFloorData?.name} - ${submitSuccessInfo.featureName}). 100% confidence level is preserved and queued for resolution.`
                : isSuccessReportMerged
                ? `Your submission confirms an active issue with ${submitSuccessInfo.confirmationsCount} community reports recorded for ${submitSuccessInfo.buildingName || selectedBuildingData?.name || 'Unknown Building'} (${submitSuccessInfo.floorName || selectedFloorData?.name}).`
                : `Your submission has been logged for ${submitSuccessInfo.buildingName || selectedBuildingData?.name || 'Unknown Building'} (${submitSuccessInfo.floorName || selectedFloorData?.name}). Campus auditors will verify this report.`}
            </p>
            <button
              onClick={() => {
                setSubmitSuccessInfo(null);
                setSelectedRoom(null);
                setFeatureName('');
                setFeatureType('ramp');
                setStatus('broken');
                setDescription('');
                setReporterName('');
                setPhotoPreview(null);
                setPinLocation(null);
                setLocationError(null);
              }}
              className="text-xs font-bold text-emerald-800 underline mt-1 cursor-pointer"
            >
              Submit another report
            </button>
          </div>
        </div>
      )}

      {/* Form & Map Pin Picker Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form Card */}
        <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-5">
          <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <span>Barrier Details</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Building Selection */}
            <div>
              <label htmlFor="select-report-building" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Select Building *
              </label>
              <select
                id="select-report-building"
                value={buildingId}
                onChange={(e) => handleBuildingChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                {buildings.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            {/* Floor Selection */}
            <div>
              <label htmlFor="select-report-floor" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Floor Level *
              </label>
              <select
                id="select-report-floor"
                value={String(floorId || (selectedFloorData ? selectedFloorData.floorId : ''))}
                onChange={(e) => handleFloorChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                {availableFloors.map(f => (
                  <option key={String(f.floorId)} value={String(f.floorId)}>{f.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Feature / Location Name */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="input-feature-name" className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Location Name *
              </label>
              {selectedRoom && (
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>Auto-filled from map selection</span>
                </span>
              )}
            </div>
            <input
              id="input-feature-name"
              type="text"
              required
              readOnly
              placeholder="Click a marked room or location on the floor map"
              value={featureName}
              className={`w-full border rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none transition-colors ${
                selectedRoom 
                  ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 font-bold shadow-xs' 
                  : 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed'
              }`}
            />

            {/* Selection Confirmation Badge */}
            {selectedRoom ? (
              <div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900 shadow-xs">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-bold">Selected: {selectedRoom.name}</span>
                </div>
                <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-100 px-2 py-0.5 rounded">
                  {selectedBuildingData?.code || 'N/A'} - {selectedFloorData?.name}
                </span>
              </div>
            ) : (
              <p className="mt-1.5 text-[11px] text-slate-500 flex items-center space-x-1">
                <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span>Select a marked room or location on the floor map to auto-fill location.</span>
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Feature Type */}
            <div>
              <label htmlFor="select-feature-type" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Feature Type *
              </label>
              <select
                id="select-feature-type"
                value={featureType}
                onChange={(e) => setFeatureType(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">Select a feature type...</option>
                {availableFeatureOptions.length > 0 ? (
                  availableFeatureOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))
                ) : (
                  <option value="other">No features available</option>
                )}
              </select>
            </div>

            {/* Status */}
            <div>
              <label htmlFor="select-feature-status" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Current Status *
              </label>
              <select
                id="select-feature-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as FeatureStatus)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="broken">🔴 Broken / Barrier / Blocked</option>
                <option value="working">🟢 Working / Fully Accessible</option>
                <option value="not_available">🟡 Not Available / Unverified</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="textarea-description" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Description & Specific Obstacle Notes *
            </label>
            <textarea
              id="textarea-description"
              rows={3}
              required
              placeholder="Describe what is broken or missing. Mention measurements, exact room numbers, or safety hazards."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            ></textarea>
          </div>

          {/* Reporter Name */}
          <div>
            <label htmlFor="input-reporter-name" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Your Name
            </label>
            <input
              id="input-reporter-name"
              type="text"
              placeholder="e.g., Sujit"
              value={reporterName}
              onChange={(e) => setReporterName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Upload Photo */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Upload Photo Proof
            </label>
            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 text-center hover:bg-slate-50/80 transition-colors">
              {photoPreview ? (
                <div className="space-y-2">
                  <img src={photoPreview} alt="Preview" className="max-h-40 mx-auto rounded-lg object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotoPreview(null)}
                    className="text-xs text-rose-600 font-bold hover:underline"
                  >
                    Remove Photo
                  </button>
                </div>
              ) : (
                <label htmlFor="file-photo-input" className="cursor-pointer space-y-1 block">
                  <Camera className="w-8 h-8 text-slate-400 mx-auto" />
                  <span className="text-xs font-bold text-blue-600 block">Click to upload photo</span>
                  <span className="text-[11px] text-slate-400 block">PNG, JPG up to 5MB</span>
                  <input
                    id="file-photo-input"
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          <button
            id="btn-submit-report"
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-3 rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting Report...' : 'Submit Report'}
          </button>
        </form>

        {/* Dynamic Building & Floor Map Picker Panel */}
        <div className="space-y-3 flex flex-col">
          <div>
            <div className="flex items-center space-x-2 text-blue-600 text-xs font-bold uppercase tracking-wider mb-1">
              <MapPin className="w-4 h-4" />
              <span>Building-Specific Digital Twin Spatial Pin</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900">Set Pin Location on Floor Map</h3>
            <p className="text-xs text-slate-500">
              Showing <strong className="text-slate-800">{selectedBuildingData?.name || 'Unknown Building'}</strong> ({selectedFloorData?.name}). Click on the map to mark barrier location.
            </p>
          </div>

          {locationError && (
            <div className="bg-rose-50 border-2 border-rose-200 p-3.5 rounded-2xl text-rose-800 text-xs font-bold flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{locationError}</span>
            </div>
          )}

          <FloorMap
            building={selectedBuildingData}
            floor={selectedFloorData}
            selectedLocation={pinLocation}
            selectedRoomId={selectedRoom?.id}
            selectedRoomName={selectedRoom?.name}
            onSelectLocation={handleSelectLocation}
            isPickerMode={true}
            unmappedError={locationError}
          />
        </div>
      </div>

      {/* Report History Table and Cards with Badges */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Crowdsourced Accessibility Reports</h3>
            <p className="text-xs text-slate-500">Live feed of verified, pending, and resolved campus accessibility reports.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700">
              <button
                type="button"
                id="btn-view-cards"
                onClick={() => setViewMode('cards')}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'cards' ? 'bg-white text-blue-600 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Cards</span>
              </button>
              <button
                type="button"
                id="btn-view-table"
                onClick={() => setViewMode('table')}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'table' ? 'bg-white text-blue-600 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>Table</span>
              </button>
            </div>

            {/* Filter */}
            <div className="flex items-center space-x-2 text-xs">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                id="select-history-filter"
                value={historyFilter}
                onChange={(e) => setHistoryFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none"
              >
                <option value="all">All Reports ({reports.length})</option>
                <option value="pending">Unverified Only</option>
                <option value="verified">Verified Only</option>
                <option value="resolved">Resolved Only</option>
                <option value="rejected">Rejected Reports</option>
              </select>
            </div>
          </div>
        </div>

        {/* CARDS VIEW */}
        {viewMode === 'cards' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredHistory.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-500 text-xs font-semibold bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                No reports found for this filter.
              </div>
            ) : (
              filteredHistory.map((rep) => {
                const isResolved = rep.status === 'resolved' || rep.resolutionStatus === 'resolved';
                const isRejected = (rep.status === 'rejected' || rep.verificationStatus === 'rejected') && !isResolved;
                const isVerified = (rep.verificationStatus === 'admin_verified' || rep.verificationStatus === 'verified' || rep.status === 'verified') && !isResolved && !isRejected;

                const formatFeatureType = (type?: string) => {
                  if (!type) return 'Accessibility Barrier';
                  const t = type.toLowerCase();
                  switch (t) {
                    case 'ramp': return 'Ramp';
                    case 'lift': case 'elevator': return 'Lift / Elevator';
                    case 'toilet': case 'restroom': return 'Accessible Toilet';
                    case 'signage': case 'tactile': return 'Tactile Signage';
                    case 'parking': return 'Accessible Parking';
                    case 'door': return 'Doorway / Automatic Door';
                    case 'stairs': return 'Stairs';
                    case 'entrance': return 'Main Entrance';
                    default: return type.charAt(0).toUpperCase() + type.slice(1);
                  }
                };

                return (
                  <div
                    key={rep.id}
                    id={`user-report-card-${rep.id}`}
                    className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-slate-300 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      {/* Card Header: Feature Name & Type */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-sm text-slate-900 leading-snug">
                            {formatFeatureType(rep.featureType)}
                          </h4>
                          <span className="text-[11px] font-semibold text-slate-600 block mt-0.5">
                            {rep.featureName}
                          </span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold shrink-0 ${
                          rep.status === 'working' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {rep.status === 'working' ? 'Accessible' : 'Barrier'}
                        </span>
                      </div>

                      {/* Location */}
                      <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1">
                        <div className="flex items-center space-x-1.5 text-slate-700 font-semibold">
                          <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>Location: {rep.buildingName || 'SOA ITER Academic Block C'}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 pl-5">
                          {rep.floorName || (rep.floorId === 0 ? 'Ground Floor' : `Floor ${rep.floorId}`)}
                        </div>
                      </div>

                      {/* Description (if present) */}
                      {rep.description && (
                        <p className="text-xs text-slate-600 italic bg-white p-2 rounded-lg border border-slate-100">
                          "{rep.description}"
                        </p>
                      )}

                      {/* Photo preview (if present) */}
                      {rep.photoUrl && (
                        <div className="rounded-xl overflow-hidden border border-slate-200 max-h-32 bg-slate-100 relative">
                          <img src={rep.photoUrl} alt="Report proof" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                      )}

                      {/* Confidence */}
                      <div className="flex items-center justify-between text-xs py-1 border-t border-slate-100">
                        <span className="font-medium text-slate-500">Confidence:</span>
                        <span className={`px-2 py-0.5 rounded-md font-bold text-xs ${
                          (isResolved || isVerified) ? 'bg-emerald-100 text-emerald-800' :
                          isRejected ? 'bg-rose-100 text-rose-800' :
                          rep.confidenceLevel === 'HIGH' ? 'bg-emerald-100 text-emerald-800' :
                          rep.confidenceLevel === 'MEDIUM' ? 'bg-amber-100 text-amber-800' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {(isResolved || isVerified) ? '100% (HIGH)' : isRejected ? '0% (LOW)' : `${rep.confidenceScore}% (${rep.confidenceLevel})`}
                        </span>
                      </div>
                    </div>

                    {/* Card Footer: Clear Status */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div className="text-[10px] text-slate-400">
                        {new Date(rep.submittedAt).toLocaleDateString()}
                      </div>

                      <div className="flex items-center space-x-1.5">
                        <span className="text-[11px] font-bold text-slate-500">Status:</span>
                        {isResolved ? (
                          <span className="inline-flex items-center space-x-1 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg text-xs font-extrabold border border-emerald-300 shadow-2xs">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Resolved</span>
                          </span>
                        ) : isVerified ? (
                          <span className="inline-flex items-center space-x-1 text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg text-xs font-extrabold border border-blue-300 shadow-2xs">
                            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                            <span>Verified</span>
                          </span>
                        ) : isRejected ? (
                          <span className="inline-flex items-center space-x-1 text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg text-xs font-extrabold border border-rose-300 shadow-2xs">
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>Rejected</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg text-xs font-extrabold border border-amber-300 shadow-2xs">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>Unverified</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TABLE VIEW */}
        {viewMode === 'table' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Building & Floor</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Feature / Issue</th>
                  <th className="py-3 px-4">Submitted Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Verification</th>
                  <th className="py-3 px-4">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 px-4 text-center text-slate-500 text-xs font-semibold">
                      No reports found for this filter.
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((rep) => {
                    const isResolved = rep.status === 'resolved' || rep.resolutionStatus === 'resolved';
                    const isRejected = (rep.status === 'rejected' || rep.verificationStatus === 'rejected') && !isResolved;
                    const isVerified = (rep.verificationStatus === 'admin_verified' || rep.verificationStatus === 'verified' || rep.status === 'verified') && !isResolved && !isRejected;

                    const formatFeatureType = (type?: string) => {
                      if (!type) return 'Accessibility Barrier';
                      const t = type.toLowerCase();
                      switch (t) {
                        case 'ramp': return 'Ramp';
                        case 'lift': case 'elevator': return 'Lift / Elevator';
                        case 'toilet': case 'restroom': return 'Accessible Toilet';
                        case 'signage': case 'tactile': return 'Tactile Signage';
                        case 'parking': return 'Accessible Parking';
                        case 'door': return 'Doorway / Automatic Door';
                        case 'stairs': return 'Stairs';
                        case 'entrance': return 'Main Entrance';
                        case 'other': return 'Accessibility Barrier';
                        default: return type.charAt(0).toUpperCase() + type.slice(1);
                      }
                    };

                    return (
                      <tr key={rep.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* 1. Building & Floor */}
                        <td className="py-3.5 px-4 font-semibold text-slate-800 whitespace-nowrap">
                          <div>{rep.buildingName || 'SOA ITER Academic Block C'} — {rep.floorName || (rep.floorId === 0 ? 'Ground Floor' : `Floor ${rep.floorId}`)}</div>
                        </td>

                        {/* 2. Location */}
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          <div>{rep.featureName || 'Reported Location'}</div>
                          {rep.description && (
                            <div className="text-[11px] text-slate-500 font-normal italic mt-0.5 max-w-xs truncate" title={rep.description}>
                              "{rep.description}"
                            </div>
                          )}
                        </td>

                        {/* 3. Feature / Issue */}
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          <div className="text-slate-900 font-bold">{formatFeatureType(rep.featureType)}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-extrabold px-2 py-0.5 rounded-full inline-block">
                              👥 {rep.confirmationsCount || 1} {(rep.confirmationsCount || 1) === 1 ? 'person' : 'people'} reported/agreed
                            </span>
                            <span className="text-[10px] text-slate-500 font-normal">
                              By: <strong className="text-slate-700 font-semibold">{rep.reporterName}</strong>
                            </span>
                          </div>
                        </td>

                        {/* 4. Submitted Date */}
                        <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                          {new Date(rep.submittedAt).toLocaleDateString()}
                        </td>

                        {/* 5. Status */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {isResolved ? (
                            <span className="text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg font-bold border border-emerald-200 inline-flex items-center space-x-1">
                              <span>🟢 Resolved</span>
                            </span>
                          ) : isVerified ? (
                            <span className="text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg font-bold border border-blue-200 inline-flex items-center space-x-1">
                              <span>✓ Verified</span>
                            </span>
                          ) : isRejected ? (
                            <span className="text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg font-bold border border-slate-200 inline-flex items-center space-x-1">
                              <span>⚪ Rejected</span>
                            </span>
                          ) : (
                            <span className="text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg font-bold border border-amber-200 inline-flex items-center space-x-1">
                              <span>⏱️ Unverified</span>
                            </span>
                          )}
                        </td>

                        {/* 6. Verification */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {isResolved ? (
                            <span className="inline-flex items-center space-x-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold border border-emerald-200">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>RESOLVED</span>
                            </span>
                          ) : isVerified ? (
                            <span className="inline-flex items-center space-x-1 text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-bold border border-blue-200">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>VERIFIED</span>
                            </span>
                          ) : isRejected ? (
                            <span className="inline-flex items-center space-x-1 text-rose-700 bg-rose-50 px-2 py-0.5 rounded font-bold border border-rose-200">
                              <XCircle className="w-3.5 h-3.5" />
                              <span>REJECTED</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-bold border border-amber-200">
                              <Clock className="w-3.5 h-3.5" />
                              <span>UNVERIFIED</span>
                            </span>
                          )}
                          {rep.adminNotes && (
                            <div className="text-[10px] text-slate-500 italic mt-1 max-w-xs truncate" title={rep.adminNotes}>
                              Note: {rep.adminNotes}
                            </div>
                          )}
                        </td>

                        {/* 7. Confidence */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded font-extrabold text-[11px] ${
                            (isResolved || isVerified) ? 'bg-emerald-100 text-emerald-800' :
                            isRejected ? 'bg-rose-100 text-rose-800' :
                            rep.confidenceLevel === 'HIGH' ? 'bg-emerald-100 text-emerald-800' :
                            rep.confidenceLevel === 'MEDIUM' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {(isResolved || isVerified) ? 'HIGH (100%)' : isRejected ? 'LOW (0%)' : `${rep.confidenceLevel} (${rep.confidenceScore}%)`}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

