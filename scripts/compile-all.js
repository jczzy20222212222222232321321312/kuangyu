const fs = require('fs');
const path = require('path');
const solc = require('solc');
const root = path.join(__dirname, '..');
const files = fs.readdirSync(path.join(root, 'contracts')).filter((f) => f.endsWith('.sol'));
const sources = {};
for (const f of files) sources[f] = { content: fs.readFileSync(path.join(root, 'contracts', f), 'utf8') };
const input = { language: 'Solidity', sources, settings: { optimizer: { enabled: true, runs: 200 }, outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } } };
const out = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = (out.errors || []).filter((e) => e.severity === 'error');
if (errors.length) { console.error(errors.map((e) => e.formattedMessage).join('\n')); process.exit(1); }
fs.mkdirSync(path.join(root, 'build'), { recursive: true });
for (const file of Object.keys(out.contracts)) for (const name of Object.keys(out.contracts[file])) {
  const c = out.contracts[file][name];
  fs.writeFileSync(path.join(root, 'build', name + '.json'), JSON.stringify({ contractName: name, abi: c.abi, bytecode: '0x' + c.evm.bytecode.object }, null, 2));
  console.log(name, 'compiled');
}
