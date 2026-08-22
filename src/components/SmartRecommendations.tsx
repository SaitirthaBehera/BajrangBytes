import React, { useState } from 'react';
import { Recommendation } from '../types';
import { api } from '../services/api';
import { 
  Lightbulb, 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Filter,
  Layers,
  Building2
} from 'lucide-react';

interface SmartRecommendationsProps {
  recommendations: Recommendation[];
  onStatusUpdated: (recId: string, newStatus: 'Pending' | 'In Progress' | 'Completed', reportId?: string) => void;
}

export const SmartRecommendations: React.FC<SmartRecommendationsProps> = ({
  recommendations,
  onStatusUpdated
}) => {
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});

  const handleStatusChange = async (rec: Recommendation, newStatus: 'Pending' | 'In Progress' | 'Completed') => {
    setUpdatingId(rec.id);
    setCardErrors(prev => ({ ...prev, [rec.id]: '' }));

    try {
      const updated = await api.updateRecommendationStatus(rec.id, newStatus, rec.reportId);
      if (!updated) {
        throw new Error('Database operation failed. Please check connection and try again.');
      }
      onStatusUpdated(rec.id, newStatus, rec.reportId);
    } catch (err: any) {
      console.error('Failed to update recommendation status:', err);
      setCardErrors(prev => ({
        ...prev,
        [rec.id]: err?.message || 'Database update failed. Please retry.'
      }));
    } finally {
      setUpdatingId(null);
    }
  };

  const activeRecs = recommendations.filter(r => r.status !== 'Completed');

  const filteredRecs = activeRecs.filter(r => {
    if (filterPriority !== 'all' && r.priority !== filterPriority) return false;
    return true;
  });

  return (
    <div id="section-recommendations" className="space-y-10">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">
            <Lightbulb className="w-4 h-4" />
            <span>Facility Management ROI Optimization</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Smart Recommendation Engine</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Ranks low-cost high-impact infrastructure improvements using the ROI formula: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-800 font-mono">Impact = (Users Affected × Severity) / Cost</code>
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-2 text-xs">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            id="select-rec-priority-filter"
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-semibold text-slate-800 focus:outline-none"
          >
            <option value="all">All Priorities</option>
            <option value="Critical">Critical Priority</option>
            <option value="High">High Priority</option>
            <option value="Medium">Medium Priority</option>
          </select>
        </div>
      </div>

      {/* Recommendation Cards / Empty State */}
      {filteredRecs.length === 0 ? (
        <div id="empty-state-recommendations" className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-xs flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-500">
            <Lightbulb className="w-8 h-8" />
          </div>
          <div className="max-w-md space-y-1">
            <h3 className="text-lg font-bold text-slate-900">No recommendations available.</h3>
            <p className="text-sm text-slate-500">
              {filterPriority !== 'all'
                ? 'No fix recommendations match your selected filters. Try adjusting or resetting the filters.'
                : 'There are currently no active fix suggestions or facility interventions queued. Real recommendations will automatically appear here once campus reports and AI analyses are verified.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredRecs.map((rec, index) => (
            <div 
              key={rec.id}
              id={`card-fix-suggestion-${rec.id}`}
              className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-5"
            >
              <div className="space-y-3">
                {/* Top Badge Row */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                    #{index + 1} Rank • ROI Score {rec.impactScore}
                  </span>

                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${
                    rec.priority === 'Critical' ? 'bg-rose-100 text-rose-800' :
                    rec.priority === 'High' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-800'
                  }`}>
                    {rec.priority} Priority
                  </span>
                </div>

                {/* Title, Building, Floor & Location */}
                <div>
                  <h3 className="text-base font-bold text-slate-900 leading-snug">{rec.title}</h3>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 font-medium mt-1.5">
                    <span className="flex items-center text-slate-700 font-semibold">
                      <Building2 className="w-3.5 h-3.5 mr-1 text-blue-600" />
                      {rec.buildingName}
                    </span>
                    <span className="flex items-center text-slate-600">
                      <Layers className="w-3.5 h-3.5 mr-1 text-slate-400" />
                      {rec.floorId === 0 ? 'Ground Floor' : `Floor ${rec.floorId}`}
                    </span>
                    <span className="text-slate-500">
                      📍 {rec.locationName}
                    </span>
                  </div>
                  {rec.reportId && (
                    <div className="mt-1.5 inline-flex items-center space-x-1 text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                      <span className="font-semibold text-slate-700">Source Report:</span>
                      <span>#{rec.reportId.slice(0, 8)}</span>
                    </div>
                  )}
                </div>

                {/* Problem & Solution */}
                <div className="space-y-2 text-xs">
                  <div className="bg-rose-50/70 p-3 rounded-xl border border-rose-100/90">
                    <span className="font-bold text-rose-900 block flex items-center justify-between">
                      <span>Detected Barrier / Problem:</span>
                      <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded uppercase">
                        {rec.severity || 'High'} Severity
                      </span>
                    </span>
                    <p className="text-rose-800 mt-0.5">{rec.problem}</p>
                  </div>
                  <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-100/90">
                    <span className="font-bold text-emerald-900 block">Recommended Fix / Intervention:</span>
                    <p className="text-emerald-800 mt-0.5">{rec.solution}</p>
                  </div>
                </div>

                {/* Tag Pills (Disability Groups) */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Disability Groups Affected:</span>
                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    {rec.disabilityTypesAffected.map(dis => (
                      <span key={dis} className="bg-blue-50 text-blue-700 border border-blue-200 font-bold px-2 py-0.5 rounded capitalize">
                        ♿ {dis}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Metrics & Action Footer */}
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Estimated Cost</span>
                    <span className="font-bold text-slate-800">{rec.estimatedCostAmount}</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Impact Level</span>
                    <span className="font-bold text-emerald-700">{rec.expectedImpact}</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Users Affected</span>
                    <span className="font-bold text-slate-800">~{rec.estimatedUsersAffected} / mo</span>
                  </div>
                </div>

                {/* Error Banner if update failed */}
                {cardErrors[rec.id] && (
                  <div className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                    <span>{cardErrors[rec.id]}</span>
                  </div>
                )}

                {/* Status Action Buttons with Exact Lifecycle Flow */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-slate-500 font-medium">Status:</span>
                    <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                      rec.status === 'In Progress'
                        ? 'text-blue-700 bg-blue-50 border border-blue-200'
                        : 'text-amber-700 bg-amber-50 border border-amber-200'
                    }`}>
                      {rec.status}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    {rec.status === 'Pending' ? (
                      <>
                        <span
                          id={`btn-rec-status-${rec.id}-pending`}
                          className="bg-amber-100 text-amber-800 border border-amber-300 font-bold px-3 py-1.5 rounded-lg text-[11px] flex items-center space-x-1 select-none"
                        >
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          <span>Pending</span>
                        </span>
                        <button
                          type="button"
                          id={`btn-rec-status-${rec.id}-in-progress`}
                          disabled={updatingId === rec.id}
                          onClick={() => handleStatusChange(rec, 'In Progress')}
                          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center space-x-1 shadow-xs"
                        >
                          {updatingId === rec.id ? (
                            <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                          ) : (
                            <TrendingUp className="w-3.5 h-3.5" />
                          )}
                          <span>In Progress</span>
                        </button>
                      </>
                    ) : rec.status === 'In Progress' ? (
                      <>
                        <span
                          id={`btn-rec-status-${rec.id}-in-progress`}
                          className="bg-blue-600 text-white font-bold px-3 py-1.5 rounded-lg text-[11px] flex items-center space-x-1 shadow-xs select-none"
                        >
                          <TrendingUp className="w-3.5 h-3.5" />
                          <span>In Progress</span>
                        </span>
                        <button
                          type="button"
                          id={`btn-rec-status-${rec.id}-completed`}
                          disabled={updatingId === rec.id}
                          onClick={() => handleStatusChange(rec, 'Completed')}
                          className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center space-x-1 shadow-xs"
                        >
                          {updatingId === rec.id ? (
                            <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                          <span>Completed</span>
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
