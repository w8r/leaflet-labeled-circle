(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}(g.L || (g.L = {})).LabeledCircleMarker = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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
L.Util.trueFn = function() {
  return true;
};

L.Canvas.include({

  /**
   * Do nothing
   * @param  {L.Path} layer
   */
  _resetTransformPath: function(layer) {
    if (!this._containerCopy) {
      return;
    }

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
   *
   * @param  {L.Path}         layer
   * @param  {Array.<Number>} matrix
   */
  transformPath: function(layer, matrix) {
    var copy = this._containerCopy;
    var ctx = this._ctx;
    var m = L.Browser.retina ? 2 : 1;
    var bounds = this._bounds;
    var size = bounds.getSize();
    var pos = bounds.min;

    if (!copy) {
      copy = this._containerCopy = document.createElement('canvas');
      document.body.appendChild(copy);

      copy.width = m * size.x;
      copy.height = m * size.y;

      layer._removed = true;
      this._redraw();

      copy.getContext('2d').translate(m * bounds.min.x, m * bounds.min.y);
      copy.getContext('2d').drawImage(this._container, 0, 0);
      this._initPath(layer);
      layer._containsPoint_ = layer._containsPoint;
      layer._containsPoint = L.Util.trueFn;
    }

    ctx.save();
    ctx.clearRect(pos.x, pos.y, size.x * m, size.y * m);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.restore();
    ctx.save();

    ctx.drawImage(this._containerCopy, 0, 0, size.x, size.y);
    ctx.transform.apply(ctx, matrix);

    var layers = this._layers;
    this._layers = {};

    this._initPath(layer);
    layer._updatePath();

    this._layers = layers;
    ctx.restore();
  }

});

},{}],4:[function(require,module,exports){
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
      .on(document, L.Draggable.MOVE[eventType], this._onDrag,    this)
      .on(document, L.Draggable.END[eventType],  this._onDragEnd, this);

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

    var x = containerPoint.x;
    var y = containerPoint.y;

    var dx = x - this._startPoint.x;
    var dy = y - this._startPoint.y;

    if (!this._path._dragMoved && (dx || dy)) {
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


    L.DomEvent
      .off(document, 'mousemove touchmove', this._onDrag, this)
      .off(document, 'mouseup touchend',    this._onDragEnd, this);

    this._restoreCoordGetters();

    // consistency
    if (moved) {
      this._path.fire('dragend', {
        distance: Math.sqrt(
          L.LineUtil._sqDist(this._dragStartPoint, containerPoint)
        )
      });

      // hack for skipping the click in canvas-rendered layers
      var contains = this._path._containsPoint;
      this._path._containsPoint = L.Util.falseFn;
      L.Util.requestAnimFrame(function() {
        L.DomEvent._skipped({ type: 'click' });
        this._path._containsPoint = contains;
      }, this);
    }

    this._matrix          = null;
    this._startPoint      = null;
    this._dragStartPoint  = null;
    this._path._dragMoved = false;

    if (this._mapDraggingWasEnabled) {
      L.DomEvent._fakeStop({ type: 'click' });
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

		if (isNaN(l)) { l = 0; }
		if (isNaN(t)) { t = 0; }
		if (isNaN(w) || !w) { w = 1; }
		if (isNaN(h) || !h) { h = 1; }

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

var Circle = module.exports = L.CircleMarker.extend({

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
    this.setStyle();
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

L.TextCircle = Circle;
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
  toGeoJSON: function toGeoJSON() {
    var feature = L.GeoJSON.getFeature(this, {
      type: 'Point',
      coordinates: L.GeoJSON.latLngToCoords(this._anchor.getLatLng())
    });
    feature.properties[this.options.labelPositionKey] = L.GeoJSON.latLngToCoords(this._marker.getLatLng());
    return feature;
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
    this.fire('label:' + evt.type, evt);
  }

});

module.exports = L.LabeledCircleMarker = LabeledMarker;
L.labeledCircleMarker = function (latlng, feature, options) {
  return new LabeledMarker(latlng, feature, options);
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./circle":8,"leaflet-path-drag":2}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9sZWFmbGV0LXBhdGgtZHJhZy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9sZWFmbGV0LXBhdGgtZHJhZy9zcmMvQ2FudmFzLmpzIiwibm9kZV9tb2R1bGVzL2xlYWZsZXQtcGF0aC1kcmFnL3NyYy9QYXRoLkRyYWcuanMiLCJub2RlX21vZHVsZXMvbGVhZmxldC1wYXRoLWRyYWcvc3JjL1BhdGguVHJhbnNmb3JtLmpzIiwibm9kZV9tb2R1bGVzL2xlYWZsZXQtcGF0aC1kcmFnL3NyYy9TVkcuVk1MLmpzIiwibm9kZV9tb2R1bGVzL2xlYWZsZXQtcGF0aC1kcmFnL3NyYy9TVkcuanMiLCJzcmMvY2lyY2xlLmpzIiwic3JjL21hcmtlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O0FDQUE7Ozs7Ozs7QUFPQSxPQUFPLE9BQVAsR0FBaUIsUUFBUSxjQUFSLENBQWpCOzs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdVQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtB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LGdCQUFoRCxDQURXLENBQWI7QUFFQSxTQUFLLEtBQUwsQ0FBVyxVQUFYLENBQXNCLENBQUMsTUFBRCxFQUFTLEtBQUssT0FBZCxDQUF0QjtBQUNBLFNBQUssSUFBTCxDQUFVLFdBQVcsSUFBSSxJQUF6QixFQUErQixHQUEvQjtBQUNELEdBck11Qzs7QUF3TXhDLG9CQUFrQiwwQkFBUyxHQUFULEVBQWM7QUFDOUIsU0FBSyxJQUFMLENBQVUsV0FBVyxJQUFJLElBQXpCLEVBQStCLEdBQS9CO0FBQ0Q7O0FBMU11QyxDQUF0QixDQUFwQjs7QUE4TUEsT0FBTyxPQUFQLEdBQWlCLEVBQUUsbUJBQUYsR0FBd0IsYUFBekM7QUFDQSxFQUFFLG1CQUFGLEdBQXdCLFVBQVMsTUFBVCxFQUFpQixPQUFqQixFQUEwQixPQUExQixFQUFtQztBQUN6RCxTQUFPLElBQUksYUFBSixDQUFrQixNQUFsQixFQUEwQixPQUExQixFQUFtQyxPQUFuQyxDQUFQO0FBQ0QsQ0FGRCIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvKipcbiAqIExlYWZsZXQgU1ZHIGNpcmNsZSBtYXJrZXIgd2l0aCBkZXRhY2hhYmxlIGFuZCBkcmFnZ2FibGUgbGFiZWwgYW5kIHRleHRcbiAqXG4gKiBAYXV0aG9yIEFsZXhhbmRlciBNaWxldnNraSA8aW5mb0B3OHIubmFtZT5cbiAqIEBsaWNlbnNlIE1JVFxuICogQHByZXNlcnZlXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9zcmMvbWFya2VyJyk7XG4iLCJyZXF1aXJlKCcuL3NyYy9TVkcnKTtcbnJlcXVpcmUoJy4vc3JjL1NWRy5WTUwnKTtcbnJlcXVpcmUoJy4vc3JjL0NhbnZhcycpO1xucmVxdWlyZSgnLi9zcmMvUGF0aC5UcmFuc2Zvcm0nKTtcbnJlcXVpcmUoJy4vc3JjL1BhdGguRHJhZycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEwuUGF0aC5EcmFnO1xuIiwiTC5VdGlsLnRydWVGbiA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gdHJ1ZTtcbn07XG5cbkwuQ2FudmFzLmluY2x1ZGUoe1xuXG4gIC8qKlxuICAgKiBEbyBub3RoaW5nXG4gICAqIEBwYXJhbSAge0wuUGF0aH0gbGF5ZXJcbiAgICovXG4gIF9yZXNldFRyYW5zZm9ybVBhdGg6IGZ1bmN0aW9uKGxheWVyKSB7XG4gICAgaWYgKCF0aGlzLl9jb250YWluZXJDb3B5KSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgZGVsZXRlIHRoaXMuX2NvbnRhaW5lckNvcHk7XG5cbiAgICBpZiAobGF5ZXIuX2NvbnRhaW5zUG9pbnRfKSB7XG4gICAgICBsYXllci5fY29udGFpbnNQb2ludCA9IGxheWVyLl9jb250YWluc1BvaW50XztcbiAgICAgIGRlbGV0ZSBsYXllci5fY29udGFpbnNQb2ludF87XG5cbiAgICAgIHRoaXMuX3JlcXVlc3RSZWRyYXcobGF5ZXIpO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBBbGdvcml0aG0gb3V0bGluZTpcbiAgICpcbiAgICogMS4gcHJlLXRyYW5zZm9ybSAtIGNsZWFyIHRoZSBwYXRoIG91dCBvZiB0aGUgY2FudmFzLCBjb3B5IGNhbnZhcyBzdGF0ZVxuICAgKiAyLiBhdCBldmVyeSBmcmFtZTpcbiAgICogICAgMi4xLiBzYXZlXG4gICAqICAgIDIuMi4gcmVkcmF3IHRoZSBjYW52YXMgZnJvbSBzYXZlZCBvbmVcbiAgICogICAgMi4zLiB0cmFuc2Zvcm1cbiAgICogICAgMi40LiBkcmF3IHBhdGhcbiAgICogICAgMi41LiByZXN0b3JlXG4gICAqXG4gICAqIEBwYXJhbSAge0wuUGF0aH0gICAgICAgICBsYXllclxuICAgKiBAcGFyYW0gIHtBcnJheS48TnVtYmVyPn0gbWF0cml4XG4gICAqL1xuICB0cmFuc2Zvcm1QYXRoOiBmdW5jdGlvbihsYXllciwgbWF0cml4KSB7XG4gICAgdmFyIGNvcHkgPSB0aGlzLl9jb250YWluZXJDb3B5O1xuICAgIHZhciBjdHggPSB0aGlzLl9jdHg7XG4gICAgdmFyIG0gPSBMLkJyb3dzZXIucmV0aW5hID8gMiA6IDE7XG4gICAgdmFyIGJvdW5kcyA9IHRoaXMuX2JvdW5kcztcbiAgICB2YXIgc2l6ZSA9IGJvdW5kcy5nZXRTaXplKCk7XG4gICAgdmFyIHBvcyA9IGJvdW5kcy5taW47XG5cbiAgICBpZiAoIWNvcHkpIHtcbiAgICAgIGNvcHkgPSB0aGlzLl9jb250YWluZXJDb3B5ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2FudmFzJyk7XG4gICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGNvcHkpO1xuXG4gICAgICBjb3B5LndpZHRoID0gbSAqIHNpemUueDtcbiAgICAgIGNvcHkuaGVpZ2h0ID0gbSAqIHNpemUueTtcblxuICAgICAgbGF5ZXIuX3JlbW92ZWQgPSB0cnVlO1xuICAgICAgdGhpcy5fcmVkcmF3KCk7XG5cbiAgICAgIGNvcHkuZ2V0Q29udGV4dCgnMmQnKS50cmFuc2xhdGUobSAqIGJvdW5kcy5taW4ueCwgbSAqIGJvdW5kcy5taW4ueSk7XG4gICAgICBjb3B5LmdldENvbnRleHQoJzJkJykuZHJhd0ltYWdlKHRoaXMuX2NvbnRhaW5lciwgMCwgMCk7XG4gICAgICB0aGlzLl9pbml0UGF0aChsYXllcik7XG4gICAgICBsYXllci5fY29udGFpbnNQb2ludF8gPSBsYXllci5fY29udGFpbnNQb2ludDtcbiAgICAgIGxheWVyLl9jb250YWluc1BvaW50ID0gTC5VdGlsLnRydWVGbjtcbiAgICB9XG5cbiAgICBjdHguc2F2ZSgpO1xuICAgIGN0eC5jbGVhclJlY3QocG9zLngsIHBvcy55LCBzaXplLnggKiBtLCBzaXplLnkgKiBtKTtcbiAgICBjdHguc2V0VHJhbnNmb3JtKDEsIDAsIDAsIDEsIDAsIDApO1xuICAgIGN0eC5yZXN0b3JlKCk7XG4gICAgY3R4LnNhdmUoKTtcblxuICAgIGN0eC5kcmF3SW1hZ2UodGhpcy5fY29udGFpbmVyQ29weSwgMCwgMCwgc2l6ZS54LCBzaXplLnkpO1xuICAgIGN0eC50cmFuc2Zvcm0uYXBwbHkoY3R4LCBtYXRyaXgpO1xuXG4gICAgdmFyIGxheWVycyA9IHRoaXMuX2xheWVycztcbiAgICB0aGlzLl9sYXllcnMgPSB7fTtcblxuICAgIHRoaXMuX2luaXRQYXRoKGxheWVyKTtcbiAgICBsYXllci5fdXBkYXRlUGF0aCgpO1xuXG4gICAgdGhpcy5fbGF5ZXJzID0gbGF5ZXJzO1xuICAgIGN0eC5yZXN0b3JlKCk7XG4gIH1cblxufSk7XG4iLCIvKipcbiAqIERyYWcgaGFuZGxlclxuICogQGNsYXNzIEwuUGF0aC5EcmFnXG4gKiBAZXh0ZW5kcyB7TC5IYW5kbGVyfVxuICovXG5MLkhhbmRsZXIuUGF0aERyYWcgPSBMLkhhbmRsZXIuZXh0ZW5kKCAvKiogQGxlbmRzICBMLlBhdGguRHJhZy5wcm90b3R5cGUgKi8ge1xuXG4gIHN0YXRpY3M6IHtcbiAgICBEUkFHR0lOR19DTFM6ICdsZWFmbGV0LXBhdGgtZHJhZ2dhYmxlJyxcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0gIHtMLlBhdGh9IHBhdGhcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqL1xuICBpbml0aWFsaXplOiBmdW5jdGlvbihwYXRoKSB7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TC5QYXRofVxuICAgICAqL1xuICAgIHRoaXMuX3BhdGggPSBwYXRoO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0FycmF5LjxOdW1iZXI+fVxuICAgICAqL1xuICAgIHRoaXMuX21hdHJpeCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TC5Qb2ludH1cbiAgICAgKi9cbiAgICB0aGlzLl9zdGFydFBvaW50ID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLlBvaW50fVxuICAgICAqL1xuICAgIHRoaXMuX2RyYWdTdGFydFBvaW50ID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtCb29sZWFufVxuICAgICAqL1xuICAgIHRoaXMuX21hcERyYWdnaW5nV2FzRW5hYmxlZCA9IGZhbHNlO1xuXG4gIH0sXG5cbiAgLyoqXG4gICAqIEVuYWJsZSBkcmFnZ2luZ1xuICAgKi9cbiAgYWRkSG9va3M6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuX3BhdGgub24oJ21vdXNlZG93bicsIHRoaXMuX29uRHJhZ1N0YXJ0LCB0aGlzKTtcblxuICAgIHRoaXMuX3BhdGgub3B0aW9ucy5jbGFzc05hbWUgPSB0aGlzLl9wYXRoLm9wdGlvbnMuY2xhc3NOYW1lID9cbiAgICAgICAgKHRoaXMuX3BhdGgub3B0aW9ucy5jbGFzc05hbWUgKyAnICcgKyBMLkhhbmRsZXIuUGF0aERyYWcuRFJBR0dJTkdfQ0xTKSA6XG4gICAgICAgICBMLkhhbmRsZXIuUGF0aERyYWcuRFJBR0dJTkdfQ0xTO1xuXG4gICAgaWYgKHRoaXMuX3BhdGguX3BhdGgpIHtcbiAgICAgIEwuRG9tVXRpbC5hZGRDbGFzcyh0aGlzLl9wYXRoLl9wYXRoLCBMLkhhbmRsZXIuUGF0aERyYWcuRFJBR0dJTkdfQ0xTKTtcbiAgICB9XG4gIH0sXG5cbiAgLyoqXG4gICAqIERpc2FibGUgZHJhZ2dpbmdcbiAgICovXG4gIHJlbW92ZUhvb2tzOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLl9wYXRoLm9mZignbW91c2Vkb3duJywgdGhpcy5fb25EcmFnU3RhcnQsIHRoaXMpO1xuXG4gICAgdGhpcy5fcGF0aC5vcHRpb25zLmNsYXNzTmFtZSA9IHRoaXMuX3BhdGgub3B0aW9ucy5jbGFzc05hbWVcbiAgICAgIC5yZXBsYWNlKG5ldyBSZWdFeHAoJ1xcXFxzKycgKyBMLkhhbmRsZXIuUGF0aERyYWcuRFJBR0dJTkdfQ0xTKSwgJycpO1xuICAgIGlmICh0aGlzLl9wYXRoLl9wYXRoKSB7XG4gICAgICBMLkRvbVV0aWwucmVtb3ZlQ2xhc3ModGhpcy5fcGF0aC5fcGF0aCwgTC5IYW5kbGVyLlBhdGhEcmFnLkRSQUdHSU5HX0NMUyk7XG4gICAgfVxuICB9LFxuXG4gIC8qKlxuICAgKiBAcmV0dXJuIHtCb29sZWFufVxuICAgKi9cbiAgbW92ZWQ6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLl9wYXRoLl9kcmFnTW92ZWQ7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFN0YXJ0IGRyYWdcbiAgICogQHBhcmFtICB7TC5Nb3VzZUV2ZW50fSBldnRcbiAgICovXG4gIF9vbkRyYWdTdGFydDogZnVuY3Rpb24oZXZ0KSB7XG4gICAgdmFyIGV2ZW50VHlwZSA9IGV2dC5vcmlnaW5hbEV2ZW50Ll9zaW11bGF0ZWQgPyAndG91Y2hzdGFydCcgOiBldnQub3JpZ2luYWxFdmVudC50eXBlO1xuXG4gICAgdGhpcy5fbWFwRHJhZ2dpbmdXYXNFbmFibGVkID0gZmFsc2U7XG4gICAgdGhpcy5fc3RhcnRQb2ludCA9IGV2dC5jb250YWluZXJQb2ludC5jbG9uZSgpO1xuICAgIHRoaXMuX2RyYWdTdGFydFBvaW50ID0gZXZ0LmNvbnRhaW5lclBvaW50LmNsb25lKCk7XG4gICAgdGhpcy5fbWF0cml4ID0gWzEsIDAsIDAsIDEsIDAsIDBdO1xuICAgIEwuRG9tRXZlbnQuc3RvcChldnQub3JpZ2luYWxFdmVudCk7XG5cbiAgICBMLkRvbVV0aWwuYWRkQ2xhc3ModGhpcy5fcGF0aC5fcmVuZGVyZXIuX2NvbnRhaW5lciwgJ2xlYWZsZXQtaW50ZXJhY3RpdmUnKTtcbiAgICBMLkRvbUV2ZW50XG4gICAgICAub24oZG9jdW1lbnQsIEwuRHJhZ2dhYmxlLk1PVkVbZXZlbnRUeXBlXSwgdGhpcy5fb25EcmFnLCAgICB0aGlzKVxuICAgICAgLm9uKGRvY3VtZW50LCBMLkRyYWdnYWJsZS5FTkRbZXZlbnRUeXBlXSwgIHRoaXMuX29uRHJhZ0VuZCwgdGhpcyk7XG5cbiAgICBpZiAodGhpcy5fcGF0aC5fbWFwLmRyYWdnaW5nLmVuYWJsZWQoKSkge1xuICAgICAgLy8gSSBndWVzcyBpdCdzIHJlcXVpcmVkIGJlY2F1c2UgbW91c2Rvd24gZ2V0cyBzaW11bGF0ZWQgd2l0aCBhIGRlbGF5XG4gICAgICAvL3RoaXMuX3BhdGguX21hcC5kcmFnZ2luZy5fZHJhZ2dhYmxlLl9vblVwKGV2dCk7XG5cbiAgICAgIHRoaXMuX3BhdGguX21hcC5kcmFnZ2luZy5kaXNhYmxlKCk7XG4gICAgICB0aGlzLl9tYXBEcmFnZ2luZ1dhc0VuYWJsZWQgPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLl9wYXRoLl9kcmFnTW92ZWQgPSBmYWxzZTtcblxuICAgIGlmICh0aGlzLl9wYXRoLl9wb3B1cCkgeyAvLyB0aGF0IG1pZ2h0IGJlIGEgY2FzZSBvbiB0b3VjaCBkZXZpY2VzIGFzIHdlbGxcbiAgICAgIHRoaXMuX3BhdGguX3BvcHVwLl9jbG9zZSgpO1xuICAgIH1cblxuICAgIHRoaXMuX3JlcGxhY2VDb29yZEdldHRlcnMoZXZ0KTtcbiAgfSxcblxuICAvKipcbiAgICogRHJhZ2dpbmdcbiAgICogQHBhcmFtICB7TC5Nb3VzZUV2ZW50fSBldnRcbiAgICovXG4gIF9vbkRyYWc6IGZ1bmN0aW9uKGV2dCkge1xuICAgIEwuRG9tRXZlbnQuc3RvcChldnQpO1xuXG4gICAgdmFyIGZpcnN0ID0gKGV2dC50b3VjaGVzICYmIGV2dC50b3VjaGVzLmxlbmd0aCA+PSAxID8gZXZ0LnRvdWNoZXNbMF0gOiBldnQpO1xuICAgIHZhciBjb250YWluZXJQb2ludCA9IHRoaXMuX3BhdGguX21hcC5tb3VzZUV2ZW50VG9Db250YWluZXJQb2ludChmaXJzdCk7XG5cbiAgICB2YXIgeCA9IGNvbnRhaW5lclBvaW50Lng7XG4gICAgdmFyIHkgPSBjb250YWluZXJQb2ludC55O1xuXG4gICAgdmFyIGR4ID0geCAtIHRoaXMuX3N0YXJ0UG9pbnQueDtcbiAgICB2YXIgZHkgPSB5IC0gdGhpcy5fc3RhcnRQb2ludC55O1xuXG4gICAgaWYgKCF0aGlzLl9wYXRoLl9kcmFnTW92ZWQgJiYgKGR4IHx8IGR5KSkge1xuICAgICAgdGhpcy5fcGF0aC5fZHJhZ01vdmVkID0gdHJ1ZTtcbiAgICAgIHRoaXMuX3BhdGguZmlyZSgnZHJhZ3N0YXJ0JywgZXZ0KTtcbiAgICAgIC8vIHdlIGRvbid0IHdhbnQgdGhhdCB0byBoYXBwZW4gb24gY2xpY2tcbiAgICAgIHRoaXMuX3BhdGguYnJpbmdUb0Zyb250KCk7XG4gICAgfVxuXG4gICAgdGhpcy5fbWF0cml4WzRdICs9IGR4O1xuICAgIHRoaXMuX21hdHJpeFs1XSArPSBkeTtcblxuICAgIHRoaXMuX3N0YXJ0UG9pbnQueCA9IHg7XG4gICAgdGhpcy5fc3RhcnRQb2ludC55ID0geTtcblxuICAgIHRoaXMuX3BhdGguZmlyZSgncHJlZHJhZycsIGV2dCk7XG4gICAgdGhpcy5fcGF0aC5fdHJhbnNmb3JtKHRoaXMuX21hdHJpeCk7XG4gICAgdGhpcy5fcGF0aC5maXJlKCdkcmFnJywgZXZ0KTtcbiAgfSxcblxuICAvKipcbiAgICogRHJhZ2dpbmcgc3RvcHBlZCwgYXBwbHlcbiAgICogQHBhcmFtICB7TC5Nb3VzZUV2ZW50fSBldnRcbiAgICovXG4gIF9vbkRyYWdFbmQ6IGZ1bmN0aW9uKGV2dCkge1xuICAgIHZhciBjb250YWluZXJQb2ludCA9IHRoaXMuX3BhdGguX21hcC5tb3VzZUV2ZW50VG9Db250YWluZXJQb2ludChldnQpO1xuICAgIHZhciBtb3ZlZCA9IHRoaXMubW92ZWQoKTtcblxuICAgIC8vIGFwcGx5IG1hdHJpeFxuICAgIGlmIChtb3ZlZCkge1xuICAgICAgdGhpcy5fdHJhbnNmb3JtUG9pbnRzKHRoaXMuX21hdHJpeCk7XG4gICAgICB0aGlzLl9wYXRoLl91cGRhdGVQYXRoKCk7XG4gICAgICB0aGlzLl9wYXRoLl9wcm9qZWN0KCk7XG4gICAgICB0aGlzLl9wYXRoLl90cmFuc2Zvcm0obnVsbCk7XG5cbiAgICAgIEwuRG9tRXZlbnQuc3RvcChldnQpO1xuICAgIH1cblxuXG4gICAgTC5Eb21FdmVudFxuICAgICAgLm9mZihkb2N1bWVudCwgJ21vdXNlbW92ZSB0b3VjaG1vdmUnLCB0aGlzLl9vbkRyYWcsIHRoaXMpXG4gICAgICAub2ZmKGRvY3VtZW50LCAnbW91c2V1cCB0b3VjaGVuZCcsICAgIHRoaXMuX29uRHJhZ0VuZCwgdGhpcyk7XG5cbiAgICB0aGlzLl9yZXN0b3JlQ29vcmRHZXR0ZXJzKCk7XG5cbiAgICAvLyBjb25zaXN0ZW5jeVxuICAgIGlmIChtb3ZlZCkge1xuICAgICAgdGhpcy5fcGF0aC5maXJlKCdkcmFnZW5kJywge1xuICAgICAgICBkaXN0YW5jZTogTWF0aC5zcXJ0KFxuICAgICAgICAgIEwuTGluZVV0aWwuX3NxRGlzdCh0aGlzLl9kcmFnU3RhcnRQb2ludCwgY29udGFpbmVyUG9pbnQpXG4gICAgICAgIClcbiAgICAgIH0pO1xuXG4gICAgICAvLyBoYWNrIGZvciBza2lwcGluZyB0aGUgY2xpY2sgaW4gY2FudmFzLXJlbmRlcmVkIGxheWVyc1xuICAgICAgdmFyIGNvbnRhaW5zID0gdGhpcy5fcGF0aC5fY29udGFpbnNQb2ludDtcbiAgICAgIHRoaXMuX3BhdGguX2NvbnRhaW5zUG9pbnQgPSBMLlV0aWwuZmFsc2VGbjtcbiAgICAgIEwuVXRpbC5yZXF1ZXN0QW5pbUZyYW1lKGZ1bmN0aW9uKCkge1xuICAgICAgICBMLkRvbUV2ZW50Ll9za2lwcGVkKHsgdHlwZTogJ2NsaWNrJyB9KTtcbiAgICAgICAgdGhpcy5fcGF0aC5fY29udGFpbnNQb2ludCA9IGNvbnRhaW5zO1xuICAgICAgfSwgdGhpcyk7XG4gICAgfVxuXG4gICAgdGhpcy5fbWF0cml4ICAgICAgICAgID0gbnVsbDtcbiAgICB0aGlzLl9zdGFydFBvaW50ICAgICAgPSBudWxsO1xuICAgIHRoaXMuX2RyYWdTdGFydFBvaW50ICA9IG51bGw7XG4gICAgdGhpcy5fcGF0aC5fZHJhZ01vdmVkID0gZmFsc2U7XG5cbiAgICBpZiAodGhpcy5fbWFwRHJhZ2dpbmdXYXNFbmFibGVkKSB7XG4gICAgICBMLkRvbUV2ZW50Ll9mYWtlU3RvcCh7IHR5cGU6ICdjbGljaycgfSk7XG4gICAgICB0aGlzLl9wYXRoLl9tYXAuZHJhZ2dpbmcuZW5hYmxlKCk7XG4gICAgfVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIEFwcGxpZXMgdHJhbnNmb3JtYXRpb24sIGRvZXMgaXQgaW4gb25lIHN3ZWVwIGZvciBwZXJmb3JtYW5jZSxcbiAgICogc28gZG9uJ3QgYmUgc3VycHJpc2VkIGFib3V0IHRoZSBjb2RlIHJlcGV0aXRpb24uXG4gICAqXG4gICAqIFsgeCBdICAgWyBhICBiICB0eCBdIFsgeCBdICAgWyBhICogeCArIGIgKiB5ICsgdHggXVxuICAgKiBbIHkgXSA9IFsgYyAgZCAgdHkgXSBbIHkgXSA9IFsgYyAqIHggKyBkICogeSArIHR5IF1cbiAgICpcbiAgICogQHBhcmFtIHtBcnJheS48TnVtYmVyPn0gbWF0cml4XG4gICAqL1xuICBfdHJhbnNmb3JtUG9pbnRzOiBmdW5jdGlvbihtYXRyaXgsIGRlc3QpIHtcbiAgICB2YXIgcGF0aCA9IHRoaXMuX3BhdGg7XG4gICAgdmFyIGksIGxlbiwgbGF0bG5nO1xuXG4gICAgdmFyIHB4ID0gTC5wb2ludChtYXRyaXhbNF0sIG1hdHJpeFs1XSk7XG5cbiAgICB2YXIgY3JzID0gcGF0aC5fbWFwLm9wdGlvbnMuY3JzO1xuICAgIHZhciB0cmFuc2Zvcm1hdGlvbiA9IGNycy50cmFuc2Zvcm1hdGlvbjtcbiAgICB2YXIgc2NhbGUgPSBjcnMuc2NhbGUocGF0aC5fbWFwLmdldFpvb20oKSk7XG4gICAgdmFyIHByb2plY3Rpb24gPSBjcnMucHJvamVjdGlvbjtcblxuICAgIHZhciBkaWZmID0gdHJhbnNmb3JtYXRpb24udW50cmFuc2Zvcm0ocHgsIHNjYWxlKVxuICAgICAgLnN1YnRyYWN0KHRyYW5zZm9ybWF0aW9uLnVudHJhbnNmb3JtKEwucG9pbnQoMCwgMCksIHNjYWxlKSk7XG4gICAgdmFyIGFwcGx5VHJhbnNmb3JtID0gIWRlc3Q7XG5cbiAgICBwYXRoLl9ib3VuZHMgPSBuZXcgTC5MYXRMbmdCb3VuZHMoKTtcblxuICAgIC8vIGNvbnNvbGUudGltZSgndHJhbnNmb3JtJyk7XG4gICAgLy8gYWxsIHNoaWZ0cyBhcmUgaW4tcGxhY2VcbiAgICBpZiAocGF0aC5fcG9pbnQpIHsgLy8gTC5DaXJjbGVcbiAgICAgIGRlc3QgPSBwcm9qZWN0aW9uLnVucHJvamVjdChcbiAgICAgICAgcHJvamVjdGlvbi5wcm9qZWN0KHBhdGguX2xhdGxuZykuX2FkZChkaWZmKSk7XG4gICAgICBpZiAoYXBwbHlUcmFuc2Zvcm0pIHtcbiAgICAgICAgcGF0aC5fbGF0bG5nID0gZGVzdDtcbiAgICAgICAgcGF0aC5fcG9pbnQuX2FkZChweCk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChwYXRoLl9yaW5ncyB8fCBwYXRoLl9wYXJ0cykgeyAvLyBldmVyeXRoaW5nIGVsc2VcbiAgICAgIHZhciByaW5ncyAgID0gcGF0aC5fcmluZ3MgfHwgcGF0aC5fcGFydHM7XG4gICAgICB2YXIgbGF0bG5ncyA9IHBhdGguX2xhdGxuZ3M7XG4gICAgICBkZXN0ID0gZGVzdCB8fCBsYXRsbmdzO1xuICAgICAgaWYgKCFMLlV0aWwuaXNBcnJheShsYXRsbmdzWzBdKSkgeyAvLyBwb2x5bGluZVxuICAgICAgICBsYXRsbmdzID0gW2xhdGxuZ3NdO1xuICAgICAgICBkZXN0ICAgID0gW2Rlc3RdO1xuICAgICAgfVxuICAgICAgZm9yIChpID0gMCwgbGVuID0gcmluZ3MubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgZGVzdFtpXSA9IGRlc3RbaV0gfHwgW107XG4gICAgICAgIGZvciAodmFyIGogPSAwLCBqaiA9IHJpbmdzW2ldLmxlbmd0aDsgaiA8IGpqOyBqKyspIHtcbiAgICAgICAgICBsYXRsbmcgICAgID0gbGF0bG5nc1tpXVtqXTtcbiAgICAgICAgICBkZXN0W2ldW2pdID0gcHJvamVjdGlvblxuICAgICAgICAgICAgLnVucHJvamVjdChwcm9qZWN0aW9uLnByb2plY3QobGF0bG5nKS5fYWRkKGRpZmYpKTtcbiAgICAgICAgICBpZiAoYXBwbHlUcmFuc2Zvcm0pIHtcbiAgICAgICAgICAgIHBhdGguX2JvdW5kcy5leHRlbmQobGF0bG5nc1tpXVtqXSk7XG4gICAgICAgICAgICByaW5nc1tpXVtqXS5fYWRkKHB4KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGRlc3Q7XG4gICAgLy8gY29uc29sZS50aW1lRW5kKCd0cmFuc2Zvcm0nKTtcbiAgfSxcblxuXG5cbiAgLyoqXG4gICAqIElmIHlvdSB3YW50IHRvIHJlYWQgdGhlIGxhdGxuZ3MgZHVyaW5nIHRoZSBkcmFnIC0geW91ciByaWdodCxcbiAgICogYnV0IHRoZXkgaGF2ZSB0byBiZSB0cmFuc2Zvcm1lZFxuICAgKi9cbiAgX3JlcGxhY2VDb29yZEdldHRlcnM6IGZ1bmN0aW9uKCkge1xuICAgIGlmICh0aGlzLl9wYXRoLmdldExhdExuZykgeyAvLyBDaXJjbGUsIENpcmNsZU1hcmtlclxuICAgICAgdGhpcy5fcGF0aC5nZXRMYXRMbmdfID0gdGhpcy5fcGF0aC5nZXRMYXRMbmc7XG4gICAgICB0aGlzLl9wYXRoLmdldExhdExuZyA9IEwuVXRpbC5iaW5kKGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5kcmFnZ2luZy5fdHJhbnNmb3JtUG9pbnRzKHRoaXMuZHJhZ2dpbmcuX21hdHJpeCwge30pO1xuICAgICAgfSwgdGhpcy5fcGF0aCk7XG4gICAgfSBlbHNlIGlmICh0aGlzLl9wYXRoLmdldExhdExuZ3MpIHtcbiAgICAgIHRoaXMuX3BhdGguZ2V0TGF0TG5nc18gPSB0aGlzLl9wYXRoLmdldExhdExuZ3M7XG4gICAgICB0aGlzLl9wYXRoLmdldExhdExuZ3MgPSBMLlV0aWwuYmluZChmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZHJhZ2dpbmcuX3RyYW5zZm9ybVBvaW50cyh0aGlzLmRyYWdnaW5nLl9tYXRyaXgsIFtdKTtcbiAgICAgIH0sIHRoaXMuX3BhdGgpO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBQdXQgYmFjayB0aGUgZ2V0dGVyc1xuICAgKi9cbiAgX3Jlc3RvcmVDb29yZEdldHRlcnM6IGZ1bmN0aW9uKCkge1xuICAgIGlmICh0aGlzLl9wYXRoLmdldExhdExuZ18pIHtcbiAgICAgIHRoaXMuX3BhdGguZ2V0TGF0TG5nID0gdGhpcy5fcGF0aC5nZXRMYXRMbmdfO1xuICAgICAgZGVsZXRlIHRoaXMuX3BhdGguZ2V0TGF0TG5nXztcbiAgICB9IGVsc2UgaWYgKHRoaXMuX3BhdGguZ2V0TGF0TG5nc18pIHtcbiAgICAgIHRoaXMuX3BhdGguZ2V0TGF0TG5ncyA9IHRoaXMuX3BhdGguZ2V0TGF0TG5nc187XG4gICAgICBkZWxldGUgdGhpcy5fcGF0aC5nZXRMYXRMbmdzXztcbiAgICB9XG4gIH1cblxufSk7XG5cblxuLyoqXG4gKiBAcGFyYW0gIHtMLlBhdGh9IGxheWVyXG4gKiBAcmV0dXJuIHtMLlBhdGh9XG4gKi9cbkwuSGFuZGxlci5QYXRoRHJhZy5tYWtlRHJhZ2dhYmxlID0gZnVuY3Rpb24obGF5ZXIpIHtcbiAgbGF5ZXIuZHJhZ2dpbmcgPSBuZXcgTC5IYW5kbGVyLlBhdGhEcmFnKGxheWVyKTtcbiAgcmV0dXJuIGxheWVyO1xufTtcblxuXG4vKipcbiAqIEFsc28gZXhwb3NlIGFzIGEgbWV0aG9kXG4gKiBAcmV0dXJuIHtMLlBhdGh9XG4gKi9cbkwuUGF0aC5wcm90b3R5cGUubWFrZURyYWdnYWJsZSA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gTC5IYW5kbGVyLlBhdGhEcmFnLm1ha2VEcmFnZ2FibGUodGhpcyk7XG59O1xuXG5cbkwuUGF0aC5hZGRJbml0SG9vayhmdW5jdGlvbigpIHtcbiAgaWYgKHRoaXMub3B0aW9ucy5kcmFnZ2FibGUpIHtcbiAgICAvLyBlbnN1cmUgaW50ZXJhY3RpdmVcbiAgICB0aGlzLm9wdGlvbnMuaW50ZXJhY3RpdmUgPSB0cnVlO1xuXG4gICAgaWYgKHRoaXMuZHJhZ2dpbmcpIHtcbiAgICAgIHRoaXMuZHJhZ2dpbmcuZW5hYmxlKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIEwuSGFuZGxlci5QYXRoRHJhZy5tYWtlRHJhZ2dhYmxlKHRoaXMpO1xuICAgICAgdGhpcy5kcmFnZ2luZy5lbmFibGUoKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAodGhpcy5kcmFnZ2luZykge1xuICAgIHRoaXMuZHJhZ2dpbmcuZGlzYWJsZSgpO1xuICB9XG59KTtcbiIsIi8qKlxuICogTGVhZmxldCB2ZWN0b3IgZmVhdHVyZXMgZHJhZyBmdW5jdGlvbmFsaXR5XG4gKiBAYXV0aG9yIEFsZXhhbmRlciBNaWxldnNraSA8aW5mb0B3OHIubmFtZT5cbiAqIEBwcmVzZXJ2ZVxuICovXG5cbi8qKlxuICogTWF0cml4IHRyYW5zZm9ybSBwYXRoIGZvciBTVkcvVk1MXG4gKiBSZW5kZXJlci1pbmRlcGVuZGVudFxuICovXG5MLlBhdGguaW5jbHVkZSh7XG5cblx0LyoqXG5cdCAqIEFwcGxpZXMgbWF0cml4IHRyYW5zZm9ybWF0aW9uIHRvIFNWR1xuXHQgKiBAcGFyYW0ge0FycmF5LjxOdW1iZXI+P30gbWF0cml4XG5cdCAqL1xuXHRfdHJhbnNmb3JtOiBmdW5jdGlvbihtYXRyaXgpIHtcblx0XHRpZiAodGhpcy5fcmVuZGVyZXIpIHtcblx0XHRcdGlmIChtYXRyaXgpIHtcblx0XHRcdFx0dGhpcy5fcmVuZGVyZXIudHJhbnNmb3JtUGF0aCh0aGlzLCBtYXRyaXgpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gcmVzZXQgdHJhbnNmb3JtIG1hdHJpeFxuXHRcdFx0XHR0aGlzLl9yZW5kZXJlci5fcmVzZXRUcmFuc2Zvcm1QYXRoKHRoaXMpO1xuXHRcdFx0XHR0aGlzLl91cGRhdGUoKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblx0LyoqXG5cdCAqIENoZWNrIGlmIHRoZSBmZWF0dXJlIHdhcyBkcmFnZ2VkLCB0aGF0J2xsIHN1cHJlc3MgdGhlIGNsaWNrIGV2ZW50XG5cdCAqIG9uIG1vdXNldXAuIFRoYXQgZml4ZXMgcG9wdXBzIGZvciBleGFtcGxlXG5cdCAqXG5cdCAqIEBwYXJhbSAge01vdXNlRXZlbnR9IGVcblx0ICovXG5cdF9vbk1vdXNlQ2xpY2s6IGZ1bmN0aW9uKGUpIHtcblx0XHRpZiAoKHRoaXMuZHJhZ2dpbmcgJiYgdGhpcy5kcmFnZ2luZy5tb3ZlZCgpKSB8fFxuXHRcdFx0KHRoaXMuX21hcC5kcmFnZ2luZyAmJiB0aGlzLl9tYXAuZHJhZ2dpbmcubW92ZWQoKSkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9maXJlTW91c2VFdmVudChlKTtcblx0fVxuXG59KTtcbiIsIkwuU1ZHLmluY2x1ZGUoIUwuQnJvd3Nlci52bWwgPyB7fSA6IHtcblxuXHQvKipcblx0ICogUmVzZXQgdHJhbnNmb3JtIG1hdHJpeFxuXHQgKi9cblx0X3Jlc2V0VHJhbnNmb3JtUGF0aDogZnVuY3Rpb24obGF5ZXIpIHtcblx0XHRpZiAobGF5ZXIuX3NrZXcpIHtcblx0XHRcdC8vIHN1cGVyIGltcG9ydGFudCEgd29ya2Fyb3VuZCBmb3IgYSAnanVtcGluZycgZ2xpdGNoOlxuXHRcdFx0Ly8gZGlzYWJsZSB0cmFuc2Zvcm0gYmVmb3JlIHJlbW92aW5nIGl0XG5cdFx0XHRsYXllci5fc2tldy5vbiA9IGZhbHNlO1xuXHRcdFx0bGF5ZXIuX3BhdGgucmVtb3ZlQ2hpbGQobGF5ZXIuX3NrZXcpO1xuXHRcdFx0bGF5ZXIuX3NrZXcgPSBudWxsO1xuXHRcdH1cblx0fSxcblxuXHQvKipcblx0ICogQXBwbGllcyBtYXRyaXggdHJhbnNmb3JtYXRpb24gdG8gVk1MXG5cdCAqIEBwYXJhbSB7TC5QYXRofSAgICAgICAgIGxheWVyXG5cdCAqIEBwYXJhbSB7QXJyYXkuPE51bWJlcj59IG1hdHJpeFxuXHQgKi9cblx0dHJhbnNmb3JtUGF0aDogZnVuY3Rpb24obGF5ZXIsIG1hdHJpeCkge1xuXHRcdHZhciBza2V3ID0gbGF5ZXIuX3NrZXc7XG5cblx0XHRpZiAoIXNrZXcpIHtcblx0XHRcdHNrZXcgPSBMLlNWRy5jcmVhdGUoJ3NrZXcnKTtcblx0XHRcdGxheWVyLl9wYXRoLmFwcGVuZENoaWxkKHNrZXcpO1xuXHRcdFx0c2tldy5zdHlsZS5iZWhhdmlvciA9ICd1cmwoI2RlZmF1bHQjVk1MKSc7XG5cdFx0XHRsYXllci5fc2tldyA9IHNrZXc7XG5cdFx0fVxuXG5cdFx0Ly8gaGFuZGxlIHNrZXcvdHJhbnNsYXRlIHNlcGFyYXRlbHksIGNhdXNlIGl0J3MgYnJva2VuXG5cdFx0dmFyIG10ID0gbWF0cml4WzBdLnRvRml4ZWQoOCkgKyAnICcgKyBtYXRyaXhbMV0udG9GaXhlZCg4KSArICcgJyArXG5cdFx0XHRtYXRyaXhbMl0udG9GaXhlZCg4KSArICcgJyArIG1hdHJpeFszXS50b0ZpeGVkKDgpICsgJyAwIDAnO1xuXHRcdHZhciBvZmZzZXQgPSBNYXRoLmZsb29yKG1hdHJpeFs0XSkudG9GaXhlZCgpICsgJywgJyArXG5cdFx0XHRNYXRoLmZsb29yKG1hdHJpeFs1XSkudG9GaXhlZCgpICsgJyc7XG5cblx0XHR2YXIgcyA9IHRoaXMuX3BhdGguc3R5bGU7XG5cdFx0dmFyIGwgPSBwYXJzZUZsb2F0KHMubGVmdCk7XG5cdFx0dmFyIHQgPSBwYXJzZUZsb2F0KHMudG9wKTtcblx0XHR2YXIgdyA9IHBhcnNlRmxvYXQocy53aWR0aCk7XG5cdFx0dmFyIGggPSBwYXJzZUZsb2F0KHMuaGVpZ2h0KTtcblxuXHRcdGlmIChpc05hTihsKSkgeyBsID0gMDsgfVxuXHRcdGlmIChpc05hTih0KSkgeyB0ID0gMDsgfVxuXHRcdGlmIChpc05hTih3KSB8fCAhdykgeyB3ID0gMTsgfVxuXHRcdGlmIChpc05hTihoKSB8fCAhaCkgeyBoID0gMTsgfVxuXG5cdFx0dmFyIG9yaWdpbiA9ICgtbCAvIHcgLSAwLjUpLnRvRml4ZWQoOCkgKyAnICcgKyAoLXQgLyBoIC0gMC41KS50b0ZpeGVkKDgpO1xuXG5cdFx0c2tldy5vbiA9ICdmJztcblx0XHRza2V3Lm1hdHJpeCA9IG10O1xuXHRcdHNrZXcub3JpZ2luID0gb3JpZ2luO1xuXHRcdHNrZXcub2Zmc2V0ID0gb2Zmc2V0O1xuXHRcdHNrZXcub24gPSB0cnVlO1xuXHR9XG5cbn0pO1xuIiwiTC5TVkcuaW5jbHVkZSh7XG5cblx0LyoqXG5cdCAqIFJlc2V0IHRyYW5zZm9ybSBtYXRyaXhcblx0ICovXG5cdF9yZXNldFRyYW5zZm9ybVBhdGg6IGZ1bmN0aW9uKGxheWVyKSB7XG5cdFx0bGF5ZXIuX3BhdGguc2V0QXR0cmlidXRlTlMobnVsbCwgJ3RyYW5zZm9ybScsICcnKTtcblx0fSxcblxuXHQvKipcblx0ICogQXBwbGllcyBtYXRyaXggdHJhbnNmb3JtYXRpb24gdG8gU1ZHXG5cdCAqIEBwYXJhbSB7TC5QYXRofSAgICAgICAgIGxheWVyXG5cdCAqIEBwYXJhbSB7QXJyYXkuPE51bWJlcj59IG1hdHJpeFxuXHQgKi9cblx0dHJhbnNmb3JtUGF0aDogZnVuY3Rpb24obGF5ZXIsIG1hdHJpeCkge1xuXHRcdGxheWVyLl9wYXRoLnNldEF0dHJpYnV0ZU5TKG51bGwsICd0cmFuc2Zvcm0nLFxuXHRcdFx0J21hdHJpeCgnICsgbWF0cml4LmpvaW4oJyAnKSArICcpJyk7XG5cdH1cblxufSk7XG4iLCJ2YXIgTCA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93WydMJ10gOiB0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsWydMJ10gOiBudWxsKTtcblxudmFyIENpcmNsZSA9IG1vZHVsZS5leHBvcnRzID0gTC5DaXJjbGVNYXJrZXIuZXh0ZW5kKHtcblxuICBvcHRpb25zOiB7XG4gICAgdGV4dFN0eWxlOiB7XG4gICAgICBjb2xvcjogJyNmZmYnLFxuICAgICAgZm9udFNpemU6IDEyLFxuICAgICAgZm9udFdlaWdodDogMzAwXG4gICAgfSxcbiAgICBzaGlmdFk6IDcsXG4gIH0sXG5cblxuICAvKipcbiAgICogQGNsYXNzIExhYmVsZWRDaXJjbGVcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqIEBleHRlbmRzIHtMLkNpcmNsZU1hcmtlcn1cbiAgICogQHBhcmFtICB7U3RyaW5nfSAgIHRleHRcbiAgICogQHBhcmFtICB7TC5MYXRMbmd9IGxhdGxuZ1xuICAgKiBAcGFyYW0gIHtPYmplY3Q9fSAgb3B0aW9uc1xuICAgKi9cbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24odGV4dCwgbGF0bG5nLCBvcHRpb25zKSB7XG4gICAgLyoqXG4gICAgICogQHR5cGUge1N0cmluZ31cbiAgICAgKi9cbiAgICB0aGlzLl90ZXh0ICAgICAgICA9IHRleHQ7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7U1ZHVGV4dEVsZW1lbnR9XG4gICAgICovXG4gICAgdGhpcy5fdGV4dEVsZW1lbnQgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1RleHROb2RlfVxuICAgICAqL1xuICAgIHRoaXMuX3RleHROb2RlICAgID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtPYmplY3R8TnVsbH1cbiAgICAgKi9cbiAgICB0aGlzLl90ZXh0TGF5ZXIgICA9IG51bGw7XG5cbiAgICBMLkNpcmNsZU1hcmtlci5wcm90b3R5cGUuaW5pdGlhbGl6ZS5jYWxsKHRoaXMsIGxhdGxuZywgb3B0aW9ucyk7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHBhcmFtIHtTdHJpbmd9IHRleHRcbiAgICogQHJldHVybiB7TGFiZWxlZENpcmNsZX1cbiAgICovXG4gIHNldFRleHQ6IGZ1bmN0aW9uKHRleHQpIHtcbiAgICB0aGlzLl90ZXh0ID0gdGV4dDtcbiAgICBpZiAodGhpcy5fdGV4dE5vZGUpIHtcbiAgICAgIHRoaXMuX3RleHRFbGVtZW50LnJlbW92ZUNoaWxkKHRoaXMuX3RleHROb2RlKTtcbiAgICB9XG4gICAgdGhpcy5fdGV4dE5vZGUgPSBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSh0aGlzLl90ZXh0KTtcbiAgICB0aGlzLl90ZXh0RWxlbWVudC5hcHBlbmRDaGlsZCh0aGlzLl90ZXh0Tm9kZSk7XG5cbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBBbHNvIGJyaW5nIHRleHQgdG8gZnJvbnRcbiAgICogQG92ZXJyaWRlXG4gICAqL1xuICBicmluZ1RvRnJvbnQ6IGZ1bmN0aW9uKCkge1xuICAgIEwuQ2lyY2xlTWFya2VyLnByb3RvdHlwZS5icmluZ1RvRnJvbnQuY2FsbCh0aGlzKTtcbiAgICB0aGlzLl9ncm91cFRleHRUb1BhdGgoKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAb3ZlcnJpZGVcbiAgICovXG4gIGJyaW5nVG9CYWNrOiBmdW5jdGlvbigpIHtcbiAgICBMLkNpcmNsZU1hcmtlci5wcm90b3R5cGUuYnJpbmdUb0JhY2suY2FsbCh0aGlzKTtcbiAgICB0aGlzLl9ncm91cFRleHRUb1BhdGgoKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBQdXQgdGV4dCBpbiB0aGUgcmlnaHQgcG9zaXRpb24gaW4gdGhlIGRvbVxuICAgKi9cbiAgX2dyb3VwVGV4dFRvUGF0aDogZnVuY3Rpb24oKSB7XG4gICAgdmFyIHBhdGggICAgICAgID0gdGhpcy5fcGF0aDtcbiAgICB2YXIgdGV4dEVsZW1lbnQgPSB0aGlzLl90ZXh0RWxlbWVudDtcbiAgICB2YXIgbmV4dCAgICAgICAgPSBwYXRoLm5leHRTaWJsaW5nO1xuICAgIHZhciBwYXJlbnQgICAgICA9IHBhdGgucGFyZW50Tm9kZTtcblxuXG4gICAgaWYgKHRleHRFbGVtZW50ICYmIHBhcmVudCkge1xuICAgICAgaWYgKG5leHQgJiYgbmV4dCAhPT0gdGV4dEVsZW1lbnQpIHtcbiAgICAgICAgcGFyZW50Lmluc2VydEJlZm9yZSh0ZXh0RWxlbWVudCwgbmV4dCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwYXJlbnQuYXBwZW5kQ2hpbGQodGV4dEVsZW1lbnQpO1xuICAgICAgfVxuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBQb3NpdGlvbiB0aGUgdGV4dCBpbiBjb250YWluZXJcbiAgICovXG4gIF91cGRhdGVQYXRoOiBmdW5jdGlvbigpIHtcbiAgICBMLkNpcmNsZU1hcmtlci5wcm90b3R5cGUuX3VwZGF0ZVBhdGguY2FsbCh0aGlzKTtcbiAgICB0aGlzLl91cGRhdGVUZXh0UG9zaXRpb24oKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAb3ZlcnJpZGVcbiAgICovXG4gIF90cmFuc2Zvcm06IGZ1bmN0aW9uKG1hdHJpeCkge1xuICAgIEwuQ2lyY2xlTWFya2VyLnByb3RvdHlwZS5fdHJhbnNmb3JtLmNhbGwodGhpcywgbWF0cml4KTtcblxuICAgIC8vIHdyYXAgdGV4dEVsZW1lbnQgd2l0aCBhIGZha2UgbGF5ZXIgZm9yIHJlbmRlcmVyXG4gICAgLy8gdG8gYmUgYWJsZSB0byB0cmFuc2Zvcm0gaXRcbiAgICB0aGlzLl90ZXh0TGF5ZXIgPSB0aGlzLl90ZXh0TGF5ZXIgfHwgeyBfcGF0aDogdGhpcy5fdGV4dEVsZW1lbnQgfTtcbiAgICBpZiAobWF0cml4KSB7XG4gICAgICB0aGlzLl9yZW5kZXJlci50cmFuc2Zvcm1QYXRoKHRoaXMuX3RleHRMYXllciwgbWF0cml4KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fcmVuZGVyZXIuX3Jlc2V0VHJhbnNmb3JtUGF0aCh0aGlzLl90ZXh0TGF5ZXIpO1xuICAgICAgdGhpcy5fdXBkYXRlVGV4dFBvc2l0aW9uKCk7XG4gICAgICB0aGlzLl90ZXh0TGF5ZXIgPSBudWxsO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0gIHtMLk1hcH0gbWFwXG4gICAqIEByZXR1cm4ge0xhYmVsZWRDaXJjbGV9XG4gICAqL1xuICBvbkFkZDogZnVuY3Rpb24obWFwKSB7XG4gICAgTC5DaXJjbGVNYXJrZXIucHJvdG90eXBlLm9uQWRkLmNhbGwodGhpcywgbWFwKTtcbiAgICB0aGlzLl9pbml0VGV4dCgpO1xuICAgIHRoaXMuX3VwZGF0ZVRleHRQb3NpdGlvbigpO1xuICAgIHRoaXMuc2V0U3R5bGUoKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYW5kIGluc2VydCB0ZXh0XG4gICAqL1xuICBfaW5pdFRleHQ6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuX3RleHRFbGVtZW50ID0gTC5TVkcuY3JlYXRlKCd0ZXh0Jyk7XG4gICAgdGhpcy5zZXRUZXh0KHRoaXMuX3RleHQpO1xuICAgIHRoaXMuX3JlbmRlcmVyLl9yb290R3JvdXAuYXBwZW5kQ2hpbGQodGhpcy5fdGV4dEVsZW1lbnQpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIENhbGN1bGF0ZSBwb3NpdGlvbiBmb3IgdGV4dFxuICAgKi9cbiAgX3VwZGF0ZVRleHRQb3NpdGlvbjogZnVuY3Rpb24oKSB7XG4gICAgdmFyIHRleHRFbGVtZW50ID0gdGhpcy5fdGV4dEVsZW1lbnQ7XG4gICAgaWYgKHRleHRFbGVtZW50KSB7XG4gICAgICB2YXIgYmJveCA9IHRleHRFbGVtZW50LmdldEJCb3goKTtcbiAgICAgIHZhciB0ZXh0UG9zaXRpb24gPSB0aGlzLl9wb2ludC5zdWJ0cmFjdChcbiAgICAgICAgTC5wb2ludChiYm94LndpZHRoLCAtYmJveC5oZWlnaHQgKyB0aGlzLm9wdGlvbnMuc2hpZnRZKS5kaXZpZGVCeSgyKSk7XG5cbiAgICAgIHRleHRFbGVtZW50LnNldEF0dHJpYnV0ZSgneCcsIHRleHRQb3NpdGlvbi54KTtcbiAgICAgIHRleHRFbGVtZW50LnNldEF0dHJpYnV0ZSgneScsIHRleHRQb3NpdGlvbi55KTtcbiAgICAgIHRoaXMuX2dyb3VwVGV4dFRvUGF0aCgpO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBTZXQgdGV4dCBzdHlsZVxuICAgKi9cbiAgc2V0U3R5bGU6IGZ1bmN0aW9uKHN0eWxlKSB7XG4gICAgTC5DaXJjbGVNYXJrZXIucHJvdG90eXBlLnNldFN0eWxlLmNhbGwodGhpcywgc3R5bGUpO1xuICAgIGlmICh0aGlzLl90ZXh0RWxlbWVudCkge1xuICAgICAgdmFyIHN0eWxlcyA9IHRoaXMub3B0aW9ucy50ZXh0U3R5bGU7XG4gICAgICBmb3IgKHZhciBwcm9wIGluIHN0eWxlcykge1xuICAgICAgICBpZiAoc3R5bGVzLmhhc093blByb3BlcnR5KHByb3ApKSB7XG4gICAgICAgICAgdmFyIHN0eWxlUHJvcCA9IHByb3A7XG4gICAgICAgICAgaWYgKHByb3AgPT09ICdjb2xvcicpIHtcbiAgICAgICAgICAgIHN0eWxlUHJvcCA9ICdzdHJva2UnO1xuICAgICAgICAgIH1cbiAgICAgICAgICB0aGlzLl90ZXh0RWxlbWVudC5zdHlsZVtzdHlsZVByb3BdID0gc3R5bGVzW3Byb3BdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIFJlbW92ZSB0ZXh0XG4gICAqL1xuICBvblJlbW92ZTogZnVuY3Rpb24obWFwKSB7XG4gICAgaWYgKHRoaXMuX3RleHRFbGVtZW50KSB7XG4gICAgICBpZiAodGhpcy5fdGV4dEVsZW1lbnQucGFyZW50Tm9kZSkge1xuICAgICAgICB0aGlzLl90ZXh0RWxlbWVudC5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHRoaXMuX3RleHRFbGVtZW50KTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX3RleHRFbGVtZW50ID0gbnVsbDtcbiAgICAgIHRoaXMuX3RleHROb2RlID0gbnVsbDtcbiAgICAgIHRoaXMuX3RleHRMYXllciA9IG51bGw7XG4gICAgfVxuXG4gICAgcmV0dXJuIEwuQ2lyY2xlTWFya2VyLnByb3RvdHlwZS5vblJlbW92ZS5jYWxsKHRoaXMsIG1hcCk7XG4gIH1cblxufSk7XG5cblxuTC5UZXh0Q2lyY2xlID0gQ2lyY2xlO1xuTC50ZXh0Q2lyY2xlID0gZnVuY3Rpb24gKHRleHQsIGxhdGxuZywgb3B0aW9ucykge1xuICByZXR1cm4gbmV3IENpcmNsZSh0ZXh0LCBsYXRsbmcsIG9wdGlvbnMpO1xufTtcbiIsInZhciBMID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJ0wnXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJ0wnXSA6IG51bGwpO1xudmFyIENpcmNsZSA9IHJlcXVpcmUoJy4vY2lyY2xlJyk7XG5yZXF1aXJlKCdsZWFmbGV0LXBhdGgtZHJhZycpO1xuXG52YXIgTGFiZWxlZE1hcmtlciA9IEwuRmVhdHVyZUdyb3VwLmV4dGVuZCh7XG5cbiAgb3B0aW9uczoge1xuXG4gICAgLyoqXG4gICAgICogQHBhcmFtICB7TGFiZWxlZE1hcmtlcn0gbWFya2VyXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSAgICAgICAgZmVhdHVyZVxuICAgICAqIEByZXR1cm4ge1N0cmluZ31cbiAgICAgKi9cbiAgICBnZXRMYWJlbFRleHQ6IGZ1bmN0aW9uKG1hcmtlciwgZmVhdHVyZSkge1xuICAgICAgcmV0dXJuIGZlYXR1cmUucHJvcGVydGllcy50ZXh0O1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0gIHtMYWJlbGVkTWFya2VyfSBtYXJrZXJcbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgICAgICBmZWF0dXJlXG4gICAgICogQHBhcmFtICB7TC5MYXRMbmd9ICAgICAgbGF0bG5nXG4gICAgICogQHJldHVybiB7TC5MYXRMbmd9XG4gICAgICovXG4gICAgZ2V0TGFiZWxQb3NpdGlvbjogZnVuY3Rpb24obWFya2VyLCBmZWF0dXJlLCBsYXRsbmcpIHtcbiAgICAgIHJldHVybiBmZWF0dXJlLnByb3BlcnRpZXMubGFiZWxQb3NpdGlvbiA/XG4gICAgICAgIEwubGF0TG5nKGZlYXR1cmUucHJvcGVydGllcy5sYWJlbFBvc2l0aW9uLnNsaWNlKCkucmV2ZXJzZSgpKSA6XG4gICAgICAgIGxhdGxuZztcbiAgICB9LFxuXG4gICAgbGFiZWxQb3NpdGlvbktleTogJ2xhYmVsUG9zaXRpb24nLFxuXG4gICAgbWFya2VyT3B0aW9uczoge1xuICAgICAgY29sb3I6ICcjZjAwJyxcbiAgICAgIGZpbGxPcGFjaXR5OiAwLjc1LFxuICAgICAgZHJhZ2dhYmxlOiB0cnVlLFxuICAgICAgcmFkaXVzOiAxNVxuICAgIH0sXG5cbiAgICBhbmNob3JPcHRpb25zOiB7XG4gICAgICBjb2xvcjogJyMwMGYnLFxuICAgICAgcmFkaXVzOiAzXG4gICAgfSxcblxuICAgIGxpbmVPcHRpb25zOiB7XG4gICAgICBjb2xvcjogJyNmMDAnLFxuICAgICAgZGFzaEFycmF5OiBbMiwgNl0sXG4gICAgICBsaW5lQ2FwOiAnc3F1YXJlJyxcbiAgICAgIHdlaWdodDogMlxuICAgIH1cblxuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBjbGFzcyBMYWJlbGVkTWFya2VyXG4gICAqIEBjb25zdHJ1Y3RvclxuICAgKiBAZXh0ZW5kcyB7TC5GZWF0dXJlR3JvdXB9XG4gICAqXG4gICAqIEBwYXJhbSAge0wuTGF0TG5nfSBsYXRsbmdcbiAgICogQHBhcmFtICB7T2JqZWN0PX0gIGZlYXR1cmVcbiAgICogQHBhcmFtICB7T2JqZWN0PX0gIG9wdGlvbnNcbiAgICovXG4gIGluaXRpYWxpemU6IGZ1bmN0aW9uKGxhdGxuZywgZmVhdHVyZSwgb3B0aW9ucykge1xuICAgIEwuVXRpbC5zZXRPcHRpb25zKHRoaXMsIG9wdGlvbnMpO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge09iamVjdH1cbiAgICAgKi9cbiAgICB0aGlzLmZlYXR1cmUgPSBmZWF0dXJlIHx8IHtcbiAgICAgIHR5cGU6ICdGZWF0dXJlJyxcbiAgICAgIHByb3BlcnRpZXM6IHt9LFxuICAgICAgZ2VvbWV0cnk6IHtcbiAgICAgICAgJ3R5cGUnOiAnUG9pbnQnXG4gICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLkxhdExuZ31cbiAgICAgKi9cbiAgICB0aGlzLl9sYXRsbmcgPSBsYXRsbmc7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtDaXJjbGVMYWJlbH1cbiAgICAgKi9cbiAgICB0aGlzLl9tYXJrZXIgPSBudWxsO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TC5DaXJjbGVNYXJrZXJ9XG4gICAgICovXG4gICAgdGhpcy5fYW5jaG9yID0gbnVsbDtcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuUG9seWxpbmV9XG4gICAgICovXG4gICAgdGhpcy5fbGluZSA9IG51bGw7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLlBvaW50fVxuICAgICAqL1xuICAgIHRoaXMuX2luaXRpYWxEaXN0YW5jZSA9IG51bGw7XG5cbiAgICB0aGlzLl9jcmVhdGVMYXllcnMoKTtcbiAgICBMLkxheWVyR3JvdXAucHJvdG90eXBlLmluaXRpYWxpemUuY2FsbCh0aGlzLFxuICAgICAgW3RoaXMuX2FuY2hvciwgdGhpcy5fbGluZSwgdGhpcy5fbWFya2VyXSk7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHJldHVybiB7TC5MYXRMbmd9XG4gICAqL1xuICBnZXRMYWJlbFBvc2l0aW9uOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fbWFya2VyLmdldExhdExuZygpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEByZXR1cm4ge0wuTGF0TG5nfVxuICAgKi9cbiAgZ2V0TGF0TG5nOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fbGF0bG5nO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIFNlcmlhbGl6ZVxuICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAqL1xuICB0b0dlb0pTT046IGZ1bmN0aW9uKCkge1xuICAgIHZhciBmZWF0dXJlID0gTC5HZW9KU09OLmdldEZlYXR1cmUodGhpcywge1xuICAgICAgdHlwZTogJ1BvaW50JyxcbiAgICAgIGNvb3JkaW5hdGVzOiBMLkdlb0pTT04ubGF0TG5nVG9Db29yZHModGhpcy5fYW5jaG9yLmdldExhdExuZygpKVxuICAgIH0pO1xuICAgIGZlYXR1cmUucHJvcGVydGllc1t0aGlzLm9wdGlvbnMubGFiZWxQb3NpdGlvbktleV0gPVxuICAgICAgTC5HZW9KU09OLmxhdExuZ1RvQ29vcmRzKHRoaXMuX21hcmtlci5nZXRMYXRMbmcoKSk7XG4gICAgcmV0dXJuIGZlYXR1cmU7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHBhcmFtIHtTdHJpbmd9IHRleHRcbiAgICogQHJldHVybiB7TGFiZWxlZE1hcmtlcn1cbiAgICovXG4gIHNldFRleHQ6IGZ1bmN0aW9uKHRleHQpIHtcbiAgICB0aGlzLl9tYXJrZXIuc2V0VGV4dCh0ZXh0KTtcbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGFuY2hvciwgbGluZSBhbmQgbGFiZWxcbiAgICovXG4gIF9jcmVhdGVMYXllcnM6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBvcHRzID0gdGhpcy5vcHRpb25zO1xuICAgIHZhciBwb3MgID0gb3B0cy5nZXRMYWJlbFBvc2l0aW9uKHRoaXMsIHRoaXMuZmVhdHVyZSwgdGhpcy5fbGF0bG5nKTtcbiAgICB2YXIgdGV4dCA9IG9wdHMuZ2V0TGFiZWxUZXh0KHRoaXMsIHRoaXMuZmVhdHVyZSk7XG5cbiAgICB0aGlzLl9tYXJrZXIgPSBuZXcgQ2lyY2xlKHRleHQsIHBvcyxcbiAgICAgIEwuVXRpbC5leHRlbmQoe1xuICAgICAgICBpbnRlcmFjdGl2ZTogdGhpcy5vcHRpb25zLmludGVyYWN0aXZlXG4gICAgICB9LFxuICAgICAgICBMYWJlbGVkTWFya2VyLnByb3RvdHlwZS5vcHRpb25zLm1hcmtlck9wdGlvbnMsXG4gICAgICAgIG9wdHMubWFya2VyT3B0aW9ucylcbiAgICApLm9uKCdkcmFnJywgICAgICB0aGlzLl9vbk1hcmtlckRyYWcsICAgICAgdGhpcylcbiAgICAgLm9uKCdkcmFnc3RhcnQnLCB0aGlzLl9vbk1hcmtlckRyYWdTdGFydCwgdGhpcylcbiAgICAgLm9uKCdkcmFnZW5kJywgICB0aGlzLl9vbk1hcmtlckRyYWdFbmQsICAgdGhpcyk7XG5cbiAgICB0aGlzLl9hbmNob3IgPSBuZXcgTC5DaXJjbGVNYXJrZXIodGhpcy5fbGF0bG5nLFxuICAgICAgTC5VdGlsLmV4dGVuZCh7fSwgTGFiZWxlZE1hcmtlci5wcm90b3R5cGUub3B0aW9ucy5hbmNob3JPcHRpb25zLFxuICAgICAgICBvcHRzLmFuY2hvck9wdGlvbnMpKTtcblxuICAgIHRoaXMuX2xpbmUgPSBuZXcgTC5Qb2x5bGluZShbdGhpcy5fbGF0bG5nLCB0aGlzLl9tYXJrZXIuZ2V0TGF0TG5nKCldLFxuICAgICAgTC5VdGlsLmV4dGVuZCh7fSwgTGFiZWxlZE1hcmtlci5wcm90b3R5cGUub3B0aW9ucy5saW5lT3B0aW9ucyxcbiAgICAgICAgb3B0cy5saW5lT3B0aW9ucykpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIFN0b3JlIHNoaWZ0IHRvIGJlIHByZWNpc2Ugd2hpbGUgZHJhZ2dpbmdcbiAgICogQHBhcmFtICB7RXZlbnR9IGV2dFxuICAgKi9cbiAgX29uTWFya2VyRHJhZ1N0YXJ0OiBmdW5jdGlvbihldnQpIHtcbiAgICB0aGlzLl9pbml0aWFsRGlzdGFuY2UgPSBMLkRvbUV2ZW50LmdldE1vdXNlUG9zaXRpb24oZXZ0KVxuICAgICAgLnN1YnRyYWN0KHRoaXMuX21hcC5sYXRMbmdUb0NvbnRhaW5lclBvaW50KHRoaXMuX21hcmtlci5nZXRMYXRMbmcoKSkpO1xuICAgIHRoaXMuZmlyZSgnbGFiZWw6JyArIGV2dC50eXBlLCBldnQpO1xuICAgIC8vTC5VdGlsLnJlcXVlc3RBbmltRnJhbWUodGhpcy5fbWFya2VyLmJyaW5nVG9Gcm9udCwgdGhpcy5fbWFya2VyKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBMaW5lIGRyYWdnaW5nXG4gICAqIEBwYXJhbSAge0RyYWdFdmVudH0gZXZ0XG4gICAqL1xuICBfb25NYXJrZXJEcmFnOiBmdW5jdGlvbihldnQpIHtcbiAgICB2YXIgbGF0bG5nID0gdGhpcy5fbWFwLmNvbnRhaW5lclBvaW50VG9MYXRMbmcoXG4gICAgICBMLkRvbUV2ZW50LmdldE1vdXNlUG9zaXRpb24oZXZ0KS5fc3VidHJhY3QodGhpcy5faW5pdGlhbERpc3RhbmNlKSk7XG4gICAgdGhpcy5fbGluZS5zZXRMYXRMbmdzKFtsYXRsbmcsIHRoaXMuX2xhdGxuZ10pO1xuICAgIHRoaXMuZmlyZSgnbGFiZWw6JyArIGV2dC50eXBlLCBldnQpO1xuICB9LFxuXG5cbiAgX29uTWFya2VyRHJhZ0VuZDogZnVuY3Rpb24oZXZ0KSB7XG4gICAgdGhpcy5maXJlKCdsYWJlbDonICsgZXZ0LnR5cGUsIGV2dCk7XG4gIH1cblxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gTC5MYWJlbGVkQ2lyY2xlTWFya2VyID0gTGFiZWxlZE1hcmtlcjtcbkwubGFiZWxlZENpcmNsZU1hcmtlciA9IGZ1bmN0aW9uKGxhdGxuZywgZmVhdHVyZSwgb3B0aW9ucykge1xuICByZXR1cm4gbmV3IExhYmVsZWRNYXJrZXIobGF0bG5nLCBmZWF0dXJlLCBvcHRpb25zKTtcbn07XG4iXX0=
