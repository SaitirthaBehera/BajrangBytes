import React from 'react';
import { Session } from '@supabase/supabase-js';
import { 
  Building2, 
  Map, 
  AlertTriangle, 
  Scan, 
  Navigation, 
  ShieldCheck,
  Lock,
  BarChart3,
  HelpCircle,
  Zap,
  Camera,
  User
} from 'lucide-react';
import { Building } from '../types';
import { BuildingSelector } from './BuildingSelector';
import { UserMenu } from './UserMenu';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenHowItWorks: () => void;
  isAdminLoggedIn?: boolean;
  onLogoutAdmin?: () => void;
  onSelectBuilding: (buildingId: string) => void;
  selectedBuildingId: string | null;
  buildings: Building[];
  session: Session | null;
  onOpenAuth: () => void;
  profile: any;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenHowItWorks,
  isAdminLoggedIn = false,
  onLogoutAdmin,
  onSelectBuilding,
  selectedBuildingId,
  buildings,
  session,
  onOpenAuth,
  profile
}) => {
  // Navigation tabs visible in the main navbar
  const navItems = [
    { id: 'dashboard', label: 'Home', icon: Building2 },
    { id: 'digital-twin', label: 'Digital Twin Map', icon: Map },
    { id: 'report-issue', label: 'Report Issue', icon: AlertTriangle },
    { id: 'ai-detection', label: 'AI Detection', icon: Scan },
    { id: 'navigation', label: 'Accessible Route', icon: Navigation },
    { id: 'admin', label: 'Admin Dashboard', icon: ShieldCheck },
  ];

  return (
    <header id="main-navbar" className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      {/* ... top banner ... */}
      {/* Top Banner */}
      <div className="bg-indigo-900 text-white px-4 py-1.5 text-xs flex flex-wrap justify-between items-center">
        <div className="flex items-center space-x-2">
          <span className="bg-indigo-700 font-semibold px-2 py-0.5 rounded text-[10px] uppercase tracking-wider">
            SOAIDEATHON S37
          </span>
          <span className="hidden md:inline font-medium text-indigo-100">
            Crowdsourced Accessibility Digital Twin for Public Buildings
          </span>
        </div>
        <div className="flex items-center space-x-4">
          <button 
            id="btn-how-it-works"
            onClick={onOpenHowItWorks}
            className="flex items-center space-x-1 hover:text-indigo-200 transition-colors text-xs font-medium cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>How AccessTwin Works</span>
          </button>
          <span className="hidden sm:inline-block text-indigo-300">|</span>
          <div className="flex items-center space-x-1.5 text-indigo-200">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-[11px]">SOA Campus Online</span>
          </div>
        </div>
      </div>

      {/* Main Header Row */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Tagline */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-xl font-bold text-slate-900 tracking-tight">Access</span>
                <span className="text-xl font-bold text-blue-600 tracking-tight">Twin</span>
                <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-200">
                  v2.0
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium hidden sm:block">
                Making Every Building Accessible.
              </p>
            </div>
          </div>

          {/* Controls: TwinGram → Building Dropdown → Sign In → Admin Login */}
          <div className="flex items-center space-x-3">
            <button
              id="btn-nav-twingram"
              onClick={() => setActiveTab('twingram')}
              className="flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3 py-1.5 rounded-lg border border-slate-200 transition-all cursor-pointer shadow-2xs"
            >
              <Camera className="w-3.5 h-3.5 text-slate-500" />
              <span>TwinGram</span>
            </button>
            <BuildingSelector 
              selectedBuildingId={selectedBuildingId}
              onSelect={onSelectBuilding}
              buildings={buildings}
            />
            
            {session ? (
              <UserMenu user={session.user} profile={profile} setActiveTab={setActiveTab} />
            ) : (
              <button
                id="btn-nav-user-signin"
                onClick={onOpenAuth}
                className="flex items-center space-x-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs px-3 py-1.5 rounded-lg border border-blue-200 transition-all cursor-pointer shadow-2xs"
              >
                <User className="w-3.5 h-3.5 text-blue-500" />
                <span>Sign In</span>
              </button>
            )}
            
            {isAdminLoggedIn ? (
              <button
                id="btn-nav-admin-logout"
                onClick={onLogoutAdmin}
                className="flex items-center space-x-1.5 bg-emerald-100 hover:bg-rose-100 text-emerald-800 hover:text-rose-800 border border-emerald-200 hover:border-rose-300 font-bold text-xs px-3 py-1.5 rounded-lg transition-all cursor-pointer shadow-2xs"
                title="Sign out of Admin Mode"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span className="hidden sm:inline">Admin Mode (Sign Out)</span>
                <span className="sm:hidden">Admin</span>
              </button>
            ) : (
              <button
                id="btn-nav-admin-login"
                onClick={() => setActiveTab('admin')}
                className="flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3 py-1.5 rounded-lg border border-slate-200 transition-all cursor-pointer shadow-2xs"
              >
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                <span>Admin Login</span>
              </button>
            )}
          </div>
        </div>
        {/* Navigation Tabs Bar */}
        <nav id="nav-tab-list" className="flex items-center space-x-1 overflow-x-auto no-scrollbar border-t border-slate-100 py-2 text-xs font-medium">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-tab-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200/60 shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
