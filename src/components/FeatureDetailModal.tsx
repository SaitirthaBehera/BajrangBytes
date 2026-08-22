import React from 'react';
import { AccessibilityFeature } from '../types';
import { 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  ShieldCheck, 
  ThumbsUp, 
  ThumbsDown, 
  MapPin, 
  Calendar,
  Layers,
  FileText
} from 'lucide-react';

interface FeatureDetailModalProps {
  feature: AccessibilityFeature | null;
  onClose: () => void;
  onReportIssue?: (f: AccessibilityFeature) => void;
}

export const FeatureDetailModal: React.FC<FeatureDetailModalProps> = ({
  feature,
  onClose,
  onReportIssue
}) => {
  if (!feature) return null;

  const getStatusBadge = () => {
    switch (feature.status) {
      case 'working':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-600 mr-1"></span>
            Accessible / Working
          </span>
        );
      case 'broken':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">
            <span className="w-2 h-2 rounded-full bg-rose-600 mr-1"></span>
            Barrier / Not Accessible
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
            <span className="w-2 h-2 rounded-full bg-amber-600 mr-1"></span>
            Reported / Unverified
          </span>
        );
    }
  };

  const getConfidenceBadge = () => {
    const score = feature.confidenceScore;
    if (score >= 70) {
      return <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">HIGH ({score}%)</span>;
    } else if (score >= 40) {
      return <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">MEDIUM ({score}%)</span>;
    }
    return <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">LOW ({score}%)</span>;
  };

  const getVerificationBadge = () => {
    switch (feature.verificationStatus) {
      case 'admin_verified':
        return (
          <span className="inline-flex items-center space-x-1 text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            <span>Admin Verified</span>
          </span>
        );
      case 'community_verified':
        return (
          <span className="inline-flex items-center space-x-1 text-xs font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
            <span>Community Verified</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Unverified</span>
          </span>
        );
    }
  };

  return (
    <div id="modal-feature-detail" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-start justify-between">
          <div className="space-y-1 pr-4">
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              {getStatusBadge()}
              {getVerificationBadge()}
            </div>
            <h3 className="text-lg font-bold text-slate-900 mt-2">{feature.name}</h3>
            <div className="flex items-center space-x-2 text-xs text-slate-500">
              <span className="capitalize font-semibold text-slate-700">{feature.type.replace('_', ' ')}</span>
              <span>•</span>
              <span className="flex items-center">
                <Layers className="w-3 h-3 mr-1" />
                Floor {feature.floorId}
              </span>
            </div>
          </div>
          <button
            id="btn-close-feature-modal"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 p-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Photo Preview if available */}
          {feature.photoUrl && (
            <div className="rounded-xl overflow-hidden border border-slate-200 max-h-52 bg-slate-100">
              <img 
                src={feature.photoUrl} 
                alt={feature.name} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          )}

          {/* Description */}
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Description & Audit Notes</h4>
            <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
              {feature.description || 'No specific notes recorded for this feature.'}
            </p>
          </div>

          {/* Technical Specifications */}
          {feature.specifications && (
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Accessibility Specifications</h4>
              <p className="text-xs font-mono text-slate-700 bg-blue-50/60 p-2.5 rounded-lg border border-blue-100">
                {feature.specifications}
              </p>
            </div>
          )}

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-500">Confidence Rating</span>
              <div className="mt-1 flex items-center justify-between">
                {getConfidenceBadge()}
              </div>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-500">Last Verified</span>
              <div className="mt-1 flex items-center text-xs font-semibold text-slate-800">
                <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                {feature.lastUpdated}
              </div>
            </div>
          </div>

          {/* Community Votes */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-500">Community Feedback:</span>
            <div className="flex items-center space-x-3">
              <span className="inline-flex items-center space-x-1 text-emerald-700 font-semibold bg-emerald-50 px-2 py-1 rounded">
                <ThumbsUp className="w-3.5 h-3.5" />
                <span>{feature.upvotes || 0} Confirmations</span>
              </span>
              <span className="inline-flex items-center space-x-1 text-slate-500 font-medium bg-slate-100 px-2 py-1 rounded">
                <ThumbsDown className="w-3.5 h-3.5" />
                <span>{feature.downvotes || 0} Issues</span>
              </span>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            id="btn-report-issue-modal"
            onClick={() => {
              onClose();
              if (onReportIssue) onReportIssue(feature);
            }}
            className="flex items-center space-x-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-2 rounded-lg border border-rose-200 transition-colors cursor-pointer"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Report Change / Issue</span>
          </button>
          <button
            id="btn-close-modal-footer"
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-900 text-white font-medium text-xs px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
