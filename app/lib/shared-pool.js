const debug = require('debug')('bop:shared-pool')

module.exports = function({getKey, makePromise, release}) {
  const entries = {}

  function allDone() {
    return Promise.all(Object.values(entries).map(e=>e.isReleased))
  }

  // return {unref, promise}
  function get(args) {
    const k = getKey(args)
    let entry = entries[k]
    if (entry) {
      entry.ref_count++
      debug(`found pre-existing entry for key "${k}", inc'ed ref_count to ${entry.ref_count}`)
    } else {
      debug(`make entry for key "${k}"`)
      entry = {
        ref_count: 1,
        promise: makePromise(args)
      }
      // a promise that is resolved when the promise returned by release is resolved
      entry.isReleased = new Promise(resolve=>{
        entry.released = ()=>{
          debug(`done releasing ${k}`)
          delete entries[k]
          entry = null
          resolve()
        }
      })
      entries[k] = entry
    }

    function unref() {
      debug(`unref called for key ${k}, ref count will be ${entry.ref_count-1}`)
      if (--entry.ref_count == 0) {
        debug('ref_count reached zero')
        const {released} = entry
        entry.promise.then(release).then(released)
      }
    }

    return {
      promise: entry.promise,
      unref
    }
  }
  return {
    get,
    allDone
  }
}
