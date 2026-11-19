# MCP Response Viewer

The MCP Response Viewer is a secure, user-friendly component for displaying MCP tool responses with built-in redaction, size limits, and safe copy controls. It handles large responses, malformed data, and sensitive information safely.

## Overview

The response viewer provides:
- **Structured rendering** of JSON and text responses with syntax highlighting
- **Automatic redaction** of sensitive payment data before display and copy
- **Size limits** to prevent page freezes from large responses
- **Expandable sections** for preview/full content switching
- **Safe copy-to-clipboard** with redaction applied
- **Error isolation** for malformed responses
- **Mobile-responsive** design for desktop and mobile viewports

## Components

### McpResponseViewer

Main component for displaying MCP responses with full features.

```tsx
import { McpResponseViewer } from "@/components/mcp/mcp-response-viewer";

export function PaymentResult({ response }) {
  return (
    <McpResponseViewer
      response={response}
      title="Payment Response"
      description="Resource response from paid API call"
      redact={true}
      additionalRedactionKeys={["customSecret"]}
      maxSize={1024 * 1024}
    />
  );
}
```

**Props:**

- `response` (unknown, required): The response data to display
- `title` (string, optional): Title shown above response. Default: "Response"
- `description` (string, optional): Description text below title
- `redact` (boolean, optional): Whether to redact sensitive data. Default: `true`
- `additionalRedactionKeys` (string[], optional): Additional keys to redact beyond defaults
- `maxSize` (number, optional): Maximum display size in bytes. Default: 1MB
- `maxPreviewLines` (number, optional): Lines to show before expand. Default: 50

**Behaviors:**

- **Small responses** (<10KB): Shows full content immediately
- **Medium responses** (10-100KB): Shows preview with expand button
- **Large responses** (100KB-1MB): Shows truncated preview with "Show more" button
- **Huge responses** (>1MB): Shows warning message, prevents rendering, offers copy button

### McpResponsePreview

Lightweight preview component for compact contexts.

```tsx
import { McpResponsePreview } from "@/components/mcp/mcp-response-viewer";

export function ResourceCard({ response }) {
  const [showFull, setShowFull] = useState(false);

  if (showFull) {
    return (
      <McpResponseViewer
        response={response}
        title="Full Response"
      />
    );
  }

  return (
    <McpResponsePreview
      response={response}
      title="Response Preview"
      onOpenFull={() => setShowFull(true)}
    />
  );
}
```

**Props:**

- `response` (unknown, required): Response data to preview
- `title` (string, optional): Title text
- `onOpenFull` (function, optional): Callback when "View full" is clicked

### McpResponseContainer

Layout container for multiple response viewers.

```tsx
import { McpResponseContainer } from "@/components/mcp/mcp-response-viewer";

export function PaymentOutcomePanel({ outcome }) {
  return (
    <McpResponseContainer>
      <McpResponseViewer response={outcome.request} title="Request" />
      <McpResponseViewer response={outcome.response} title="Response" />
      <McpResponseViewer response={outcome.receipt} title="Receipt" />
    </McpResponseContainer>
  );
}
```

## Redaction

### Automatic Redaction

By default, the viewer automatically redacts sensitive payment-related fields:

- `authorization`
- `paymentPayload`
- `privateKey`
- `secret`
- `signature`
- `signedXdr`
- `walletAddress`
- `xdr`

Redaction is case-insensitive and detects keys containing these patterns anywhere in the name.

### Custom Redaction

Specify additional keys to redact:

```tsx
<McpResponseViewer
  response={response}
  redact={true}
  additionalRedactionKeys={["apiKey", "internalId"]}
/>
```

### Disabling Redaction

For development or when viewing public-only data:

```tsx
<McpResponseViewer
  response={response}
  redact={false}
/>
```

**Security Note:** Disabling redaction should only be used for explicitly public testnet data. Never disable for production or sensitive flows.

## Export Utilities

The `export-utils.ts` module provides utilities for safe response handling:

### formatResponseForDisplay

Formats a response for UI display with optional redaction.

```tsx
import { formatResponseForDisplay } from "@/lib/export-utils";

const displayText = formatResponseForDisplay(response, {
  redact: true,
  additionalRedactionKeys: ["customSecret"],
  maxSize: 1024 * 1024
});
```

### formatResponseForCopy

Formats a response for clipboard copy with redaction and truncation.

```tsx
import { formatResponseForCopy } from "@/lib/export-utils";

const { content, truncated, reason } = formatResponseForCopy(response, {
  redact: true,
  maxSize: 1024 * 1024
});

if (truncated) {
  console.warn("Response truncated:", reason);
}

await navigator.clipboard.writeText(content);
```

### estimateResponseSize

Estimates response size and categorizes it.

```tsx
import { estimateResponseSize } from "@/lib/export-utils";

const sizeInfo = estimateResponseSize(response);
// Returns: { bytes, category: "small"|"medium"|"large"|"huge", canDisplay, displayLimit }

if (!sizeInfo.canDisplay) {
  console.log(`Response too large: ${sizeInfo.bytes / 1024 / 1024}MB`);
}
```

### validateResponseStructure

Validates response data structure and detects malformed data.

```tsx
import { validateResponseStructure } from "@/lib/export-utils";

const validation = validateResponseStructure(response);
if (!validation.valid) {
  validation.errors.forEach(error => console.error(error));
}
```

### truncateForPreview

Truncates response for initial preview rendering.

```tsx
import { truncateForPreview } from "@/lib/export-utils";

const preview = truncateForPreview(response, 50); // First 50 lines
// Returns: { content, truncated, totalLines }

if (preview.truncated) {
  console.log(`Showing ${preview.content.split('\n').length} of ${preview.totalLines} lines`);
}
```

### redactSensitiveData

Recursively redacts sensitive fields from data.

```tsx
import { redactSensitiveData } from "@/lib/export-utils";

const safe = redactSensitiveData(response, ["customSecret"]);
// Returns copy with sensitive fields replaced with "[redacted]"
```

## Usage Examples

### In Payment Flow

```tsx
import { McpResponseViewer } from "@/components/mcp/mcp-response-viewer";

export function PaymentOutcomePanel({ outcome }) {
  return (
    <div className="space-y-4">
      <div className="border-t border-slate-200 pt-4">
        <p className="text-sm leading-6 text-slate-700">{outcome.message}</p>
        
        {outcome.receipt && (
          <div className="mt-4">
            <h3 className="font-semibold text-slate-950">Settlement Details</h3>
            <dl className="mt-2 grid gap-4 text-sm md:grid-cols-3">
              <div>
                <dt className="text-slate-500">Receipt ID</dt>
                <dd className="font-medium text-slate-950">{outcome.receipt.id}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Status</dt>
                <dd className="font-medium text-slate-950">{outcome.receipt.status}</dd>
              </div>
            </dl>
          </div>
        )}

        {outcome.paidResponse && (
          <McpResponseViewer
            response={outcome.paidResponse.body}
            title="Resource Response"
            description="Data returned from the paid API call"
            redact={true}
          />
        )}
      </div>
    </div>
  );
}
```

### In Resource Inspector

```tsx
import { McpResponseViewer, McpResponsePreview } from "@/components/mcp/mcp-response-viewer";

export function ResourceInspector({ resource, inspectionResult }) {
  const [expanded, setExpanded] = useState(false);

  if (expanded) {
    return (
      <div>
        <button onClick={() => setExpanded(false)}>← Back</button>
        <McpResponseViewer
          response={inspectionResult}
          title="Full Inspection Result"
        />
      </div>
    );
  }

  return (
    <McpResponsePreview
      response={inspectionResult}
      title="Resource Inspection"
      onOpenFull={() => setExpanded(true)}
    />
  );
}
```

### In Playground

```tsx
import { McpResponseViewer } from "@/components/mcp/mcp-response-viewer";
import { redactSensitiveData } from "@/lib/export-utils";

export function PlaygroundResults({ request, response, settlement }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <McpResponseViewer
        response={request}
        title="Request"
        description="Input parameters"
        redact={true}
        additionalRedactionKeys={["apiKey"]}
      />

      <McpResponseViewer
        response={response}
        title="Response"
        description="Resource result"
        redact={false}
      />

      {settlement && (
        <McpResponseViewer
          response={settlement}
          title="Settlement"
          description="Payment settlement details"
          redact={true}
        />
      )}
    </div>
  );
}
```

## Security Considerations

### Redaction Best Practices

1. **Always enable redaction for user-facing displays**: Default to `redact={true}`
2. **Test with real data in staging**: Verify sensitive fields are actually redacted
3. **Use additional keys for domain-specific secrets**: Extend redaction list as needed
4. **Never log unredacted responses**: Use redaction utilities before logging
5. **Review copy behavior**: Ensure redaction is applied before clipboard copy

### Testnet Data Only

- Only display explicitly public testnet data
- Never display production mainnet responses
- Never display real private keys, seed phrases, or signed XDRs
- Validate that responses contain only safe testnet identifiers

### Copy Safety

- Copy operations always apply redaction
- Users see confirmation when copying (brief "Copied!" message)
- Large responses show truncation warnings
- Copy failures are logged but don't break UI

## Testing

### Unit Tests

Tests cover:
- Redaction of sensitive keys (case-insensitive, substring matching)
- Size estimation and categorization
- Validation of malformed responses
- Formatting for display and copy
- Truncation for preview

Run tests:

```bash
pnpm test src/lib/export-utils.test.ts
pnpm test src/components/mcp/mcp-response-viewer.test.tsx
```

### E2E Tests

Tests cover:
- Desktop and mobile rendering
- Redaction in UI
- Copy to clipboard
- Large response handling
- Expandable content
- Error states
- Performance with large data
- Visual regression

Run tests:

```bash
pnpm test:e2e:smoke -- mcp-response-viewer.e2e.spec.ts
```

## Accessibility

The component ensures:
- Proper heading hierarchy (`<h3>` for titles)
- Descriptive button labels ("Copy to clipboard", "Show more")
- `aria-expanded` state on expandable buttons
- `aria-hidden` for decorative icons
- Sufficient color contrast (WCAG AA)
- Touch targets ≥44px on mobile (per WCAG)
- Keyboard navigation support

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari 14+, Chrome Mobile)

The component uses standard Web APIs:
- `navigator.clipboard.writeText()` for copy
- `TextEncoder` for size calculations
- CSS Grid/Flexbox for layout

## Performance

- **Initial render**: < 100ms for responses < 1MB
- **Copy operation**: < 50ms redaction + format time
- **No page freeze**: Large responses shown with expand/collapse
- **Memory efficient**: Streaming preview for huge responses
- **Mobile friendly**: Optimized rendering on constrained devices

## Troubleshooting

### Response not displaying

1. Check `validateResponseStructure()` for errors
2. Verify response is JSON-serializable (no circular references)
3. Check browser console for error logs
4. Ensure maxSize isn't too restrictive

### Redaction not working

1. Verify key names match sensitive patterns (case-insensitive)
2. Check if key is nested in expected structure
3. Use `shouldRedactKey()` utility to test key matching
4. Add to `additionalRedactionKeys` if custom redaction needed

### Copy fails silently

1. Check `navigator.clipboard` permissions
2. Verify response isn't too large for clipboard
3. Check browser console for clipboard errors
4. Use secure context (HTTPS) for clipboard access

### Performance issues

1. Check response size with `estimateResponseSize()`
2. Use `McpResponsePreview` for initial preview
3. Increase `maxPreviewLines` if truncation too aggressive
4. Consider pagination for array responses

## Related Documentation

- [Payment Challenge Panel](../src/components/resources/payment-challenge-panel.tsx) - Uses response viewer
- [UI State](../src/services/ui-state.ts) - Provides redaction utilities
- [Export Utils](../src/lib/export-utils.ts) - Core formatting and validation
- [MCP Tools](../src/services/mcp-tools.ts) - MCP service contracts
