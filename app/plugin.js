const fs = require('fs')
const Debug = require('debug')
const debug = Debug('plugin')

debug.log = (...args) => {
  console.log(...args)
}

exports.name = 'bayofplenty'
exports.version = require('./package.json').version
exports.manifest = {}

exports.init = function (ssb, config) {
  fs.appendFileSync(process.env.HOME + '/bay-of-plenty.log', 'PLUGIN INIT\n')

  debug('INFO: plugin init')

console.log('console.log from plugin')
console.error('console.error from plugin')
debug('debug from plugin')

  ssb.ws.use(function (req, res, next) {
    if(!(req.method === "GET" || req.method == 'HEAD')) return next()
    const u = url.parse('http://makeurlparseright.com'+req.url)
    if (u.pathname == '/about') {
      res.statusCode = 200
      res.setHeader('Content-Type', 'text/html')
      res.end('<html><body><h1>about</h1></body></html>')
      return
    }
    next()
  })

  return {}
}
