import { useState } from "react";
import GroupMemberList from "./GroupMemberList";
import AddMemberModal from "./AddMemberModal";
import Avatar from "../common/Avatar";
import Spinner from "../common/Spinner";
import { CloseIcon } from "../common/Icons";
import {
  canManageGroup,
  canDeleteGroup,
} from "../../utils/groupPermissions";
import { useGroupActions } from "../../hooks/useGroupActions";

export default function GroupInfo({
  conversation,
  currentUserId,
  isOpen,
  onClose,
  onGroupUpdated,
  onGroupDeleted,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(conversation?.name || "");
  const [editAvatarUrl, setEditAvatarUrl] = useState(conversation?.avatarUrl || "");
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const {
    actionLoading,
    isDeleting,
    error,
    handleSaveEdit: saveEdit,
    handlePromote,
    handleDemote,
    handleTransferOwnership,
    handleRemoveMember,
    handleDeleteGroup,
    handleAddMember,
  } = useGroupActions(conversation, { onGroupUpdated, onGroupDeleted, onClose });

  if (!isOpen || !conversation) return null;

  const currentUserRole =
    conversation.currentUserRole ||
    conversation.members?.find((m) => (m.userId || m.id) === currentUserId)?.role ||
    "MEMBER";

  const allowManageGroup = canManageGroup(currentUserRole);
  const allowDelete = canDeleteGroup(currentUserRole);

  async function handleSaveEdit(e) {
    e.preventDefault();
    const success = await saveEdit(editName, editAvatarUrl);
    if (success) {
      setIsEditing(false);
    }
  }

  async function onDeleteGroup() {
    await handleDeleteGroup();
    setConfirmDelete(false);
  }

  return (
    <>
      <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-96 bg-slate-900 border-l border-white/10 shadow-2xl flex flex-col animate-slide-left">
        {/* Drawer Header */}
        <div className="h-16 px-6 border-b border-white/10 flex items-center justify-between bg-slate-900/80 backdrop-blur-md">
          <h3 className="text-base font-bold text-white">Group Details</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300">
              {error}
            </div>
          )}

          {/* Group Profile Card */}
          <div className="flex flex-col items-center text-center pb-4 border-b border-white/10">
            <Avatar
              src={conversation.avatarUrl}
              alt={conversation.name}
              type="GROUP"
              size="xl"
              className="mb-3 shadow-lg"
            />

            {!isEditing ? (
              <>
                <h4 className="text-lg font-bold text-white mb-1">{conversation.name}</h4>
                <p className="text-xs text-slate-400 mb-3">
                  Group · {conversation.members?.length || 0} active members
                </p>
                {allowManageGroup && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditName(conversation.name);
                      setEditAvatarUrl(conversation.avatarUrl || "");
                      setIsEditing(true);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-indigo-300 hover:text-white bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-xl transition-all"
                  >
                    Edit Group Info
                  </button>
                )}
              </>
            ) : (
              <form onSubmit={handleSaveEdit} className="w-full space-y-3 mt-2 text-left">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Group Name</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-slate-950/70 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Avatar URL</label>
                  <input
                    type="url"
                    value={editAvatarUrl}
                    onChange={(e) => setEditAvatarUrl(e.target.value)}
                    className="w-full bg-slate-950/70 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex items-center justify-end space-x-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md transition-all"
                  >
                    Save
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Members Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Members ({conversation.members?.length || 0})
              </h5>
              {allowManageGroup && (
                <button
                  type="button"
                  onClick={() => setIsAddMemberOpen(true)}
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center space-x-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Add Member</span>
                </button>
              )}
            </div>

            <GroupMemberList
              members={conversation.members || []}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              onPromote={handlePromote}
              onDemote={handleDemote}
              onTransferOwnership={handleTransferOwnership}
              onRemove={handleRemoveMember}
              actionLoading={actionLoading}
            />
          </div>

          {/* Danger Zone: Delete Group */}
          {allowDelete && (
            <div className="pt-6 border-t border-white/10 space-y-2">
              <h5 className="text-xs font-bold text-red-400 uppercase tracking-wider">Danger Zone</h5>
              <p className="text-[11px] text-slate-400">
                Permanently delete this group and revoke access for all members.
              </p>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="w-full py-2 px-3 text-xs font-semibold text-red-300 hover:text-white bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-xl transition-all"
              >
                Delete Group
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add Member Modal */}
      <AddMemberModal
        isOpen={isAddMemberOpen}
        onClose={() => setIsAddMemberOpen(false)}
        groupName={conversation.name}
        onAddMember={handleAddMember}
      />

      {/* Confirm Delete Group Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-red-500/30 rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <h4 className="text-base font-bold text-red-400">Delete &quot;{conversation.name}&quot;?</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              This action cannot be undone. All conversation memberships will be removed.
            </p>
            <div className="flex items-center justify-end space-x-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={onDeleteGroup}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg text-white bg-red-600 hover:bg-red-500 shadow-md shadow-red-600/30 transition-all flex items-center space-x-1.5"
              >
                {isDeleting && <Spinner size="xs" color="white" />}
                <span>Delete Group</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
