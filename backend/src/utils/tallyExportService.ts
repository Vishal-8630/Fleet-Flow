/**
 * ============================================================================
 * TALLY EXPORT SERVICE (tallyExportService.ts)
 * ============================================================================
 * Generates standard Tally Prime XML vouchers for direct import into TallyPrime.
 * Supports Sales Vouchers (freight revenue), Receipt Vouchers (bank payments),
 * and Payment Vouchers (driver settlements and vendor payouts).
 * ============================================================================
 */

/**
 * Escapes special XML characters.
 */
function xmlEscape(str: string | number): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Formats a date for Tally XML: YYYYMMDD
 */
function tallyDate(date: Date): string {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

/**
 * Formats paise amount to rupees with 2 decimal places for Tally
 */
function paiseToRupees(paise: number): string {
  return (paise / 100).toFixed(2);
}

export interface TallyInvoiceData {
  invoice_no: string;
  date: Date;
  party_name: string;
  party_ledger: string;
  freight_amount_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  igst_paise: number;
  total_paise: number;
  narration?: string;
}

export interface TallyReceiptData {
  receipt_no: string;
  date: Date;
  party_name: string;
  party_ledger: string;
  amount_paise: number;
  bank_ledger: string;
  narration?: string;
}

export interface TallyPaymentData {
  payment_ref: string;
  date: Date;
  payee_name: string;
  payee_ledger: string;
  amount_paise: number;
  bank_ledger: string;
  narration?: string;
}

/**
 * Generates a Tally XML Sales Voucher for a freight invoice.
 */
export function generateSalesVoucher(invoice: TallyInvoiceData): string {
  const freightRupees = paiseToRupees(invoice.freight_amount_paise);
  const cgstRupees = paiseToRupees(invoice.cgst_paise);
  const sgstRupees = paiseToRupees(invoice.sgst_paise);
  const igstRupees = paiseToRupees(invoice.igst_paise);
  const totalRupees = paiseToRupees(invoice.total_paise);
  const dateStr = tallyDate(invoice.date);

  let gstEntries = '';
  if (invoice.cgst_paise > 0) {
    gstEntries += `
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>CGST</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>-${cgstRupees}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>SGST</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>-${sgstRupees}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>`;
  }
  if (invoice.igst_paise > 0) {
    gstEntries += `
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>IGST</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>-${igstRupees}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>`;
  }

  return `
      <VOUCHER VCHTYPE="Sales" ACTION="Create">
        <DATE>${dateStr}</DATE>
        <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
        <VOUCHERNUMBER>${xmlEscape(invoice.invoice_no)}</VOUCHERNUMBER>
        <PARTYLEDGERNAME>${xmlEscape(invoice.party_name)}</PARTYLEDGERNAME>
        <NARRATION>${xmlEscape(invoice.narration || `Freight Invoice ${invoice.invoice_no}`)}</NARRATION>
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${xmlEscape(invoice.party_ledger)}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
          <AMOUNT>${totalRupees}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>Freight Income</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>-${freightRupees}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>
        ${gstEntries}
      </VOUCHER>`;
}

/**
 * Generates a Tally XML Receipt Voucher for a customer payment received.
 */
export function generateReceiptVoucher(receipt: TallyReceiptData): string {
  return `
      <VOUCHER VCHTYPE="Receipt" ACTION="Create">
        <DATE>${tallyDate(receipt.date)}</DATE>
        <VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>
        <VOUCHERNUMBER>${xmlEscape(receipt.receipt_no)}</VOUCHERNUMBER>
        <PARTYLEDGERNAME>${xmlEscape(receipt.party_name)}</PARTYLEDGERNAME>
        <NARRATION>${xmlEscape(receipt.narration || `Receipt from ${receipt.party_name}`)}</NARRATION>
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${xmlEscape(receipt.bank_ledger)}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
          <AMOUNT>${paiseToRupees(receipt.amount_paise)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${xmlEscape(receipt.party_ledger)}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>-${paiseToRupees(receipt.amount_paise)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>
      </VOUCHER>`;
}

/**
 * Generates a Tally XML Payment Voucher for driver settlements / vendor payouts.
 */
export function generatePaymentVoucher(payment: TallyPaymentData): string {
  return `
      <VOUCHER VCHTYPE="Payment" ACTION="Create">
        <DATE>${tallyDate(payment.date)}</DATE>
        <VOUCHERTYPENAME>Payment</VOUCHERTYPENAME>
        <VOUCHERNUMBER>${xmlEscape(payment.payment_ref)}</VOUCHERNUMBER>
        <PARTYLEDGERNAME>${xmlEscape(payment.payee_name)}</PARTYLEDGERNAME>
        <NARRATION>${xmlEscape(payment.narration || `Payment to ${payment.payee_name}`)}</NARRATION>
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${xmlEscape(payment.payee_ledger)}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
          <AMOUNT>${paiseToRupees(payment.amount_paise)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>
        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${xmlEscape(payment.bank_ledger)}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>-${paiseToRupees(payment.amount_paise)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>
      </VOUCHER>`;
}

/**
 * Wraps multiple voucher XML strings in a complete Tally XML envelope.
 */
export function wrapInTallyEnvelope(vouchersXml: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>$$SysName:Company</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          ${vouchersXml.join('\n          ')}
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}
