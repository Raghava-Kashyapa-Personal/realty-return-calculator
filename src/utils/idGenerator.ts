/**
 * Generates a unique ID using timestamp and random string
 * More reliable than Math.random() alone
 */
export const generateId = (prefix: string = 'id'): string => {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `${prefix}-${timestamp}-${randomPart}`;
};

/**
 * Generates a project ID from a date
 */
export const generateProjectId = (): string => {
  const today = new Date().toISOString().split('T')[0];
  const randomPart = Math.random().toString(36).substring(2, 8);
  return `${today}-${randomPart}`;
};

/**
 * Generates a payment/entry ID
 */
export const generatePaymentId = (): string => {
  return generateId('entry');
};
