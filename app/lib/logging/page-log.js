const {Events} = require('puppeteer-core/lib/cjs/puppeteer/common/Events')
const debug = require('debug')('bop:page-log')
const Pupplog = require('puppeteer-log')
const LogFunStack = require('./log-fun-stack')

module.exports = function(page) {
  const stack = LogFunStack()
  const pupplog = Pupplog(stack.runFormatters, err=>{
    console.error(`puppeteer-log ended: ${err && err.message}`)
    console.error(err.stack)
  })

  page.on(Events.Page.Console, message =>{
    pupplog.push(message)
  })

  page.evaluateOnNewDocument(debug=>localStorage.debug=debug, process.env.DEBUG)
  .catch(err =>{
    debug('evaluateOnNewDocument "localStorage.debug=process.env.DEBUG" failed.')
  })

  const self = {
    use: function() {
      stack.use.apply(null, Array.from(arguments))
      return self
    }
  }
  return self
}

