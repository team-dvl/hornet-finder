/**
 * Tests unitaires pour les utilitaires de lisibilité du texte
 */

import { getBestTextColor, getTextColorCSS } from '../utils/textReadability';

// Tests de la fonction getBestTextColor
console.log('=== Tests de getBestTextColor ===');

const testCases = [
  { color: '#ffffff', expected: 'black', description: 'Blanc → texte noir' },
  { color: '#000000', expected: 'white', description: 'Noir → texte blanc' },
  { color: '#ff0000', expected: 'white', description: 'Rouge → texte blanc' },
  { color: '#ffff00', expected: 'black', description: 'Jaune → texte noir' },
  { color: '#008000', expected: 'white', description: 'Vert → texte blanc' },
  { color: '#0000ff', expected: 'white', description: 'Bleu → texte blanc' },
  { color: '#ffc0cb', expected: 'black', description: 'Rose → texte noir' },
  { color: '#800080', expected: 'white', description: 'Violet → texte blanc' },
  { color: 'transparent', expected: 'black', description: 'Transparent → texte noir' },
  { color: '', expected: 'black', description: 'Vide → texte noir' },
];

testCases.forEach(({ color, expected, description }) => {
  const result = getBestTextColor(color);
  const status = result === expected ? '✅' : '❌';
  console.log(`${status} ${description}: ${result}`);
});

// Tests de la fonction getTextColorCSS
console.log('\n=== Tests de getTextColorCSS ===');

testCases.forEach(({ color, expected, description }) => {
  const result = getTextColorCSS(color);
  const expectedCSS = expected === 'white' ? '#ffffff' : '#000000';
  const status = result === expectedCSS ? '✅' : '❌';
  console.log(`${status} ${description}: ${result}`);
});

export {};
