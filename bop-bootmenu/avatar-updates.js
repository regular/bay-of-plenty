const pull = require('pull-stream')
const Value = require('mutant/value')
const debug = require('debug')('bop-bootmenu:avatar-update')

module.exports = function(ssb) {
  return function getAvatarUpdates(netkey, id) {
    const avatar = Value()
    if (ssb.bayofplenty && ssb.bayofplenty.avatarUpdates) {
      pull(
        ssb.bayofplenty.avatarUpdates(netkey, id),
        pull.drain(newAvatar =>{
          debug('new avatar %o', newAvatar)
          avatar.set(newAvatar)
        }, err => {
          console.error(`avatarUpdates failed: ${err.message}`)
        })
      )
    }
    return avatar
  }
}
