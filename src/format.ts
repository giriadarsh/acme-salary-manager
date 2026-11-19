const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
const amountFormatters = new Map<string, Intl.NumberFormat>();

export function countryName(code: string) {
  return regionNames.of(code) ?? code;
}

export function money(amountMinor: number, currency: string) {
  let formatter = amountFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en', { style: 'currency', currency, currencyDisplay: 'narrowSymbol' });
    amountFormatters.set(currency, formatter);
  }
  return formatter.format(amountMinor / 100);
}

export function employeeInitials(name: string) {
  return name.split(' ').slice(0, 2).map(part => part[0]).join('');
}
