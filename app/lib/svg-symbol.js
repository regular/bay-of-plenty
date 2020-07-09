const crypto = require('crypto')

module.exports = function addSymbol(src) {
  const id = `_${crypto.randomBytes(7).toString('hex')}`
  const sym = makeSymbol(id, src)
  document.head.appendChild(sym)
  return function() {
    return makeInstance(id)
  }
}
function makeSymbol(id, src) {
  const p = document.createElement('div')
  p.innerHTML = src
  const svg = p.children[0]
  const viewBox = svg.getAttribute('viewBox')

  const inner = svg.innerHTML
  p.innerHTML = `
    <svg>
      <symbol viewBox="${viewBox}" id="${id}">
      ${inner}
      </symbol>
    </svg>`
  return p.children[0]
}

function makeInstance(id) {
  const p = document.createElement('div')
  p.innerHTML = `
  <svg style="width:100%; height:100%">
    <use xlink:href="#${id}"/>
  </svg>`
  return p.children[0]
}

/*
//const s = require('mutant/svg-element')
document.body.appendChild(h('.icon', [
  s('svg', [
    s('use', {
      attributes: {
        'xlink:href': '#heart'
      }
    })
  ])
]))
*/
