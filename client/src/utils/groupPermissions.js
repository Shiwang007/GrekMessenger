export function canManageGroup(role) {
  return role === "OWNER" || role === "ADMIN";
}

export function canManageRoles(role) {
  return role === "OWNER";
}

export function canTransferOwnership(role) {
  return role === "OWNER";
}

export function canDeleteGroup(role) {
  return role === "OWNER";
}

export function canRemoveMember(actorRole, targetRole, actorId, targetId) {
  if (targetRole === "OWNER") {
    return false;
  }
  if (actorRole === "OWNER") {
    return true;
  }
  if (actorRole === "ADMIN") {
    return targetRole === "MEMBER";
  }
  return false;
}
