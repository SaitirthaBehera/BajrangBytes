import React from 'react';
import { Building2, Heart, ShieldCheck, CheckCircle2, ExternalLink } from 'lucide-react';

interface FooterProps {
  onOpenAdminLogin?: () => void;
  onNavigateToTwinMap?: () => void;
  onNavigateToTab?: (tab: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenAdminLogin, onNavigateToTwinMap, onNavigateToTab }) => {
  const handleNavigate = (tab: string) => {
    if (onNavigateToTab) {
      onNavigateToTab(tab);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <footer id="main-footer" className="bg-slate-900 text-slate-400 text-xs border-t border-slate-800 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Col 1 */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-white">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight">AccessTwin</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Crowdsourced Accessibility Digital Twin platform for public buildings, higher education campuses, and health institutions.
            </p>
          </div>

          {/* Col 2 */}
          <div>
            <h4 className="text-white font-semibold mb-3 uppercase tracking-wider text-[11px]">Quick links</h4>
            <ul className="space-y-2 text-slate-300">
              <li 
                className="hover:text-blue-400 transition-colors cursor-pointer" 
                onClick={() => {
                  if (onNavigateToTab) handleNavigate('digital-twin');
                  else onNavigateToTwinMap?.();
                }}
              >
                Digital Twin Map
              </li>
              <li 
                className="hover:text-blue-400 transition-colors cursor-pointer" 
                onClick={() => handleNavigate('report-issue')}
              >
                Report Issue
              </li>
              <li 
                className="hover:text-blue-400 transition-colors cursor-pointer" 
                onClick={() => handleNavigate('ai-detection')}
              >
                AI Detection
              </li>
              <li 
                className="hover:text-blue-400 transition-colors cursor-pointer" 
                onClick={() => handleNavigate('navigation')}
              >
                Accessible Route
              </li>
              <li 
                className="hover:text-blue-400 transition-colors cursor-pointer" 
                onClick={() => {
                  if (onNavigateToTab) handleNavigate('admin');
                  else onOpenAdminLogin?.();
                }}
              >
                Admin Dashboard
              </li>
              <li 
                className="hover:text-blue-400 transition-colors cursor-pointer" 
                onClick={() => handleNavigate('twingram')}
              >
                TwinGram
              </li>
            </ul>
          </div>

          {/* Col 3 */}
          <div>
            <h4 className="text-white font-semibold mb-3 uppercase tracking-wider text-[11px]">Campus</h4>
            <ul className="space-y-2 text-slate-300">
              <li>
                <a 
                  href="https://www.soa.ac.in/" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="hover:text-blue-400 transition-colors inline-flex items-center gap-1.5"
                >
                  <span>Siksha &apos;O&apos; Anusandhan (SOA)</span>
                  <ExternalLink className="w-3 h-3 text-slate-500" />
                </a>
              </li>
              <li>
                <a 
                  href="https://www.soa.ac.in/iter" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="hover:text-blue-400 transition-colors inline-flex items-center gap-1.5"
                >
                  <span>ITER SOA</span>
                  <ExternalLink className="w-3 h-3 text-slate-500" />
                </a>
              </li>
            </ul>
          </div>

          {/* Col 4 */}
          <div>
            <h4 className="text-white font-semibold mb-3 uppercase tracking-wider text-[11px]">Accessibility Guarantee</h4>
            <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/60 space-y-2">
              <div className="flex items-center space-x-2 text-emerald-400 font-medium">
                <ShieldCheck className="w-4 h-4" />
                <span>WCAG 2.1 AA Standards</span>
              </div>
              <p className="text-slate-400 text-[11px]">
                High-contrast color modes, screen reader compatible labels, keyboard navigable controls, and accessible route routing.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between text-slate-500 text-[11px] gap-3">
          <p>© 2026 AccessTwin. All rights reserved.</p>
          <div className="flex items-center space-x-1 text-slate-400">
            <span>Designed with</span>
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
            <span> by Bajrang Bytes</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
