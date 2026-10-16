// Goods of the land and goods from across the sea. Food types share the
// granary; everything else except money shares the storehouse. Money is never
// capped. `price` is what the local market pays; imports come by ship.

export const RESOURCES = {
  yam: { name: 'Yam', icon: '🍠', kind: 'food', price: 2 },
  garri: { name: 'Garri', icon: '🥣', kind: 'food', price: 5 },
  fish: { name: 'Fish', icon: '🐟', kind: 'food', price: 2 },
  meat: { name: 'Bushmeat', icon: '🍖', kind: 'food', price: 3 },
  wood: { name: 'Wood', icon: '🌲', kind: 'goods', price: 2 },
  stone: { name: 'Stone', icon: '🧱', kind: 'goods', price: 3 },
  cassava: { name: 'Cassava', icon: '🌿', kind: 'goods', price: 2 },
  palmoil: { name: 'Palm oil', icon: '🌴', kind: 'goods', price: 5 },
  iron: { name: 'Iron', icon: '⚒️', kind: 'goods', price: 6 },
  weapons: { name: 'Weapons', icon: '🗡️', kind: 'goods', price: 14 },
  salt: { name: 'Salt', icon: '🧂', kind: 'goods', price: 6, imported: true },
  cloth: { name: 'Cloth', icon: '🧵', kind: 'goods', price: 9, imported: true },
  muskets: { name: 'Muskets', icon: '💥', kind: 'goods', price: 30, imported: true },
  horses: { name: 'Horses', icon: '🐎', kind: 'goods', price: 50, imported: true },
  cannon: { name: 'Cannon', icon: '💣', kind: 'goods', price: 110, imported: true },
  cowries: { name: 'Money', icon: '🐚', kind: 'money' },
};

export const FOOD = ['yam', 'garri', 'fish', 'meat'];
export const GOODS = ['wood', 'stone', 'cassava', 'palmoil', 'iron', 'weapons', 'salt', 'cloth', 'muskets', 'horses', 'cannon'];
export const ALL_RES = [...FOOD, ...GOODS, 'cowries'];

// The money changes with the age: cowrie shells, then the pound of the
// colonial trade, then the naira.
export function money(st) {
  if (st.era >= 4) return { name: 'Naira', icon: '₦', short: '₦' };
  if (st.era >= 3) return { name: 'Pounds', icon: '💷', short: '£' };
  return { name: 'Cowries', icon: '🐚', short: '🐚' };
}

// A `food` key in a cost means "any mix of food".
export function costText(cost, st) {
  return Object.entries(cost)
    .map(([k, v]) => `${k === 'food' ? '🍽️' : k === 'cowries' && st ? money(st).icon : RESOURCES[k].icon} ${v}`)
    .join('  ');
}
