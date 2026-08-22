import React, { useState } from 'react';
import { Building, AccessibilityReport } from '../types';
import { HomeBuildingDropdown, SupabaseBuildingRow } from './HomeBuildingDropdown';
import { 
  Building2, 
  Map, 
  AlertTriangle, 
  Scan, 
  Navigation, 
  CheckCircle2, 
  ShieldCheck, 
  Search, 
  ArrowRight, 
  TrendingUp,
  Award,
  Sparkles
} from 'lucide-react';

interface HomeDashboardProps {
  buildings: Building[];
  homeBuildings: Building[];
  selectedBuilding: Building | null;
  reports: AccessibilityReport[];
  accessibilityFeaturesCount: number;
  adminReportsCount: number;
  verifiedReportsCount: number;
  onSelectBuilding: (b: Building) => void;
  onNavigateToTab: (tab: string) => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  buildings,
  homeBuildings,
  selectedBuilding,
  reports,
  accessibilityFeaturesCount,
  adminReportsCount,
  verifiedReportsCount,
  onSelectBuilding,
  onNavigateToTab
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const handleDropdownSelect = (buildingId: string, row?: SupabaseBuildingRow) => {
    // Try to find the full building object from homeBuildings only
    const matchedBuilding = homeBuildings.find(b => String(b.id) === String(buildingId));
    if (matchedBuilding) {
      onSelectBuilding(matchedBuilding);
    } else if (row) {
      // Create building object if needed
      const bObj: Building = {
        id: String(row.building_id || row.id || buildingId),
        name: row.building_name || row.name || 'Building',
        code: row.building_code || 'BLDG',
        campus: row.campus || 'Main Campus',
        address: row.address || '',
        floorsCount: Number(row.floors_count || 1),
        overallScore: Number(row.overall_score || 90),
        imageUrl: row.image_url || 'https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&q=80&w=800',
        description: row.description || '',
        floors: []
      };
      onSelectBuilding(bObj);
    }
  };

  const filteredBuildings = homeBuildings.filter(b => 
    b.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    b.campus.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div id="section-home-dashboard" className="space-y-10">
      {/* Hero Banner with Modern Gradient */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-900 via-blue-900 to-slate-900 text-white rounded-3xl p-8 sm:p-12 shadow-2xl border border-indigo-800/50">
        <div className="relative z-10 max-w-3xl space-y-6">
          <div className="inline-flex items-center space-x-2 bg-blue-500/20 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-blue-400/30 text-blue-200 text-xs font-semibold">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <span>SOAIDEATHON S37 Digital Twin Platform</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
            Crowdsourced Accessibility Digital Twin for Public Buildings
          </h1>

          <p className="text-base sm:text-lg text-indigo-100 font-normal leading-relaxed">
            Real-time indoor spatial mapping, AI-powered feature detection, barrier reporting, and weighted accessible navigation for university campuses, hospitals, and stations.
          </p>

          {/* Quick Action Launchers */}
          <div className="pt-2 flex flex-wrap gap-3">
            <button
              id="btn-hero-explore-map"
              onClick={() => onNavigateToTab('digital-twin')}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm px-5 py-3 rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center space-x-2 cursor-pointer"
            >
              <Map className="w-4 h-4" />
              <span>Explore Digital Twin Map</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>

            <button
              id="btn-hero-report-issue"
              onClick={() => onNavigateToTab('report-issue')}
              className="bg-white/10 hover:bg-white/20 text-white font-semibold text-sm px-4 py-3 rounded-xl border border-white/20 transition-all flex items-center space-x-2 cursor-pointer"
            >
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Report Barrier</span>
            </button>

            <button
              id="btn-hero-navigation"
              onClick={() => onNavigateToTab('navigation')}
              className="bg-white/10 hover:bg-white/20 text-white font-semibold text-sm px-4 py-3 rounded-xl border border-white/20 transition-all flex items-center space-x-2 cursor-pointer"
            >
              <Navigation className="w-4 h-4 text-emerald-400" />
              <span>Accessible Route</span>
            </button>

            <button
              id="btn-hero-ai-detection"
              onClick={() => onNavigateToTab('ai-detection')}
              className="bg-white/10 hover:bg-white/20 text-white font-semibold text-sm px-4 py-3 rounded-xl border border-white/20 transition-all flex items-center space-x-2 cursor-pointer"
            >
              <Scan className="w-4 h-4 text-purple-400" />
              <span>AI Detection</span>
            </button>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -right-20 -bottom-20 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl pointer-events-none"></div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs hover:border-blue-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Buildings Mapped</span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-slate-900">{homeBuildings.length}</span>
            <span className="text-xs text-slate-500 ml-2">Campus Blocks</span>
          </div>
          <p className="text-xs text-emerald-600 font-medium mt-2 flex items-center">
            <TrendingUp className="w-3.5 h-3.5 mr-1" />
            <span>SOA Campus 100% Digitalized</span>
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Accessibility Features</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-slate-900">{accessibilityFeaturesCount}</span>
            <span className="text-xs text-slate-500 ml-2">Ramps, Lifts, Toilets</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">Active in digital twins</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs hover:border-rose-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Reported Barriers</span>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-slate-900">{adminReportsCount}</span>
            <span className="text-xs text-slate-500 ml-2">Active Tickets</span>
          </div>
          <p className="text-xs text-rose-600 font-medium mt-2">Requires admin verification</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs hover:border-purple-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Verified Reports</span>
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-slate-900">{verifiedReportsCount}</span>
            <span className="text-xs text-slate-500 ml-2">Accuracy Rate</span>
          </div>
          <p className="text-xs text-purple-600 font-medium mt-2">Verified by campus audit team</p>
        </div>
      </div>

      {/* Building Search & Selection Grid */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">SOA University Buildings & Campuses</h3>
            <p className="text-xs text-slate-500">Select a building to view its digital twin map and accessibility score.</p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <HomeBuildingDropdown
              selectedBuildingId={selectedBuilding?.id}
              onSelectBuildingId={handleDropdownSelect}
            />

            <div className="relative max-w-xs w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="input-search-buildings"
                type="text"
                placeholder="Search SOA building..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {filteredBuildings.map(building => {
            const isSelected = selectedBuilding && building.id === selectedBuilding.id;
            return (
              <div
                key={building.id}
                onClick={() => onSelectBuilding(building)}
                className={`group rounded-2xl border transition-all cursor-pointer overflow-hidden flex flex-col ${
                  isSelected
                    ? 'border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/20 shadow-md'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
                }`}
              >
                <div className="aspect-video w-full relative overflow-hidden bg-slate-100">
                  {building.imageUrl && (
                    <img
                      src={building.imageUrl}
                      alt={building.name}
                      onError={(e) => console.error(`[IMAGE ERROR] Building: ${building.name}`)}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-full text-xs font-extrabold text-blue-700 shadow-md">
                    {building.overallScore}/100 Score
                  </div>
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-wider">{building.code}</span>
                      {building.campus && (
                        <span className="text-[10px] font-medium text-slate-400">{building.campus}</span>
                      )}
                    </div>
                    <h4 className="text-base font-bold text-slate-900 leading-snug group-hover:text-blue-600 transition-colors">
                      {building.name}
                    </h4>
                    {building.address && (
                      <p className="text-[11px] text-slate-400 font-medium truncate">{building.address}</p>
                    )}
                    {building.description && (
                      <p className="text-xs text-slate-500 line-clamp-2">{building.description}</p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500">{building.floorsCount} Floors Digitalized</span>
                    <button
                      id={`btn-select-building-${building.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectBuilding(building);
                        onNavigateToTab('digital-twin');
                      }}
                      className="text-blue-600 hover:text-blue-700 font-bold flex items-center space-x-1 cursor-pointer"
                    >
                      <span>Open Twin</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* How AccessTwin Platform Works */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xs space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">Platform Workflow</span>
          <h3 className="text-2xl font-bold text-slate-900">How AccessTwin Powers Inclusive Campuses</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
          {[
            {
              step: '01',
              title: '3D Spatial Digital Twin',
              desc: 'Interactive SVG floor plan maps with indoor nodes for classrooms, elevators, and ramps.'
            },
            {
              step: '02',
              title: 'Crowdsourced Issue Reports',
              desc: 'Students and visitors upload photos and pin barriers on the digital twin in real time.'
            },
            {
              step: '03',
              title: 'AI Image Feature Detection',
              desc: 'Computer vision identifies ramps, lifts, and broken steps with confidence scores.'
            },
            {
              step: '04',
              title: 'Weighted Pathfinding',
              desc: 'A*/Dijkstra router calculates customized routes tailored to wheelchair, visual, or elderly users.'
            }
          ].map((s, idx) => (
            <div key={idx} className="bg-slate-50 p-6 rounded-2xl border border-slate-100 relative space-y-3">
              <span className="text-3xl font-black text-blue-200">{s.step}</span>
              <h4 className="text-base font-bold text-slate-900">{s.title}</h4>
              <p className="text-xs text-slate-600 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
