export type DisabilityProfile = 'wheelchair' | 'visual' | 'hearing' | 'elderly' | 'general';

export type FeatureType = 
  | 'ramp' 
  | 'lift' 
  | 'toilet' 
  | 'signage' 
  | 'parking' 
  | 'door' 
  | 'stairs' 
  | 'corridor' 
  | 'tactile_path' 
  | 'obstacle' 
  | 'other';

export type FeatureStatus = 'working' | 'broken' | 'not_available' | 'under_maintenance' | 'temporary' | 'unverified';

export type VerificationStatus = 'unverified' | 'community_verified' | 'admin_verified' | 'verified' | 'rejected';

export type ConfidenceLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface AccessibilityFeature {
  id: string;
  buildingId: string;
  floorId: number; // 0 = Ground, 1 = Floor 1, etc.
  name: string;
  type: FeatureType;
  status: FeatureStatus;
  x: number; // coordinate on floor plan
  y: number; // coordinate on floor plan
  width?: number;
  height?: number;
  description: string;
  confidenceScore: number; // 0-100
  confidenceLevel: ConfidenceLevel;
  verificationStatus: VerificationStatus;
  lastUpdated: string;
  photoUrl?: string;
  reportedBy?: string;
  upvotes?: number;
  downvotes?: number;
  reporterCount?: number;
  featureKey?: string;
  specifications?: string; // e.g. "Ramp incline: 1:12, Width: 1.5m"
}

export interface BuildingFloor {
  floorId: number;
  name: string; // e.g. "Ground Floor", "Floor 1"
  mapSvgUrl?: string;
  mapImageUrl?: string;
  dimensions: { width: number; height: number };
  rooms: BuildingRoom[];
}

export interface BuildingRoom {
  id: string;
  name: string;
  category: 'classroom' | 'lab' | 'office' | 'library' | 'toilet' | 'entrance' | 'elevator_bay' | 'cafeteria' | 'auditorium';
  x: number;
  y: number;
  width: number;
  height: number;
  isAccessible: boolean;
}

export interface Building {
  id: string;
  name: string;
  code: string;
  campus: string;
  address: string;
  floorsCount: number;
  overallScore?: number; // 0-100
  imageUrl: string;
  description: string;
  floors: BuildingFloor[];
  scores?: {
    wheelchair: number;
    visual: number;
    hearing: number;
    signage: number;
    restrooms: number;
    navigation: number;
  };
}

export interface AccessibilityReport {
  id: string;
  buildingId: string;
  buildingName: string;
  featureName: string;
  featureId?: string;
  featureType: FeatureType;
  status: FeatureStatus | 'verified' | 'rejected' | 'resolved';
  description: string;
  floorId: number | string;
  floorName: string;
  location: { x: number; y: number };
  photoUrl?: string;
  submittedAt: string;
  reporterName: string;
  verificationStatus: VerificationStatus;
  resolutionStatus?: 'pending' | 'resolved';
  confidenceScore: number;
  confidenceLevel: ConfidenceLevel;
  confirmationsCount?: number; // Number of users reporting/confirming this issue (e.g., 2)
  adminNotes?: string;
  rejectionNote?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
}

export interface DetectedObject {
  id: string;
  label: string;
  type: FeatureType;
  confidence: number; // percentage 0-100
  bbox: [number, number, number, number]; // [x_min, y_min, x_max, y_max] in percentages 0-100
  status: FeatureStatus;
  recommendation?: string;
}

export interface AiDetectionResult {
  imageId: string;
  imageUrl: string;
  analyzedAt: string;
  detectedObjects: DetectedObject[];
  overallAccessibility: 'High' | 'Moderate' | 'Poor';
  summary: string;
}

export interface NavigationNode {
  id: string;
  buildingId: string;
  floorId: number;
  name: string;
  x: number;
  y: number;
  type: 'room' | 'entrance' | 'ramp' | 'lift' | 'stairs' | 'corridor_junction';
  isAccessible: boolean;
  featureId?: string;
}

export interface NavigationEdge {
  fromNodeId: string;
  toNodeId: string;
  distanceMeters: number;
  hasRamp: boolean;
  hasStairs: boolean;
  hasLift: boolean;
  minWidthMeters: number;
  tactilePavingAvailable: boolean;
  isWorking: boolean;
  warningMessage?: string;
}

export interface RouteStep {
  stepNumber: number;
  instruction: string;
  floorId: number;
  floorName: string;
  distanceMeters: number;
  featureTypeUsed?: FeatureType;
  nodeId: string;
  warning?: string;
}

export interface RouteResult {
  fromNode: NavigationNode;
  toNode: NavigationNode;
  profile: DisabilityProfile;
  totalDistanceMeters: number;
  estimatedMinutes: number;
  steps: RouteStep[];
  pathNodeIds: string[];
  warnings: string[];
  accessibleFeaturesUsed: string[];
}

export interface FloorMap {
  mapId: string;
  buildingId: string;
  floorId: string;
  imageUrl: string;
  width: number;
  height: number;
}

export interface Recommendation {
  id: string;
  reportId?: string;
  buildingId: string;
  buildingName: string;
  title: string;
  problem: string;
  solution: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  disabilityTypesAffected: DisabilityProfile[];
  estimatedUsersAffected: number;
  costCategory: 'Very Low' | 'Low' | 'Medium' | 'High';
  estimatedCostAmount: string; // e.g. "$150 - $300"
  expectedImpact: 'High' | 'Medium' | 'Low';
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  impactScore: number; // calculated score
  status: 'Pending' | 'In Progress' | 'Completed';
  floorId: number | string;
  locationName: string;
}
