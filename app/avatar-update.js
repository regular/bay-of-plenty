const Notify = require('pull-notify')
const pull = require('pull-stream')
const cat = require('pull-cat')
const debug = require('debug')('bop:avatar-update')

const entries = {}

function getEntry(network, id) {
  const key = `${network} ${id}`
  let entry = entries[key]
  if (!entry) {
    entry = {
      notify: Notify(),
      avatar: {
        name: null,
        image: null
      }
    }
    entries[key] = entry
  }
  return entry
}

function avatarUpdate(network, id, key, value) {
  debug(`Updating avatar ${key} to ${value}, ${network} ${id}`)
  const entry = getEntry(network, id)
  entry.avatar[key] = value
  entry.notify(entry.avatar)
}

function getUpdates(network, id) {
  debug(`getting updates for: ${network} ${id}`)
  const entry = getEntry(network, id)
  return cat([
    pull.values([entry.avatar]),
    entry.notify.listen()
  ])
}

module.exports = {
  avatarUpdate,
  getUpdates
}
