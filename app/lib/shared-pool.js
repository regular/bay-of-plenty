const debug = require('debug')('bop:shared-pool')

module.exports = function({getKey, makePromise, release}) {
  const entries = {}

  // return {unref, promise}
  return function get(args) {
    const k = getKey(args)
    let entry = entries[k]
    if (entry) {
      entry.ref_count ++
      debug(`found pre-existing entry for key "${k}", inc'ed ref_count to ${entry.red_count}`)
    } else {
      debug(`make entry for key "${k}"`)
      entry = {
        ref_count: 1,
        promise: makePromise(args)
      }
      entries[k] = entry
    }

    function unref() {
      debug(`unref called for key ${k}`)
      if (--entry.ref_count == 0) {
        debug('ref_count reached zero')
        delete entries[k]
        entry.promise.then(release)
        entry = null
      }
    }

    return {
      promise: entry.promise,
      unref
    }
  }

}
