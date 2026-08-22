import React, { useState, useEffect } from 'react';
import { CAMPUS_NODES } from '../utils/campusGraph';
import { Building2, Layers, DoorOpen, MapPin, Check } from 'lucide-react';

interface LocationCascadeSelectorProps {
  id: string;
  label: string;
  selectedNodeId: string;
  onSelectNode: (nodeId: string) => void;
}

export const LocationCascadeSelector: React.FC<LocationCascadeSelectorProps> = ({
  id,
  label,
  selectedNodeId,
  onSelectNode
}) => {
  const currentNode = CAMPUS_NODES[selectedNodeId] || {
    id: selectedNodeId,
    label: selectedNodeId,
    building_id: 'outdoor',
    floor: 0,
    type: 'entrance',
    accessible: true
  };

  // Derive initial building & floor from current selectedNodeId
  const [activeBuilding, setActiveBuilding] = useState<string>(
    currentNode.building_id || 'outdoor'
  );
  const [activeFloor, setActiveFloor] = useState<number>(
    currentNode.floor || 0
  );

  // Sync state if selectedNodeId changes externally
  useEffect(() => {
    if (CAMPUS_NODES[selectedNodeId]) {
      setActiveBuilding(CAMPUS_NODES[selectedNodeId].building_id);
      setActiveFloor(CAMPUS_NODES[selectedNodeId].floor);
    }
  }, [selectedNodeId]);

  // Group all nodes by building_id and floor
  const buildingsList = [
    { id: 'outdoor', name: '🌳 Campus Gates & Facilities', floors: [0] },
    { id: 'block_e', name: '🏢 Block E (6 Floors & Lifts)', floors: [0, 1, 2, 3, 4, 5] },
    { id: 'block_c', name: '🏢 Block C (3 Floors & Bridges)', floors: [0, 1, 2] },
    { id: 'block_d', name: '🏢 Block D (4 Floors & Lawn)', floors: [0, 1, 2, 3] },
    { id: 'block_a', name: '🏢 Block A (Computer Science)', floors: [0] },
    { id: 'block_b', name: '🏢 Block B (Electrical Science)', floors: [0] },
    { id: 'block_f', name: '🏢 Block F (Freshman Complex)', floors: [0] },
    { id: 'ds_block', name: '🏢 Data Science Block', floors: [0] },
    { id: 'library', name: '📚 Central Library', floors: [0] },
    { id: 'auditorium', name: '🎭 Main Auditorium', floors: [0] }
  ];

  // Available floors for active building
  const currentBldgConfig = buildingsList.find(b => b.id === activeBuilding) || buildingsList[0];
  const availableFloors = currentBldgConfig.floors;

  // Nodes on active building + floor
  const nodesOnFloor = Object.values(CAMPUS_NODES).filter(n => {
    if (activeBuilding === 'outdoor') {
      return n.building_id === 'outdoor' || n.type === 'entrance';
    }
    return n.building_id === activeBuilding && n.floor === activeFloor;
  });

  const handleBuildingChange = (bldgId: string) => {
    setActiveBuilding(bldgId);
    const bConfig = buildingsList.find(b => b.id === bldgId);
    const firstFl = bConfig ? bConfig.floors[0] : 0;
    setActiveFloor(firstFl);

    // Auto-select first node in this building/floor
    const matchNode = Object.values(CAMPUS_NODES).find(n => 
      (bldgId === 'outdoor' ? (n.building_id === 'outdoor' || n.type === 'entrance') : (n.building_id === bldgId && n.floor === firstFl))
    );
    if (matchNode) {
      onSelectNode(matchNode.id);
    }
  };

  const handleFloorChange = (fl: number) => {
    setActiveFloor(fl);
    const matchNode = Object.values(CAMPUS_NODES).find(n => n.building_id === activeBuilding && n.floor === fl);
    if (matchNode) {
      onSelectNode(matchNode.id);
    }
  };

  return (
    <div className="space-y-2.5 bg-slate-50/80 p-4 rounded-2xl border border-slate-200">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
          <MapPin className="w-3.5 h-3.5 text-blue-600" />
          <span>{label}</span>
        </label>
        <span className="text-[10px] font-mono bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold">
          ID: {selectedNodeId}
        </span>
      </div>

      {/* 2-Row Optimized Cascading Selector */}
      <div className="space-y-2.5">
        {/* Row 1: Building / Block (Full Width) */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center space-x-1">
            <Building2 className="w-3.5 h-3.5 text-blue-600" />
            <span>1. Block / Building</span>
          </label>
          <select
            id={`${id}-building`}
            value={activeBuilding}
            onChange={(e) => handleBuildingChange(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-xs cursor-pointer"
          >
            {buildingsList.map(b => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* Row 2: Floor (Left) & Room / Point (Right) */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
          {/* Floor Level */}
          <div className="sm:col-span-4">
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center space-x-1">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span>2. Floor</span>
            </label>
            <select
              id={`${id}-floor`}
              value={activeFloor}
              disabled={availableFloors.length <= 1}
              onChange={(e) => handleFloorChange(parseInt(e.target.value))}
              className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {availableFloors.map(fl => (
                <option key={fl} value={fl}>
                  {fl === 0 ? 'Ground (0)' : `Floor ${fl}`}
                </option>
              ))}
            </select>
          </div>

          {/* Room / Point Selector */}
          <div className="sm:col-span-8">
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center space-x-1">
              <DoorOpen className="w-3.5 h-3.5 text-blue-600" />
              <span>3. Room / Point ({nodesOnFloor.length})</span>
            </label>
            <select
              id={`${id}-node`}
              value={selectedNodeId}
              onChange={(e) => onSelectNode(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-bold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-xs cursor-pointer"
            >
              {nodesOnFloor.map(n => (
                <option key={n.id} value={n.id}>
                  {n.type === 'lift' ? '🛗 ' : n.type === 'bridge' ? '🌉 ' : n.type === 'stairs' ? '🪜 ' : n.type === 'restroom' ? '🚻 ' : n.type === 'entrance' ? '🚪 ' : '📍 '}
                  {n.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Selected Location Summary Card */}
      <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span className="font-bold text-slate-900">{currentNode.label || selectedNodeId}</span>
        </div>
        <span className="text-[11px] text-slate-500">
          {currentNode.accessible !== false ? '✅ Wheelchair Step-Free' : '⚠️ Stairs Transit'}
        </span>
      </div>
    </div>
  );
};
