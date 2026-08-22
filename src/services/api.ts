import { Building, AccessibilityFeature, AccessibilityReport, Recommendation, DisabilityProfile, RouteResult, AiDetectionResult, VerificationStatus, ConfidenceLevel, BuildingFloor, BuildingRoom, FloorMap } from '../types';
import { calculateAccessibleRoute } from '../utils/navigation';
import { supabase, isSupabaseConfigured, signInAdminWithSupabase } from '../lib/supabase';
import { MOCK_BUILDINGS, MOCK_REPORTS, MOCK_NODES, MOCK_EDGES, MOCK_RECOMMENDATIONS } from '../data/mockData';

// In-memory state only for static building features & recommendations
let localFeatures: AccessibilityFeature[] = [];
let localRecommendations: Recommendation[] = [];

// Safe UUID Generator compatible with all browser & Node runtimes
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// UUID validation helper to prevent PostgreSQL syntax errors
function isUUID(str?: string): boolean {
  return typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim());
}

// Known demo or default placeholder image patterns to strictly exclude from user uploads
export const KNOWN_DEMO_IMAGES = [
  'photo-1584467735871-8e85353a8413',
  'https://images.unsplash.com/photo-1584467735871-8e85353a8413'
];

export function isRealUserUploadedImage(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed.length === 0 || trimmed === 'null' || trimmed === 'undefined') return false;
  if (KNOWN_DEMO_IMAGES.some(demo => trimmed.includes(demo))) return false;
  return true;
}

// Helper to parse location coordinate object
function parseLocation(loc: any): { x: number; y: number } {
  if (loc && typeof loc === 'object' && typeof loc.x === 'number') {
    return { x: loc.x, y: loc.y };
  }
  if (typeof loc === 'string') {
    try {
      const parsed = JSON.parse(loc);
      if (parsed && typeof parsed.x === 'number') return { x: parsed.x, y: parsed.y };
    } catch {}
  }
  return { x: 50, y: 50 };
}

// Helper to map a raw Supabase public.reports row to AccessibilityReport
function mapSupabaseReportToModel(d: any): AccessibilityReport {
  const isResolved = d.status === 'resolved' || d.resolution_status === 'resolved';
  const isRejected = (d.verification_status === 'rejected' || d.status === 'rejected') && !isResolved;
  const isVerified = (
    d.verification_status === 'admin_verified' || 
    d.verification_status === 'verified' || 
    d.verified === true ||
    d.status === 'verified'
  ) && !isResolved && !isRejected;

  const rawPhoto = d.image_url || d.photo_url;
  const validPhoto = isRealUserUploadedImage(rawPhoto) ? rawPhoto : undefined;

  return {
    id: String(d.id),
    buildingId: d.building_id || 'bldg-iter-main',
    buildingName: d.building_name || 'SOA ITER Academic Block C',
    featureName: d.feature_name || 'Reported Location',
    featureType: d.feature_type || 'other',
    status: isResolved ? 'resolved' : isVerified ? 'verified' : isRejected ? 'rejected' : (d.status || d.issue_type || 'broken'),
    description: d.description || '',
    floorId: Number(d.floor_id ?? 0),
    floorName: d.floor_name || d.floor || 'Ground Floor',
    location: parseLocation(d.location),
    photoUrl: validPhoto,
    submittedAt: d.submitted_at || d.created_at || new Date().toISOString(),
    reporterName: d.reporter_name || 'Anonymous Campus Reporter',
    verificationStatus: (isVerified || isResolved ? 'admin_verified' : isRejected ? 'rejected' : 'unverified') as VerificationStatus,
    resolutionStatus: (isResolved ? 'resolved' : 'pending') as 'pending' | 'resolved',
    confidenceScore: (isVerified || isResolved) ? 100 : isRejected ? 0 : Number(d.confidence_score ?? 40),
    confidenceLevel: ((isVerified || isResolved) ? 'HIGH' : isRejected ? 'LOW' : (d.confidence_level || 'LOW')) as ConfidenceLevel,
    confirmationsCount: Number(d.reporter_count ?? d.confirmations_count ?? 1),
    adminNotes: d.admin_notes || d.rejection_note || undefined,
    rejectionNote: d.rejection_note || d.admin_notes || undefined,
    verifiedBy: d.verified_by || undefined,
    verifiedAt: d.verified_at || undefined,
    rejectedBy: d.rejected_by || undefined,
    rejectedAt: d.rejected_at || undefined,
  };
}

// Helper to obtain Supabase session access token
const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  
  if (isSupabaseConfigured()) {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) {
      headers['Authorization'] = `Bearer ${data.session.access_token}`;
    }
  }
  return headers;
};

export const api = {
  /**
   * Admin Authentication strictly via Supabase Auth Email & Password
   */
  async adminLogin(email: string, password?: string): Promise<{ success: boolean; token?: string; error?: string }> {
    if (!password) {
      return { success: false, error: 'Password is required' };
    }

    const result = await signInAdminWithSupabase(email.trim(), password);
    if (result.success && result.session) {
      return { success: true, token: result.session.access_token };
    }
    return { success: false, error: result.error || 'Invalid administrator credentials' };
  },

  async verifyAdminToken(): Promise<boolean> {
    if (isSupabaseConfigured()) {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) {
          return true;
        }
      } catch (e) {
        console.warn('Supabase token verification error:', e);
      }
    }
    return false;
  },

  async getBuildings(): Promise<Building[]> {
    return MOCK_BUILDINGS;
  },

  async getSupabaseBuildings(): Promise<Building[]> {
    if (isSupabaseConfigured()) {
      try {
        const { data } = await supabase.from('buildings').select('*');
        console.log('[DEBUG] getSupabaseBuildings data:', data);
        if (data && data.length > 0) {
          return data.map((b: any) => {
            console.log('[DEBUG] Building:', b.building_name, 'image_url:', b.image_url);
            return {
              id: String(b.building_id || b.id),
              name: b.building_name || b.name || 'Building',
              code: b.building_code || 'BLDG',
              campus: b.campus || 'SOA Campus',
              address: b.address || '',
              floorsCount: Number(b.floors_count || 0),
              overallScore: Number(b.overall_score || 0),
              imageUrl: b.image_url || '',
              description: b.description || '',
              floors: [],
              scores: {
                wheelchair: 90,
                visual: 88,
                hearing: 85,
                signage: 92,
                restrooms: 89,
                navigation: 94
              }
            };
          });
        }
      } catch (e) {
        console.warn('Error loading buildings from Supabase:', e);
      }
    }
    return [];
  },

  async getFloorsForBuilding(buildingId: string): Promise<BuildingFloor[]> {
    if (!isSupabaseConfigured()) return [];
    try {
      const { data, error } = await supabase
        .from('floors')
        .select('*')
        .eq('building_id', buildingId);
      if (error) {
        console.error('[DEBUG] API - Floors error:', error);
        throw error;
      }
      console.log('[DEBUG] API - Floors data:', data);
      return (data || []).map((f: any) => ({
        floorId: f.floor_id,
        buildingId: f.building_id,
        name: f.floor_name || `Floor ${f.floor_number}`,
        rooms: [], // Will fetch rooms separately if needed
        dimensions: { width: 1000, height: 600 }
      }));
    } catch (e) {
      console.warn('Error fetching floors from Supabase:', e);
      return [];
    }
  },

  async getRoomsForFloor(floorId: string, buildingId: string): Promise<BuildingRoom[]> {
    if (!isSupabaseConfigured()) return [];
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('floor_id', floorId);
      if (error) {
        console.error('[DEBUG] API - Rooms error:', error);
        throw error;
      }
      return (data || []).map((r: any) => {
        console.log("RAW SUPABASE ROOM", r);
        const transformed = {
          id: r.room_id || r.id,
          name: r.room_name || 'Room',
          category: r.category || 'other',
          x: Number(r.x),
          y: Number(r.y),
          width: Number(r.width),
          height: Number(r.height),
          isAccessible: r.is_accessible || false
        };
        console.log("TRANSFORMED ROOM", transformed);
        return transformed;
      });
    } catch (e) {
      console.warn('Error fetching rooms from Supabase:', e);
      return [];
    }
  },

  async getFeatures(buildingId: string): Promise<AccessibilityFeature[]> {
    // This seems to be used for the dashboard features, not the map features
    return localFeatures.filter(f => f.buildingId === buildingId);
  },

  async getFloorMap(buildingId: string, floorId: string): Promise<FloorMap | null> {
    if (!isSupabaseConfigured()) return null;
    console.log('[DEBUG] API - Fetching floor map:', buildingId, floorId);
    try {
      const { data, error } = await supabase
        .from('floor_maps')
        .select('*')
        .eq('building_id', buildingId)
        .eq('floor_id', floorId)
        .maybeSingle();
      if (error) {
        console.error('[DEBUG] API - Floor map error:', error);
        throw error;
      }
      console.log('[DEBUG] API - Floor map data:', data);
      if (!data) return null;
      return {
        mapId: data.map_id,
        buildingId: data.building_id,
        floorId: data.floor_id,
        imageUrl: data.image_url,
        width: data.width,
        height: data.height
      };
    } catch (e) {
      console.warn('Error fetching floor map:', e);
      return null;
    }
  },

  async getAccessibilityFeaturesCount(): Promise<number> {
    if (!isSupabaseConfigured()) return 0;
    try {
      const { data, error } = await supabase
        .from('accessibility_features')
        .select('*');
      if (error) {
        console.error('[DEBUG] API - Accessibility features count error:', error);
        throw error;
      }
      
      // Defensive check: if no data, return 0 instead of processing
      if (!data || !Array.isArray(data)) {
        console.warn('[DEBUG] API - Accessibility features data missing or invalid');
        return 0;
      }

      // System columns to exclude from counting
      const systemColumns = ['id', 'building_id', 'floor_id', 'feature_geometry', 'updated_at', 'created_at'];
      
      let totalPresentCount = 0;
      data.forEach(row => {
        Object.keys(row).forEach(key => {
          if (!systemColumns.includes(key) && row[key] === 'present') {
            totalPresentCount++;
          }
        });
      });
      return totalPresentCount;
    } catch (e) {
      console.warn('Error fetching accessibility features count:', e);
      return 0;
    }
  },

  async getAdminReportsCount(): Promise<number> {
    if (!isSupabaseConfigured()) return 0;
    try {
      const { count, error } = await supabase
        .from('admin_reports')
        .select('*', { count: 'exact', head: true });
      if (error) {
        console.error('[DEBUG] API - Admin reports count error:', error);
        throw error;
      }
      return count || 0;
    } catch (e) {
      console.warn('Error fetching admin reports count:', e);
      return 0;
    }
  },

  async getReportsCount(): Promise<number> {
    if (!isSupabaseConfigured()) return 0;
    try {
      const { count, error } = await supabase
        .from('reports')
        .select('*', { count: 'exact', head: true });
      if (error) {
        console.error('[DEBUG] API - Reports count error:', error);
        throw error;
      }
      return count || 0;
    } catch (e) {
      console.warn('Error fetching reports count:', e);
      return 0;
    }
  },

  async getAvailableFeatureColumns(floorId: string): Promise<string[]> {
    if (!isSupabaseConfigured()) return [];
    console.log('[DEBUG] API - Fetching available feature columns for floor:', floorId);
    try {
      const { data, error } = await supabase
        .from('accessibility_features')
        .select('*')
        .eq('floor_id', floorId)
        .maybeSingle();

      if (error) {
        console.error('[DEBUG] API - Accessibility features row error:', error);
        throw error;
      }

      if (!data) return [];

      // Filter columns that have the value 'present'
      const presentFeatures = Object.keys(data).filter(key => data[key] === 'present');
      
      console.log('[DEBUG] API - Available feature columns:', presentFeatures);
      return presentFeatures;
    } catch (e) {
      console.warn('Error fetching available feature columns:', e);
      return [];
    }
  },

  async getAccessibilityFeatureColumns(): Promise<string[]> {
    if (!isSupabaseConfigured()) return [];
    try {
      const { data, error } = await supabase
        .from('accessibility_features')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        console.error('[DEBUG] API - Error fetching feature columns:', error);
        return [];
      }

      // Filter system columns
      const systemColumns = ['id', 'building_id', 'floor_id', 'feature_geometry', 'updated_at', 'created_at'];
      return Object.keys(data).filter(key => !systemColumns.includes(key));
    } catch (e) {
      console.warn('Error fetching available feature columns:', e);
      return [];
    }
  },

  async updateAccessibilityFeatureStatus(floorId: string, columnName: string, status: 'present' | 'temporary' | 'none'): Promise<{ success: boolean }> {
    if (!isSupabaseConfigured()) return { success: false };
    try {
      const { error } = await supabase
        .from('accessibility_features')
        .update({ [columnName]: status })
        .eq('floor_id', floorId);

      if (error) throw error;
      return { success: true };
    } catch (e) {
      console.error('Error updating accessibility feature status:', e);
      throw e;
    }
  },

  async getAccessibilityFeatures(buildingId: string, floorId: string): Promise<AccessibilityFeature[]> {
    if (!isSupabaseConfigured()) return [];
    console.log('[DEBUG] API - Fetching accessibility features from feature_geometry for floor:', floorId);
    try {
      const { data, error } = await supabase
        .from('accessibility_features')
        .select('*')
        .eq('floor_id', floorId)
        .maybeSingle();

      if (error) {
        console.error('[DEBUG] API - Accessibility features error:', error);
        throw error;
      }

      if (!data) return [];

      const features: AccessibilityFeature[] = [];
      const geometry = data.feature_geometry;

      // Iterate over columns to find 'present' features
      Object.keys(data).forEach((key) => {
        if ((data[key] === 'present' || data[key] === 'temporary') && geometry && geometry[key]) {
          const geom = geometry[key];
          features.push({
            id: `${key}-${data.id}`,
            buildingId: data.building_id,
            floorId: parseInt(data.floor_id),
            name: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            type: (key.includes('stairs') ? 'stairs' : key.includes('lift') ? 'lift' : key.includes('toilet') ? 'toilet' : key.includes('ramp') ? 'ramp' : key.includes('entrance') ? 'entrance' : 'other') as FeatureType,
            status: data[key] === 'temporary' ? 'temporary' : 'working',
            x: geom.x, // Absolute 1600x800 coordinate
            y: geom.y, // Absolute 1600x800 coordinate
            description: `Accessibility feature: ${key} (${data[key]})`,
            confidenceScore: 100,
            confidenceLevel: 'HIGH',
            verificationStatus: 'verified',
            lastUpdated: new Date().toISOString()
          });
        }
      });
      
      console.log('[DEBUG] API - Accessibility features transformed:', features);
      return features;
    } catch (e) {
      console.warn('Error fetching accessibility features:', e);
      return [];
    }
  },

  /**
   * ADD DETECTED FEATURE TO TWIN MAP (Admin Only)
   * Sends the AI-detected feature to the Digital Twin backend with Admin auth token
   */
  async addFeatureToTwin(featureData: {
    building_id: string;
    floor_id: number;
    feature_type: string;
    label: string;
    confidence: number;
    status: string;
    bbox?: number[];
    source?: string;
    description?: string;
  }): Promise<{ success: boolean; message: string; feature: AccessibilityFeature }> {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/twin-map/features', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...featureData,
        timestamp: new Date().toISOString()
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || `Failed to add feature to Digital Twin Map (Status ${res.status})`);
    }

    const data = await res.json();
    if (data.feature) {
      const existingIndex = localFeatures.findIndex(f => 
        f.buildingId === data.feature.buildingId &&
        f.floorId === data.feature.floorId &&
        f.name.toLowerCase() === data.feature.name.toLowerCase() &&
        f.type === data.feature.type
      );
      if (existingIndex >= 0) {
        localFeatures[existingIndex] = data.feature;
      } else {
        localFeatures.unshift(data.feature);
      }
    }
    return data;
  },

  /**
   * SUBMIT REPORT: Checks for duplicate same-location + same-feature-type reports in Supabase.
   * - Active Pending/Unverified -> MERGE and increase confidence (40% -> 60% -> 80% -> 90%)
   * - Active Verified (not resolved) -> MERGE, record confirmation, keep confidence strictly at 100%
   * - Resolved -> Create NEW REPORT (old resolved report preserved in database for history)
   * - Rejected -> Create NEW REPORT (old rejected report preserved in database for history)
   */
  async submitReport(reportData: Omit<AccessibilityReport, 'id' | 'submittedAt' | 'verificationStatus' | 'confidenceScore' | 'confidenceLevel'>): Promise<AccessibilityReport> {
    const reporterName = reportData.reporterName?.trim() || 'Anonymous Campus Reporter';
    const bId = reportData.buildingId || 'bldg-iter-main';
    const bName = reportData.buildingName || 'SOA ITER Academic Block C';
    const flId = String(reportData.floorId);
    const flName = reportData.floorName || 'Ground Floor';
    const fName = (reportData.featureName || 'Reported Location').trim();
    const fType = reportData.featureType;

    console.log('[Supabase] report submission started:', {
      buildingId: bId,
      floorId: flId,
      featureName: fName,
      featureType: fType,
      reporterName
    });

    if (!isSupabaseConfigured()) {
      const err = 'Supabase client is not configured. Cannot persist report.';
      console.error('[Supabase Error]', err);
      throw new Error(err);
    }

    // Helper for confidence boosting: 1 person -> 40%, 2 people -> 60%, 3 people -> 80%, 4+ -> 90%
    const getConfidenceScore = (count: number) => {
      if (count <= 1) return { score: 40, level: 'LOW' as const };
      if (count === 2) return { score: 60, level: 'MEDIUM' as const };
      if (count === 3) return { score: 80, level: 'HIGH' as const };
      return { score: 90, level: 'HIGH' as const };
    };

    // 1. Fetch existing reports for this building, floor, and feature_type to detect matching candidates
    const { data: existingRows, error: searchError } = await supabase
      .from('reports')
      .select('*')
      .eq('building_id', bId)
      .eq('floor_id', flId)
      .eq('feature_type', fType);

    if (searchError) {
      console.error('[Supabase Error] Supabase errors on searching existing reports:', searchError);
      throw new Error(searchError.message);
    }

    const isResolvedRow = (r: any) => r.status === 'resolved' || r.resolution_status === 'resolved';
    const isRejectedRow = (r: any) => (r.status === 'rejected' || r.verification_status === 'rejected') && !isResolvedRow(r);
    const isVerifiedRow = (r: any) => (
      r.verification_status === 'admin_verified' || 
      r.verification_status === 'verified' || 
      r.status === 'verified'
    ) && !isResolvedRow(r) && !isRejectedRow(r);
    const isActiveRow = (r: any) => !isResolvedRow(r) && !isRejectedRow(r);

    // Matching condition: same location (building, floor, feature_name) AND same feature_type
    const matchingCandidates = (existingRows || []).filter(r => 
      (r.feature_name || '').toLowerCase().trim() === fName.toLowerCase().trim()
    );

    // Find if there is an ACTIVE existing report (not resolved and not rejected)
    const activeExisting = matchingCandidates.find(r => isActiveRow(r));

    if (activeExisting) {
      console.log('[Supabase] Active matching report detected for ID:', activeExisting.id, {
        isVerified: isVerifiedRow(activeExisting),
        currentConfidence: activeExisting.confidence_score
      });

      // Record confirmation in report_confirmations
      const { error: confInsertError } = await supabase
        .from('report_confirmations')
        .insert([{ report_id: activeExisting.id, reporter_name: reporterName }]);

      if (confInsertError && !confInsertError.message?.includes('duplicate key')) {
        console.warn('[Supabase] Note on report_confirmations:', confInsertError.message);
      }

      // Count confirmations / distinct reporters
      const { data: confs } = await supabase
        .from('report_confirmations')
        .select('reporter_name')
        .eq('report_id', activeExisting.id);

      let confCount = (activeExisting.reporter_count || activeExisting.confirmations_count || 1) + 1;
      let namesList = activeExisting.reporter_name ? activeExisting.reporter_name.split(',').map((n: string) => n.trim()) : [];
      if (!namesList.includes(reporterName)) {
        namesList.push(reporterName);
      }

      if (confs && confs.length > 0) {
        const distinctNames = Array.from(new Set(confs.map((c: any) => (c.reporter_name || '').trim()).filter(Boolean)));
        if (distinctNames.length > 0) {
          confCount = Math.max(confCount, distinctNames.length);
          namesList = Array.from(new Set([...namesList, ...distinctNames]));
        }
      }

      const finalReporterNames = namesList.join(', ');

      let updatedDesc = activeExisting.description || '';
      if (reportData.description && !updatedDesc.includes(reportData.description)) {
        updatedDesc = updatedDesc ? `${updatedDesc} | Update by ${reporterName}: ${reportData.description}` : reportData.description;
      }

      // Check if report is already Verified vs Pending
      const isAlreadyVerified = isVerifiedRow(activeExisting);

      let updatePayload: any;

      // Extract real user uploaded image if any
      const realUploadedImage = isRealUserUploadedImage(reportData.photoUrl) ? reportData.photoUrl : null;
      const existingImg = isRealUserUploadedImage(activeExisting.image_url || activeExisting.photo_url) 
        ? (activeExisting.image_url || activeExisting.photo_url) 
        : null;
      const finalImg = realUploadedImage || existingImg || null;

      if (isAlreadyVerified) {
        // CASE 2: Active Verified (not resolved, not rejected) -> MERGE, keep 100% confidence, preserve admin verification
        console.log('[Supabase] Merging into Verified report. Preserving 100% confidence.');
        updatePayload = {
          reporter_name: finalReporterNames,
          reporter_count: confCount,
          confirmations_count: confCount,
          confidence_score: 100,
          confidence_level: 'HIGH',
          verification_status: activeExisting.verification_status || 'verified',
          status: 'verified',
          resolution_status: 'pending',
          description: updatedDesc,
          image_url: finalImg,
          photo_url: finalImg,
          updated_at: new Date().toISOString()
        };
      } else {
        // CASE 1: Active Pending/Unverified -> MERGE, boost confidence score according to confirmation count
        const { score: boostedScore, level: boostedLevel } = getConfidenceScore(confCount);
        console.log(`[Supabase] Merging into Pending report. Boosting confidence to ${boostedScore}%.`);
        updatePayload = {
          reporter_name: finalReporterNames,
          reporter_count: confCount,
          confirmations_count: confCount,
          confidence_score: boostedScore,
          confidence_level: boostedLevel,
          verification_status: 'unverified',
          resolution_status: 'pending',
          status: activeExisting.status || reportData.status || 'broken',
          description: updatedDesc,
          image_url: finalImg,
          photo_url: finalImg,
          updated_at: new Date().toISOString()
        };
      }

      const { data: updatedRow, error: updateError } = await supabase
        .from('reports')
        .update(updatePayload)
        .eq('id', activeExisting.id)
        .select()
        .single();

      if (updateError || !updatedRow) {
        console.error('[Supabase Error] Supabase error on updating duplicate report:', updateError);
        throw new Error(updateError?.message || 'Failed to update existing report in Supabase');
      }

      // Ensure active queue in public.admin_reports has corresponding status
      const { error: adminQueueErr } = await supabase
        .from('admin_reports')
        .upsert([{ 
          report_id: activeExisting.id, 
          status: isAlreadyVerified ? 'verified' : 'pending' 
        }], { onConflict: 'report_id' });

      if (adminQueueErr) {
        console.warn('[Supabase] Admin queue update warning:', adminQueueErr.message);
      }

      console.log('[Supabase] Existing report merged successfully:', {
        id: updatedRow.id,
        confidence: updatedRow.confidence_score,
        status: updatedRow.status,
        count: confCount
      });

      return mapSupabaseReportToModel(updatedRow);
    }

    // CASE 3 & CASE 4: No active report found (either no prior reports, or all prior matching reports are Resolved/Rejected)
    // -> Create a BRAND NEW report starting with initial confidence (40%, LOW, unverified)
    console.log('[Supabase] No active matching report found. Inserting new report into public.reports...');
    const newReportUuid = generateUUID();
    const locStr = typeof reportData.location === 'object' ? JSON.stringify(reportData.location) : (reportData.location || '');
    const realUploadedImage = isRealUserUploadedImage(reportData.photoUrl) ? reportData.photoUrl : null;

    const { data: insertedRow, error: insertError } = await supabase
      .from('reports')
      .insert([{
        id: newReportUuid,
        reporter_name: reporterName,
        building_id: bId,
        building_name: bName,
        floor: flName,
        floor_id: flId,
        floor_name: flName,
        feature_id: (reportData as any).featureId || (reportData as any).feature_id || null,
        feature_name: fName,
        feature_type: fType,
        issue_type: reportData.status || 'broken',
        status: reportData.status || 'broken',
        description: reportData.description || '',
        location: locStr,
        image_url: realUploadedImage,
        photo_url: realUploadedImage,
        confidence_score: 40,
        confidence_level: 'LOW',
        verification_status: 'unverified',
        resolution_status: 'pending',
        reporter_count: 1,
        confirmations_count: 1,
        submitted_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (insertError || !insertedRow) {
      console.error('[Supabase Error] Supabase errors on inserting new report:', insertError);
      throw new Error(insertError?.message || 'Failed to insert report into Supabase database');
    }

    console.log('[Supabase] new report inserted:', insertedRow.id);

    // Insert into public.admin_reports queue
    const { error: adminQueueError } = await supabase.from('admin_reports').insert([{
      report_id: insertedRow.id,
      status: 'pending'
    }]);

    if (adminQueueError) {
      console.warn('[Supabase] Admin queue insert notice:', adminQueueError.message);
    } else {
      console.log('[Supabase] admin queue record created for:', insertedRow.id);
    }

    return mapSupabaseReportToModel(insertedRow);
  },

  /**
   * LOAD REPORTS: Fetches permanent reports directly from Supabase public.reports
   */
  async getReports(buildingId?: string): Promise<AccessibilityReport[]> {
    if (!isSupabaseConfigured()) {
      return MOCK_REPORTS;
    }

    try {
      console.log('[Supabase] Loading reports from public.reports...');
      let query = supabase.from('reports').select('*').order('submitted_at', { ascending: false });
      if (buildingId) {
        query = query.eq('building_id', buildingId);
      }
      let { data, error } = await query;
      
      // If clock skew error occurs (PGRST303: JWT issued at future)
      if (error && (error.code === 'PGRST303' || error.message?.includes('JWT issued at future'))) {
        console.warn('[Supabase] Clock skew detected on getReports. Retrying after brief delay...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        const retryResult = await query;
        data = retryResult.data;
        error = retryResult.error;
      }

      if (error) {
        console.warn('[Supabase Warning] getReports query issue:', error.message);
        return [];
      }

      if (data && Array.isArray(data)) {
        console.log(`[Supabase] Loaded ${data.length} reports from database.`);
        return data.map(mapSupabaseReportToModel);
      }
      return [];
    } catch (e: any) {
      console.warn('[Supabase Warning] getReports failed, falling back to cached reports:', e?.message || e);
      return [];
    }
  },

  async getTwinGramPosts(): Promise<any[]> {
    if (!isSupabaseConfigured()) return [];
    try {
      const { data: posts, error } = await supabase
        .from('twingram_posts')
        .select('id, content, created_at, user_id, image_url, location, verification_status')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      if (!posts) return [];

      // Fetch all unique user profiles
      const userIds = [...new Set(posts.map(p => p.user_id))];
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, full_name, username, avatar_url')
        .in('id', userIds);

      const profileMap = (profiles || []).reduce((acc, profile) => {
        acc[profile.id] = profile;
        return acc;
      }, {} as Record<string, any>);

      return posts.map(post => ({
        ...post,
        user_profiles: profileMap[post.user_id] || { full_name: 'Unknown', username: 'unknown', avatar_url: '' }
      }));
    } catch (e) {
      console.error('Error fetching TwinGram posts:', e);
      return [];
    }
  },

  async updateTwinGramPostStatus(postId: string, status: 'verified' | 'fake'): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!isSupabaseConfigured()) return { success: false, error: 'Supabase not configured' };
    try {
      // 1. Perform the update and request the updated row back immediately
      const { data: updatedPosts, error: updateError } = await supabase
        .from('twingram_posts')
        .update({ verification_status: status })
        .eq('id', postId)
        .select('id, content, created_at, user_id, image_url, location, verification_status');
      
      if (updateError) {
        console.error('Error updating TwinGram post status:', updateError);
        return { success: false, error: updateError.message };
      }

      if (!updatedPosts || updatedPosts.length === 0) {
        return { success: false, error: 'Update failed: Row not found or permission denied (RLS).' };
      }
      
      const updatedPost = updatedPosts[0];

      // Verify the returned status matches the requested status
      if (updatedPost.verification_status !== status) {
        return { success: false, error: `Update failed: Expected status ${status} but got ${updatedPost.verification_status}` };
      }
      
      // 2. Fetch user profile
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id, full_name, username, avatar_url')
        .eq('id', updatedPost.user_id)
        .single();
        
      const finalPost = {
        ...updatedPost,
        user_profiles: profile || { full_name: 'Unknown', username: 'unknown', avatar_url: '' }
      };

      return { success: true, data: finalPost };
    } catch (e: any) {
      console.error('Error updating TwinGram post status:', e);
      return { success: false, error: e.message };
    }
  },

  /**
   * ADMIN VERIFY / REJECT: Updates public.reports and syncs public.admin_reports without deleting user report
   */
  async verifyReport(reportId: string, status: 'admin_verified' | 'rejected', notes?: string): Promise<AccessibilityReport | null> {
    const isVerified = status === 'admin_verified';
    if (!isVerified && (!notes || !notes.trim())) {
      throw new Error('Rejection note is compulsory when rejecting a report.');
    }

    const noteText = notes ? notes.trim() : '';
    const now = new Date().toISOString();

    let authAdminUuid: string | null = null;
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        authAdminUuid = data.session.user.id;
      }
    } catch {}

    const payload: any = {
      verification_status: isVerified ? 'verified' : 'rejected',
      status: isVerified ? 'verified' : 'rejected',
      resolution_status: 'pending',
      confidence_score: isVerified ? 100 : 0,
      confidence_level: isVerified ? 'HIGH' : 'LOW',
      admin_notes: noteText,
      updated_at: now
    };

    if (isVerified) {
      if (authAdminUuid) payload.verified_by = authAdminUuid;
      payload.verified_at = now;
    } else {
      if (authAdminUuid) payload.rejected_by = authAdminUuid;
      payload.rejected_at = now;
      payload.rejection_note = noteText;
      payload.rejection_reason = noteText;
    }

    // 1. Update public.reports (PERMANENT ROW PRESERVED - NEVER DELETED)
    const { data: updatedReport, error: updateError } = await supabase
      .from('reports')
      .update(payload)
      .eq('id', reportId)
      .select()
      .single();

    if (updateError || !updatedReport) {
      console.error('[Supabase Error] Supabase errors on verifyReport:', updateError);
      throw new Error(updateError?.message || 'Failed to update report verification in Supabase');
    }

    // 2. Update active admin_reports queue
    const { error: adminUpdateError } = await supabase
      .from('admin_reports')
      .upsert([{
        report_id: reportId,
        verified_by: authAdminUuid || null,
        verified_at: now,
        admin_notes: noteText,
        status: isVerified ? 'verified' : 'rejected'
      }], { onConflict: 'report_id' });

    if (adminUpdateError) {
      console.warn('[Supabase] Admin queue status update notice:', adminUpdateError.message);
    }

    console.log(`[Supabase] Report ${reportId} marked as ${status} (confidence: ${isVerified ? 100 : 0}%)`);
    const mapped = mapSupabaseReportToModel(updatedReport);

    // If verified by admin AND report has a real user-uploaded image, generate and store a real recommendation
    const hasRealImage = isRealUserUploadedImage(mapped.photoUrl);
    if (isVerified && hasRealImage) {
      try {
        await api.analyzeAndGenerateRecommendation({
          reportId: mapped.id,
          buildingId: mapped.buildingId,
          buildingName: mapped.buildingName,
          floorId: mapped.floorId,
          userQuery: mapped.description,
          reporterName: mapped.reporterName,
          disabilityType: mapped.featureType === 'ramp' || mapped.featureType === 'door' ? 'wheelchair' : mapped.featureType === 'toilet' ? 'elderly' : 'visual',
          photoUrl: mapped.photoUrl
        });
      } catch (genErr) {
        console.warn('Notice on generating fix suggestion for verified report:', genErr);
      }
    }

    return mapped;
  },

  /**
   * RESOLVE REPORT: Updates resolution status in public.reports and clears active queue
   */
  async resolveReport(reportId: string): Promise<AccessibilityReport | null> {
    const now = new Date().toISOString();

    // 1. Update public.reports (PERMANENT ROW PRESERVED)
    const { data: resolvedReport, error: resolveError } = await supabase
      .from('reports')
      .update({
        status: 'resolved',
        resolution_status: 'resolved',
        verification_status: 'verified',
        confidence_score: 100,
        confidence_level: 'HIGH',
        updated_at: now
      })
      .eq('id', reportId)
      .select()
      .single();

    if (resolveError || !resolvedReport) {
      console.error('[Supabase Error] Supabase errors on resolveReport:', resolveError);
      throw new Error(resolveError?.message || 'Failed to resolve report in Supabase');
    }

    // 2. Remove from active admin_reports queue
    const { error: queueDeleteError } = await supabase
      .from('admin_reports')
      .delete()
      .eq('report_id', reportId);

    if (queueDeleteError) {
      console.warn('[Supabase] Admin queue cleanup notice:', queueDeleteError.message);
    }

    console.log(`[Supabase] Report ${reportId} marked as resolved in public.reports`);
    return mapSupabaseReportToModel(resolvedReport);
  },

  async getRecommendations(buildingId?: string): Promise<Recommendation[]> {
    if (isSupabaseConfigured()) {
      try {
        let query = supabase
          .from('recommendations')
          .select('*')
          .neq('status', 'Completed');
        if (buildingId) {
          query = query.eq('building_id', buildingId);
        }
        const { data, error } = await query;
        if (!error && Array.isArray(data) && data.length > 0) {
          const recs: Recommendation[] = data
            .filter((d: any) => d.status !== 'Completed')
            .map((d: any) => ({
              id: d.id,
              reportId: d.report_id || d.reportId || undefined,
              buildingId: d.building_id || 'bldg-iter-main',
              buildingName: d.building_name || 'SOA ITER Academic Block C',
              title: d.title || 'Accessibility Recommendation',
              problem: d.problem || d.description || 'Barrier reported',
              solution: d.solution || 'Install accessible ramp or feature',
              severity: d.severity || 'High',
              disabilityTypesAffected: d.disability_types_affected || ['wheelchair'],
              estimatedUsersAffected: d.estimated_users_affected || 0,
              costCategory: d.cost_category || 'Low',
              estimatedCostAmount: d.estimated_cost_amount || d.est_cost || '₹0',
              expectedImpact: d.expected_impact || 'High',
              priority: d.priority || 'High',
              impactScore: d.impact_score || 0,
              status: d.status === 'In Progress' ? 'In Progress' : 'Pending',
              floorId: d.floor_id ?? 0,
              locationName: d.location_name || 'Campus Facility'
            }));
          localRecommendations = recs;
          return recs;
        }

        // Secondary fallback to report_confirmations table if recommendations was empty
        let confQuery = supabase
          .from('report_confirmations')
          .select('*')
          .not('title', 'is', null)
          .neq('status', 'Completed');
        if (buildingId) {
          confQuery = confQuery.eq('building_id', buildingId);
        }
        const { data: confData, error: confError } = await confQuery;
        if (!confError && Array.isArray(confData) && confData.length > 0) {
          const recs: Recommendation[] = confData
            .filter((d: any) => d.status !== 'Completed')
            .map((d: any) => ({
              id: d.id,
              reportId: d.report_id || d.reportId || undefined,
              buildingId: d.building_id || 'bldg-iter-main',
              buildingName: d.building_name || 'SOA ITER Academic Block C',
              title: d.title || 'Accessibility Recommendation',
              problem: d.problem || 'Barrier reported',
              solution: d.solution || 'Install accessible ramp or feature',
              severity: d.severity || 'High',
              disabilityTypesAffected: d.disability_types_affected || ['wheelchair'],
              estimatedUsersAffected: d.estimated_users_affected || 0,
              costCategory: d.cost_category || 'Low',
              estimatedCostAmount: d.estimated_cost_amount || '₹0',
              expectedImpact: d.expected_impact || 'High',
              priority: d.priority || 'High',
              impactScore: d.impact_score || 0,
              status: d.status === 'In Progress' ? 'In Progress' : 'Pending',
              floorId: d.floor_id ?? 0,
              locationName: d.location_name || 'Campus Facility'
            }));
          localRecommendations = recs;
          return recs;
        }
      } catch (e) {
        console.warn('Supabase getRecommendations notice:', e);
      }
    }

    try {
      const url = '/api/recommendations' + (buildingId ? `?buildingId=${buildingId}` : '');
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const activeData = data.filter((d: any) => d.status !== 'Completed');
          localRecommendations = activeData;
          return activeData;
        }
      }
    } catch {
      // Fallback to local memory
    }
    const filtered = localRecommendations.filter(r => r.status !== 'Completed');
    return buildingId ? filtered.filter(r => r.buildingId === buildingId) : filtered;
  },

  async updateRecommendationStatus(id: string, status: 'Pending' | 'In Progress' | 'Completed', associatedReportId?: string): Promise<Recommendation | null> {
    const now = new Date().toISOString();
    let rec = localRecommendations.find(r => r.id === id || r.reportId === id || (associatedReportId && r.reportId === associatedReportId));
    const effectiveReportId = associatedReportId || rec?.reportId;

    if (rec) {
      rec.status = status;
    }

    // 2. Persist synchronously into Supabase (both public.recommendations and public.report_confirmations)
    if (isSupabaseConfigured()) {
      try {
        const targetReportUuid = (effectiveReportId && isUUID(effectiveReportId)) 
          ? effectiveReportId 
          : (isUUID(id) ? id : null);
        const targetRecUuid = isUUID(id) ? id : (isUUID(rec?.id) ? rec?.id : null);

        // 1. Update public.recommendations
        if (targetRecUuid) {
          await supabase
            .from('recommendations')
            .update({ status, updated_at: now })
            .eq('id', targetRecUuid);
        }
        if (targetReportUuid) {
          await supabase
            .from('recommendations')
            .update({ status, updated_at: now })
            .eq('report_id', targetReportUuid);
        }

        // 2. Concurrently update public.report_confirmations
        if (targetReportUuid) {
          await supabase
            .from('report_confirmations')
            .update({ status, updated_at: now })
            .eq('report_id', targetReportUuid);
        }
        if (targetRecUuid) {
          await supabase
            .from('report_confirmations')
            .update({ status, updated_at: now })
            .eq('id', targetRecUuid);
        }

        // 3. When Completed, update the original report associated with this Fix Suggestion to 'resolved' (Solved)
        if (status === 'Completed' && targetReportUuid) {
          const { error: reportUpdateError } = await supabase
            .from('reports')
            .update({
              status: 'resolved',
              resolution_status: 'resolved',
              verification_status: 'verified',
              confidence_score: 100,
              confidence_level: 'HIGH',
              updated_at: now
            })
            .eq('id', targetReportUuid);

          if (reportUpdateError) {
            console.warn('[Supabase] Original report resolution notice:', reportUpdateError.message);
          }

          // Clean up active queue
          const { error: adminQueueError } = await supabase
            .from('admin_reports')
            .delete()
            .eq('report_id', targetReportUuid);

          if (adminQueueError) {
            console.warn('[Supabase] Admin queue cleanup notice:', adminQueueError.message);
          }

          console.log(`[Supabase] Original report ${targetReportUuid} marked as Solved (resolved) via completed fix suggestion`);
        }

        console.log(`[Supabase] Persisted fix suggestion status='${status}' for id=${id}, report_id=${targetReportUuid}`);
      } catch (e) {
        console.error('Supabase updateRecommendationStatus error:', e);
        throw e;
      }
    }

    if (status === 'Completed') {
      localRecommendations = localRecommendations.filter(r => r.id !== id && r.reportId !== id && (!effectiveReportId || r.reportId !== effectiveReportId));
    }

    // 3. Update backend server cache
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/recommendations/${id}/status`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status, reportId: effectiveReportId })
      });
      if (res.ok) {
        const updated = await res.json();
        return updated;
      }
    } catch {
      // Fallback
    }

    return rec || ({ id, reportId: effectiveReportId, status } as any);
  },

  /**
   * SOA-AccessTwin AI Engine: Analyzes report & generates real Fix Suggestion
   */
  async analyzeAndGenerateRecommendation(params: {
    reportId?: string;
    buildingId?: string;
    buildingName?: string;
    floorId?: number | string;
    userQuery: string;
    reporterName?: string;
    disabilityType?: string;
    photoUrl?: string;
  }): Promise<Recommendation | null> {
    // 1. Deduplication check: Do not create duplicate recommendations for the same report ID
    if (params.reportId) {
      if (isSupabaseConfigured()) {
        try {
          const { data: existingRow } = await supabase
            .from('recommendations')
            .select('*')
            .eq('report_id', params.reportId)
            .maybeSingle();

          if (existingRow) {
            console.log('[Supabase] Recommendation already exists for report:', params.reportId);
            return {
              id: existingRow.id,
              reportId: existingRow.report_id,
              buildingId: existingRow.building_id,
              buildingName: existingRow.building_name,
              title: existingRow.title,
              problem: existingRow.problem,
              solution: existingRow.solution,
              severity: existingRow.severity,
              disabilityTypesAffected: existingRow.disability_types_affected || ['wheelchair'],
              estimatedUsersAffected: existingRow.estimated_users_affected || 0,
              costCategory: existingRow.cost_category || 'Low',
              estimatedCostAmount: existingRow.estimated_cost_amount || '₹0',
              expectedImpact: existingRow.expected_impact || 'High',
              priority: existingRow.priority || 'High',
              impactScore: existingRow.impact_score || 0,
              status: existingRow.status || 'Pending',
              floorId: existingRow.floor_id ?? 0,
              locationName: existingRow.location_name || 'Campus Facility'
            };
          }

          // Also check report_confirmations for duplicate prevention
          const { data: existingConf } = await supabase
            .from('report_confirmations')
            .select('*')
            .eq('report_id', params.reportId)
            .maybeSingle();

          if (existingConf && existingConf.title) {
            console.log('[Supabase] Fix Suggestion already exists in report_confirmations for report:', params.reportId);
            return {
              id: existingConf.id,
              reportId: existingConf.report_id,
              buildingId: existingConf.building_id || 'bldg-iter-main',
              buildingName: existingConf.building_name || 'SOA ITER Academic Block C',
              title: existingConf.title,
              problem: existingConf.problem,
              solution: existingConf.solution,
              severity: existingConf.severity || 'High',
              disabilityTypesAffected: existingConf.disability_types_affected || ['wheelchair'],
              estimatedUsersAffected: existingConf.estimated_users_affected || 0,
              costCategory: existingConf.cost_category || 'Low',
              estimatedCostAmount: existingConf.estimated_cost_amount || '₹0',
              expectedImpact: existingConf.expected_impact || 'High',
              priority: existingConf.priority || 'High',
              impactScore: existingConf.impact_score || 0,
              status: existingConf.status || 'Pending',
              floorId: existingConf.floor_id ?? 0,
              locationName: existingConf.location_name || 'Campus Facility'
            };
          }
        } catch (supErr) {
          console.warn('Notice checking existing recommendation:', supErr);
        }
      }

      const existingLocal = localRecommendations.find(r => r.reportId === params.reportId);
      if (existingLocal) {
        return existingLocal;
      }
    }

    try {
      const res = await fetch('/api/reports/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_id: params.reportId,
          reportId: params.reportId,
          user_query: params.userQuery,
          building_name: params.buildingName || 'SOA ITER Academic Block C',
          building_id: params.buildingId || 'bldg-iter-main',
          floor_id: params.floorId ?? 0,
          reporter_name: params.reporterName || 'Campus Reporter',
          disability_type: params.disabilityType || 'wheelchair',
          image: params.photoUrl
        })
      });

      if (res.ok) {
        const json = await res.json();
        const recData = json?.data;
        if (recData) {
          const recModel: Recommendation = {
            id: recData.id || `rec-${Date.now()}`,
            reportId: params.reportId || recData.reportId || recData.report_id,
            buildingId: recData.buildingId || params.buildingId || 'bldg-iter-main',
            buildingName: recData.buildingName || params.buildingName || 'SOA ITER Academic Block C',
            title: recData.title || `Fix: ${params.userQuery.slice(0, 50)}`,
            problem: recData.problem || recData.issue || params.userQuery,
            solution: recData.solution || recData.recommendation || 'Remediate barrier',
            severity: recData.priority || 'High',
            disabilityTypesAffected: recData.disability_types_affected || [params.disabilityType || 'wheelchair'],
            estimatedUsersAffected: recData.estimated_users_affected || 150,
            costCategory: recData.costCategory || 'Low',
            estimatedCostAmount: recData.estimated_cost_inr || '₹1,500 - ₹3,500',
            expectedImpact: (recData.impact_score || 85) >= 80 ? 'High' : 'Medium',
            priority: recData.priority || 'High',
            impactScore: recData.impact_score || 85,
            status: 'Pending',
            floorId: params.floorId ?? 0,
            locationName: recData.buildingName || params.buildingName || 'Campus Facility'
          };

          // If Supabase is configured, persist the SAME DATA to both public.recommendations and public.report_confirmations
          if (isSupabaseConfigured()) {
            try {
              const validReportUuid = isUUID(params.reportId) ? params.reportId : null;

              // 1. Insert into public.recommendations
              const recPayload: any = {
                building_id: recModel.buildingId,
                building_name: recModel.buildingName,
                title: recModel.title,
                problem: recModel.problem,
                solution: recModel.solution,
                severity: recModel.severity,
                priority: recModel.priority,
                cost_category: recModel.costCategory,
                estimated_cost_amount: recModel.estimatedCostAmount,
                expected_impact: recModel.expectedImpact,
                impact_score: recModel.impactScore,
                status: 'Pending',
                floor_id: recModel.floorId,
                location_name: recModel.locationName,
                disability_types_affected: recModel.disabilityTypesAffected,
                estimated_users_affected: recModel.estimatedUsersAffected,
                updated_at: new Date().toISOString()
              };

              if (validReportUuid) {
                recPayload.report_id = validReportUuid;
              }
              if (isUUID(recModel.id)) {
                recPayload.id = recModel.id;
              }

              const { data: savedRec } = await supabase
                .from('recommendations')
                .upsert([recPayload], validReportUuid ? { onConflict: 'report_id' } : undefined)
                .select()
                .maybeSingle();

              if (savedRec && savedRec.id) {
                recModel.id = savedRec.id;
              }

              // 2. Save the SAME Fix Suggestion data into public.report_confirmations
              if (validReportUuid) {
                const confPayload: any = {
                  report_id: validReportUuid,
                  reporter_name: params.reporterName || 'Campus Reporter',
                  title: recModel.title,
                  problem: recModel.problem,
                  solution: recModel.solution,
                  building_id: recModel.buildingId,
                  building_name: recModel.buildingName,
                  floor_id: recModel.floorId,
                  location_name: recModel.locationName,
                  severity: recModel.severity,
                  priority: recModel.priority,
                  cost_category: recModel.costCategory,
                  estimated_cost_amount: recModel.estimatedCostAmount,
                  expected_impact: recModel.expectedImpact,
                  impact_score: recModel.impactScore,
                  status: 'Pending',
                  disability_types_affected: recModel.disabilityTypesAffected,
                  estimated_users_affected: recModel.estimatedUsersAffected,
                  updated_at: new Date().toISOString()
                };
                
                await supabase
                  .from('report_confirmations')
                  .upsert([confPayload], { onConflict: 'report_id' });
              }
              
            } catch (supErr) {
              console.warn('Error persisting AI recommendation to Supabase:', supErr);
            }
          }

          localRecommendations.push(recModel);
          return recModel;
        }
      }
    } catch (e) {
      console.warn('analyzeAndGenerateRecommendation failed:', e);
    }
    
    return null;
  }
};
