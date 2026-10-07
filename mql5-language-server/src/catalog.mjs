import { readFileSync } from 'node:fs';
export const catalog = JSON.parse(readFileSync(new URL('../data/builtins.json', import.meta.url), 'utf8'));
export const reference = JSON.parse(readFileSync(new URL('../data/reference.json', import.meta.url), 'utf8'));
