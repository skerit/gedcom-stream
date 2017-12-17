# Gedstream

Parse a GEDCOM file as a stream

## Install

```bash
$ npm install gedstream
```

## Example

Create a new stream and pipe a file into it

```javascript
var Gedstream = require('gedstream'),
    fs        = require('fs');

let gedstream = new Gedstream();
fs.createReadStream('/path/to/gedcom').pipe(gedstream);

gedstream.on('data', function onData(tag) {
    // Root tag objects will be emitted here
    // These are of instance `Tag`, but can be jsonified
    /*
        Tag {
            level   : 0,
            tag     : "INDI",
            pointer : "@I18@",
            data    : "",
            tree    : [ ... ],
            parent  : null
        }
    */
});
```

You can also directly pass a filepath

```javascript
var Gedstream = require('gedstream');

let gedstream = Gedstream.fromFile('/path/to/gedcom');

gedstream.on('data', function onData(tag) {
    // ...
});
```
