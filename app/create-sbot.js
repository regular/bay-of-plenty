const {join} = require('path')

module.exports = function() {
  // load plugins from ssb-server, so the versions are shrinkwrapped
  const scuttlebot_modpath = 'ssb-server/node_modules/'
  let createSbot = require('ssb-server')

  const plugins = [
    'ssb-master',
    'ssb-gossip',
    'ssb-replicate',
    'ssb-friends',
    'ssb-blobs',
    'ssb-invite',
    'ssb-local',
    'ssb-logging',
    'ssb-query',
    'ssb-links',
    //'ssb-ws', // we use our own, patched repo
    'ssb-ebt',
    'ssb-ooo'
  ]
  function useBuiltInPlugin(p) {
    return createSbot.use(require(join(scuttlebot_modpath, p)))
  }
  plugins.forEach( p => {
    createSbot = useBuiltInPlugin(p)
  })
  const ret = function(config, keys, cb) {
    const merged = Object.assign({}, config, {keys})
    console.log('merged')
    console.dir(merged)
    const ssb = createSbot(merged)

    ssb.whoami( (err, feed) => {
      console.error(err)
      if (err) return cb(err)
      cb(null, ssb, feed)
    })
  }
  ret.use = function(x) {
    createSbot.use(x)
    return ret
  }
  return ret
}
