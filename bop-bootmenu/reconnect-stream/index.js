const pull =require('pull-stream')
const filterError = require('pull-catch')
const next = require('pull-next')

module.exports = function(src) {
  let delay
  return next(() => {
    return pull(
      src(),
      filterError( err=>{
        delay = err.pleaseRetryIn
        if (delay !== undefined) {
          return // ignore error
        }
        return false  // pass error
      }),
      pull.asyncMap( (x, cb) => {
        if (delay == undefined) return cb(null, x)
        setTimeout( ()=>cb(null, x), delay)
      })
    )
  })
}
