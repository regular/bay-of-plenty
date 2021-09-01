const debug = require('debug')('bop:open-app')
const invites = require('tre-invite-code')
const ssbKeys = require('ssb-keys')

const buildOnDemand = require('./lib/build-on-demand')
const localConfig = require('./lib/local-config')

module.exports = function OpenApp(
  getSbot,
  tabs,
  argv
) {

  return function openApp(invite, id, opts, cb) {
    const {tab} = opts
    const page = tab.page
    const tabId = tab.id
    if (tab == undefined) return cb(new Error(`tab not specified.`))
    if (!page) return cb(new Error(`tab has no page property`))
    debug(`openApp called in tab ${tab.id}`)

    let conf = invite ? confFromInvite(invite) : null
    if (invite && !conf) {
      const err = new Error('invite parse error')
      debug(err.message)
      return cb(err)
    }
    if (!invite) {
      if (opts.launchLocal || argv.config) {
        conf = localConfig(argv, opts)
        debug('conf is %O', conf)
      } else {
        conf = localConfig(argv, Object.assign({canned: true}, opts))
        debug('read canned conf')
      }
    }

    if (opts.launchLocal) {
      debug('launchLocal is set')
    } else {
      debug('launchLocal is not set')
    }

    tabs.addTag(tab.id, 'loading')

    const {unref, promise} = getSbot(conf, id)
    promise.catch(err =>{
      debug(`sbot-pool failed: ${err.message}`)
      tabs.removeTag(tab.id, 'loading')
      return cb(err)
    }).then( ({ssb, config, myid}) => {
      debug('got sbot')
      const browserKeys = ssbKeys.generate()
      debug(`browser public key: ${browserKeys.id}`)
      // only when sbot uses canned config
      // TODO: should be controlled by appPermissions
      // (put the plugin in all sbots, then restrict via auth
  
      function releaseSbot() {
        debug(`unref sbot for view ${tab.id}`)
        unref()
        page.off('close', releaseSbot)
        // NOTE: intentionally not using a closure for tab
        // to not hold a reference to it
        //const tab = tabs.getTabByViewId(tabId)
        //tab.off('app-opened', releaseSbot)
      }

      //const tab = tabs.getTabByViewId(tabId)
      //tab.once('app-opened', releaseSbot)
      page.once('close', releaseSbot)
      
      function setupEventHandlers(appKv) {
        page.once('domcontentloaded', async ()  =>{
          debug('domcontentloaded (launch page)')
          tab.app = null
          ssb.bayofplenty.addTab(tab, browserKeys)

          page.once('domcontentloaded', e  =>{
            debug('domcontentloaded (webapp)')
            debug('removing loading tag')
            tab.app = appKv
            tabs.removeTag(tab.id, 'loading')
            //const tab = tabs.getTabByViewId(tabId)
            //tab.emit('app-opened')
          })

          debug('setting browser keypair')
          await page.evaluate(async (keys)=>{
            console.log("setting keys")
            window.sessionStorage["tre-keypair"] = JSON.stringify(keys)
            console.log('%c done setting keys', 'color: yellow;');
          }, browserKeys)

          function onMeta(meta) {
            console.dir(meta)
            tabs.setTabTitle(tab.id, meta.name || 'debug / local')
            appKv = {
              key: opts.launchLocal,
              value: {
                content: meta
              }
            }
          }

          if (opts.launchLocal) {
            buildOnDemand(ssb, page, opts.launchLocal, {
              origin: `http://127.0.0.1:${config.ws.port}/`,
              onMeta
            })
          }

        })
      }

      ssb.autoinvite.useInviteCode( err=>{
        if (err) {
          tabs.removeTag(tab.id, 'loading')
          return cb(err)
        }

        if (opts.launchLocal) {
          debug(`launch local: ${opts.launchLocal}`)
          tabs.setTabTitle(tab.id, 'compiling ...')
          setupEventHandlers()
          const url = `http://127.0.0.1:${config.ws.port}/launch/`
          cb(null, {url})
          return
        }
      
        const bootKey = (conf && conf.boot) || config.boot
        debug(`bootKey: ${bootKey}`)
        ssb.treBoot.getWebApp(bootKey, (err, result) =>{
          if (err) {
            tabs.removeTag(tab.id, 'loading')
            debug(err.message)
            return cb(err)
          }
          const url = `http://127.0.0.1:${config.ws.port}/launch/${encodeURIComponent(bootKey)}`
          debug('webapp: %O', result.kv.value.content)
          const title = result.kv.value.content.name
          tabs.setTabTitle(tab.id, title)
          setupEventHandlers(result.kv)
          cb(null, {webapp: result.kv, url})
        })

      })

    })
  }
}

function confFromInvite(invite) {
  invite = invite.replace(/\s*/g,'')
  const conf = invites.parse(invite)
  if (!conf) return null

  if (conf.autoinvite && typeof conf.autoinvite == "string") {
    const code = conf.autoinvite
    conf.autoinvite = {code, auto: false}
  }
  return conf
}
