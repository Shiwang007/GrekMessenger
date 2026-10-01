export function buildDirectKey(userA, userB) {
  return [userA, userB].sort().join(":");
}
