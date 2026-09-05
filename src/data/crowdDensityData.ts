import { CrowdZone, CrowdLevel } from '../types';

/**
 * MOCK CROWD DENSITY DATA (STEP 1 FOUNDATION)
 * 
 * Uses the standard 1600 × 800 coordinate system of the Twin Map floorplans.
 * Zones are logically placed along corridors, lobbies, entrances, elevator banks,
 * and connecting walkways without covering room interiors or accessibility features.
 * 
 * Later (Step 2+), this file/service can be seamlessly switched to live feeds:
 * YOLO -> FastAPI -> Real-time crowd sensor endpoints.
 */

export const MOCK_CROWD_ZONES_BY_FLOOR: Record<string, CrowdZone[]> = {
  // ==========================================
  // ITER BLOCK C (Ground, Floor 1, Floor 2)
  // ==========================================
  'C-F0': [
    {
      id: 'cz-c0-south-lobby',
      name: 'Main Entrance & South Foyer',
      buildingId: 'BLD-C',
      floorId: 0,
      x: 630,
      y: 650,
      width: 320,
      height: 130,
      peopleCount: 14,
      density: 0.35,
      level: 'high',
      description: 'High student traffic around main southern turnstile and ramp entryway.',
      lastUpdated: 'Just now (Live)'
    },
    {
      id: 'cz-c0-north-lobby',
      name: 'North Entrance & Stair Lobby',
      buildingId: 'BLD-C',
      floorId: 0,
      x: 630,
      y: 15,
      width: 300,
      height: 130,
      peopleCount: 5,
      density: 0.14,
      level: 'low',
      description: 'Light foot traffic through the north garden access vestibule.',
      lastUpdated: '1 min ago'
    },
    {
      id: 'cz-c0-central-corridor',
      name: 'Central Longitudinal Corridor',
      buildingId: 'BLD-C',
      floorId: 0,
      x: 180,
      y: 360,
      width: 1100,
      height: 60,
      peopleCount: 9,
      density: 0.22,
      level: 'moderate',
      description: 'Moderate steady flow connecting ground classrooms and laboratories.',
      lastUpdated: 'Just now (Live)'
    },
    {
      id: 'cz-c0-west-corridor',
      name: 'West Side Connector',
      buildingId: 'BLD-C',
      floorId: 0,
      x: 130,
      y: 140,
      width: 60,
      height: 490,
      peopleCount: 3,
      density: 0.08,
      level: 'low',
      description: 'Clear accessible pathway along western restrooms and stairwells.',
      lastUpdated: '2 mins ago'
    }
  ],

  'C-F1': [
    {
      id: 'cz-c1-north-stair',
      name: 'North-West Stair Lobby (Stairs 1)',
      buildingId: 'BLD-C',
      floorId: 1,
      x: 360,
      y: 15,
      width: 180,
      height: 100,
      peopleCount: 12,
      density: 0.42,
      level: 'high',
      description: 'Crowded transition zone during lecture class changes.',
      lastUpdated: 'Just now (Live)'
    },
    {
      id: 'cz-c1-central-corridor',
      name: 'Central Academic Hallway',
      buildingId: 'BLD-C',
      floorId: 1,
      x: 180,
      y: 360,
      width: 1100,
      height: 60,
      peopleCount: 8,
      density: 0.20,
      level: 'moderate',
      description: 'Steady movement between lecture halls C-115 to C-122.',
      lastUpdated: 'Just now (Live)'
    },
    {
      id: 'cz-c1-east-stair',
      name: 'North-East Stairwell (Stairs 2)',
      buildingId: 'BLD-C',
      floorId: 1,
      x: 1000,
      y: 15,
      width: 180,
      height: 100,
      peopleCount: 4,
      density: 0.11,
      level: 'low',
      description: 'Low congestion staircase zone.',
      lastUpdated: '1 min ago'
    },
    {
      id: 'cz-c1-south-balcony',
      name: 'South Overlook Balcony',
      buildingId: 'BLD-C',
      floorId: 1,
      x: 630,
      y: 650,
      width: 320,
      height: 120,
      peopleCount: 6,
      density: 0.16,
      level: 'low',
      description: 'Open airy gathering spot overlooking ground courtyard.',
      lastUpdated: '2 mins ago'
    }
  ],

  'C-F2': [
    {
      id: 'cz-c2-bridge',
      name: 'Inter-Block Connection Bridge (to D-Block)',
      buildingId: 'BLD-C',
      floorId: 2,
      x: 15,
      y: 560,
      width: 80,
      height: 220,
      peopleCount: 16,
      density: 0.48,
      level: 'high',
      description: 'High cross-building traffic moving toward D-Block Floor 2.',
      lastUpdated: 'Just now (Live)'
    },
    {
      id: 'cz-c2-central-corridor',
      name: 'Central Department Corridor',
      buildingId: 'BLD-C',
      floorId: 2,
      x: 180,
      y: 360,
      width: 1100,
      height: 60,
      peopleCount: 7,
      density: 0.18,
      level: 'moderate',
      description: 'Faculty and student traffic along research chambers.',
      lastUpdated: 'Just now (Live)'
    },
    {
      id: 'cz-c2-north-study',
      name: 'North Study Concourse',
      buildingId: 'BLD-C',
      floorId: 2,
      x: 350,
      y: 140,
      width: 850,
      height: 70,
      peopleCount: 3,
      density: 0.07,
      level: 'low',
      description: 'Quiet study corridor with minimal foot traffic.',
      lastUpdated: '3 mins ago'
    }
  ],

  // ==========================================
  // ITER BLOCK D (Ground, Floor 1, Floor 2, Floor 3)
  // ==========================================
  'D-F0': [
    {
      id: 'cz-d0-entrance',
      name: 'Ground Floor Atrium & Main Entry',
      buildingId: 'BLD-D',
      floorId: 0,
      x: 130,
      y: 630,
      width: 220,
      height: 150,
      peopleCount: 19,
      density: 0.52,
      level: 'high',
      description: 'Primary accessible entrance foyer with heavy footfall.',
      lastUpdated: 'Just now (Live)'
    },
    {
      id: 'cz-d0-central-hall',
      name: 'Central Accessible Concourse',
      buildingId: 'BLD-D',
      floorId: 0,
      x: 140,
      y: 360,
      width: 1320,
      height: 70,
      peopleCount: 11,
      density: 0.26,
      level: 'moderate',
      description: 'Broad accessible hallway connecting administrative wings.',
      lastUpdated: 'Just now (Live)'
    },
    {
      id: 'cz-d0-north-hall',
      name: 'North Classroom Corridor',
      buildingId: 'BLD-D',
      floorId: 0,
      x: 190,
      y: 135,
      width: 1220,
      height: 75,
      peopleCount: 4,
      density: 0.09,
      level: 'low',
      description: 'Clear pathway leading along northern instructional rooms D-004 to D-012.',
      lastUpdated: '2 mins ago'
    },
    {
      id: 'cz-d0-east-stair',
      name: 'East Stairwell & Service Bay',
      buildingId: 'BLD-D',
      floorId: 0,
      x: 1330,
      y: 550,
      width: 140,
      height: 230,
      peopleCount: 5,
      density: 0.13,
      level: 'low',
      description: 'Minor traffic around eastern stair landing.',
      lastUpdated: '1 min ago'
    }
  ],

  'D-F1': [
    {
      id: 'cz-d1-bridge-c',
      name: 'Sky-Bridge Connection (to C-Block)',
      buildingId: 'BLD-D',
      floorId: 1,
      x: 1330,
      y: 640,
      width: 140,
      height: 140,
      peopleCount: 17,
      density: 0.50,
      level: 'high',
      description: 'Busy elevated pedestrian bridge linking Blocks C & D.',
      lastUpdated: 'Just now (Live)'
    },
    {
      id: 'cz-d1-central-hall',
      name: 'Central Level 1 Corridor',
      buildingId: 'BLD-D',
      floorId: 1,
      x: 140,
      y: 360,
      width: 1320,
      height: 70,
      peopleCount: 13,
      density: 0.31,
      level: 'moderate',
      description: 'Regular circulation between lecture classrooms.',
      lastUpdated: 'Just now (Live)'
    },
    {
      id: 'cz-d1-north-hall',
      name: 'North Gallery Way',
      buildingId: 'BLD-D',
      floorId: 1,
      x: 190,
      y: 135,
      width: 1220,
      height: 75,
      peopleCount: 3,
      density: 0.06,
      level: 'low',
      description: 'Low density walkway along upper northern rooms.',
      lastUpdated: '3 mins ago'
    }
  ],

  'D-F2': [
    {
      id: 'cz-d2-skywalk-e',
      name: 'West Skywalk Connection (to E-Block)',
      buildingId: 'BLD-D',
      floorId: 2,
      x: 15,
      y: 120,
      width: 120,
      height: 105,
      peopleCount: 18,
      density: 0.54,
      level: 'high',
      description: 'High interchange volume connecting Blocks D and E.',
      lastUpdated: 'Just now (Live)'
    },
    {
      id: 'cz-d2-central-hall',
      name: 'Central Level 2 Corridor',
      buildingId: 'BLD-D',
      floorId: 2,
      x: 140,
      y: 360,
      width: 1320,
      height: 70,
      peopleCount: 6,
      density: 0.15,
      level: 'low',
      description: 'Spacious corridor with uninhibited wheelchair accessibility.',
      lastUpdated: 'Just now (Live)'
    },
    {
      id: 'cz-d2-east-lab',
      name: 'East Innovation Lab Corridor',
      buildingId: 'BLD-D',
      floorId: 2,
      x: 1330,
      y: 270,
      width: 140,
      height: 270,
      peopleCount: 9,
      density: 0.24,
      level: 'moderate',
      description: 'Moderate team movement outside specialized engineering labs.',
      lastUpdated: '1 min ago'
    }
  ],

  'D-F3': [
    {
      id: 'cz-d3-central-hall',
      name: 'Level 3 Faculty Corridor',
      buildingId: 'BLD-D',
      floorId: 3,
      x: 140,
      y: 360,
      width: 1320,
      height: 70,
      peopleCount: 4,
      density: 0.10,
      level: 'low',
      description: 'Quiet faculty chamber hallway with low background occupancy.',
      lastUpdated: '2 mins ago'
    },
    {
      id: 'cz-d3-east-stair',
      name: 'East Roof & Stair Landing',
      buildingId: 'BLD-D',
      floorId: 3,
      x: 1330,
      y: 550,
      width: 140,
      height: 230,
      peopleCount: 7,
      density: 0.21,
      level: 'moderate',
      description: 'Moderate student break traffic near roof terrace entrance.',
      lastUpdated: 'Just now (Live)'
    }
  ],

  // ==========================================
  // ITER BLOCK E (Ground to Floor 5)
  // ==========================================
  'E-F0': [
    {
      id: 'cz-e0-entrance',
      name: 'Main Ground Entrance & Security Port',
      buildingId: 'BLD-E',
      floorId: 0,
      x: 110,
      y: 720,
      width: 240,
      height: 65,
      peopleCount: 24,
      density: 0.62,
      level: 'high',
      description: 'High entry congestion during morning and afternoon peak hours.',
      lastUpdated: 'Just now (Live)'
    },
    {
      id: 'cz-e0-west-lifts',
      name: 'West High-Capacity Elevator Bank (Lifts 1 & 2)',
      buildingId: 'BLD-E',
      floorId: 0,
      x: 15,
      y: 580,
      width: 120,
      height: 205,
      peopleCount: 18,
      density: 0.55,
      level: 'high',
      description: 'Heavy waiting queue (18 ppl) for accessible elevators to upper tower floors.',
      lastUpdated: 'Just now (Live)'
    },
    {
      id: 'cz-e0-east-lifts',
      name: 'East Elevator Bank (Lifts 3 & 4)',
      buildingId: 'BLD-E',
      floorId: 0,
      x: 1370,
      y: 15,
      width: 215,
      height: 125,
      peopleCount: 3,
      density: 0.09,
      level: 'low',
      description: 'Clear queue (3 ppl) for eastern express elevators. Recommended alternative.',
      lastUpdated: 'Just now (Live)'
    },
    {
      id: 'cz-e0-central-hall',
      name: 'Central Grand Spine Corridor',
      buildingId: 'BLD-E',
      floorId: 0,
      x: 145,
      y: 145,
      width: 1220,
      height: 115,
      peopleCount: 4,
      density: 0.09,
      level: 'low',
      description: 'Wide accessible arterial pathway with ample room for mobility devices.',
      lastUpdated: 'Just now (Live)'
    },
    {
      id: 'cz-e0-south-hall',
      name: 'South Auditoria Corridor & Main Stairs',
      buildingId: 'BLD-E',
      floorId: 0,
      x: 145,
      y: 505,
      width: 1220,
      height: 115,
      peopleCount: 2,
      density: 0.05,
      level: 'low',
      description: 'Clear staircase and corridor leading to seminar spaces.',
      lastUpdated: '2 mins ago'
    }
  ],

  'E-F1': [
    {
      id: 'cz-e1-west-lifts',
      name: 'West Elevator Lobby (Lifts 1 & 2)',
      buildingId: 'BLD-E',
      floorId: 1,
      x: 15,
      y: 580,
      width: 120,
      height: 205,
      peopleCount: 18,
      density: 0.58,
      level: 'high',
      description: 'Heavy congestion at western elevators during lecture breaks.',
      lastUpdated: 'Just now (Live)'
    },
    {
      id: 'cz-e1-east-lifts',
      name: 'East Elevator Lobby (Lifts 3 & 4)',
      buildingId: 'BLD-E',
      floorId: 1,
      x: 1370,
      y: 15,
      width: 215,
      height: 125,
      peopleCount: 3,
      density: 0.09,
      level: 'low',
      description: 'Clear eastern elevators with zero delay. Recommended accessible route.',
      lastUpdated: 'Just now (Live)'
    },
    {
      id: 'cz-e1-central-hall',
      name: 'Central Teaching Hallway',
      buildingId: 'BLD-E',
      floorId: 1,
      x: 145,
      y: 145,
      width: 1220,
      height: 115,
      peopleCount: 4,
      density: 0.09,
      level: 'low',
      description: 'Clear walking path between lecture spaces.',
      lastUpdated: '2 mins ago'
    },
    {
      id: 'cz-e1-south-hall',
      name: 'South Tutorial Concourse & Main Stairs',
      buildingId: 'BLD-E',
      floorId: 1,
      x: 145,
      y: 505,
      width: 1220,
      height: 115,
      peopleCount: 2,
      density: 0.05,
      level: 'low',
      description: 'Clear stair landing and south corridor with light foot traffic.',
      lastUpdated: '1 min ago'
    }
  ],

  'E-F2': [
    {
      id: 'cz-e2-bridge-d',
      name: 'Skywalk Gateway (Connecting to D-Block Floor 2)',
      buildingId: 'BLD-E',
      floorId: 2,
      x: 15,
      y: 300,
      width: 125,
      height: 75,
      peopleCount: 4,
      density: 0.12,
      level: 'low',
      description: 'Pedestrian artery linking Tower E with Science Block D.',
      lastUpdated: 'Just now (Live)'
    },
    {
      id: 'cz-e2-west-lifts',
      name: 'West Elevator Area (Lifts 1 & 2)',
      buildingId: 'BLD-E',
      floorId: 2,
      x: 15,
      y: 580,
      width: 120,
      height: 205,
      peopleCount: 18,
      density: 0.56,
      level: 'high',
      description: 'High waiting queue for West Lifts 1 & 2.',
      lastUpdated: 'Just now (Live)'
    },
    {
      id: 'cz-e2-east-lifts',
      name: 'East Elevator Area (Lifts 3 & 4)',
      buildingId: 'BLD-E',
      floorId: 2,
      x: 1370,
      y: 15,
      width: 215,
      height: 125,
      peopleCount: 3,
      density: 0.09,
      level: 'low',
      description: 'Clear Eastern Elevator lobby.',
      lastUpdated: 'Just now (Live)'
    },
    {
      id: 'cz-e2-central-hall',
      name: 'Central Departmental Hallway & Stairs',
      buildingId: 'BLD-E',
      floorId: 2,
      x: 145,
      y: 145,
      width: 1220,
      height: 115,
      peopleCount: 3,
      density: 0.08,
      level: 'low',
      description: 'Open accessible corridor.',
      lastUpdated: 'Just now (Live)'
    }
  ],

  'E-F3': [
    {
      id: 'cz-e3-central-hall',
      name: 'Central Computing Concourse',
      buildingId: 'BLD-E',
      floorId: 3,
      x: 145,
      y: 145,
      width: 1220,
      height: 115,
      peopleCount: 16,
      density: 0.47,
      level: 'high',
      description: 'High student gathering outside high-performance computing labs.',
      lastUpdated: 'Just now (Live)'
    },
    {
      id: 'cz-e3-east-lifts',
      name: 'East Elevator Landing',
      buildingId: 'BLD-E',
      floorId: 3,
      x: 1370,
      y: 15,
      width: 215,
      height: 125,
      peopleCount: 11,
      density: 0.34,
      level: 'moderate',
      description: 'Moderate waiting line for upper and ground lifts.',
      lastUpdated: 'Just now (Live)'
    },
    {
      id: 'cz-e3-west-lifts',
      name: 'West Elevator Landing',
      buildingId: 'BLD-E',
      floorId: 3,
      x: 15,
      y: 580,
      width: 120,
      height: 205,
      peopleCount: 5,
      density: 0.15,
      level: 'low',
      description: 'Low queue delay.',
      lastUpdated: '2 mins ago'
    }
  ],

  'E-F4': [
    {
      id: 'cz-e4-east-lifts',
      name: 'East Elevator Bank',
      buildingId: 'BLD-E',
      floorId: 4,
      x: 1370,
      y: 15,
      width: 215,
      height: 125,
      peopleCount: 8,
      density: 0.25,
      level: 'moderate',
      description: 'Moderate movement between research centers.',
      lastUpdated: '1 min ago'
    },
    {
      id: 'cz-e4-central-hall',
      name: 'Central Advanced Research Corridor',
      buildingId: 'BLD-E',
      floorId: 4,
      x: 145,
      y: 145,
      width: 1220,
      height: 115,
      peopleCount: 4,
      density: 0.10,
      level: 'low',
      description: 'Quiet research environment with very low pedestrian traffic.',
      lastUpdated: 'Just now (Live)'
    },
    {
      id: 'cz-e4-west-lifts',
      name: 'West Elevator Area',
      buildingId: 'BLD-E',
      floorId: 4,
      x: 15,
      y: 580,
      width: 120,
      height: 205,
      peopleCount: 3,
      density: 0.08,
      level: 'low',
      description: 'Clear elevator vestibule.',
      lastUpdated: '4 mins ago'
    }
  ],

  'E-F5': [
    {
      id: 'cz-e5-central-hall',
      name: 'Top Floor Executive Concourse',
      buildingId: 'BLD-E',
      floorId: 5,
      x: 145,
      y: 145,
      width: 1220,
      height: 115,
      peopleCount: 3,
      density: 0.07,
      level: 'low',
      description: 'Minimal footfall on top executive floor.',
      lastUpdated: '3 mins ago'
    },
    {
      id: 'cz-e5-east-lifts',
      name: 'East Elevator Lobby',
      buildingId: 'BLD-E',
      floorId: 5,
      x: 1370,
      y: 15,
      width: 215,
      height: 125,
      peopleCount: 4,
      density: 0.12,
      level: 'low',
      description: 'Quiet elevator lobby with immediate availability.',
      lastUpdated: '2 mins ago'
    },
    {
      id: 'cz-e5-west-lifts',
      name: 'West Elevator Lobby',
      buildingId: 'BLD-E',
      floorId: 5,
      x: 15,
      y: 580,
      width: 120,
      height: 205,
      peopleCount: 2,
      density: 0.06,
      level: 'low',
      description: 'Uncrowded transit point.',
      lastUpdated: '5 mins ago'
    }
  ]
};

/**
 * Helper to retrieve mock crowd zones for a given floor and building.
 * Generates dynamic fallback zones if an unmapped floor is selected.
 */
export function getCrowdZonesForFloor(
  buildingId: string,
  floorId: number | string
): CrowdZone[] {
  // Normalize key, e.g. "BLD-C", 0 -> "C-F0"
  let blockPrefix = 'C';
  if (buildingId.includes('D')) blockPrefix = 'D';
  if (buildingId.includes('E')) blockPrefix = 'E';

  const floorNumber = typeof floorId === 'number' ? floorId : (parseInt(String(floorId).replace(/\D/g, '')) || 0);
  const normalizedKey = `${blockPrefix}-F${floorNumber}`;

  // Return direct floor configuration if found
  if (MOCK_CROWD_ZONES_BY_FLOOR[normalizedKey]) {
    return MOCK_CROWD_ZONES_BY_FLOOR[normalizedKey];
  }

  // Also check if passed as direct key like "C-F0"
  const rawKey = String(floorId);
  if (MOCK_CROWD_ZONES_BY_FLOOR[rawKey]) {
    return MOCK_CROWD_ZONES_BY_FLOOR[rawKey];
  }

  // Fallback programmatic generation in 1600x800 coordinate space
  return [
    {
      id: `cz-dyn-${normalizedKey}-lobby`,
      name: `Main Floor ${floorNumber} Corridor`,
      buildingId,
      floorId: floorNumber,
      x: 180,
      y: 360,
      width: 1100,
      height: 70,
      peopleCount: 8,
      density: 0.20,
      level: 'moderate',
      description: `Steady footfall through Central Hallway on Floor ${floorNumber}.`,
      lastUpdated: 'Just now (Live)'
    },
    {
      id: `cz-dyn-${normalizedKey}-stair`,
      name: `Floor ${floorNumber} Elevator & Stair Hub`,
      buildingId,
      floorId: floorNumber,
      x: 20,
      y: 580,
      width: 130,
      height: 200,
      peopleCount: 4,
      density: 0.12,
      level: 'low',
      description: 'Transit junction with minimal delays.',
      lastUpdated: '1 min ago'
    }
  ];
}

/**
 * Styling helper to get theme colors, badges, and labels for a crowd level
 */
export function getCrowdLevelTheme(level: CrowdLevel) {
  switch (level) {
    case 'high':
      return {
        label: 'High Density',
        shortLabel: 'High',
        badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        badgeSolid: 'bg-rose-600 text-white',
        cardBorder: 'border-rose-500/50',
        cardBg: 'bg-rose-950/90',
        dotColor: 'bg-rose-500',
        svgFill: '#ef4444',
        svgFillOpacity: 0.32,
        svgStroke: '#f87171',
        svgStrokeWidth: 2,
        iconEmoji: '🔴',
        textColor: 'text-rose-400'
      };
    case 'moderate':
      return {
        label: 'Moderate Density',
        shortLabel: 'Moderate',
        badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        badgeSolid: 'bg-amber-600 text-white',
        cardBorder: 'border-amber-500/50',
        cardBg: 'bg-amber-950/90',
        dotColor: 'bg-amber-500',
        svgFill: '#f59e0b',
        svgFillOpacity: 0.26,
        svgStroke: '#fbbf24',
        svgStrokeWidth: 2,
        iconEmoji: '🟡',
        textColor: 'text-amber-400'
      };
    case 'low':
    default:
      return {
        label: 'Low Density',
        shortLabel: 'Low',
        badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        badgeSolid: 'bg-emerald-600 text-white',
        cardBorder: 'border-emerald-500/50',
        cardBg: 'bg-emerald-950/90',
        dotColor: 'bg-emerald-500',
        svgFill: '#10b981',
        svgFillOpacity: 0.22,
        svgStroke: '#34d399',
        svgStrokeWidth: 2,
        iconEmoji: '🟢',
        textColor: 'text-emerald-400'
      };
  }
}
