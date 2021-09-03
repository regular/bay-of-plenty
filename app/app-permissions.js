const debug = require('debug')('bop:appperms')
const pull = require('pull-stream')
const {isMsgId} = require('ssb-ref')

module.exports = function(electron, win, ssbPromise) {
  return function getPermission(appKv, perm, cb) {
    const app = getAppKey(appKv)
    debug('query permission "%s" for app %s', perm, app)
    ssbPromise.then(ssb=>{
      ssb.appPermissions.socialValue({ key: perm, dest: getAppKey(appKv)  }, (err, value) => {
        if (err) {
          debug('faild: %s', err.message)
        } else {
          debug('permission "%s" for app %s is %s', perm, app, value)
        }
        if (err || value !== null) return cb(err, value)
        showPermissionDialog(app, perm, (err, {persist, value})=>{
          if (!persist) return  cb(null, value)
          ssb.publish({
            type: 'app-permissions',
            app,
            [perm]: value
          }, (err, result) =>{
            if (err) console.error('Unable to persist app permission: %s', err.message)
            debug('Published app permission %O', result)
            cb(null, value)
          })
        })
      }, cb)
    })
  }
  function showPermissionDialog(app, perm, cb) {
    electron.dialog.showMessageBox(win, {
      type: 'question',
      buttons: ['Yes', 'No'],
      defaultId: 1,
      cancelId: 1,
      title: 'Application Permissions',
      detail: `app-id: ${app}`,
      checkboxLabel: 'Remember my answer',
      checkboxChecked: false,
      message: `Do qou want to allow ${perm}?`,
    }).then( ({response, checkboxChecked})=>{
      console.log('response %d, persist: %s', response, checkboxChecked)
      value = response == 0
      const persist =checkboxChecked
      cb(null, {persist, value})
    })
  }
}

// -- util

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

