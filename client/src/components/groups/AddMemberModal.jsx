import { useState } from "react";
import UserSearch from "../users/UserSearch";
import { CloseIcon } from "../common/Icons";

export default function AddMemberModal({ isOpen, onClose, groupName, onAddMember }) {
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  if (!isOpen) return null;

  async function handleSelectUser(targetUser) {
    if (adding || !onAddMember) return;
    setAdding(true);
    setError("");
    setSuccessMsg("");

    const result = await onAddMember(targetUser.id);
    setAdding(false);

    if (result?.success) {
      setSuccessMsg(`Added ${targetUser.name} as Member.`);
      setTimeout(() => {
        setSuccessMsg("");
        onClose();
      }, 1000);
    } else if (result?.error) {
      setError(result.error);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">Add Member</h3>
            <p className="text-xs text-slate-400">Search and select a user to add to {groupName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300">
            {successMsg}
          </div>
        )}

        <div className="mt-2">
          <UserSearch onSelectUser={handleSelectUser} />
        </div>
      </div>
    </div>
  );
}
