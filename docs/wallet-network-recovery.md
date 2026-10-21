# Wrong-network wallet recovery

A wallet can be connected to a Stellar network that is not the network the payment requires. The
frontend detects that condition, blocks signing, and offers a recovery path that names both
networks.

## Networks

The frontend supports two network ids, configured in `src/config/networks.ts`:

| Network id        | Label                  | Enabled for payments |
| ----------------- | ---------------------- | -------------------- |
| `stellar:testnet` | Stellar Testnet        | Yes                  |
| `stellar:pubnet`  | Stellar Public Network | No                   |

Wallets report their active network as a **network passphrase**, not as a network id.
`resolveNetworkId()` translates the passphrase into a configured network id and returns `undefined`
for every passphrase the frontend does not know. `networkLabel()` renders the id as a label and
renders an unknown network as `Unknown network` rather than as one of the supported networks.

## Connection states

`src/services/wallets.ts` reports the wallet state through `WalletConnectionState.status`:

| Status            | Meaning                                                     | Signing |
| ----------------- | ----------------------------------------------------------- | ------- |
| `disconnected`    | No wallet connected                                         | Blocked |
| `connecting`      | Connection in progress                                      | Blocked |
| `connected`       | Wallet is on the expected network                           | Allowed |
| `mismatch`        | Wallet is on a different, known network                     | Blocked |
| `network_unknown` | Wallet did not report a network, or reported an unknown one | Blocked |
| `unavailable`     | Wallet extension missing or not authorized                  | Blocked |
| `error`           | Wallet reported an error                                    | Blocked |

`network_unknown` fails closed on purpose. A wallet that does not report a network cannot be
confirmed to be on the expected one, so it is treated the same way as a mismatch.

## Signing is blocked on a mismatch

`src/services/x402/authorization.ts` compares the wallet network against the network of the
payment challenge, not against a hardcoded constant:

1. The challenge network must be a network the frontend supports for payments. Any other network is
   rejected with `WALLET_NETWORK_MISMATCH`.
2. The connected wallet must report the payment network. A mismatch or an unverifiable network is
   rejected with `WALLET_NETWORK_MISMATCH` before any signing request is opened.
3. The wallet network is read again at the signature prompt. A network that changed between
   connecting and signing is rejected with `WALLET_NETWORK_MISMATCH`.

The error message names the network the wallet is on and the network the payment requires, so the
recovery panel and the payment error agree on the reason.

## Recovery actions

The header wallet status (`src/components/wallet/wallet-status.tsx`) renders
`WalletNetworkRecovery` whenever the wallet is not on the expected network. The panel always shows
the expected network and the current network, and offers two keyboard reachable actions:

| Action                | Service call          | Result                                                                              |
| --------------------- | --------------------- | ----------------------------------------------------------------------------------- |
| `Switch to <network>` | `switchWalletNetwork` | Requests a switch, then verifies it by reading the wallet network again             |
| `Re-check network`    | `reconnectWallet`     | Reads the connected account and network again without asking for a new access grant |

`switchWalletNetwork` only reports `switched` after the wallet reports the expected network. Every
other outcome is reported honestly:

| Outcome               | Meaning                                                                   |
| --------------------- | ------------------------------------------------------------------------- |
| `switched`            | The wallet reports the expected network after the request                 |
| `already_on_expected` | The wallet was already on the expected network                            |
| `rejected`            | The wallet refused the switch request                                     |
| `manual_required`     | The wallet cannot change networks from the page; switch inside the wallet |
| `not_switched`        | The switch request completed but the wallet reports another network       |
| `unavailable`         | The wallet network could not be read, so nothing could be verified        |

The Freighter API does not expose a way to change the network of the extension, so
`switchWalletNetwork` reports `manual_required` for it and the panel lists the steps to take inside
the wallet, ending with `Re-check network`. The frontend never changes the network of a wallet on
its own, and it never reports a switch that it could not verify.

## Accessibility

- Both recovery actions are native buttons, so they are reachable with `Tab` and activate with
  `Enter` or `Space`.
- The panel is a labelled `group`, and the result of a recovery action is announced through a
  `status` live region.
- The expected and the current network are rendered as a description list, so they are exposed as
  terms and definitions rather than as loose text.

## Coverage

- `src/config/networks.test.ts` covers passphrase resolution, unknown passphrases, and network
  labels.
- `src/services/wallets.test.ts` covers the connection states, the reconnect result, and every
  switch outcome including a refused switch and a switch that did not happen.
- `src/components/wallet/wallet-network-recovery.test.tsx` covers the rendered networks, the
  keyboard reachable actions, the live region, and the manual switch steps.
- `src/components/wallet/wallet-status.test.tsx` covers the recovery flow end to end from the
  connect action.
- `src/services/x402/authorization.test.ts` covers the blocked signing paths for a mismatched and
  for an unverifiable wallet network.
