import { Page } from "@playwright/test";

/**
 * Redaction utility for removing sensitive data from screenshots and DOM
 * before capture for release evidence. Redacts wallet addresses, private keys,
 * seed phrases, and other sensitive wallet/blockchain content.
 */

// Stellar address pattern: G followed by 55 alphanumeric characters
const STELLAR_ADDRESS_PATTERN = /G[A-Z0-9]{55}/g;

// Contract ID pattern: C followed by 55 alphanumeric characters
const CONTRACT_ADDRESS_PATTERN = /C[A-Z0-9]{55}/g;

// Seed phrase pattern: 24 or 12 words separated by spaces (approximate)
const SEED_PHRASE_PATTERN = /(?:[a-z]+\s){11}[a-z]+|(?:[a-z]+\s){23}[a-z]+/gi;

// Private key patterns (base64-like or hex strings longer than 40 chars)
const PRIVATE_KEY_PATTERN = /(?:priv(?:ate)?[\s_-]?key|secret[\s_-]?key)[:\s=]+[A-Za-z0-9+/=]{40,}/gi;

// XDR-like encoded strings (start with eyJ for base64)
const XDR_PATTERN = /eyJ[A-Za-z0-9+/=]{50,}/g;

// Transaction hash pattern (64 hex characters)
const TRANSACTION_HASH_PATTERN = /\b[a-fA-F0-9]{64}\b/g;

// List of patterns with their redaction labels
const REDACTION_RULES = [
  {
    pattern: STELLAR_ADDRESS_PATTERN,
    label: "[STELLAR_ADDRESS_REDACTED]",
    name: "Stellar Address"
  },
  {
    pattern: CONTRACT_ADDRESS_PATTERN,
    label: "[CONTRACT_ADDRESS_REDACTED]",
    name: "Contract Address"
  },
  {
    pattern: SEED_PHRASE_PATTERN,
    label: "[SEED_PHRASE_REDACTED]",
    name: "Seed Phrase"
  },
  {
    pattern: PRIVATE_KEY_PATTERN,
    label: "[PRIVATE_KEY_REDACTED]",
    name: "Private Key"
  },
  {
    pattern: XDR_PATTERN,
    label: "[XDR_DATA_REDACTED]",
    name: "XDR Encoded Data"
  }
];

/**
 * Redact sensitive data from visible text nodes and ARIA-live regions
 * This runs before screenshot capture to prevent sensitive data leakage
 */
export async function redactSensitiveDataInDOM(page: Page): Promise<void> {
  await page.evaluate(() => {
    const redactElement = (el: Element) => {
      if (el.nodeType === Node.TEXT_NODE) {
        let text = el.textContent || "";
        let modified = false;

        // Redact Stellar addresses
        if (/G[A-Z0-9]{55}/.test(text)) {
          text = text.replace(/G[A-Z0-9]{55}/g, "[STELLAR_ADDRESS_REDACTED]");
          modified = true;
        }

        // Redact contract addresses
        if (/C[A-Z0-9]{55}/.test(text)) {
          text = text.replace(/C[A-Z0-9]{55}/g, "[CONTRACT_ADDRESS_REDACTED]");
          modified = true;
        }

        // Redact seed phrases (conservative pattern)
        if (/(?:[a-z]+\s){11}[a-z]+/.test(text.toLowerCase())) {
          text = text.replace(/(?:[a-z]+\s){11}[a-z]+/gi, "[SEED_PHRASE_REDACTED]");
          modified = true;
        }

        // Redact private key-like patterns
        if (/(?:private[\s_]?key|secret[\s_]?key)[:\s=]+/i.test(text)) {
          text = text.replace(
            /(?:private[\s_]?key|secret[\s_]?key)[:\s=]+[A-Za-z0-9+/=]{40,}/gi,
            "[PRIVATE_KEY_REDACTED]"
          );
          modified = true;
        }

        if (modified && el.textContent !== text) {
          el.textContent = text;
        }
      } else {
        // Process child nodes
        let child = el.firstChild;
        while (child) {
          const next = child.nextSibling;
          if (child.nodeType === Node.TEXT_NODE) {
            redactElement(child);
          } else if (child.nodeType === Node.ELEMENT_NODE) {
            redactElement(child as Element);
          }
          child = next;
        }
      }
    };

    // Redact main document
    redactElement(document.body);

    // Redact shadow DOM if present
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_ELEMENT,
      null
    );

    let node;
    while ((node = walker.nextNode())) {
      const el = node as Element;
      if (el.shadowRoot) {
        redactElement(el.shadowRoot as unknown as Element);
      }
    }
  });
}

/**
 * Redact sensitive data from screenshot filenames and metadata
 */
export function redactFilename(filename: string): string {
  let redacted = filename;

  // Remove any embedded wallet addresses from filename
  redacted = redacted.replace(/G[A-Z0-9]{55}/g, "REDACTED");
  redacted = redacted.replace(/C[A-Z0-9]{55}/g, "REDACTED");

  // Remove any transaction hashes
  redacted = redacted.replace(/[a-fA-F0-9]{64}/g, "REDACTED");

  return redacted;
}

/**
 * Extract and redact sensitive data from artifact metadata
 */
export function redactMetadata(metadata: Record<string, string>): Record<string, string> {
  const redacted: Record<string, string> = {};

  for (const [key, value] of Object.entries(metadata)) {
    let redactedValue = value;

    // Redact sensitive keys entirely
    if (
      /secret|private|seed|key|token|credential/i.test(key)
    ) {
      redactedValue = "[REDACTED]";
    } else {
      // Redact sensitive patterns in values
      redactedValue = value
        .replace(/G[A-Z0-9]{55}/g, "[STELLAR_ADDRESS_REDACTED]")
        .replace(/C[A-Z0-9]{55}/g, "[CONTRACT_ADDRESS_REDACTED]")
        .replace(/[a-fA-F0-9]{64}/g, "[HASH_REDACTED]");
    }

    redacted[key] = redactedValue;
  }

  return redacted;
}

/**
 * Validate that sensitive patterns are not present in text
 * Useful for checking screenshots before uploading
 */
export function validateNoSensitiveData(text: string): {
  isSafe: boolean;
  detectedPatterns: string[];
} {
  const detectedPatterns: string[] = [];

  // Check for Stellar addresses
  if (/G[A-Z0-9]{55}/.test(text)) {
    detectedPatterns.push("Stellar Address");
  }

  // Check for contract addresses
  if (/C[A-Z0-9]{55}/.test(text)) {
    detectedPatterns.push("Contract Address");
  }

  // Check for seed phrase-like patterns
  if (/(?:[a-z]+\s){11}[a-z]+/i.test(text)) {
    detectedPatterns.push("Potential Seed Phrase");
  }

  // Check for private key patterns
  if (/(?:private|secret)[\s_]?key/i.test(text)) {
    detectedPatterns.push("Private Key Pattern");
  }

  // Check for long hex strings (transaction hashes)
  if (/[a-fA-F0-9]{64}/.test(text)) {
    detectedPatterns.push("Long Hex String");
  }

  return {
    isSafe: detectedPatterns.length === 0,
    detectedPatterns
  };
}
