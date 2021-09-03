const pull = require('pull-stream')
const defer = require('pull-defer')

module.exports = function(isAllowed) {
  return function wrapper(fn, type, path) {
    if (type == 'sync') type = 'async'
    let f = function() {
      const args = Array.from(arguments)
      isAllowed(path, args, err=>{
        if (!err) {
          return fn.apply(this, args)
        } else {
          const cb = args.slice(-1)[0]
          cb(err)
        }
      })
    }
    if (type == 'source') {
      f = function() {
        const args = Array.from(arguments)
        const deferred = defer.source()
        isAllowed(path, args, err=>{
          if (!err) {
            deferred.resolve(fn.apply(this, args))
          } else {
            deferred.resolve(pull.error(err))
          }
        })
        return deferred
      }
    }
    if (type == 'sink') {
      f = function() {
        const args = Array.from(arguments)
        const deferred = defer.sink()
        isAllowed(path, args, err=>{
          if (!err) {
            deferred.resolve(fn.apply(this, Array.from(arguments)))
          } else {
            deferred.resolve(function (read) {read(err, ()=>{})})
          }
        })
        return deferred
      }
    }
    return f
  }
}
