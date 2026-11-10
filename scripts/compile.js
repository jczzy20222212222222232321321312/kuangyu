const fs = require('fs');
const path = require('path');
const solc = require('solc');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'contracts', 'OreSoldier.sol'), 'utf8');
const input = {
  language: 'Solidity',
  sources: { 'OreSoldier.sol': { content: source } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
  },
};
const out = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = (out.errors || []).filter((e) => e.severity === 'error');
if (errors.length) { console.error(errors.map((e) => e.formattedMessage).join('\n')); process.exit(1); }
const c = out.contracts['OreSoldier.sol'].OreSoldier;
const artifact = { contractName: 'OreSoldier', abi: c.abi, bytecode: '0x' + c.evm.bytecode.object };
fs.mkdirSync(path.join(root, 'build'), { recursive: true });
fs.writeFileSync(path.join(root, 'build', 'OreSoldier.json'), JSON.stringify(artifact, null, 2));
console.log('compiled -> build/OreSoldier.json');
