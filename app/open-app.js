const fs = require('fs')
const locateTrerc = require('./lib/locate-trerc')
const {resolve, join, dirname} = require('path')
const invites = require('tre-invite-code')
const debug = require('debug')('bop:open-app')
const ssbKeys = require('ssb-keys')
//const loadScript = require('./lib/script-loader')
const buildOnDemand = require('./lib/build-on-demand')
const rc = require('rc')

module.exports = function OpenApp(pool, conf, argv) {
  const {onLoading, onTitleChanged} = conf

  return function openApp(invite, id, opts, cb) {
    debug('openApp called')
    const {page, viewId} = opts
    if (!page) return cb(new Error(`page not specified`))
    if (viewId == undefined) return cb(new Error(`viewId not specified viewId`))
    debug(`onLoading ${viewId} true`)
    onLoading(true, opts)
    let conf = invite ? confFromInvite(invite) : null
    if (invite && !conf) {
      const err = new Error('invite parse error')
      debug(err.message)
      return cb(err)
    }
    if (!invite && (opts.launchLocal || argv.config)) {
      conf = rc('tre', {}, argv)
      console.log('read local config:  %o', conf)
        //const trePath = locateTrerc(resolve('.'))
        //debug('reading local .trerc at %s', trePath)
        //conf = JSON.parse(fs.readFileSync('.trerc'))
  
      if (!conf.config) {
        const msg = `Error loading local .trerc for launcing ${opts.launchLocal}`
        return cb(new Error(msg))
      }
      if (conf.launchLocal) opts.launchLocal = conf.launchLocal
      conf.path = conf.path || join(dirname(conf.config), '.tre')
      conf.bayOfPlenty = conf.bayOfPlenty || {}
      conf.bayOfPlenty.launchLocal = opts.launchLocal
      debug('conf is %O', conf)
    }

    if (opts.launchLocal) {
      debug('launchLocal is set')
    } else {
      debug('launchLocal is not set')
    }

    const {unref, promise} = pool.get({conf, id})
    promise.catch(err =>{
      debug(`sbot-pool failed: ${err.message}`)
      return cb(err)
    }).then( ({ssb, config, myid}) => {
      const browserKeys = ssbKeys.generate()
      debug(`browser public key: ${browserKeys.id}`)
      // only when sbot uses canned config
      if (!invite && !id) {
        ssb.bayofplenty.setOpenAppCallback(openApp)
      }

      page.once('close', e=>{
        debug(`tab ${viewId} closed -- unref sbot`)
        unref()
      })

      function setupEventHandlers() {
        page.once('domcontentloaded', async ()  =>{
          debug('domcontentloaded (launch page)')
          ssb.bayofplenty.addTab(page, viewId, browserKeys)

          page.once('domcontentloaded', e  =>{
            debug('domcontentloaded (webapp)')
            debug('removing loading tag')
            debug(`onLoading ${viewId} false`)
            onLoading(false, opts)
          })

          debug('setting browser keypair')
          await page.evaluate(async (keys)=>{
            console.log("setting keys")
            window.sessionStorage["tre-keypair"] = JSON.stringify(keys)
            console.log('%c done setting keys', 'color: yellow;');
          }, browserKeys)

          if (opts.launchLocal) {
            buildOnDemand(ssb, page, opts.launchLocal, {
              origin: `http://127.0.0.1:${config.ws.port}/`
            })
          }

        })
      }

      if (opts.launchLocal) {
        debug(`launch local: ${opts.launchLocal}`)
        onTitleChanged('local / debug', opts)
        setupEventHandlers()
        const url = `http://127.0.0.1:${config.ws.port}/launch/`
        cb(null, {url})
        return
      }

      const bootKey = (conf && conf.boot) || config.boot
      debug(`bootKey: ${bootKey}`)
      ssb.treBoot.getWebApp(bootKey, (err, result) =>{
        if (err) {
          debug(err.message)
          return cb(err)
        }
        const url = `http://127.0.0.1:${config.ws.port}/launch/${encodeURIComponent(bootKey)}`
        debug('webapp: %O', result.kv.value.content)
        const title = result.kv.value.content.name
        onTitleChanged(title, opts)
        setupEventHandlers()
        cb(null, {webapp: result.kv, url})
      })

    })
  }
}

function confFromInvite(invite) {
  invite = invite.replace(/\s*/g,'')
  const conf = invites.parse(invite)
  return conf ? conf : null
}
