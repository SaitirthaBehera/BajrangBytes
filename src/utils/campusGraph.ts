import graphData from '../data/unified_graph.json';
import { MOCK_CROWD_ZONES_BY_FLOOR, getCrowdZonesForFloor } from '../data/crowdDensityData';
import { CrowdLevel, RouteCrowdAdvisory } from '../types';

export interface CampusGraphNode {
  id: string;
  label: string;
  building_id: string;
  floor: number;
  type: string;
  accessible: boolean;
  coords: { x: number; y: number };
  barrier?: string;
}

export interface CampusGraphEdge {
  from: string;
  to: string;
  distance: number;
  type: string;
  accessible: boolean;
  tactile?: boolean;
}

// Ingest from static JSON cleanly without bloating AST memory
export const CAMPUS_NODES: Record<string, CampusGraphNode> = {};
for (const n of graphData.nodes as any[]) {
  CAMPUS_NODES[n.id] = {
    id: n.id,
    label: n.label || n.id,
    building_id: n.building_id || 'campus',
    floor: n.floor || 0,
    type: n.type || 'room',
    accessible: n.accessible !== false,
    coords: n.coords || { x: 50, y: 50 },
    barrier: n.barrier
  };
}

export const CAMPUS_EDGES: CampusGraphEdge[] = (graphData.edges as any[]).map(e => ({
  from: e.from,
  to: e.to,
  distance: e.distance,
  type: e.type || 'corridor',
  accessible: e.accessible !== false,
  tactile: e.tactile === true
}));

// =========================================================================
// CROWD AWARENESS INTEGRATION (Identical mapping to Python backend)
// =========================================================================

export const CROWD_PENALTY_MULTIPLIERS: Record<string, number> = {
  low: 1.0,        // Free-flowing corridor / elevator (no impedance)
  moderate: 2.5,   // Moderate human traffic (+150% impedance)
  high: 5.0        // High density bottleneck (+400% elevator queue delay)
};

export const NODE_TO_CROWD_ZONE: Record<string, string> = {
  // ACADEMIC BLOCK E — GROUND FLOOR (E-F0)
  "block_e_main_entrance": "cz-e0-entrance",
  "e_f0_lift1": "cz-e0-west-lifts",
  "e_f0_lift2": "cz-e0-west-lifts",
  "e_f0_west_corridor": "cz-e0-central-hall",
  "e_f0_lift3": "cz-e0-east-lifts",
  "e_f0_lift4": "cz-e0-east-lifts",
  "e_f0_east_corridor": "cz-e0-central-hall",
  "e_f0_north_corridor": "cz-e0-central-hall",
  "e_f0_south_corridor": "cz-e0-south-hall",
  "e_f0_stairs": "cz-e0-south-hall",

  // ACADEMIC BLOCK E — FLOOR 1 (E-F1)
  "e_f1_lift1": "cz-e1-west-lifts",
  "e_f1_lift2": "cz-e1-west-lifts",
  "e_f1_west_corridor": "cz-e1-central-hall",
  "e_f1_lift3": "cz-e1-east-lifts",
  "e_f1_lift4": "cz-e1-east-lifts",
  "e_f1_east_corridor": "cz-e1-central-hall",
  "e_f1_north_corridor": "cz-e1-central-hall",
  "e_f1_south_corridor": "cz-e1-south-hall",
  "e_f1_stairs": "cz-e1-south-hall",

  // ACADEMIC BLOCK E — FLOOR 2 (E-F2)
  "e_f2_bridge_d": "cz-e2-bridge-d",
  "e_f2_lift1": "cz-e2-west-lifts",
  "e_f2_lift2": "cz-e2-west-lifts",
  "e_f2_west_corridor": "cz-e2-central-hall",
  "e_f2_lift3": "cz-e2-east-lifts",
  "e_f2_lift4": "cz-e2-east-lifts",
  "e_f2_east_corridor": "cz-e2-central-hall",
  "e_f2_north_corridor": "cz-e2-central-hall",
  "e_f2_south_corridor": "cz-e2-central-hall",
  "e_f2_stairs": "cz-e2-central-hall",

  // ACADEMIC BLOCK E — FLOOR 3 (E-F3)
  "e_f3_lift1": "cz-e3-west-lifts",
  "e_f3_lift2": "cz-e3-west-lifts",
  "e_f3_west_corridor": "cz-e3-central-hall",
  "e_f3_lift3": "cz-e3-east-lifts",
  "e_f3_lift4": "cz-e3-east-lifts",
  "e_f3_east_corridor": "cz-e3-central-hall",
  "e_f3_stairs": "cz-e3-central-hall",
  "e_f3_north_corridor": "cz-e3-central-hall",
  "e_f3_south_corridor": "cz-e3-central-hall",

  // ACADEMIC BLOCK E — FLOOR 4 (E-F4)
  "e_f4_lift1": "cz-e4-west-lifts",
  "e_f4_lift2": "cz-e4-west-lifts",
  "e_f4_west_corridor": "cz-e4-central-hall",
  "e_f4_lift3": "cz-e4-east-lifts",
  "e_f4_lift4": "cz-e4-east-lifts",
  "e_f4_east_corridor": "cz-e4-central-hall",
  "e_f4_stairs": "cz-e4-central-hall",
  "e_f4_north_corridor": "cz-e4-central-hall",
  "e_f4_south_corridor": "cz-e4-central-hall",

  // ACADEMIC BLOCK D — GROUND FLOOR (D-F0)
  "block_d_entrance": "cz-d0-entrance",
  "d_f0_bridge_c": "cz-d0-entrance",
  "d_f0_corridor": "cz-d0-central-hall",
  "d_f0_stairs2": "cz-d0-north-hall",
  "d_f0_stairs1": "cz-d0-east-stair",
  "d_f0_bridge_e": "cz-d0-east-stair",

  // ACADEMIC BLOCK D — FLOOR 1 (D-F1)
  "d_f1_bridge_c": "cz-d1-bridge-c",
  "d_f1_corridor": "cz-d1-central-hall",
  "d_f1_stairs2": "cz-d1-north-hall",
  "d_f1_stairs1": "cz-d1-north-hall",
  "d_f1_bridge_e": "cz-d1-north-hall",

  // ACADEMIC BLOCK D — FLOOR 2 (D-F2)
  "d_f2_bridge_e": "cz-d2-skywalk-e",
  "d_f2_corridor": "cz-d2-central-hall",
  "d_f2_stairs1": "cz-d2-east-lab",
  "d_f2_stairs2": "cz-d2-east-lab",

  // ACADEMIC BLOCK D — FLOOR 3 (D-F3)
  "d_f3_corridor": "cz-d3-central-hall",
  "d_f3_stairs1": "cz-d3-east-stair",
  "d_f3_stairs2": "cz-d3-east-stair",

  // ACADEMIC BLOCK C — GROUND FLOOR (C-F0)
  "c_f0_ent_football": "cz-c0-south-lobby",
  "c_f0_ent_sc_block": "cz-c0-south-lobby",
  "block_c_football_entrance": "cz-c0-south-lobby",
  "block_c_sc_entrance": "cz-c0-south-lobby",
  "c_f0_stairs1": "cz-c0-north-lobby",
  "c_f0_stairs2": "cz-c0-north-lobby",
  "c_f0_stairs_1": "cz-c0-north-lobby",
  "c_f0_stairs_2": "cz-c0-north-lobby",
  "c_f0_corridor": "cz-c0-central-corridor",
  "c_f0_corridor_main": "cz-c0-central-corridor",
  "c_f0_bridge_d": "cz-c0-west-corridor",
  "c_f0_ent_block_d": "cz-c0-west-corridor",

  // ACADEMIC BLOCK C — FLOOR 1 (C-F1)
  "c_f1_stairs1": "cz-c1-north-stair",
  "c_f1_corridor": "cz-c1-central-corridor",
  "c_f1_stairs2": "cz-c1-east-stair",
  "c_f1_bridge_d": "cz-c1-south-balcony",

  // ACADEMIC BLOCK C — FLOOR 2 (C-F2)
  "c_f2_stairs1": "cz-c2-bridge",
  "c_f2_corridor": "cz-c2-central-corridor",
  "c_f2_stairs2": "cz-c2-north-study"
};

export function getZoneIdForNode(nodeId: string): string | null {
  if (!nodeId) return null;
  return NODE_TO_CROWD_ZONE[nodeId.trim()] || null;
}

export function getFloorForZoneId(zoneId: string): string | null {
  if (!zoneId || !zoneId.startsWith('cz-')) return null;
  const parts = zoneId.split('-');
  if (parts.length >= 2) {
    const code = parts[1].toUpperCase();
    if (code.length >= 2 && ['C', 'D', 'E'].includes(code[0])) {
      return `${code[0]}-F${code[1]}`;
    }
  }
  return null;
}

export function getZoneIdsForEdge(u: string, v: string): string[] {
  const zones: string[] = [];
  const zU = getZoneIdForNode(u);
  if (zU && !zones.includes(zU)) zones.push(zU);
  const zV = getZoneIdForNode(v);
  if (zV && !zones.includes(zV)) zones.push(zV);
  return zones;
}

export function getEdgeCrowdPenalty(
  u: string,
  v: string,
  crowdCache?: Record<string, any>
): number {
  const zoneIds = getZoneIdsForEdge(u, v);
  if (!zoneIds.length) return 1.0;

  let maxPenalty = 1.0;
  for (const zoneId of zoneIds) {
    const floorKey = getFloorForZoneId(zoneId);
    if (!floorKey) continue;

    let floorZones: any[] = [];
    if (crowdCache && crowdCache[floorKey]) {
      const cached = crowdCache[floorKey];
      floorZones = Array.isArray(cached) ? cached : (cached.zones || []);
    } else {
      const bldg = floorKey.split('-')[0] || 'E';
      floorZones = MOCK_CROWD_ZONES_BY_FLOOR[floorKey] || getCrowdZonesForFloor(bldg, floorKey);
    }

    if (!floorZones || !floorZones.length) continue;

    for (const z of floorZones) {
      const zId = z.id || z.zone_id;
      if (zId === zoneId) {
        const level = (z.level || 'low').toLowerCase();
        const penalty = CROWD_PENALTY_MULTIPLIERS[level] || 1.0;
        if (penalty > maxPenalty) {
          maxPenalty = penalty;
        }
        break;
      }
    }
  }

  return maxPenalty;
}

export function getEdgeCrowdLevel(u: string, v: string, crowdCache?: Record<string, any>): 'low' | 'moderate' | 'high' {
  const zoneIds = getZoneIdsForEdge(u, v);
  if (!zoneIds || !zoneIds.length) return 'low';

  let maxLevel: 'low' | 'moderate' | 'high' = 'low';

  for (const zoneId of zoneIds) {
    const floorKey = getFloorForZoneId(zoneId);
    if (!floorKey) continue;

    let floorZones: any[] = [];
    if (crowdCache && crowdCache[floorKey]) {
      const cached = crowdCache[floorKey];
      floorZones = Array.isArray(cached) ? cached : (cached.zones || []);
    } else {
      const bldg = floorKey.split('-')[0] || 'E';
      floorZones = MOCK_CROWD_ZONES_BY_FLOOR[floorKey] || getCrowdZonesForFloor(bldg, floorKey);
    }

    if (!floorZones || !floorZones.length) continue;

    for (const z of floorZones) {
      const zId = z.id || z.zone_id;
      if (zId === zoneId) {
        const level = (z.level || 'low').toLowerCase() as 'low' | 'moderate' | 'high';
        if (level === 'high') {
          return 'high';
        } else if (level === 'moderate') {
          maxLevel = 'moderate';
        }
        break;
      }
    }
  }

  return maxLevel;
}

export function getPathCrowdLevel(path: string[], crowdCache?: Record<string, any>): 'low' | 'moderate' | 'high' {
  if (path.length <= 1) return 'low';
  let maxLevel: 'low' | 'moderate' | 'high' = 'low';
  for (let i = 0; i < path.length - 1; i++) {
    const lvl = getEdgeCrowdLevel(path[i], path[i + 1], crowdCache);
    if (lvl === 'high') return 'high';
    if (lvl === 'moderate') maxLevel = 'moderate';
  }
  return maxLevel;
}

function findUnweightedPath(
  normStart: string,
  normEnd: string,
  profile: 'wheelchair' | 'blind' | 'standard',
  graph: Record<string, CampusGraphEdgeAdjacency[]>,
  nodesMap: Record<string, CampusGraphNode>
): string[] | null {
  const minCost: Record<string, number> = {};
  const previous: Record<string, string | null> = {};
  const visited = new Set<string>();

  for (const n of Object.keys(nodesMap)) {
    minCost[n] = Infinity;
    previous[n] = null;
  }
  minCost[normStart] = 0;

  const pq: Array<{ node: string; cost: number }> = [{ node: normStart, cost: 0 }];

  while (pq.length > 0) {
    pq.sort((a, b) => a.cost - b.cost);
    const current = pq.shift()!;

    if (visited.has(current.node)) continue;
    visited.add(current.node);

    if (current.node === normEnd) break;

    const neighbors = graph[current.node] || [];
    for (const neighbor of neighbors) {
      const targetMeta = (nodesMap[neighbor.to] || {}) as Partial<CampusGraphNode>;

      if (profile === 'wheelchair') {
        if (neighbor.type === 'stairs' || !neighbor.accessible) continue;
        if (targetMeta.accessible === false || targetMeta.barrier === 'no_ramp') continue;
      }

      let profileFactor = 1.0;
      if (profile === 'wheelchair') {
        if (neighbor.type === 'ramp') profileFactor = 0.85;
        else if (neighbor.type === 'elevator' || neighbor.to.includes('lift')) profileFactor = 0.80;
      } else if (profile === 'blind') {
        if (neighbor.tactile) profileFactor = 0.60;
        else if (neighbor.type === 'stairs') profileFactor = 1.80;
      }

      const edgeWeightedCost = neighbor.distance * profileFactor;
      const altCost = current.cost + edgeWeightedCost;

      if (altCost < minCost[neighbor.to]) {
        minCost[neighbor.to] = altCost;
        previous[neighbor.to] = current.node;
        pq.push({ node: neighbor.to, cost: altCost });
      }
    }
  }

  if (minCost[normEnd] === Infinity) return null;

  const path: string[] = [];
  let curr: string | null = normEnd;
  while (curr !== null) {
    path.unshift(curr);
    curr = previous[curr];
  }
  return path;
}

export interface CampusGraphEdgeAdjacency {
  to: string;
  distance: number;
  type: string;
  accessible: boolean;
  tactile?: boolean;
}

export interface CampusRouteOptions {
  customNodes?: Record<string, CampusGraphNode>;
  customEdges?: CampusGraphEdge[];
  crowdCache?: Record<string, any>;
}

export interface CampusNavigationResult {
  start_location: string;
  end_location: string;
  start_label?: string;
  end_label?: string;
  profile_used: string;
  total_distance_meters: number;
  estimated_time_minutes: number;
  path_nodes: string[];
  step_by_step_directions: string[];
  steps?: Array<{
    stepNumber: number;
    instruction: string;
    floorId: number;
    floorName: string;
    buildingId: string;
    distanceMeters: number;
    nodeId: string;
    nodeLabel: string;
    featureTypeUsed: string;
  }>;
  involved_floors?: Array<{
    key: string;
    buildingId: string;
    floor: number;
    floorName: string;
    floorPlanUrl?: string;
  }>;
  accessible_features: string[];
  voice_guidance: string;
  voice_navigation: string;
  crowd_advisory?: RouteCrowdAdvisory;
  fromNode: {
    id: string;
    name: string;
    floorId: number;
    buildingId: string;
    type: string;
    isAccessible: boolean;
    x: number;
    y: number;
  };
  toNode: {
    id: string;
    name: string;
    floorId: number;
    buildingId: string;
    type: string;
    isAccessible: boolean;
    x: number;
    y: number;
  };
}

function cleanLabel(label: string): string {
  if (!label) return '';
  let s = label;
  if (s.includes('(') && s.includes(')')) {
    const part = s.split('(')[0].trim();
    if (part.length >= 2 && !part.toLowerCase().startsWith('block')) {
      return part;
    }
  }
  s = s.replace(/Block\s+[A-Z]\s+Floor\s+\d+\s*[-—–]\s*/gi, '');
  s = s.replace(/Block\s+[A-Z]\s*[-—–]\s*/gi, '');
  s = s.replace(/\s*\((West|East)\)/gi, '');
  return s.trim();
}

export function computeCampusRoute(
  startId: string,
  endId: string,
  profile: 'wheelchair' | 'blind' | 'standard' = 'wheelchair',
  options?: CampusRouteOptions
): CampusNavigationResult | { error: string } {
  const normStart = startId.trim();
  const normEnd = endId.trim();

  const nodesMap = options?.customNodes || CAMPUS_NODES;
  const edgesList = options?.customEdges || CAMPUS_EDGES;

  if (!nodesMap[normStart] || !nodesMap[normEnd]) {
    return { error: `Invalid start ('${normStart}') or end ('${normEnd}') campus location.` };
  }

  // 1. Accessibility Pre-validation
  if (profile === 'wheelchair') {
    const startMeta = nodesMap[normStart];
    const endMeta = nodesMap[normEnd];
    if (startMeta && (!startMeta.accessible || startMeta.barrier === 'no_ramp')) {
      return { error: `Start location '${startMeta.label || normStart}' is not wheelchair-accessible.` };
    }
    if (endMeta && (!endMeta.accessible || endMeta.barrier === 'no_ramp')) {
      return { error: `Destination '${endMeta.label || normEnd}' has no wheelchair or step-free access.` };
    }
  }

  // Build Adjacency List
  const graph: Record<string, CampusGraphEdgeAdjacency[]> = {};
  for (const n of Object.keys(nodesMap)) {
    graph[n] = [];
  }

  for (const edge of edgesList) {
    const { from, to, distance, type } = edge;
    const isAccessible = edge.accessible !== false;
    const isTactile = edge.tactile === true;

    if (graph[from]) {
      graph[from].push({ to, distance, type, accessible: isAccessible, tactile: isTactile });
    }
    if (graph[to]) {
      graph[to].push({ to: from, distance, type, accessible: isAccessible, tactile: isTactile });
    }
  }

  // Dijkstra's Algorithm with Crowd & Accessibility Weighting
  // Priority queue tracking: { node, cost: weightedCost, dist: actualPhysicalDist }
  const minCost: Record<string, number> = {};
  const previous: Record<string, string | null> = {};
  const visited = new Set<string>();

  for (const n of Object.keys(nodesMap)) {
    minCost[n] = Infinity;
    previous[n] = null;
  }
  minCost[normStart] = 0;

  const pq: Array<{ node: string; cost: number; dist: number }> = [
    { node: normStart, cost: 0, dist: 0 }
  ];

  while (pq.length > 0) {
    pq.sort((a, b) => a.cost - b.cost);
    const current = pq.shift()!;

    if (visited.has(current.node)) continue;
    visited.add(current.node);

    if (current.node === normEnd) break;

    const neighbors = graph[current.node] || [];
    for (const neighbor of neighbors) {
      const targetMeta = (nodesMap[neighbor.to] || {}) as Partial<CampusGraphNode>;

      // 1. ABSOLUTE WHEELCHAIR CONSTRAINTS (Hard Pruning)
      if (profile === 'wheelchair') {
        if (neighbor.type === 'stairs' || !neighbor.accessible) {
          continue;
        }
        if (targetMeta.accessible === false || targetMeta.barrier === 'no_ramp') {
          continue;
        }
      }

      // 2. PROFILE FACTOR WEIGHTING
      let profileFactor = 1.0;
      if (profile === 'wheelchair') {
        if (neighbor.type === 'ramp') {
          profileFactor = 0.85; // Slight incentive for engineered ramps
        } else if (neighbor.type === 'elevator' || neighbor.to.includes('lift')) {
          profileFactor = 0.80; // High preference for vertical elevator transit over long ground detours
        }
      } else if (profile === 'blind') {
        if (neighbor.tactile) {
          profileFactor = 0.60; // Strong preference for tactile paved pathways
        } else if (neighbor.type === 'stairs') {
          profileFactor = 1.80; // Heavy penalty for unguided stair navigation
        }
      }

      // 3. CROWD MULTIPLIER (Identical to Python router)
      const crowdMultiplier = getEdgeCrowdPenalty(current.node, neighbor.to, options?.crowdCache);
      const edgeWeightedCost = neighbor.distance * profileFactor * crowdMultiplier;

      const altCost = current.cost + edgeWeightedCost;
      const altDist = current.dist + neighbor.distance;

      if (altCost < minCost[neighbor.to]) {
        minCost[neighbor.to] = altCost;
        previous[neighbor.to] = current.node;
        pq.push({ node: neighbor.to, cost: altCost, dist: altDist });
      }
    }
  }

  if (minCost[normEnd] === Infinity) {
    return { error: `No accessible route found between '${normStart}' and '${normEnd}' for ${profile} profile.` };
  }

  // Reconstruct path
  const path: string[] = [];
  let curr: string | null = normEnd;
  while (curr !== null) {
    path.unshift(curr);
    curr = previous[curr];
  }

  // Compute exact physical distance along the chosen path (untouched by crowd multiplier)
  let totalDist = 0;
  for (let k = 0; k < path.length - 1; k++) {
    const fromId = path[k];
    const toId = path[k + 1];
    const edgeObj = (graph[fromId] || []).find(e => e.to === toId);
    if (edgeObj) {
      totalDist += edgeObj.distance;
    }
  }

  const estMinutes = Math.max(1, Math.round(totalDist / 60));

  const startNode = nodesMap[normStart] || CAMPUS_NODES[normStart];
  const endNode = nodesMap[normEnd] || CAMPUS_NODES[normEnd];
  const startName = cleanLabel(startNode.label);
  const endName = cleanLabel(endNode.label);

  const condensedSteps: string[] = [];
  const involvedFloors: any[] = [];

  let i = 0;
  while (i < path.length - 1) {
    const currId = path[i];
    const currInfo = nodesMap[currId] || CAMPUS_NODES[currId] || { floor: 0, building_id: 'campus' };
    const currFloor = currInfo.floor;
    const currBldg = currInfo.building_id;

    const floorKey = `${currBldg}_f${currFloor}`;
    if (!involvedFloors.some(f => f.key === floorKey)) {
      involvedFloors.push({
        key: floorKey,
        buildingId: currBldg,
        floor: currFloor,
        floorName: currFloor > 0 ? `Floor ${currFloor}` : 'Ground Floor',
        floorPlanUrl: `/maps/floors/${currBldg}/floor_${currFloor}.png`
      });
    }

    const nextId = path[i + 1];
    let edgeType = 'corridor';
    for (const e of graph[currId] || []) {
      if (e.to === nextId) {
        edgeType = e.type;
        break;
      }
    }

    // 1. Elevator collapse
    if (edgeType === 'elevator' || currId.includes('lift')) {
      let j = i + 1;
      while (j < path.length) {
        let eType = 'corridor';
        for (const e of graph[path[j - 1]] || []) {
          if (e.to === path[j]) {
            eType = e.type;
            break;
          }
        }
        if (eType === 'elevator' || path[j].includes('lift')) {
          j++;
        } else {
          break;
        }
      }

      const destLiftNode = nodesMap[path[j - 1]] || CAMPUS_NODES[path[j - 1]] || { floor: 0 };
      const destFloor = destLiftNode.floor;
      const liftName = currId.includes('lift2') ? 'Lift 2' : currId.includes('lift3') ? 'Lift 3' : currId.includes('lift4') ? 'Lift 4' : 'Lift 1';
      const floorStr = destFloor > 0 ? `Floor ${destFloor}` : 'Ground Floor';

      if (destFloor < currFloor) {
        condensedSteps.push(`Take ${liftName} down to ${floorStr}.`);
      } else if (destFloor > currFloor) {
        condensedSteps.push(`Take ${liftName} up to ${floorStr}.`);
      } else {
        condensedSteps.push(`Take ${liftName} to ${floorStr}.`);
      }
      i = Math.max(i + 1, j - 1);
      continue;
    }

    // 2. Stairs collapse
    if (edgeType === 'stairs' || currId.includes('stairs')) {
      let j = i + 1;
      while (j < path.length) {
        let eType = 'corridor';
        for (const e of graph[path[j - 1]] || []) {
          if (e.to === path[j]) {
            eType = e.type;
            break;
          }
        }
        if (eType === 'stairs' || path[j].includes('stairs')) {
          j++;
        } else {
          break;
        }
      }
      const destStNode = nodesMap[path[j - 1]] || CAMPUS_NODES[path[j - 1]] || { floor: 0 };
      const destFloor = destStNode.floor || 0;
      const floorStr = destFloor > 0 ? `Floor ${destFloor}` : 'Ground Floor';
      if (destFloor < currFloor) {
        condensedSteps.push(`Take the stairs down to ${floorStr}.`);
      } else {
        condensedSteps.push(`Take the stairs up to ${floorStr}.`);
      }
      i = Math.max(i + 1, j - 1);
      continue;
    }

    // 3. Bridge Crossing (Only between different buildings: E<->D or D<->C)
    const targetInfo = nodesMap[nextId] || CAMPUS_NODES[nextId] || { building_id: 'campus' };
    const targetBldg = targetInfo.building_id || 'campus';
    const isInterBuildingBridge = (edgeType === 'bridge' || currId.includes('bridge') || nextId.includes('bridge')) && (currBldg !== targetBldg && currBldg !== 'campus' && targetBldg !== 'campus' && currBldg !== 'outdoor' && targetBldg !== 'outdoor');

    if (isInterBuildingBridge) {
      const bldgName = targetBldg.replace('block_', 'Block ').toUpperCase();
      condensedSteps.push(`Cross the connecting bridge into ${bldgName}.`);
      i++;
      continue;
    }

    // 4. Walking corridors
    if (i === 0) {
      const nextNodeInfo = nodesMap[nextId] || CAMPUS_NODES[nextId] || { label: '' };
      condensedSteps.push(`From ${startName}, head down the hallway towards ${cleanLabel(nextNodeInfo.label || '')}.`);
    } else if (i === path.length - 2) {
      condensedSteps.push(`Proceed to ${endName}.`);
    } else {
      const nextNodeInfo = nodesMap[nextId] || CAMPUS_NODES[nextId] || { label: '' };
      const nextLabel = cleanLabel(nextNodeInfo.label || '');
      if (['lift', 'stairs', 'bridge', 'entrance', 'roundabout'].some(k => nextId.includes(k))) {
        condensedSteps.push(`Head towards ${nextLabel}.`);
      }
    }
    i++;
  }

  if (!condensedSteps.length || !condensedSteps[condensedSteps.length - 1].includes(endName)) {
    condensedSteps.push(`Arrive at ${endName}.`);
  }

  // Deduplicate
  const deduped: string[] = [];
  for (const s of condensedSteps) {
    if (!deduped.length || deduped[deduped.length - 1] !== s) {
      deduped.push(s);
    }
  }

  const stepsObjs = deduped.map((stepText, idx) => ({
    stepNumber: idx + 1,
    instruction: stepText,
    floorId: startNode.floor,
    floorName: startNode.floor > 0 ? `Floor ${startNode.floor}` : 'Ground Floor',
    buildingId: startNode.building_id,
    distanceMeters: Math.round(totalDist / deduped.length),
    nodeId: path[Math.min(idx, path.length - 1)],
    nodeLabel: stepText,
    featureTypeUsed: stepText.toLowerCase().includes('lift') || stepText.toLowerCase().includes('elevator') ? 'elevator' : stepText.toLowerCase().includes('bridge') ? 'bridge' : stepText.toLowerCase().includes('stairs') ? 'stairs' : 'corridor'
  }));

  // Compute crowd advisory metadata
  const chosenCrowdLevel = getPathCrowdLevel(path, options?.crowdCache);
  const unweightedPath = findUnweightedPath(normStart, normEnd, profile, graph, nodesMap);

  let avoidedCongestion = false;
  if (unweightedPath && unweightedPath.join(',') !== path.join(',')) {
    const unweightedLevel = getPathCrowdLevel(unweightedPath, options?.crowdCache);
    if (unweightedLevel === 'moderate' || unweightedLevel === 'high') {
      avoidedCongestion = true;
    }
  }

  const crowdAdvisory: RouteCrowdAdvisory = avoidedCongestion
    ? {
        avoided_congestion: true,
        crowd_level: chosenCrowdLevel,
        summary: 'Less crowded accessible route recommended',
        advisory: 'Slightly longer, but currently less crowded'
      }
    : {
        avoided_congestion: false,
        crowd_level: chosenCrowdLevel,
        summary: chosenCrowdLevel === 'low' ? 'Clear accessible route' : `Crowd level: ${chosenCrowdLevel.charAt(0).toUpperCase() + chosenCrowdLevel.slice(1)}`
      };

  // Build high-quality natural spoken guidance
  const voiceParts: string[] = [];
  voiceParts.push(`Starting navigation from ${startName} to ${endName}.`);

  const hasEastLift = path.some(n => n.includes('lift3') || n.includes('lift4'));
  const hasWestLift = path.some(n => n.includes('lift1') || n.includes('lift2'));
  const hasStairs = path.some(n => n.includes('stairs'));

  if (avoidedCongestion) {
    if (hasEastLift) {
      voiceParts.push("Live crowd advisory: West Lifts 1 and 2 are currently congested with high foot traffic. You are routed via East Lifts 3 and 4 which is clear.");
    } else if (hasStairs && profile !== 'wheelchair') {
      voiceParts.push("Live crowd alert: Elevators have high waiting times. Routed via clear staircase for faster transit.");
    } else {
      voiceParts.push("Live crowd alert: Navigating via the less crowded accessible pathway.");
    }
  } else if (hasWestLift) {
    voiceParts.push("West Lifts 1 and 2 are operating with normal foot traffic.");
  }

  for (const s of deduped) {
    voiceParts.push(s);
  }
  voiceParts.push(`Total walking distance is ${totalDist} meters.`);
  const voiceMsg = voiceParts.join(' ');

  return {
    start_location: normStart,
    end_location: normEnd,
    start_label: startNode.label,
    end_label: endNode.label,
    profile_used: profile,
    total_distance_meters: totalDist,
    estimated_time_minutes: estMinutes,
    path_nodes: path,
    step_by_step_directions: deduped,
    steps: stepsObjs,
    involved_floors: involvedFloors,
    accessible_features: profile === 'wheelchair' ? ['Wheelchair Ramps & Bridges', 'Lifts Active'] : ['Tactile Guides'],
    voice_guidance: voiceMsg,
    voice_navigation: voiceMsg,
    crowd_advisory: crowdAdvisory,
    fromNode: {
      id: normStart,
      name: startNode.label,
      floorId: startNode.floor,
      buildingId: startNode.building_id,
      type: startNode.type,
      isAccessible: startNode.accessible,
      x: startNode.coords.x,
      y: startNode.coords.y
    },
    toNode: {
      id: normEnd,
      name: endNode.label,
      floorId: endNode.floor,
      buildingId: endNode.building_id,
      type: endNode.type,
      isAccessible: endNode.accessible,
      x: endNode.coords.x,
      y: endNode.coords.y
    }
  };
}
