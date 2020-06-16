const {join} = require('path')
const fs = require('fs')
const debug = require('debug')('bop:sbot-pool')
const listPublicKeys = require('./lib/list-public-keys')
const getDatapath = require('./lib/get-data-path')
const SharedPool = require('./lib/shared-pool')
const pull = require('pull-stream')

module.exports = function Pool(Sbot) {

  return SharedPool({getKey, makePromise, release})

  function getKey({conf, id}) {
    return `${conf && conf.network} ${id}`
  }
  function release({sbot}) {
    debug('closing sbot')
    sbot.close()
  }
  function makePromise({conf, id}) {
    return new Promise( (resolve, reject) => {
      if (!conf) conf = JSON.parse(fs.readFileSync(join(__dirname, '.trerc')))
      conf = Object.assign({}, JSON.parse(fs.readFileSync(join(__dirname, 'default-config.json'))), conf || {})
      
      if (!conf.network) return reject(new Error('No network specified'))
      
      debug(`find datapath for network=${conf.network} id=${id}`)
      findDataPath(conf.network, id)
      .catch(reject)
      .then(datapath => {
        debug(`datapath is ${datapath}`)
        conf.path = datapath
        Sbot(conf, (err, ssb, config, myid, browserKeys) => {
          if (err) {
            console.error(`Error starting sbot ${err.message}`)
            return reject(error)
          }
          debug(`sbot started, ssb id ${myid}, datapath: ${datapath}`)
          resolve({
            ssb, config, myid, browserKeys
          })
        })
      })
    })
  }
}

function findDataPath(network, id) {
  return new Promise( (resolve, reject) => {
    if (!id) {
      return resolve(getDatapath(network, null))
    }
    debug(`Looking for existing datapath for network ${network} and id ${id}`)
    pull(
      listPublicKeys(network),
      pull.find( r => {return r.id == id}, (err, result)=>{
        if (err) return reject(new Error(`unknown identity: ${id}, ${err.message}`))
        debug(`done: ${result.datapath}`)
        resolve(result.datapath)
      })
    )
  })
}


/*
// TODO: ask for invite
if (!/ENOENT/.test(err.message)) {
  debug('(no config specified and did not find canned .trerc file')
  return cb(err)
}
cb(new Error('ask for invite not implemented.'))
*/
