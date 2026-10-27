export function lineSubtotal(quantity, rateMinor) {
  const q = Math.max(0, Number(quantity) || 0);
  const r = Math.max(0, Number(rateMinor) || 0);
  return Math.round(q * r);
}

export function computeInvoiceTotals(items, opts = {}) {
  const list = Array.isArray(items) ? items : [];
  let subTotal = 0;
  for (const item of list) {
    subTotal += lineSubtotal(item.quantity, item.rate);
  }
  const discountMinor = Math.max(0, Math.min(subTotal, Number(opts.discountMinor) || 0));
  return {
    subTotal,
    taxTotal: 0,
    discountMinor,
    total: Math.max(0, subTotal - discountMinor),
  };
}
