import { useState } from "react";
import {
  updateGroup,
  removeMember,
  changeMemberRole,
  transferOwnership,
  deleteGroup,
  addMember,
} from "../services/conversationApi";
import { getErrorMessage } from "../utils/error";

export function useGroupActions(conversation, { onGroupUpdated, onGroupDeleted, onClose }) {
  const [actionLoading, setActionLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleSaveEdit(name, avatarUrl) {
    if (!name?.trim()) return;
    try {
      setActionLoading(true);
      setError("");
      const result = await updateGroup(conversation.id, {
        name: name.trim(),
        avatarUrl: avatarUrl?.trim() || null,
      });
      onGroupUpdated?.(result.conversation);
      return true;
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update group."));
      return false;
    } finally {
      setActionLoading(false);
    }
  }

  async function handlePromote(targetUserId) {
    try {
      setActionLoading(true);
      setError("");
      await changeMemberRole(conversation.id, targetUserId, "ADMIN");
      const updatedMembers = conversation.members.map((m) =>
        m.id === targetUserId ? { ...m, role: "ADMIN" } : m
      );
      onGroupUpdated?.({ ...conversation, members: updatedMembers });
    } catch (err) {
      setError(getErrorMessage(err, "Failed to promote member."));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDemote(targetUserId) {
    try {
      setActionLoading(true);
      setError("");
      await changeMemberRole(conversation.id, targetUserId, "MEMBER");
      const updatedMembers = conversation.members.map((m) =>
        m.id === targetUserId ? { ...m, role: "MEMBER" } : m
      );
      onGroupUpdated?.({ ...conversation, members: updatedMembers });
    } catch (err) {
      setError(getErrorMessage(err, "Failed to demote member."));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleTransferOwnership(targetUserId) {
    try {
      setActionLoading(true);
      setError("");
      const result = await transferOwnership(conversation.id, targetUserId);
      onGroupUpdated?.({
        ...conversation,
        currentUserRole: "ADMIN",
        members: result.members,
      });
    } catch (err) {
      setError(getErrorMessage(err, "Failed to transfer ownership."));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRemoveMember(targetUserId) {
    try {
      setActionLoading(true);
      setError("");
      await removeMember(conversation.id, targetUserId);
      const updatedMembers = conversation.members.filter((m) => m.id !== targetUserId);
      onGroupUpdated?.({ ...conversation, members: updatedMembers });
    } catch (err) {
      setError(getErrorMessage(err, "Failed to remove member."));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteGroup() {
    try {
      setIsDeleting(true);
      setError("");
      await deleteGroup(conversation.id);
      onGroupDeleted?.(conversation.id);
      onClose?.();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete group."));
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleAddMember(targetUserId) {
    try {
      setActionLoading(true);
      setError("");
      const result = await addMember(conversation.id, targetUserId);
      onGroupUpdated?.({
        ...conversation,
        members: [...(conversation.members || []), result.member],
      });
      return { success: true, member: result.member };
    } catch (err) {
      const msg =
        err.response?.status === 409
          ? "This user is already an active member of this group."
          : getErrorMessage(err, "Failed to add member.");
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setActionLoading(false);
    }
  }

  return {
    actionLoading,
    isDeleting,
    error,
    clearError: () => setError(""),
    handleSaveEdit,
    handlePromote,
    handleDemote,
    handleTransferOwnership,
    handleRemoveMember,
    handleDeleteGroup,
    handleAddMember,
  };
}
