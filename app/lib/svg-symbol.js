const crypto = require('crypto')

module.exports = function addSymbol(src) {
  const id = `_${crypto.randomBytes(7).toString('hex')}`
  const sym = makeSymbol(id, src)
  document.head.appendChild(sym)
  return function(opts) {
    return makeInstance(id, opts)
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
  const newSvg = p.children[0]
  removeStrokeStyle(newSvg)
  removeTitle(newSvg)
  return newSvg
}

function makeInstance(id, opts) {
  opts = opts || {}
  const p = document.createElement('div')
  p.innerHTML = `
  <svg style="width:100%; height:100%">
    ${opts.title ? '<title>' + opts.title + '</title>' : ''}
    <use xlink:href="#${id}"/>
  </svg>`
  const svg = p.children[0]
  return svg
}

function removeTitle(svg) {
  svg.querySelectorAll('title').forEach(el=>el.parentElement.removeChild(el))
}
function removeStrokeStyle(svg) {
  svg.querySelectorAll('[style]').forEach(el=>{
    const style = el.getAttribute('style')
    const newStyle = style.replace(/stroke\:[^;]+(;|$)/,'')
    el.setAttribute('style', newStyle)
  })
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
