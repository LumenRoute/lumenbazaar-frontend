/**
 * x402 v2 Payment Challenge Test Fixtures
 *
 * Comprehensive test data for x402 v2 challenge validation covering:
 * - Valid canonical challenges per x402 v2 spec
 * - Malformed critical fields (network, asset, amount, recipient)
 * - Invalid format cases (URLs, addresses, decimals)
 * - Extension handling and preservation
 * - Error field presence
 * - Protocol version and scheme variations
 *
 * Dependency: @x402/core@^2.0.0
 * See: https://github.com/stellar/x402-spec (v2 final)
 */

import type { PaymentRequired } from "@x402/core/types";

import type { ExactPaymentRequirements, PaymentRequiredV2 } from "@/services/api/schemas";

/**
 * Valid x402 v2 challenge with all required fields and metadata.
 * Represents a real-world payment requirement for a Soroban-based USDC token.
 */
export const validExactRequirement = {
  amount: "500000", // 0.50 USDC in atomic units (7 decimals)
  asset: "CB256KDRXDO2FYJN3YBYZE5KCU46WIIE67DRP5T7HI45DRH2GM6YOJFS", // Soroban contract ID
  extra: {
    assetCode: "USDC",
    assetIssuer: "GBUQWP3BOUZX34ULNQG23RQ6F4BFXWBXMODWQCDNYCD3MHALB5O6OVY"
  },
  maxTimeoutSeconds: 300, // 5 minute challenge window
  network: "stellar:testnet",
  payTo: "GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE",
  scheme: "exact"
} as const;

/**
 * Valid exact requirement on Stellar public network.
 */
export const validExactRequirementPubnet = {
  ...validExactRequirement,
  network: "stellar:pubnet" as const,
  payTo: "GCNY5OXYSY4FZLOWIBBCJ3GDUGDYF5WUHCYOEV23W5VH2UOKYQRXW53"
} as const;

/**
 * Valid x402 v2 challenge response with full resource metadata.
 */
export const validPaymentRequiredV2: PaymentRequiredV2 = {
  accepts: [validExactRequirement],
  resource: {
    description: "Current weather conditions in Lagos",
    iconUrl: "https://api.weather.example/icon.png",
    mimeType: "application/json",
    serviceName: "Weather API",
    tags: ["weather", "real-time", "africa"],
    url: "https://api.weather.example/v1/current?city=Lagos"
  },
  x402Version: 2
};

/**
 * Valid challenge with optional error field explaining why payment is required.
 */
export const validPaymentRequiredV2WithError: PaymentRequiredV2 = {
  accepts: [validExactRequirement],
  error: "Premium API tier requires payment. Free tier limit exceeded.",
  resource: {
    description: "Current weather conditions in Lagos",
    url: "https://api.weather.example/v1/current?city=Lagos"
  },
  x402Version: 2
};

/**
 * Valid challenge with extensions record.
 * Extensions are preserved without validation and allow protocol evolution.
 */
export const validPaymentRequiredV2WithExtensions: PaymentRequiredV2 = {
  accepts: [validExactRequirement],
  extensions: {
    "x-rate-limit-after-payment": "10000",
    "x-subscription-tiers": ["free", "pro", "enterprise"]
  },
  resource: {
    description: "Current weather conditions in Lagos",
    url: "https://api.weather.example/v1/current?city=Lagos"
  },
  x402Version: 2
};

/**
 * Valid challenge with multiple payment schemes (exact + upto).
 * Client should filter to exact and ignore upto.
 */
export const validPaymentRequiredV2WithMultipleSchemes: PaymentRequired = {
  accepts: [
    validExactRequirement,
    {
      amount: "500000",
      asset: "CB256KDRXDO2FYJN3YBYZE5KCU46WIIE67DRP5T7HI45DRH2GM6YOJFS",
      maxTimeoutSeconds: 300,
      network: "stellar:testnet",
      payTo: "GBZXN7PIRZGNMHGAIQW7QEJWW36L5CVVNRYANMDW2G3QOF2VCR4DQSQE",
      scheme: "upto"
    }
  ] as never[],
  resource: {
    url: "https://api.weather.example/v1/current?city=Lagos"
  },
  x402Version: 2
} as never;

/**
 * Valid challenge with multiple networks offered.
 * Client should select based on their configuration.
 */
export const validPaymentRequiredV2MultiNetwork: PaymentRequired = {
  accepts: [
    validExactRequirement,
    {
      ...validExactRequirement,
      network: "stellar:pubnet",
      payTo: "GCNY5OXYSY4FZLOWIBBCJ3GDUGDYF5WUHCYOEV23W5VH2UOKYQRXW53"
    }
  ] as never[],
  resource: {
    url: "https://api.weather.example/v1/current?city=Lagos"
  },
  x402Version: 2
} as never;

/**
 * INVALID: Amount field contains decimals (should be atomic units only).
 * Validation must reject: regex /^[1-9]\d*$/ should fail.
 */
export const invalidAmountWithDecimals = {
  ...validExactRequirement,
  amount: "0.5" // Decimal not allowed; must be atomic integer
} as const;

/**
 * INVALID: Amount field is "0" (must be positive).
 * Validation must reject: regex /^[1-9]\d*$/ excludes leading zero.
 */
export const invalidAmountZero = {
  ...validExactRequirement,
  amount: "0"
} as const;

/**
 * INVALID: Amount field with leading zeros.
 * Validation must reject: regex /^[1-9]\d*$/ excludes leading zeros.
 */
export const invalidAmountLeadingZeros = {
  ...validExactRequirement,
  amount: "000500000"
} as const;

/**
 * INVALID: Amount field is negative.
 * Validation must reject: regex /^[1-9]\d*$/ excludes minus sign.
 */
export const invalidAmountNegative = {
  ...validExactRequirement,
  amount: "-500000"
} as const;

/**
 * INVALID: Amount field with non-numeric characters.
 * Validation must reject: regex /^[1-9]\d*$/ excludes non-digits.
 */
export const invalidAmountNonNumeric = {
  ...validExactRequirement,
  amount: "500000abc"
} as const;

/**
 * INVALID: Network field has unsupported value.
 * Only "stellar:testnet" and "stellar:pubnet" are valid.
 */
export const invalidNetworkUnsupported = {
  ...validExactRequirement,
  network: "ethereum:mainnet" as never
} as const;

/**
 * INVALID: Network field is malformed.
 */
export const invalidNetworkMalformed = {
  ...validExactRequirement,
  network: "stellar" as never
} as const;

/**
 * INVALID: Asset (contract ID) is empty string.
 */
export const invalidAssetEmpty = {
  ...validExactRequirement,
  asset: ""
} as const;

/**
 * INVALID: Asset (contract ID) is not a valid Stellar contract address format.
 * Valid format: Base32 encoding starting with 'C' (Soroban contract).
 */
export const invalidAssetFormat = {
  ...validExactRequirement,
  asset: "not-a-valid-contract-id"
} as const;

/**
 * INVALID: Asset is a classic Stellar issuer address (starts with G).
 * Soroban contracts must start with 'C'.
 */
export const invalidAssetClassicAddress = {
  ...validExactRequirement,
  asset: "GBUQWP3BOUZX34ULNQG23RQ6F4BFXWBXMODWQCDNYCD3MHALB5O6OVY"
} as const;

/**
 * INVALID: Recipient (payTo) is empty.
 */
export const invalidRecipientEmpty = {
  ...validExactRequirement,
  payTo: ""
} as const;

/**
 * INVALID: Recipient (payTo) is not a valid Stellar address format.
 * Valid format: Base32 encoding starting with 'G' (classic) or 'M' (Muxed).
 */
export const invalidRecipientFormat = {
  ...validExactRequirement,
  payTo: "not-a-valid-address"
} as const;

/**
 * INVALID: Recipient (payTo) is a contract address (starts with C).
 * Recipients must be classic or muxed addresses (G or M).
 */
export const invalidRecipientContractAddress = {
  ...validExactRequirement,
  payTo: "CB256KDRXDO2FYJN3YBYZE5KCU46WIIE67DRP5T7HI45DRH2GM6YOJFS"
} as const;

/**
 * INVALID: Recipient is a classic Stellar address but starts with wrong letter.
 * Used for comprehensive format validation.
 */
export const invalidRecipientClassicAddress = invalidRecipientContractAddress;

/**
 * INVALID: Timeout is zero.
 * Must be a positive integer.
 */
export const invalidTimeoutZero = {
  ...validExactRequirement,
  maxTimeoutSeconds: 0
} as const;

/**
 * INVALID: Timeout is negative.
 * Must be a positive integer.
 */
export const invalidTimeoutNegative = {
  ...validExactRequirement,
  maxTimeoutSeconds: -300
} as const;

/**
 * INVALID: Timeout is not an integer.
 * Must be an integer (no fractional seconds).
 */
export const invalidTimeoutFloat = {
  ...validExactRequirement,
  maxTimeoutSeconds: 300.5
} as const;

/**
 * INVALID: Scheme is not "exact".
 * v2 "exact" scheme validation excludes other schemes during challenge parsing.
 */
export const invalidSchemeUpto = {
  ...validExactRequirement,
  scheme: "upto" as never
} as const;

/**
 * INVALID: Full challenge with unsupported x402 version.
 */
export const invalidX402VersionV1: PaymentRequired = {
  accepts: [validExactRequirement],
  resource: { url: "https://api.weather.example/v1/current?city=Lagos" },
  x402Version: 1 as never
} as never;

/**
 * INVALID: Full challenge with no valid exact schemes.
 * Only "upto" scheme offered.
 */
export const invalidNoExactScheme: PaymentRequired = {
  accepts: [
    {
      ...validExactRequirement,
      scheme: "upto" as never
    }
  ] as never[],
  resource: { url: "https://api.weather.example/v1/current?city=Lagos" },
  x402Version: 2
} as never;

/**
 * INVALID: Full challenge with empty accepts array.
 * Must have at least one requirement.
 */
export const invalidEmptyAccepts: PaymentRequired = {
  accepts: [],
  resource: { url: "https://api.weather.example/v1/current?city=Lagos" },
  x402Version: 2
} as never;

/**
 * INVALID: Resource URL is malformed.
 */
export const invalidResourceUrlMalformed: PaymentRequiredV2 = {
  accepts: [validExactRequirement],
  resource: {
    url: "not-a-valid-url"
  },
  x402Version: 2
};

/**
 * INVALID: Resource URL is relative (must be absolute).
 */
export const invalidResourceUrlRelative: PaymentRequiredV2 = {
  accepts: [validExactRequirement],
  resource: {
    url: "/v1/current?city=Lagos"
  },
  x402Version: 2
};

/**
 * Valid fixture for testing extension preservation.
 * Unknown extensions must be preserved in parsed challenges.
 */
export const validExtensionPreservationTest: PaymentRequiredV2 = {
  accepts: [validExactRequirement],
  extensions: {
    "x-custom-v1": "value1",
    "x-custom-v2": { nested: "object" },
    "x-future-feature": ["array", "of", "values"]
  },
  resource: {
    url: "https://api.weather.example/v1/current?city=Lagos"
  },
  x402Version: 2
};

/**
 * Valid fixture testing that extra fields are normalized to empty object.
 * Extra fields in requirements should be preserved without validation.
 */
export const validExtraFieldPreservation: ExactPaymentRequirements = {
  ...validExactRequirement,
  extra: {
    assetCode: "USDC",
    assetIssuer: "GBUQWP3BOUZX34ULNQG23RQ6F4BFXWBXMODWQCDNYCD3MHALB5O6OVY",
    "x-custom-metadata": "preserved",
    "x-future-feature": { nested: true }
  }
};

/**
 * Edge case: Minimum valid timeout (1 second).
 */
export const validMinimumTimeout = {
  ...validExactRequirement,
  maxTimeoutSeconds: 1
} as const;

/**
 * Edge case: Very large timeout (1 week in seconds).
 */
export const validLargeTimeout = {
  ...validExactRequirement,
  maxTimeoutSeconds: 604_800
} as const;

/**
 * Edge case: Minimum valid amount (1 atomic unit).
 */
export const validMinimumAmount = {
  ...validExactRequirement,
  amount: "1"
} as const;

/**
 * Edge case: Maximum reasonable amount (1 trillion atomic units = 10 million with 7 decimals).
 */
export const validLargeAmount = {
  ...validExactRequirement,
  amount: "10000000000000"
} as const;

/**
 * Summary of test coverage:
 *
 * VALID FIXTURES (10):
 * - validExactRequirement: Standard v2 exact requirement
 * - validExactRequirementPubnet: Pubnet variant
 * - validPaymentRequiredV2: Full challenge with metadata
 * - validPaymentRequiredV2WithError: With optional error field
 * - validPaymentRequiredV2WithExtensions: With extensions record
 * - validPaymentRequiredV2WithMultipleSchemes: Multiple schemes (exact + upto)
 * - validPaymentRequiredV2MultiNetwork: Multiple networks
 * - validExtensionPreservationTest: Extension preservation
 * - validExtraFieldPreservation: Extra field preservation
 * - validEdgeCases: Timeout/amount edge cases
 *
 * INVALID AMOUNT FIELD (6):
 * - invalidAmountWithDecimals: Decimal not allowed
 * - invalidAmountZero: Zero not positive
 * - invalidAmountLeadingZeros: Leading zeros
 * - invalidAmountNegative: Negative value
 * - invalidAmountNonNumeric: Non-digits
 *
 * INVALID NETWORK FIELD (2):
 * - invalidNetworkUnsupported: Unsupported blockchain
 * - invalidNetworkMalformed: Malformed value
 *
 * INVALID ASSET FIELD (3):
 * - invalidAssetEmpty: Empty string
 * - invalidAssetFormat: Invalid format
 * - invalidAssetClassicAddress: Classic instead of Soroban
 *
 * INVALID RECIPIENT FIELD (3):
 * - invalidRecipientEmpty: Empty string
 * - invalidRecipientFormat: Invalid format
 * - invalidRecipientContractAddress: Contract instead of account
 *
 * INVALID TIMEOUT FIELD (3):
 * - invalidTimeoutZero: Zero not positive
 * - invalidTimeoutNegative: Negative
 * - invalidTimeoutFloat: Float not integer
 *
 * INVALID SCHEME FIELD (1):
 * - invalidSchemeUpto: Not "exact"
 *
 * INVALID FULL CHALLENGES (3):
 * - invalidX402VersionV1: Wrong protocol version
 * - invalidNoExactScheme: No exact scheme offered
 * - invalidEmptyAccepts: Empty requirements array
 *
 * INVALID RESOURCE FIELDS (2):
 * - invalidResourceUrlMalformed: Invalid URL syntax
 * - invalidResourceUrlRelative: Relative URL
 *
 * EDGE CASES (4):
 * - validMinimumTimeout: 1 second
 * - validLargeTimeout: 1 week
 * - validMinimumAmount: 1 atomic unit
 * - validLargeAmount: 1 trillion atomic units
 *
 * Total: 39 fixtures covering v2 strict validation requirements
 */

export const allValidFixtures = [
  validExactRequirement,
  validExactRequirementPubnet,
  validPaymentRequiredV2,
  validPaymentRequiredV2WithError,
  validPaymentRequiredV2WithExtensions,
  validExtensionPreservationTest,
  validExtraFieldPreservation,
  validMinimumTimeout,
  validLargeTimeout,
  validMinimumAmount,
  validLargeAmount
];

export const allInvalidFixtures = [
  invalidAmountWithDecimals,
  invalidAmountZero,
  invalidAmountLeadingZeros,
  invalidAmountNegative,
  invalidAmountNonNumeric,
  invalidNetworkUnsupported,
  invalidNetworkMalformed,
  invalidAssetEmpty,
  invalidAssetFormat,
  invalidAssetClassicAddress,
  invalidRecipientEmpty,
  invalidRecipientFormat,
  invalidRecipientContractAddress,
  invalidTimeoutZero,
  invalidTimeoutNegative,
  invalidTimeoutFloat,
  invalidSchemeUpto,
  invalidX402VersionV1,
  invalidNoExactScheme,
  invalidEmptyAccepts,
  invalidResourceUrlMalformed,
  invalidResourceUrlRelative
];
