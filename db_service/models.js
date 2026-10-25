export function serialize(doc) {
  if (!doc) return null;
  const cloned = { ...doc };
  if (cloned._id) cloned._id = String(cloned._id);
  return cloned;
}
