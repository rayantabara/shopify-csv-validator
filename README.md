# shopify-csv-validator

Zero-dependency Node.js CLI validator to catch broken Shopify product CSVs **before** they silently overwrite products or fail mid-import.

> **Prefer a zero-install browser UI?** Use the free unlimited web validator (up to 25,000 rows, 100% client-side) or convert messy supplier **Excel & PDF price lists** at **[FichaSync Shopify CSV Validator](https://fichasync.app/shopify-csv-validator)**.

## What It Catches

- **Missing required Shopify headers** (`Handle`, `Title`, `Variant SKU`, `Variant Price`) and trailing-space header typos
- **Duplicate SKUs** that cause silent overwrites in Shopify Admin
- **Missing or text prices** (`TBD`, `Call for price`, `POA`, `Consultar`)
- **European comma decimals** (`18,50` instead of `18.50`)
- **Broken UTF-8 / mojibake characters** from Excel exports
- **Case vs. unit pricing phrases** (`box of 12`, `100pcs/box`)

## Quick Usage

```bash
git clone https://github.com/rayantabara/shopify-csv-validator.git
cd shopify-csv-validator
node index.mjs sample-broken.csv
```

Example output:

```text
Shopify CSV Audit — sample-broken.csv (4 rows)
  Row #3 [INVALID_PRICE] (VAL-302): Missing or non-numeric price ("TBD")
  Row #4 [DUPLICATE_SKU] (VAL-301): Duplicate SKU (first seen on row 2)
  Row #4 [COMMA_DECIMAL] (VAL-301): European comma decimal ("18,50") — Shopify requires a dot
  Row #4 [VERIFY_PACK_PRICE] (VAL-301): Verify case vs. unit price (box of 12)
  Row #5 [MISSING_TITLE] (VAL-304): Empty product title

Total row issues: 5
```

Exits with status code `1` when issues are found (CI-friendly).

## Need to Clean Messy Supplier PDFs or Multi-Tab Excels?

If your vendor only sent a 40-page PDF price list or an unformatted `.xlsx` file, **[FichaSync](https://fichasync.app)** normalizes raw supplier catalogs into clean **Shopify, WooCommerce, and PrestaShop CSVs** in ~2 minutes with:
- Deterministic **Strict OEM SKU Lock** (never hallucinates part numbers or prices)
- **Inline Pre-CSV Audit** & 1-click fixes
- **Ephemeral Supplier Diff** (compare new vs. previous price list in RAM)
- **GDPR Ephemeral RAM** processing (zero server storage)

## License

MIT
