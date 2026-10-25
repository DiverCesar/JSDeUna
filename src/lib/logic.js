export function calculateCommission(bankOrigin, bankDestination) {
  if (!bankOrigin || !bankDestination) return 0;
  return bankOrigin !== bankDestination ? 0.4 : 0;
}

export function isCardExpired(expirationDate) {
  if (!expirationDate || typeof expirationDate !== 'string') return true;

  const [month, year] = expirationDate.split('/');
  if (!month || !year) return true;

  const monthNum = Number.parseInt(month, 10);
  const yearNum = Number.parseInt(year, 10);

  if (Number.isNaN(monthNum) || Number.isNaN(yearNum)) return true;
  if (monthNum < 1 || monthNum > 12) return true;

  const now = new Date();
  const expiresAt = new Date(2000 + yearNum, monthNum, 0, 23, 59, 59);
  return now > expiresAt;
}

export function serializeDocument(document) {
  if (!document) return null;
  const clone = { ...document };
  if (clone._id) clone._id = String(clone._id);
  return clone;
}
