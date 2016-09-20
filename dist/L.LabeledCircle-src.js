(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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

module.exports = L.LabeledCircleMarker = LabeledMarker;
L.labeledCircleMarker = function (latlng, feature, options) {
  return new LabeledMarker(latlng, feature, options);
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./circle":8,"leaflet-path-drag":2}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9sZWFmbGV0LXBhdGgtZHJhZy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9sZWFmbGV0LXBhdGgtZHJhZy9zcmMvQ2FudmFzLmpzIiwibm9kZV9tb2R1bGVzL2xlYWZsZXQtcGF0aC1kcmFnL3NyYy9QYXRoLkRyYWcuanMiLCJub2RlX21vZHVsZXMvbGVhZmxldC1wYXRoLWRyYWcvc3JjL1BhdGguVHJhbnNmb3JtLmpzIiwibm9kZV9tb2R1bGVzL2xlYWZsZXQtcGF0aC1kcmFnL3NyYy9TVkcuVk1MLmpzIiwibm9kZV9tb2R1bGVzL2xlYWZsZXQtcGF0aC1kcmFnL3NyYy9TVkcuanMiLCJzcmMvY2lyY2xlLmpzIiwic3JjL21hcmtlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O0FDQUE7Ozs7Ozs7QUFPQSxPQUFPLE9BQVAsR0FBaUIsUUFBUSxjQUFSLENBQWpCOzs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdVQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtB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QUNELFVBQU0sT0FETDtBQUVELGlCQUFhLFNBQVMsS0FBVDtBQUZaLEdBWmMsQ0FBakI7O0FBaUJBLFNBQU87QUFDTCxVQUFNLFNBREQ7QUFFTCxnQkFBWSxFQUFFLElBQUYsQ0FBTyxNQUFQLENBQWMsRUFBZCxFQUFrQixRQUFRLFVBQTFCLEVBQXNDO0FBQ2hELHVCQUFpQixDQUFDLFFBQUQsRUFBVyxZQUFYLEVBQXlCLE9BQXpCLEVBQWtDLFNBQWxDO0FBRCtCLEtBQXRDLENBRlA7QUFLTCxVQUFNLFFBQVEsSUFMVDtBQU1MLGNBQVU7QUFDUixZQUFNLG9CQURFO0FBRVIsa0JBQVk7QUFGSjtBQU5MLEdBQVA7QUFXRDs7QUFFRCxjQUFjLG9CQUFkLEdBQXFDLG9CQUFyQzs7QUFFQSxPQUFPLE9BQVAsR0FBaUIsRUFBRSxtQkFBRixHQUF3QixhQUF6QztBQUNBLEVBQUUsbUJBQUYsR0FBd0IsVUFBUyxNQUFULEVBQWlCLE9BQWpCLEVBQTBCLE9BQTFCLEVBQW1DO0FBQ3pELFNBQU8sSUFBSSxhQUFKLENBQWtCLE1BQWxCLEVBQTBCLE9BQTFCLEVBQW1DLE9BQW5DLENBQVA7QUFDRCxDQUZEIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qKlxuICogTGVhZmxldCBTVkcgY2lyY2xlIG1hcmtlciB3aXRoIGRldGFjaGFibGUgYW5kIGRyYWdnYWJsZSBsYWJlbCBhbmQgdGV4dFxuICpcbiAqIEBhdXRob3IgQWxleGFuZGVyIE1pbGV2c2tpIDxpbmZvQHc4ci5uYW1lPlxuICogQGxpY2Vuc2UgTUlUXG4gKiBAcHJlc2VydmVcbiAqL1xubW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL3NyYy9tYXJrZXInKTtcbiIsInJlcXVpcmUoJy4vc3JjL1NWRycpO1xucmVxdWlyZSgnLi9zcmMvU1ZHLlZNTCcpO1xucmVxdWlyZSgnLi9zcmMvQ2FudmFzJyk7XG5yZXF1aXJlKCcuL3NyYy9QYXRoLlRyYW5zZm9ybScpO1xucmVxdWlyZSgnLi9zcmMvUGF0aC5EcmFnJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gTC5QYXRoLkRyYWc7XG4iLCJMLlV0aWwudHJ1ZUZuID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB0cnVlO1xufTtcblxuTC5DYW52YXMuaW5jbHVkZSh7XG5cbiAgLyoqXG4gICAqIERvIG5vdGhpbmdcbiAgICogQHBhcmFtICB7TC5QYXRofSBsYXllclxuICAgKi9cbiAgX3Jlc2V0VHJhbnNmb3JtUGF0aDogZnVuY3Rpb24obGF5ZXIpIHtcbiAgICBpZiAoIXRoaXMuX2NvbnRhaW5lckNvcHkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBkZWxldGUgdGhpcy5fY29udGFpbmVyQ29weTtcblxuICAgIGlmIChsYXllci5fY29udGFpbnNQb2ludF8pIHtcbiAgICAgIGxheWVyLl9jb250YWluc1BvaW50ID0gbGF5ZXIuX2NvbnRhaW5zUG9pbnRfO1xuICAgICAgZGVsZXRlIGxheWVyLl9jb250YWluc1BvaW50XztcblxuICAgICAgdGhpcy5fcmVxdWVzdFJlZHJhdyhsYXllcik7XG4gICAgfVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIEFsZ29yaXRobSBvdXRsaW5lOlxuICAgKlxuICAgKiAxLiBwcmUtdHJhbnNmb3JtIC0gY2xlYXIgdGhlIHBhdGggb3V0IG9mIHRoZSBjYW52YXMsIGNvcHkgY2FudmFzIHN0YXRlXG4gICAqIDIuIGF0IGV2ZXJ5IGZyYW1lOlxuICAgKiAgICAyLjEuIHNhdmVcbiAgICogICAgMi4yLiByZWRyYXcgdGhlIGNhbnZhcyBmcm9tIHNhdmVkIG9uZVxuICAgKiAgICAyLjMuIHRyYW5zZm9ybVxuICAgKiAgICAyLjQuIGRyYXcgcGF0aFxuICAgKiAgICAyLjUuIHJlc3RvcmVcbiAgICpcbiAgICogQHBhcmFtICB7TC5QYXRofSAgICAgICAgIGxheWVyXG4gICAqIEBwYXJhbSAge0FycmF5LjxOdW1iZXI+fSBtYXRyaXhcbiAgICovXG4gIHRyYW5zZm9ybVBhdGg6IGZ1bmN0aW9uKGxheWVyLCBtYXRyaXgpIHtcbiAgICB2YXIgY29weSA9IHRoaXMuX2NvbnRhaW5lckNvcHk7XG4gICAgdmFyIGN0eCA9IHRoaXMuX2N0eDtcbiAgICB2YXIgbSA9IEwuQnJvd3Nlci5yZXRpbmEgPyAyIDogMTtcbiAgICB2YXIgYm91bmRzID0gdGhpcy5fYm91bmRzO1xuICAgIHZhciBzaXplID0gYm91bmRzLmdldFNpemUoKTtcbiAgICB2YXIgcG9zID0gYm91bmRzLm1pbjtcblxuICAgIGlmICghY29weSkge1xuICAgICAgY29weSA9IHRoaXMuX2NvbnRhaW5lckNvcHkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTtcbiAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoY29weSk7XG5cbiAgICAgIGNvcHkud2lkdGggPSBtICogc2l6ZS54O1xuICAgICAgY29weS5oZWlnaHQgPSBtICogc2l6ZS55O1xuXG4gICAgICBsYXllci5fcmVtb3ZlZCA9IHRydWU7XG4gICAgICB0aGlzLl9yZWRyYXcoKTtcblxuICAgICAgY29weS5nZXRDb250ZXh0KCcyZCcpLnRyYW5zbGF0ZShtICogYm91bmRzLm1pbi54LCBtICogYm91bmRzLm1pbi55KTtcbiAgICAgIGNvcHkuZ2V0Q29udGV4dCgnMmQnKS5kcmF3SW1hZ2UodGhpcy5fY29udGFpbmVyLCAwLCAwKTtcbiAgICAgIHRoaXMuX2luaXRQYXRoKGxheWVyKTtcbiAgICAgIGxheWVyLl9jb250YWluc1BvaW50XyA9IGxheWVyLl9jb250YWluc1BvaW50O1xuICAgICAgbGF5ZXIuX2NvbnRhaW5zUG9pbnQgPSBMLlV0aWwudHJ1ZUZuO1xuICAgIH1cblxuICAgIGN0eC5zYXZlKCk7XG4gICAgY3R4LmNsZWFyUmVjdChwb3MueCwgcG9zLnksIHNpemUueCAqIG0sIHNpemUueSAqIG0pO1xuICAgIGN0eC5zZXRUcmFuc2Zvcm0oMSwgMCwgMCwgMSwgMCwgMCk7XG4gICAgY3R4LnJlc3RvcmUoKTtcbiAgICBjdHguc2F2ZSgpO1xuXG4gICAgY3R4LmRyYXdJbWFnZSh0aGlzLl9jb250YWluZXJDb3B5LCAwLCAwLCBzaXplLngsIHNpemUueSk7XG4gICAgY3R4LnRyYW5zZm9ybS5hcHBseShjdHgsIG1hdHJpeCk7XG5cbiAgICB2YXIgbGF5ZXJzID0gdGhpcy5fbGF5ZXJzO1xuICAgIHRoaXMuX2xheWVycyA9IHt9O1xuXG4gICAgdGhpcy5faW5pdFBhdGgobGF5ZXIpO1xuICAgIGxheWVyLl91cGRhdGVQYXRoKCk7XG5cbiAgICB0aGlzLl9sYXllcnMgPSBsYXllcnM7XG4gICAgY3R4LnJlc3RvcmUoKTtcbiAgfVxuXG59KTtcbiIsIi8qKlxuICogRHJhZyBoYW5kbGVyXG4gKiBAY2xhc3MgTC5QYXRoLkRyYWdcbiAqIEBleHRlbmRzIHtMLkhhbmRsZXJ9XG4gKi9cbkwuSGFuZGxlci5QYXRoRHJhZyA9IEwuSGFuZGxlci5leHRlbmQoIC8qKiBAbGVuZHMgIEwuUGF0aC5EcmFnLnByb3RvdHlwZSAqLyB7XG5cbiAgc3RhdGljczoge1xuICAgIERSQUdHSU5HX0NMUzogJ2xlYWZsZXQtcGF0aC1kcmFnZ2FibGUnLFxuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSAge0wuUGF0aH0gcGF0aFxuICAgKiBAY29uc3RydWN0b3JcbiAgICovXG4gIGluaXRpYWxpemU6IGZ1bmN0aW9uKHBhdGgpIHtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLlBhdGh9XG4gICAgICovXG4gICAgdGhpcy5fcGF0aCA9IHBhdGg7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7QXJyYXkuPE51bWJlcj59XG4gICAgICovXG4gICAgdGhpcy5fbWF0cml4ID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLlBvaW50fVxuICAgICAqL1xuICAgIHRoaXMuX3N0YXJ0UG9pbnQgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuUG9pbnR9XG4gICAgICovXG4gICAgdGhpcy5fZHJhZ1N0YXJ0UG9pbnQgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0Jvb2xlYW59XG4gICAgICovXG4gICAgdGhpcy5fbWFwRHJhZ2dpbmdXYXNFbmFibGVkID0gZmFsc2U7XG5cbiAgfSxcblxuICAvKipcbiAgICogRW5hYmxlIGRyYWdnaW5nXG4gICAqL1xuICBhZGRIb29rczogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5fcGF0aC5vbignbW91c2Vkb3duJywgdGhpcy5fb25EcmFnU3RhcnQsIHRoaXMpO1xuXG4gICAgdGhpcy5fcGF0aC5vcHRpb25zLmNsYXNzTmFtZSA9IHRoaXMuX3BhdGgub3B0aW9ucy5jbGFzc05hbWUgP1xuICAgICAgICAodGhpcy5fcGF0aC5vcHRpb25zLmNsYXNzTmFtZSArICcgJyArIEwuSGFuZGxlci5QYXRoRHJhZy5EUkFHR0lOR19DTFMpIDpcbiAgICAgICAgIEwuSGFuZGxlci5QYXRoRHJhZy5EUkFHR0lOR19DTFM7XG5cbiAgICBpZiAodGhpcy5fcGF0aC5fcGF0aCkge1xuICAgICAgTC5Eb21VdGlsLmFkZENsYXNzKHRoaXMuX3BhdGguX3BhdGgsIEwuSGFuZGxlci5QYXRoRHJhZy5EUkFHR0lOR19DTFMpO1xuICAgIH1cbiAgfSxcblxuICAvKipcbiAgICogRGlzYWJsZSBkcmFnZ2luZ1xuICAgKi9cbiAgcmVtb3ZlSG9va3M6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuX3BhdGgub2ZmKCdtb3VzZWRvd24nLCB0aGlzLl9vbkRyYWdTdGFydCwgdGhpcyk7XG5cbiAgICB0aGlzLl9wYXRoLm9wdGlvbnMuY2xhc3NOYW1lID0gdGhpcy5fcGF0aC5vcHRpb25zLmNsYXNzTmFtZVxuICAgICAgLnJlcGxhY2UobmV3IFJlZ0V4cCgnXFxcXHMrJyArIEwuSGFuZGxlci5QYXRoRHJhZy5EUkFHR0lOR19DTFMpLCAnJyk7XG4gICAgaWYgKHRoaXMuX3BhdGguX3BhdGgpIHtcbiAgICAgIEwuRG9tVXRpbC5yZW1vdmVDbGFzcyh0aGlzLl9wYXRoLl9wYXRoLCBMLkhhbmRsZXIuUGF0aERyYWcuRFJBR0dJTkdfQ0xTKTtcbiAgICB9XG4gIH0sXG5cbiAgLyoqXG4gICAqIEByZXR1cm4ge0Jvb2xlYW59XG4gICAqL1xuICBtb3ZlZDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuX3BhdGguX2RyYWdNb3ZlZDtcbiAgfSxcblxuICAvKipcbiAgICogU3RhcnQgZHJhZ1xuICAgKiBAcGFyYW0gIHtMLk1vdXNlRXZlbnR9IGV2dFxuICAgKi9cbiAgX29uRHJhZ1N0YXJ0OiBmdW5jdGlvbihldnQpIHtcbiAgICB2YXIgZXZlbnRUeXBlID0gZXZ0Lm9yaWdpbmFsRXZlbnQuX3NpbXVsYXRlZCA/ICd0b3VjaHN0YXJ0JyA6IGV2dC5vcmlnaW5hbEV2ZW50LnR5cGU7XG5cbiAgICB0aGlzLl9tYXBEcmFnZ2luZ1dhc0VuYWJsZWQgPSBmYWxzZTtcbiAgICB0aGlzLl9zdGFydFBvaW50ID0gZXZ0LmNvbnRhaW5lclBvaW50LmNsb25lKCk7XG4gICAgdGhpcy5fZHJhZ1N0YXJ0UG9pbnQgPSBldnQuY29udGFpbmVyUG9pbnQuY2xvbmUoKTtcbiAgICB0aGlzLl9tYXRyaXggPSBbMSwgMCwgMCwgMSwgMCwgMF07XG4gICAgTC5Eb21FdmVudC5zdG9wKGV2dC5vcmlnaW5hbEV2ZW50KTtcblxuICAgIEwuRG9tVXRpbC5hZGRDbGFzcyh0aGlzLl9wYXRoLl9yZW5kZXJlci5fY29udGFpbmVyLCAnbGVhZmxldC1pbnRlcmFjdGl2ZScpO1xuICAgIEwuRG9tRXZlbnRcbiAgICAgIC5vbihkb2N1bWVudCwgTC5EcmFnZ2FibGUuTU9WRVtldmVudFR5cGVdLCB0aGlzLl9vbkRyYWcsICAgIHRoaXMpXG4gICAgICAub24oZG9jdW1lbnQsIEwuRHJhZ2dhYmxlLkVORFtldmVudFR5cGVdLCAgdGhpcy5fb25EcmFnRW5kLCB0aGlzKTtcblxuICAgIGlmICh0aGlzLl9wYXRoLl9tYXAuZHJhZ2dpbmcuZW5hYmxlZCgpKSB7XG4gICAgICAvLyBJIGd1ZXNzIGl0J3MgcmVxdWlyZWQgYmVjYXVzZSBtb3VzZG93biBnZXRzIHNpbXVsYXRlZCB3aXRoIGEgZGVsYXlcbiAgICAgIC8vdGhpcy5fcGF0aC5fbWFwLmRyYWdnaW5nLl9kcmFnZ2FibGUuX29uVXAoZXZ0KTtcblxuICAgICAgdGhpcy5fcGF0aC5fbWFwLmRyYWdnaW5nLmRpc2FibGUoKTtcbiAgICAgIHRoaXMuX21hcERyYWdnaW5nV2FzRW5hYmxlZCA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMuX3BhdGguX2RyYWdNb3ZlZCA9IGZhbHNlO1xuXG4gICAgaWYgKHRoaXMuX3BhdGguX3BvcHVwKSB7IC8vIHRoYXQgbWlnaHQgYmUgYSBjYXNlIG9uIHRvdWNoIGRldmljZXMgYXMgd2VsbFxuICAgICAgdGhpcy5fcGF0aC5fcG9wdXAuX2Nsb3NlKCk7XG4gICAgfVxuXG4gICAgdGhpcy5fcmVwbGFjZUNvb3JkR2V0dGVycyhldnQpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBEcmFnZ2luZ1xuICAgKiBAcGFyYW0gIHtMLk1vdXNlRXZlbnR9IGV2dFxuICAgKi9cbiAgX29uRHJhZzogZnVuY3Rpb24oZXZ0KSB7XG4gICAgTC5Eb21FdmVudC5zdG9wKGV2dCk7XG5cbiAgICB2YXIgZmlyc3QgPSAoZXZ0LnRvdWNoZXMgJiYgZXZ0LnRvdWNoZXMubGVuZ3RoID49IDEgPyBldnQudG91Y2hlc1swXSA6IGV2dCk7XG4gICAgdmFyIGNvbnRhaW5lclBvaW50ID0gdGhpcy5fcGF0aC5fbWFwLm1vdXNlRXZlbnRUb0NvbnRhaW5lclBvaW50KGZpcnN0KTtcblxuICAgIHZhciB4ID0gY29udGFpbmVyUG9pbnQueDtcbiAgICB2YXIgeSA9IGNvbnRhaW5lclBvaW50Lnk7XG5cbiAgICB2YXIgZHggPSB4IC0gdGhpcy5fc3RhcnRQb2ludC54O1xuICAgIHZhciBkeSA9IHkgLSB0aGlzLl9zdGFydFBvaW50Lnk7XG5cbiAgICBpZiAoIXRoaXMuX3BhdGguX2RyYWdNb3ZlZCAmJiAoZHggfHwgZHkpKSB7XG4gICAgICB0aGlzLl9wYXRoLl9kcmFnTW92ZWQgPSB0cnVlO1xuICAgICAgdGhpcy5fcGF0aC5maXJlKCdkcmFnc3RhcnQnLCBldnQpO1xuICAgICAgLy8gd2UgZG9uJ3Qgd2FudCB0aGF0IHRvIGhhcHBlbiBvbiBjbGlja1xuICAgICAgdGhpcy5fcGF0aC5icmluZ1RvRnJvbnQoKTtcbiAgICB9XG5cbiAgICB0aGlzLl9tYXRyaXhbNF0gKz0gZHg7XG4gICAgdGhpcy5fbWF0cml4WzVdICs9IGR5O1xuXG4gICAgdGhpcy5fc3RhcnRQb2ludC54ID0geDtcbiAgICB0aGlzLl9zdGFydFBvaW50LnkgPSB5O1xuXG4gICAgdGhpcy5fcGF0aC5maXJlKCdwcmVkcmFnJywgZXZ0KTtcbiAgICB0aGlzLl9wYXRoLl90cmFuc2Zvcm0odGhpcy5fbWF0cml4KTtcbiAgICB0aGlzLl9wYXRoLmZpcmUoJ2RyYWcnLCBldnQpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBEcmFnZ2luZyBzdG9wcGVkLCBhcHBseVxuICAgKiBAcGFyYW0gIHtMLk1vdXNlRXZlbnR9IGV2dFxuICAgKi9cbiAgX29uRHJhZ0VuZDogZnVuY3Rpb24oZXZ0KSB7XG4gICAgdmFyIGNvbnRhaW5lclBvaW50ID0gdGhpcy5fcGF0aC5fbWFwLm1vdXNlRXZlbnRUb0NvbnRhaW5lclBvaW50KGV2dCk7XG4gICAgdmFyIG1vdmVkID0gdGhpcy5tb3ZlZCgpO1xuXG4gICAgLy8gYXBwbHkgbWF0cml4XG4gICAgaWYgKG1vdmVkKSB7XG4gICAgICB0aGlzLl90cmFuc2Zvcm1Qb2ludHModGhpcy5fbWF0cml4KTtcbiAgICAgIHRoaXMuX3BhdGguX3VwZGF0ZVBhdGgoKTtcbiAgICAgIHRoaXMuX3BhdGguX3Byb2plY3QoKTtcbiAgICAgIHRoaXMuX3BhdGguX3RyYW5zZm9ybShudWxsKTtcblxuICAgICAgTC5Eb21FdmVudC5zdG9wKGV2dCk7XG4gICAgfVxuXG5cbiAgICBMLkRvbUV2ZW50XG4gICAgICAub2ZmKGRvY3VtZW50LCAnbW91c2Vtb3ZlIHRvdWNobW92ZScsIHRoaXMuX29uRHJhZywgdGhpcylcbiAgICAgIC5vZmYoZG9jdW1lbnQsICdtb3VzZXVwIHRvdWNoZW5kJywgICAgdGhpcy5fb25EcmFnRW5kLCB0aGlzKTtcblxuICAgIHRoaXMuX3Jlc3RvcmVDb29yZEdldHRlcnMoKTtcblxuICAgIC8vIGNvbnNpc3RlbmN5XG4gICAgaWYgKG1vdmVkKSB7XG4gICAgICB0aGlzLl9wYXRoLmZpcmUoJ2RyYWdlbmQnLCB7XG4gICAgICAgIGRpc3RhbmNlOiBNYXRoLnNxcnQoXG4gICAgICAgICAgTC5MaW5lVXRpbC5fc3FEaXN0KHRoaXMuX2RyYWdTdGFydFBvaW50LCBjb250YWluZXJQb2ludClcbiAgICAgICAgKVxuICAgICAgfSk7XG5cbiAgICAgIC8vIGhhY2sgZm9yIHNraXBwaW5nIHRoZSBjbGljayBpbiBjYW52YXMtcmVuZGVyZWQgbGF5ZXJzXG4gICAgICB2YXIgY29udGFpbnMgPSB0aGlzLl9wYXRoLl9jb250YWluc1BvaW50O1xuICAgICAgdGhpcy5fcGF0aC5fY29udGFpbnNQb2ludCA9IEwuVXRpbC5mYWxzZUZuO1xuICAgICAgTC5VdGlsLnJlcXVlc3RBbmltRnJhbWUoZnVuY3Rpb24oKSB7XG4gICAgICAgIEwuRG9tRXZlbnQuX3NraXBwZWQoeyB0eXBlOiAnY2xpY2snIH0pO1xuICAgICAgICB0aGlzLl9wYXRoLl9jb250YWluc1BvaW50ID0gY29udGFpbnM7XG4gICAgICB9LCB0aGlzKTtcbiAgICB9XG5cbiAgICB0aGlzLl9tYXRyaXggICAgICAgICAgPSBudWxsO1xuICAgIHRoaXMuX3N0YXJ0UG9pbnQgICAgICA9IG51bGw7XG4gICAgdGhpcy5fZHJhZ1N0YXJ0UG9pbnQgID0gbnVsbDtcbiAgICB0aGlzLl9wYXRoLl9kcmFnTW92ZWQgPSBmYWxzZTtcblxuICAgIGlmICh0aGlzLl9tYXBEcmFnZ2luZ1dhc0VuYWJsZWQpIHtcbiAgICAgIEwuRG9tRXZlbnQuX2Zha2VTdG9wKHsgdHlwZTogJ2NsaWNrJyB9KTtcbiAgICAgIHRoaXMuX3BhdGguX21hcC5kcmFnZ2luZy5lbmFibGUoKTtcbiAgICB9XG4gIH0sXG5cblxuICAvKipcbiAgICogQXBwbGllcyB0cmFuc2Zvcm1hdGlvbiwgZG9lcyBpdCBpbiBvbmUgc3dlZXAgZm9yIHBlcmZvcm1hbmNlLFxuICAgKiBzbyBkb24ndCBiZSBzdXJwcmlzZWQgYWJvdXQgdGhlIGNvZGUgcmVwZXRpdGlvbi5cbiAgICpcbiAgICogWyB4IF0gICBbIGEgIGIgIHR4IF0gWyB4IF0gICBbIGEgKiB4ICsgYiAqIHkgKyB0eCBdXG4gICAqIFsgeSBdID0gWyBjICBkICB0eSBdIFsgeSBdID0gWyBjICogeCArIGQgKiB5ICsgdHkgXVxuICAgKlxuICAgKiBAcGFyYW0ge0FycmF5LjxOdW1iZXI+fSBtYXRyaXhcbiAgICovXG4gIF90cmFuc2Zvcm1Qb2ludHM6IGZ1bmN0aW9uKG1hdHJpeCwgZGVzdCkge1xuICAgIHZhciBwYXRoID0gdGhpcy5fcGF0aDtcbiAgICB2YXIgaSwgbGVuLCBsYXRsbmc7XG5cbiAgICB2YXIgcHggPSBMLnBvaW50KG1hdHJpeFs0XSwgbWF0cml4WzVdKTtcblxuICAgIHZhciBjcnMgPSBwYXRoLl9tYXAub3B0aW9ucy5jcnM7XG4gICAgdmFyIHRyYW5zZm9ybWF0aW9uID0gY3JzLnRyYW5zZm9ybWF0aW9uO1xuICAgIHZhciBzY2FsZSA9IGNycy5zY2FsZShwYXRoLl9tYXAuZ2V0Wm9vbSgpKTtcbiAgICB2YXIgcHJvamVjdGlvbiA9IGNycy5wcm9qZWN0aW9uO1xuXG4gICAgdmFyIGRpZmYgPSB0cmFuc2Zvcm1hdGlvbi51bnRyYW5zZm9ybShweCwgc2NhbGUpXG4gICAgICAuc3VidHJhY3QodHJhbnNmb3JtYXRpb24udW50cmFuc2Zvcm0oTC5wb2ludCgwLCAwKSwgc2NhbGUpKTtcbiAgICB2YXIgYXBwbHlUcmFuc2Zvcm0gPSAhZGVzdDtcblxuICAgIHBhdGguX2JvdW5kcyA9IG5ldyBMLkxhdExuZ0JvdW5kcygpO1xuXG4gICAgLy8gY29uc29sZS50aW1lKCd0cmFuc2Zvcm0nKTtcbiAgICAvLyBhbGwgc2hpZnRzIGFyZSBpbi1wbGFjZVxuICAgIGlmIChwYXRoLl9wb2ludCkgeyAvLyBMLkNpcmNsZVxuICAgICAgZGVzdCA9IHByb2plY3Rpb24udW5wcm9qZWN0KFxuICAgICAgICBwcm9qZWN0aW9uLnByb2plY3QocGF0aC5fbGF0bG5nKS5fYWRkKGRpZmYpKTtcbiAgICAgIGlmIChhcHBseVRyYW5zZm9ybSkge1xuICAgICAgICBwYXRoLl9sYXRsbmcgPSBkZXN0O1xuICAgICAgICBwYXRoLl9wb2ludC5fYWRkKHB4KTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHBhdGguX3JpbmdzIHx8IHBhdGguX3BhcnRzKSB7IC8vIGV2ZXJ5dGhpbmcgZWxzZVxuICAgICAgdmFyIHJpbmdzICAgPSBwYXRoLl9yaW5ncyB8fCBwYXRoLl9wYXJ0cztcbiAgICAgIHZhciBsYXRsbmdzID0gcGF0aC5fbGF0bG5ncztcbiAgICAgIGRlc3QgPSBkZXN0IHx8IGxhdGxuZ3M7XG4gICAgICBpZiAoIUwuVXRpbC5pc0FycmF5KGxhdGxuZ3NbMF0pKSB7IC8vIHBvbHlsaW5lXG4gICAgICAgIGxhdGxuZ3MgPSBbbGF0bG5nc107XG4gICAgICAgIGRlc3QgICAgPSBbZGVzdF07XG4gICAgICB9XG4gICAgICBmb3IgKGkgPSAwLCBsZW4gPSByaW5ncy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICBkZXN0W2ldID0gZGVzdFtpXSB8fCBbXTtcbiAgICAgICAgZm9yICh2YXIgaiA9IDAsIGpqID0gcmluZ3NbaV0ubGVuZ3RoOyBqIDwgamo7IGorKykge1xuICAgICAgICAgIGxhdGxuZyAgICAgPSBsYXRsbmdzW2ldW2pdO1xuICAgICAgICAgIGRlc3RbaV1bal0gPSBwcm9qZWN0aW9uXG4gICAgICAgICAgICAudW5wcm9qZWN0KHByb2plY3Rpb24ucHJvamVjdChsYXRsbmcpLl9hZGQoZGlmZikpO1xuICAgICAgICAgIGlmIChhcHBseVRyYW5zZm9ybSkge1xuICAgICAgICAgICAgcGF0aC5fYm91bmRzLmV4dGVuZChsYXRsbmdzW2ldW2pdKTtcbiAgICAgICAgICAgIHJpbmdzW2ldW2pdLl9hZGQocHgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZGVzdDtcbiAgICAvLyBjb25zb2xlLnRpbWVFbmQoJ3RyYW5zZm9ybScpO1xuICB9LFxuXG5cblxuICAvKipcbiAgICogSWYgeW91IHdhbnQgdG8gcmVhZCB0aGUgbGF0bG5ncyBkdXJpbmcgdGhlIGRyYWcgLSB5b3VyIHJpZ2h0LFxuICAgKiBidXQgdGhleSBoYXZlIHRvIGJlIHRyYW5zZm9ybWVkXG4gICAqL1xuICBfcmVwbGFjZUNvb3JkR2V0dGVyczogZnVuY3Rpb24oKSB7XG4gICAgaWYgKHRoaXMuX3BhdGguZ2V0TGF0TG5nKSB7IC8vIENpcmNsZSwgQ2lyY2xlTWFya2VyXG4gICAgICB0aGlzLl9wYXRoLmdldExhdExuZ18gPSB0aGlzLl9wYXRoLmdldExhdExuZztcbiAgICAgIHRoaXMuX3BhdGguZ2V0TGF0TG5nID0gTC5VdGlsLmJpbmQoZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmRyYWdnaW5nLl90cmFuc2Zvcm1Qb2ludHModGhpcy5kcmFnZ2luZy5fbWF0cml4LCB7fSk7XG4gICAgICB9LCB0aGlzLl9wYXRoKTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuX3BhdGguZ2V0TGF0TG5ncykge1xuICAgICAgdGhpcy5fcGF0aC5nZXRMYXRMbmdzXyA9IHRoaXMuX3BhdGguZ2V0TGF0TG5ncztcbiAgICAgIHRoaXMuX3BhdGguZ2V0TGF0TG5ncyA9IEwuVXRpbC5iaW5kKGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5kcmFnZ2luZy5fdHJhbnNmb3JtUG9pbnRzKHRoaXMuZHJhZ2dpbmcuX21hdHJpeCwgW10pO1xuICAgICAgfSwgdGhpcy5fcGF0aCk7XG4gICAgfVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIFB1dCBiYWNrIHRoZSBnZXR0ZXJzXG4gICAqL1xuICBfcmVzdG9yZUNvb3JkR2V0dGVyczogZnVuY3Rpb24oKSB7XG4gICAgaWYgKHRoaXMuX3BhdGguZ2V0TGF0TG5nXykge1xuICAgICAgdGhpcy5fcGF0aC5nZXRMYXRMbmcgPSB0aGlzLl9wYXRoLmdldExhdExuZ187XG4gICAgICBkZWxldGUgdGhpcy5fcGF0aC5nZXRMYXRMbmdfO1xuICAgIH0gZWxzZSBpZiAodGhpcy5fcGF0aC5nZXRMYXRMbmdzXykge1xuICAgICAgdGhpcy5fcGF0aC5nZXRMYXRMbmdzID0gdGhpcy5fcGF0aC5nZXRMYXRMbmdzXztcbiAgICAgIGRlbGV0ZSB0aGlzLl9wYXRoLmdldExhdExuZ3NfO1xuICAgIH1cbiAgfVxuXG59KTtcblxuXG4vKipcbiAqIEBwYXJhbSAge0wuUGF0aH0gbGF5ZXJcbiAqIEByZXR1cm4ge0wuUGF0aH1cbiAqL1xuTC5IYW5kbGVyLlBhdGhEcmFnLm1ha2VEcmFnZ2FibGUgPSBmdW5jdGlvbihsYXllcikge1xuICBsYXllci5kcmFnZ2luZyA9IG5ldyBMLkhhbmRsZXIuUGF0aERyYWcobGF5ZXIpO1xuICByZXR1cm4gbGF5ZXI7XG59O1xuXG5cbi8qKlxuICogQWxzbyBleHBvc2UgYXMgYSBtZXRob2RcbiAqIEByZXR1cm4ge0wuUGF0aH1cbiAqL1xuTC5QYXRoLnByb3RvdHlwZS5tYWtlRHJhZ2dhYmxlID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBMLkhhbmRsZXIuUGF0aERyYWcubWFrZURyYWdnYWJsZSh0aGlzKTtcbn07XG5cblxuTC5QYXRoLmFkZEluaXRIb29rKGZ1bmN0aW9uKCkge1xuICBpZiAodGhpcy5vcHRpb25zLmRyYWdnYWJsZSkge1xuICAgIC8vIGVuc3VyZSBpbnRlcmFjdGl2ZVxuICAgIHRoaXMub3B0aW9ucy5pbnRlcmFjdGl2ZSA9IHRydWU7XG5cbiAgICBpZiAodGhpcy5kcmFnZ2luZykge1xuICAgICAgdGhpcy5kcmFnZ2luZy5lbmFibGUoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgTC5IYW5kbGVyLlBhdGhEcmFnLm1ha2VEcmFnZ2FibGUodGhpcyk7XG4gICAgICB0aGlzLmRyYWdnaW5nLmVuYWJsZSgpO1xuICAgIH1cbiAgfSBlbHNlIGlmICh0aGlzLmRyYWdnaW5nKSB7XG4gICAgdGhpcy5kcmFnZ2luZy5kaXNhYmxlKCk7XG4gIH1cbn0pO1xuIiwiLyoqXG4gKiBMZWFmbGV0IHZlY3RvciBmZWF0dXJlcyBkcmFnIGZ1bmN0aW9uYWxpdHlcbiAqIEBhdXRob3IgQWxleGFuZGVyIE1pbGV2c2tpIDxpbmZvQHc4ci5uYW1lPlxuICogQHByZXNlcnZlXG4gKi9cblxuLyoqXG4gKiBNYXRyaXggdHJhbnNmb3JtIHBhdGggZm9yIFNWRy9WTUxcbiAqIFJlbmRlcmVyLWluZGVwZW5kZW50XG4gKi9cbkwuUGF0aC5pbmNsdWRlKHtcblxuXHQvKipcblx0ICogQXBwbGllcyBtYXRyaXggdHJhbnNmb3JtYXRpb24gdG8gU1ZHXG5cdCAqIEBwYXJhbSB7QXJyYXkuPE51bWJlcj4/fSBtYXRyaXhcblx0ICovXG5cdF90cmFuc2Zvcm06IGZ1bmN0aW9uKG1hdHJpeCkge1xuXHRcdGlmICh0aGlzLl9yZW5kZXJlcikge1xuXHRcdFx0aWYgKG1hdHJpeCkge1xuXHRcdFx0XHR0aGlzLl9yZW5kZXJlci50cmFuc2Zvcm1QYXRoKHRoaXMsIG1hdHJpeCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyByZXNldCB0cmFuc2Zvcm0gbWF0cml4XG5cdFx0XHRcdHRoaXMuX3JlbmRlcmVyLl9yZXNldFRyYW5zZm9ybVBhdGgodGhpcyk7XG5cdFx0XHRcdHRoaXMuX3VwZGF0ZSgpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblxuXHQvKipcblx0ICogQ2hlY2sgaWYgdGhlIGZlYXR1cmUgd2FzIGRyYWdnZWQsIHRoYXQnbGwgc3VwcmVzcyB0aGUgY2xpY2sgZXZlbnRcblx0ICogb24gbW91c2V1cC4gVGhhdCBmaXhlcyBwb3B1cHMgZm9yIGV4YW1wbGVcblx0ICpcblx0ICogQHBhcmFtICB7TW91c2VFdmVudH0gZVxuXHQgKi9cblx0X29uTW91c2VDbGljazogZnVuY3Rpb24oZSkge1xuXHRcdGlmICgodGhpcy5kcmFnZ2luZyAmJiB0aGlzLmRyYWdnaW5nLm1vdmVkKCkpIHx8XG5cdFx0XHQodGhpcy5fbWFwLmRyYWdnaW5nICYmIHRoaXMuX21hcC5kcmFnZ2luZy5tb3ZlZCgpKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX2ZpcmVNb3VzZUV2ZW50KGUpO1xuXHR9XG5cbn0pO1xuIiwiTC5TVkcuaW5jbHVkZSghTC5Ccm93c2VyLnZtbCA/IHt9IDoge1xuXG5cdC8qKlxuXHQgKiBSZXNldCB0cmFuc2Zvcm0gbWF0cml4XG5cdCAqL1xuXHRfcmVzZXRUcmFuc2Zvcm1QYXRoOiBmdW5jdGlvbihsYXllcikge1xuXHRcdGlmIChsYXllci5fc2tldykge1xuXHRcdFx0Ly8gc3VwZXIgaW1wb3J0YW50ISB3b3JrYXJvdW5kIGZvciBhICdqdW1waW5nJyBnbGl0Y2g6XG5cdFx0XHQvLyBkaXNhYmxlIHRyYW5zZm9ybSBiZWZvcmUgcmVtb3ZpbmcgaXRcblx0XHRcdGxheWVyLl9za2V3Lm9uID0gZmFsc2U7XG5cdFx0XHRsYXllci5fcGF0aC5yZW1vdmVDaGlsZChsYXllci5fc2tldyk7XG5cdFx0XHRsYXllci5fc2tldyA9IG51bGw7XG5cdFx0fVxuXHR9LFxuXG5cdC8qKlxuXHQgKiBBcHBsaWVzIG1hdHJpeCB0cmFuc2Zvcm1hdGlvbiB0byBWTUxcblx0ICogQHBhcmFtIHtMLlBhdGh9ICAgICAgICAgbGF5ZXJcblx0ICogQHBhcmFtIHtBcnJheS48TnVtYmVyPn0gbWF0cml4XG5cdCAqL1xuXHR0cmFuc2Zvcm1QYXRoOiBmdW5jdGlvbihsYXllciwgbWF0cml4KSB7XG5cdFx0dmFyIHNrZXcgPSBsYXllci5fc2tldztcblxuXHRcdGlmICghc2tldykge1xuXHRcdFx0c2tldyA9IEwuU1ZHLmNyZWF0ZSgnc2tldycpO1xuXHRcdFx0bGF5ZXIuX3BhdGguYXBwZW5kQ2hpbGQoc2tldyk7XG5cdFx0XHRza2V3LnN0eWxlLmJlaGF2aW9yID0gJ3VybCgjZGVmYXVsdCNWTUwpJztcblx0XHRcdGxheWVyLl9za2V3ID0gc2tldztcblx0XHR9XG5cblx0XHQvLyBoYW5kbGUgc2tldy90cmFuc2xhdGUgc2VwYXJhdGVseSwgY2F1c2UgaXQncyBicm9rZW5cblx0XHR2YXIgbXQgPSBtYXRyaXhbMF0udG9GaXhlZCg4KSArICcgJyArIG1hdHJpeFsxXS50b0ZpeGVkKDgpICsgJyAnICtcblx0XHRcdG1hdHJpeFsyXS50b0ZpeGVkKDgpICsgJyAnICsgbWF0cml4WzNdLnRvRml4ZWQoOCkgKyAnIDAgMCc7XG5cdFx0dmFyIG9mZnNldCA9IE1hdGguZmxvb3IobWF0cml4WzRdKS50b0ZpeGVkKCkgKyAnLCAnICtcblx0XHRcdE1hdGguZmxvb3IobWF0cml4WzVdKS50b0ZpeGVkKCkgKyAnJztcblxuXHRcdHZhciBzID0gdGhpcy5fcGF0aC5zdHlsZTtcblx0XHR2YXIgbCA9IHBhcnNlRmxvYXQocy5sZWZ0KTtcblx0XHR2YXIgdCA9IHBhcnNlRmxvYXQocy50b3ApO1xuXHRcdHZhciB3ID0gcGFyc2VGbG9hdChzLndpZHRoKTtcblx0XHR2YXIgaCA9IHBhcnNlRmxvYXQocy5oZWlnaHQpO1xuXG5cdFx0aWYgKGlzTmFOKGwpKSB7IGwgPSAwOyB9XG5cdFx0aWYgKGlzTmFOKHQpKSB7IHQgPSAwOyB9XG5cdFx0aWYgKGlzTmFOKHcpIHx8ICF3KSB7IHcgPSAxOyB9XG5cdFx0aWYgKGlzTmFOKGgpIHx8ICFoKSB7IGggPSAxOyB9XG5cblx0XHR2YXIgb3JpZ2luID0gKC1sIC8gdyAtIDAuNSkudG9GaXhlZCg4KSArICcgJyArICgtdCAvIGggLSAwLjUpLnRvRml4ZWQoOCk7XG5cblx0XHRza2V3Lm9uID0gJ2YnO1xuXHRcdHNrZXcubWF0cml4ID0gbXQ7XG5cdFx0c2tldy5vcmlnaW4gPSBvcmlnaW47XG5cdFx0c2tldy5vZmZzZXQgPSBvZmZzZXQ7XG5cdFx0c2tldy5vbiA9IHRydWU7XG5cdH1cblxufSk7XG4iLCJMLlNWRy5pbmNsdWRlKHtcblxuXHQvKipcblx0ICogUmVzZXQgdHJhbnNmb3JtIG1hdHJpeFxuXHQgKi9cblx0X3Jlc2V0VHJhbnNmb3JtUGF0aDogZnVuY3Rpb24obGF5ZXIpIHtcblx0XHRsYXllci5fcGF0aC5zZXRBdHRyaWJ1dGVOUyhudWxsLCAndHJhbnNmb3JtJywgJycpO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBBcHBsaWVzIG1hdHJpeCB0cmFuc2Zvcm1hdGlvbiB0byBTVkdcblx0ICogQHBhcmFtIHtMLlBhdGh9ICAgICAgICAgbGF5ZXJcblx0ICogQHBhcmFtIHtBcnJheS48TnVtYmVyPn0gbWF0cml4XG5cdCAqL1xuXHR0cmFuc2Zvcm1QYXRoOiBmdW5jdGlvbihsYXllciwgbWF0cml4KSB7XG5cdFx0bGF5ZXIuX3BhdGguc2V0QXR0cmlidXRlTlMobnVsbCwgJ3RyYW5zZm9ybScsXG5cdFx0XHQnbWF0cml4KCcgKyBtYXRyaXguam9pbignICcpICsgJyknKTtcblx0fVxuXG59KTtcbiIsInZhciBMID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJ0wnXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJ0wnXSA6IG51bGwpO1xuXG52YXIgQ2lyY2xlID0gbW9kdWxlLmV4cG9ydHMgPSBMLkNpcmNsZU1hcmtlci5leHRlbmQoe1xuXG4gIG9wdGlvbnM6IHtcbiAgICB0ZXh0U3R5bGU6IHtcbiAgICAgIGNvbG9yOiAnI2ZmZicsXG4gICAgICBmb250U2l6ZTogMTIsXG4gICAgICBmb250V2VpZ2h0OiAzMDBcbiAgICB9LFxuICAgIHNoaWZ0WTogNyxcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAY2xhc3MgTGFiZWxlZENpcmNsZVxuICAgKiBAY29uc3RydWN0b3JcbiAgICogQGV4dGVuZHMge0wuQ2lyY2xlTWFya2VyfVxuICAgKiBAcGFyYW0gIHtTdHJpbmd9ICAgdGV4dFxuICAgKiBAcGFyYW0gIHtMLkxhdExuZ30gbGF0bG5nXG4gICAqIEBwYXJhbSAge09iamVjdD19ICBvcHRpb25zXG4gICAqL1xuICBpbml0aWFsaXplOiBmdW5jdGlvbih0ZXh0LCBsYXRsbmcsIG9wdGlvbnMpIHtcbiAgICAvKipcbiAgICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgICAqL1xuICAgIHRoaXMuX3RleHQgICAgICAgID0gdGV4dDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtTVkdUZXh0RWxlbWVudH1cbiAgICAgKi9cbiAgICB0aGlzLl90ZXh0RWxlbWVudCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7VGV4dE5vZGV9XG4gICAgICovXG4gICAgdGhpcy5fdGV4dE5vZGUgICAgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge09iamVjdHxOdWxsfVxuICAgICAqL1xuICAgIHRoaXMuX3RleHRMYXllciAgID0gbnVsbDtcblxuICAgIEwuQ2lyY2xlTWFya2VyLnByb3RvdHlwZS5pbml0aWFsaXplLmNhbGwodGhpcywgbGF0bG5nLCBvcHRpb25zKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0ge1N0cmluZ30gdGV4dFxuICAgKiBAcmV0dXJuIHtMYWJlbGVkQ2lyY2xlfVxuICAgKi9cbiAgc2V0VGV4dDogZnVuY3Rpb24odGV4dCkge1xuICAgIHRoaXMuX3RleHQgPSB0ZXh0O1xuICAgIGlmICh0aGlzLl90ZXh0Tm9kZSkge1xuICAgICAgdGhpcy5fdGV4dEVsZW1lbnQucmVtb3ZlQ2hpbGQodGhpcy5fdGV4dE5vZGUpO1xuICAgIH1cbiAgICB0aGlzLl90ZXh0Tm9kZSA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKHRoaXMuX3RleHQpO1xuICAgIHRoaXMuX3RleHRFbGVtZW50LmFwcGVuZENoaWxkKHRoaXMuX3RleHROb2RlKTtcblxuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEByZXR1cm4ge1N0cmluZ31cbiAgICovXG4gIGdldFRleHQ6IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5fdGV4dDtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBBbHNvIGJyaW5nIHRleHQgdG8gZnJvbnRcbiAgICogQG92ZXJyaWRlXG4gICAqL1xuICBicmluZ1RvRnJvbnQ6IGZ1bmN0aW9uKCkge1xuICAgIEwuQ2lyY2xlTWFya2VyLnByb3RvdHlwZS5icmluZ1RvRnJvbnQuY2FsbCh0aGlzKTtcbiAgICB0aGlzLl9ncm91cFRleHRUb1BhdGgoKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAb3ZlcnJpZGVcbiAgICovXG4gIGJyaW5nVG9CYWNrOiBmdW5jdGlvbigpIHtcbiAgICBMLkNpcmNsZU1hcmtlci5wcm90b3R5cGUuYnJpbmdUb0JhY2suY2FsbCh0aGlzKTtcbiAgICB0aGlzLl9ncm91cFRleHRUb1BhdGgoKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBQdXQgdGV4dCBpbiB0aGUgcmlnaHQgcG9zaXRpb24gaW4gdGhlIGRvbVxuICAgKi9cbiAgX2dyb3VwVGV4dFRvUGF0aDogZnVuY3Rpb24oKSB7XG4gICAgdmFyIHBhdGggICAgICAgID0gdGhpcy5fcGF0aDtcbiAgICB2YXIgdGV4dEVsZW1lbnQgPSB0aGlzLl90ZXh0RWxlbWVudDtcbiAgICB2YXIgbmV4dCAgICAgICAgPSBwYXRoLm5leHRTaWJsaW5nO1xuICAgIHZhciBwYXJlbnQgICAgICA9IHBhdGgucGFyZW50Tm9kZTtcblxuXG4gICAgaWYgKHRleHRFbGVtZW50ICYmIHBhcmVudCkge1xuICAgICAgaWYgKG5leHQgJiYgbmV4dCAhPT0gdGV4dEVsZW1lbnQpIHtcbiAgICAgICAgcGFyZW50Lmluc2VydEJlZm9yZSh0ZXh0RWxlbWVudCwgbmV4dCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwYXJlbnQuYXBwZW5kQ2hpbGQodGV4dEVsZW1lbnQpO1xuICAgICAgfVxuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBQb3NpdGlvbiB0aGUgdGV4dCBpbiBjb250YWluZXJcbiAgICovXG4gIF91cGRhdGVQYXRoOiBmdW5jdGlvbigpIHtcbiAgICBMLkNpcmNsZU1hcmtlci5wcm90b3R5cGUuX3VwZGF0ZVBhdGguY2FsbCh0aGlzKTtcbiAgICB0aGlzLl91cGRhdGVUZXh0UG9zaXRpb24oKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAb3ZlcnJpZGVcbiAgICovXG4gIF90cmFuc2Zvcm06IGZ1bmN0aW9uKG1hdHJpeCkge1xuICAgIEwuQ2lyY2xlTWFya2VyLnByb3RvdHlwZS5fdHJhbnNmb3JtLmNhbGwodGhpcywgbWF0cml4KTtcblxuICAgIC8vIHdyYXAgdGV4dEVsZW1lbnQgd2l0aCBhIGZha2UgbGF5ZXIgZm9yIHJlbmRlcmVyXG4gICAgLy8gdG8gYmUgYWJsZSB0byB0cmFuc2Zvcm0gaXRcbiAgICB0aGlzLl90ZXh0TGF5ZXIgPSB0aGlzLl90ZXh0TGF5ZXIgfHwgeyBfcGF0aDogdGhpcy5fdGV4dEVsZW1lbnQgfTtcbiAgICBpZiAobWF0cml4KSB7XG4gICAgICB0aGlzLl9yZW5kZXJlci50cmFuc2Zvcm1QYXRoKHRoaXMuX3RleHRMYXllciwgbWF0cml4KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fcmVuZGVyZXIuX3Jlc2V0VHJhbnNmb3JtUGF0aCh0aGlzLl90ZXh0TGF5ZXIpO1xuICAgICAgdGhpcy5fdXBkYXRlVGV4dFBvc2l0aW9uKCk7XG4gICAgICB0aGlzLl90ZXh0TGF5ZXIgPSBudWxsO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0gIHtMLk1hcH0gbWFwXG4gICAqIEByZXR1cm4ge0xhYmVsZWRDaXJjbGV9XG4gICAqL1xuICBvbkFkZDogZnVuY3Rpb24obWFwKSB7XG4gICAgTC5DaXJjbGVNYXJrZXIucHJvdG90eXBlLm9uQWRkLmNhbGwodGhpcywgbWFwKTtcbiAgICB0aGlzLl9pbml0VGV4dCgpO1xuICAgIHRoaXMuX3VwZGF0ZVRleHRQb3NpdGlvbigpO1xuICAgIHRoaXMuc2V0U3R5bGUoKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYW5kIGluc2VydCB0ZXh0XG4gICAqL1xuICBfaW5pdFRleHQ6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuX3RleHRFbGVtZW50ID0gTC5TVkcuY3JlYXRlKCd0ZXh0Jyk7XG4gICAgdGhpcy5zZXRUZXh0KHRoaXMuX3RleHQpO1xuICAgIHRoaXMuX3JlbmRlcmVyLl9yb290R3JvdXAuYXBwZW5kQ2hpbGQodGhpcy5fdGV4dEVsZW1lbnQpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIENhbGN1bGF0ZSBwb3NpdGlvbiBmb3IgdGV4dFxuICAgKi9cbiAgX3VwZGF0ZVRleHRQb3NpdGlvbjogZnVuY3Rpb24oKSB7XG4gICAgdmFyIHRleHRFbGVtZW50ID0gdGhpcy5fdGV4dEVsZW1lbnQ7XG4gICAgaWYgKHRleHRFbGVtZW50KSB7XG4gICAgICB2YXIgYmJveCA9IHRleHRFbGVtZW50LmdldEJCb3goKTtcbiAgICAgIHZhciB0ZXh0UG9zaXRpb24gPSB0aGlzLl9wb2ludC5zdWJ0cmFjdChcbiAgICAgICAgTC5wb2ludChiYm94LndpZHRoLCAtYmJveC5oZWlnaHQgKyB0aGlzLm9wdGlvbnMuc2hpZnRZKS5kaXZpZGVCeSgyKSk7XG5cbiAgICAgIHRleHRFbGVtZW50LnNldEF0dHJpYnV0ZSgneCcsIHRleHRQb3NpdGlvbi54KTtcbiAgICAgIHRleHRFbGVtZW50LnNldEF0dHJpYnV0ZSgneScsIHRleHRQb3NpdGlvbi55KTtcbiAgICAgIHRoaXMuX2dyb3VwVGV4dFRvUGF0aCgpO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBTZXQgdGV4dCBzdHlsZVxuICAgKi9cbiAgc2V0U3R5bGU6IGZ1bmN0aW9uKHN0eWxlKSB7XG4gICAgTC5DaXJjbGVNYXJrZXIucHJvdG90eXBlLnNldFN0eWxlLmNhbGwodGhpcywgc3R5bGUpO1xuICAgIGlmICh0aGlzLl90ZXh0RWxlbWVudCkge1xuICAgICAgdmFyIHN0eWxlcyA9IHRoaXMub3B0aW9ucy50ZXh0U3R5bGU7XG4gICAgICBmb3IgKHZhciBwcm9wIGluIHN0eWxlcykge1xuICAgICAgICBpZiAoc3R5bGVzLmhhc093blByb3BlcnR5KHByb3ApKSB7XG4gICAgICAgICAgdmFyIHN0eWxlUHJvcCA9IHByb3A7XG4gICAgICAgICAgaWYgKHByb3AgPT09ICdjb2xvcicpIHtcbiAgICAgICAgICAgIHN0eWxlUHJvcCA9ICdzdHJva2UnO1xuICAgICAgICAgIH1cbiAgICAgICAgICB0aGlzLl90ZXh0RWxlbWVudC5zdHlsZVtzdHlsZVByb3BdID0gc3R5bGVzW3Byb3BdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIFJlbW92ZSB0ZXh0XG4gICAqL1xuICBvblJlbW92ZTogZnVuY3Rpb24obWFwKSB7XG4gICAgaWYgKHRoaXMuX3RleHRFbGVtZW50KSB7XG4gICAgICBpZiAodGhpcy5fdGV4dEVsZW1lbnQucGFyZW50Tm9kZSkge1xuICAgICAgICB0aGlzLl90ZXh0RWxlbWVudC5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHRoaXMuX3RleHRFbGVtZW50KTtcbiAgICAgIH1cbiAgICAgIHRoaXMuX3RleHRFbGVtZW50ID0gbnVsbDtcbiAgICAgIHRoaXMuX3RleHROb2RlID0gbnVsbDtcbiAgICAgIHRoaXMuX3RleHRMYXllciA9IG51bGw7XG4gICAgfVxuXG4gICAgcmV0dXJuIEwuQ2lyY2xlTWFya2VyLnByb3RvdHlwZS5vblJlbW92ZS5jYWxsKHRoaXMsIG1hcCk7XG4gIH1cblxufSk7XG5cblxuTC5UZXh0Q2lyY2xlID0gQ2lyY2xlO1xuTC50ZXh0Q2lyY2xlID0gZnVuY3Rpb24gKHRleHQsIGxhdGxuZywgb3B0aW9ucykge1xuICByZXR1cm4gbmV3IENpcmNsZSh0ZXh0LCBsYXRsbmcsIG9wdGlvbnMpO1xufTtcbiIsInZhciBMID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJ0wnXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJ0wnXSA6IG51bGwpO1xudmFyIENpcmNsZSA9IHJlcXVpcmUoJy4vY2lyY2xlJyk7XG5yZXF1aXJlKCdsZWFmbGV0LXBhdGgtZHJhZycpO1xuXG52YXIgTGFiZWxlZE1hcmtlciA9IEwuRmVhdHVyZUdyb3VwLmV4dGVuZCh7XG5cbiAgb3B0aW9uczoge1xuXG4gICAgLyoqXG4gICAgICogQHBhcmFtICB7TGFiZWxlZE1hcmtlcn0gbWFya2VyXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSAgICAgICAgZmVhdHVyZVxuICAgICAqIEByZXR1cm4ge1N0cmluZ31cbiAgICAgKi9cbiAgICBnZXRMYWJlbFRleHQ6IGZ1bmN0aW9uKG1hcmtlciwgZmVhdHVyZSkge1xuICAgICAgcmV0dXJuIGZlYXR1cmUucHJvcGVydGllcy50ZXh0O1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0gIHtMYWJlbGVkTWFya2VyfSBtYXJrZXJcbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgICAgICBmZWF0dXJlXG4gICAgICogQHBhcmFtICB7TC5MYXRMbmd9ICAgICAgbGF0bG5nXG4gICAgICogQHJldHVybiB7TC5MYXRMbmd9XG4gICAgICovXG4gICAgZ2V0TGFiZWxQb3NpdGlvbjogZnVuY3Rpb24obWFya2VyLCBmZWF0dXJlLCBsYXRsbmcpIHtcbiAgICAgIHJldHVybiBmZWF0dXJlLnByb3BlcnRpZXMubGFiZWxQb3NpdGlvbiA/XG4gICAgICAgIEwubGF0TG5nKGZlYXR1cmUucHJvcGVydGllcy5sYWJlbFBvc2l0aW9uLnNsaWNlKCkucmV2ZXJzZSgpKSA6XG4gICAgICAgIGxhdGxuZztcbiAgICB9LFxuXG4gICAgbGFiZWxQb3NpdGlvbktleTogJ2xhYmVsUG9zaXRpb24nLFxuXG4gICAgbWFya2VyT3B0aW9uczoge1xuICAgICAgY29sb3I6ICcjZjAwJyxcbiAgICAgIGZpbGxPcGFjaXR5OiAwLjc1LFxuICAgICAgZHJhZ2dhYmxlOiB0cnVlLFxuICAgICAgcmFkaXVzOiAxNVxuICAgIH0sXG5cbiAgICBhbmNob3JPcHRpb25zOiB7XG4gICAgICBjb2xvcjogJyMwMGYnLFxuICAgICAgcmFkaXVzOiAzXG4gICAgfSxcblxuICAgIGxpbmVPcHRpb25zOiB7XG4gICAgICBjb2xvcjogJyNmMDAnLFxuICAgICAgZGFzaEFycmF5OiBbMiwgNl0sXG4gICAgICBsaW5lQ2FwOiAnc3F1YXJlJyxcbiAgICAgIHdlaWdodDogMlxuICAgIH1cblxuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBjbGFzcyBMYWJlbGVkTWFya2VyXG4gICAqIEBjb25zdHJ1Y3RvclxuICAgKiBAZXh0ZW5kcyB7TC5GZWF0dXJlR3JvdXB9XG4gICAqXG4gICAqIEBwYXJhbSAge0wuTGF0TG5nfSBsYXRsbmdcbiAgICogQHBhcmFtICB7T2JqZWN0PX0gIGZlYXR1cmVcbiAgICogQHBhcmFtICB7T2JqZWN0PX0gIG9wdGlvbnNcbiAgICovXG4gIGluaXRpYWxpemU6IGZ1bmN0aW9uKGxhdGxuZywgZmVhdHVyZSwgb3B0aW9ucykge1xuICAgIEwuVXRpbC5zZXRPcHRpb25zKHRoaXMsIG9wdGlvbnMpO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge09iamVjdH1cbiAgICAgKi9cbiAgICB0aGlzLmZlYXR1cmUgPSBmZWF0dXJlIHx8IHtcbiAgICAgIHR5cGU6ICdGZWF0dXJlJyxcbiAgICAgIHByb3BlcnRpZXM6IHt9LFxuICAgICAgZ2VvbWV0cnk6IHtcbiAgICAgICAgJ3R5cGUnOiAnUG9pbnQnXG4gICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLkxhdExuZ31cbiAgICAgKi9cbiAgICB0aGlzLl9sYXRsbmcgPSBsYXRsbmc7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtDaXJjbGVMYWJlbH1cbiAgICAgKi9cbiAgICB0aGlzLl9tYXJrZXIgPSBudWxsO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TC5DaXJjbGVNYXJrZXJ9XG4gICAgICovXG4gICAgdGhpcy5fYW5jaG9yID0gbnVsbDtcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuUG9seWxpbmV9XG4gICAgICovXG4gICAgdGhpcy5fbGluZSA9IG51bGw7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLlBvaW50fVxuICAgICAqL1xuICAgIHRoaXMuX2luaXRpYWxEaXN0YW5jZSA9IG51bGw7XG5cbiAgICB0aGlzLl9jcmVhdGVMYXllcnMoKTtcbiAgICBMLkxheWVyR3JvdXAucHJvdG90eXBlLmluaXRpYWxpemUuY2FsbCh0aGlzLFxuICAgICAgW3RoaXMuX2FuY2hvciwgdGhpcy5fbGluZSwgdGhpcy5fbWFya2VyXSk7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHJldHVybiB7TC5MYXRMbmd9XG4gICAqL1xuICBnZXRMYWJlbFBvc2l0aW9uOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fbWFya2VyLmdldExhdExuZygpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEByZXR1cm4ge0wuTGF0TG5nfVxuICAgKi9cbiAgZ2V0TGF0TG5nOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5fbGF0bG5nO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIFNlcmlhbGl6ZVxuICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAqL1xuICB0b0dlb0pTT046IGZ1bmN0aW9uKGdlb21ldHJ5Q29sbGVjdGlvbikge1xuICAgIHZhciBmZWF0dXJlID0gTC5HZW9KU09OLmdldEZlYXR1cmUodGhpcywge1xuICAgICAgdHlwZTogJ1BvaW50JyxcbiAgICAgIGNvb3JkaW5hdGVzOiBMLkdlb0pTT04ubGF0TG5nVG9Db29yZHModGhpcy5fYW5jaG9yLmdldExhdExuZygpKVxuICAgIH0pO1xuICAgIGZlYXR1cmUucHJvcGVydGllc1t0aGlzLm9wdGlvbnMubGFiZWxQb3NpdGlvbktleV0gPVxuICAgICAgTC5HZW9KU09OLmxhdExuZ1RvQ29vcmRzKHRoaXMuX21hcmtlci5nZXRMYXRMbmcoKSk7XG4gICAgZmVhdHVyZS5wcm9wZXJ0aWVzLnRleHQgPSB0aGlzLl9tYXJrZXIuZ2V0VGV4dCgpO1xuICAgIHJldHVybiBnZW9tZXRyeUNvbGxlY3Rpb24gP1xuICAgICAgTC5MYWJlbGVkQ2lyY2xlTWFya2VyXG4gICAgICAgIC50b0dlb21ldHJ5Q29sbGVjdGlvbihmZWF0dXJlLCB0aGlzLm9wdGlvbnMubGFiZWxQb3NpdGlvbktleSkgOiBmZWF0dXJlO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSB7U3RyaW5nfSB0ZXh0XG4gICAqIEByZXR1cm4ge0xhYmVsZWRNYXJrZXJ9XG4gICAqL1xuICBzZXRUZXh0OiBmdW5jdGlvbih0ZXh0KSB7XG4gICAgdGhpcy5fbWFya2VyLnNldFRleHQodGV4dCk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cblxuICAvKipcbiAgICogQ3JlYXRlcyBhbmNob3IsIGxpbmUgYW5kIGxhYmVsXG4gICAqL1xuICBfY3JlYXRlTGF5ZXJzOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgb3B0cyA9IHRoaXMub3B0aW9ucztcbiAgICB2YXIgcG9zICA9IG9wdHMuZ2V0TGFiZWxQb3NpdGlvbih0aGlzLCB0aGlzLmZlYXR1cmUsIHRoaXMuX2xhdGxuZyk7XG4gICAgdmFyIHRleHQgPSBvcHRzLmdldExhYmVsVGV4dCh0aGlzLCB0aGlzLmZlYXR1cmUpO1xuXG4gICAgdGhpcy5fbWFya2VyID0gbmV3IENpcmNsZSh0ZXh0LCBwb3MsXG4gICAgICBMLlV0aWwuZXh0ZW5kKHtcbiAgICAgICAgaW50ZXJhY3RpdmU6IHRoaXMub3B0aW9ucy5pbnRlcmFjdGl2ZVxuICAgICAgfSxcbiAgICAgICAgTGFiZWxlZE1hcmtlci5wcm90b3R5cGUub3B0aW9ucy5tYXJrZXJPcHRpb25zLFxuICAgICAgICBvcHRzLm1hcmtlck9wdGlvbnMpXG4gICAgKS5vbignZHJhZycsICAgICAgdGhpcy5fb25NYXJrZXJEcmFnLCAgICAgIHRoaXMpXG4gICAgIC5vbignZHJhZ3N0YXJ0JywgdGhpcy5fb25NYXJrZXJEcmFnU3RhcnQsIHRoaXMpXG4gICAgIC5vbignZHJhZ2VuZCcsICAgdGhpcy5fb25NYXJrZXJEcmFnRW5kLCAgIHRoaXMpO1xuXG4gICAgdGhpcy5fYW5jaG9yID0gbmV3IEwuQ2lyY2xlTWFya2VyKHRoaXMuX2xhdGxuZyxcbiAgICAgIEwuVXRpbC5leHRlbmQoe30sIExhYmVsZWRNYXJrZXIucHJvdG90eXBlLm9wdGlvbnMuYW5jaG9yT3B0aW9ucyxcbiAgICAgICAgb3B0cy5hbmNob3JPcHRpb25zKSk7XG5cbiAgICB0aGlzLl9saW5lID0gbmV3IEwuUG9seWxpbmUoW3RoaXMuX2xhdGxuZywgdGhpcy5fbWFya2VyLmdldExhdExuZygpXSxcbiAgICAgIEwuVXRpbC5leHRlbmQoe30sIExhYmVsZWRNYXJrZXIucHJvdG90eXBlLm9wdGlvbnMubGluZU9wdGlvbnMsXG4gICAgICAgIG9wdHMubGluZU9wdGlvbnMpKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBTdG9yZSBzaGlmdCB0byBiZSBwcmVjaXNlIHdoaWxlIGRyYWdnaW5nXG4gICAqIEBwYXJhbSAge0V2ZW50fSBldnRcbiAgICovXG4gIF9vbk1hcmtlckRyYWdTdGFydDogZnVuY3Rpb24oZXZ0KSB7XG4gICAgdGhpcy5faW5pdGlhbERpc3RhbmNlID0gTC5Eb21FdmVudC5nZXRNb3VzZVBvc2l0aW9uKGV2dClcbiAgICAgIC5zdWJ0cmFjdCh0aGlzLl9tYXAubGF0TG5nVG9Db250YWluZXJQb2ludCh0aGlzLl9tYXJrZXIuZ2V0TGF0TG5nKCkpKTtcbiAgICB0aGlzLmZpcmUoJ2xhYmVsOicgKyBldnQudHlwZSwgZXZ0KTtcbiAgICAvL0wuVXRpbC5yZXF1ZXN0QW5pbUZyYW1lKHRoaXMuX21hcmtlci5icmluZ1RvRnJvbnQsIHRoaXMuX21hcmtlcik7XG4gIH0sXG5cblxuICAvKipcbiAgICogTGluZSBkcmFnZ2luZ1xuICAgKiBAcGFyYW0gIHtEcmFnRXZlbnR9IGV2dFxuICAgKi9cbiAgX29uTWFya2VyRHJhZzogZnVuY3Rpb24oZXZ0KSB7XG4gICAgdmFyIGxhdGxuZyA9IHRoaXMuX21hcC5jb250YWluZXJQb2ludFRvTGF0TG5nKFxuICAgICAgTC5Eb21FdmVudC5nZXRNb3VzZVBvc2l0aW9uKGV2dCkuX3N1YnRyYWN0KHRoaXMuX2luaXRpYWxEaXN0YW5jZSkpO1xuICAgIHRoaXMuX2xpbmUuc2V0TGF0TG5ncyhbbGF0bG5nLCB0aGlzLl9sYXRsbmddKTtcbiAgICB0aGlzLmZpcmUoJ2xhYmVsOicgKyBldnQudHlwZSwgZXZ0KTtcbiAgfSxcblxuXG4gIF9vbk1hcmtlckRyYWdFbmQ6IGZ1bmN0aW9uKGV2dCkge1xuICAgIHRoaXMuZmlyZSgnbGFiZWw6JyArIGV2dC50eXBlLCBldnQpO1xuICB9XG5cbn0pO1xuXG5cbi8qKlxuICogQHBhcmFtICB7T2JqZWN0fSBmZWF0dXJlXG4gKiBAcGFyYW0gIHtTdHJpbmc9fSBrZXlcbiAqIEByZXR1cm4ge09iamVjdH1cbiAqL1xuZnVuY3Rpb24gdG9HZW9tZXRyeUNvbGxlY3Rpb24oZmVhdHVyZSwga2V5KSB7XG4gIGtleSA9IGtleSB8fCAnbGFiZWxQb3NpdGlvbic7XG4gIHZhciBhbmNob3JQb3MgPSBmZWF0dXJlLmdlb21ldHJ5LmNvb3JkaW5hdGVzLnNsaWNlKCk7XG4gIHZhciBsYWJlbFBvcyAgPSBmZWF0dXJlLnByb3BlcnRpZXNba2V5XTtcblxuICBpZiAoIWxhYmVsUG9zKSB0aHJvdyBuZXcgRXJyb3IoJ05vIGxhYmVsIHBvc2l0aW9uIHNldCcpO1xuXG4gIGxhYmVsUG9zID0gbGFiZWxQb3Muc2xpY2UoKTtcbiAgdmFyIGdlb21ldHJpZXMgPSBbe1xuICAgIHR5cGU6ICdQb2ludCcsXG4gICAgY29vcmRpbmF0ZXM6IGFuY2hvclBvc1xuICB9LCB7XG4gICAgdHlwZTogJ0xpbmVTdHJpbmcnLFxuICAgIGNvb3JkaW5hdGVzOiBbXG4gICAgICBhbmNob3JQb3Muc2xpY2UoKSxcbiAgICAgIGxhYmVsUG9zXG4gICAgXVxuICB9LCB7XG4gICAgdHlwZTogJ1BvaW50JyxcbiAgICBjb29yZGluYXRlczogbGFiZWxQb3Muc2xpY2UoKVxuICB9LCB7XG4gICAgdHlwZTogJ1BvaW50JyxcbiAgICBjb29yZGluYXRlczogbGFiZWxQb3Muc2xpY2UoKVxuICB9XTtcblxuICByZXR1cm4ge1xuICAgIHR5cGU6ICdGZWF0dXJlJyxcbiAgICBwcm9wZXJ0aWVzOiBMLlV0aWwuZXh0ZW5kKHt9LCBmZWF0dXJlLnByb3BlcnRpZXMsIHtcbiAgICAgIGdlb21ldHJpZXNUeXBlczogWydhbmNob3InLCAnY29ubmVjdGlvbicsICdsYWJlbCcsICd0ZXh0Ym94J11cbiAgICB9KSxcbiAgICBiYm94OiBmZWF0dXJlLmJib3gsXG4gICAgZ2VvbWV0cnk6IHtcbiAgICAgIHR5cGU6ICdHZW9tZXRyeUNvbGxlY3Rpb24nLFxuICAgICAgZ2VvbWV0cmllczogZ2VvbWV0cmllc1xuICAgIH1cbiAgfTtcbn1cblxuTGFiZWxlZE1hcmtlci50b0dlb21ldHJ5Q29sbGVjdGlvbiA9IHRvR2VvbWV0cnlDb2xsZWN0aW9uO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEwuTGFiZWxlZENpcmNsZU1hcmtlciA9IExhYmVsZWRNYXJrZXI7XG5MLmxhYmVsZWRDaXJjbGVNYXJrZXIgPSBmdW5jdGlvbihsYXRsbmcsIGZlYXR1cmUsIG9wdGlvbnMpIHtcbiAgcmV0dXJuIG5ldyBMYWJlbGVkTWFya2VyKGxhdGxuZywgZmVhdHVyZSwgb3B0aW9ucyk7XG59O1xuIl19
