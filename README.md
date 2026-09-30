# Energy Simulator v4

Telegram Mini App frontend.

Changes:
- Upgrader has only green success zone + gray fail zone.
- Failed upgrade leaves an empty gray result field.
- Removed Upgrader teaser from the Home page.
- Home shelf is a designer display shelf for future energy drinks.
- Starting energy is 0 (no automatic 1000 points).
- Profile now contains Deposit / Withdraw UI with CryptoBot and xRocket provider selection.
- Four bottom navigation buttons stay in one row.

## Crypto payments
The frontend intentionally does not contain provider API tokens. Real CryptoBot and xRocket deposits/withdrawals must be connected through a secure backend.

CryptoBot: Crypto Pay API supports invoices and payouts/transfers.
xRocket: xRocket Pay API supports payment/withdrawal functionality.
