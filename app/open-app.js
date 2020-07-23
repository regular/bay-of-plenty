const invites = require('tre-invite-code')
const debug = require('debug')('bop:open-app')
const ssbKeys = require('ssb-keys')

module.exports = function OpenApp(pool, page, conf) {
  const {onLoading, onTitleChanged, getViewById} = conf

  return function openApp(invite, id, opts, cb) {
    debug('openAPp called')
    const view = getViewById(opts.viewId)
    if (!view) return cb(new Error(`Unable to find view with id ${opts.viewId}`))
    debug(`onLoading ${view.id} true`)
    onLoading(true, opts)
    const conf = invite ? confFromInvite(invite) : null
    if (invite && !conf) {
      const err = new Error('invite parse error')
      debug(err.message)
      return cb(err)
    }

    const {unref, promise} = pool.get({conf, id})
    promise.catch(err =>{
      debug(`sbot-pool failed: ${err.message}`)
      return cb(err)
    }).then( ({ssb, config, myid}) => {
      const browserKeys = ssbKeys.generate()
      //config.master = config.master || []
      //config.master.push(browserKeys.id)
      debug(`browser public key: ${browserKeys.id}`)
      //debug(`master: ${config.master}`)
      // only when sbot uses canned config
      if (!invite && !id) {
        ssb.bayofplenty.setOpenAppCallback(openApp)
      }

      view.once('close', e=>{
        debug(`view ${view.id} closed -- unref sbot`)
        unref()
      })

      const bootKey = (conf && conf.boot) || config.boot
      ssb.treBoot.getWebApp(bootKey, (err, result) =>{
        if (err) return cb(err)
        const url = `http://127.0.0.1:${config.ws.port}/about/${encodeURIComponent(bootKey)}`
        //TODO: needed?
        //reflection.reset()

        debug('webapp: %O', result.kv.value.content)
        const title = result.kv.value.content.name
        onTitleChanged(title, opts)

        page.once('domcontentloaded', async ()  =>{
          debug('domcontentloaded (launch page)')
          ssb.bayofplenty.addWindow(view, browserKeys)

          page.once('domcontentloaded', e  =>{
            debug('domcontentloaded (webapp)')
            debug('removing loading tag')
            debug(`onLoading ${view.id} false`)
            onLoading(false, opts)
          })

          debug('setting browser keypair')
          await page.evaluate(async (keys)=>{
            console.log("setting keys")
            window.sessionStorage["tre-keypair"] = JSON.stringify(keys)
            console.log('%c done setting keys', 'color: yellow;');
          }, browserKeys)
        })

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
