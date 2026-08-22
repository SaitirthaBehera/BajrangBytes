import graphData from '../data/unified_graph.json';

export interface CampusGraphNode {
  id: string;
  label: string;
  building_id: string;
  floor: number;
  type: string;
  accessible: boolean;
  coords: { x: number; y: number };
}

export interface CampusGraphEdge {
  from: string;
  to: string;
  distance: number;
  type: string;
  accessible: boolean;
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
    coords: n.coords || { x: 50, y: 50 }
  };
}

export const CAMPUS_EDGES: CampusGraphEdge[] = (graphData.edges as any[]).map(e => ({
  from: e.from,
  to: e.to,
  distance: e.distance,
  type: e.type || 'corridor',
  accessible: e.accessible !== false
}));

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
  profile: 'wheelchair' | 'blind' | 'standard' = 'wheelchair'
): CampusNavigationResult | { error: string } {
  const normStart = startId.trim();
  const normEnd = endId.trim();

  if (!CAMPUS_NODES[normStart] || !CAMPUS_NODES[normEnd]) {
    return { error: `Invalid start ('${normStart}') or end ('${normEnd}') campus location.` };
  }

  // Build Adjacency List
  const graph: Record<string, Array<{ to: string; distance: number; type: string; accessible: boolean }>> = {};
  for (const n of Object.keys(CAMPUS_NODES)) {
    graph[n] = [];
  }

  for (const edge of CAMPUS_EDGES) {
    const { from, to, distance, type } = edge;
    const isAccessible = edge.accessible !== false;

    if (graph[from]) {
      graph[from].push({ to, distance, type, accessible: isAccessible });
    }
    if (graph[to]) {
      graph[to].push({ to: from, distance, type, accessible: isAccessible });
    }
  }

  // Dijkstra's Algorithm
  const distances: Record<string, number> = {};
  const previous: Record<string, string | null> = {};
  const visited = new Set<string>();

  for (const n of Object.keys(CAMPUS_NODES)) {
    distances[n] = Infinity;
    previous[n] = null;
  }
  distances[normStart] = 0;

  const pq: Array<{ node: string; dist: number }> = [{ node: normStart, dist: 0 }];

  while (pq.length > 0) {
    pq.sort((a, b) => a.dist - b.dist);
    const current = pq.shift()!;

    if (visited.has(current.node)) continue;
    visited.add(current.node);

    if (current.node === normEnd) break;

    const neighbors = graph[current.node] || [];
    for (const neighbor of neighbors) {
      if (profile === 'wheelchair' && (neighbor.type === 'stairs' || !neighbor.accessible)) {
        continue;
      }

      const alt = distances[current.node] + neighbor.distance;
      if (alt < distances[neighbor.to]) {
        distances[neighbor.to] = alt;
        previous[neighbor.to] = current.node;
        pq.push({ node: neighbor.to, dist: alt });
      }
    }
  }

  if (distances[normEnd] === Infinity) {
    return { error: `No accessible route found between '${normStart}' and '${normEnd}' for ${profile} profile.` };
  }

  // Reconstruct path
  const path: string[] = [];
  let curr: string | null = normEnd;
  while (curr !== null) {
    path.unshift(curr);
    curr = previous[curr];
  }

  const totalDist = distances[normEnd];
  const estMinutes = Math.max(1, Math.round(totalDist / 60));

  const startNode = CAMPUS_NODES[normStart];
  const endNode = CAMPUS_NODES[normEnd];
  const startName = cleanLabel(startNode.label);
  const endName = cleanLabel(endNode.label);

  const condensedSteps: string[] = [];
  const involvedFloors: any[] = [];

  let i = 0;
  while (i < path.length - 1) {
    const currId = path[i];
    const currInfo = CAMPUS_NODES[currId];
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

      const destLiftNode = CAMPUS_NODES[path[j - 1]];
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
      const destStNode = CAMPUS_NODES[path[j - 1]];
      const destFloor = destStNode.floor;
      const floorStr = destFloor > 0 ? `Floor ${destFloor}` : 'Ground Floor';
      if (destFloor < currFloor) {
        condensedSteps.push(`Take the stairs down to ${floorStr}.`);
      } else {
        condensedSteps.push(`Take the stairs up to ${floorStr}.`);
      }
      i = Math.max(i + 1, j - 1);
      continue;
    }

    // 3. Bridge Crossing
    if (edgeType === 'bridge' || currId.includes('bridge') || currId.includes('passage')) {
      const targetInfo = CAMPUS_NODES[nextId];
      const targetBldg = targetInfo.building_id;
      const bldgName = targetBldg.replace('block_', 'Block ').toUpperCase();
      if (targetBldg && targetBldg !== currBldg) {
        condensedSteps.push(`Cross the connecting bridge into ${bldgName}.`);
      } else {
        condensedSteps.push(`Proceed across the connecting bridge.`);
      }
      i++;
      continue;
    }

    // 4. Walking corridors
    if (i === 0) {
      condensedSteps.push(`From ${startName}, head down the hallway towards ${cleanLabel(CAMPUS_NODES[nextId]?.label || '')}.`);
    } else if (i === path.length - 2) {
      condensedSteps.push(`Proceed to ${endName}.`);
    } else {
      const nextLabel = cleanLabel(CAMPUS_NODES[nextId]?.label || '');
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

  const voiceMsg = `Go from ${startName}. ` + deduped.join(' Then, ') + ` You have arrived at ${endName}. Total distance is ${totalDist} meters.`;

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
