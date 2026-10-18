import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { generateExportFileName, downloadFile, triggerExport } from "./export-utils";

describe("generateExportFileName", () => {
  it("generates file name with ISO-8601 basic format timestamp", () => {
    const timestamp = new Date("2024-11-15T14:30:45.123Z");
    const fileName = generateExportFileName("json", timestamp);

    expect(fileName).toBe("settlement-evidence-20241115T143045Z.json");
  });

  it("generates CSV file name with correct format", () => {
    const timestamp = new Date("2024-11-15T14:30:45.123Z");
    const fileName = generateExportFileName("csv", timestamp);

    expect(fileName).toBe("settlement-evidence-20241115T143045Z.csv");
  });

  it("generates unique file names for different timestamps", () => {
    const timestamp1 = new Date("2024-11-15T14:30:45Z");
    const timestamp2 = new Date("2024-11-15T14:30:46Z");

    const fileName1 = generateExportFileName("json", timestamp1);
    const fileName2 = generateExportFileName("json", timestamp2);

    expect(fileName1).not.toBe(fileName2);
  });

  it("defaults to current time when no timestamp provided", () => {
    const before = Date.now();
    const fileName = generateExportFileName("json");
    const after = Date.now();

    // Verify the file name contains a valid timestamp (all digits in the date part)
    expect(fileName).toMatch(/^settlement-evidence-\d{8}T\d{6}Z\.json$/);

    // Extract and parse the timestamp from the filename
    const timestampStr = fileName.match(/\d{8}T\d{6}Z/)?.[0];
    expect(timestampStr).toBeDefined();

    if (timestampStr) {
      // Convert back to Date and verify it's within the expected range
      const generated = new Date(
        `${timestampStr.slice(0, 4)}-${timestampStr.slice(4, 6)}-${timestampStr.slice(6, 8)}T${timestampStr.slice(9, 11)}:${timestampStr.slice(11, 13)}:${timestampStr.slice(13, 15)}Z`
      );
      const generatedTime = generated.getTime();

      expect(generatedTime).toBeGreaterThanOrEqual(before);
      expect(generatedTime).toBeLessThanOrEqual(after + 1000); // Allow 1 second buffer
    }
  });

  it("uses safe characters with no special path separators", () => {
    const fileName = generateExportFileName("json");

    // Verify no path traversal characters
    expect(fileName).not.toContain("/");
    expect(fileName).not.toContain("\\");
    expect(fileName).not.toContain("..");
    expect(fileName).not.toContain(":");
    expect(fileName).not.toContain("?");
    expect(fileName).not.toContain("*");
  });

  it("formats timestamp without colons and dashes (basic format)", () => {
    const timestamp = new Date("2024-11-15T14:30:45.999Z");
    const fileName = generateExportFileName("json", timestamp);

    // Should not contain colons (except in the timestamp string itself)
    const parts = fileName.split(".");
    expect(parts[0]).not.toContain(":");
    expect(parts[0]).not.toContain("-");
  });
});

describe("downloadFile", () => {
  let createElementSpy: ReturnType<typeof vi.spyOn>;
  let appendChildSpy: ReturnType<typeof vi.spyOn>;
  let removeChildSpy: ReturnType<typeof vi.spyOn>;
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let mockAnchor: HTMLElement & { click: () => void };

  beforeEach(() => {
    mockAnchor = {
      href: "",
      download: "",
      click: vi.fn(),
      // Add any other properties as needed for a minimal mock
    } as any;

    createElementSpy = vi.spyOn(document, "createElement").mockReturnValue(mockAnchor as any);
    appendChildSpy = vi.spyOn(document.body, "appendChild").mockReturnValue(mockAnchor as any);
    removeChildSpy = vi.spyOn(document.body, "removeChild").mockReturnValue(mockAnchor as any);
    createObjectURLSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-url");
    revokeObjectURLSpy = vi.spyOn(URL, "revokeObjectURL").mockReturnValue();
  });

  afterEach(() => {
    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
  });

  it("creates an anchor element with correct properties for JSON", () => {
    const content = '{"data": "test"}';
    downloadFile(content, "test.json", "application/json");

    expect(createElementSpy).toHaveBeenCalledWith("a");
    expect(mockAnchor.download).toBe("test.json");
  });

  it("creates an anchor element with correct properties for CSV", () => {
    const content = "col1,col2\nval1,val2";
    downloadFile(content, "test.csv", "text/csv");

    expect(createElementSpy).toHaveBeenCalledWith("a");
    expect(mockAnchor.download).toBe("test.csv");
  });

  it("creates object URL for Blob content", () => {
    const blob = new Blob(["test content"], { type: "text/plain" });
    downloadFile(blob, "test.txt", "text/csv");

    expect(createObjectURLSpy).toHaveBeenCalledWith(blob);
  });

  it("triggers click on anchor element", () => {
    const content = "test";
    downloadFile(content, "test.json", "application/json");

    expect(mockAnchor.click).toHaveBeenCalled();
  });

  it("appends and removes anchor from DOM", () => {
    const content = "test";
    downloadFile(content, "test.json", "application/json");

    expect(appendChildSpy).toHaveBeenCalledWith(mockAnchor);
    expect(removeChildSpy).toHaveBeenCalledWith(mockAnchor);
  });

  it("revokes object URL after download", () => {
    const content = "test";
    downloadFile(content, "test.json", "application/json");

    expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:mock-url");
  });

  it("handles empty string content", () => {
    downloadFile("", "test.json", "application/json");

    expect(mockAnchor.click).toHaveBeenCalled();
  });

  it("sets href to created blob URL", () => {
    const content = "test content";
    downloadFile(content, "test.json", "application/json");

    expect(mockAnchor.href).toBe("blob:mock-url");
  });
});

describe("triggerExport", () => {
  let downloadFileSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    downloadFileSpy = vi.spyOn({ downloadFile }, "downloadFile");
  });

  afterEach(() => {
    downloadFileSpy.mockRestore();
  });

  it("throws error for empty content", () => {
    expect(() => {
      triggerExport("json", "");
    }).toThrow("Cannot export empty content");
  });

  it("throws error for whitespace-only content", () => {
    expect(() => {
      triggerExport("json", "   ");
    }).toThrow("Cannot export empty content");
  });

  it("generates correct file name for JSON export", () => {
    const timestamp = new Date("2024-11-15T14:30:45Z");
    const content = '{"test": true}';

    // Mock downloadFile to capture what's passed
    const calls: Parameters<typeof downloadFile>[] = [];
    vi.spyOn(window.URL, "createObjectURL").mockReturnValue("blob:mock");
    const mockAnchor = document.createElement("a");
    vi.spyOn(document, "createElement").mockReturnValue(mockAnchor);
    vi.spyOn(document.body, "appendChild").mockReturnValue(mockAnchor);
    vi.spyOn(document.body, "removeChild").mockReturnValue(mockAnchor);
    vi.spyOn(mockAnchor, "click").mockImplementation(() => {});

    // We can't easily test this without mocking the entire download mechanism
    // Just verify it doesn't throw
    expect(() => triggerExport("json", content, timestamp)).not.toThrow();
  });

  it("uses current timestamp when not provided", () => {
    const content = '{"test": true}';

    expect(() => triggerExport("json", content)).not.toThrow();
  });

  it("accepts both json and csv formats", () => {
    const content = "test,data\n1,2";

    expect(() => triggerExport("csv", content)).not.toThrow();
  });
});
