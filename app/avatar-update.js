const fs = require('fs')
const {join} = require('path')

const Notify = require('pull-notify')
const pull = require('pull-stream')
const cat = require('pull-cat')
const debug = require('debug')('bop:avatar-update')
const networkDir = require('./lib/get-networks-dir')()

const storagePath = join(networkDir, '..', 'avatars.json')
const cold = loadColdStorage()
const entries = {}

function loadColdStorage() {
  debug(`Reading ${storagePath}`)
  try {
    return JSON.parse(fs.readFileSync(storagePath))
  } catch(err) {
    debug(`Unable to read avatars: ${err.message}`)
    return {}
  }
}

function saveColdStorage(cold) {
  debug(`Writing ${storagePath}`)
  try {
    fs.writeFileSync(storagePath, JSON.stringify(cold), 'utf8')
  } catch(err) {
    debug(`Unable to write avatars: ${err.message}`)
  }
}

function setCold(network, id, avatar) {
  if (!cold[network]) cold[network] = {}
  cold[network][id] = avatar
  saveColdStorage(cold)
}

function getEntry(network, id) {
  const key = `${network} ${id}`
  let entry = entries[key]
  if (!entry) {
    entry = {
      notify: Notify(),
      avatar: (cold[network] && cold[network][id]) || {
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
  setCold(network, id, entry.avatar)
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
