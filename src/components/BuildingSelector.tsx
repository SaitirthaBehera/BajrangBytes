import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Building } from '../types';

interface BuildingSelectorProps {
  onSelect: (buildingId: string) => void;
  selectedBuildingId: string | null;
  buildings: Building[];
}

export const BuildingSelector: React.FC<BuildingSelectorProps> = ({ onSelect, selectedBuildingId, buildings }) => {
  if (buildings.length === 0) return <div className="text-sm text-slate-500 px-3 py-1.5">No buildings available</div>;

  return (
    <select
      value={selectedBuildingId || ''}
      onChange={(e) => onSelect(e.target.value)}
      className="text-sm font-semibold text-slate-700 bg-white px-3 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
    >
      {buildings.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      ))}
    </select>
  );
};
