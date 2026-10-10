export function stockDisplayCount(stock, capacity, slots = 6) {
  if (typeof slots !== 'number' || !Number.isFinite(slots)) return 0;
  slots = Math.floor(slots);
  if (slots < 0) return 0;
  if (typeof stock !== 'number' || !Number.isFinite(stock)) return 0;
  stock = Math.floor(stock);
  if (stock <= 0) return 0;
  if (typeof capacity === 'number' && Number.isFinite(capacity) && capacity > 0)
    return Math.ceil(Math.min(Math.max(stock / capacity, 0), 1) * slots);
  return Math.min(1, slots);
}

export function setStockVisibility(groups, stock, capacity) {
  const count = stockDisplayCount(stock, capacity, groups.length);
  groups.forEach((g, i) => { g.visible = i < count; });
  return count;
}

export function ingredientDisplay({ milkStock, milkDelivery, houseStock, batchUnits, batchCapacity = 40, batchReserved = false } = {}) {
  const milk = stockDisplayCount(milkStock, milkDelivery, 2);
  let beans = 0;
  if (typeof houseStock === 'number' && Number.isFinite(houseStock) && Math.floor(houseStock) > 0)
    beans = Math.floor(houseStock) >= 150 ? 2 : 1;
  const batch = stockDisplayCount(batchUnits, batchCapacity, 3);
  const reserved = !!batchReserved && batch > 0;
  return { milk, beans, batch, reserved };
}
