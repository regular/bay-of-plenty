const OffsetLog = require('flumelog-offset')
const {join, parse} = require('path')

// This is a drop-in replacement for flumelog-offset
// that overrides the log's default location.

// We are passed filename from ssb-db/minimal.js
// It is based on config.path
// In order to create our log elsewhere (in dirname)

module.exports = function(filename, opts) {
  const dirname = parse(filename).dir
  console.log('Flumelog location is: %s', dirname)
  const log = OffsetLog(join(dirname, parse(filename).base), opts)
  log.filename = filename
  return log
}
