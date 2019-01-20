const plugin = require('../plugin')
const EventEmitter = require('events')
//jshint -W079
const atob = require('atob')

//jshint -W020
window = {}
window.localStorage = {}
window.bayofplenty = {
  log: function(msg) {
    console.error(msg)
    return false // don't call again
  }
}

//plugin.sendAboutPage(process.stdout)
function Ssb() {
  this.ws = {
    use: ()=>{}
  }
}
Ssb.prototype = new EventEmitter()

const config = {}

const p = plugin.init(new Ssb(), config)
const win = {
  webContents: {
    executeJavaScript: (code, cb) => {
      cb = cb || (()=>{})
      console.log('exec', code)
      // jshint -W061
      let ret
      try{
        ret = eval(code)
      } catch(e) {
        return cb(e)
      }
      cb(null, ret)
    }
  }
}
p.addWindow(win, {foo: 'bar'})
p.log({level: 'info', src:'hello', verb:'world'})
p.log({level: 'foo', verb: 'bar'})
p.close( err =>{
  console.log('closed')
})

