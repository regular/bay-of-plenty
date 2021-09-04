const pull = require('pull-stream')
const defer = require('pull-defer')
const debug = require('debug')('bop:appperms-wrap')

module.exports = function(isAllowed) {
  return function wrapper(fn, type, path) {
    if (type == 'sync') type = 'async'
    let f = function() {
      const args = Array.from(arguments)
      
      const onReply = err=>{
        if (!err) {
          return fn.apply(this, args)
        } else {
          const cb = args.slice(-1)[0]
          cb(err)
        }
      }
      isAllowed.call(this, path, args, onReply)
    }

    if (type == 'source') {
      f = function() {
        const args = Array.from(arguments)
        const deferred = defer.source()
        const onReply = err=>{
          if (!err) {
            deferred.resolve(fn.apply(this, args))
          } else {
            deferred.resolve(pull.error(err))
          }
        }

        isAllowed.call(this, path, args, onReply)
        return deferred
      }
    }

    if (type == 'sink') {
      f = function() {
        const args = Array.from(arguments)
        const deferred = defer.sink()
        const onReply = err=>{
          if (!err) {
            deferred.resolve(fn.apply(this, Array.from(arguments)))
          } else {
            deferred.resolve(function (read) {read(err, ()=>{})})
          }
        }

        isAllowed.call(this, path, args, onReply)
        return deferred
      }
    }
    return f
  }
}
