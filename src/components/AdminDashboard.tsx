import React, { useState } from 'react';
import { AccessibilityReport, Building, Recommendation } from '../types';
import { api, isRealUserUploadedImage } from '../services/api';
import { AdminLogin } from './AdminLogin';
import { SmartRecommendations } from './SmartRecommendations';
import { FloorMapIngestion } from './FloorMapIngestion';
import { TwinGramVerificationManager } from './TwinGramVerificationManager';
import { 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Building2, 
  BarChart3, 
  Filter, 
  ShieldCheck, 
  AlertTriangle,
  TrendingUp,
  Layers,
  FileCheck,
  Lock,
  Unlock,
  KeyRound,
  Eye,
  EyeOff,
  LogOut,
  Lightbulb,
  Building as BuildingIcon
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell, 
  AreaChart, 
  Area 
} from 'recharts';

interface AdminDashboardProps {
  reports: AccessibilityReport[];
  buildings: Building[];
  recommendations: Recommendation[];
  twingramPosts: any[];
  onReportVerified: (reportId: string, status: 'admin_verified' | 'rejected', notes?: string) => void;
  onReportResolved?: (reportId: string) => void;
  onRecommendationStatusUpdated?: (recId: string, newStatus: 'Pending' | 'In Progress' | 'Completed', reportId?: string) => void;
  onUpdatePostStatus: (postId: string, status: 'verified' | 'fake') => void;
  isAdminLoggedIn: boolean;
  onLoginAdmin: () => void;
  onLogoutAdmin: () => void;
  onCancelLogin?: () => void;
  defaultSubTab?: 'audit-queue' | 'fix-suggestions' | 'map-ingestion' | 'twingram-verification';
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  reports,
  buildings,
  recommendations,
  twingramPosts,
  onReportVerified,
  onReportResolved,
  onRecommendationStatusUpdated,
  onUpdatePostStatus,
  isAdminLoggedIn,
  onLoginAdmin,
  onLogoutAdmin,
  onCancelLogin,
  defaultSubTab = 'audit-queue'
}) => {
  const [adminSubTab, setAdminSubTab] = useState<'audit-queue' | 'fix-suggestions' | 'map-ingestion' | 'twingram-verification'>(defaultSubTab);
  const [selectedBlockId, setSelectedBlockId] = useState<string>('all');
  const [filterState, setFilterState] = useState<string>('active');
  const [adminNotes, setAdminNotes] = useState<{ [id: string]: string }>({});
  const [noteError, setNoteError] = useState<{ [id: string]: string }>({});

  const handleVerify = async (id: string, status: 'admin_verified' | 'rejected') => {
    // Enforce lifecycle guard: only unverified/pending reports can be verified or rejected
    const targetReport = reports.find(r => r.id === id);
    if (!targetReport) return;

    const isResolved = targetReport.status === 'resolved' || targetReport.resolutionStatus === 'resolved';
    const isRejected = (targetReport.status === 'rejected' || targetReport.verificationStatus === 'rejected') && !isResolved;
    const isVerified = (targetReport.verificationStatus === 'admin_verified' || targetReport.verificationStatus === 'verified' || targetReport.status === 'verified') && !isResolved && !isRejected;

    // A report cannot be verified/rejected if it is already resolved, rejected, or verified
    if (isResolved || isRejected || (isVerified && status === 'rejected')) {
      console.warn(`[AdminDashboard] Action disallowed: Cannot transition report ${id} from current state to ${status}`);
      return;
    }

    let rawNote = adminNotes[id]?.trim();

    if (status === 'rejected' && (!rawNote || rawNote.length === 0)) {
      const promptReason = window.prompt('Please enter the mandatory rejection reason / note:');
      if (promptReason && promptReason.trim().length > 0) {
        rawNote = promptReason.trim();
        setAdminNotes(prev => ({ ...prev, [id]: rawNote! }));
      } else {
        setNoteError(prev => ({ ...prev, [id]: 'Rejection reason / note is mandatory when rejecting a report.' }));
        return;
      }
    }

    setNoteError(prev => ({ ...prev, [id]: '' }));
    const notes = rawNote || 'Verified by campus facility manager.';
    await api.verifyReport(id, status, notes);
    onReportVerified(id, status, notes);
  };

  const handleResolve = async (id: string) => {
    // Enforce lifecycle guard: only verified (active) reports can be resolved
    const targetReport = reports.find(r => r.id === id);
    if (!targetReport) return;

    const isResolved = targetReport.status === 'resolved' || targetReport.resolutionStatus === 'resolved';
    const isRejected = (targetReport.status === 'rejected' || targetReport.verificationStatus === 'rejected') && !isResolved;
    const isVerified = (targetReport.verificationStatus === 'admin_verified' || targetReport.verificationStatus === 'verified' || targetReport.status === 'verified') && !isResolved && !isRejected;

    if (!isVerified || isResolved || isRejected) {
      console.warn(`[AdminDashboard] Action disallowed: Cannot resolve unverified, already resolved, or rejected report ${id}`);
      return;
    }

    await api.resolveReport(id);
    if (onReportResolved) {
      onReportResolved(id);
    }
  };

  // Locked Gateway View
  if (!isAdminLoggedIn) {
    return (
      <AdminLogin
        onLoginSuccess={onLoginAdmin}
        onCancel={onCancelLogin || (() => {})}
        requestedTabName={adminSubTab === 'fix-suggestions' ? 'Fix Suggestions Engine' : 'Admin Dashboard'}
      />
    );
  }

  // Filtered reports logic for Admin Dashboard
  const filteredReports = reports.filter(r => {
    const isResolved = r.status === 'resolved' || r.resolutionStatus === 'resolved';
    const isRejected = (r.status === 'rejected' || r.verificationStatus === 'rejected') && !isResolved;
    const isVerified = (r.verificationStatus === 'admin_verified' || r.verificationStatus === 'verified' || r.status === 'verified') && !isResolved && !isRejected;
    const isUnverified = !isVerified && !isResolved && !isRejected;

    if (filterState === 'active') {
      // Active queue: unverified (waiting for Verify) AND verified (waiting for Resolve)
      return isUnverified || isVerified;
    }
    if (filterState === 'pending' || filterState === 'unverified') return isUnverified;
    if (filterState === 'verified') return isVerified;
    if (filterState === 'resolved') return isResolved;
    if (filterState === 'rejected') return isRejected;
    return true; // 'all'
  });

  // Unique Blocks / Buildings list from buildings + reports
  const blockMap = new Map<string, { id: string; name: string; code: string }>();

  buildings.forEach(b => {
    blockMap.set(b.id, { id: b.id, name: b.name, code: b.code });
  });

  reports.forEach(r => {
    if (!blockMap.has(r.buildingId)) {
      blockMap.set(r.buildingId, { id: r.buildingId, name: r.buildingName, code: 'SOA-BLK' });
    }
  });

  const allBlocksList = Array.from(blockMap.values());

  // Filter blocks based on selected block filter
  const visibleBlocks = selectedBlockId === 'all' 
    ? allBlocksList 
    : allBlocksList.filter(b => b.id === selectedBlockId);

  // Statistical Calculations for Admin Verification Suite
  const isResolvedReport = (r: AccessibilityReport) => r.status === 'resolved' || r.resolutionStatus === 'resolved';
  const isRejectedReport = (r: AccessibilityReport) => (r.status === 'rejected' || r.verificationStatus === 'rejected') && !isResolvedReport(r);
  const isVerifiedReport = (r: AccessibilityReport) => (r.verificationStatus === 'admin_verified' || r.verificationStatus === 'verified' || r.status === 'verified' || isResolvedReport(r)) && !isRejectedReport(r);
  const isPendingReport = (r: AccessibilityReport) => !isVerifiedReport(r) && !isRejectedReport(r) && !isResolvedReport(r);

  const totalReportsCount = reports.length;
  const pendingReportsCount = reports.filter(isPendingReport).length;
  const verifiedReportsCount = reports.filter(isVerifiedReport).length;
  const rejectedReportsCount = reports.filter(isRejectedReport).length;
  const solvedReportsCount = reports.filter(isResolvedReport).length;

  // Recharts Chart data
  const statusPieData = [
    { name: 'Accessible / Working', value: reports.filter(r => r.status === 'working').length, color: '#10b981' },
    { name: 'Active Barriers', value: reports.filter(r => r.status === 'broken').length, color: '#ef4444' },
    { name: 'Pending Verification', value: reports.filter(r => r.verificationStatus === 'unverified').length, color: '#f59e0b' },
  ];

  const trendData = [
    { month: 'Reports Status', reports: reports.length, verified: verifiedReportsCount },
  ];

  return (
    <div id="section-admin-dashboard" className="space-y-10">
      {/* Active Admin Session Status Banner */}
      <div className="bg-emerald-900 text-emerald-100 p-4 sm:p-5 rounded-2xl border border-emerald-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-emerald-800 rounded-xl flex items-center justify-center text-emerald-300 shrink-0 shadow-inner">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider block">Administrator Session Unlocked</span>
            </div>
            <p className="text-sm font-bold text-white mt-0.5">SOA Campus Facility Governance & Audit Panel</p>
          </div>
        </div>

        <button
          id="btn-lock-admin-session"
          onClick={onLogoutAdmin}
          className="bg-emerald-950/90 hover:bg-rose-900 text-emerald-200 hover:text-white border border-emerald-700/80 hover:border-rose-700 text-xs font-bold px-3.5 py-2 rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer shrink-0 shadow-xs"
        >
          <LogOut className="w-4 h-4 text-rose-300" />
          <span>Logout</span>
        </button>
      </div>

      {/* Sub-Tab Navigation inside Admin Panel */}
      <div className="flex bg-slate-200/80 p-1.5 rounded-2xl max-w-xl space-x-1 text-xs font-bold">
        <button
          id="btn-admin-subtab-audit"
          onClick={() => setAdminSubTab('audit-queue')}
          className={`flex-1 py-2.5 px-4 rounded-xl transition-all flex items-center justify-center space-x-2 cursor-pointer ${
            adminSubTab === 'audit-queue'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Block-Wise Audit Queue</span>
        </button>

        <button
          id="btn-admin-subtab-fixes"
          onClick={() => setAdminSubTab('fix-suggestions')}
          className={`flex-1 py-2.5 px-4 rounded-xl transition-all flex items-center justify-center space-x-2 cursor-pointer ${
            adminSubTab === 'fix-suggestions'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Lightbulb className="w-4 h-4 text-amber-500" />
          <span>Fix Suggestions (Admin Only)</span>
        </button>
      </div>

      {adminSubTab === 'fix-suggestions' ? (
        <SmartRecommendations
          recommendations={recommendations}
          onStatusUpdated={onRecommendationStatusUpdated || (() => {})}
        />
      ) : (
        <>
          {/* Header Title */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
            <ShieldAlert className="w-4 h-4" />
            <span>Block-Wise Crowdsourced Verification Engine</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Admin Accessibility Verification Suite</h2>
          <p className="text-xs text-slate-500 mt-0.5">Approve or reject crowdsourced barrier tickets grouped block-by-block to keep Digital Twins 100% accurate.</p>
        </div>
      </div>

      {/* Admin Quick Statistics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-5">
        <div id="stat-card-total" className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Reports</span>
          <div className="text-3xl font-black text-slate-900 mt-2">{totalReportsCount}</div>
          <span className="text-[11px] text-blue-600 font-semibold mt-1 block">Logged across campus</span>
        </div>

        <div id="stat-card-pending" className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Pending</span>
          <div className="text-3xl font-black text-amber-600 mt-2">
            {pendingReportsCount}
          </div>
          <span className="text-[11px] text-amber-600 font-semibold mt-1 block">Awaiting admin audit</span>
        </div>

        <div id="stat-card-verified" className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Verified</span>
          <div className="text-3xl font-black text-blue-600 mt-2">
            {verifiedReportsCount}
          </div>
          <span className="text-[11px] text-blue-600 font-semibold mt-1 block">100% confidence set</span>
        </div>

        <div id="stat-card-rejected" className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">Rejected</span>
          <div className="text-3xl font-black text-rose-600 mt-2">
            {rejectedReportsCount}
          </div>
          <span className="text-[11px] text-rose-600 font-semibold mt-1 block">0% confidence set</span>
        </div>

        <div id="stat-card-solved" className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Solved</span>
          <div className="text-3xl font-black text-emerald-600 mt-2">
            {solvedReportsCount}/{verifiedReportsCount}
          </div>
          <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">Verified reports resolved</span>
        </div>
      </div>

      {/* Visual Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Campus Feature Health Breakdown</h3>
              <p className="text-xs text-slate-500">Working accessibility features vs barrier reports</p>
            </div>
            <BarChart3 className="w-5 h-5 text-slate-400" />
          </div>

          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap justify-center gap-4 text-xs font-medium">
            {statusPieData.map((item) => (
              <div key={item.name} className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></span>
                <span className="text-slate-600">{item.name} ({item.value})</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Crowdsourced Activity Growth</h3>
              <p className="text-xs text-slate-500">Monthly student & visitor engagement</p>
            </div>
            <TrendingUp className="w-5 h-5 text-slate-400" />
          </div>

          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip />
                <Area type="monotone" dataKey="reports" stroke="#3b82f6" fill="#dbeafe" name="Total Reports" />
                <Area type="monotone" dataKey="verified" stroke="#10b981" fill="#d1fae5" name="Verified" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Block-Wise Verification Audit Queue */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="flex items-center space-x-2">
              <span className="bg-blue-100 text-blue-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Block-Wise View
              </span>
              <h3 className="text-xl font-bold text-slate-900">Verification Audit Queue</h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Inspect barrier reports organized block-by-block. Confirm repairs to sync Digital Twin maps.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Status filter dropdown */}
            <div className="flex items-center space-x-2 text-xs">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                id="select-admin-queue-filter"
                value={filterState}
                onChange={(e) => setFilterState(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-semibold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="active">Active Queue (Unverified & Verified)</option>
                <option value="pending">Unverified Only</option>
                <option value="verified">Verified (Pending Resolution)</option>
                <option value="resolved">Resolved Issues</option>
                <option value="rejected">Rejected Only</option>
                <option value="all">All Verification Statuses</option>
              </select>
            </div>
          </div>
        </div>

        {/* Block Selector Tabs */}
        <div className="space-y-3">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
            Select Campus Block / Building
          </label>
          <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar pb-2">
            <button
              type="button"
              id="btn-block-filter-all"
              onClick={() => setSelectedBlockId('all')}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedBlockId === 'all'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              🏛️ All Campus Blocks ({reports.length})
            </button>

            {allBlocksList.map((blk) => {
              const countForBlock = reports.filter(r => r.buildingId === blk.id).length;
              const isSel = selectedBlockId === blk.id;
              return (
                <button
                  key={blk.id}
                  type="button"
                  id={`btn-block-filter-${blk.id}`}
                  onClick={() => setSelectedBlockId(blk.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center space-x-1.5 ${
                    isSel
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5 shrink-0" />
                  <span>{blk.name.split('-')[0].trim()}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${isSel ? 'bg-blue-800 text-white' : 'bg-slate-200 text-slate-800'}`}>
                    {countForBlock}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Render Reports Block-Wise */}
        <div className="space-y-8">
          {reports.length === 0 ? (
            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center space-y-3">
              <div className="w-12 h-12 bg-slate-200 text-slate-500 rounded-2xl flex items-center justify-center mx-auto">
                <ShieldAlert className="w-6 h-6 text-slate-400" />
              </div>
              <h4 className="text-base font-bold text-slate-800">No reports received yet.</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                There are currently no accessibility reports or barrier tickets submitted by visitors. Any reports logged will appear here for audit and verification.
              </p>
            </div>
          ) : (
            visibleBlocks.map((blk) => {
            const isResolvedReport = (r: AccessibilityReport) => r.status === 'resolved' || r.resolutionStatus === 'resolved';
            const isRejectedReport = (r: AccessibilityReport) => (r.status === 'rejected' || r.verificationStatus === 'rejected') && !isResolvedReport(r);
            const isVerifiedReport = (r: AccessibilityReport) => (r.verificationStatus === 'admin_verified' || r.verificationStatus === 'verified' || r.status === 'verified') && !isResolvedReport(r) && !isRejectedReport(r);
            const isUnverifiedReport = (r: AccessibilityReport) => !isVerifiedReport(r) && !isResolvedReport(r) && !isRejectedReport(r);

            // Get reports belonging to this specific block AND matching filterState
            const blockReports = filteredReports.filter(r => r.buildingId === blk.id);
            const totalBlockReports = reports.filter(r => r.buildingId === blk.id).length;
            const pendingBlockReports = reports.filter(r => r.buildingId === blk.id && isUnverifiedReport(r)).length;
            const verifiedBlockReports = reports.filter(r => r.buildingId === blk.id && isVerifiedReport(r)).length;

            return (
              <div 
                key={blk.id} 
                id={`block-section-${blk.id}`}
                className="bg-slate-50/70 p-5 sm:p-6 rounded-2xl border border-slate-200/90 space-y-5"
              >
                {/* Block Section Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0 shadow-xs">
                      <BuildingIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="text-base font-bold text-slate-900">{blk.name}</h4>
                        <span className="bg-slate-200 text-slate-700 text-[10px] font-mono px-2 py-0.5 rounded font-bold">
                          {blk.code || 'SOA-BLOCK'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {totalBlockReports} Total Reports logged for this block
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-lg border border-amber-200">
                      {pendingBlockReports} Unverified
                    </span>
                    <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-1 rounded-lg border border-blue-200">
                      {verifiedBlockReports} Verified
                    </span>
                  </div>
                </div>

                {/* Reports inside this block */}
                {blockReports.length === 0 ? (
                  <div className="bg-white p-6 rounded-xl border border-dashed border-slate-300 text-center text-slate-500 text-xs py-8">
                    No reports match the selected filters for this block.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {blockReports.map((rep) => {
                      const isResolved = isResolvedReport(rep);
                      const isRejected = isRejectedReport(rep);
                      const isVerified = isVerifiedReport(rep);
                      const isUnverified = isUnverifiedReport(rep);

                      return (
                      <div key={rep.id} id={`report-card-${rep.id}`} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                          <div className="space-y-0.5">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-sm text-slate-900">{rep.featureName}</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                                rep.status === 'working' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}>
                                {rep.status === 'working' ? 'Accessible' : 'Barrier'}
                              </span>
                              <span className="bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                                👥 Agreed by {rep.confirmationsCount || 1} {(rep.confirmationsCount || 1) === 1 ? 'user' : 'users'}
                              </span>
                            </div>
                            <span className="text-xs text-slate-500 block">{rep.buildingName} • {rep.floorName}</span>
                          </div>

                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-slate-500">Reporter: <strong className="text-slate-800">{rep.reporterName}</strong></span>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                              isResolved ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                              isVerified ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                              isRejected ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                              'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}>
                              {isResolved ? '🟢 Resolved' :
                               isVerified ? '✓ Verified (100% Confidence)' :
                               isRejected ? '🔴 Rejected (0% Confidence)' :
                               `⏱️ Unverified (${rep.confidenceScore}% Confidence)`}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                          <div className="md:col-span-2 space-y-2">
                            <p className="text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200">{rep.description}</p>
                            
                            {/* Verification notes input */}
                            <div className="space-y-1">
                              <label htmlFor={`input-notes-${rep.id}`} className="text-[10px] font-bold text-slate-500 uppercase">
                                Admin Verification Notes {isUnverified && <span className="text-rose-500 font-normal">(Required for rejection)</span>}
                              </label>
                              <input
                                id={`input-notes-${rep.id}`}
                                type="text"
                                placeholder="Add facility manager verification notes (e.g., Physical inspection confirmed)..."
                                value={adminNotes[rep.id] !== undefined ? adminNotes[rep.id] : (rep.adminNotes || '')}
                                onChange={(e) => {
                                  setAdminNotes({ ...adminNotes, [rep.id]: e.target.value });
                                  if (noteError[rep.id]) setNoteError({ ...noteError, [rep.id]: '' });
                                }}
                                className={`w-full bg-white border rounded-xl px-3 py-1.5 text-xs focus:outline-none ${
                                  noteError[rep.id] ? 'border-rose-500 ring-2 ring-rose-500/20' : 'border-slate-200 focus:border-blue-500'
                                }`}
                              />
                              {noteError[rep.id] && (
                                <p className="text-[11px] text-rose-600 font-bold mt-1">
                                  ⚠️ {noteError[rep.id]}
                                </p>
                              )}
                            </div>

                            {(rep.rejectionNote || rep.adminNotes) && !noteError[rep.id] && (
                              <p className={`text-[11px] p-2.5 rounded-xl font-medium border ${
                                isRejected
                                  ? 'text-rose-900 bg-rose-50 border-rose-200'
                                  : 'text-blue-900 bg-blue-50 border-blue-200'
                              }`}>
                                <strong>{isRejected ? 'Rejection Reason / Note:' : 'Recorded Admin Note:'}</strong> {rep.rejectionNote || rep.adminNotes}
                              </p>
                            )}
                          </div>

                          {isRealUserUploadedImage(rep.photoUrl) && (
                            <div className="rounded-xl overflow-hidden border border-slate-200 max-h-32 bg-slate-100 relative group">
                              <img src={rep.photoUrl} alt="Report proof" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] px-1.5 py-0.5 rounded font-mono">Photo Proof</span>
                            </div>
                          )}
                        </div>

                        {/* Action Buttons & Status Indicators */}
                        <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                          {isResolved ? (
                            <span id={`status-resolved-${rep.id}`} className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 flex items-center space-x-1.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              <span>Status: Resolved</span>
                            </span>
                          ) : isRejected ? (
                            <span id={`status-rejected-${rep.id}`} className="text-xs font-bold text-rose-700 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200">
                              Status: Rejected
                            </span>
                          ) : isVerified ? (
                            <div className="flex items-center space-x-2">
                              {!isRealUserUploadedImage(rep.photoUrl) ? (
                                <button
                                  type="button"
                                  id={`btn-resolve-report-${rep.id}`}
                                  onClick={() => handleResolve(rep.id)}
                                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-1.5 rounded-lg transition-colors flex items-center space-x-1 cursor-pointer shadow-xs"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                  <span>Resolve</span>
                                </button>
                              ) : (
                                <span id={`status-fix-suggestion-${rep.id}`} className="text-xs font-semibold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 flex items-center space-x-1.5">
                                  <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                                  <span>Managed in Fix Suggestions</span>
                                </span>
                              )}
                            </div>
                          ) : (
                            /* isUnverified / Pending */
                            <div className="flex items-center space-x-2">
                              <button
                                type="button"
                                id={`btn-reject-report-${rep.id}`}
                                onClick={() => handleVerify(rep.id, 'rejected')}
                                className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                              >
                                Reject
                              </button>
                              <button
                                type="button"
                                id={`btn-verify-report-${rep.id}`}
                                onClick={() => handleVerify(rep.id, 'admin_verified')}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-1.5 rounded-lg transition-colors flex items-center space-x-1 cursor-pointer shadow-xs"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Verify</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                    })}
                  </div>
                )}
              </div>
            );
          }))}
        </div>
      </div>
        </>
      )}
    </div>
  );
};
