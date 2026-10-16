// Colours of the land and its people.

import { T } from '../world/terrain.js';

export const GROUND = {
  [T.OCEAN]: ['#1d5b86', '#1a5279', '#22658f'],
  [T.LAGOON]: ['#2b8a96', '#277f8c', '#3196a0'],
  [T.RIVER]: ['#3592a3', '#2f8698', '#3a9caa'],
  [T.SAND]: ['#e6d29e', '#dcc48d', '#efdcab'],
  [T.MANGROVE]: ['#55703d', '#4a6535', '#5e7a43'],
  [T.GRASS]: ['#7bab4c', '#71a045', '#86b555'],
  [T.FOREST]: ['#4f7d36', '#46722f', '#57863b'],
  [T.SAVANNA]: ['#c5b463', '#b9a857', '#cfbf70'],
  [T.HILL]: ['#a38c6c', '#977f60', '#ae9776'],
  [T.FORD]: ['#8cb9b2', '#80aea8', '#97c2bb'],
};

export const PLAYER = '#1f8f4e';
export const PLAYER_LIGHT = '#5fd08e';
export const ENEMY = '#c0392b';
export const SKIN = ['#4a2c1a', '#5a3620', '#3f2416', '#6b4128'];
export const THATCH = '#c9a35b';
export const THATCH_DARK = '#a07d3e';
export const MUD = '#a5603a';
export const MUD_DARK = '#8a4a2c';
export const EARTH = '#b88a5c';
export const ZINC = '#b9c0c4';

export const CARRY = {
  wood: '#7a5230',
  yam: '#8b5a2b',
  fish: '#c9d3da',
  meat: '#b03a2e',
  stone: '#9b9b9b',
  iron: '#5b4a42',
  palmoil: '#e2621b',
  weapons: '#7f8c8d',
};

export const FOREIGN_COAT = { soldado: '#7b7f86', french: '#2c5aa0', marine: '#b22234' };
