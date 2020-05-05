module.exports = function encode(unsafe) {
  unsafe = unsafe.replace('.ed25519', '')
  return unsafe.replace(/\//g, '-').replace(/\?/g, '_').replace(/[\*@%]/g, '')
}
