import { useState, useEffect } from 'react';

interface CreatePRModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (title: string, branch: string) => void;
}

export default function CreatePRModal({ isOpen, onClose, onSuccess }: CreatePRModalProps) {
  const [title, setTitle] = useState('');
  const [branch, setBranch] = useState('feature/autonomous-fix');
  const [repo, setRepo] = useState('naveenkumar030/SentinelOps');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setBranch('feature/autonomous-fix');
      setRepo('naveenkumar030/SentinelOps');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!title.trim() || !branch.trim()) return;
    setIsSubmitting(true);
    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      if (onSuccess) onSuccess(title, branch);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white border border-[#E5DED6] rounded-2xl p-6 sm:p-7 max-w-md w-full shadow-2xl relative overflow-hidden">
        
        {/* Glow accent */}
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-[#D97757]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E5DED6] relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F9ECE7] border border-[#D97757]/30 text-[#D97757] flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-2xl">add</span>
            </div>
            <div>
              <h3 className="font-headline-md text-lg text-[#2D2926] font-bold tracking-tight">
                Create New PR
              </h3>
              <p className="font-body-sm text-xs text-[#6B625B]">
                Manually trigger an autonomous PR for review
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#6B625B] hover:text-[#2D2926] hover:bg-[#F2EDE6] transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="py-5 space-y-4 relative z-10">
          <div>
            <label className="block font-label-caps text-xs text-[#6B625B] uppercase font-semibold mb-1.5">
              Pull Request Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. fix: patch dependency vulnerabilities"
              className="w-full px-3 py-2 rounded-lg bg-white border border-[#E5DED6] focus:border-[#D97757] focus:ring-1 focus:ring-[#D97757] text-xs text-[#2D2926]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-label-caps text-xs text-[#6B625B] uppercase font-semibold mb-1.5">
                Target Repository
              </label>
              <input
                type="text"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#FBF9F5] border border-[#E5DED6] text-xs text-[#6B625B] font-mono"
              />
            </div>
            <div>
              <label className="block font-label-caps text-xs text-[#6B625B] uppercase font-semibold mb-1.5">
                Source Branch
              </label>
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#FBF9F5] border border-[#E5DED6] text-xs text-[#6B625B] font-mono"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-[#E5DED6] flex items-center justify-end gap-2 relative z-10">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-white border border-[#E5DED6] hover:bg-[#F2EDE6] text-[#6B625B] hover:text-[#2D2926] font-headline-sm text-xs font-semibold transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !title.trim() || !branch.trim()}
            className="px-5 py-2 rounded-lg bg-[#D97757] hover:bg-[#C66849] text-white font-headline-sm text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                <span>Submitting...</span>
              </>
            ) : (
              <span>Create PR</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
