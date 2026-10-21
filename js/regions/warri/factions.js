// Who shares the western delta with the player: the Urhobo and Isoko clans
// inland, the Ijaw fishing towns of the creeks, the Oba of Benin's river
// post, the pirates of the creeks, the places worth finding, and the powers
// beyond it: Benin to the north, whose war fleet is the land's first great
// host, and the Portuguese at the river mouth (see events.js).

export const FOREIGN = {
  edo: { name: 'Benin', color: '#a3171b' },
  portuguese: { name: 'Portuguese', color: '#c9a227' },
};

export const FACTIONS = [
  {
    id: 'urhobo', name: 'Urhobo of Agbarha', people: 'Urhobo', origin: 'Urhobo', strength: 3, temperament: 'friendly',
    leader: 'The Ovie of Agbarha', wants: { fish: 3, salt: 8 }, offers: { palmoil: 6, yam: 3 },
    at: [0.55, 0.12], color: '#3f8f5a', garrison: { warrior: 6, bowman: 3 },
    loot: { palmoil: 50, yam: 60, cowries: 150 }, tribute: { palmoil: 4, cowries: 9 }, joiners: 5,
    desc: 'Urhobo farmers and palm-oil makers of the forest inland, the creek towns’ partners in trade: their oil for your fish and salt.',
  },
  {
    id: 'isoko', name: 'Isoko clans', people: 'Isoko', strength: 2, temperament: 'proud',
    leader: 'The Ovie of Oleh', wants: { salt: 9, cloth: 13 }, offers: { yam: 3, palmoil: 6 },
    at: [0.92, 0.18], color: '#8a6d2b', garrison: { warrior: 5, bowman: 2 },
    loot: { yam: 60, palmoil: 30, cowries: 110 }, tribute: { yam: 6, cowries: 7 }, joiners: 4,
    desc: 'Farming clans of the north-east, each under its own Ovie, close kin to the Urhobo.',
  },
  {
    id: 'ijaw', name: 'Ijaw fishing towns', people: 'Ijaw', origin: 'Ijaw', strength: 3, temperament: 'proud',
    leader: 'The Amanayanabo of the creek towns', wants: { yam: 3, iron: 9 }, offers: { fish: 3, salt: 8 },
    at: [0.08, 0.84], color: '#2a7f9e', garrison: { warrior: 6, bowman: 3 },
    loot: { fish: 80, salt: 20, cowries: 140 }, tribute: { fish: 6, cowries: 8 }, joiners: 4,
    desc: 'Fishing and trading towns deep in the creeks to the west, at home on the water like no one else.',
  },
  {
    id: 'edopost', name: 'The Oba’s river post', people: 'Edo', origin: 'Edo', strength: 4, temperament: 'proud',
    leader: 'The Oba of Benin’s agent', wants: { fish: 3, salt: 9, palmoil: 7 }, offers: { cloth: 12, weapons: 18 },
    at: [0.66, 0.3], color: '#b8860b', garrison: { benin: 7, bowman: 4 },
    loot: { cloth: 30, weapons: 10, cowries: 220 }, tribute: { cowries: 14 }, joiners: 3,
    desc: 'A trading post of the Kingdom of Benin on the river, where the Oba’s agents buy salt and fish and keep an eye on the creek towns.',
  },
  {
    id: 'bandits1', name: 'Creek pirates', people: 'Bandits', strength: 1, temperament: 'bandit', major: false,
    at: [0.24, 0.4], color: '#3b3b3b', garrison: { bandit: 4 }, huts: 3, style: 'camp', firstRaid: 200,
    loot: { cowries: 60, fish: 30, wood: 30 }, joiners: 0,
    desc: 'Outcasts who rob canoes and farms along the creeks.',
  },
  {
    id: 'bandits2', name: 'Mangrove raiders', people: 'Bandits', strength: 1, temperament: 'bandit', major: false,
    at: [0.74, 0.44], color: '#3b3b3b', garrison: { bandit: 4, bowman: 1 }, huts: 3, style: 'camp', firstRaid: 420,
    loot: { cowries: 90, weapons: 4 }, joiners: 0,
    desc: 'Raiders who hide in the mangroves and prey on the traders’ canoes.',
  },
];

export const POIS = [
  { kind: 'shrine', at: [0.52, 0.71], name: 'the shrine of Umalokun', water: true, text: 'The shrine of the goddess of the waters on her island. The priestesses bless your people.', reward: { happy: 6, cowries: 40 } },
  { kind: 'salt', at: [0.6, 0.87], name: 'old salt pans', text: 'Shallow pans by the sea where the women boiled seawater into salt. There is salt left, and the know-how.', reward: { salt: 20, cowries: 30 } },
  { kind: 'wreck', at: [0.28, 0.9], name: 'a shipwreck on the beach', water: true, text: 'A broken foreign hull. You salvage cowries and blades.', reward: { cowries: 90, weapons: 6 } },
  { kind: 'farm', at: [0.62, 0.48], name: 'an abandoned farmstead', text: 'Old plantain groves and a full barn.', reward: { yam: 50 } },
  { kind: 'hunters', at: [0.36, 0.2], name: "a hunters' camp", text: 'Hunters of the forest share their meat and agree to join you.', reward: { meat: 25, strangers: 3 } },
  { kind: 'iron', at: [0.78, 0.14], name: 'old iron workings', text: 'Slag heaps and clay furnaces: iron ore lies here. Build an iron mine in the Town era.', reward: { iron: 25, reveal: 6 }, revealsIron: true },
];
