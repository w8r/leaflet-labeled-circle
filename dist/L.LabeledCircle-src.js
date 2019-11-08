(function(){function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s}return e})()({1:[function(require,module,exports){
'use strict';

/**
 * Leaflet SVG circle marker with detachable and draggable label and text
 *
 * @author Alexander Milevski <info@w8r.name>
 * @license MIT
 * @preserve
 */
module.exports = require('./src/marker');

},{"./src/marker":9}],2:[function(require,module,exports){
require('./src/SVG');
require('./src/SVG.VML');
require('./src/Canvas');
require('./src/Path.Transform');
require('./src/Path.Drag');

module.exports = L.Path.Drag;

},{"./src/Canvas":3,"./src/Path.Drag":4,"./src/Path.Transform":5,"./src/SVG":7,"./src/SVG.VML":6}],3:[function(require,module,exports){
function TRUE_FN () { return true; }

L.Canvas.include({

  /**
   * Do nothing
   * @param  {L.Path} layer
   */
  _resetTransformPath: function(layer) {
    if (!this._containerCopy) return;

    delete this._containerCopy;

    if (layer._containsPoint_) {
      layer._containsPoint = layer._containsPoint_;
      delete layer._containsPoint_;

      this._requestRedraw(layer);
    }
  },


  /**
   * Algorithm outline:
   *
   * 1. pre-transform - clear the path out of the canvas, copy canvas state
   * 2. at every frame:
   *    2.1. save
   *    2.2. redraw the canvas from saved one
   *    2.3. transform
   *    2.4. draw path
   *    2.5. restore
   * 3. Repeat
   *
   * @param  {L.Path}         layer
   * @param  {Array.<Number>} matrix
   */
  transformPath: function(layer, matrix) {
    var copy   = this._containerCopy;
    var ctx    = this._ctx, copyCtx;
    var m      = L.Browser.retina ? 2 : 1;
    var bounds = this._bounds;
    var size   = bounds.getSize();
    var pos    = bounds.min;

    if (!copy) { // get copy of all rendered layers
      copy = this._containerCopy = document.createElement('canvas');
      copyCtx = copy.getContext('2d');
      // document.body.appendChild(copy);

      copy.width  = m * size.x;
      copy.height = m * size.y;

      this._removePath(layer);
      this._redraw();

      copyCtx.translate(m * bounds.min.x, m * bounds.min.y);
      copyCtx.drawImage(this._container, 0, 0);
      this._initPath(layer);

      // avoid flickering because of the 'mouseover's
      layer._containsPoint_ = layer._containsPoint;
      layer._containsPoint  = TRUE_FN;
    }

    ctx.save();
    ctx.clearRect(pos.x, pos.y, size.x * m, size.y * m);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.restore();
    ctx.save();

    ctx.drawImage(this._containerCopy, 0, 0, size.x, size.y);
    ctx.transform.apply(ctx, matrix);

    // now draw one layer only
    this._drawing = true;
    layer._updatePath();
    this._drawing = false;

    ctx.restore();
  }

});

},{}],4:[function(require,module,exports){
var END = {
  mousedown:     'mouseup',
  touchstart:    'touchend',
  pointerdown:   'touchend',
  MSPointerDown: 'touchend'
};

var MOVE = {
  mousedown:     'mousemove',
  touchstart:    'touchmove',
  pointerdown:   'touchmove',
  MSPointerDown: 'touchmove'
};

function distance(a, b) {
  var dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Drag handler
 * @class L.Path.Drag
 * @extends {L.Handler}
 */
L.Handler.PathDrag = L.Handler.extend( /** @lends  L.Path.Drag.prototype */ {

  statics: {
    DRAGGING_CLS: 'leaflet-path-draggable',
  },


  /**
   * @param  {L.Path} path
   * @constructor
   */
  initialize: function(path) {

    /**
     * @type {L.Path}
     */
    this._path = path;

    /**
     * @type {Array.<Number>}
     */
    this._matrix = null;

    /**
     * @type {L.Point}
     */
    this._startPoint = null;

    /**
     * @type {L.Point}
     */
    this._dragStartPoint = null;

    /**
     * @type {Boolean}
     */
    this._mapDraggingWasEnabled = false;

  },

  /**
   * Enable dragging
   */
  addHooks: function() {
    this._path.on('mousedown', this._onDragStart, this);

    this._path.options.className = this._path.options.className ?
        (this._path.options.className + ' ' + L.Handler.PathDrag.DRAGGING_CLS) :
         L.Handler.PathDrag.DRAGGING_CLS;

    if (this._path._path) {
      L.DomUtil.addClass(this._path._path, L.Handler.PathDrag.DRAGGING_CLS);
    }
  },

  /**
   * Disable dragging
   */
  removeHooks: function() {
    this._path.off('mousedown', this._onDragStart, this);

    this._path.options.className = this._path.options.className
      .replace(new RegExp('\\s+' + L.Handler.PathDrag.DRAGGING_CLS), '');
    if (this._path._path) {
      L.DomUtil.removeClass(this._path._path, L.Handler.PathDrag.DRAGGING_CLS);
    }
  },

  /**
   * @return {Boolean}
   */
  moved: function() {
    return this._path._dragMoved;
  },

  /**
   * Start drag
   * @param  {L.MouseEvent} evt
   */
  _onDragStart: function(evt) {
    var eventType = evt.originalEvent._simulated ? 'touchstart' : evt.originalEvent.type;

    this._mapDraggingWasEnabled = false;
    this._startPoint = evt.containerPoint.clone();
    this._dragStartPoint = evt.containerPoint.clone();
    this._matrix = [1, 0, 0, 1, 0, 0];
    L.DomEvent.stop(evt.originalEvent);

    L.DomUtil.addClass(this._path._renderer._container, 'leaflet-interactive');
    L.DomEvent
      .on(document, MOVE[eventType], this._onDrag,    this)
      .on(document, END[eventType],  this._onDragEnd, this);

    if (this._path._map.dragging.enabled()) {
      // I guess it's required because mousdown gets simulated with a delay
      //this._path._map.dragging._draggable._onUp(evt);

      this._path._map.dragging.disable();
      this._mapDraggingWasEnabled = true;
    }
    this._path._dragMoved = false;

    if (this._path._popup) { // that might be a case on touch devices as well
      this._path._popup._close();
    }

    this._replaceCoordGetters(evt);
  },

  /**
   * Dragging
   * @param  {L.MouseEvent} evt
   */
  _onDrag: function(evt) {
    L.DomEvent.stop(evt);

    var first = (evt.touches && evt.touches.length >= 1 ? evt.touches[0] : evt);
    var containerPoint = this._path._map.mouseEventToContainerPoint(first);

    // skip taps
    if (evt.type === 'touchmove' && !this._path._dragMoved) {
      var totalMouseDragDistance = this._dragStartPoint.distanceTo(containerPoint);
      if (totalMouseDragDistance <= this._path._map.options.tapTolerance) {
        return;
      }
    }

    var x = containerPoint.x;
    var y = containerPoint.y;

    var dx = x - this._startPoint.x;
    var dy = y - this._startPoint.y;

    // Send events only if point was moved
    if (dx || dy) {
      if (!this._path._dragMoved) {
        this._path._dragMoved = true;
        this._path.fire('dragstart', evt);
        // we don't want that to happen on click
        this._path.bringToFront();
      }

      this._matrix[4] += dx;
      this._matrix[5] += dy;

      this._startPoint.x = x;
      this._startPoint.y = y;

      this._path.fire('predrag', evt);
      this._path._transform(this._matrix);
      this._path.fire('drag', evt);
    }
  },

  /**
   * Dragging stopped, apply
   * @param  {L.MouseEvent} evt
   */
  _onDragEnd: function(evt) {
    var containerPoint = this._path._map.mouseEventToContainerPoint(evt);
    var moved = this.moved();

    // apply matrix
    if (moved) {
      this._transformPoints(this._matrix);
      this._path._updatePath();
      this._path._project();
      this._path._transform(null);

      L.DomEvent.stop(evt);
    }


    L.DomEvent.off(document, 'mousemove touchmove', this._onDrag,    this);
    L.DomEvent.off(document, 'mouseup touchend',    this._onDragEnd, this);

    this._restoreCoordGetters();

    // consistency
    if (moved) {
      this._path.fire('dragend', {
        distance: distance(this._dragStartPoint, containerPoint)
      });

      // hack for skipping the click in canvas-rendered layers
      var contains = this._path._containsPoint;
      this._path._containsPoint = L.Util.falseFn;
      L.Util.requestAnimFrame(function() {
        L.DomEvent.skipped({ type: 'click' });
        this._path._containsPoint = contains;
      }, this);
    }

    this._matrix          = null;
    this._startPoint      = null;
    this._dragStartPoint  = null;
    this._path._dragMoved = false;

    if (this._mapDraggingWasEnabled) {
      if (moved) L.DomEvent.fakeStop({ type: 'click' });
      this._path._map.dragging.enable();
    }
  },


  /**
   * Applies transformation, does it in one sweep for performance,
   * so don't be surprised about the code repetition.
   *
   * [ x ]   [ a  b  tx ] [ x ]   [ a * x + b * y + tx ]
   * [ y ] = [ c  d  ty ] [ y ] = [ c * x + d * y + ty ]
   *
   * @param {Array.<Number>} matrix
   */
  _transformPoints: function(matrix, dest) {
    var path = this._path;
    var i, len, latlng;

    var px = L.point(matrix[4], matrix[5]);

    var crs = path._map.options.crs;
    var transformation = crs.transformation;
    var scale = crs.scale(path._map.getZoom());
    var projection = crs.projection;

    var diff = transformation.untransform(px, scale)
      .subtract(transformation.untransform(L.point(0, 0), scale));
    var applyTransform = !dest;

    path._bounds = new L.LatLngBounds();

    // console.time('transform');
    // all shifts are in-place
    if (path._point) { // L.Circle
      dest = projection.unproject(
        projection.project(path._latlng)._add(diff));
      if (applyTransform) {
        path._latlng = dest;
        path._point._add(px);
      }
    } else if (path._rings || path._parts) { // everything else
      var rings   = path._rings || path._parts;
      var latlngs = path._latlngs;
      dest = dest || latlngs;
      if (!L.Util.isArray(latlngs[0])) { // polyline
        latlngs = [latlngs];
        dest    = [dest];
      }
      for (i = 0, len = rings.length; i < len; i++) {
        dest[i] = dest[i] || [];
        for (var j = 0, jj = rings[i].length; j < jj; j++) {
          latlng     = latlngs[i][j];
          dest[i][j] = projection
            .unproject(projection.project(latlng)._add(diff));
          if (applyTransform) {
            path._bounds.extend(latlngs[i][j]);
            rings[i][j]._add(px);
          }
        }
      }
    }
    return dest;
    // console.timeEnd('transform');
  },



  /**
   * If you want to read the latlngs during the drag - your right,
   * but they have to be transformed
   */
  _replaceCoordGetters: function() {
    if (this._path.getLatLng) { // Circle, CircleMarker
      this._path.getLatLng_ = this._path.getLatLng;
      this._path.getLatLng = L.Util.bind(function() {
        return this.dragging._transformPoints(this.dragging._matrix, {});
      }, this._path);
    } else if (this._path.getLatLngs) {
      this._path.getLatLngs_ = this._path.getLatLngs;
      this._path.getLatLngs = L.Util.bind(function() {
        return this.dragging._transformPoints(this.dragging._matrix, []);
      }, this._path);
    }
  },


  /**
   * Put back the getters
   */
  _restoreCoordGetters: function() {
    if (this._path.getLatLng_) {
      this._path.getLatLng = this._path.getLatLng_;
      delete this._path.getLatLng_;
    } else if (this._path.getLatLngs_) {
      this._path.getLatLngs = this._path.getLatLngs_;
      delete this._path.getLatLngs_;
    }
  }

});


/**
 * @param  {L.Path} layer
 * @return {L.Path}
 */
L.Handler.PathDrag.makeDraggable = function(layer) {
  layer.dragging = new L.Handler.PathDrag(layer);
  return layer;
};


/**
 * Also expose as a method
 * @return {L.Path}
 */
L.Path.prototype.makeDraggable = function() {
  return L.Handler.PathDrag.makeDraggable(this);
};


L.Path.addInitHook(function() {
  if (this.options.draggable) {
    // ensure interactive
    this.options.interactive = true;

    if (this.dragging) {
      this.dragging.enable();
    } else {
      L.Handler.PathDrag.makeDraggable(this);
      this.dragging.enable();
    }
  } else if (this.dragging) {
    this.dragging.disable();
  }
});

},{}],5:[function(require,module,exports){
/**
 * Leaflet vector features drag functionality
 * @author Alexander Milevski <info@w8r.name>
 * @preserve
 */

/**
 * Matrix transform path for SVG/VML
 * Renderer-independent
 */
L.Path.include({

	/**
	 * Applies matrix transformation to SVG
	 * @param {Array.<Number>?} matrix
	 */
	_transform: function(matrix) {
		if (this._renderer) {
			if (matrix) {
				this._renderer.transformPath(this, matrix);
			} else {
				// reset transform matrix
				this._renderer._resetTransformPath(this);
				this._update();
			}
		}
		return this;
	},

	/**
	 * Check if the feature was dragged, that'll supress the click event
	 * on mouseup. That fixes popups for example
	 *
	 * @param  {MouseEvent} e
	 */
	_onMouseClick: function(e) {
		if ((this.dragging && this.dragging.moved()) ||
			(this._map.dragging && this._map.dragging.moved())) {
			return;
		}

		this._fireMouseEvent(e);
	}

});

},{}],6:[function(require,module,exports){
L.SVG.include(!L.Browser.vml ? {} : {

	/**
	 * Reset transform matrix
	 */
	_resetTransformPath: function(layer) {
		if (layer._skew) {
			// super important! workaround for a 'jumping' glitch:
			// disable transform before removing it
			layer._skew.on = false;
			layer._path.removeChild(layer._skew);
			layer._skew = null;
		}
	},

	/**
	 * Applies matrix transformation to VML
	 * @param {L.Path}         layer
	 * @param {Array.<Number>} matrix
	 */
	transformPath: function(layer, matrix) {
		var skew = layer._skew;

		if (!skew) {
			skew = L.SVG.create('skew');
			layer._path.appendChild(skew);
			skew.style.behavior = 'url(#default#VML)';
			layer._skew = skew;
		}

		// handle skew/translate separately, cause it's broken
		var mt = matrix[0].toFixed(8) + ' ' + matrix[1].toFixed(8) + ' ' +
			matrix[2].toFixed(8) + ' ' + matrix[3].toFixed(8) + ' 0 0';
		var offset = Math.floor(matrix[4]).toFixed() + ', ' +
			Math.floor(matrix[5]).toFixed() + '';

		var s = this._path.style;
		var l = parseFloat(s.left);
		var t = parseFloat(s.top);
		var w = parseFloat(s.width);
		var h = parseFloat(s.height);

		if (isNaN(l))       l = 0;
		if (isNaN(t))       t = 0;
		if (isNaN(w) || !w) w = 1;
		if (isNaN(h) || !h) h = 1;

		var origin = (-l / w - 0.5).toFixed(8) + ' ' + (-t / h - 0.5).toFixed(8);

		skew.on = 'f';
		skew.matrix = mt;
		skew.origin = origin;
		skew.offset = offset;
		skew.on = true;
	}

});

},{}],7:[function(require,module,exports){
L.SVG.include({

	/**
	 * Reset transform matrix
	 */
	_resetTransformPath: function(layer) {
		layer._path.setAttributeNS(null, 'transform', '');
	},

	/**
	 * Applies matrix transformation to SVG
	 * @param {L.Path}         layer
	 * @param {Array.<Number>} matrix
	 */
	transformPath: function(layer, matrix) {
		layer._path.setAttributeNS(null, 'transform',
			'matrix(' + matrix.join(' ') + ')');
	}

});

},{}],8:[function(require,module,exports){
(function (global){
"use strict";

var L = typeof window !== "undefined" ? window['L'] : typeof global !== "undefined" ? global['L'] : null;

var Circle = L.CircleMarker.extend({

  options: {
    textStyle: {
      color: '#fff',
      fontSize: 12,
      fontWeight: 300
    },
    shiftY: 7
  },

  /**
   * @class LabeledCircle
   * @constructor
   * @extends {L.CircleMarker}
   * @param  {String}   text
   * @param  {L.LatLng} latlng
   * @param  {Object=}  options
   */
  initialize: function initialize(text, latlng, options) {
    /**
     * @type {String}
     */
    this._text = text;

    /**
     * @type {SVGTextElement}
     */
    this._textElement = null;

    /**
     * @type {TextNode}
     */
    this._textNode = null;

    /**
     * @type {Object|Null}
     */
    this._textLayer = null;

    L.CircleMarker.prototype.initialize.call(this, latlng, options);
  },


  /**
   * @param {String} text
   * @return {LabeledCircle}
   */
  setText: function setText(text) {
    this._text = text;
    if (this._textNode) {
      this._textElement.removeChild(this._textNode);
    }
    this._textNode = document.createTextNode(this._text);
    this._textElement.appendChild(this._textNode);

    return this;
  },


  /**
   * @return {String}
   */
  getText: function getText() {
    return this._text;
  },


  /**
   * Also bring text to front
   * @override
   */
  bringToFront: function bringToFront() {
    L.CircleMarker.prototype.bringToFront.call(this);
    this._groupTextToPath();
  },


  /**
   * @override
   */
  bringToBack: function bringToBack() {
    L.CircleMarker.prototype.bringToBack.call(this);
    this._groupTextToPath();
  },


  /**
   * Put text in the right position in the dom
   */
  _groupTextToPath: function _groupTextToPath() {
    var path = this._path;
    var textElement = this._textElement;
    var next = path.nextSibling;
    var parent = path.parentNode;

    if (textElement && parent) {
      if (next && next !== textElement) {
        parent.insertBefore(textElement, next);
      } else {
        parent.appendChild(textElement);
      }
    }
  },


  /**
   * Position the text in container
   */
  _updatePath: function _updatePath() {
    L.CircleMarker.prototype._updatePath.call(this);
    this._updateTextPosition();
  },


  /**
   * @override
   */
  _transform: function _transform(matrix) {
    L.CircleMarker.prototype._transform.call(this, matrix);

    // wrap textElement with a fake layer for renderer
    // to be able to transform it
    this._textLayer = this._textLayer || { _path: this._textElement };
    if (matrix) {
      this._renderer.transformPath(this._textLayer, matrix);
    } else {
      this._renderer._resetTransformPath(this._textLayer);
      this._updateTextPosition();
      this._textLayer = null;
    }
  },


  /**
   * @param  {L.Map} map
   * @return {LabeledCircle}
   */
  onAdd: function onAdd(map) {
    L.CircleMarker.prototype.onAdd.call(this, map);
    this._initText();
    this._updateTextPosition();
    this.setStyle({});
    return this;
  },


  /**
   * Create and insert text
   */
  _initText: function _initText() {
    this._textElement = L.SVG.create('text');
    this.setText(this._text);
    this._renderer._rootGroup.appendChild(this._textElement);
  },


  /**
   * Calculate position for text
   */
  _updateTextPosition: function _updateTextPosition() {
    var textElement = this._textElement;
    if (textElement) {
      var bbox = textElement.getBBox();
      var textPosition = this._point.subtract(L.point(bbox.width, -bbox.height + this.options.shiftY).divideBy(2));

      textElement.setAttribute('x', textPosition.x);
      textElement.setAttribute('y', textPosition.y);
      this._groupTextToPath();
    }
  },


  /**
   * Set text style
   */
  setStyle: function setStyle(style) {
    L.CircleMarker.prototype.setStyle.call(this, style);
    if (this._textElement) {
      var styles = this.options.textStyle;
      for (var prop in styles) {
        if (styles.hasOwnProperty(prop)) {
          var styleProp = prop;
          if (prop === 'color') {
            styleProp = 'stroke';
          }
          this._textElement.style[styleProp] = styles[prop];
        }
      }
    }
  },


  /**
   * Remove text
   */
  onRemove: function onRemove(map) {
    if (this._textElement) {
      if (this._textElement.parentNode) {
        this._textElement.parentNode.removeChild(this._textElement);
      }
      this._textElement = null;
      this._textNode = null;
      this._textLayer = null;
    }

    return L.CircleMarker.prototype.onRemove.call(this, map);
  }
});

module.exports = L.TextCircle = Circle;
L.textCircle = function (text, latlng, options) {
  return new Circle(text, latlng, options);
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],9:[function(require,module,exports){
(function (global){
"use strict";

var L = typeof window !== "undefined" ? window['L'] : typeof global !== "undefined" ? global['L'] : null;
var Circle = require('./circle');
require('leaflet-path-drag');

var LabeledMarker = L.FeatureGroup.extend({

  options: {

    /**
     * @param  {LabeledMarker} marker
     * @param  {Object}        feature
     * @return {String}
     */
    getLabelText: function getLabelText(marker, feature) {
      return feature.properties.text;
    },

    /**
     * @param  {LabeledMarker} marker
     * @param  {Object}        feature
     * @param  {L.LatLng}      latlng
     * @return {L.LatLng}
     */
    getLabelPosition: function getLabelPosition(marker, feature, latlng) {
      return feature.properties.labelPosition ? L.latLng(feature.properties.labelPosition.slice().reverse()) : latlng;
    },

    labelPositionKey: 'labelPosition',

    markerOptions: {
      color: '#f00',
      fillOpacity: 0.75,
      draggable: true,
      radius: 15
    },

    anchorOptions: {
      color: '#00f',
      radius: 3
    },

    lineOptions: {
      color: '#f00',
      dashArray: [2, 6],
      lineCap: 'square',
      weight: 2
    }

  },

  /**
   * @class LabeledMarker
   * @constructor
   * @extends {L.FeatureGroup}
   *
   * @param  {L.LatLng} latlng
   * @param  {Object=}  feature
   * @param  {Object=}  options
   */
  initialize: function initialize(latlng, feature, options) {
    L.Util.setOptions(this, options);

    /**
     * @type {Object}
     */
    this.feature = feature || {
      type: 'Feature',
      properties: {},
      geometry: {
        'type': 'Point'
      }
    };

    /**
     * @type {L.LatLng}
     */
    this._latlng = latlng;

    /**
     * @type {CircleLabel}
     */
    this._marker = null;

    /**
     * @type {L.CircleMarker}
     */
    this._anchor = null;

    /**
     * @type {L.Polyline}
     */
    this._line = null;

    /**
     * @type {L.Point}
     */
    this._initialDistance = null;

    this._createLayers();
    L.LayerGroup.prototype.initialize.call(this, [this._anchor, this._line, this._marker]);
  },


  /**
   * @return {L.LatLng}
   */
  getLabelPosition: function getLabelPosition() {
    return this._marker.getLatLng();
  },


  /**
   * @return {L.LatLng}
   */
  getLatLng: function getLatLng() {
    return this._latlng;
  },


  /**
   * Serialize
   * @return {Object}
   */
  toGeoJSON: function toGeoJSON(geometryCollection) {
    var feature = L.GeoJSON.getFeature(this, {
      type: 'Point',
      coordinates: L.GeoJSON.latLngToCoords(this._anchor.getLatLng())
    });
    feature.properties[this.options.labelPositionKey] = L.GeoJSON.latLngToCoords(this._marker.getLatLng());
    feature.properties.text = this._marker.getText();
    return geometryCollection ? L.LabeledCircleMarker.toGeometryCollection(feature, this.options.labelPositionKey) : feature;
  },


  /**
   * @param {String} text
   * @return {LabeledMarker}
   */
  setText: function setText(text) {
    this._marker.setText(text);
    return this;
  },


  /**
   * Creates anchor, line and label
   */
  _createLayers: function _createLayers() {
    var opts = this.options;
    var pos = opts.getLabelPosition(this, this.feature, this._latlng);
    var text = opts.getLabelText(this, this.feature);

    if ('draggable' in opts) {
      opts.markerOptions.draggable = opts.draggable;
    }

    this._marker = new Circle(text, pos, L.Util.extend({
      interactive: this.options.interactive
    }, LabeledMarker.prototype.options.markerOptions, opts.markerOptions)).on('drag', this._onMarkerDrag, this).on('dragstart', this._onMarkerDragStart, this).on('dragend', this._onMarkerDragEnd, this);

    this._anchor = new L.CircleMarker(this._latlng, L.Util.extend({}, LabeledMarker.prototype.options.anchorOptions, opts.anchorOptions));

    this._line = new L.Polyline([this._latlng, this._marker.getLatLng()], L.Util.extend({}, LabeledMarker.prototype.options.lineOptions, opts.lineOptions));
  },


  /**
   * Store shift to be precise while dragging
   * @param  {Event} evt
   */
  _onMarkerDragStart: function _onMarkerDragStart(evt) {
    this._initialDistance = L.DomEvent.getMousePosition(evt).subtract(this._map.latLngToContainerPoint(this._marker.getLatLng()));
    this.fire('label:' + evt.type, evt);
    //L.Util.requestAnimFrame(this._marker.bringToFront, this._marker);
  },


  /**
   * Line dragging
   * @param  {DragEvent} evt
   */
  _onMarkerDrag: function _onMarkerDrag(evt) {
    var latlng = this._map.containerPointToLatLng(L.DomEvent.getMousePosition(evt)._subtract(this._initialDistance));
    this._line.setLatLngs([latlng, this._latlng]);
    this.fire('label:' + evt.type, evt);
  },
  _onMarkerDragEnd: function _onMarkerDragEnd(evt) {
    this._line.setLatLngs([this._marker.getLatLng(), this._latlng]);
    this.fire('label:' + evt.type, evt);
  },
  enableDragging: function enableDragging() {
    if (this._marker.dragging) this._marker.dragging.enable();
    return this;
  },
  disableDragging: function disableDragging() {
    if (this._marker.dragging) this._marker.dragging.disable();
    return this;
  }
});

/**
 * @param  {Object} feature
 * @param  {String=} key
 * @return {Object}
 */
function toGeometryCollection(feature, key) {
  key = key || 'labelPosition';
  var anchorPos = feature.geometry.coordinates.slice();
  var labelPos = feature.properties[key];

  if (!labelPos) throw new Error('No label position set');

  labelPos = labelPos.slice();
  var geometries = [{
    type: 'Point',
    coordinates: anchorPos
  }, {
    type: 'LineString',
    coordinates: [anchorPos.slice(), labelPos]
  }, {
    type: 'Point',
    coordinates: labelPos.slice()
  }, {
    type: 'Point',
    coordinates: labelPos.slice()
  }];

  return {
    type: 'Feature',
    properties: L.Util.extend({}, feature.properties, {
      geometriesTypes: ['anchor', 'connection', 'label', 'textbox']
    }),
    bbox: feature.bbox,
    geometry: {
      type: 'GeometryCollection',
      geometries: geometries
    }
  };
}

LabeledMarker.toGeometryCollection = toGeometryCollection;

L.LabeledCircleMarker = LabeledMarker;
L.labeledCircleMarker = function (latlng, feature, options) {
  return new LabeledMarker(latlng, feature, options);
};

module.exports = LabeledMarker;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./circle":8,"leaflet-path-drag":2}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9sZWFmbGV0LXBhdGgtZHJhZy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9sZWFmbGV0LXBhdGgtZHJhZy9zcmMvQ2FudmFzLmpzIiwibm9kZV9tb2R1bGVzL2xlYWZsZXQtcGF0aC1kcmFnL3NyYy9QYXRoLkRyYWcuanMiLCJub2RlX21vZHVsZXMvbGVhZmxldC1wYXRoLWRyYWcvc3JjL1BhdGguVHJhbnNmb3JtLmpzIiwibm9kZV9tb2R1bGVzL2xlYWZsZXQtcGF0aC1kcmFnL3NyYy9TVkcuVk1MLmpzIiwibm9kZV9tb2R1bGVzL2xlYWZsZXQtcGF0aC1kcmFnL3NyYy9TVkcuanMiLCJzcmMvY2lyY2xlLmpzIiwic3JjL21hcmtlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O0FDQUE7Ozs7Ozs7QUFPQSxPQUFPLE9BQVAsR0FBaUIsUUFBUSxjQUFSLENBQWpCOzs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFD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VTtBQUNSLFlBQU0sb0JBREU7QUFFUixrQkFBWTtBQUZKO0FBTkwsR0FBUDtBQVdEOztBQUVELGNBQWMsb0JBQWQsR0FBcUMsb0JBQXJDOztBQUVBLEVBQUUsbUJBQUYsR0FBd0IsYUFBeEI7QUFDQSxFQUFFLG1CQUFGLEdBQXdCLFVBQUMsTUFBRCxFQUFTLE9BQVQsRUFBa0IsT0FBbEIsRUFBOEI7QUFDcEQsU0FBTyxJQUFJLGFBQUosQ0FBa0IsTUFBbEIsRUFBMEIsT0FBMUIsRUFBbUMsT0FBbkMsQ0FBUDtBQUNELENBRkQ7O0FBSUEsT0FBTyxPQUFQLEdBQWlCLGFBQWpCIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc31yZXR1cm4gZX0pKCkiLCIvKipcbiAqIExlYWZsZXQgU1ZHIGNpcmNsZSBtYXJrZXIgd2l0aCBkZXRhY2hhYmxlIGFuZCBkcmFnZ2FibGUgbGFiZWwgYW5kIHRleHRcbiAqXG4gKiBAYXV0aG9yIEFsZXhhbmRlciBNaWxldnNraSA8aW5mb0B3OHIubmFtZT5cbiAqIEBsaWNlbnNlIE1JVFxuICogQHByZXNlcnZlXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9zcmMvbWFya2VyJyk7XG4iLCJyZXF1aXJlKCcuL3NyYy9TVkcnKTtcbnJlcXVpcmUoJy4vc3JjL1NWRy5WTUwnKTtcbnJlcXVpcmUoJy4vc3JjL0NhbnZhcycpO1xucmVxdWlyZSgnLi9zcmMvUGF0aC5UcmFuc2Zvcm0nKTtcbnJlcXVpcmUoJy4vc3JjL1BhdGguRHJhZycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEwuUGF0aC5EcmFnO1xuIiwiZnVuY3Rpb24gVFJVRV9GTiAoKSB7IHJldHVybiB0cnVlOyB9XG5cbkwuQ2FudmFzLmluY2x1ZGUoe1xuXG4gIC8qKlxuICAgKiBEbyBub3RoaW5nXG4gICAqIEBwYXJhbSAge0wuUGF0aH0gbGF5ZXJcbiAgICovXG4gIF9yZXNldFRyYW5zZm9ybVBhdGg6IGZ1bmN0aW9uKGxheWVyKSB7XG4gICAgaWYgKCF0aGlzLl9jb250YWluZXJDb3B5KSByZXR1cm47XG5cbiAgICBkZWxldGUgdGhpcy5fY29udGFpbmVyQ29weTtcblxuICAgIGlmIChsYXllci5fY29udGFpbnNQb2ludF8pIHtcbiAgICAgIGxheWVyLl9jb250YWluc1BvaW50ID0gbGF5ZXIuX2NvbnRhaW5zUG9pbnRfO1xuICAgICAgZGVsZXRlIGxheWVyLl9jb250YWluc1BvaW50XztcblxuICAgICAgdGhpcy5fcmVxdWVzdFJlZHJhdyhsYXllcik7XG4gICAgfVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIEFsZ29yaXRobSBvdXRsaW5lOlxuICAgKlxuICAgKiAxLiBwcmUtdHJhbnNmb3JtIC0gY2xlYXIgdGhlIHBhdGggb3V0IG9mIHRoZSBjYW52YXMsIGNvcHkgY2FudmFzIHN0YXRlXG4gICAqIDIuIGF0IGV2ZXJ5IGZyYW1lOlxuICAgKiAgICAyLjEuIHNhdmVcbiAgICogICAgMi4yLiByZWRyYXcgdGhlIGNhbnZhcyBmcm9tIHNhdmVkIG9uZVxuICAgKiAgICAyLjMuIHRyYW5zZm9ybVxuICAgKiAgICAyLjQuIGRyYXcgcGF0aFxuICAgKiAgICAyLjUuIHJlc3RvcmVcbiAgICogMy4gUmVwZWF0XG4gICAqXG4gICAqIEBwYXJhbSAge0wuUGF0aH0gICAgICAgICBsYXllclxuICAgKiBAcGFyYW0gIHtBcnJheS48TnVtYmVyPn0gbWF0cml4XG4gICAqL1xuICB0cmFuc2Zvcm1QYXRoOiBmdW5jdGlvbihsYXllciwgbWF0cml4KSB7XG4gICAgdmFyIGNvcHkgICA9IHRoaXMuX2NvbnRhaW5lckNvcHk7XG4gICAgdmFyIGN0eCAgICA9IHRoaXMuX2N0eCwgY29weUN0eDtcbiAgICB2YXIgbSAgICAgID0gTC5Ccm93c2VyLnJldGluYSA/IDIgOiAxO1xuICAgIHZhciBib3VuZHMgPSB0aGlzLl9ib3VuZHM7XG4gICAgdmFyIHNpemUgICA9IGJvdW5kcy5nZXRTaXplKCk7XG4gICAgdmFyIHBvcyAgICA9IGJvdW5kcy5taW47XG5cbiAgICBpZiAoIWNvcHkpIHsgLy8gZ2V0IGNvcHkgb2YgYWxsIHJlbmRlcmVkIGxheWVyc1xuICAgICAgY29weSA9IHRoaXMuX2NvbnRhaW5lckNvcHkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTtcbiAgICAgIGNvcHlDdHggPSBjb3B5LmdldENvbnRleHQoJzJkJyk7XG4gICAgICAvLyBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGNvcHkpO1xuXG4gICAgICBjb3B5LndpZHRoICA9IG0gKiBzaXplLng7XG4gICAgICBjb3B5LmhlaWdodCA9IG0gKiBzaXplLnk7XG5cbiAgICAgIHRoaXMuX3JlbW92ZVBhdGgobGF5ZXIpO1xuICAgICAgdGhpcy5fcmVkcmF3KCk7XG5cbiAgICAgIGNvcHlDdHgudHJhbnNsYXRlKG0gKiBib3VuZHMubWluLngsIG0gKiBib3VuZHMubWluLnkpO1xuICAgICAgY29weUN0eC5kcmF3SW1hZ2UodGhpcy5fY29udGFpbmVyLCAwLCAwKTtcbiAgICAgIHRoaXMuX2luaXRQYXRoKGxheWVyKTtcblxuICAgICAgLy8gYXZvaWQgZmxpY2tlcmluZyBiZWNhdXNlIG9mIHRoZSAnbW91c2VvdmVyJ3NcbiAgICAgIGxheWVyLl9jb250YWluc1BvaW50XyA9IGxheWVyLl9jb250YWluc1BvaW50O1xuICAgICAgbGF5ZXIuX2NvbnRhaW5zUG9pbnQgID0gVFJVRV9GTjtcbiAgICB9XG5cbiAgICBjdHguc2F2ZSgpO1xuICAgIGN0eC5jbGVhclJlY3QocG9zLngsIHBvcy55LCBzaXplLnggKiBtLCBzaXplLnkgKiBtKTtcbiAgICBjdHguc2V0VHJhbnNmb3JtKDEsIDAsIDAsIDEsIDAsIDApO1xuICAgIGN0eC5yZXN0b3JlKCk7XG4gICAgY3R4LnNhdmUoKTtcblxuICAgIGN0eC5kcmF3SW1hZ2UodGhpcy5fY29udGFpbmVyQ29weSwgMCwgMCwgc2l6ZS54LCBzaXplLnkpO1xuICAgIGN0eC50cmFuc2Zvcm0uYXBwbHkoY3R4LCBtYXRyaXgpO1xuXG4gICAgLy8gbm93IGRyYXcgb25lIGxheWVyIG9ubHlcbiAgICB0aGlzLl9kcmF3aW5nID0gdHJ1ZTtcbiAgICBsYXllci5fdXBkYXRlUGF0aCgpO1xuICAgIHRoaXMuX2RyYXdpbmcgPSBmYWxzZTtcblxuICAgIGN0eC5yZXN0b3JlKCk7XG4gIH1cblxufSk7XG4iLCJ2YXIgRU5EID0ge1xuICBtb3VzZWRvd246ICAgICAnbW91c2V1cCcsXG4gIHRvdWNoc3RhcnQ6ICAgICd0b3VjaGVuZCcsXG4gIHBvaW50ZXJkb3duOiAgICd0b3VjaGVuZCcsXG4gIE1TUG9pbnRlckRvd246ICd0b3VjaGVuZCdcbn07XG5cbnZhciBNT1ZFID0ge1xuICBtb3VzZWRvd246ICAgICAnbW91c2Vtb3ZlJyxcbiAgdG91Y2hzdGFydDogICAgJ3RvdWNobW92ZScsXG4gIHBvaW50ZXJkb3duOiAgICd0b3VjaG1vdmUnLFxuICBNU1BvaW50ZXJEb3duOiAndG91Y2htb3ZlJ1xufTtcblxuZnVuY3Rpb24gZGlzdGFuY2UoYSwgYikge1xuICB2YXIgZHggPSBhLnggLSBiLngsIGR5ID0gYS55IC0gYi55O1xuICByZXR1cm4gTWF0aC5zcXJ0KGR4ICogZHggKyBkeSAqIGR5KTtcbn1cblxuLyoqXG4gKiBEcmFnIGhhbmRsZXJcbiAqIEBjbGFzcyBMLlBhdGguRHJhZ1xuICogQGV4dGVuZHMge0wuSGFuZGxlcn1cbiAqL1xuTC5IYW5kbGVyLlBhdGhEcmFnID0gTC5IYW5kbGVyLmV4dGVuZCggLyoqIEBsZW5kcyAgTC5QYXRoLkRyYWcucHJvdG90eXBlICovIHtcblxuICBzdGF0aWNzOiB7XG4gICAgRFJBR0dJTkdfQ0xTOiAnbGVhZmxldC1wYXRoLWRyYWdnYWJsZScsXG4gIH0sXG5cblxuICAvKipcbiAgICogQHBhcmFtICB7TC5QYXRofSBwYXRoXG4gICAqIEBjb25zdHJ1Y3RvclxuICAgKi9cbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24ocGF0aCkge1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuUGF0aH1cbiAgICAgKi9cbiAgICB0aGlzLl9wYXRoID0gcGF0aDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtBcnJheS48TnVtYmVyPn1cbiAgICAgKi9cbiAgICB0aGlzLl9tYXRyaXggPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuUG9pbnR9XG4gICAgICovXG4gICAgdGhpcy5fc3RhcnRQb2ludCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TC5Qb2ludH1cbiAgICAgKi9cbiAgICB0aGlzLl9kcmFnU3RhcnRQb2ludCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Qm9vbGVhbn1cbiAgICAgKi9cbiAgICB0aGlzLl9tYXBEcmFnZ2luZ1dhc0VuYWJsZWQgPSBmYWxzZTtcblxuICB9LFxuXG4gIC8qKlxuICAgKiBFbmFibGUgZHJhZ2dpbmdcbiAgICovXG4gIGFkZEhvb2tzOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLl9wYXRoLm9uKCdtb3VzZWRvd24nLCB0aGlzLl9vbkRyYWdTdGFydCwgdGhpcyk7XG5cbiAgICB0aGlzLl9wYXRoLm9wdGlvbnMuY2xhc3NOYW1lID0gdGhpcy5fcGF0aC5vcHRpb25zLmNsYXNzTmFtZSA/XG4gICAgICAgICh0aGlzLl9wYXRoLm9wdGlvbnMuY2xhc3NOYW1lICsgJyAnICsgTC5IYW5kbGVyLlBhdGhEcmFnLkRSQUdHSU5HX0NMUykgOlxuICAgICAgICAgTC5IYW5kbGVyLlBhdGhEcmFnLkRSQUdHSU5HX0NMUztcblxuICAgIGlmICh0aGlzLl9wYXRoLl9wYXRoKSB7XG4gICAgICBMLkRvbVV0aWwuYWRkQ2xhc3ModGhpcy5fcGF0aC5fcGF0aCwgTC5IYW5kbGVyLlBhdGhEcmFnLkRSQUdHSU5HX0NMUyk7XG4gICAgfVxuICB9LFxuXG4gIC8qKlxuICAgKiBEaXNhYmxlIGRyYWdnaW5nXG4gICAqL1xuICByZW1vdmVIb29rczogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5fcGF0aC5vZmYoJ21vdXNlZG93bicsIHRoaXMuX29uRHJhZ1N0YXJ0LCB0aGlzKTtcblxuICAgIHRoaXMuX3BhdGgub3B0aW9ucy5jbGFzc05hbWUgPSB0aGlzLl9wYXRoLm9wdGlvbnMuY2xhc3NOYW1lXG4gICAgICAucmVwbGFjZShuZXcgUmVnRXhwKCdcXFxccysnICsgTC5IYW5kbGVyLlBhdGhEcmFnLkRSQUdHSU5HX0NMUyksICcnKTtcbiAgICBpZiAodGhpcy5fcGF0aC5fcGF0aCkge1xuICAgICAgTC5Eb21VdGlsLnJlbW92ZUNsYXNzKHRoaXMuX3BhdGguX3BhdGgsIEwuSGFuZGxlci5QYXRoRHJhZy5EUkFHR0lOR19DTFMpO1xuICAgIH1cbiAgfSxcblxuICAvKipcbiAgICogQHJldHVybiB7Qm9vbGVhbn1cbiAgICovXG4gIG1vdmVkOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fcGF0aC5fZHJhZ01vdmVkO1xuICB9LFxuXG4gIC8qKlxuICAgKiBTdGFydCBkcmFnXG4gICAqIEBwYXJhbSAge0wuTW91c2VFdmVudH0gZXZ0XG4gICAqL1xuICBfb25EcmFnU3RhcnQ6IGZ1bmN0aW9uKGV2dCkge1xuICAgIHZhciBldmVudFR5cGUgPSBldnQub3JpZ2luYWxFdmVudC5fc2ltdWxhdGVkID8gJ3RvdWNoc3RhcnQnIDogZXZ0Lm9yaWdpbmFsRXZlbnQudHlwZTtcblxuICAgIHRoaXMuX21hcERyYWdnaW5nV2FzRW5hYmxlZCA9IGZhbHNlO1xuICAgIHRoaXMuX3N0YXJ0UG9pbnQgPSBldnQuY29udGFpbmVyUG9pbnQuY2xvbmUoKTtcbiAgICB0aGlzLl9kcmFnU3RhcnRQb2ludCA9IGV2dC5jb250YWluZXJQb2ludC5jbG9uZSgpO1xuICAgIHRoaXMuX21hdHJpeCA9IFsxLCAwLCAwLCAxLCAwLCAwXTtcbiAgICBMLkRvbUV2ZW50LnN0b3AoZXZ0Lm9yaWdpbmFsRXZlbnQpO1xuXG4gICAgTC5Eb21VdGlsLmFkZENsYXNzKHRoaXMuX3BhdGguX3JlbmRlcmVyLl9jb250YWluZXIsICdsZWFmbGV0LWludGVyYWN0aXZlJyk7XG4gICAgTC5Eb21FdmVudFxuICAgICAgLm9uKGRvY3VtZW50LCBNT1ZFW2V2ZW50VHlwZV0sIHRoaXMuX29uRHJhZywgICAgdGhpcylcbiAgICAgIC5vbihkb2N1bWVudCwgRU5EW2V2ZW50VHlwZV0sICB0aGlzLl9vbkRyYWdFbmQsIHRoaXMpO1xuXG4gICAgaWYgKHRoaXMuX3BhdGguX21hcC5kcmFnZ2luZy5lbmFibGVkKCkpIHtcbiAgICAgIC8vIEkgZ3Vlc3MgaXQncyByZXF1aXJlZCBiZWNhdXNlIG1vdXNkb3duIGdldHMgc2ltdWxhdGVkIHdpdGggYSBkZWxheVxuICAgICAgLy90aGlzLl9wYXRoLl9tYXAuZHJhZ2dpbmcuX2RyYWdnYWJsZS5fb25VcChldnQpO1xuXG4gICAgICB0aGlzLl9wYXRoLl9tYXAuZHJhZ2dpbmcuZGlzYWJsZSgpO1xuICAgICAgdGhpcy5fbWFwRHJhZ2dpbmdXYXNFbmFibGVkID0gdHJ1ZTtcbiAgICB9XG4gICAgdGhpcy5fcGF0aC5fZHJhZ01vdmVkID0gZmFsc2U7XG5cbiAgICBpZiAodGhpcy5fcGF0aC5fcG9wdXApIHsgLy8gdGhhdCBtaWdodCBiZSBhIGNhc2Ugb24gdG91Y2ggZGV2aWNlcyBhcyB3ZWxsXG4gICAgICB0aGlzLl9wYXRoLl9wb3B1cC5fY2xvc2UoKTtcbiAgICB9XG5cbiAgICB0aGlzLl9yZXBsYWNlQ29vcmRHZXR0ZXJzKGV2dCk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIERyYWdnaW5nXG4gICAqIEBwYXJhbSAge0wuTW91c2VFdmVudH0gZXZ0XG4gICAqL1xuICBfb25EcmFnOiBmdW5jdGlvbihldnQpIHtcbiAgICBMLkRvbUV2ZW50LnN0b3AoZXZ0KTtcblxuICAgIHZhciBmaXJzdCA9IChldnQudG91Y2hlcyAmJiBldnQudG91Y2hlcy5sZW5ndGggPj0gMSA/IGV2dC50b3VjaGVzWzBdIDogZXZ0KTtcbiAgICB2YXIgY29udGFpbmVyUG9pbnQgPSB0aGlzLl9wYXRoLl9tYXAubW91c2VFdmVudFRvQ29udGFpbmVyUG9pbnQoZmlyc3QpO1xuXG4gICAgLy8gc2tpcCB0YXBzXG4gICAgaWYgKGV2dC50eXBlID09PSAndG91Y2htb3ZlJyAmJiAhdGhpcy5fcGF0aC5fZHJhZ01vdmVkKSB7XG4gICAgICB2YXIgdG90YWxNb3VzZURyYWdEaXN0YW5jZSA9IHRoaXMuX2RyYWdTdGFydFBvaW50LmRpc3RhbmNlVG8oY29udGFpbmVyUG9pbnQpO1xuICAgICAgaWYgKHRvdGFsTW91c2VEcmFnRGlzdGFuY2UgPD0gdGhpcy5fcGF0aC5fbWFwLm9wdGlvbnMudGFwVG9sZXJhbmNlKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgeCA9IGNvbnRhaW5lclBvaW50Lng7XG4gICAgdmFyIHkgPSBjb250YWluZXJQb2ludC55O1xuXG4gICAgdmFyIGR4ID0geCAtIHRoaXMuX3N0YXJ0UG9pbnQueDtcbiAgICB2YXIgZHkgPSB5IC0gdGhpcy5fc3RhcnRQb2ludC55O1xuXG4gICAgLy8gU2VuZCBldmVudHMgb25seSBpZiBwb2ludCB3YXMgbW92ZWRcbiAgICBpZiAoZHggfHwgZHkpIHtcbiAgICAgIGlmICghdGhpcy5fcGF0aC5fZHJhZ01vdmVkKSB7XG4gICAgICAgIHRoaXMuX3BhdGguX2RyYWdNb3ZlZCA9IHRydWU7XG4gICAgICAgIHRoaXMuX3BhdGguZmlyZSgnZHJhZ3N0YXJ0JywgZXZ0KTtcbiAgICAgICAgLy8gd2UgZG9uJ3Qgd2FudCB0aGF0IHRvIGhhcHBlbiBvbiBjbGlja1xuICAgICAgICB0aGlzLl9wYXRoLmJyaW5nVG9Gcm9udCgpO1xuICAgICAgfVxuXG4gICAgICB0aGlzLl9tYXRyaXhbNF0gKz0gZHg7XG4gICAgICB0aGlzLl9tYXRyaXhbNV0gKz0gZHk7XG5cbiAgICAgIHRoaXMuX3N0YXJ0UG9pbnQueCA9IHg7XG4gICAgICB0aGlzLl9zdGFydFBvaW50LnkgPSB5O1xuXG4gICAgICB0aGlzLl9wYXRoLmZpcmUoJ3ByZWRyYWcnLCBldnQpO1xuICAgICAgdGhpcy5fcGF0aC5fdHJhbnNmb3JtKHRoaXMuX21hdHJpeCk7XG4gICAgICB0aGlzLl9wYXRoLmZpcmUoJ2RyYWcnLCBldnQpO1xuICAgIH1cbiAgfSxcblxuICAvKipcbiAgICogRHJhZ2dpbmcgc3RvcHBlZCwgYXBwbHlcbiAgICogQHBhcmFtICB7TC5Nb3VzZUV2ZW50fSBldnRcbiAgICovXG4gIF9vbkRyYWdFbmQ6IGZ1bmN0aW9uKGV2dCkge1xuICAgIHZhciBjb250YWluZXJQb2ludCA9IHRoaXMuX3BhdGguX21hcC5tb3VzZUV2ZW50VG9Db250YWluZXJQb2ludChldnQpO1xuICAgIHZhciBtb3ZlZCA9IHRoaXMubW92ZWQoKTtcblxuICAgIC8vIGFwcGx5IG1hdHJpeFxuICAgIGlmIChtb3ZlZCkge1xuICAgICAgdGhpcy5fdHJhbnNmb3JtUG9pbnRzKHRoaXMuX21hdHJpeCk7XG4gICAgICB0aGlzLl9wYXRoLl91cGRhdGVQYXRoKCk7XG4gICAgICB0aGlzLl9wYXRoLl9wcm9qZWN0KCk7XG4gICAgICB0aGlzLl9wYXRoLl90cmFuc2Zvcm0obnVsbCk7XG5cbiAgICAgIEwuRG9tRXZlbnQuc3RvcChldnQpO1xuICAgIH1cblxuXG4gICAgTC5Eb21FdmVudC5vZmYoZG9jdW1lbnQsICdtb3VzZW1vdmUgdG91Y2htb3ZlJywgdGhpcy5fb25EcmFnLCAgICB0aGlzKTtcbiAgICBMLkRvbUV2ZW50Lm9mZihkb2N1bWVudCwgJ21vdXNldXAgdG91Y2hlbmQnLCAgICB0aGlzLl9vbkRyYWdFbmQsIHRoaXMpO1xuXG4gICAgdGhpcy5fcmVzdG9yZUNvb3JkR2V0dGVycygpO1xuXG4gICAgLy8gY29uc2lzdGVuY3lcbiAgICBpZiAobW92ZWQpIHtcbiAgICAgIHRoaXMuX3BhdGguZmlyZSgnZHJhZ2VuZCcsIHtcbiAgICAgICAgZGlzdGFuY2U6IGRpc3RhbmNlKHRoaXMuX2RyYWdTdGFydFBvaW50LCBjb250YWluZXJQb2ludClcbiAgICAgIH0pO1xuXG4gICAgICAvLyBoYWNrIGZvciBza2lwcGluZyB0aGUgY2xpY2sgaW4gY2FudmFzLXJlbmRlcmVkIGxheWVyc1xuICAgICAgdmFyIGNvbnRhaW5zID0gdGhpcy5fcGF0aC5fY29udGFpbnNQb2ludDtcbiAgICAgIHRoaXMuX3BhdGguX2NvbnRhaW5zUG9pbnQgPSBMLlV0aWwuZmFsc2VGbjtcbiAgICAgIEwuVXRpbC5yZXF1ZXN0QW5pbUZyYW1lKGZ1bmN0aW9uKCkge1xuICAgICAgICBMLkRvbUV2ZW50LnNraXBwZWQoeyB0eXBlOiAnY2xpY2snIH0pO1xuICAgICAgICB0aGlzLl9wYXRoLl9jb250YWluc1BvaW50ID0gY29udGFpbnM7XG4gICAgICB9LCB0aGlzKTtcbiAgICB9XG5cbiAgICB0aGlzLl9tYXRyaXggICAgICAgICAgPSBudWxsO1xuICAgIHRoaXMuX3N0YXJ0UG9pbnQgICAgICA9IG51bGw7XG4gICAgdGhpcy5fZHJhZ1N0YXJ0UG9pbnQgID0gbnVsbDtcbiAgICB0aGlzLl9wYXRoLl9kcmFnTW92ZWQgPSBmYWxzZTtcblxuICAgIGlmICh0aGlzLl9tYXBEcmFnZ2luZ1dhc0VuYWJsZWQpIHtcbiAgICAgIGlmIChtb3ZlZCkgTC5Eb21FdmVudC5mYWtlU3RvcCh7IHR5cGU6ICdjbGljaycgfSk7XG4gICAgICB0aGlzLl9wYXRoLl9tYXAuZHJhZ2dpbmcuZW5hYmxlKCk7XG4gICAgfVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIEFwcGxpZXMgdHJhbnNmb3JtYXRpb24sIGRvZXMgaXQgaW4gb25lIHN3ZWVwIGZvciBwZXJmb3JtYW5jZSxcbiAgICogc28gZG9uJ3QgYmUgc3VycHJpc2VkIGFib3V0IHRoZSBjb2RlIHJlcGV0aXRpb24uXG4gICAqXG4gICAqIFsgeCBdICAgWyBhICBiICB0eCBdIFsgeCBdICAgWyBhICogeCArIGIgKiB5ICsgdHggXVxuICAgKiBbIHkgXSA9IFsgYyAgZCAgdHkgXSBbIHkgXSA9IFsgYyAqIHggKyBkICogeSArIHR5IF1cbiAgICpcbiAgICogQHBhcmFtIHtBcnJheS48TnVtYmVyPn0gbWF0cml4XG4gICAqL1xuICBfdHJhbnNmb3JtUG9pbnRzOiBmdW5jdGlvbihtYXRyaXgsIGRlc3QpIHtcbiAgICB2YXIgcGF0aCA9IHRoaXMuX3BhdGg7XG4gICAgdmFyIGksIGxlbiwgbGF0bG5nO1xuXG4gICAgdmFyIHB4ID0gTC5wb2ludChtYXRyaXhbNF0sIG1hdHJpeFs1XSk7XG5cbiAgICB2YXIgY3JzID0gcGF0aC5fbWFwLm9wdGlvbnMuY3JzO1xuICAgIHZhciB0cmFuc2Zvcm1hdGlvbiA9IGNycy50cmFuc2Zvcm1hdGlvbjtcbiAgICB2YXIgc2NhbGUgPSBjcnMuc2NhbGUocGF0aC5fbWFwLmdldFpvb20oKSk7XG4gICAgdmFyIHByb2plY3Rpb24gPSBjcnMucHJvamVjdGlvbjtcblxuICAgIHZhciBkaWZmID0gdHJhbnNmb3JtYXRpb24udW50cmFuc2Zvcm0ocHgsIHNjYWxlKVxuICAgICAgLnN1YnRyYWN0KHRyYW5zZm9ybWF0aW9uLnVudHJhbnNmb3JtKEwucG9pbnQoMCwgMCksIHNjYWxlKSk7XG4gICAgdmFyIGFwcGx5VHJhbnNmb3JtID0gIWRlc3Q7XG5cbiAgICBwYXRoLl9ib3VuZHMgPSBuZXcgTC5MYXRMbmdCb3VuZHMoKTtcblxuICAgIC8vIGNvbnNvbGUudGltZSgndHJhbnNmb3JtJyk7XG4gICAgLy8gYWxsIHNoaWZ0cyBhcmUgaW4tcGxhY2VcbiAgICBpZiAocGF0aC5fcG9pbnQpIHsgLy8gTC5DaXJjbGVcbiAgICAgIGRlc3QgPSBwcm9qZWN0aW9uLnVucHJvamVjdChcbiAgICAgICAgcHJvamVjdGlvbi5wcm9qZWN0KHBhdGguX2xhdGxuZykuX2FkZChkaWZmKSk7XG4gICAgICBpZiAoYXBwbHlUcmFuc2Zvcm0pIHtcbiAgICAgICAgcGF0aC5fbGF0bG5nID0gZGVzdDtcbiAgICAgICAgcGF0aC5fcG9pbnQuX2FkZChweCk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChwYXRoLl9yaW5ncyB8fCBwYXRoLl9wYXJ0cykgeyAvLyBldmVyeXRoaW5nIGVsc2VcbiAgICAgIHZhciByaW5ncyAgID0gcGF0aC5fcmluZ3MgfHwgcGF0aC5fcGFydHM7XG4gICAgICB2YXIgbGF0bG5ncyA9IHBhdGguX2xhdGxuZ3M7XG4gICAgICBkZXN0ID0gZGVzdCB8fCBsYXRsbmdzO1xuICAgICAgaWYgKCFMLlV0aWwuaXNBcnJheShsYXRsbmdzWzBdKSkgeyAvLyBwb2x5bGluZVxuICAgICAgICBsYXRsbmdzID0gW2xhdGxuZ3NdO1xuICAgICAgICBkZXN0ICAgID0gW2Rlc3RdO1xuICAgICAgfVxuICAgICAgZm9yIChpID0gMCwgbGVuID0gcmluZ3MubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgZGVzdFtpXSA9IGRlc3RbaV0gfHwgW107XG4gICAgICAgIGZvciAodmFyIGogPSAwLCBqaiA9IHJpbmdzW2ldLmxlbmd0aDsgaiA8IGpqOyBqKyspIHtcbiAgICAgICAgICBsYXRsbmcgICAgID0gbGF0bG5nc1tpXVtqXTtcbiAgICAgICAgICBkZXN0W2ldW2pdID0gcHJvamVjdGlvblxuICAgICAgICAgICAgLnVucHJvamVjdChwcm9qZWN0aW9uLnByb2plY3QobGF0bG5nKS5fYWRkKGRpZmYpKTtcbiAgICAgICAgICBpZiAoYXBwbHlUcmFuc2Zvcm0pIHtcbiAgICAgICAgICAgIHBhdGguX2JvdW5kcy5leHRlbmQobGF0bG5nc1tpXVtqXSk7XG4gICAgICAgICAgICByaW5nc1tpXVtqXS5fYWRkKHB4KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGRlc3Q7XG4gICAgLy8gY29uc29sZS50aW1lRW5kKCd0cmFuc2Zvcm0nKTtcbiAgfSxcblxuXG5cbiAgLyoqXG4gICAqIElmIHlvdSB3YW50IHRvIHJlYWQgdGhlIGxhdGxuZ3MgZHVyaW5nIHRoZSBkcmFnIC0geW91ciByaWdodCxcbiAgICogYnV0IHRoZXkgaGF2ZSB0byBiZSB0cmFuc2Zvcm1lZFxuICAgKi9cbiAgX3JlcGxhY2VDb29yZEdldHRlcnM6IGZ1bmN0aW9uKCkge1xuICAgIGlmICh0aGlzLl9wYXRoLmdldExhdExuZykgeyAvLyBDaXJjbGUsIENpcmNsZU1hcmtlclxuICAgICAgdGhpcy5fcGF0aC5nZXRMYXRMbmdfID0gdGhpcy5fcGF0aC5nZXRMYXRMbmc7XG4gICAgICB0aGlzLl9wYXRoLmdldExhdExuZyA9IEwuVXRpbC5iaW5kKGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5kcmFnZ2luZy5fdHJhbnNmb3JtUG9pbnRzKHRoaXMuZHJhZ2dpbmcuX21hdHJpeCwge30pO1xuICAgICAgfSwgdGhpcy5fcGF0aCk7XG4gICAgfSBlbHNlIGlmICh0aGlzLl9wYXRoLmdldExhdExuZ3MpIHtcbiAgICAgIHRoaXMuX3BhdGguZ2V0TGF0TG5nc18gPSB0aGlzLl9wYXRoLmdldExhdExuZ3M7XG4gICAgICB0aGlzLl9wYXRoLmdldExhdExuZ3MgPSBMLlV0aWwuYmluZChmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZHJhZ2dpbmcuX3RyYW5zZm9ybVBvaW50cyh0aGlzLmRyYWdnaW5nLl9tYXRyaXgsIFtdKTtcbiAgICAgIH0sIHRoaXMuX3BhdGgpO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBQdXQgYmFjayB0aGUgZ2V0dGVyc1xuICAgKi9cbiAgX3Jlc3RvcmVDb29yZEdldHRlcnM6IGZ1bmN0aW9uKCkge1xuICAgIGlmICh0aGlzLl9wYXRoLmdldExhdExuZ18pIHtcbiAgICAgIHRoaXMuX3BhdGguZ2V0TGF0TG5nID0gdGhpcy5fcGF0aC5nZXRMYXRMbmdfO1xuICAgICAgZGVsZXRlIHRoaXMuX3BhdGguZ2V0TGF0TG5nXztcbiAgICB9IGVsc2UgaWYgKHRoaXMuX3BhdGguZ2V0TGF0TG5nc18pIHtcbiAgICAgIHRoaXMuX3BhdGguZ2V0TGF0TG5ncyA9IHRoaXMuX3BhdGguZ2V0TGF0TG5nc187XG4gICAgICBkZWxldGUgdGhpcy5fcGF0aC5nZXRMYXRMbmdzXztcbiAgICB9XG4gIH1cblxufSk7XG5cblxuLyoqXG4gKiBAcGFyYW0gIHtMLlBhdGh9IGxheWVyXG4gKiBAcmV0dXJuIHtMLlBhdGh9XG4gKi9cbkwuSGFuZGxlci5QYXRoRHJhZy5tYWtlRHJhZ2dhYmxlID0gZnVuY3Rpb24obGF5ZXIpIHtcbiAgbGF5ZXIuZHJhZ2dpbmcgPSBuZXcgTC5IYW5kbGVyLlBhdGhEcmFnKGxheWVyKTtcbiAgcmV0dXJuIGxheWVyO1xufTtcblxuXG4vKipcbiAqIEFsc28gZXhwb3NlIGFzIGEgbWV0aG9kXG4gKiBAcmV0dXJuIHtMLlBhdGh9XG4gKi9cbkwuUGF0aC5wcm90b3R5cGUubWFrZURyYWdnYWJsZSA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gTC5IYW5kbGVyLlBhdGhEcmFnLm1ha2VEcmFnZ2FibGUodGhpcyk7XG59O1xuXG5cbkwuUGF0aC5hZGRJbml0SG9vayhmdW5jdGlvbigpIHtcbiAgaWYgKHRoaXMub3B0aW9ucy5kcmFnZ2FibGUpIHtcbiAgICAvLyBlbnN1cmUgaW50ZXJhY3RpdmVcbiAgICB0aGlzLm9wdGlvbnMuaW50ZXJhY3RpdmUgPSB0cnVlO1xuXG4gICAgaWYgKHRoaXMuZHJhZ2dpbmcpIHtcbiAgICAgIHRoaXMuZHJhZ2dpbmcuZW5hYmxlKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIEwuSGFuZGxlci5QYXRoRHJhZy5tYWtlRHJhZ2dhYmxlKHRoaXMpO1xuICAgICAgdGhpcy5kcmFnZ2luZy5lbmFibGUoKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAodGhpcy5kcmFnZ2luZykge1xuICAgIHRoaXMuZHJhZ2dpbmcuZGlzYWJsZSgpO1xuICB9XG59KTtcbiIsIi8qKlxuICogTGVhZmxldCB2ZWN0b3IgZmVhdHVyZXMgZHJhZyBmdW5jdGlvbmFsaXR5XG4gKiBAYXV0aG9yIEFsZXhhbmRlciBNaWxldnNraSA8aW5mb0B3OHIubmFtZT5cbiAqIEBwcmVzZXJ2ZVxuICovXG5cbi8qKlxuICogTWF0cml4IHRyYW5zZm9ybSBwYXRoIGZvciBTVkcvVk1MXG4gKiBSZW5kZXJlci1pbmRlcGVuZGVudFxuICovXG5MLlBhdGguaW5jbHVkZSh7XG5cblx0LyoqXG5cdCAqIEFwcGxpZXMgbWF0cml4IHRyYW5zZm9ybWF0aW9uIHRvIFNWR1xuXHQgKiBAcGFyYW0ge0FycmF5LjxOdW1iZXI+P30gbWF0cml4XG5cdCAqL1xuXHRfdHJhbnNmb3JtOiBmdW5jdGlvbihtYXRyaXgpIHtcblx0XHRpZiAodGhpcy5fcmVuZGVyZXIpIHtcblx0XHRcdGlmIChtYXRyaXgpIHtcblx0XHRcdFx0dGhpcy5fcmVuZGVyZXIudHJhbnNmb3JtUGF0aCh0aGlzLCBtYXRyaXgpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gcmVzZXQgdHJhbnNmb3JtIG1hdHJpeFxuXHRcdFx0XHR0aGlzLl9yZW5kZXJlci5fcmVzZXRUcmFuc2Zvcm1QYXRoKHRoaXMpO1xuXHRcdFx0XHR0aGlzLl91cGRhdGUoKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblx0LyoqXG5cdCAqIENoZWNrIGlmIHRoZSBmZWF0dXJlIHdhcyBkcmFnZ2VkLCB0aGF0J2xsIHN1cHJlc3MgdGhlIGNsaWNrIGV2ZW50XG5cdCAqIG9uIG1vdXNldXAuIFRoYXQgZml4ZXMgcG9wdXBzIGZvciBleGFtcGxlXG5cdCAqXG5cdCAqIEBwYXJhbSAge01vdXNlRXZlbnR9IGVcblx0ICovXG5cdF9vbk1vdXNlQ2xpY2s6IGZ1bmN0aW9uKGUpIHtcblx0XHRpZiAoKHRoaXMuZHJhZ2dpbmcgJiYgdGhpcy5kcmFnZ2luZy5tb3ZlZCgpKSB8fFxuXHRcdFx0KHRoaXMuX21hcC5kcmFnZ2luZyAmJiB0aGlzLl9tYXAuZHJhZ2dpbmcubW92ZWQoKSkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9maXJlTW91c2VFdmVudChlKTtcblx0fVxuXG59KTtcbiIsIkwuU1ZHLmluY2x1ZGUoIUwuQnJvd3Nlci52bWwgPyB7fSA6IHtcblxuXHQvKipcblx0ICogUmVzZXQgdHJhbnNmb3JtIG1hdHJpeFxuXHQgKi9cblx0X3Jlc2V0VHJhbnNmb3JtUGF0aDogZnVuY3Rpb24obGF5ZXIpIHtcblx0XHRpZiAobGF5ZXIuX3NrZXcpIHtcblx0XHRcdC8vIHN1cGVyIGltcG9ydGFudCEgd29ya2Fyb3VuZCBmb3IgYSAnanVtcGluZycgZ2xpdGNoOlxuXHRcdFx0Ly8gZGlzYWJsZSB0cmFuc2Zvcm0gYmVmb3JlIHJlbW92aW5nIGl0XG5cdFx0XHRsYXllci5fc2tldy5vbiA9IGZhbHNlO1xuXHRcdFx0bGF5ZXIuX3BhdGgucmVtb3ZlQ2hpbGQobGF5ZXIuX3NrZXcpO1xuXHRcdFx0bGF5ZXIuX3NrZXcgPSBudWxsO1xuXHRcdH1cblx0fSxcblxuXHQvKipcblx0ICogQXBwbGllcyBtYXRyaXggdHJhbnNmb3JtYXRpb24gdG8gVk1MXG5cdCAqIEBwYXJhbSB7TC5QYXRofSAgICAgICAgIGxheWVyXG5cdCAqIEBwYXJhbSB7QXJyYXkuPE51bWJlcj59IG1hdHJpeFxuXHQgKi9cblx0dHJhbnNmb3JtUGF0aDogZnVuY3Rpb24obGF5ZXIsIG1hdHJpeCkge1xuXHRcdHZhciBza2V3ID0gbGF5ZXIuX3NrZXc7XG5cblx0XHRpZiAoIXNrZXcpIHtcblx0XHRcdHNrZXcgPSBMLlNWRy5jcmVhdGUoJ3NrZXcnKTtcblx0XHRcdGxheWVyLl9wYXRoLmFwcGVuZENoaWxkKHNrZXcpO1xuXHRcdFx0c2tldy5zdHlsZS5iZWhhdmlvciA9ICd1cmwoI2RlZmF1bHQjVk1MKSc7XG5cdFx0XHRsYXllci5fc2tldyA9IHNrZXc7XG5cdFx0fVxuXG5cdFx0Ly8gaGFuZGxlIHNrZXcvdHJhbnNsYXRlIHNlcGFyYXRlbHksIGNhdXNlIGl0J3MgYnJva2VuXG5cdFx0dmFyIG10ID0gbWF0cml4WzBdLnRvRml4ZWQoOCkgKyAnICcgKyBtYXRyaXhbMV0udG9GaXhlZCg4KSArICcgJyArXG5cdFx0XHRtYXRyaXhbMl0udG9GaXhlZCg4KSArICcgJyArIG1hdHJpeFszXS50b0ZpeGVkKDgpICsgJyAwIDAnO1xuXHRcdHZhciBvZmZzZXQgPSBNYXRoLmZsb29yKG1hdHJpeFs0XSkudG9GaXhlZCgpICsgJywgJyArXG5cdFx0XHRNYXRoLmZsb29yKG1hdHJpeFs1XSkudG9GaXhlZCgpICsgJyc7XG5cblx0XHR2YXIgcyA9IHRoaXMuX3BhdGguc3R5bGU7XG5cdFx0dmFyIGwgPSBwYXJzZUZsb2F0KHMubGVmdCk7XG5cdFx0dmFyIHQgPSBwYXJzZUZsb2F0KHMudG9wKTtcblx0XHR2YXIgdyA9IHBhcnNlRmxvYXQocy53aWR0aCk7XG5cdFx0dmFyIGggPSBwYXJzZUZsb2F0KHMuaGVpZ2h0KTtcblxuXHRcdGlmIChpc05hTihsKSkgICAgICAgbCA9IDA7XG5cdFx0aWYgKGlzTmFOKHQpKSAgICAgICB0ID0gMDtcblx0XHRpZiAoaXNOYU4odykgfHwgIXcpIHcgPSAxO1xuXHRcdGlmIChpc05hTihoKSB8fCAhaCkgaCA9IDE7XG5cblx0XHR2YXIgb3JpZ2luID0gKC1sIC8gdyAtIDAuNSkudG9GaXhlZCg4KSArICcgJyArICgtdCAvIGggLSAwLjUpLnRvRml4ZWQoOCk7XG5cblx0XHRza2V3Lm9uID0gJ2YnO1xuXHRcdHNrZXcubWF0cml4ID0gbXQ7XG5cdFx0c2tldy5vcmlnaW4gPSBvcmlnaW47XG5cdFx0c2tldy5vZmZzZXQgPSBvZmZzZXQ7XG5cdFx0c2tldy5vbiA9IHRydWU7XG5cdH1cblxufSk7XG4iLCJMLlNWRy5pbmNsdWRlKHtcblxuXHQvKipcblx0ICogUmVzZXQgdHJhbnNmb3JtIG1hdHJpeFxuXHQgKi9cblx0X3Jlc2V0VHJhbnNmb3JtUGF0aDogZnVuY3Rpb24obGF5ZXIpIHtcblx0XHRsYXllci5fcGF0aC5zZXRBdHRyaWJ1dGVOUyhudWxsLCAndHJhbnNmb3JtJywgJycpO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBBcHBsaWVzIG1hdHJpeCB0cmFuc2Zvcm1hdGlvbiB0byBTVkdcblx0ICogQHBhcmFtIHtMLlBhdGh9ICAgICAgICAgbGF5ZXJcblx0ICogQHBhcmFtIHtBcnJheS48TnVtYmVyPn0gbWF0cml4XG5cdCAqL1xuXHR0cmFuc2Zvcm1QYXRoOiBmdW5jdGlvbihsYXllciwgbWF0cml4KSB7XG5cdFx0bGF5ZXIuX3BhdGguc2V0QXR0cmlidXRlTlMobnVsbCwgJ3RyYW5zZm9ybScsXG5cdFx0XHQnbWF0cml4KCcgKyBtYXRyaXguam9pbignICcpICsgJyknKTtcblx0fVxuXG59KTtcbiIsImNvbnN0IEwgPSAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvd1snTCddIDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbFsnTCddIDogbnVsbCk7XG5cbmNvbnN0IENpcmNsZSA9IEwuQ2lyY2xlTWFya2VyLmV4dGVuZCh7XG5cbiAgb3B0aW9uczoge1xuICAgIHRleHRTdHlsZToge1xuICAgICAgY29sb3I6ICcjZmZmJyxcbiAgICAgIGZvbnRTaXplOiAxMixcbiAgICAgIGZvbnRXZWlnaHQ6IDMwMFxuICAgIH0sXG4gICAgc2hpZnRZOiA3LFxuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBjbGFzcyBMYWJlbGVkQ2lyY2xlXG4gICAqIEBjb25zdHJ1Y3RvclxuICAgKiBAZXh0ZW5kcyB7TC5DaXJjbGVNYXJrZXJ9XG4gICAqIEBwYXJhbSAge1N0cmluZ30gICB0ZXh0XG4gICAqIEBwYXJhbSAge0wuTGF0TG5nfSBsYXRsbmdcbiAgICogQHBhcmFtICB7T2JqZWN0PX0gIG9wdGlvbnNcbiAgICovXG4gIGluaXRpYWxpemUodGV4dCwgbGF0bG5nLCBvcHRpb25zKSB7XG4gICAgLyoqXG4gICAgICogQHR5cGUge1N0cmluZ31cbiAgICAgKi9cbiAgICB0aGlzLl90ZXh0ICAgICAgICA9IHRleHQ7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7U1ZHVGV4dEVsZW1lbnR9XG4gICAgICovXG4gICAgdGhpcy5fdGV4dEVsZW1lbnQgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1RleHROb2RlfVxuICAgICAqL1xuICAgIHRoaXMuX3RleHROb2RlICAgID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtPYmplY3R8TnVsbH1cbiAgICAgKi9cbiAgICB0aGlzLl90ZXh0TGF5ZXIgICA9IG51bGw7XG5cbiAgICBMLkNpcmNsZU1hcmtlci5wcm90b3R5cGUuaW5pdGlhbGl6ZS5jYWxsKHRoaXMsIGxhdGxuZywgb3B0aW9ucyk7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHBhcmFtIHtTdHJpbmd9IHRleHRcbiAgICogQHJldHVybiB7TGFiZWxlZENpcmNsZX1cbiAgICovXG4gIHNldFRleHQodGV4dCkge1xuICAgIHRoaXMuX3RleHQgPSB0ZXh0O1xuICAgIGlmICh0aGlzLl90ZXh0Tm9kZSkge1xuICAgICAgdGhpcy5fdGV4dEVsZW1lbnQucmVtb3ZlQ2hpbGQodGhpcy5fdGV4dE5vZGUpO1xuICAgIH1cbiAgICB0aGlzLl90ZXh0Tm9kZSA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKHRoaXMuX3RleHQpO1xuICAgIHRoaXMuX3RleHRFbGVtZW50LmFwcGVuZENoaWxkKHRoaXMuX3RleHROb2RlKTtcblxuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEByZXR1cm4ge1N0cmluZ31cbiAgICovXG4gIGdldFRleHQoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3RleHQ7XG4gIH0sXG5cblxuICAvKipcbiAgICogQWxzbyBicmluZyB0ZXh0IHRvIGZyb250XG4gICAqIEBvdmVycmlkZVxuICAgKi9cbiAgYnJpbmdUb0Zyb250KCkge1xuICAgIEwuQ2lyY2xlTWFya2VyLnByb3RvdHlwZS5icmluZ1RvRnJvbnQuY2FsbCh0aGlzKTtcbiAgICB0aGlzLl9ncm91cFRleHRUb1BhdGgoKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAb3ZlcnJpZGVcbiAgICovXG4gIGJyaW5nVG9CYWNrKCkge1xuICAgIEwuQ2lyY2xlTWFya2VyLnByb3RvdHlwZS5icmluZ1RvQmFjay5jYWxsKHRoaXMpO1xuICAgIHRoaXMuX2dyb3VwVGV4dFRvUGF0aCgpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIFB1dCB0ZXh0IGluIHRoZSByaWdodCBwb3NpdGlvbiBpbiB0aGUgZG9tXG4gICAqL1xuICBfZ3JvdXBUZXh0VG9QYXRoKCkge1xuICAgIGNvbnN0IHBhdGggICAgICAgID0gdGhpcy5fcGF0aDtcbiAgICBjb25zdCB0ZXh0RWxlbWVudCA9IHRoaXMuX3RleHRFbGVtZW50O1xuICAgIGNvbnN0IG5leHQgICAgICAgID0gcGF0aC5uZXh0U2libGluZztcbiAgICBjb25zdCBwYXJlbnQgICAgICA9IHBhdGgucGFyZW50Tm9kZTtcblxuXG4gICAgaWYgKHRleHRFbGVtZW50ICYmIHBhcmVudCkge1xuICAgICAgaWYgKG5leHQgJiYgbmV4dCAhPT0gdGV4dEVsZW1lbnQpIHtcbiAgICAgICAgcGFyZW50Lmluc2VydEJlZm9yZSh0ZXh0RWxlbWVudCwgbmV4dCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwYXJlbnQuYXBwZW5kQ2hpbGQodGV4dEVsZW1lbnQpO1xuICAgICAgfVxuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBQb3NpdGlvbiB0aGUgdGV4dCBpbiBjb250YWluZXJcbiAgICovXG4gIF91cGRhdGVQYXRoKCkge1xuICAgIEwuQ2lyY2xlTWFya2VyLnByb3RvdHlwZS5fdXBkYXRlUGF0aC5jYWxsKHRoaXMpO1xuICAgIHRoaXMuX3VwZGF0ZVRleHRQb3NpdGlvbigpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBvdmVycmlkZVxuICAgKi9cbiAgX3RyYW5zZm9ybShtYXRyaXgpIHtcbiAgICBMLkNpcmNsZU1hcmtlci5wcm90b3R5cGUuX3RyYW5zZm9ybS5jYWxsKHRoaXMsIG1hdHJpeCk7XG5cbiAgICAvLyB3cmFwIHRleHRFbGVtZW50IHdpdGggYSBmYWtlIGxheWVyIGZvciByZW5kZXJlclxuICAgIC8vIHRvIGJlIGFibGUgdG8gdHJhbnNmb3JtIGl0XG4gICAgdGhpcy5fdGV4dExheWVyID0gdGhpcy5fdGV4dExheWVyIHx8IHsgX3BhdGg6IHRoaXMuX3RleHRFbGVtZW50IH07XG4gICAgaWYgKG1hdHJpeCkge1xuICAgICAgdGhpcy5fcmVuZGVyZXIudHJhbnNmb3JtUGF0aCh0aGlzLl90ZXh0TGF5ZXIsIG1hdHJpeCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX3JlbmRlcmVyLl9yZXNldFRyYW5zZm9ybVBhdGgodGhpcy5fdGV4dExheWVyKTtcbiAgICAgIHRoaXMuX3VwZGF0ZVRleHRQb3NpdGlvbigpO1xuICAgICAgdGhpcy5fdGV4dExheWVyID0gbnVsbDtcbiAgICB9XG4gIH0sXG5cblxuICAvKipcbiAgICogQHBhcmFtICB7TC5NYXB9IG1hcFxuICAgKiBAcmV0dXJuIHtMYWJlbGVkQ2lyY2xlfVxuICAgKi9cbiAgb25BZGQobWFwKSB7XG4gICAgTC5DaXJjbGVNYXJrZXIucHJvdG90eXBlLm9uQWRkLmNhbGwodGhpcywgbWFwKTtcbiAgICB0aGlzLl9pbml0VGV4dCgpO1xuICAgIHRoaXMuX3VwZGF0ZVRleHRQb3NpdGlvbigpO1xuICAgIHRoaXMuc2V0U3R5bGUoe30pO1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhbmQgaW5zZXJ0IHRleHRcbiAgICovXG4gIF9pbml0VGV4dCgpIHtcbiAgICB0aGlzLl90ZXh0RWxlbWVudCA9IEwuU1ZHLmNyZWF0ZSgndGV4dCcpO1xuICAgIHRoaXMuc2V0VGV4dCh0aGlzLl90ZXh0KTtcbiAgICB0aGlzLl9yZW5kZXJlci5fcm9vdEdyb3VwLmFwcGVuZENoaWxkKHRoaXMuX3RleHRFbGVtZW50KTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBDYWxjdWxhdGUgcG9zaXRpb24gZm9yIHRleHRcbiAgICovXG4gIF91cGRhdGVUZXh0UG9zaXRpb24oKSB7XG4gICAgY29uc3QgdGV4dEVsZW1lbnQgPSB0aGlzLl90ZXh0RWxlbWVudDtcbiAgICBpZiAodGV4dEVsZW1lbnQpIHtcbiAgICAgIGNvbnN0IGJib3ggPSB0ZXh0RWxlbWVudC5nZXRCQm94KCk7XG4gICAgICBjb25zdCB0ZXh0UG9zaXRpb24gPSB0aGlzLl9wb2ludC5zdWJ0cmFjdChcbiAgICAgICAgTC5wb2ludChiYm94LndpZHRoLCAtYmJveC5oZWlnaHQgKyB0aGlzLm9wdGlvbnMuc2hpZnRZKS5kaXZpZGVCeSgyKSk7XG5cbiAgICAgIHRleHRFbGVtZW50LnNldEF0dHJpYnV0ZSgneCcsIHRleHRQb3NpdGlvbi54KTtcbiAgICAgIHRleHRFbGVtZW50LnNldEF0dHJpYnV0ZSgneScsIHRleHRQb3NpdGlvbi55KTtcbiAgICAgIHRoaXMuX2dyb3VwVGV4dFRvUGF0aCgpO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBTZXQgdGV4dCBzdHlsZVxuICAgKi9cbiAgc2V0U3R5bGUoc3R5bGUpIHtcbiAgICBMLkNpcmNsZU1hcmtlci5wcm90b3R5cGUuc2V0U3R5bGUuY2FsbCh0aGlzLCBzdHlsZSk7XG4gICAgaWYgKHRoaXMuX3RleHRFbGVtZW50KSB7XG4gICAgICBjb25zdCBzdHlsZXMgPSB0aGlzLm9wdGlvbnMudGV4dFN0eWxlO1xuICAgICAgZm9yIChsZXQgcHJvcCBpbiBzdHlsZXMpIHtcbiAgICAgICAgaWYgKHN0eWxlcy5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgICAgIGxldCBzdHlsZVByb3AgPSBwcm9wO1xuICAgICAgICAgIGlmIChwcm9wID09PSAnY29sb3InKSB7XG4gICAgICAgICAgICBzdHlsZVByb3AgPSAnc3Ryb2tlJztcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy5fdGV4dEVsZW1lbnQuc3R5bGVbc3R5bGVQcm9wXSA9IHN0eWxlc1twcm9wXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBSZW1vdmUgdGV4dFxuICAgKi9cbiAgb25SZW1vdmUobWFwKSB7XG4gICAgaWYgKHRoaXMuX3RleHRFbGVtZW50KSB7XG4gICAgICBpZiAodGhpcy5fdGV4dEVsZW1lbnQucGFyZW50Tm9kZSkge1xuICAgICAgICB0aGlzLl90ZXh0RWxlbWVudC5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHRoaXMuX3RleHRFbGVtZW50KTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX3RleHRFbGVtZW50ID0gbnVsbDtcbiAgICAgIHRoaXMuX3RleHROb2RlID0gbnVsbDtcbiAgICAgIHRoaXMuX3RleHRMYXllciA9IG51bGw7XG4gICAgfVxuXG4gICAgcmV0dXJuIEwuQ2lyY2xlTWFya2VyLnByb3RvdHlwZS5vblJlbW92ZS5jYWxsKHRoaXMsIG1hcCk7XG4gIH1cblxufSk7XG5cblxubW9kdWxlLmV4cG9ydHMgPSBMLlRleHRDaXJjbGUgPSBDaXJjbGU7XG5MLnRleHRDaXJjbGUgPSAodGV4dCwgbGF0bG5nLCBvcHRpb25zKSA9PiBuZXcgQ2lyY2xlKHRleHQsIGxhdGxuZywgb3B0aW9ucyk7XG4iLCJjb25zdCBMID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJ0wnXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJ0wnXSA6IG51bGwpO1xuY29uc3QgQ2lyY2xlID0gcmVxdWlyZSgnLi9jaXJjbGUnKTtcbnJlcXVpcmUoJ2xlYWZsZXQtcGF0aC1kcmFnJyk7XG5cbmNvbnN0IExhYmVsZWRNYXJrZXIgPSBMLkZlYXR1cmVHcm91cC5leHRlbmQoe1xuXG4gIG9wdGlvbnM6IHtcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSAge0xhYmVsZWRNYXJrZXJ9IG1hcmtlclxuICAgICAqIEBwYXJhbSAge09iamVjdH0gICAgICAgIGZlYXR1cmVcbiAgICAgKiBAcmV0dXJuIHtTdHJpbmd9XG4gICAgICovXG4gICAgZ2V0TGFiZWxUZXh0OiAobWFya2VyLCBmZWF0dXJlKSA9PiBmZWF0dXJlLnByb3BlcnRpZXMudGV4dCxcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSAge0xhYmVsZWRNYXJrZXJ9IG1hcmtlclxuICAgICAqIEBwYXJhbSAge09iamVjdH0gICAgICAgIGZlYXR1cmVcbiAgICAgKiBAcGFyYW0gIHtMLkxhdExuZ30gICAgICBsYXRsbmdcbiAgICAgKiBAcmV0dXJuIHtMLkxhdExuZ31cbiAgICAgKi9cbiAgICBnZXRMYWJlbFBvc2l0aW9uOiAobWFya2VyLCBmZWF0dXJlLCBsYXRsbmcpID0+IHtcbiAgICAgIHJldHVybiBmZWF0dXJlLnByb3BlcnRpZXMubGFiZWxQb3NpdGlvbiA/XG4gICAgICAgIEwubGF0TG5nKGZlYXR1cmUucHJvcGVydGllcy5sYWJlbFBvc2l0aW9uLnNsaWNlKCkucmV2ZXJzZSgpKSA6XG4gICAgICAgIGxhdGxuZztcbiAgICB9LFxuXG4gICAgbGFiZWxQb3NpdGlvbktleTogJ2xhYmVsUG9zaXRpb24nLFxuXG4gICAgbWFya2VyT3B0aW9uczoge1xuICAgICAgY29sb3I6ICcjZjAwJyxcbiAgICAgIGZpbGxPcGFjaXR5OiAwLjc1LFxuICAgICAgZHJhZ2dhYmxlOiB0cnVlLFxuICAgICAgcmFkaXVzOiAxNVxuICAgIH0sXG5cbiAgICBhbmNob3JPcHRpb25zOiB7XG4gICAgICBjb2xvcjogJyMwMGYnLFxuICAgICAgcmFkaXVzOiAzXG4gICAgfSxcblxuICAgIGxpbmVPcHRpb25zOiB7XG4gICAgICBjb2xvcjogJyNmMDAnLFxuICAgICAgZGFzaEFycmF5OiBbMiwgNl0sXG4gICAgICBsaW5lQ2FwOiAnc3F1YXJlJyxcbiAgICAgIHdlaWdodDogMlxuICAgIH1cblxuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBjbGFzcyBMYWJlbGVkTWFya2VyXG4gICAqIEBjb25zdHJ1Y3RvclxuICAgKiBAZXh0ZW5kcyB7TC5GZWF0dXJlR3JvdXB9XG4gICAqXG4gICAqIEBwYXJhbSAge0wuTGF0TG5nfSBsYXRsbmdcbiAgICogQHBhcmFtICB7T2JqZWN0PX0gIGZlYXR1cmVcbiAgICogQHBhcmFtICB7T2JqZWN0PX0gIG9wdGlvbnNcbiAgICovXG4gIGluaXRpYWxpemUobGF0bG5nLCBmZWF0dXJlLCBvcHRpb25zKSB7XG4gICAgTC5VdGlsLnNldE9wdGlvbnModGhpcywgb3B0aW9ucyk7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7T2JqZWN0fVxuICAgICAqL1xuICAgIHRoaXMuZmVhdHVyZSA9IGZlYXR1cmUgfHwge1xuICAgICAgdHlwZTogJ0ZlYXR1cmUnLFxuICAgICAgcHJvcGVydGllczoge30sXG4gICAgICBnZW9tZXRyeToge1xuICAgICAgICAndHlwZSc6ICdQb2ludCdcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuTGF0TG5nfVxuICAgICAqL1xuICAgIHRoaXMuX2xhdGxuZyA9IGxhdGxuZztcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0NpcmNsZUxhYmVsfVxuICAgICAqL1xuICAgIHRoaXMuX21hcmtlciA9IG51bGw7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLkNpcmNsZU1hcmtlcn1cbiAgICAgKi9cbiAgICB0aGlzLl9hbmNob3IgPSBudWxsO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TC5Qb2x5bGluZX1cbiAgICAgKi9cbiAgICB0aGlzLl9saW5lID0gbnVsbDtcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuUG9pbnR9XG4gICAgICovXG4gICAgdGhpcy5faW5pdGlhbERpc3RhbmNlID0gbnVsbDtcblxuICAgIHRoaXMuX2NyZWF0ZUxheWVycygpO1xuICAgIEwuTGF5ZXJHcm91cC5wcm90b3R5cGUuaW5pdGlhbGl6ZS5jYWxsKHRoaXMsXG4gICAgICBbdGhpcy5fYW5jaG9yLCB0aGlzLl9saW5lLCB0aGlzLl9tYXJrZXJdKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcmV0dXJuIHtMLkxhdExuZ31cbiAgICovXG4gIGdldExhYmVsUG9zaXRpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuX21hcmtlci5nZXRMYXRMbmcoKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcmV0dXJuIHtMLkxhdExuZ31cbiAgICovXG4gIGdldExhdExuZygpIHtcbiAgICByZXR1cm4gdGhpcy5fbGF0bG5nO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIFNlcmlhbGl6ZVxuICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAqL1xuICB0b0dlb0pTT04oZ2VvbWV0cnlDb2xsZWN0aW9uKSB7XG4gICAgY29uc3QgZmVhdHVyZSA9IEwuR2VvSlNPTi5nZXRGZWF0dXJlKHRoaXMsIHtcbiAgICAgIHR5cGU6ICdQb2ludCcsXG4gICAgICBjb29yZGluYXRlczogTC5HZW9KU09OLmxhdExuZ1RvQ29vcmRzKHRoaXMuX2FuY2hvci5nZXRMYXRMbmcoKSlcbiAgICB9KTtcbiAgICBmZWF0dXJlLnByb3BlcnRpZXNbdGhpcy5vcHRpb25zLmxhYmVsUG9zaXRpb25LZXldID1cbiAgICAgIEwuR2VvSlNPTi5sYXRMbmdUb0Nvb3Jkcyh0aGlzLl9tYXJrZXIuZ2V0TGF0TG5nKCkpO1xuICAgIGZlYXR1cmUucHJvcGVydGllcy50ZXh0ID0gdGhpcy5fbWFya2VyLmdldFRleHQoKTtcbiAgICByZXR1cm4gZ2VvbWV0cnlDb2xsZWN0aW9uID9cbiAgICAgIEwuTGFiZWxlZENpcmNsZU1hcmtlclxuICAgICAgICAudG9HZW9tZXRyeUNvbGxlY3Rpb24oZmVhdHVyZSwgdGhpcy5vcHRpb25zLmxhYmVsUG9zaXRpb25LZXkpIDogZmVhdHVyZTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0ge1N0cmluZ30gdGV4dFxuICAgKiBAcmV0dXJuIHtMYWJlbGVkTWFya2VyfVxuICAgKi9cbiAgc2V0VGV4dCh0ZXh0KSB7XG4gICAgdGhpcy5fbWFya2VyLnNldFRleHQodGV4dCk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cblxuICAvKipcbiAgICogQ3JlYXRlcyBhbmNob3IsIGxpbmUgYW5kIGxhYmVsXG4gICAqL1xuICBfY3JlYXRlTGF5ZXJzKCkge1xuICAgIGNvbnN0IG9wdHMgPSB0aGlzLm9wdGlvbnM7XG4gICAgY29uc3QgcG9zICA9IG9wdHMuZ2V0TGFiZWxQb3NpdGlvbih0aGlzLCB0aGlzLmZlYXR1cmUsIHRoaXMuX2xhdGxuZyk7XG4gICAgY29uc3QgdGV4dCA9IG9wdHMuZ2V0TGFiZWxUZXh0KHRoaXMsIHRoaXMuZmVhdHVyZSk7XG5cbiAgICBpZiAoJ2RyYWdnYWJsZScgaW4gb3B0cykge1xuICAgICAgb3B0cy5tYXJrZXJPcHRpb25zLmRyYWdnYWJsZSA9IG9wdHMuZHJhZ2dhYmxlO1xuICAgIH1cblxuICAgIHRoaXMuX21hcmtlciA9IG5ldyBDaXJjbGUodGV4dCwgcG9zLFxuICAgICAgTC5VdGlsLmV4dGVuZCh7XG4gICAgICAgIGludGVyYWN0aXZlOiB0aGlzLm9wdGlvbnMuaW50ZXJhY3RpdmVcbiAgICAgIH0sXG4gICAgICAgIExhYmVsZWRNYXJrZXIucHJvdG90eXBlLm9wdGlvbnMubWFya2VyT3B0aW9ucyxcbiAgICAgICAgb3B0cy5tYXJrZXJPcHRpb25zKVxuICAgICkub24oJ2RyYWcnLCAgICAgIHRoaXMuX29uTWFya2VyRHJhZywgICAgICB0aGlzKVxuICAgICAub24oJ2RyYWdzdGFydCcsIHRoaXMuX29uTWFya2VyRHJhZ1N0YXJ0LCB0aGlzKVxuICAgICAub24oJ2RyYWdlbmQnLCAgIHRoaXMuX29uTWFya2VyRHJhZ0VuZCwgICB0aGlzKTtcblxuICAgIHRoaXMuX2FuY2hvciA9IG5ldyBMLkNpcmNsZU1hcmtlcih0aGlzLl9sYXRsbmcsXG4gICAgICBMLlV0aWwuZXh0ZW5kKHt9LCBMYWJlbGVkTWFya2VyLnByb3RvdHlwZS5vcHRpb25zLmFuY2hvck9wdGlvbnMsXG4gICAgICAgIG9wdHMuYW5jaG9yT3B0aW9ucykpO1xuXG4gICAgdGhpcy5fbGluZSA9IG5ldyBMLlBvbHlsaW5lKFt0aGlzLl9sYXRsbmcsIHRoaXMuX21hcmtlci5nZXRMYXRMbmcoKV0sXG4gICAgICBMLlV0aWwuZXh0ZW5kKHt9LCBMYWJlbGVkTWFya2VyLnByb3RvdHlwZS5vcHRpb25zLmxpbmVPcHRpb25zLFxuICAgICAgICBvcHRzLmxpbmVPcHRpb25zKSk7XG4gIH0sXG5cblxuICAvKipcbiAgICogU3RvcmUgc2hpZnQgdG8gYmUgcHJlY2lzZSB3aGlsZSBkcmFnZ2luZ1xuICAgKiBAcGFyYW0gIHtFdmVudH0gZXZ0XG4gICAqL1xuICBfb25NYXJrZXJEcmFnU3RhcnQoZXZ0KSB7XG4gICAgdGhpcy5faW5pdGlhbERpc3RhbmNlID0gTC5Eb21FdmVudC5nZXRNb3VzZVBvc2l0aW9uKGV2dClcbiAgICAgIC5zdWJ0cmFjdCh0aGlzLl9tYXAubGF0TG5nVG9Db250YWluZXJQb2ludCh0aGlzLl9tYXJrZXIuZ2V0TGF0TG5nKCkpKTtcbiAgICB0aGlzLmZpcmUoJ2xhYmVsOicgKyBldnQudHlwZSwgZXZ0KTtcbiAgICAvL0wuVXRpbC5yZXF1ZXN0QW5pbUZyYW1lKHRoaXMuX21hcmtlci5icmluZ1RvRnJvbnQsIHRoaXMuX21hcmtlcik7XG4gIH0sXG5cblxuICAvKipcbiAgICogTGluZSBkcmFnZ2luZ1xuICAgKiBAcGFyYW0gIHtEcmFnRXZlbnR9IGV2dFxuICAgKi9cbiAgX29uTWFya2VyRHJhZyhldnQpIHtcbiAgICBjb25zdCBsYXRsbmcgPSB0aGlzLl9tYXAuY29udGFpbmVyUG9pbnRUb0xhdExuZyhcbiAgICAgIEwuRG9tRXZlbnQuZ2V0TW91c2VQb3NpdGlvbihldnQpLl9zdWJ0cmFjdCh0aGlzLl9pbml0aWFsRGlzdGFuY2UpKTtcbiAgICB0aGlzLl9saW5lLnNldExhdExuZ3MoW2xhdGxuZywgdGhpcy5fbGF0bG5nXSk7XG4gICAgdGhpcy5maXJlKCdsYWJlbDonICsgZXZ0LnR5cGUsIGV2dCk7XG4gIH0sXG5cblxuICBfb25NYXJrZXJEcmFnRW5kKGV2dCkge1xuICAgIHRoaXMuX2xpbmUuc2V0TGF0TG5ncyhbdGhpcy5fbWFya2VyLmdldExhdExuZygpLCB0aGlzLl9sYXRsbmddKTtcbiAgICB0aGlzLmZpcmUoJ2xhYmVsOicgKyBldnQudHlwZSwgZXZ0KTtcbiAgfSxcblxuXG4gIGVuYWJsZURyYWdnaW5nKCkge1xuICAgIGlmICh0aGlzLl9tYXJrZXIuZHJhZ2dpbmcpIHRoaXMuX21hcmtlci5kcmFnZ2luZy5lbmFibGUoKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuXG4gIGRpc2FibGVEcmFnZ2luZygpIHtcbiAgICBpZiAodGhpcy5fbWFya2VyLmRyYWdnaW5nKSB0aGlzLl9tYXJrZXIuZHJhZ2dpbmcuZGlzYWJsZSgpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbn0pO1xuXG5cbi8qKlxuICogQHBhcmFtICB7T2JqZWN0fSBmZWF0dXJlXG4gKiBAcGFyYW0gIHtTdHJpbmc9fSBrZXlcbiAqIEByZXR1cm4ge09iamVjdH1cbiAqL1xuZnVuY3Rpb24gdG9HZW9tZXRyeUNvbGxlY3Rpb24oZmVhdHVyZSwga2V5KSB7XG4gIGtleSA9IGtleSB8fCAnbGFiZWxQb3NpdGlvbic7XG4gIGNvbnN0IGFuY2hvclBvcyA9IGZlYXR1cmUuZ2VvbWV0cnkuY29vcmRpbmF0ZXMuc2xpY2UoKTtcbiAgbGV0IGxhYmVsUG9zICA9IGZlYXR1cmUucHJvcGVydGllc1trZXldO1xuXG4gIGlmICghbGFiZWxQb3MpIHRocm93IG5ldyBFcnJvcignTm8gbGFiZWwgcG9zaXRpb24gc2V0Jyk7XG5cbiAgbGFiZWxQb3MgPSBsYWJlbFBvcy5zbGljZSgpO1xuICBjb25zdCBnZW9tZXRyaWVzID0gW3tcbiAgICB0eXBlOiAnUG9pbnQnLFxuICAgIGNvb3JkaW5hdGVzOiBhbmNob3JQb3NcbiAgfSwge1xuICAgIHR5cGU6ICdMaW5lU3RyaW5nJyxcbiAgICBjb29yZGluYXRlczogW1xuICAgICAgYW5jaG9yUG9zLnNsaWNlKCksXG4gICAgICBsYWJlbFBvc1xuICAgIF1cbiAgfSwge1xuICAgIHR5cGU6ICdQb2ludCcsXG4gICAgY29vcmRpbmF0ZXM6IGxhYmVsUG9zLnNsaWNlKClcbiAgfSwge1xuICAgIHR5cGU6ICdQb2ludCcsXG4gICAgY29vcmRpbmF0ZXM6IGxhYmVsUG9zLnNsaWNlKClcbiAgfV07XG5cbiAgcmV0dXJuIHtcbiAgICB0eXBlOiAnRmVhdHVyZScsXG4gICAgcHJvcGVydGllczogTC5VdGlsLmV4dGVuZCh7fSwgZmVhdHVyZS5wcm9wZXJ0aWVzLCB7XG4gICAgICBnZW9tZXRyaWVzVHlwZXM6IFsnYW5jaG9yJywgJ2Nvbm5lY3Rpb24nLCAnbGFiZWwnLCAndGV4dGJveCddXG4gICAgfSksXG4gICAgYmJveDogZmVhdHVyZS5iYm94LFxuICAgIGdlb21ldHJ5OiB7XG4gICAgICB0eXBlOiAnR2VvbWV0cnlDb2xsZWN0aW9uJyxcbiAgICAgIGdlb21ldHJpZXM6IGdlb21ldHJpZXNcbiAgICB9XG4gIH07XG59XG5cbkxhYmVsZWRNYXJrZXIudG9HZW9tZXRyeUNvbGxlY3Rpb24gPSB0b0dlb21ldHJ5Q29sbGVjdGlvbjtcblxuTC5MYWJlbGVkQ2lyY2xlTWFya2VyID0gTGFiZWxlZE1hcmtlcjtcbkwubGFiZWxlZENpcmNsZU1hcmtlciA9IChsYXRsbmcsIGZlYXR1cmUsIG9wdGlvbnMpID0+IHtcbiAgcmV0dXJuIG5ldyBMYWJlbGVkTWFya2VyKGxhdGxuZywgZmVhdHVyZSwgb3B0aW9ucyk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IExhYmVsZWRNYXJrZXI7XG4iXX0=
