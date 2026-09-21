import type { DetectionRecord } from "@/types/pothole";

const STORAGE_KEY = "potholeDetectionHistory";

/**
 * Retrieve all detection records from browser localStorage
 */
export const getStoredDetectionHistory = (): DetectionRecord[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (err) {
    console.error("Failed to read detection history from localStorage:", err);
    return [];
  }
};

/**
 * Save detection records array to browser localStorage
 */
export const saveDetectionHistory = (records: DetectionRecord[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (err) {
    console.error("Failed to save detection history to localStorage:", err);
  }
};

/**
 * Generates an auto-incrementing ID in format "PTH-001", "PTH-002", etc.
 */
export const generateNextDetectionId = (existing: DetectionRecord[]): string => {
  const numbers = existing
    .map((r) => {
      const match = r.id.match(/^PTH-(\d+)$/i);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter((n) => !isNaN(n));

  const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0;
  return `PTH-${String(maxNum + 1).padStart(3, "0")}`;
};

/**
 * Add a new detection record to storage and return updated list
 */
export const addDetectionRecord = (record: DetectionRecord): DetectionRecord[] => {
  const current = getStoredDetectionHistory();
  // Prevent duplicate IDs
  const updated = [record, ...current.filter((r) => r.id !== record.id)];
  saveDetectionHistory(updated);
  return updated;
};

/**
 * Delete a single record by ID and return updated list
 */
export const deleteDetectionRecord = (id: string): DetectionRecord[] => {
  const current = getStoredDetectionHistory();
  const updated = current.filter((r) => r.id !== id);
  saveDetectionHistory(updated);
  return updated;
};

/**
 * Clear all records from storage
 */
export const clearDetectionHistory = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error("Failed to clear detection history:", err);
  }
};
