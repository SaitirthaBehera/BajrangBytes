import React from 'react';
import { Building } from '../types';
import { 
  BarChart3, 
  Award, 
  CheckCircle2, 
  Building2, 
  Layers, 
  TrendingUp, 
  ShieldCheck, 
  Info,
  ArrowRight
} from 'lucide-react';

interface BuildingScoreCardProps {
  building: Building;
  allBuildings: Building[];
  onSelectBuilding: (b: Building) => void;
  onNavigateToRecommendations: () => void;
  isAdminLoggedIn?: boolean;
}

export const BuildingScoreCard: React.FC<BuildingScoreCardProps> = ({
  building,
  allBuildings,
  onSelectBuilding,
  onNavigateToRecommendations,
  isAdminLoggedIn = false
}) => {
  const categories = [
    { key: 'wheelchair', label: 'Wheelchair Ramp & Elevator Access', score: building.scores?.wheelchair || 0, desc: 'Step-free access, 1:12 ramps, wide door frames >= 90cm' },
    { key: 'visual', label: 'Visual Impairment & Tactile Guidance', score: building.scores?.visual || 0, desc: 'Tactile ground indicator tiles, audio elevator beacons, high contrast walls' },
    { key: 'hearing', label: 'Hearing Impairment & Visual Alarms', score: building.scores?.hearing || 0, desc: 'Visible alarm strobes, illuminated floor indicators, digital notice displays' },
    { key: 'signage', label: 'Tactile & Braille Door Signage', score: building.scores?.signage || 0, desc: 'Eye-level Braille plates (140cm height), Grade-2 tactile embossing' },
    { key: 'restrooms', label: 'Accessible Restrooms & Grab Bars', score: building.scores?.restrooms || 0, desc: '1.5m turning radius, emergency pull cord, support rails' },
    { key: 'navigation', label: 'Indoor Digital Twin Graph Readiness', score: building.scores?.navigation || 0, desc: 'Node graph connectivity, pathfinding accuracy, low hazard weight' },
  ];

  if (building.overallScore === undefined || !building.scores) {
    return (
      <div id="section-building-score" className="p-8 bg-slate-50 rounded-2xl border border-slate-200 text-center">
        <p className="text-slate-500 font-medium">No building score data available</p>
      </div>
    );
  }

  return (
    <div id="section-building-score" className="space-y-10">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1">
            <Award className="w-4 h-4" />
            <span>Campus Infrastructure Index</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">{building.name} Accessibility Score</h2>
          <p className="text-xs text-slate-500 mt-0.5">Comprehensive accessibility rating based on 6 core universal accessibility categories.</p>
        </div>

        {isAdminLoggedIn && (
          <button
            id="btn-score-view-fixes"
            onClick={onNavigateToRecommendations}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center space-x-2 cursor-pointer"
          >
            <span>See Recommended Fixes</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Main Score Hero Card */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-950 text-white p-8 rounded-3xl border border-slate-800 shadow-xl grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
        <div className="text-center md:text-left space-y-2">
          <span className="text-xs font-bold text-indigo-300 uppercase tracking-widest">Building Score</span>
          <div className="text-6xl font-black text-white tracking-tight">{building.overallScore}<span className="text-3xl text-indigo-300 font-normal">/100</span></div>
          <div className="inline-block bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 font-bold px-3 py-1 rounded-full text-xs">
            ✓ Good Campus Accessibility Rating
          </div>
        </div>

        <div className="md:col-span-2 text-xs text-indigo-100 space-y-3 leading-relaxed">
          <p>
            The Accessibility Score evaluates structural features, active barriers reported by the crowdsourced community, and verified sensor audits.
          </p>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Digitalized Floors</span>
              <span className="text-sm font-bold text-white">{building.floorsCount} Floors</span>
            </div>
            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Compliance Standard</span>
              <span className="text-sm font-bold text-emerald-400">WCAG 2.1 AA Compliant</span>
            </div>
          </div>
        </div>
      </div>

      {/* Category Progress Meters Grid */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6">
        <h3 className="text-lg font-bold text-slate-900">Accessibility Category Ratings</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {categories.map((cat) => (
            <div key={cat.key} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-900">{cat.label}</span>
                <span className="font-black text-blue-700 text-sm">{cat.score}%</span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    cat.score >= 80 ? 'bg-emerald-500' : cat.score >= 70 ? 'bg-blue-500' : 'bg-amber-500'
                  }`}
                  style={{ width: `${cat.score}%` }}
                ></div>
              </div>

              <p className="text-[11px] text-slate-500">{cat.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* SOA Campus Building Score Comparison Table */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6">
        <h3 className="text-lg font-bold text-slate-900">SOA University Campus Benchmark Comparison</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Building Name</th>
                <th className="py-3 px-4">Campus</th>
                <th className="py-3 px-4">Score</th>
                <th className="py-3 px-4">Wheelchair</th>
                <th className="py-3 px-4">Visual</th>
                <th className="py-3 px-4">Restrooms</th>
                <th className="py-3 px-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {allBuildings.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-slate-900">{b.name}</td>
                  <td className="py-3.5 px-4 text-slate-500">{b.campus}</td>
                  <td className="py-3.5 px-4">
                    <span className="bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full font-black text-xs">
                      {b.overallScore ?? 'N/A'}/100
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-700">{b.scores?.wheelchair ?? 0}%</td>
                  <td className="py-3.5 px-4 font-bold text-slate-700">{b.scores?.visual ?? 0}%</td>
                  <td className="py-3.5 px-4 font-bold text-slate-700">{b.scores?.restrooms ?? 0}%</td>
                  <td className="py-3.5 px-4">
                    <button
                      id={`btn-score-switch-${b.id}`}
                      onClick={() => onSelectBuilding(b)}
                      className="text-blue-600 hover:text-blue-700 font-bold text-xs underline cursor-pointer"
                    >
                      Select Building
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
