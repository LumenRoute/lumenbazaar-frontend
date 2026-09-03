# Security Policy

LumenBazaar is non-custodial. The frontend must never collect, store, log, or transmit private keys.

## Reporting

Please report suspected vulnerabilities through GitHub security advisories or by opening a private
maintainer contact channel. Do not disclose exploitable details publicly before maintainers have had
time to investigate.

## Frontend Rules

- Do not store payment payloads containing sensitive wallet data in logs.
- Show machine-readable errors clearly.
- Keep mainnet controls explicit and feature-flagged.
- Treat domain verification and resource metadata as untrusted until verified by the backend.
