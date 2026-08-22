import React, { useState, useEffect, useRef } from 'react';
import { Building2, ChevronDown, Check, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

export interface SupabaseBuildingRow {
  id?: string | number;
  building_id?: string;
  building_name?: string;
  name?: string;
  [key: string]: any;
}

interface HomeBuildingDropdownProps {
  selectedBuildingId?: string;
  onSelectBuildingId?: (buildingId: string, buildingRecord?: SupabaseBuildingRow) => void;
  className?: string;
}

export const HomeBuildingDropdown: React.FC<HomeBuildingDropdownProps> = ({
  selectedBuildingId,
  onSelectBuildingId,
  className = ''
}) => {
  const [buildings, setBuildings] = useState<SupabaseBuildingRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch building records directly from Supabase database
  const fetchBuildingsFromSupabase = async () => {
    setLoading(true);
    try {
      // Fetch ONLY from public.buildings table
      const { data, error } = await supabase
        .from('buildings')
        .select('*');

      if (!error && data) {
        setBuildings(data);
      }
    } catch (err) {
      console.error('[HomeBuildingDropdown] Error fetching buildings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBuildingsFromSupabase();

    // Real-time listener for buildings table updates
    const channel = supabase
      .channel('home-buildings-dropdown-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'buildings' }, () => {
        fetchBuildingsFromSupabase();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const currentSelectedRecord = buildings.find(b => {
    const pKey = String(b.building_id || b.id || '');
    return pKey === String(selectedBuildingId || '');
  }) || buildings[0];

  // Display ONLY the building name column
  const currentBuildingName = currentSelectedRecord
    ? (currentSelectedRecord.building_name || currentSelectedRecord.name || 'Select Building')
    : 'Select Building';

  const handleSelect = (row: SupabaseBuildingRow) => {
    const primaryKey = String(row.building_id || row.id || '');
    if (onSelectBuildingId) {
      onSelectBuildingId(primaryKey, row);
    }
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className={`relative inline-block text-left ${className}`}>
      {/* Slide-Down Trigger Button reusing existing dropdown visual style */}
      <button
        type="button"
        id="home-select-building-dropdown-trigger"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between bg-slate-50 hover:bg-slate-100 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl px-3.5 py-2 transition-all text-slate-800 font-semibold text-xs cursor-pointer min-w-[200px] max-w-[280px]"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center space-x-2 truncate pr-2">
          <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
          <span className="truncate">
            {loading ? 'Loading...' : currentBuildingName}
          </span>
        </div>

        <div className="flex items-center space-x-1 shrink-0 ml-1">
          {loading && <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />}
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : 'rotate-0'
            }`}
          />
        </div>
      </button>

      {/* Slide-Down Panel displaying ONLY names from Supabase buildings table */}
      {isOpen && (
        <div
          id="home-select-building-dropdown-panel"
          className="absolute left-0 sm:right-0 mt-1.5 min-w-[220px] w-full rounded-xl bg-white border border-slate-200 shadow-xl ring-1 ring-slate-900/5 z-50 overflow-hidden transform transition-all duration-150 origin-top animate-in fade-in slide-in-from-top-1"
        >
          <div className="max-h-56 overflow-y-auto p-1 space-y-0.5 custom-scrollbar">
            {loading ? (
              <div className="p-3 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
                <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                <span>Fetching database records...</span>
              </div>
            ) : buildings.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-500 font-medium">
                No building records found
              </div>
            ) : (
              buildings.map((b) => {
                const primaryKey = String(b.building_id || b.id || '');
                // ONLY building name
                const name = b.building_name || b.name || 'Unnamed Building';
                const isSelected = primaryKey === String(selectedBuildingId || (currentSelectedRecord ? (currentSelectedRecord.building_id || currentSelectedRecord.id) : ''));

                return (
                  <button
                    key={primaryKey || name}
                    type="button"
                    onClick={() => handleSelect(b)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 text-blue-700 font-bold'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <span className="truncate pr-2">{name}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 ml-1" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
