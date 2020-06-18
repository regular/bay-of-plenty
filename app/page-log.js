const {Events} = require('puppeteer-core/lib/Events')
const debug = require('debug')('bop:page-log')
const Pupplog = require('puppeteer-log')
const LogFun = require('./log-fun')

module.exports = function(page, tabid) {
  const pupplog = Pupplog(LogFun(tabid), err=>{
    console.error(`puppeteer-log ended: ${err && err.message}`)
  })

  page.on(Events.Page.Console, message =>{
    pupplog.push(message)
  })
  page.evaluateOnNewDocument(debug=>localStorage.debug=debug, process.env.DEBUG)
  .catch(err =>{
    debug('evaluateOnNewDocument "localStorage.debug=process.env.DEBUG" failed.')
  })
}

