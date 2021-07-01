const fs = require('fs')
const {join} = require('path')
const {parse} = require('url')

const Notify = require('pull-notify')
const pull = require('pull-stream')
const cat = require('pull-cat')
const debug = require('debug')('bop:avatar-update')
const networkDir = require('./lib/get-networks-dir')()
const Server = require('thumbnail-server')

const storagePath = join(networkDir, '..', 'avatars.json')
const cold = loadColdStorage()
const entries = {}

const server = Server(join(networkDir, '..', 'thumbnails'), {
  sizes: [16, 32, 96, 128],
  idFromURL
  // TODO: use port allocator
})
server.listen( err=>{
  if (err) throw err
  debug('thumbnail server is up')
})

function idFromURL(url) {
  const {path} = parse(url)
  if (!path) {
    debug('invalid URL %s', url)
    return url
  }
  const last = path.split('/').slice(-1)[0]
  return decodeURIComponent(last)
}

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

  const isURL = typeof value == 'string' && parse(value).protocol
  if (!isURL) return setValue(value)

  server.addImageURL(value, (err, result) => {
    if (err) return console.error('Unable to add image url %s', err.message)
    setValue(result)
  })

  function setValue(value) {
    const entry = getEntry(network, id)
    entry.avatar[key] = value
    setCold(network, id, entry.avatar)
    entry.notify(entry.avatar)
  }
}

function getUpdates(network, id) {
  debug(`getting updates for: ${network} ${id}`)
  const entry = getEntry(network, id)
  return pull(
    cat([
      pull.once(entry.avatar),
      entry.notify.listen()
    ]),
    pull.map(entry=>{
      // TODO: fix port number in URL, if it has changed
      debug('announce %o', entry)
      return entry
    })
  )
}

module.exports = {
  avatarUpdate,
  getUpdates,
  getPrefix: function() {
    return server.getPrefix()
  }
}
