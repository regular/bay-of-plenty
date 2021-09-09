const rc = require('rc')
const {join, dirname} = require('path')
const debug = require('debug')('bop:local-config')

module.exports = function(argv_, opts) {
  opts = opts || {}
  let argv = argv_
  if (opts.canned) {
    argv = Object.assign({config: join(__dirname, '..', '.trerc')}, argv_)
  }
  const conf = rc('tre', {}, argv)
  debug('read local config:  %o', conf)

  if (!conf.config) {
    const msg = `Error loading local .trerc`
    throw new Error(msg)
  }
  if (!opts.canned) conf.path = conf.path || join(dirname(conf.config), '.tre')
  conf.bayOfPlenty = conf.bayOfPlenty || {}
  conf.canned = opts.canned

  if (conf.launchLocal) opts.launchLocal = conf.launchLocal
  conf.bayOfPlenty.launchLocal = opts.launchLocal
  return conf
}
