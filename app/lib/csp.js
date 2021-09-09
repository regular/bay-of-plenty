const debug = require('debug')('bop:csp')
const avatarUpdate = require('../avatar-update')

module.exports = function(config, scriptHash) {
  const csp = 
      `default-src 'self'; ` +
      `img-src 'self' data: blob: ${avatarUpdate.getPrefix()}; ` +
      `style-src 'self' 'unsafe-inline'; ` +
      `font-src 'self' data: blob:; ` +
      `script-src 'wasm-eval' 'sha256-${scriptHash}'; ` +
      `connect-src 'self' data: blob: ws://localhost:${config.ws.port}; ` +
      `worker-src 'self' blob: data: 'wasm-eval'`

  debug('csp: %s', csp)
  return csp
}
