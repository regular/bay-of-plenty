bop-bootmenu
---

Bootmenu for Bay Of Plenty (it's a tre webap)

I am using eventful to manage the apps assets.
Eventful requires some assets from the abundance repo:

```
tre-import ~/dev/tre/abundance/icons.json --publish-prototype tre-images
tre-import ~/dev/tre/abundance/stylesheets.json --publish-prototype tre-stylesheets
```
This wiill output JSON data you need to update your `.tretc`:

- add the prototypes the prototypes object
- add `icons` to `branches`

License: AGPLv3
