import React, { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { Building, AccessibilityFeature, AccessibilityReport, Recommendation, RouteResult } from './types';
import { api } from './services/api';
import { supabase, isSupabaseConfigured, signOutAdminFromSupabase, checkIsAdminUser } from './lib/supabase';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { HomeDashboard } from './components/HomeDashboard';
import { DigitalTwinMap } from './components/DigitalTwinMap';
import { ReportIssue } from './components/ReportIssue';
import { AiDetection } from './components/AiDetection';
import { AccessibleNavigation } from './components/AccessibleNavigation';
import { AdminDashboard } from './components/AdminDashboard';
import { BuildingScoreCard } from './components/BuildingScoreCard';
import { TwinGramPage } from './components/TwinGramPage';
import { TwinGramPostDetail } from './components/TwinGramPostDetail';
import { HowItWorksModal } from './components/HowItWorksModal';
import { AuthModal } from './components/AuthModal';
import { ProfilePage } from './components/ProfilePage';
import { getDefaultAvatarUrl } from './lib/avatar';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [sharedPostId, setSharedPostId] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith('/twingram/post/')) {
      const postId = path.split('/')[3];
      if (postId) {
        setSharedPostId(postId);
        setActiveTab('twingram');
      }
    }
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (data) {
      if (!data.avatar_url) {
        const defaultUrl = getDefaultAvatarUrl();
        await supabase
          .from('user_profiles')
          .update({ avatar_url: defaultUrl })
          .eq('id', userId);
        setProfile({ ...data, avatar_url: defaultUrl });
      } else {
        setProfile(data);
      }
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user?.id) fetchProfile(session.user.id);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user?.id) fetchProfile(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [homeBuildings, setHomeBuildings] = useState<Building[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [features, setFeatures] = useState<AccessibilityFeature[]>([]);
  const [reports, setReports] = useState<AccessibilityReport[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [activeRoute, setActiveRoute] = useState<RouteResult | null>(null);
  const [accessibilityFeaturesCount, setAccessibilityFeaturesCount] = useState<number>(0);
  const [adminReportsCount, setAdminReportsCount] = useState<number>(0);
  const [verifiedReportsCount, setVerifiedReportsCount] = useState<number>(0);
  const [twingramPosts, setTwingramPosts] = useState<any[]>([]);

  const [prefilledLocation, setPrefilledLocation] = useState<{ buildingId: string; floorId: number; x: number; y: number } | null>(null);
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState<boolean>(false);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(false);

  // Initialize Supabase Auth state listener and check active session
  useEffect(() => {
    async function checkAdminAuth() {
      if (isSupabaseConfigured()) {
        try {
          const { data } = await supabase.auth.getSession();
          if (data.session?.user) {
            const isAdmin = await checkIsAdminUser();
            setIsAdminLoggedIn(isAdmin);
            return;
          }
        } catch (e) {
          console.warn('Supabase session check error:', e);
        }
      }
      setIsAdminLoggedIn(false);
    }

    checkAdminAuth();

    // Subscribe to Supabase Auth state changes
    if (isSupabaseConfigured()) {
      const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          const isAdmin = await checkIsAdminUser();
          setIsAdminLoggedIn(isAdmin);
        } else {
          setIsAdminLoggedIn(false);
        }
      });

      return () => {
        authListener.subscription.unsubscribe();
      };
    }
  }, []);

  const handleLoginAdmin = async () => {
    // If a normal user is logged in, sign them out first
    if (session) {
      await supabase.auth.signOut();
      // App.tsx state will update automatically via onAuthStateChange listener
      setSession(null);
      setProfile(null);
    }
    setIsAdminLoggedIn(true);
  };

  const handleLogoutAdmin = async () => {
    await signOutAdminFromSupabase();
    setIsAdminLoggedIn(false);
    
    // Explicitly clear any stale session/profile data
    setSession(null);
    setProfile(null);
    
    setActiveTab('dashboard');
  };

  // Load initial data
  useEffect(() => {
    async function loadInitialData() {
      // 1. Fetch buildings essential for the dashboard
      const sBuildings = await api.getSupabaseBuildings();
      const bList = await api.getBuildings();
      
      const allBuildings = sBuildings && sBuildings.length > 0 ? sBuildings : (bList || []);
      
      if (allBuildings.length > 0) {
        setBuildings(allBuildings);
        setHomeBuildings(sBuildings || []);
        
        // Select first building if none selected
        if (!selectedBuilding) {
          setSelectedBuilding(allBuildings[0]);
        }
      }
      
      // 2. Fetch other data asynchronously (not blocking the initial building load)
      Promise.all([
        api.getReports().then(r => r && setReports(r)),
        api.getRecommendations().then(r => r && setRecommendations(r)),
        api.getAccessibilityFeaturesCount().then(setAccessibilityFeaturesCount),
        api.getAdminReportsCount().then(count => {
          setAdminReportsCount(count);
          api.getReportsCount().then(total => setVerifiedReportsCount(Math.max(0, total - count)));
        }),
        api.getTwinGramPosts().then(posts => setTwingramPosts(posts))
      ]).catch(err => console.error('Error loading non-essential data:', err));
    }
    loadInitialData();
  }, []);

  // Update floors and features whenever selected building changes
  useEffect(() => {
    console.log('[DEBUG] App.tsx - selectedBuilding:', selectedBuilding);
    async function updateBuildingData() {
      if (!selectedBuilding) {
        console.log('[DEBUG] App.tsx - No selected building');
        return;
      }
      
      console.log('[DEBUG] App.tsx - Fetching floors for:', selectedBuilding.id);
      const fList = await api.getFloorsForBuilding(selectedBuilding.id);
      console.log('[DEBUG] App.tsx - Floors fetched:', fList);
      
      // Fetch rooms for each floor
      const floorsWithRooms = await Promise.all(
        fList.map(async (f) => {
          const rooms = await api.getRoomsForFloor(String(f.floorId), selectedBuilding.id);
          return { ...f, rooms };
        })
      );
      
      console.log('[DEBUG] App.tsx - Floors with rooms:', floorsWithRooms);
      setSelectedBuilding(prev => ({ ...prev, floors: floorsWithRooms }));
      setBuildings(prev => prev.map(b => b.id === selectedBuilding.id ? { ...b, floors: floorsWithRooms } : b));

      const featuresList = await api.getFeatures(selectedBuilding.id);
      console.log('[DEBUG] App.tsx - Features fetched:', featuresList);
      if (featuresList) setFeatures(featuresList);
    }
    updateBuildingData();
  }, [selectedBuilding?.id]);

  const handleReportIssueAtLocation = (bId: string, floorId: number, x: number, y: number) => {
    setPrefilledLocation({ buildingId: bId, floorId, x, y });
    setActiveTab('report-issue');
  };

  const handleReportSubmitted = (newReport: AccessibilityReport) => {
    setReports(prev => {
      const idx = prev.findIndex(r => r.id === newReport.id);
      if (idx !== -1) {
        const updated = [...prev];
        updated[idx] = newReport;
        return updated;
      }
      return [newReport, ...prev];
    });
  };

  const handleReportVerified = async (reportId: string, status: 'admin_verified' | 'rejected', notes?: string) => {
    const isVerified = status === 'admin_verified';
    setReports(prev => prev.map(r => {
      if (r.id === reportId) {
        return {
          ...r,
          status: isVerified ? 'verified' : 'rejected',
          resolutionStatus: 'pending',
          verificationStatus: isVerified ? 'admin_verified' : 'rejected',
          confidenceScore: isVerified ? 100 : 0,
          confidenceLevel: isVerified ? 'HIGH' : 'LOW',
          adminNotes: notes,
          rejectionNote: !isVerified ? notes : r.rejectionNote,
        };
      }
      return r;
    }));

    // If verified as accessible or barrier, update matching feature confidence and refresh recommendations
    const rep = reports.find(r => r.id === reportId);
    if (rep && status === 'admin_verified') {
      setFeatures(prev => prev.map(f => {
        if (f.buildingId === rep.buildingId && f.floorId === rep.floorId && f.name === rep.featureName) {
          return {
            ...f,
            verificationStatus: 'admin_verified',
            confidenceScore: 100,
            confidenceLevel: 'HIGH',
          };
        }
        return f;
      }));

      // Refresh fix recommendations state so newly analyzed suggestion appears immediately in Fix Suggestions
      try {
        const updatedRecs = await api.getRecommendations();
        if (updatedRecs) {
          setRecommendations(updatedRecs);
        }
      } catch (err) {
        console.warn('Error refreshing recommendations after report verification:', err);
      }
    }
  };

  const handleUpdatePostStatus = (postId: string, status: 'verified' | 'fake') => {
    setTwingramPosts(prev => prev.map(p => p.id === postId ? { ...p, verification_status: status } : p));
  };

  const handleReportResolved = (reportId: string) => {
    setReports(prev => prev.map(r => {
      if (r.id === reportId) {
        return {
          ...r,
          status: 'resolved',
          resolutionStatus: 'resolved',
          verificationStatus: 'admin_verified',
          confidenceScore: 100,
          confidenceLevel: 'HIGH',
        };
      }
      return r;
    }));

    const rep = reports.find(r => r.id === reportId);
    if (rep) {
      setFeatures(prev => prev.map(f => {
        if (f.buildingId === rep.buildingId && f.floorId === rep.floorId && f.name === rep.featureName) {
          return {
            ...f,
            verificationStatus: 'admin_verified',
            confidenceScore: 100,
            confidenceLevel: 'HIGH',
            status: 'working'
          };
        }
        return f;
      }));
    }
  };

  const handleFeatureAddedToTwin = (newFeature: AccessibilityFeature) => {
    setFeatures(prev => {
      const idx = prev.findIndex(f => f.id === newFeature.id);
      if (idx !== -1) {
        const updated = [...prev];
        updated[idx] = newFeature;
        return updated;
      }
      return [newFeature, ...prev];
    });
  };

  const handleAddDetectedFeatureToTwin = (label: string, type: any, confidence: number) => {
    const newFeature: AccessibilityFeature = {
      id: `feat-ai-${Date.now()}`,
      buildingId: selectedBuilding?.id || '',
      floorId: 0,
      name: `${label} (AI Detected)`,
      type: type || 'ramp',
      status: 'working',
      x: 45 + Math.floor(Math.random() * 20),
      y: 45 + Math.floor(Math.random() * 20),
      description: `Automatically identified from uploaded photo with ${confidence}% confidence score by computer vision pipeline.`,
      confidenceScore: confidence,
      confidenceLevel: confidence >= 70 ? 'HIGH' : 'MEDIUM',
      verificationStatus: 'community_verified',
      lastUpdated: new Date().toISOString().split('T')[0],
      upvotes: 1
    };

    setFeatures(prev => [newFeature, ...prev]);
  };

  const handleRecommendationStatusUpdated = (recId: string, newStatus: 'Pending' | 'In Progress' | 'Completed', reportId?: string) => {
    if (newStatus === 'Completed') {
      // 1. Remove that Fix Suggestion card from active recommendations list
      setRecommendations(prev => prev.filter(r => r.id !== recId && r.reportId !== recId));

      // 2. Mark original report as Solved / resolved
      const targetRepId = reportId || recommendations.find(r => r.id === recId || r.reportId === recId)?.reportId;
      if (targetRepId) {
        handleReportResolved(targetRepId);
      }
    } else {
      setRecommendations(prev => prev.map(r => (r.id === recId || r.reportId === recId) ? { ...r, status: newStatus } : r));
    }
  };

  const handleSelectBuilding = (buildingId: string) => {
    const building = homeBuildings.find(b => b.id === buildingId) || null;
    setSelectedBuilding(building);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col antialiased selection:bg-blue-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenHowItWorks={() => setIsHowItWorksOpen(true)}
        isAdminLoggedIn={isAdminLoggedIn}
        onLogoutAdmin={handleLogoutAdmin}
        onSelectBuilding={handleSelectBuilding}
        selectedBuildingId={selectedBuilding?.id || null}
        buildings={buildings}
        session={session}
        profile={profile}
        onOpenAuth={() => setShowAuthModal(true)}
      />

      {/* Main Content Viewport Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'profile' && session && (
          <ProfilePage user={session.user} profile={profile} refreshProfile={() => fetchProfile(session.user.id)} isAdmin={isAdminLoggedIn} />
        )}

        {activeTab === 'twingram' && (
          sharedPostId ? (
            <TwinGramPostDetail postId={sharedPostId} session={session} onOpenAuth={() => setShowAuthModal(true)} isAdmin={isAdminLoggedIn} />
          ) : (
            <TwinGramPage session={session} onOpenAuth={() => setShowAuthModal(true)} isAdmin={isAdminLoggedIn} />
          )
        )}

        {activeTab === 'dashboard' && (
          <HomeDashboard
            buildings={buildings}
            homeBuildings={homeBuildings}
            selectedBuilding={selectedBuilding}
            reports={reports}
            accessibilityFeaturesCount={accessibilityFeaturesCount}
            adminReportsCount={adminReportsCount}
            verifiedReportsCount={verifiedReportsCount}
            onSelectBuilding={(b) => setSelectedBuilding(b)}
            onNavigateToTab={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'digital-twin' && (
          <DigitalTwinMap
            building={selectedBuilding}
            features={features}
            activeRoute={activeRoute}
            onReportIssueAtLocation={handleReportIssueAtLocation}
            onOpenReportTab={() => setActiveTab('report-issue')}
            onNavigateToRoute={() => setActiveTab('navigation')}
          />
        )}

        {activeTab === 'report-issue' && (
          <ReportIssue
            buildings={buildings}
            selectedBuilding={selectedBuilding}
            reports={reports}
            onReportSubmitted={handleReportSubmitted}
            prefilledLocation={prefilledLocation}
          />
        )}

        {activeTab === 'ai-detection' && (
          <AiDetection
            isAdmin={isAdminLoggedIn}
            buildings={buildings}
            onFeatureAddedToTwin={handleFeatureAddedToTwin}
            onAddDetectedFeatureToTwin={handleAddDetectedFeatureToTwin}
          />
        )}

        {activeTab === 'navigation' && (
          <AccessibleNavigation
            building={selectedBuilding}
            onRouteCalculated={(route) => setActiveRoute(route)}
            onViewOnDigitalTwin={() => setActiveTab('digital-twin')}
          />
        )}

        {activeTab === 'admin' && (
          <AdminDashboard
            reports={reports}
            buildings={buildings}
            recommendations={recommendations}
            twingramPosts={twingramPosts}
            onReportVerified={handleReportVerified}
            onReportResolved={handleReportResolved}
            onRecommendationStatusUpdated={handleRecommendationStatusUpdated}
            onUpdatePostStatus={handleUpdatePostStatus}
            isAdminLoggedIn={isAdminLoggedIn}
            onLoginAdmin={handleLoginAdmin}
            onLogoutAdmin={handleLogoutAdmin}
            onCancelLogin={() => setActiveTab('dashboard')}
            defaultSubTab="audit-queue"
          />
        )}

        {activeTab === 'recommendations' && (
          <AdminDashboard
            reports={reports}
            buildings={buildings}
            recommendations={recommendations}
            twingramPosts={twingramPosts}
            onReportVerified={handleReportVerified}
            onReportResolved={handleReportResolved}
            onRecommendationStatusUpdated={handleRecommendationStatusUpdated}
            onUpdatePostStatus={handleUpdatePostStatus}
            isAdminLoggedIn={isAdminLoggedIn}
            onLoginAdmin={handleLoginAdmin}
            onLogoutAdmin={handleLogoutAdmin}
            onCancelLogin={() => setActiveTab('dashboard')}
            defaultSubTab="fix-suggestions"
          />
        )}
      </main>

      {/* Footer */}
      <Footer 
        onOpenAdminLogin={() => setActiveTab('admin')} 
        onNavigateToTwinMap={() => setActiveTab('digital-twin')}
        onNavigateToTab={(tab) => setActiveTab(tab)} 
      />

      {/* Educational How It Works Modal */}
      <HowItWorksModal
        isOpen={isHowItWorksOpen}
        onClose={() => setIsHowItWorksOpen(false)}
      />
      {/* Auth Modal */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
}
