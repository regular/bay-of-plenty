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
  let spawn_args = [index_path]
  if (opts.remoteDebuggingPort !== undefined) {
    spawn_args.push(`--remote-debugging-port=${opts.remoteDebuggingPort}`)
    delete opts.remoteDebuggingPort
  }
  spawn_args.push('--')
  spawn_args = spawn_args.concat(args)
  return spawn(electron_path, spawn_args, opts)
}
