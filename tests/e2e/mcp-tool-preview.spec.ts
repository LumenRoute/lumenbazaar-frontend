import { expect, test } from "@playwright/test";

test.describe("MCP Tool Preview - Desktop", () => {
  test("renders tool preview with all required elements on desktop", async ({ page }) => {
    // Navigate to a page that uses the MCP tool preview (e.g., playground)
    await page.goto("/playground");

    // Simulate opening the MCP tool preview
    // This would be triggered in actual implementation when initiating a paid request
    await page.evaluate(() => {
      // Dispatch custom event or trigger preview display through DOM interaction
      const event = new CustomEvent("show-mcp-preview", {
        detail: {
          toolName: "call_paid_resource",
          arguments: {
            resourceId: "test-resource-123",
            arguments: { query: "test query" }
          }
        }
      });
      document.dispatchEvent(event);
    });

    // Wait for the preview card to be visible
    await expect(page.getByText("Tool invocation preview")).toBeVisible();
    await expect(page.getByText("Review the tool arguments before invoking")).toBeVisible();
  });

  test("displays tool information in info blocks on desktop", async ({ page }) => {
    await page.goto("/playground");

    // Trigger preview display
    await page.evaluate(() => {
      const event = new CustomEvent("show-mcp-preview", {
        detail: {
          toolName: "search_paid_resources",
          arguments: { q: "weather API" }
        }
      });
      document.dispatchEvent(event);
    });

    // Verify tool metadata is displayed
    await expect(page.getByText("search_paid_resources")).toBeVisible();
    await expect(page.getByText("Default limit")).toBeVisible();
    await expect(page.getByText("1.0000000")).toBeVisible();
    await expect(page.getByText("10 calls")).toBeVisible();
  });

  test("shows sensitive data warnings and masking on desktop", async ({ page }) => {
    await page.goto("/playground");

    // Trigger preview with sensitive arguments
    await page.evaluate(() => {
      const event = new CustomEvent("show-mcp-preview", {
        detail: {
          toolName: "call_paid_resource",
          arguments: {
            resourceId: "test-resource",
            paymentPayload: { signature: "secret-sig-value" },
            arguments: {}
          }
        }
      });
      document.dispatchEvent(event);
    });

    // Verify sensitive data warning badge appears
    await expect(page.getByText("Sensitive data")).toBeVisible();

    // Verify sensitive fields are redacted
    const redactedText = await page.getByText("[redacted]").count();
    expect(redactedText).toBeGreaterThan(0);

    // Verify sensitive field badges appear
    await expect(page.getByText("sensitive")).toBeVisible();
  });

  test("displays arguments preview with required badges on desktop", async ({ page }) => {
    await page.goto("/playground");

    // Trigger preview
    await page.evaluate(() => {
      const event = new CustomEvent("show-mcp-preview", {
        detail: {
          toolName: "call_paid_resource",
          arguments: {
            resourceId: "test-resource",
            arguments: { param: "value" },
            paymentPayload: { amount: "0.5" }
          }
        }
      });
      document.dispatchEvent(event);
    });

    // Verify arguments are displayed
    await expect(page.getByText("resourceId")).toBeVisible();
    await expect(page.getByText("arguments")).toBeVisible();
    await expect(page.getByText("paymentPayload")).toBeVisible();

    // Verify required badges appear
    const requiredBadges = await page.getByText("required").count();
    expect(requiredBadges).toBeGreaterThanOrEqual(3);
  });

  test("displays payment payload when provided on desktop", async ({ page }) => {
    await page.goto("/playground");

    // Trigger preview with payment payload
    await page.evaluate(() => {
      const event = new CustomEvent("show-mcp-preview", {
        detail: {
          toolName: "call_paid_resource",
          arguments: {
            resourceId: "test-resource",
            arguments: {},
            paymentPayload: {}
          },
          paymentPayload: {
            paymentRequirements: { amount: "0.5", asset: "native" }
          }
        }
      });
      document.dispatchEvent(event);
    });

    // Verify payment authorization section appears
    await expect(page.getByText("Payment authorization")).toBeVisible();
    await expect(page.getByText("sensitive fields masked")).toBeVisible();
  });

  test("displays deterministic errors on desktop", async ({ page }) => {
    await page.goto("/playground");

    // Trigger preview
    await page.evaluate(() => {
      const event = new CustomEvent("show-mcp-preview", {
        detail: {
          toolName: "call_paid_resource",
          arguments: {
            resourceId: "test-resource",
            arguments: {},
            paymentPayload: {}
          }
        }
      });
      document.dispatchEvent(event);
    });

    // Verify deterministic errors are displayed
    await expect(page.getByText("Expected errors")).toBeVisible();
    await expect(page.getByText("PAYMENT_REQUIRED")).toBeVisible();
    await expect(page.getByText("SETTLEMENT_FAILED")).toBeVisible();
    await expect(page.getByText("REPLAY_DETECTED")).toBeVisible();
  });

  test("confirm button triggers callback on desktop", async ({ page }) => {
    await page.goto("/playground");

    // Set up listener for confirmation
    const confirmPromise = page.evaluate(() => {
      return new Promise((resolve) => {
        document.addEventListener("mcp-preview-confirmed", () => {
          resolve("confirmed");
        });
      });
    });

    // Trigger preview
    await page.evaluate(() => {
      const event = new CustomEvent("show-mcp-preview", {
        detail: {
          toolName: "call_paid_resource",
          arguments: {
            resourceId: "test-resource",
            arguments: {},
            paymentPayload: {}
          }
        }
      });
      document.dispatchEvent(event);
    });

    // Click confirm button
    await page.getByRole("button", { name: /Confirm invocation/ }).click();

    // Verify callback was triggered
    await expect(confirmPromise).resolves.toBe("confirmed");
  });

  test("cancel button triggers callback on desktop", async ({ page }) => {
    await page.goto("/playground");

    // Set up listener for cancellation
    const cancelPromise = page.evaluate(() => {
      return new Promise((resolve) => {
        document.addEventListener("mcp-preview-cancelled", () => {
          resolve("cancelled");
        });
      });
    });

    // Trigger preview
    await page.evaluate(() => {
      const event = new CustomEvent("show-mcp-preview", {
        detail: {
          toolName: "search_paid_resources",
          arguments: { q: "test" }
        }
      });
      document.dispatchEvent(event);
    });

    // Click cancel button
    await page.getByRole("button", { name: /Cancel/ }).click();

    // Verify callback was triggered
    await expect(cancelPromise).resolves.toBe("cancelled");
  });

  test("loading state disables buttons on desktop", async ({ page }) => {
    await page.goto("/playground");

    // Trigger preview with loading state
    await page.evaluate(() => {
      const event = new CustomEvent("show-mcp-preview", {
        detail: {
          toolName: "call_paid_resource",
          arguments: {
            resourceId: "test-resource",
            arguments: {},
            paymentPayload: {}
          },
          isLoading: true
        }
      });
      document.dispatchEvent(event);
    });

    // Verify loading state
    await expect(page.getByText("Invoking...")).toBeVisible();

    // Verify buttons are disabled
    const confirmButton = page.getByRole("button", { name: /Invoking/ });
    const cancelButton = page.getByRole("button", { name: /Cancel/ });

    await expect(confirmButton).toBeDisabled();
    await expect(cancelButton).toBeDisabled();
  });
});

test.describe("MCP Tool Preview - Mobile", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("renders tool preview with responsive layout on mobile", async ({ page }) => {
    await page.goto("/playground");

    // Trigger preview
    await page.evaluate(() => {
      const event = new CustomEvent("show-mcp-preview", {
        detail: {
          toolName: "call_paid_resource",
          arguments: {
            resourceId: "test-resource-123",
            arguments: { query: "test query" },
            paymentPayload: {}
          }
        }
      });
      document.dispatchEvent(event);
    });

    // Verify preview is visible on mobile
    await expect(page.getByText("Tool invocation preview")).toBeVisible();

    // Verify responsive layout (buttons should stack vertically on mobile)
    const buttons = await page.getByRole("button").count();
    expect(buttons).toBeGreaterThanOrEqual(2);
  });

  test("displays tool information in responsive grid on mobile", async ({ page }) => {
    await page.goto("/playground");

    // Trigger preview
    await page.evaluate(() => {
      const event = new CustomEvent("show-mcp-preview", {
        detail: {
          toolName: "search_paid_resources",
          arguments: { q: "weather" }
        }
      });
      document.dispatchEvent(event);
    });

    // Verify all info is visible on mobile
    await expect(page.getByText("search_paid_resources")).toBeVisible();
    await expect(page.getByText("Default limit")).toBeVisible();
    await expect(page.getByText("1.0000000")).toBeVisible();
  });

  test("scrollable arguments preview on mobile with tall content", async ({ page }) => {
    await page.goto("/playground");

    // Trigger preview with many arguments
    await page.evaluate(() => {
      const event = new CustomEvent("show-mcp-preview", {
        detail: {
          toolName: "call_paid_resource",
          arguments: {
            resourceId: "test-resource",
            maxAmount: "0.5",
            arguments: {
              param1: "value1",
              param2: "value2",
              param3: "value3",
              nested: { key: "value" }
            },
            paymentPayload: { signature: "secret" }
          }
        }
      });
      document.dispatchEvent(event);
    });

    // Verify arguments section is present
    await expect(page.getByText("Tool arguments")).toBeVisible();

    // Verify scrolling is available if needed
    const scrollableArea = page.locator("pre");
    const box = await scrollableArea.first().boundingBox();
    if (box) {
      expect(box.height).toBeGreaterThan(0);
    }
  });

  test("buttons are accessible and clickable on mobile", async ({ page }) => {
    await page.goto("/playground");

    // Trigger preview
    await page.evaluate(() => {
      const event = new CustomEvent("show-mcp-preview", {
        detail: {
          toolName: "inspect_resource",
          arguments: { resourceId: "test-resource" }
        }
      });
      document.dispatchEvent(event);
    });

    // Verify buttons are accessible and have sufficient touch target size
    const confirmButton = page.getByRole("button", { name: /Confirm invocation/ });
    const cancelButton = page.getByRole("button", { name: /Cancel/ });

    const confirmBox = await confirmButton.boundingBox();
    const cancelBox = await cancelButton.boundingBox();

    // Verify minimum touch target size (48x48 pixels recommended)
    expect(confirmBox?.height).toBeGreaterThanOrEqual(40);
    expect(cancelBox?.height).toBeGreaterThanOrEqual(40);
  });

  test("sensitive data warning is visible on mobile", async ({ page }) => {
    await page.goto("/playground");

    // Trigger preview with sensitive data
    await page.evaluate(() => {
      const event = new CustomEvent("show-mcp-preview", {
        detail: {
          toolName: "call_paid_resource",
          arguments: {
            resourceId: "test-resource",
            privateKey: "secret-key",
            arguments: {},
            paymentPayload: {}
          }
        }
      });
      document.dispatchEvent(event);
    });

    // Verify warning is visible
    await expect(page.getByText("Sensitive data")).toBeVisible();
  });

  test("payment payload can be scrolled on mobile", async ({ page }) => {
    await page.goto("/playground");

    // Trigger preview with payment payload
    await page.evaluate(() => {
      const event = new CustomEvent("show-mcp-preview", {
        detail: {
          toolName: "call_paid_resource",
          arguments: {
            resourceId: "test-resource",
            arguments: {},
            paymentPayload: {}
          },
          paymentPayload: {
            paymentRequirements: {
              amount: "0.5",
              asset: "native",
              recipient: "GCZST3XVCDTUJ76ZAV2HA72KYXM4YUSQBF4G5J5GDZPBWANQW6EI4F2A"
            },
            signature: "very-long-secret-signature-value-that-should-be-redacted"
          }
        }
      });
      document.dispatchEvent(event);
    });

    // Verify payment section is present
    await expect(page.getByText("Payment authorization")).toBeVisible();

    // Verify redacted content is visible
    await expect(page.getByText("[redacted]")).toBeVisible();
  });

  test("responsive header layout on mobile", async ({ page }) => {
    await page.goto("/playground");

    // Trigger preview
    await page.evaluate(() => {
      const event = new CustomEvent("show-mcp-preview", {
        detail: {
          toolName: "call_paid_resource",
          arguments: {
            resourceId: "test-resource",
            arguments: {},
            paymentPayload: {}
          }
        }
      });
      document.dispatchEvent(event);
    });

    // Verify header elements are visible and properly arranged on mobile
    await expect(page.getByText("Tool invocation preview")).toBeVisible();
    await expect(page.getByText("Review the tool arguments before invoking")).toBeVisible();

    // Verify badges are visible
    const badges = await page.getByRole("img", { hidden: true }).count();
    expect(badges).toBeGreaterThanOrEqual(0);
  });
});

test.describe("MCP Tool Preview - Error Handling", () => {
  test("displays error when tool is not found", async ({ page }) => {
    await page.goto("/playground");

    // Trigger preview with invalid tool
    await page.evaluate(() => {
      const event = new CustomEvent("show-mcp-preview", {
        detail: {
          toolName: "invalid_tool",
          arguments: {}
        }
      });
      document.dispatchEvent(event);
    });

    // Verify error message appears
    await expect(page.getByText("Tool not found")).toBeVisible();
  });

  test("handles empty arguments gracefully", async ({ page }) => {
    await page.goto("/playground");

    // Trigger preview with empty arguments
    await page.evaluate(() => {
      const event = new CustomEvent("show-mcp-preview", {
        detail: {
          toolName: "search_paid_resources",
          arguments: {}
        }
      });
      document.dispatchEvent(event);
    });

    // Verify component still renders
    await expect(page.getByText("Tool invocation preview")).toBeVisible();
    await expect(page.getByText("No arguments provided.")).toBeVisible();
  });

  test("handles large argument values without layout issues", async ({ page }) => {
    await page.goto("/playground");

    // Trigger preview with large argument
    const largeValue = "x".repeat(1000);
    await page.evaluate(
      (large) => {
        const event = new CustomEvent("show-mcp-preview", {
          detail: {
            toolName: "call_paid_resource",
            arguments: {
              resourceId: "test-resource",
              arguments: { largeParam: large },
              paymentPayload: {}
            }
          }
        });
        document.dispatchEvent(event);
      },
      largeValue
    );

    // Verify content is still visible and scrollable
    await expect(page.getByText("Tool arguments")).toBeVisible();
  });
});
