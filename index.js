var Gedstream,
    Transform = require('stream').Transform,
    readline  = require('readline'),
    util      = require('util'),
    fs        = require('fs'),
    Tag;

// from https://github.com/madprime/python-gedcom/blob/master/gedcom/__init__.py
// * Level must start with nonnegative int, no leading zeros.
// * Pointer optional, if it exists it must be flanked by '@'
// * Tag must be alphanumeric string
// * Value optional, consists of anything after a space to end of line
//   End of line defined by \n or \r
var line_re = /\s*(0|[1-9]+[0-9]*) {1,2}(@[^@]+@ |)([A-Za-z0-9_]+)( [^\n\r]*|)/;

/**
 * The Gedstream class
 *
 * @constructor
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @param    {Object}   options
 */
Gedstream = function Gedstream(options) {

	if (!options) {
		options = {};
	}

	options.objectMode = true;

	Transform.call(this, options);

	this._chain = [];
	this._previous_line = null;
	this._current = null;
};

// Inherit stream prototype methods
util.inherits(Gedstream, Transform);

/**
 * This stream is writable
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
Gedstream.prototype.writable = true;

/**
 * Create a new instance and read from a file
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
Gedstream.fromFile = function fromFile(file) {

	var gedstream = new Gedstream();

	if (typeof file == 'string') {
		fs.createReadStream(file).pipe(gedstream);
	} else {
		file.pipe(gedstream);
	}

	return gedstream;
};

/**
 * Transform incoming text into tag objects
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
Gedstream.prototype._transform = function _transform(chunk, enc, callback) {

	var pushed,
	    pieces,
	    piece,
	    match,
	    data,
	    tag,
	    up,
	    i;

	if (typeof chunk != 'string') {
		chunk = String(chunk);
	}

	if (this._previous_line) {
		chunk = this._previous_line + chunk;
		this._previous_line = null;
	}

	// Split by newlines
	pieces = chunk.split('\n');

	for (i = 0; i < pieces.length; i++) {
		piece = pieces[i];
		pushed = false;

		// If this is the last piece, keep it for the next transform
		if (i == pieces.length - 1) {
			this._previous_line = piece;
			break;
		}

		data = mapLine(piece);

		if (!data) {
			continue;
		}

		// Create a new tag instance
		tag = new Tag(data, this._current);

		// The current tag might be done
		if (this._current && this._current._finished) {
			this.push(this._current.getRoot());
		}

		this._current = tag;
	}

	callback();
};

/**
 * Clean up
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
Gedstream.prototype._flush = function _flush(callback) {

	var that = this;

	if (this._previous_line) {
		this._transform('\n', null, function done() {

			if (that._current) {
				that.push(that._current.getRoot());
			}

			callback();
		});
	} else {
		callback();
	}
};

/**
 * Create a tag out of a line
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @param    {Object}   data
 * @param    {Tag}      current_tag
 */
Tag = function Tag(data, current_tag) {

	// The level of the tag
	this.level = data.level;

	// The type of tag
	this.tag = data.tag;

	// Optional pointer
	this.pointer = data.pointer;

	// The actual data
	this.data = data.data;

	// And the contents
	this.tree = [];

	// The parent tag will go here
	this.parent = null;

	// Add it to the correct tree
	this._addToTree(current_tag);
};

/**
 * Let this tag be jsonified correctly
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
Tag.prototype.toJSON = function toJSON() {
	return {
		level   : this.level,
		tag     : this.tag,
		pointer : this.pointer,
		data    : this.data,
		tree    : this.tree
	};
};

/**
 * Add it to the correct tree
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
Tag.prototype._addToTree = function _addToTree(tag) {

	if (!tag) {
		return;
	}

	// If this is a top level tag,
	// the previous tag is finished
	if (this.level == 0) {
		if (tag) {
			tag._finished = true;
		}

		return;
	}

	// If the tag is the same level,
	// add it to the other tag's parent
	if (this.level == tag.level) {
		tag.parent.tree.push(this);
		this.parent = tag.parent;
		return;
	}

	// If the tag is a higher level,
	// add it to this tag's children
	if (this.level > tag.level) {
		tag.tree.push(this);
		this.parent = tag;
		return;
	}

	// The tag is a lower level, then we need to get the correct tag
	if (this.level < tag.level) {
		return this._addToTree(tag.parent);
	}
};

/**
 * Get this tag's topmost parent
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
Tag.prototype.getRoot = function getRoot() {

	var cur = this;

	while (cur && cur.parent) {
		cur = cur.parent;
	}

	return cur;
};

/**
 * Map a single line
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
function mapLine(line) {
	var match = line.match(line_re);

	if (!match) {
		return null;
	}

	return {
		level   : parseInt(match[1], 10),
		pointer : match[2].trim(),
		tag     : match[3].trim(),
		data    : match[4].trim(),
		tree    : []
	};
}

module.exports = Gedstream;