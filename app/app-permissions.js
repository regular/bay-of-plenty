const debug = require('debug')('bop:appperms')
const pull = require('pull-stream')
const Pushable = require('pull-pushable')
const {isMsgId} = require('ssb-ref')

module.exports = function(electron, win, ssbPromise) {
  const dialogData = Pushable()

  pull(
    dialogData,
    pull.asyncMap( (data, map_cb) => {
      const {ssb, appName, app, perm} = data
      function cb(a, b) {
        data.cb(a,b)
        map_cb(a,b)
      }
      // check persisted value again, it might has changed
      ssb.appPermissions.socialValue({ key: perm, dest: app  }, (err, value) => {
        if (err) {
          debug('appPermissions.socialValue faild: %s', err.message)
        } else {
          if (value) debug('permission "%s" for app %s has changed to  %s', perm, app, value)
        }
        if (err || value !== null) return cb(err, value)
        showPermissionDialog(appName, app, perm, (err, {persist, value})=>{
          if (!persist) return  cb(null, value)
          ssb.private.publish({
            type: 'app-permissions',
            app,
            [perm]: value
          }, [ssb.id], (err, result) =>{
            if (err) console.error('Unable to persist app permission: %s', err.message)
            debug('Store app permission for user %s %O', ssb.id, result)
            cb(null, value)
          })
        })
      })
    }),
    pull.drain(()=>{}, err=>{
      if (err) {
        console.error(`permission dialog queue ended with error: %{err.message}`)
      }
    })
  )

  return function getPermission(appKv, perm, cb) {
    const app = getAppKey(appKv)
    const appName = getAppName(appKv)
    debug('query permission "%s" for app %s', perm, app)
    ssbPromise.then(ssb=>{
      ssb.appPermissions.socialValue({ key: perm, dest: app  }, (err, value) => {
        if (err) {
          debug('faild: %s', err.message)
        } else {
          debug('permission "%s" for app %s is %s', perm, app, value)
        }
        if (err || value !== null) return cb(err, value)
        debug('queueing permission dialog for %s', perm)
        dialogData.push({
          ssb, appName, app, perm, cb
        })
      })
    })
  }

  function showPermissionDialog(appName, app, perm, cb) {
    debug('Showing dialog')
    electron.dialog.showMessageBox(win, {
      type: 'question',
      buttons: ['Yes', 'No'],
      defaultId: 1,
      cancelId: 1,
      title: `"${appName}" asks for permission`,
      detail: `app-id: ${app}`,
      checkboxLabel: 'Remember my answer',
      checkboxChecked: false,
      message: `Do you want to allow ${appName} to call ${perm}?`,
    }).then( ({response, checkboxChecked})=>{
      debug('response %d, persist: %s', response, checkboxChecked)
      value = response == 0
      const persist =checkboxChecked
      cb(null, {persist, value})
    })
  }
}

// -- util

function getAppName(appKv) {
  let name
  if (appKv.value && appKv.value.content) {
    name = appKv.value.content.name
  }
  return name || appKv.key
}

function getAppKey(appKv) {
  if (isMsgId(appKv.key)) {
    return appKv.value.content.revisionRoot || appKv.key
  } else {
    // it's a file path used during development
    const key = '&' + padBuffer(Buffer.from(appKv.key), 32).toString('base64') + '.sha256'
    debug('key from path %s is %s', appKv.key, key)
    return key
  }
}

function padBuffer(b, len) {
  if (len<=b.length) return b.slice(0, len)
  return Buffer.concat([b, Buffer.alloc(len - b.length).fill(0)])
}

/*
function wrap() {
  return wrapAPI(ssb, manifest, wrapper)
}
*/

