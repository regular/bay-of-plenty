// NOTE: we are not using this, because we do not want
// to use exposeFunction. It creates a global function
// in all contexts (even after navigation) that allows
// invoking *all* exposed functions!
//
module.exports = function(page, source) {
  return page.exposeFunction('foo', end => new Promise( (resolve, reject) => {
    console.log('end', end)
    if (end == 'null') end = null
    else if (end == 'true') end = true
    else end = new Error(end)
    source(end, (err, data)=>{
      console.log('resolving:',err, data)
      resolve({err, data})
    })
  }))
}
