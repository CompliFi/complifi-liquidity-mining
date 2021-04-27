const shell = require('shelljs');

module.exports = {
  skipFiles: ['Migrations.sol', 'mocks/'],
  mocha: {
    grep: "@skip-on-coverage", // Find everything with this tag
    invert: true,              // Run the grep's inverse set.
  },
  // We need to do this because solcover generates bespoke artifacts.
  onIstanbulComplete: async function (_config) {
    shell.rm("-rf", "./artifacts"); // Or your config.paths.artifacts path
    shell.rm("-rf", "./typechain"); // Or the typechain `outDir` (if removable)
  },
};
