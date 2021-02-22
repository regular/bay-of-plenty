const pull = require('pull-stream')
const debug = require('debug')('bop:logging')
const supportsColor = require('supports-color')

const PageLog = require('./page-log')
const LogFunAnsi = require('./log-fun-ansi')
const ConsoleReflection = require('./page-console-reflection')
const detectErrors = require('./page-detect-errors')

const colorSupportLevel = (supportsColor.stderr && supportsColor.stderr.level) || 0

module.exports = async function initLogging(page, opts) {
  const {tabid, setAlert} = opts
  PageLog(page)
    .use(LogFunAnsi(tabid), {colorSupportLevel})
    .use(({text, type})=>{
      if (type == 'error') {
        if (text.startsWith("error loading sodium bindings")) return
        if (text.startsWith("falling back to javascript")) return

        const csp_violation = text.match(/violates the following Content Security Policy directive: "([^"]+)".*a hash \('([^']+)'\)/) 

        if (csp_violation) {
          const [_,sent,expected] = csp_violation
          console.error(`
            CSP violation
            browser expected: ${expected}
            we sent: ${sent}
          `) 
        }
        setAlert(text)
      }
    }, {colorSupportLevel: 0})

  const reflection = ConsoleReflection(page, err=>{
    console.error(`page reflection ended: ${err.message}`)
  })

  pull(
    detectErrors(page),
    pull.drain( e =>{
      console.error(`Tab ${tabid}: ${e.type} ${e.text}`)
      setAlert(e.text)
      const message = {
        text: ()=>e.text,
        type: ()=>e.type,
        location: ()=>{return {url:'', lineNumber:0}},
        args: ()=>[e.text]
      }
      reflection.push(message)
    }, err=>{
      if (err) console.error(`detectErrors stream ended: ${err.message}`)
    })
  )

  await page.evaluateOnNewDocument(debug=>{
    console.log(`%c setting localStorage.debug to %c "${debug}"`, 'color: yellow;', 'color: green;')
    localStorage.debug=debug
  }, process.env.DEBUG || '')

  page.on('request', request=>{
    if (request.isNavigationRequest()) {
      debug(`navigation request to ${request.url()}`)
      reflection.reset()
    }
  })
  
  page.on('framenavigated', frame =>{
    debug(`frame navigated ${frame._url}`)
  })

  page.on('domcontentloaded', ()  =>{
    debug('domcontentloaded')
    reflection.enable()
  })

}

