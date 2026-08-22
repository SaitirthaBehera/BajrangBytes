import { NavigationNode, NavigationEdge, DisabilityProfile, RouteResult, RouteStep } from '../types';

export function calculateAccessibleRoute(
  startNodeId: string,
  targetNodeId: string,
  profile: DisabilityProfile,
  nodes: NavigationNode[],
  edges: NavigationEdge[]
): RouteResult | null {
  const startNode = nodes.find(n => n.id === startNodeId);
  const targetNode = nodes.find(n => n.id === targetNodeId);

  if (!startNode || !targetNode) return null;

  // Build adjacency graph with custom edge weights according to disability profile
  const nodeMap = new Map<string, NavigationNode>();
  nodes.forEach(n => nodeMap.set(n.id, n));

  const adj = new Map<string, Array<{ toId: string; weight: number; edge: NavigationEdge }>>();
  nodes.forEach(n => adj.set(n.id, []));

  edges.forEach(edge => {
    // Determine edge weight based on mobility profile constraints
    let weight = edge.distanceMeters;

    if (profile === 'wheelchair') {
      if (edge.hasStairs && !edge.hasRamp && !edge.hasLift) {
        weight = Infinity; // IMPASSABLE for wheelchairs
      }
      if (edge.minWidthMeters < 0.9) {
        weight = Infinity; // Too narrow
      } else if (edge.minWidthMeters < 1.2) {
        weight *= 2.5; // Narrow corridor penalty
      }
      if (!edge.isWorking) {
        weight *= 4.0; // Unworking/Broken feature on path
      }
    } else if (profile === 'visual') {
      if (!edge.tactilePavingAvailable) {
        weight *= 1.8; // Penalty for lack of tactile indicators
      }
      if (edge.hasStairs) {
        weight *= 2.0; // Stairs present extra hazard for visually impaired without tactile paving
      }
    } else if (profile === 'elderly') {
      if (edge.hasStairs) {
        weight *= 3.5; // Strongly prefer elevators/ramps over stairs for elderly
      }
    }

    if (weight !== Infinity) {
      adj.get(edge.fromNodeId)?.push({ toId: edge.toNodeId, weight, edge });
      adj.get(edge.toNodeId)?.push({ toId: edge.fromNodeId, weight, edge }); // Bidirectional
    }
  });

  // Dijkstra's Shortest Path Algorithm
  const distances = new Map<string, number>();
  const previous = new Map<string, { nodeId: string; edge: NavigationEdge }>();
  const unvisited = new Set<string>();

  nodes.forEach(n => {
    distances.set(n.id, Infinity);
    unvisited.add(n.id);
  });
  distances.set(startNodeId, 0);

  while (unvisited.size > 0) {
    // Find unvisited node with smallest distance
    let currentId: string | null = null;
    let minDist = Infinity;

    unvisited.forEach(nodeId => {
      const d = distances.get(nodeId) ?? Infinity;
      if (d < minDist) {
        minDist = d;
        currentId = nodeId;
      }
    });

    if (!currentId || minDist === Infinity || currentId === targetNodeId) {
      break;
    }

    unvisited.delete(currentId);

    const neighbors = adj.get(currentId) || [];
    for (const neighbor of neighbors) {
      if (!unvisited.has(neighbor.toId)) continue;

      const alt = minDist + neighbor.weight;
      if (alt < (distances.get(neighbor.toId) ?? Infinity)) {
        distances.set(neighbor.toId, alt);
        previous.set(neighbor.toId, { nodeId: currentId, edge: neighbor.edge });
      }
    }
  }

  if (distances.get(targetNodeId) === Infinity) {
    // No accessible route found under these constraints
    return null;
  }

  // Reconstruct path
  const pathNodeIds: string[] = [];
  const routeEdges: NavigationEdge[] = [];
  let curr: string | undefined = targetNodeId;

  while (curr) {
    pathNodeIds.unshift(curr);
    const prevInfo = previous.get(curr);
    if (prevInfo) {
      routeEdges.unshift(prevInfo.edge);
      curr = prevInfo.nodeId;
    } else {
      curr = undefined;
    }
  }

  // Calculate metrics
  let totalDistanceMeters = 0;
  const warnings: string[] = [];
  const accessibleFeaturesUsedSet = new Set<string>();

  routeEdges.forEach(e => {
    totalDistanceMeters += e.distanceMeters;
    if (e.hasRamp) accessibleFeaturesUsedSet.add('Accessible Ramp');
    if (e.hasLift) accessibleFeaturesUsedSet.add('Voice Elevator');
    if (e.tactilePavingAvailable) accessibleFeaturesUsedSet.add('Tactile Ground Surface');
    if (e.warningMessage) warnings.push(e.warningMessage);
  });

  // Calculate estimated walking time (averaging 1.0 m/s for general, 0.6 m/s for wheelchair/elderly/visual)
  const speedMps = profile === 'general' ? 1.1 : 0.65;
  const estimatedMinutes = Math.max(1, Math.round((totalDistanceMeters / speedMps) / 60));

  // Generate turn-by-turn steps
  const steps: RouteStep[] = [];
  pathNodeIds.forEach((nodeId, idx) => {
    const node = nodeMap.get(nodeId);
    if (!node) return;

    let instruction = '';
    const floorName = node.floorId === 0 ? 'Ground Floor' : `Floor ${node.floorId}`;

    if (idx === 0) {
      instruction = `Start at ${node.name} (${floorName})`;
    } else {
      const prevNode = nodeMap.get(pathNodeIds[idx - 1]);
      const edge = routeEdges[idx - 1];

      if (prevNode && prevNode.floorId !== node.floorId) {
        instruction = `Take ${edge?.hasLift ? 'Elevator' : 'Ramp/Stairs'} to ${floorName} (${node.name})`;
      } else {
        instruction = `Proceed along corridor to ${node.name} (${edge?.distanceMeters || 10}m)`;
      }
    }

    steps.push({
      stepNumber: idx + 1,
      instruction,
      floorId: node.floorId,
      floorName,
      distanceMeters: idx === 0 ? 0 : routeEdges[idx - 1]?.distanceMeters || 0,
      featureTypeUsed: edgeToFeatureType(routeEdges[idx - 1]),
      nodeId: node.id,
      warning: routeEdges[idx - 1]?.warningMessage,
    });
  });

  return {
    fromNode: startNode,
    toNode: targetNode,
    profile,
    totalDistanceMeters: Math.round(totalDistanceMeters),
    estimatedMinutes,
    steps,
    pathNodeIds,
    warnings: Array.from(new Set(warnings)),
    accessibleFeaturesUsed: Array.from(accessibleFeaturesUsedSet),
  };
}

function edgeToFeatureType(edge?: NavigationEdge) {
  if (!edge) return undefined;
  if (edge.hasRamp) return 'ramp';
  if (edge.hasLift) return 'lift';
  if (edge.hasStairs) return 'stairs';
  if (edge.tactilePavingAvailable) return 'tactile_path';
  return 'corridor';
}
