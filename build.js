'use strict';
const { readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const read = name => readFileSync(join(__dirname, name), 'utf8');
const html = read('index.html')
  .replace('<link rel="stylesheet" href="style.css">', () => '<style>\n' + read('style.css') + '</style>')
  .replace('<script defer src="game.js"></script>\n<script defer src="ui.js"></script>', '')
  .replace('</body>', () => '<script>\n' + read('game.js') + '\n' + read('ui.js') + '</script>\n</body>');
writeFileSync(join(__dirname, 'standalone.html'), html);
