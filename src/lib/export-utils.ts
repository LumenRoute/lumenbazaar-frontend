/**
 * Utilities for exporting data and triggering downloads.
 * Handles file name generation, Blob creation, and browser download triggers.
 */

/**
 * Generates a standardized export file name with timestamp.
 * Uses ISO-8601 basic format (YYYYMMDDTHHMMSSZ) to ensure valid filenames on all platforms.
 *
 * @param format The file format (json or csv)
 * @param timestamp Optional custom timestamp; defaults to now
 * @returns A filename like settlement-evidence-20241115T143045Z.json
 */
export function generateExportFileName(format: "json" | "csv", timestamp = new Date()): string {
  // ISO-8601 basic format: YYYYMMDDTHHMMSSZ (no colons, dashes, or spaces)
  const isoBasic = timestamp
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

  return `settlement-evidence-${isoBasic}.${format}`;
}

/**
 * Triggers a browser file download by creating a Blob and simulating a click.
 * Works in all modern browsers (Chrome, Firefox, Safari, Edge).
 *
 * @param content The file content (string or Blob)
 * @param fileName The name to save the file as
 * @param mimeType The MIME type (application/json, text/csv)
 */
export function downloadFile(
  content: string | Blob,
  fileName: string,
  mimeType: "application/json" | "text/csv"
): void {
  // Create Blob if content is a string
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });

  // Create a temporary URL for the blob
  const url = URL.createObjectURL(blob);

  // Create a temporary anchor element and trigger download
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  // Clean up the temporary URL
  URL.revokeObjectURL(url);
}

/**
 * Type-safe export trigger that validates data before download.
 * Handles both JSON and CSV formats with appropriate MIME types.
 *
 * @param format The export format (json or csv)
 * @param content The file content as string
 * @param timestamp Optional custom timestamp for file naming
 * @throws If content is empty or format is invalid
 */
export function triggerExport(
  format: "json" | "csv",
  content: string,
  timestamp?: Date
): void {
  if (!content || content.trim().length === 0) {
    throw new Error("Cannot export empty content");
  }

  const fileName = generateExportFileName(format, timestamp);
  const mimeType = format === "json" ? "application/json" : "text/csv";

  downloadFile(content, fileName, mimeType);
}
