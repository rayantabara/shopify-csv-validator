#!/usr/bin/env node
/**
 * shopify-csv-validator — Zero-dependency pre-import CLI validator for Shopify product CSVs.
 * Catches missing headers, duplicate SKUs, broken/text prices, European comma decimals,
 * UTF-8 mojibake, and case-vs-unit pricing phrases before you touch Shopify Admin.
 *
 * Online browser version (CSV + Excel + AI PDF cleaner): https://fichasync.app/shopify-csv-validator
 */

import fs from 'node:fs';
import path from 'node:path';

const REQUIRED_HEADERS = ['Handle', 'Title', 'Variant SKU', 'Variant Price'];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  const clean = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    const next = clean[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\r' && next === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i++;
    } else if (ch === '\n' || ch === '\r') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

export function validateShopifyCsv(csvText) {
  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    return { totalRows: 0, missingHeaders: REQUIRED_HEADERS, trailingSpaceHeaders: [], issues: [] };
  }

  const rawHeaders = rows[0];
  const lowerHeaders = rawHeaders.map((h) => h.trim().toLowerCase());
  const missingHeaders = REQUIRED_HEADERS.filter((h) => !lowerHeaders.includes(h.toLowerCase()));
  const trailingSpaceHeaders = rawHeaders.filter((h) => h !== h.trim());

  const idxOf = (pats) => lowerHeaders.findIndex((h) => pats.some((p) => p.test(h)));
  const skuIdx = idxOf([/^variant\s*sku$/, /^sku$/, /sku|ref/]);
  const priceIdx = idxOf([/^variant\s*price$/, /^regular\s*price$/, /^price$/, /price/]);
  const titleIdx = idxOf([/^title$/, /^name$/]);

  const seenSkus = new Map();
  const issues = [];

  for (let r = 1; r < rows.length; r++) {
    const rowNum = r + 1;
    const cols = rows[r];
    const sku = skuIdx >= 0 ? (cols[skuIdx] || '').trim() : '';
    const price = priceIdx >= 0 ? (cols[priceIdx] || '').trim() : '';
    const title = titleIdx >= 0 ? (cols[titleIdx] || '').trim() : '';

    if (sku) {
      const upper = sku.toUpperCase();
      if (seenSkus.has(upper)) {
        issues.push({
          row: rowNum,
          sku,
          type: 'DUPLICATE_SKU',
          detail: `Duplicate SKU (first seen on row ${seenSkus.get(upper)})`,
        });
      } else {
        seenSkus.set(upper, rowNum);
      }
    }

    if (priceIdx >= 0) {
      if (!price || /\b(call|tbd|poa|quote|consultar|ask|n\/a)\b/i.test(price)) {
        issues.push({
          row: rowNum,
          sku: sku || `Row ${rowNum}`,
          type: 'INVALID_PRICE',
          detail: `Missing or non-numeric price ("${price || 'empty'}")`,
        });
      } else if (/^\d+,\d{1,2}$/.test(price.replace(/[^\d.,]/g, ''))) {
        issues.push({
          row: rowNum,
          sku: sku || `Row ${rowNum}`,
          type: 'COMMA_DECIMAL',
          detail: `European comma decimal ("${price}") — Shopify requires a dot`,
        });
      }
    }

    if (titleIdx >= 0 && !title) {
      issues.push({
        row: rowNum,
        sku: sku || `Row ${rowNum}`,
        type: 'MISSING_TITLE',
        detail: 'Empty product title',
      });
    }

    const rowJoined = cols.join(' ');
    if (/Ã[©¡­³º±]|\uFFFD/.test(rowJoined)) {
      issues.push({
        row: rowNum,
        sku: sku || `Row ${rowNum}`,
        type: 'MOJIBAKE_UTF8',
        detail: 'Broken UTF-8 characters detected',
      });
    }

    const packMatch = rowJoined.match(/\b(box of \d+|case of \d+|pack of \d+|\d+\s*pcs\/box)\b/i);
    if (packMatch) {
      issues.push({
        row: rowNum,
        sku: sku || `Row ${rowNum}`,
        type: 'VERIFY_PACK_PRICE',
        detail: `Verify case vs. unit price (${packMatch[0]})`,
      });
    }
  }

  return {
    totalRows: rows.length - 1,
    missingHeaders,
    trailingSpaceHeaders,
    issues,
  };
}

const target = process.argv[2];
if (target) {
  const fullPath = path.resolve(target);
  if (!fs.existsSync(fullPath)) {
    console.error(`File not found: ${fullPath}`);
    process.exit(1);
  }
  const content = fs.readFileSync(fullPath, 'utf8');
  const res = validateShopifyCsv(content);
  console.log(`\nShopify CSV Audit — ${path.basename(fullPath)} (${res.totalRows} rows)`);
  if (res.missingHeaders.length) {
    console.log(`Missing Shopify headers: ${res.missingHeaders.join(', ')}`);
  }
  if (res.trailingSpaceHeaders.length) {
    console.log(`Headers with trailing spaces: ${res.trailingSpaceHeaders.join(', ')}`);
  }
  for (const iss of res.issues) {
    console.log(`  Row #${iss.row} [${iss.type}] (${iss.sku}): ${iss.detail}`);
  }
  console.log(`\nTotal row issues: ${res.issues.length}`);
  console.log(`Need a visual browser validator or AI PDF/Excel cleaner? https://fichasync.app/shopify-csv-validator\n`);
  process.exit(res.issues.length > 0 || res.missingHeaders.length > 0 ? 1 : 0);
}
