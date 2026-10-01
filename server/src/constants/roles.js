export const ROLES = Object.freeze({
  OWNER: "OWNER",
  ADMIN: "ADMIN",
  MEMBER: "MEMBER",
});

export function isValidRole(role) {
  return Object.values(ROLES).includes(role);
}
