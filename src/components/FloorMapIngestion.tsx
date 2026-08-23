import React, { useState, useRef } from 'react';
import { 
  Upload, 
  Map, 
  Cpu, 
  CheckCircle2, 
  AlertTriangle, 
  Layers, 
  ArrowRight, 
  FileText,
  Database,
  Sparkles,
  Building,
  RefreshCw
} from 'lucide-react';

export const FloorMapIngestion: React.FC = () => {
  const [selectedBuilding, setSelectedBuilding] = useState<string>('block_f');
  const [customBuildingName, setCustomBuildingName] = useState<string>('');
  const [floorNumber, setFloorNumber] = useState<number>(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestionResult, setIngestionResult] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setIngestionResult(null);
      setErrorMessage(null);

      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadAndIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMessage('Please select an architectural floor map or CAD image to ingest.');
      return;
    }

    const bldgId = selectedBuilding === 'custom' 
      ? (customBuildingName.trim() || 'new_block')
      : selectedBuilding;

    setIsIngesting(true);
    setErrorMessage(null);
    setIngestionResult(null);

    try {
      const formData = new FormData();
      formData.append('building_id', bldgId);
      formData.append('floor_number', floorNumber.toString());
      formData.append('file', selectedFile);

      const res = await fetch('/api/admin/upload-floor-map', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        let errDetail = `Ingestion failed with status ${res.status}`;
        try {
          const errJson = await res.json();
          if (errJson.detail) errDetail = errJson.detail;
        } catch {}
        throw new Error(errDetail);
      }

      const data = await res.json();
      setIngestionResult(data);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to ingest floor map. Check backend status.');
    } finally {
      setIsIngesting(false);
    }
  };

  return (
    <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <span className="bg-purple-100 text-purple-800 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center space-x-1">
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              <span>AI Multimodal Blueprint Ingestion</span>
            </span>
            <span className="text-xs font-mono text-slate-400">Gemini 3.6 Vision ➔ Supabase</span>
          </div>
          <h3 className="text-xl font-bold text-slate-900 mt-2">
            Automated Floor Plan & Indoor Graph Ingestion
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            Upload any 2D architectural blueprint or CAD diagram. Gemini 3.7 Vision will automatically extract rooms, stairs, lifts, and corridors, then sync the graph directly into Supabase.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upload Form */}
        <form onSubmit={handleUploadAndIngest} className="space-y-6">
          {/* Building Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Target Building Block *
            </label>
            <select
              value={selectedBuilding}
              onChange={(e) => setSelectedBuilding(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            >
              <option value="block_f">Block F (Freshman Complex)</option>
              <option value="block_a">Block A (Computer Science)</option>
              <option value="block_b">Block B (Electrical Science)</option>
              <option value="block_c">Block C (Mechanical & Civil)</option>
              <option value="block_d">Block D (Biotechnology)</option>
              <option value="block_e">Block E (Humanities & Management)</option>
              <option value="data_science_block">Data Science & AI Block</option>
              <option value="sc_block">Student Activity Center (SC Block)</option>
              <option value="auditorium">Main Auditorium Complex</option>
              <option value="library">Central Academic Library</option>
              <option value="custom">+ Add New Custom Block...</option>
            </select>
          </div>

          {selectedBuilding === 'custom' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                New Building Identifier *
              </label>
              <input
                type="text"
                value={customBuildingName}
                onChange={(e) => setCustomBuildingName(e.target.value)}
                placeholder="e.g. block_g or research_annex"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </div>
          )}

          {/* Floor Number Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Floor Number *
            </label>
            <select
              value={floorNumber}
              onChange={(e) => setFloorNumber(parseInt(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            >
              <option value={0}>Ground Floor (Floor 0)</option>
              <option value={1}>Floor 1</option>
              <option value={2}>Floor 2</option>
              <option value={3}>Floor 3</option>
              <option value={4}>Floor 4</option>
              <option value={5}>Floor 5</option>
            </select>
          </div>

          {/* File Upload Box */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Architectural Blueprint Image (PNG / JPG) *
            </label>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-purple-200 hover:border-purple-400 bg-purple-50/30 hover:bg-purple-50/60 transition-all rounded-2xl p-6 text-center cursor-pointer space-y-2"
            >
              <Upload className="w-8 h-8 text-purple-600 mx-auto" />
              <div className="text-xs font-bold text-slate-800">
                {selectedFile ? selectedFile.name : 'Click to select blueprint file'}
              </div>
              <p className="text-[11px] text-slate-500">Supports CAD drawings, 2D architectural blueprints, or sketch diagrams</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl text-xs flex items-center space-x-2 font-medium">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isIngesting || !selectedFile}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs py-3.5 rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {isIngesting ? (
              <>
                <Cpu className="w-4 h-4 animate-spin text-white" />
                <span>AI Vision Scanning Blueprint & Syncing Supabase...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-white" />
                <span>Ingest Blueprint & Update Dijkstra Graph</span>
              </>
            )}
          </button>
        </form>

        {/* Blueprint Visual Preview & Live Extraction Results */}
        <div className="space-y-6">
          <div className="bg-slate-900 rounded-3xl p-5 border border-slate-800 text-white space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold uppercase tracking-wider text-slate-300">Blueprint Preview</span>
              <span className="font-mono text-[11px] text-purple-400">
                {selectedBuilding.toUpperCase()} — Floor {floorNumber}
              </span>
            </div>

            <div className="h-64 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-center overflow-hidden">
              {previewUrl && previewUrl.length > 0 ? (
                <img 
                  src={previewUrl} 
                  alt="Floor Blueprint Preview" 
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center p-6 text-slate-500 space-y-2">
                  <Map className="w-10 h-10 mx-auto text-slate-700" />
                  <p className="text-xs">No Blueprint selected yet.</p>
                </div>
              )}
            </div>
          </div>

          {/* Ingestion Results Card */}
          {ingestionResult && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 space-y-4">
              <div className="flex items-center space-x-2 text-emerald-800 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>AI Ingestion & Supabase Sync Complete!</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-white p-3 rounded-xl border border-emerald-100">
                  <div className="text-slate-500">Rooms & Nodes Extracted</div>
                  <div className="text-lg font-black text-emerald-700 mt-0.5">
                    {ingestionResult.nodes_extracted} Nodes
                  </div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-emerald-100">
                  <div className="text-slate-500">Corridor Edges Built</div>
                  <div className="text-lg font-black text-blue-700 mt-0.5">
                    {ingestionResult.edges_generated} Edges
                  </div>
                </div>
              </div>

              {ingestionResult.sample_nodes && ingestionResult.sample_nodes.length > 0 && (
                <div className="space-y-1.5 text-xs">
                  <span className="font-bold text-slate-700">Sample Discovered Locations:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {ingestionResult.sample_nodes.map((label: string, idx: number) => (
                      <span key={idx} className="bg-white text-slate-800 px-2 py-0.5 rounded text-[11px] font-semibold border border-emerald-200">
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-emerald-100/70 p-3 rounded-xl text-[11px] text-emerald-900 flex items-center space-x-2 font-medium">
                <Database className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>{ingestionResult.sync_details?.note || 'Live in Dijkstra router & Supabase table!'}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
