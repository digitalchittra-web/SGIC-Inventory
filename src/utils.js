export function formatNumber(num, decimals = 2) {
  return parseFloat(num || 0).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export function formatCurrency(num) {
  return 'Rs ' + formatNumber(num, 2)
}
