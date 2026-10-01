import { useState } from "react";
import Avatar from "../common/Avatar";
import RoleBadge from "../common/RoleBadge";
import {
  canManageRoles,
  canTransferOwnership,
  canRemoveMember,
} from "../../utils/groupPermissions";
import { usePresence } from "../../context/PresenceContext";
import { formatLastSeen } from "../../utils/presence";

export default function GroupMemberList({
  members = [],
  currentUserId,
  currentUserRole,
  onPromote,
  onDemote,
  onTransferOwnership,
  onRemove,
  actionLoading,
}) {
  const [confirmDialog, setConfirmDialog] = useState(null); // { type, member }

  function handleActionClick(type, member) {
    setConfirmDialog({ type, member });
  }

  function handleConfirm() {
    if (!confirmDialog) return;
    const { type, member } = confirmDialog;
    setConfirmDialog(null);

    if (type === "promote") {
      onPromote(member.id);
    } else if (type === "demote") {
      onDemote(member.id);
    } else if (type === "transfer") {
      onTransferOwnership(member.id);
    } else if (type === "remove") {
      onRemove(member.id);
    }
  }

  return (
    <div className="space-y-2">
      {/* Confirmation Dialog Modal */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <h4 className="text-base font-bold text-white">
              {confirmDialog.type === "transfer" && "Transfer Group Ownership"}
              {confirmDialog.type === "remove" && "Remove Member"}
              {confirmDialog.type === "promote" && "Promote to Admin"}
              {confirmDialog.type === "demote" && "Demote to Member"}
            </h4>

            <p className="text-xs text-slate-300 leading-relaxed">
              {confirmDialog.type === "transfer" && (
                <>
                  Are you sure you want to transfer ownership to <strong>{confirmDialog.member.name}</strong>?
                  You will become an <strong>ADMIN</strong>.
                </>
              )}
              {confirmDialog.type === "remove" && (
                <>
                  Are you sure you want to remove <strong>{confirmDialog.member.name}</strong> from the group?
                </>
              )}
              {confirmDialog.type === "promote" && (
                <>
                  Promote <strong>{confirmDialog.member.name}</strong> to <strong>ADMIN</strong>?
                  They will be able to manage members and group details.
                </>
              )}
              {confirmDialog.type === "demote" && (
                <>
                  Demote <strong>{confirmDialog.member.name}</strong> back to <strong>MEMBER</strong>?
                </>
              )}
            </p>

            <div className="flex items-center justify-end space-x-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className={`px-4 py-1.5 text-xs font-semibold rounded-lg text-white shadow-md transition-all ${
                  confirmDialog.type === "remove"
                    ? "bg-red-600 hover:bg-red-500 shadow-red-600/30"
                    : confirmDialog.type === "transfer"
                    ? "bg-amber-600 hover:bg-amber-500 shadow-amber-600/30"
                    : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30"
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {members.map((member) => (
        <GroupMemberRow
          key={member.id}
          member={member}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          actionLoading={actionLoading}
          onActionClick={handleActionClick}
        />
      ))}
    </div>
  );
}

function GroupMemberRow({
  member,
  currentUserId,
  currentUserRole,
  actionLoading,
  onActionClick,
}) {
  const isSelf = member.id === currentUserId;
  const isOwner = member.role === "OWNER";
  const isAdmin = member.role === "ADMIN";
  const isNormalMember = member.role === "MEMBER";

  const presence = usePresence(isSelf ? null : member.id);

  const allowRemove = canRemoveMember(
    currentUserRole,
    member.role,
    currentUserId,
    member.id
  );
  const allowRoleChange = canManageRoles(currentUserRole) && !isSelf && !isOwner;
  const allowTransfer = canTransferOwnership(currentUserRole) && !isSelf;

  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
      <div className="flex items-center space-x-3 min-w-0">
        <div className="relative flex-shrink-0">
          <Avatar
            src={member.avatar_url}
            alt={member.name}
            type="DIRECT"
            size="md"
            className="!w-9 !h-9 !rounded-xl"
          />
          {!isSelf && presence.online && (
            <span
              className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-slate-900 rounded-full shadow-sm"
              title="Online"
            />
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-100 truncate">
              {member.name}
            </span>
            {isSelf && (
              <span className="text-[10px] text-slate-400 font-mono">(You)</span>
            )}
          </div>
          <div className="flex items-center space-x-2 mt-0.5">
            <RoleBadge role={member.role} />
            {!isSelf && (
              <span className="text-[10px] text-slate-400 truncate">
                {presence.online ? (
                  <span className="text-emerald-400 font-medium">Online</span>
                ) : presence.lastSeenAt ? (
                  <span>Last seen {formatLastSeen(presence.lastSeenAt)}</span>
                ) : (
                  <span>Offline</span>
                )}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Role-conditioned Actions */}
      <div className="flex items-center space-x-1.5 flex-shrink-0">
        {allowRoleChange && (
          <>
            {isNormalMember && (
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => onActionClick("promote", member)}
                className="px-2 py-1 text-[11px] font-semibold text-indigo-300 hover:text-white bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-lg transition-all"
                title="Promote to Admin"
              >
                Promote
              </button>
            )}
            {isAdmin && (
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => onActionClick("demote", member)}
                className="px-2 py-1 text-[11px] font-semibold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all"
                title="Demote to Member"
              >
                Demote
              </button>
            )}
          </>
        )}

        {allowTransfer && (
          <button
            type="button"
            disabled={actionLoading}
            onClick={() => onActionClick("transfer", member)}
            className="px-2 py-1 text-[11px] font-semibold text-amber-300 hover:text-white bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg transition-all"
            title="Transfer Ownership"
          >
            Transfer
          </button>
        )}

        {allowRemove && (
          <button
            type="button"
            disabled={actionLoading}
            onClick={() => onActionClick("remove", member)}
            className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
            title="Remove from group"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
