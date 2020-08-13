/* This exists, because there are modules that contain a closing script tag in their source code,
 * which is a problem when inlinig scripts.
 *
 * TODO: this assumes that the closding tag appears in a string literal
 * (or in a comment, where the substitution that is performed here is harmless)
 *
 * It would be better to actuall _make sure_ we are in a string literal. Fir this, we;d
 * have to do the substitution on the AST.
 *
 */


const regexp = new RegExp(`<\/script>`, 'ig');

module.exports = function(str) {
  return str.replace(regexp, function (str) {
    console.warn('Closing script tag found in source code. We assume/hope that it is in a string literal and replace it with <\\/script>')
    return '<\\/' + str.substring(2)
  })
}
