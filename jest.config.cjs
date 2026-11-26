// filepath: /c:/Users/A257371/Documents/development/software/node/projects3/genai-portal-notebook/jest.config.js
module.exports = {
  testPathIgnorePatterns: ['<rootDir>/tmp/'],
  transformIgnorePatterns: [
    'node_modules/(?!(exceljs-hardened|archiver|is-stream|zip-stream|compress-commons|crc32-stream)/)',
  ],
  transform: {
    '^.+\\.jsx?$': ['babel-jest', { presets: [['@babel/preset-env', { targets: { node: 'current' } }]] }],
  },
};