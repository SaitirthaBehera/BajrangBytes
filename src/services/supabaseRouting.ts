import { supabase } from '../lib/supabase';
import { DisabilityProfile, RouteResult } from '../types';

export interface SupabaseCampusNode {
  id: string;
  label: string;
  building_id: string;
  floor: number;
  type: string;
  accessible: boolean;
  coord_x?: number;
  coord_y?: number;
  features?: string[];
  barrier?: string;
  created_at?: string;
}

export interface SupabaseCampusEdge {
  id: number | string;
  from_node_id: string;
  to_node_id: string;
  distance: number;
  type: string;
  accessible: boolean;
  tactile?: boolean;
  warning?: string;
  created_at?: string;
}

export interface HierarchicalRoom {
  id: string;
  name: string;
  floor: number;
  buildingId: string;
  buildingName: string;
  type: string;
  isAccessible: boolean;
  coordinates?: { x: number; y: number };
  barrier?: string;
}

export interface HierarchicalFloor {
  floorId: number;
  name: string;
  rooms: HierarchicalRoom[];
}

export interface HierarchicalBuilding {
  id: string;
  name: string;
  code: string;
  floors: HierarchicalFloor[];
}

export interface CalculatedRouteResponse {
  status: 'success' | 'error';
  start_location: string;
  end_location: string;
  start_node?: SupabaseCampusNode;
  end_node?: SupabaseCampusNode;
  profile_used: string;
  total_distance_meters: number;
  estimated_time_minutes: number;
  path_nodes: string[];
  step_by_step_directions: string[];
  voice_navigation: string;
  floors_involved: number[];
  floor_transitions: Array<{
    from_floor: number;
    to_floor: number;
    transition_type: string;
    node?: string;
    description: string;
  }>;
  features_used: string[];
  warnings: string[];
  error?: string;
}

// Friendly name map for known building codes in Supabase
export const BUILDING_NAMES_MAP: Record<string, { name: string; code: string }> = {
  block_e: { name: 'Block E', code: 'BLK-E' },
  block_c: { name: 'Block C', code: 'BLK-C' },
  block_d: { name: 'Block D', code: 'BLK-D' },
  block_a: { name: 'Block A', code: 'BLK-A' },
  block_b: { name: 'Block B', code: 'BLK-B' },
  block_f: { name: 'Block F', code: 'BLK-F' },
  library: { name: 'Central Library', code: 'LIB' },
  auditorium: { name: 'Auditorium', code: 'AUD' },
  sc_block: { name: 'SC Block', code: 'SC' },
  ds_block: { name: 'Data Science Block', code: 'DS' },
  outdoor: { name: 'Campus Grounds', code: 'OUTDOOR' },
  soa_iter_campus: { name: 'Campus Grounds', code: 'ITER' },
  'bldg-iter-main': { name: 'Main Complex', code: 'MAIN' },
  'bldg-sum-hospital': { name: 'SUM Hospital', code: 'SUM' },
  'bldg-admin-block': { name: 'Admin Block', code: 'ADM' }
};

/**
 * Clean and simplify room/point labels for dropdown selectors
 * e.g., 'C-115 (Block C Floor 1)' -> 'C-115'
 *       'Block C Floor 1 — C-110 (Boy\'s Restroom)' -> 'C-110 (Boy\'s Restroom)'
 *       'Block E Floor 0 — Lift 1 (West)' -> 'Lift 1 (West)'
 */
export function formatCleanRoomName(label: string): string {
  if (!label) return '';
  let cleaned = label.trim();

  // If label is 'Block C (Football Ground Entrance)' -> 'Football Ground Entrance'
  const entranceParenMatch = cleaned.match(/^Block\s+[A-Z]\s*\((.+?)\)$/i);
  if (entranceParenMatch) {
    return entranceParenMatch[1].trim();
  }

  // Remove (Block X Floor Y) or (Block X) or (Floor X) or (Ground)
  cleaned = cleaned.replace(/\s*\((?:Block\s+[A-Z]\s+Floor\s+\d+|Block\s+[A-Z]|Floor\s+\d+|Level\s+\d+|Ground)\)/gi, '');

  // Remove 'Block C Floor 1 — ' or 'Block C Floor 0 - ' or 'Block E — '
  cleaned = cleaned.replace(/^Block\s+[A-Z]\s+(?:Floor\s+\d+|Ground)\s*[—–-]\s*/i, '');
  cleaned = cleaned.replace(/^Block\s+[A-Z]\s*[—–-]\s*/i, '');

  // Clean entrances
  cleaned = cleaned.replace(/^Block\s+[A-Z]\s+Main Entrance/i, 'Main Entrance');
  cleaned = cleaned.replace(/^Block\s+[A-Z]\s+Entrance/i, 'Main Entrance');
  cleaned = cleaned.replace(/^Block\s+[A-Z]\s+Floor\s+\d+\s+External Entrance/i, 'External Entrance');
  cleaned = cleaned.replace(/^Block\s+[A-Z]\s+Floor\s+\d+\s+/i, '');
  cleaned = cleaned.replace(/^Block\s+[A-Z]\s+/i, '');

  return cleaned.trim() || label;
}

/**
 * Format complete location context for navigation and route results:
 * "Block / Building — Floor — Room / Point / Location"
 * Examples:
 * - "Block C — Floor 1 — C-115"
 * - "Block D — Floor 1 — Bridge to Block E"
 * - "Block E — Ground Floor — West Corridor"
 * - "Main Campus Entrance" / "Cricket Ground" (for outdoor grounds)
 */
export function formatFullLocationLabel(
  nodeId?: string,
  node?: SupabaseCampusNode | null,
  allNodesList?: SupabaseCampusNode[]
): string {
  if (!nodeId && !node) return 'Unknown Waypoint';

  let foundNode = node;
  if (!foundNode && allNodesList && nodeId) {
    foundNode = allNodesList.find(n => n.id === nodeId);
  }
  if (!foundNode && cachedNodes && nodeId) {
    foundNode = cachedNodes.find(n => n.id === nodeId);
  }

  if (foundNode) {
    const cleanRoom = formatCleanRoomName(foundNode.label || foundNode.id);
    const bldgId = foundNode.building_id || 'outdoor';
    const bldgMeta = BUILDING_NAMES_MAP[bldgId];
    const bldgName = bldgMeta?.name || bldgId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const floorNum = typeof foundNode.floor === 'number' ? foundNode.floor : ((foundNode as unknown as { floor_id?: number }).floor_id ?? 0);
    const floorName = floorNum === 0 ? 'Ground Floor' : `Floor ${floorNum}`;

    // If outdoor campus point without specific building
    if (bldgId === 'outdoor' || bldgId === 'soa_iter_campus') {
      return cleanRoom;
    }

    return `${bldgName} — ${floorName} — ${cleanRoom}`;
  }

  // Fallback if node not found
  return formatCleanRoomName(String(nodeId).replace(/_/g, ' '));
}

let cachedNodes: SupabaseCampusNode[] | null = null;
let cachedEdges: SupabaseCampusEdge[] | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60000; // 1 minute cache

/**
 * Fetch all nodes from Supabase (queries campus_nodes ONLY)
 */
export async function fetchSupabaseNodes(forceRefresh = false): Promise<SupabaseCampusNode[]> {
  const now = Date.now();
  if (!forceRefresh && cachedNodes && cachedNodes.length > 0 && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedNodes;
  }

  try {
    const { data: campusNodes, error: cnErr } = await supabase
      .from('campus_nodes')
      .select('*');

    if (cnErr) {
      console.error('[SupabaseRouting] Error querying campus_nodes from Supabase:', cnErr.message);
      throw new Error(`Failed to query campus_nodes: ${cnErr.message}`);
    }

    if (campusNodes && campusNodes.length > 0) {
      cachedNodes = campusNodes.map(n => ({
        id: String(n.id || n.node_id),
        label: n.label || n.name || n.id,
        building_id: n.building_id || n.buildingId || 'outdoor',
        floor: typeof n.floor === 'number' ? n.floor : 0,
        type: n.type || 'room',
        accessible: n.accessible ?? true,
        coord_x: n.coord_x ?? n.x,
        coord_y: n.coord_y ?? n.y,
        barrier: n.barrier,
        features: n.features
      }));
      lastFetchTime = now;
      return cachedNodes;
    }
  } catch (err) {
    console.error('[SupabaseRouting] Error fetching campus_nodes:', err);
    throw err;
  }

  return cachedNodes || [];
}

/**
 * Fetch all edges from Supabase (queries campus_edges ONLY)
 */
export async function fetchSupabaseEdges(forceRefresh = false): Promise<SupabaseCampusEdge[]> {
  const now = Date.now();
  if (!forceRefresh && cachedEdges && cachedEdges.length > 0 && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedEdges;
  }

  try {
    const { data: campusEdges, error: ceErr } = await supabase
      .from('campus_edges')
      .select('*');

    if (ceErr) {
      console.error('[SupabaseRouting] Error querying campus_edges from Supabase:', ceErr.message);
      throw new Error(`Failed to query campus_edges: ${ceErr.message}`);
    }

    if (campusEdges && campusEdges.length > 0) {
      cachedEdges = campusEdges.map(e => ({
        id: e.id,
        from_node_id: String(e.from_node_id || e.from || e.fromNodeId),
        to_node_id: String(e.to_node_id || e.to || e.toNodeId),
        distance: typeof e.distance === 'number' ? e.distance : (Number(e.distanceMeters) || 10),
        type: e.type || 'pathway',
        accessible: e.accessible ?? (e.type !== 'stairs'),
        tactile: e.tactile,
        warning: e.warning
      }));
      return cachedEdges;
    }
  } catch (err) {
    console.error('[SupabaseRouting] Error fetching campus_edges:', err);
    throw err;
  }

  return cachedEdges || [];
}

/**
 * Derives the dynamic 3-step hierarchy (Building -> Floors -> Rooms/Points)
 * strictly from the Supabase database nodes.
 */
export async function getSupabaseBuildingHierarchy(): Promise<HierarchicalBuilding[]> {
  const nodes = await fetchSupabaseNodes();

  const buildingsMap = new Map<string, Map<number, HierarchicalRoom[]>>();

  nodes.forEach(node => {
    const bId = node.building_id || 'outdoor';
    const floor = node.floor ?? 0;

    if (!buildingsMap.has(bId)) {
      buildingsMap.set(bId, new Map<number, HierarchicalRoom[]>());
    }

    const floorsMap = buildingsMap.get(bId)!;
    if (!floorsMap.has(floor)) {
      floorsMap.set(floor, []);
    }

    const bldgMeta = BUILDING_NAMES_MAP[bId] || {
      name: bId.replace(/_/g, ' ').toUpperCase(),
      code: bId.toUpperCase()
    };

    floorsMap.get(floor)!.push({
      id: node.id,
      name: node.label,
      floor,
      buildingId: bId,
      buildingName: bldgMeta.name,
      type: node.type,
      isAccessible: node.accessible,
      coordinates: node.coord_x !== undefined && node.coord_y !== undefined 
        ? { x: node.coord_x, y: node.coord_y } 
        : undefined,
      barrier: node.barrier
    });
  });

  // Convert map to sorted hierarchical buildings array
  const result: HierarchicalBuilding[] = [];

  // Preferred display order for buildings
  const order = ['block_e', 'block_c', 'block_d', 'block_a', 'block_b', 'block_f', 'library', 'auditorium', 'sc_block', 'ds_block', 'outdoor'];

  const allBldgIds = Array.from(buildingsMap.keys()).sort((a, b) => {
    const idxA = order.indexOf(a);
    const idxB = order.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });

  for (const bId of allBldgIds) {
    const floorsMap = buildingsMap.get(bId)!;
    const bldgMeta = BUILDING_NAMES_MAP[bId] || {
      name: bId.replace(/_/g, ' ').toUpperCase(),
      code: bId.toUpperCase()
    };

    const sortedFloorNums = Array.from(floorsMap.keys()).sort((a, b) => a - b);
    const floors: HierarchicalFloor[] = sortedFloorNums.map(floorNum => {
      const rooms = floorsMap.get(floorNum)!;
      // Sort rooms: entrances & lifts first, then numbered rooms
      rooms.sort((r1, r2) => {
        if (r1.type === 'entrance' && r2.type !== 'entrance') return -1;
        if (r1.type !== 'entrance' && r2.type === 'entrance') return 1;
        if (r1.type === 'lift' && r2.type !== 'lift') return -1;
        if (r1.type !== 'lift' && r2.type === 'lift') return 1;
        return r1.name.localeCompare(r2.name);
      });

      return {
        floorId: floorNum,
        name: floorNum === 0 ? 'Ground Floor' : `Floor ${floorNum}`,
        rooms
      };
    });

    result.push({
      id: bId,
      name: bldgMeta.name,
      code: bldgMeta.code,
      floors
    });
  }

  return result;
}

/**
 * Calculates Dijkstra Accessible Route directly on the Supabase nodes & edges dataset
 */
export async function calculateRouteFromSupabase(
  startNodeId: string,
  targetNodeId: string,
  profile: 'wheelchair' | 'blind' | 'standard' = 'wheelchair'
): Promise<CalculatedRouteResponse> {
  const nodes = await fetchSupabaseNodes();
  const edges = await fetchSupabaseEdges();

  if (!nodes || nodes.length === 0 || !edges || edges.length === 0) {
    return {
      status: 'error',
      start_location: startNodeId,
      end_location: targetNodeId,
      profile_used: profile,
      total_distance_meters: 0,
      estimated_time_minutes: 0,
      path_nodes: [],
      step_by_step_directions: [],
      voice_navigation: '',
      floors_involved: [],
      floor_transitions: [],
      features_used: [],
      warnings: [],
      error: 'Failed to load routing data from Supabase campus_nodes or campus_edges tables.'
    };
  }

  const nodeMap = new Map<string, SupabaseCampusNode>();
  nodes.forEach(n => nodeMap.set(n.id, n));

  const startNode = nodeMap.get(startNodeId);
  const targetNode = nodeMap.get(targetNodeId);

  if (!startNode || !targetNode) {
    return {
      status: 'error',
      start_location: startNodeId,
      end_location: targetNodeId,
      profile_used: profile,
      total_distance_meters: 0,
      estimated_time_minutes: 0,
      path_nodes: [],
      step_by_step_directions: [],
      voice_navigation: '',
      floors_involved: [],
      floor_transitions: [],
      features_used: [],
      warnings: [],
      error: `Could not locate starting waypoint ('${startNodeId}') or destination ('${targetNodeId}') in Supabase database.`
    };
  }

  if (startNodeId === targetNodeId) {
    return {
      status: 'success',
      start_location: startNodeId,
      end_location: targetNodeId,
      start_node: startNode,
      end_node: targetNode,
      profile_used: profile,
      total_distance_meters: 0,
      estimated_time_minutes: 0,
      path_nodes: [startNodeId],
      step_by_step_directions: [`You are currently at ${startNode.label}.`],
      voice_navigation: `You are already at ${startNode.label}.`,
      floors_involved: [startNode.floor],
      floor_transitions: [],
      features_used: [],
      warnings: []
    };
  }

  // Wheelchair barrier checks at terminals
  if (profile === 'wheelchair') {
    if (!startNode.accessible || startNode.type === 'stairs' || startNode.barrier === 'no_ramp' || startNode.barrier === 'stairs_only') {
      return {
        status: 'error',
        start_location: startNodeId,
        end_location: targetNodeId,
        start_node: startNode,
        end_node: targetNode,
        profile_used: profile,
        total_distance_meters: 0,
        estimated_time_minutes: 0,
        path_nodes: [],
        step_by_step_directions: [],
        voice_navigation: '',
        floors_involved: [],
        floor_transitions: [],
        features_used: [],
        warnings: [],
        error: `Starting location '${startNode.label}' is stairs-only with no wheelchair ramp.`
      };
    }

    if (!targetNode.accessible || targetNode.type === 'stairs' || targetNode.barrier === 'no_ramp' || targetNode.barrier === 'stairs_only') {
      return {
        status: 'error',
        start_location: startNodeId,
        end_location: targetNodeId,
        start_node: startNode,
        end_node: targetNode,
        profile_used: profile,
        total_distance_meters: 0,
        estimated_time_minutes: 0,
        path_nodes: [],
        step_by_step_directions: [],
        voice_navigation: '',
        floors_involved: [],
        floor_transitions: [],
        features_used: [],
        warnings: [],
        error: `Destination '${targetNode.label}' cannot be reached by wheelchair (stairs-only access with no ramp or elevator).`
      };
    }
  }

  // Build Adjacency Graph from Supabase edges
  const adj = new Map<string, Array<{ to: string; distance: number; type: string; accessible: boolean; tactile?: boolean; warning?: string }>>();
  nodes.forEach(n => adj.set(n.id, []));

  edges.forEach(edge => {
    if (!adj.has(edge.from_node_id)) adj.set(edge.from_node_id, []);
    if (!adj.has(edge.to_node_id)) adj.set(edge.to_node_id, []);

    let isAcc = edge.accessible ?? true;
    if (edge.type === 'stairs') isAcc = false;
    if (edge.type === 'lift' || edge.type === 'elevator' || edge.type === 'ramp' || edge.type === 'bridge') isAcc = true;

    adj.get(edge.from_node_id)!.push({
      to: edge.to_node_id,
      distance: edge.distance,
      type: edge.type,
      accessible: isAcc,
      tactile: edge.tactile,
      warning: edge.warning
    });

    adj.get(edge.to_node_id)!.push({
      to: edge.from_node_id,
      distance: edge.distance,
      type: edge.type,
      accessible: isAcc,
      tactile: edge.tactile,
      warning: edge.warning
    });
  });

  // Dijkstra Shortest Path Search
  const distances = new Map<string, number>();
  const actualDists = new Map<string, number>();
  const previous = new Map<string, { prevId: string; edgeType: string; edgeDist: number; tactile?: boolean; warning?: string }>();
  const unvisited = new Set<string>();

  nodes.forEach(n => {
    distances.set(n.id, Infinity);
    actualDists.set(n.id, Infinity);
    unvisited.add(n.id);
  });
  distances.set(startNodeId, 0);
  actualDists.set(startNodeId, 0);

  while (unvisited.size > 0) {
    let currentId: string | null = null;
    let minCost = Infinity;

    unvisited.forEach(nodeId => {
      const c = distances.get(nodeId) ?? Infinity;
      if (c < minCost) {
        minCost = c;
        currentId = nodeId;
      }
    });

    if (!currentId || minCost === Infinity || currentId === targetNodeId) {
      break;
    }

    unvisited.delete(currentId);
    const currActualDist = actualDists.get(currentId) || 0;

    const neighbors = adj.get(currentId) || [];
    for (const neighbor of neighbors) {
      if (!unvisited.has(neighbor.to)) continue;

      const neighborNode = nodeMap.get(neighbor.to);

      // 1. Wheelchair Profile Constraints
      if (profile === 'wheelchair') {
        if (!neighbor.accessible || neighbor.type === 'stairs') continue;
        if (neighborNode && (!neighborNode.accessible || neighborNode.type === 'stairs')) continue;

        let weight = neighbor.distance;
        if (neighbor.type === 'lift' || neighbor.type === 'elevator') {
          weight = 5; // Low friction for elevators
        } else if (neighbor.type === 'ramp' || neighbor.type === 'bridge') {
          weight = neighbor.distance * 1.0;
        }

        const newDist = minCost + weight;
        if (newDist < (distances.get(neighbor.to) ?? Infinity)) {
          distances.set(neighbor.to, newDist);
          actualDists.set(neighbor.to, currActualDist + neighbor.distance);
          previous.set(neighbor.to, {
            prevId: currentId,
            edgeType: neighbor.type,
            edgeDist: neighbor.distance,
            tactile: neighbor.tactile,
            warning: neighbor.warning
          });
        }
      }
      // 2. Visually Impaired (Blind) Constraints
      else if (profile === 'blind') {
        let weight = neighbor.distance;
        if (neighbor.tactile) {
          weight *= 0.7; // Prefer tactile paving
        } else {
          weight *= 1.4; // Penalty without tactile
        }
        if (neighbor.type === 'stairs') {
          weight *= 2.5; // Heavy stairs hazard penalty
        }

        const newDist = minCost + weight;
        if (newDist < (distances.get(neighbor.to) ?? Infinity)) {
          distances.set(neighbor.to, newDist);
          actualDists.set(neighbor.to, currActualDist + neighbor.distance);
          previous.set(neighbor.to, {
            prevId: currentId,
            edgeType: neighbor.type,
            edgeDist: neighbor.distance,
            tactile: neighbor.tactile,
            warning: neighbor.warning
          });
        }
      }
      // 3. Standard Mobility Constraints
      else {
        let weight = neighbor.distance;
        const newDist = minCost + weight;
        if (newDist < (distances.get(neighbor.to) ?? Infinity)) {
          distances.set(neighbor.to, newDist);
          actualDists.set(neighbor.to, currActualDist + neighbor.distance);
          previous.set(neighbor.to, {
            prevId: currentId,
            edgeType: neighbor.type,
            edgeDist: neighbor.distance,
            tactile: neighbor.tactile,
            warning: neighbor.warning
          });
        }
      }
    }
  }

  if (distances.get(targetNodeId) === Infinity) {
    return {
      status: 'error',
      start_location: startNodeId,
      end_location: targetNodeId,
      start_node: startNode,
      end_node: targetNode,
      profile_used: profile,
      total_distance_meters: 0,
      estimated_time_minutes: 0,
      path_nodes: [],
      step_by_step_directions: [],
      voice_navigation: '',
      floors_involved: [],
      floor_transitions: [],
      features_used: [],
      warnings: [],
      error: `No barrier-free route found connecting '${startNode.label}' to '${targetNode.label}' under the ${profile.toUpperCase()} profile.`
    };
  }

  // Reconstruct path
  const path: string[] = [];
  const pathEdgeTypes: string[] = [];
  let curr: string | undefined = targetNodeId;

  while (curr) {
    path.unshift(curr);
    const p = previous.get(curr);
    if (p) {
      pathEdgeTypes.unshift(p.edgeType);
      curr = p.prevId;
    } else {
      curr = undefined;
    }
  }

  const totalDistance = actualDists.get(targetNodeId) || 0;
  const speedMps = profile === 'standard' ? 1.2 : 0.65;
  const estimatedTime = Math.max(1, Math.round((totalDistance / speedMps) / 60));

  // Determine floors involved & multi-floor transitions
  const floorsSet = new Set<number>();
  const floorTransitions: Array<{ from_floor: number; to_floor: number; transition_type: string; node?: string; description: string }> = [];
  const featuresUsedSet = new Set<string>();
  const warningsList: string[] = [];

  for (let i = 0; i < path.length; i++) {
    const node = nodeMap.get(path[i]);
    if (node) {
      floorsSet.add(node.floor);
      if (node.type === 'lift') featuresUsedSet.add('Voice Passenger Elevator');
      if (node.type === 'bridge') featuresUsedSet.add('Horizontal Skybridge');
      if (node.type === 'entrance' && node.accessible) featuresUsedSet.add('Step-Free Ramp Entry');
    }

    if (i > 0) {
      const prevNode = nodeMap.get(path[i - 1]);
      const edgeType = pathEdgeTypes[i - 1];
      const prevInfo = previous.get(path[i]);

      if (prevInfo?.warning) warningsList.push(prevInfo.warning);
      if (prevInfo?.tactile) featuresUsedSet.add('Tactile Ground Surface');

      if (prevNode && node && prevNode.floor !== node.floor) {
        const transType = (edgeType === 'lift' || edgeType === 'elevator') ? 'elevator' : edgeType;
        const prevLoc = formatFullLocationLabel(prevNode.id, prevNode);
        const nextLoc = formatFullLocationLabel(node.id, node);
        floorTransitions.push({
          from_floor: prevNode.floor,
          to_floor: node.floor,
          transition_type: transType,
          node: node.id,
          description: `Transition from ${prevLoc} to ${nextLoc} via ${transType === 'elevator' ? 'Voice Passenger Elevator' : transType}`
        });
      }
    }
  }

  if (featuresUsedSet.size === 0) {
    featuresUsedSet.add('Step-Free Corridors');
  }

  // Generate Step-by-Step Directions with complete location context
  const directions: string[] = [];
  for (let i = 0; i < path.length; i++) {
    const node = nodeMap.get(path[i])!;
    const fullLoc = formatFullLocationLabel(node.id, node);

    if (i === 0) {
      directions.push(`Start at ${fullLoc}.`);
    } else {
      const prevNode = nodeMap.get(path[i - 1])!;
      const edgeType = pathEdgeTypes[i - 1];
      const prevInfo = previous.get(path[i]);
      const dist = prevInfo?.edgeDist || 10;

      if (edgeType === 'lift' || edgeType === 'elevator' || prevNode.floor !== node.floor) {
        directions.push(`Take the voice passenger elevator to ${fullLoc}.`);
      } else if (edgeType === 'bridge') {
        directions.push(`Cross the covered horizontal accessible skybridge to ${fullLoc} (${dist}m).`);
      } else if (edgeType === 'ramp') {
        directions.push(`Navigate along the wheelchair-accessible ramp to ${fullLoc} (${dist}m).`);
      } else if (edgeType === 'stairs') {
        directions.push(`Take the stairs to ${fullLoc} (${dist}m).`);
      } else {
        directions.push(`Proceed along the ${node.type === 'corridor' ? 'main hallway' : 'pathway'} to ${fullLoc} (${dist}m).`);
      }
    }
  }

  const startFullLoc = formatFullLocationLabel(startNode.id, startNode);
  const targetFullLoc = formatFullLocationLabel(targetNode.id, targetNode);

  // Voice navigation script
  const voiceNav = `Accessible route confirmed from ${startFullLoc} to ${targetFullLoc}. Total distance is ${totalDistance} meters, estimated at ${estimatedTime} minutes. ${floorTransitions.length > 0 ? `Includes ${floorTransitions.length} multi-floor transition via voice elevator and connecting skybridges.` : 'Continuous level ground access.'} Follow step 1: ${directions[0]}`;

  return {
    status: 'success',
    start_location: startNodeId,
    end_location: targetNodeId,
    start_node: startNode,
    end_node: targetNode,
    profile_used: profile,
    total_distance_meters: totalDistance,
    estimated_time_minutes: estimatedTime,
    path_nodes: path,
    step_by_step_directions: directions,
    voice_navigation: voiceNav,
    floors_involved: Array.from(floorsSet).sort((a, b) => a - b),
    floor_transitions: floorTransitions,
    features_used: Array.from(featuresUsedSet),
    warnings: Array.from(new Set(warningsList))
  };
}
