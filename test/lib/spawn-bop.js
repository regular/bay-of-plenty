const {join, resolve} = require('path')
const {spawn} = require('child_process')

const electron_path = resolve(join(
  __dirname,
  '..',
  '..',
  'node_modules',
  '.bin',
  'electron'
))

const index_path = resolve(join(
  __dirname,
  '..',
  '..',
  'app',
  'index.js'
))

module.exports = function(args, opts) {
  return spawn(electron_path, [index_path, '--'].concat(args), opts)
}
