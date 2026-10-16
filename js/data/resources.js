// Goods of the land. Food types share the granary; everything else except
// cowries shares the storehouse. Cowries are money and are never capped.

export const RESOURCES = {
  yam: { name: 'Yam', icon: '🍠', kind: 'food', price: 2 },
  fish: { name: 'Fish', icon: '🐟', kind: 'food', price: 2 },
  meat: { name: 'Bushmeat', icon: '🍖', kind: 'food', price: 3 },
  wood: { name: 'Wood', icon: '🌲', kind: 'goods', price: 2 },
  stone: { name: 'Stone', icon: '🧱', kind: 'goods', price: 3 },
  iron: { name: 'Iron', icon: '⚒️', kind: 'goods', price: 6 },
  palmoil: { name: 'Palm oil', icon: '🌴', kind: 'goods', price: 5 },
  weapons: { name: 'Weapons', icon: '🗡️', kind: 'goods', price: 14 },
  cowries: { name: 'Cowries', icon: '🐚', kind: 'money' },
};

export const FOOD = ['yam', 'fish', 'meat'];
export const GOODS = ['wood', 'stone', 'iron', 'palmoil', 'weapons'];
export const ALL_RES = [...FOOD, ...GOODS, 'cowries'];

// A `food` key in a cost means "any mix of food".
export function costText(cost) {
  return Object.entries(cost)
    .map(([k, v]) => `${k === 'food' ? '🍽️' : RESOURCES[k].icon} ${v}`)
    .join('  ');
}
