import { nanoid } from "nanoid";

/**
 * Generates a unique alphanumeric reference code.
 * @param length The desired length of the reference code. Defaults to 10.
 * @returns A unique alphanumeric string.
 */
export function generateUniqueReferenceCode(length: number = 10): string {
  return nanoid(length);
}

/**
 * Generates a hierarchical reference code based on a parent's code.
 * This assumes the parent code is a prefix for the child code.
 * @param parentReferenceCode The reference code of the parent marketer.
 * @param childCodeLength The desired length of the child's unique part. Defaults to 5.
 * @returns A hierarchical reference code (e.g., PARENTCODE-CHILDUNIQUEPART).
 */
export function generateHierarchicalReferenceCode(
  parentReferenceCode: string,
  childCodeLength: number = 5
): string {
  const uniquePart = nanoid(childCodeLength);
  return `${parentReferenceCode}-${uniquePart}`;
}
