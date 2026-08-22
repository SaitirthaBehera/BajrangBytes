import React, { useState, useRef, useEffect } from 'react';
import { AiDetectionResult, Building, AccessibilityFeature, BuildingFloor } from '../types';
import { api } from '../services/api';
import { navigationApi, VisionDetectionResponse } from '../services/navigationApi';
import { 
  Scan, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  Cpu, 
  Plus, 
  Eye, 
  Zap,
  Volume2,
  VolumeX,
  Radio,
  Building2,
  X,
  Loader2,
  Check,
  RefreshCw,
  ImageIcon,
  AlertCircle
} from 'lucide-react';

interface DetectedFeatureItem {
  id: string;
  label: string;
  type: string;
  confidence: number;
  bbox: [number, number, number, number];
  status: 'working' | 'broken';
  recommendation: string;
}

interface AiDetectionProps {
  isAdmin?: boolean;
  buildings?: Building[];
  onFeatureAddedToTwin?: (newFeature: AccessibilityFeature) => void;
  onAddDetectedFeatureToTwin?: (featureName: string, featureType: string, confidence: number) => void;
}

export const AiDetection: React.FC<AiDetectionProps> = ({ 
  isAdmin = false,
  buildings = [],
  onFeatureAddedToTwin,
  onAddDetectedFeatureToTwin 
}) => {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [detectionResult, setDetectionResult] = useState<AiDetectionResult | null>(null);
  const [detectionError, setDetectionError] = useState<string | null>(null);
  const [fastApiVoiceMessage, setFastApiVoiceMessage] = useState<string | null>(null);
  const [isFastApiVerified, setIsFastApiVerified] = useState<boolean>(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  
  const uploadRequestIdRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastUploadedFileRef = useRef<File | null>(null);

  // Twin Map Modal State (Admin Only)
  const [selectedFeatureForModal, setSelectedFeatureForModal] = useState<DetectedFeatureItem | null>(null);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [selectedFloorId, setSelectedFloorId] = useState<string>('');
  const [availableFeatureColumns, setAvailableFeatureColumns] = useState<string[]>([]);
  const [selectedFeatureColumn, setSelectedFeatureColumn] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<'present' | 'temporary' | 'none' | ''>('');
  const [isSubmittingToTwin, setIsSubmittingToTwin] = useState<boolean>(false);
  const [twinModalError, setTwinModalError] = useState<string | null>(null);
  const [addedFeatureIds, setAddedFeatureIds] = useState<Set<string>>(new Set());
  const [availableFloors, setAvailableFloors] = useState<BuildingFloor[]>([]);

  // Fetch floors when building changes
  useEffect(() => {
    if (!selectedBuildingId) {
      setAvailableFloors([]);
      return;
    }

    api.getFloorsForBuilding(selectedBuildingId).then((floors) => {
      setAvailableFloors(floors);
    }).catch(err => {
      console.error('Error fetching floors:', err);
      setAvailableFloors([]);
    });
  }, [selectedBuildingId]);

  const handleSpeakVoice = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleResetScan = () => {
    uploadRequestIdRef.current += 1;
    if (isSpeaking && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    lastUploadedFileRef.current = null;
    setUploadedImage(null);
    setIsAnalyzing(false);
    setDetectionResult(null);
    setDetectionError(null);
    setFastApiVoiceMessage(null);
    setIsFastApiVerified(false);
    setExportSuccess(null);
    setAddedFeatureIds(new Set());
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const processImageFile = async (file: File) => {
    lastUploadedFileRef.current = file;
    const currentRequestId = ++uploadRequestIdRef.current;

    // Reset previous states
    if (isSpeaking && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setDetectionResult(null);
    setDetectionError(null);
    setFastApiVoiceMessage(null);
    setIsFastApiVerified(false);
    setAddedFeatureIds(new Set());
    setIsAnalyzing(true);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setUploadedImage(base64);

      try {
        const res: VisionDetectionResponse = await navigationApi.detectAccessibility(file);

        if (currentRequestId !== uploadRequestIdRef.current) return;

        if (res && res.status === 'success') {
          setIsFastApiVerified(true);
          setFastApiVoiceMessage(res.voice_message || null);

          // Map real detections from the backend response
          const rawItems = res.results || (res as any).detectedObjects || [];
          const detectedObjs = rawItems.map((item: any, idx: number) => {
            const label = item.class || item.label || item.type || `Accessibility Feature ${idx + 1}`;
            const conf = typeof item.confidence === 'number'
              ? (item.confidence > 1 ? Math.round(item.confidence) : Math.round(item.confidence * 100))
              : 90;
            const status = item.status === 'broken' || item.status === 'blocked' ? 'broken' : 'working';

            // Normalize bbox to percentages (0-100)
            let bbox: [number, number, number, number] = [20, 20, 80, 80];
            if (Array.isArray(item.bbox) && item.bbox.length === 4) {
              const b = item.bbox.map((v: number) => (v <= 1.0 && v > 0 ? Math.round(v * 100) : Math.round(v)));
              const scale = b.some((v: number) => v > 100) ? 10 : 1;
              const scaled = b.map((v: number) => Math.min(100, Math.max(0, Math.round(v / scale))));
              bbox = [scaled[0], scaled[1], scaled[2], scaled[3]];
            } else if (item.position === 'left') {
              bbox = [10, 20, 45, 80];
            } else if (item.position === 'right') {
              bbox = [55, 20, 90, 80];
            } else {
              bbox = [25, 20, 75, 80];
            }

            return {
              id: item.id || `det-${idx + 1}`,
              label: label.charAt(0).toUpperCase() + label.slice(1).replace(/_/g, ' '),
              type: (item.type || (label.toLowerCase().includes('ramp') ? 'ramp' : label.toLowerCase().includes('stair') ? 'stairs' : label.toLowerCase().includes('lift') ? 'lift' : label.toLowerCase().includes('tactile') ? 'tactile_path' : 'other')) as any,
              confidence: conf,
              bbox,
              status,
              recommendation: item.recommendation || (status === 'working' ? `Verified accessible feature (${label}).` : `Identified barrier (${label}) requiring attention.`)
            };
          });

          setDetectionResult({
            imageId: (res as any).imageId || `img-${Date.now()}`,
            imageUrl: base64,
            analyzedAt: (res as any).analyzedAt || new Date().toISOString(),
            overallAccessibility: (res as any).overallAccessibility || (detectedObjs.some(o => o.status === 'broken') ? 'Moderate' : 'High'),
            summary: res.summary || res.message || (detectedObjs.length > 0 ? `AI identified ${detectedObjs.length} accessibility elements.` : 'No accessibility features or physical barriers identified in this image.'),
            detectedObjects: detectedObjs
          });
        } else {
          throw new Error((res as any)?.message || 'AI detection failed to return results.');
        }
      } catch (err: any) {
        if (currentRequestId !== uploadRequestIdRef.current) return;
        console.error('[AI Detection] Detection error:', err);
        setDetectionError(err.message || 'AI visual detection failed. Please verify connection and try again.');
        setDetectionResult(null);
      } finally {
        if (currentRequestId === uploadRequestIdRef.current) {
          setIsAnalyzing(false);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCustomUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processImageFile(file);
  };

  const handleRetryScan = () => {
    if (lastUploadedFileRef.current) {
      processImageFile(lastUploadedFileRef.current);
    } else if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Open Add to Twin Map modal for specific detected feature
  const handleOpenAddModal = async (feature: DetectedFeatureItem) => {
    setSelectedFeatureForModal(feature);
    setSelectedBuildingId(buildings[0]?.id || '');
    setSelectedFloorId('');
    setTwinModalError(null);
    setSelectedFeatureColumn('');
    setSelectedStatus('');
    
    // Dynamically fetch available accessibility feature columns
    const columns = await api.getAccessibilityFeatureColumns();
    setAvailableFeatureColumns(columns);
  };

  // Handle building dropdown change
  const handleBuildingChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedBuildingId(e.target.value);
    setSelectedFloorId(''); // Reset floor selection when building changes
    setTwinModalError(null);
    setSelectedStatus('');
  };

  // Submit feature to Digital Twin Map
  const handleConfirmAddToTwin = async () => {
    if (!selectedFeatureForModal) return;
    if (!selectedBuildingId) {
      setTwinModalError('Please select a building.');
      return;
    }
    if (!selectedFeatureColumn) {
      setTwinModalError('Please select a feature column.');
      return;
    }
    if (!selectedStatus) {
      setTwinModalError('Please select a status.');
      return;
    }

    setIsSubmittingToTwin(true);
    setTwinModalError(null);

    const targetBldg = buildings.find(b => b.id === selectedBuildingId);
    const targetFloor = availableFloors.find(f => String(f.floorId) === selectedFloorId);

    if (!targetFloor) {
      setTwinModalError('Please select a floor for the chosen building.');
      return;
    }
    try {
      // 1. Add feature to digital twin tracking
      const result = await api.addFeatureToTwin({
        building_id: selectedBuildingId,
        floor_id: Number(selectedFloorId),
        feature_type: selectedFeatureForModal.type,
        label: selectedFeatureForModal.label,
        feature_column: selectedFeatureColumn,
        confidence: selectedFeatureForModal.confidence,
        status: selectedFeatureForModal.status,
        bbox: selectedFeatureForModal.bbox,
        source: 'AI_DETECTION',
        description: selectedFeatureForModal.recommendation
      });

      // 2. Update status in database
      await api.updateAccessibilityFeatureStatus(selectedFloorId, selectedFeatureColumn, selectedStatus as 'present' | 'temporary' | 'none');

      // Mark this feature as added in UI
      setAddedFeatureIds(prev => new Set(prev).add(selectedFeatureForModal.id));
      
      const successMessage = `✓ ${selectedFeatureForModal.label} added & set to ${selectedStatus} on ${targetBldg?.name || 'Building'} — ${targetFloor?.name || 'Selected Floor'}`;
      setExportSuccess(successMessage);

      // Notify parent app of new feature
      if (result.feature && onFeatureAddedToTwin) {
        onFeatureAddedToTwin(result.feature);
      } else if (onAddDetectedFeatureToTwin) {
        onAddDetectedFeatureToTwin(selectedFeatureForModal.label, selectedFeatureForModal.type, selectedFeatureForModal.confidence);
      }

      // Close modal
      setSelectedFeatureForModal(null);

      // Auto dismiss success toast after 5 seconds
      setTimeout(() => {
        setExportSuccess(null);
      }, 5000);
    } catch (err: any) {
      console.error('[AI Detection] Failed to add feature to Twin Map:', err);
      setTwinModalError(err.message || 'Failed to save feature to Twin Map. Please verify admin privileges.');
    } finally {
      setIsSubmittingToTwin(false);
    }
  };

  const detectedObjectsList = detectionResult?.detectedObjects || [];

  return (
    <div id="section-ai-detection" className="space-y-8">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-bold text-purple-600 uppercase tracking-wider mb-1">
            <Cpu className="w-4 h-4" />
            <span>Computer Vision & Deep Learning Subsystem</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">AI Accessibility Feature & Barrier Detection</h2>
          <p className="text-xs text-slate-500 mt-0.5">Upload a live photograph of campus physical infrastructure to perform instant AI accessibility classification and spatial analysis.</p>
        </div>

        <div className="flex items-center space-x-2">
          {uploadedImage && (
            <button
              id="btn-reset-ai-detection"
              type="button"
              onClick={handleResetScan}
              className="px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center space-x-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>New Scan</span>
            </button>
          )}

          <div className="flex items-center space-x-2 bg-purple-50 text-purple-800 font-bold px-3.5 py-2 rounded-xl border border-purple-200 text-xs">
            <Zap className="w-4 h-4 text-purple-600" />
            <span>FastAPI /api/detect Endpoint</span>
          </div>
        </div>
      </div>

      {/* Pipeline Status Indicator */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">Detection Pipeline</span>
          <span className="text-xs text-slate-400 font-mono">POST /api/detect (multipart/form-data)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-semibold">
          <div className={`p-4 rounded-xl border flex items-center space-x-3 transition-colors ${uploadedImage ? 'bg-purple-900/40 border-purple-500 text-purple-200' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>
            <span className="w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center font-bold text-white text-xs shrink-0">1</span>
            <div>
              <div>Image Upload</div>
              <div className="text-[10px] font-normal text-slate-400">
                {uploadedImage ? 'Photo selected' : 'Waiting for upload'}
              </div>
            </div>
          </div>

          <div className={`p-4 rounded-xl border flex items-center space-x-3 transition-colors ${isAnalyzing ? 'bg-amber-900/40 border-amber-500 text-amber-200 animate-pulse' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>
            <span className="w-7 h-7 rounded-full bg-amber-600 flex items-center justify-center font-bold text-white text-xs shrink-0">2</span>
            <div>
              <div>YOLOv8 & Gemini Vision</div>
              <div className="text-[10px] font-normal text-slate-400">
                {isAnalyzing ? 'Analyzing spatial features...' : 'Awaiting image input'}
              </div>
            </div>
          </div>

          <div className={`p-4 rounded-xl border flex items-center space-x-3 transition-colors ${!isAnalyzing && detectionResult ? 'bg-emerald-900/40 border-emerald-500 text-emerald-200' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>
            <span className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-white text-xs shrink-0">3</span>
            <div>
              <div>Verified Classification</div>
              <div className="text-[10px] font-normal text-slate-400">
                {!isAnalyzing && detectionResult 
                  ? `${detectedObjectsList.length} features detected` 
                  : (isAdmin ? 'Admin Twin Map Integration' : 'Visual Accessibility Inspection')}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Voice Message Notification (if returned by AI) */}
      {fastApiVoiceMessage && (
        <div className="bg-purple-50 border border-purple-200 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-xs font-bold text-purple-900">
              <Radio className="w-4 h-4 text-purple-700" />
              <span>AI Vision Audio Feedback</span>
            </div>
            <p className="text-xs text-purple-950 font-medium italic">
              &quot;{fastApiVoiceMessage}&quot;
            </p>
          </div>

          <button
            id="btn-speak-ai-detection"
            type="button"
            onClick={() => handleSpeakVoice(fastApiVoiceMessage)}
            className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center space-x-2 cursor-pointer transition-all shrink-0 ${
              isSpeaking ? 'bg-rose-600 text-white' : 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm'
            }`}
          >
            {isSpeaking ? (
              <>
                <VolumeX className="w-4 h-4" />
                <span>Stop Audio</span>
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4" />
                <span>Listen Audio</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Error Alert Display */}
      {detectionError && (
        <div id="msg-detection-error" className="bg-rose-50 border border-rose-200 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-rose-900 shadow-xs">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <div className="font-bold text-sm">AI Detection Notice</div>
              <p className="text-rose-800">{detectionError}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 shrink-0 self-end sm:self-auto">
            <button
              id="btn-retry-ai-detection"
              type="button"
              onClick={handleRetryScan}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 transition-colors flex items-center space-x-1.5 cursor-pointer shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Scan</span>
            </button>
            <button
              id="btn-dismiss-ai-error"
              type="button"
              onClick={handleResetScan}
              className="px-3 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-100 hover:bg-rose-200 transition-colors cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Main Studio: Bounding Box Canvas + Control Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Bounding Box Image Overlay Canvas */}
        <div className="lg:col-span-2 bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl p-6 space-y-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="font-bold uppercase tracking-wider text-purple-400 flex items-center">
              <Eye className="w-4 h-4 mr-1.5" />
              Vision Analysis Viewport
            </span>
            <span className="bg-slate-800 px-2.5 py-1 rounded-full text-[11px] font-mono text-slate-300">
              {detectionResult ? `${detectedObjectsList.length} Objects Detected` : 'No Active Scan'}
            </span>
          </div>

          <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-video flex items-center justify-center border border-slate-800">
            {isAnalyzing ? (
              <div className="space-y-3 text-center p-8">
                <Cpu className="w-12 h-12 text-purple-400 animate-spin mx-auto" />
                <p className="text-sm text-purple-200 font-bold">Running Neural Vision & Feature Classification...</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">Analyzing physical accessibility structures, slopes, ramps, tactile paving, automatic doors, and potential obstacles.</p>
              </div>
            ) : uploadedImage ? (
              <div className="relative w-full h-full flex items-center justify-center">
                <img
                  src={uploadedImage}
                  alt="Detection Target"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />

                {/* Bounding Box Overlays */}
                {detectionResult && detectedObjectsList.map((obj) => {
                  const [b0, b1, b2, b3] = obj.bbox;
                  const isAccessible = obj.status === 'working';
                  const left = Math.max(2, Math.min(Math.min(b0, b2), 80));
                  const top = Math.max(2, Math.min(Math.min(b1, b3), 80));
                  const width = Math.max(15, Math.min(Math.abs(b2 - b0), 96 - left));
                  const height = Math.max(12, Math.min(Math.abs(b3 - b1), 96 - top));

                  return (
                    <div
                      key={obj.id}
                      style={{
                        left: `${left}%`,
                        top: `${top}%`,
                        width: `${width}%`,
                        height: `${height}%`
                      }}
                      className={`absolute border-2 rounded-lg shadow-lg transition-transform hover:scale-105 ${
                        isAccessible ? 'border-emerald-400 bg-emerald-500/20' : 'border-rose-500 bg-rose-500/20'
                      }`}
                    >
                      {/* Bounding Box Badge */}
                      <span className={`absolute -top-6 left-0 px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-md uppercase tracking-wider whitespace-nowrap ${
                        isAccessible ? 'bg-emerald-600' : 'bg-rose-600'
                      }`}>
                        {obj.label} ({obj.confidence}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center p-8 space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
                  <ImageIcon className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-200">No Image Uploaded</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Upload a photo of campus infrastructure (ramps, entrances, corridors, tactile paving, or lifts) to run live AI accessibility detection.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center space-x-1.5 cursor-pointer shadow-sm"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Select Image to Scan</span>
                </button>
              </div>
            )}
          </div>

          <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/60 text-xs text-slate-300 space-y-1">
            <span className="font-bold text-white">AI Vision Analysis Summary:</span>
            <p className="text-slate-400">
              {isAnalyzing 
                ? 'Processing uploaded image...'
                : detectionResult 
                  ? detectionResult.summary 
                  : 'Upload an image above to start automated accessibility detection and feature identification.'}
            </p>
          </div>
        </div>

        {/* Upload & Detected Object Table Sidebar */}
        <div className="space-y-6">
          {/* Custom Photo Upload Card */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Image Ingestion</h3>
              {uploadedImage && (
                <button
                  type="button"
                  onClick={handleResetScan}
                  className="text-xs text-rose-600 hover:text-rose-700 font-bold flex items-center space-x-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Remove Image</span>
                </button>
              )}
            </div>
            
            <label htmlFor="input-ai-custom-upload" className="block cursor-pointer">
              <div className={`border-2 border-dashed transition-all rounded-2xl p-6 text-center space-y-2.5 ${
                uploadedImage 
                  ? 'border-purple-300 bg-purple-50/40 hover:bg-purple-50' 
                  : 'border-purple-200 hover:border-purple-400 bg-purple-50/50 hover:bg-purple-50'
              }`}>
                <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center mx-auto">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs font-bold text-purple-900 block">
                    {uploadedImage ? 'Choose a Different Photo' : 'Upload Campus Infrastructure Photo'}
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    Select JPEG, PNG, or WebP to scan for ramps, doors, tactile paths, elevators, or barriers
                  </span>
                </div>
              </div>
              <input
                ref={fileInputRef}
                id="input-ai-custom-upload"
                type="file"
                accept="image/*"
                onChange={handleCustomUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* Detected Features Breakdown List */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Detected Features</h3>
              <span className="text-xs text-slate-500">
                {detectionResult ? `${detectedObjectsList.length} identified` : '0 identified'}
              </span>
            </div>

            {exportSuccess && (
              <div id="msg-twin-export-success" className="bg-emerald-50 text-emerald-800 text-xs p-3 rounded-xl border border-emerald-200 flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold">{exportSuccess}</span>
              </div>
            )}

            <div className="space-y-3">
              {!uploadedImage ? (
                <div className="text-center py-8 text-slate-400 text-xs space-y-2">
                  <Scan className="w-8 h-8 mx-auto text-slate-300" />
                  <p>No image analyzed yet.</p>
                  <p className="text-[11px] text-slate-400">Upload a photograph to identify accessibility features.</p>
                </div>
              ) : isAnalyzing ? (
                <div className="text-center py-8 text-slate-500 text-xs space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-purple-600" />
                  <p className="font-semibold">Analyzing image features...</p>
                </div>
              ) : detectedObjectsList.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs space-y-1">
                  <p className="font-semibold text-slate-600">No Features Detected</p>
                  <p className="text-[11px] text-slate-400">The AI model did not identify specific accessibility features or physical barriers in this image.</p>
                </div>
              ) : (
                detectedObjectsList.map((obj) => {
                  const isAdded = addedFeatureIds.has(obj.id);

                  return (
                    <div key={obj.id} id={`card-detected-feature-${obj.id}`} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-900">{obj.label}</span>
                        <span className="font-extrabold text-purple-700 bg-purple-100 px-2 py-0.5 rounded text-[11px]">
                          {obj.confidence}% Match
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-600">{obj.recommendation}</p>

                      <div className="pt-2 flex items-center justify-between border-t border-slate-200/60">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          obj.status === 'working' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {obj.status === 'working' ? 'Accessible' : 'Barrier Detected'}
                        </span>

                        {/* Admin-only "Add to Twin Map" Action */}
                        {isAdmin && (
                          isAdded ? (
                            <span 
                              id={`badge-added-twin-${obj.id}`}
                              className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center space-x-1"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Added to Twin</span>
                            </span>
                          ) : (
                            <button
                              id={`btn-add-feature-${obj.id}`}
                              type="button"
                              onClick={() => handleOpenAddModal(obj as DetectedFeatureItem)}
                              className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors flex items-center space-x-1 cursor-pointer shadow-2xs"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add to Twin Map</span>
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ADMIN DIALOG / MODAL: Add Feature to Twin Map */}
      {isAdmin && selectedFeatureForModal && (
        <div 
          id="modal-add-to-twin-backdrop"
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmittingToTwin) {
              setSelectedFeatureForModal(null);
            }
          }}
        >
          <div 
            id="modal-add-to-twin"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-add-to-twin-title"
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-inner">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="modal-add-to-twin-title" className="text-base font-bold text-slate-900">
                    Add Feature to Twin Map
                  </h3>
                  <p className="text-xs text-slate-500">
                    Link AI detection directly to campus spatial map
                  </p>
                </div>
              </div>
              <button
                type="button"
                id="btn-modal-close"
                onClick={() => setSelectedFeatureForModal(null)}
                disabled={isSubmittingToTwin}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Notification inside modal */}
            {twinModalError && (
              <div id="modal-error-alert" className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded-xl flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="leading-snug">{twinModalError}</div>
              </div>
            )}

            {/* Pre-populated Detected Feature Information */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Detected Feature Details
              </div>

              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900">{selectedFeatureForModal.label}</span>
                <span className="font-extrabold text-purple-700 bg-purple-100 px-2 py-0.5 rounded text-xs">
                  {selectedFeatureForModal.confidence}% Match
                </span>
              </div>

              <div className="flex items-center space-x-2 text-xs">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  selectedFeatureForModal.status === 'working' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {selectedFeatureForModal.status === 'working' ? 'Accessible' : 'Barrier'}
                </span>
                <span className="text-slate-500 text-[11px]">Type: {selectedFeatureForModal.type}</span>
              </div>

              {selectedFeatureForModal.recommendation && (
                <p className="text-[11px] text-slate-600 italic">
                  {selectedFeatureForModal.recommendation}
                </p>
              )}
            </div>

            {/* Building and Floor Selector */}
            <div className="space-y-4">
              {/* Building Selector */}
              <div className="space-y-1.5">
                <label 
                  htmlFor="select-twin-modal-building" 
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wider"
                >
                  Building <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    id="select-twin-modal-building"
                    value={selectedBuildingId}
                    onChange={handleBuildingChange}
                    disabled={isSubmittingToTwin}
                    className="w-full bg-white border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold cursor-pointer outline-none transition-all"
                  >
                    <option value="">-- Select Building --</option>
                    {buildings.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Floor Selector (Dynamically populated from chosen building) */}
              <div className="space-y-1.5">
                <label 
                  htmlFor="select-twin-modal-floor" 
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wider"
                >
                  Floor <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    id="select-twin-modal-floor"
                    value={selectedFloorId}
                    onChange={(e) => {
                      setSelectedFloorId(e.target.value);
                      setTwinModalError(null);
                    }}
                    disabled={!selectedBuildingId || isSubmittingToTwin}
                    className="w-full bg-white border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold cursor-pointer outline-none transition-all"
                  >
                    <option value="">
                      {selectedBuildingId ? '-- Select Floor --' : '-- Select a Building First --'}
                    </option>
                    {availableFloors.map(floor => (
                      <option key={floor.floorId} value={floor.floorId}>
                        {floor.name}
                      </option>
                    ))}
                  </select>
                </div>
                {!selectedBuildingId && (
                  <p className="text-[10px] text-slate-400">
                    Select a building to view its available floors.
                  </p>
                )}
              </div>

              {/* Feature Column Selector */}
              <div className="space-y-1.5">
                <label 
                  htmlFor="select-twin-modal-feature" 
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wider"
                >
                  Feature Column <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    id="select-twin-modal-feature"
                    value={selectedFeatureColumn}
                    onChange={(e) => setSelectedFeatureColumn(e.target.value)}
                    disabled={isSubmittingToTwin}
                    className="w-full bg-white border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold cursor-pointer outline-none transition-all"
                  >
                    <option value="">-- Select Feature --</option>
                    {availableFeatureColumns.map(col => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Feature Status Selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Status <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['present', 'temporary', 'none'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSelectedStatus(s)}
                      className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all ${
                        selectedStatus === s 
                          ? 'bg-blue-600 text-white border-blue-600' 
                          : 'bg-white text-slate-700 border-slate-300 hover:border-blue-400'
                      }`}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-3">
              <button
                type="button"
                id="btn-twin-modal-cancel"
                onClick={() => setSelectedFeatureForModal(null)}
                disabled={isSubmittingToTwin}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                id="btn-twin-modal-confirm"
                onClick={handleConfirmAddToTwin}
                disabled={!selectedBuildingId || selectedFloorId === '' || isSubmittingToTwin}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer shadow-md shadow-blue-500/20"
              >
                {isSubmittingToTwin ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Add to Twin Map</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
