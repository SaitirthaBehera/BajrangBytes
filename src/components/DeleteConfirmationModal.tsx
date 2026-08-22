import React from 'react';
import { X, AlertCircle } from 'lucide-react';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}

export const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({ isOpen, onClose, onConfirm, isDeleting }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Delete this post?</h2>
        <p className="text-sm text-slate-600">
          This will permanently delete the post, its comments, reactions, and associated image. This action cannot be undone.
        </p>
        
        <div className="flex gap-3 pt-4">
          <button 
            onClick={onClose} 
            disabled={isDeleting}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm py-3 rounded-xl transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm} 
            disabled={isDeleting}
            className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm py-3 rounded-xl transition-all cursor-pointer disabled:opacity-50"
          >
            {isDeleting ? 'Deleting...' : 'Delete Post'}
          </button>
        </div>
      </div>
    </div>
  );
};
