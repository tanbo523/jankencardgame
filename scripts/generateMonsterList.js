const fs = require('fs');
const path = require('path');

const types = ['fire', 'water', 'grass'];
const out = {};

types.forEach(type => {
  const dir = path.join(__dirname, '../public/monsters', type);
  if (!fs.existsSync(dir)) {
    out[type] = [];
    return;
  }
  out[type] = fs.readdirSync(dir).filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f));
});

fs.writeFileSync(
  path.join(__dirname, '../src/monstersList.ts'),
  `export const monstersList = ${JSON.stringify(out, null, 2)} as const;\n`
);
