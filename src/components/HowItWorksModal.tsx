import React from 'react';
import { X, Layers, AlertTriangle, Scan, Navigation, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface HowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HowItWorksModal: React.FC<HowItWorksModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div id="modal-how-it-works" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 bg-indigo-900 text-white flex items-center justify-between">
          <div>
            <span className="bg-indigo-700 text-indigo-100 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
              SOAIDEATHON S37 Architecture
            </span>
            <h3 className="text-xl font-extrabold mt-1">How AccessTwin Works</h3>
          </div>
          <button
            id="btn-close-how-modal"
            onClick={onClose}
            className="text-indigo-200 hover:text-white p-1.5 rounded-lg hover:bg-indigo-800 transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto text-xs text-slate-700 leading-relaxed">
          <p className="text-slate-600">
            AccessTwin creates dynamic digital twins of public buildings such as colleges, hospitals, and stations to ensure equal mobility for everyone.
          </p>

          <div className="space-y-4">
            <div className="flex items-start space-x-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0 mt-0.5">
                <Layers className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-slate-900 text-sm">1. Digital Twin Spatial Mapping</h4>
                <p>
                  Floor plan SVG layouts map rooms, elevators, ramps, doorways, and restrooms into interconnected graph nodes.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold shrink-0 mt-0.5">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-slate-900 text-sm">2. Crowdsourced Reporting & Verification</h4>
                <p>
                  Visitors and students drop location pins and upload photos of broken elevators or un-ramped steps. Reports receive confidence badges (LOW → MEDIUM → HIGH) through community votes and admin verification.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold shrink-0 mt-0.5">
                <Scan className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-slate-900 text-sm">3. AI Computer Vision Detection</h4>
                <p>
                  YOLOv8 & Gemini multimodal vision models analyze photographs to automatically detect ramps, tactile paving, and steps, returning bounding box overlays and feature classifications.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0 mt-0.5">
                <Navigation className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-slate-900 text-sm">4. Weighted Pathfinding Navigation</h4>
                <p>
                  A* and Dijkstra graph algorithms compute customized routes tailored to wheelchair, visual, or elderly profiles, penalizing broken features or impassable staircases.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 text-right">
          <button
            id="btn-close-how-modal-footer"
            onClick={onClose}
            className="bg-indigo-900 hover:bg-indigo-800 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
