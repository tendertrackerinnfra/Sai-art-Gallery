const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const quantityFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 3,
});

export function formatCurrency(value: number | string) {
  return currencyFormatter.format(Number(value));
}

export function formatDate(value: Date | string) {
  const dateValue = value instanceof Date ? value : new Date(value);
  return dateFormatter.format(dateValue);
}

export function formatQuantity(value: number | string) {
  return quantityFormatter.format(Number(value));
}
