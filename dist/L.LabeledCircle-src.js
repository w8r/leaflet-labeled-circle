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
      this._draw(true);
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
   * @param  {L.Path} layer
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
      .on(document, L.Draggable.MOVE[eventType], this._onDrag, this)
      .on(document, L.Draggable.END[eventType], this._onDragEnd, this);

    if (this._path._map.dragging.enabled()) {
      // I guess it's required because mousdown gets simulated with a delay
      this._path._map.dragging._draggable._onUp();

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
    L.DomEvent.stop(evt);
    L.DomEvent._fakeStop({ type: 'click' });

    var containerPoint = this._path._map.mouseEventToContainerPoint(evt);

    // apply matrix
    if (this.moved()) {
      this._transformPoints(this._matrix);
      this._path._updatePath();
      this._path._project();
      this._path._transform(null);
    }

    L.DomEvent
      .off(document, 'mousemove touchmove', this._onDrag, this)
      .off(document, 'mouseup touchend',    this._onDragEnd, this);

    this._restoreCoordGetters();
    // consistency
    this._path.fire('dragend', {
      distance: Math.sqrt(
        L.LineUtil._sqDist(this._dragStartPoint, containerPoint)
      )
    });

    this._matrix         = null;
    this._startPoint     = null;
    this._dragStartPoint = null;

    if (this._mapDraggingWasEnabled) {
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
'use strict';

var L = require('leaflet');

module.exports = L.CircleMarker.extend({

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
  }
});

},{"leaflet":undefined}],9:[function(require,module,exports){
'use strict';

var L = require('leaflet');
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

    this._marker = new Circle(text, pos, L.Util.extend({}, LabeledMarker.prototype.options.markerOptions, opts.markerOptions)).on('drag', this._onMarkerDrag, this).on('dragstart', this._onMarkerDragStart, this);

    this._anchor = new L.CircleMarker(this._latlng, L.Util.extend({}, LabeledMarker.prototype.options.anchorOptions, opts.anchorOptions));

    this._line = new L.Polyline([this._latlng, this._marker.getLatLng()], L.Util.extend({}, LabeledMarker.prototype.options.lineOptions, opts.lineOptions));
  },

  /**
   * Store shift to be precise while dragging
   * @param  {Event} evt
   */
  _onMarkerDragStart: function _onMarkerDragStart(evt) {
    this._initialDistance = L.DomEvent.getMousePosition(evt).subtract(this._map.latLngToContainerPoint(this._marker.getLatLng()));
    //L.Util.requestAnimFrame(this._marker.bringToFront, this._marker);
  },

  /**
   * Line dragging
   * @param  {DragEvent} evt
   */
  _onMarkerDrag: function _onMarkerDrag(evt) {
    var latlng = this._map.containerPointToLatLng(L.DomEvent.getMousePosition(evt)._subtract(this._initialDistance));
    this._line.setLatLngs([latlng, this._latlng]);
  }

});

module.exports = L.LabeledCircleMarker = LabeledMarker;
L.labeledCircleMarker = function (latlng, feature, options) {
  return new LabeledMarker(latlng, feature, options);
};

},{"./circle":8,"leaflet":undefined,"leaflet-path-drag":2}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9sZWFmbGV0LXBhdGgtZHJhZy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9sZWFmbGV0LXBhdGgtZHJhZy9zcmMvQ2FudmFzLmpzIiwibm9kZV9tb2R1bGVzL2xlYWZsZXQtcGF0aC1kcmFnL3NyYy9QYXRoLkRyYWcuanMiLCJub2RlX21vZHVsZXMvbGVhZmxldC1wYXRoLWRyYWcvc3JjL1BhdGguVHJhbnNmb3JtLmpzIiwibm9kZV9tb2R1bGVzL2xlYWZsZXQtcGF0aC1kcmFnL3NyYy9TVkcuVk1MLmpzIiwibm9kZV9tb2R1bGVzL2xlYWZsZXQtcGF0aC1kcmFnL3NyYy9TVkcuanMiLCJzcmMvY2lyY2xlLmpzIiwic3JjL21hcmtlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7OztBQ09BLE9BQU8sT0FBUCxHQUFpQixRQUFRLGNBQVIsQ0FBakI7OztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtB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LENBQ1osS0FBSyxJQUFMLENBQVUsc0JBQVYsQ0FBaUMsS0FBSyxPQUFMLENBQWEsU0FBYixFQUFqQyxDQURZLENBQXhCOztBQURnQyxHQUFkOzs7Ozs7QUFXcEIsaUJBQWUsdUJBQVMsR0FBVCxFQUFjO0FBQzNCLFFBQUksU0FBUyxLQUFLLElBQUwsQ0FBVSxzQkFBVixDQUNYLEVBQUUsUUFBRixDQUFXLGdCQUFYLENBQTRCLEdBQTVCLEVBQWlDLFNBQWpDLENBQTJDLEtBQUssZ0JBQUwsQ0FEaEMsQ0FBVCxDQUR1QjtBQUczQixTQUFLLEtBQUwsQ0FBVyxVQUFYLENBQXNCLENBQUMsTUFBRCxFQUFTLEtBQUssT0FBTCxDQUEvQixFQUgyQjtHQUFkOztDQTVMRyxDQUFoQjs7QUFvTUosT0FBTyxPQUFQLEdBQWlCLEVBQUUsbUJBQUYsR0FBd0IsYUFBeEI7QUFDakIsRUFBRSxtQkFBRixHQUF3QixVQUFTLE1BQVQsRUFBaUIsT0FBakIsRUFBMEIsT0FBMUIsRUFBbUM7QUFDekQsU0FBTyxJQUFJLGFBQUosQ0FBa0IsTUFBbEIsRUFBMEIsT0FBMUIsRUFBbUMsT0FBbkMsQ0FBUCxDQUR5RDtDQUFuQyIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvKipcbiAqIExlYWZsZXQgU1ZHIGNpcmNsZSBtYXJrZXIgd2l0aCBkZXRhY2hhYmxlIGFuZCBkcmFnZ2FibGUgbGFiZWwgYW5kIHRleHRcbiAqXG4gKiBAYXV0aG9yIEFsZXhhbmRlciBNaWxldnNraSA8aW5mb0B3OHIubmFtZT5cbiAqIEBsaWNlbnNlIE1JVFxuICogQHByZXNlcnZlXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9zcmMvbWFya2VyJyk7XG4iLCJyZXF1aXJlKCcuL3NyYy9TVkcnKTtcbnJlcXVpcmUoJy4vc3JjL1NWRy5WTUwnKTtcbnJlcXVpcmUoJy4vc3JjL0NhbnZhcycpO1xucmVxdWlyZSgnLi9zcmMvUGF0aC5UcmFuc2Zvcm0nKTtcbnJlcXVpcmUoJy4vc3JjL1BhdGguRHJhZycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEwuUGF0aC5EcmFnO1xuIiwiTC5VdGlsLnRydWVGbiA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gdHJ1ZTtcbn07XG5cbkwuQ2FudmFzLmluY2x1ZGUoe1xuXG4gIC8qKlxuICAgKiBEbyBub3RoaW5nXG4gICAqIEBwYXJhbSAge0wuUGF0aH0gbGF5ZXJcbiAgICovXG4gIF9yZXNldFRyYW5zZm9ybVBhdGg6IGZ1bmN0aW9uKGxheWVyKSB7XG4gICAgaWYgKCF0aGlzLl9jb250YWluZXJDb3B5KSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgZGVsZXRlIHRoaXMuX2NvbnRhaW5lckNvcHk7XG5cbiAgICBpZiAobGF5ZXIuX2NvbnRhaW5zUG9pbnRfKSB7XG4gICAgICBsYXllci5fY29udGFpbnNQb2ludCA9IGxheWVyLl9jb250YWluc1BvaW50XztcbiAgICAgIGRlbGV0ZSBsYXllci5fY29udGFpbnNQb2ludF87XG5cbiAgICAgIHRoaXMuX3JlcXVlc3RSZWRyYXcobGF5ZXIpO1xuICAgICAgdGhpcy5fZHJhdyh0cnVlKTtcbiAgICB9XG4gIH0sXG5cbiAgLyoqXG4gICAqIEFsZ29yaXRobSBvdXRsaW5lOlxuICAgKlxuICAgKiAxLiBwcmUtdHJhbnNmb3JtIC0gY2xlYXIgdGhlIHBhdGggb3V0IG9mIHRoZSBjYW52YXMsIGNvcHkgY2FudmFzIHN0YXRlXG4gICAqIDIuIGF0IGV2ZXJ5IGZyYW1lOlxuICAgKiAgICAyLjEuIHNhdmVcbiAgICogICAgMi4yLiByZWRyYXcgdGhlIGNhbnZhcyBmcm9tIHNhdmVkIG9uZVxuICAgKiAgICAyLjMuIHRyYW5zZm9ybVxuICAgKiAgICAyLjQuIGRyYXcgcGF0aFxuICAgKiAgICAyLjUuIHJlc3RvcmVcbiAgICpcbiAgICogQHBhcmFtICB7TC5QYXRofSBsYXllclxuICAgKiBAcGFyYW0gIHtBcnJheS48TnVtYmVyPn0gbWF0cml4XG4gICAqL1xuICB0cmFuc2Zvcm1QYXRoOiBmdW5jdGlvbihsYXllciwgbWF0cml4KSB7XG4gICAgdmFyIGNvcHkgPSB0aGlzLl9jb250YWluZXJDb3B5O1xuICAgIHZhciBjdHggPSB0aGlzLl9jdHg7XG4gICAgdmFyIG0gPSBMLkJyb3dzZXIucmV0aW5hID8gMiA6IDE7XG4gICAgdmFyIGJvdW5kcyA9IHRoaXMuX2JvdW5kcztcbiAgICB2YXIgc2l6ZSA9IGJvdW5kcy5nZXRTaXplKCk7XG4gICAgdmFyIHBvcyA9IGJvdW5kcy5taW47XG5cbiAgICBpZiAoIWNvcHkpIHtcbiAgICAgIGNvcHkgPSB0aGlzLl9jb250YWluZXJDb3B5ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2FudmFzJyk7XG4gICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGNvcHkpO1xuXG4gICAgICBjb3B5LndpZHRoID0gbSAqIHNpemUueDtcbiAgICAgIGNvcHkuaGVpZ2h0ID0gbSAqIHNpemUueTtcblxuICAgICAgbGF5ZXIuX3JlbW92ZWQgPSB0cnVlO1xuICAgICAgdGhpcy5fcmVkcmF3KCk7XG5cbiAgICAgIGNvcHkuZ2V0Q29udGV4dCgnMmQnKS50cmFuc2xhdGUobSAqIGJvdW5kcy5taW4ueCwgbSAqIGJvdW5kcy5taW4ueSk7XG4gICAgICBjb3B5LmdldENvbnRleHQoJzJkJykuZHJhd0ltYWdlKHRoaXMuX2NvbnRhaW5lciwgMCwgMCk7XG4gICAgICB0aGlzLl9pbml0UGF0aChsYXllcik7XG4gICAgICBsYXllci5fY29udGFpbnNQb2ludF8gPSBsYXllci5fY29udGFpbnNQb2ludDtcbiAgICAgIGxheWVyLl9jb250YWluc1BvaW50ID0gTC5VdGlsLnRydWVGbjtcbiAgICB9XG5cbiAgICBjdHguc2F2ZSgpO1xuICAgIGN0eC5jbGVhclJlY3QocG9zLngsIHBvcy55LCBzaXplLnggKiBtLCBzaXplLnkgKiBtKTtcbiAgICBjdHguc2V0VHJhbnNmb3JtKDEsIDAsIDAsIDEsIDAsIDApO1xuICAgIGN0eC5yZXN0b3JlKCk7XG4gICAgY3R4LnNhdmUoKTtcblxuICAgIGN0eC5kcmF3SW1hZ2UodGhpcy5fY29udGFpbmVyQ29weSwgMCwgMCwgc2l6ZS54LCBzaXplLnkpO1xuICAgIGN0eC50cmFuc2Zvcm0uYXBwbHkoY3R4LCBtYXRyaXgpO1xuXG4gICAgdmFyIGxheWVycyA9IHRoaXMuX2xheWVycztcbiAgICB0aGlzLl9sYXllcnMgPSB7fTtcblxuICAgIHRoaXMuX2luaXRQYXRoKGxheWVyKTtcbiAgICBsYXllci5fdXBkYXRlUGF0aCgpO1xuXG4gICAgdGhpcy5fbGF5ZXJzID0gbGF5ZXJzO1xuICAgIGN0eC5yZXN0b3JlKCk7XG4gIH1cblxufSk7XG4iLCIvKipcbiAqIERyYWcgaGFuZGxlclxuICogQGNsYXNzIEwuUGF0aC5EcmFnXG4gKiBAZXh0ZW5kcyB7TC5IYW5kbGVyfVxuICovXG5MLkhhbmRsZXIuUGF0aERyYWcgPSBMLkhhbmRsZXIuZXh0ZW5kKCAvKiogQGxlbmRzICBMLlBhdGguRHJhZy5wcm90b3R5cGUgKi8ge1xuXG4gIHN0YXRpY3M6IHtcbiAgICBEUkFHR0lOR19DTFM6ICdsZWFmbGV0LXBhdGgtZHJhZ2dhYmxlJyxcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0gIHtMLlBhdGh9IHBhdGhcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqL1xuICBpbml0aWFsaXplOiBmdW5jdGlvbihwYXRoKSB7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TC5QYXRofVxuICAgICAqL1xuICAgIHRoaXMuX3BhdGggPSBwYXRoO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0FycmF5LjxOdW1iZXI+fVxuICAgICAqL1xuICAgIHRoaXMuX21hdHJpeCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TC5Qb2ludH1cbiAgICAgKi9cbiAgICB0aGlzLl9zdGFydFBvaW50ID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLlBvaW50fVxuICAgICAqL1xuICAgIHRoaXMuX2RyYWdTdGFydFBvaW50ID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtCb29sZWFufVxuICAgICAqL1xuICAgIHRoaXMuX21hcERyYWdnaW5nV2FzRW5hYmxlZCA9IGZhbHNlO1xuXG4gIH0sXG5cbiAgLyoqXG4gICAqIEVuYWJsZSBkcmFnZ2luZ1xuICAgKi9cbiAgYWRkSG9va3M6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuX3BhdGgub24oJ21vdXNlZG93bicsIHRoaXMuX29uRHJhZ1N0YXJ0LCB0aGlzKTtcblxuICAgIHRoaXMuX3BhdGgub3B0aW9ucy5jbGFzc05hbWUgPSB0aGlzLl9wYXRoLm9wdGlvbnMuY2xhc3NOYW1lID9cbiAgICAgICAgKHRoaXMuX3BhdGgub3B0aW9ucy5jbGFzc05hbWUgKyAnICcgKyBMLkhhbmRsZXIuUGF0aERyYWcuRFJBR0dJTkdfQ0xTKSA6XG4gICAgICAgICBMLkhhbmRsZXIuUGF0aERyYWcuRFJBR0dJTkdfQ0xTO1xuXG4gICAgaWYgKHRoaXMuX3BhdGguX3BhdGgpIHtcbiAgICAgIEwuRG9tVXRpbC5hZGRDbGFzcyh0aGlzLl9wYXRoLl9wYXRoLCBMLkhhbmRsZXIuUGF0aERyYWcuRFJBR0dJTkdfQ0xTKTtcbiAgICB9XG4gIH0sXG5cbiAgLyoqXG4gICAqIERpc2FibGUgZHJhZ2dpbmdcbiAgICovXG4gIHJlbW92ZUhvb2tzOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLl9wYXRoLm9mZignbW91c2Vkb3duJywgdGhpcy5fb25EcmFnU3RhcnQsIHRoaXMpO1xuXG4gICAgdGhpcy5fcGF0aC5vcHRpb25zLmNsYXNzTmFtZSA9IHRoaXMuX3BhdGgub3B0aW9ucy5jbGFzc05hbWVcbiAgICAgIC5yZXBsYWNlKG5ldyBSZWdFeHAoJ1xcXFxzKycgKyBMLkhhbmRsZXIuUGF0aERyYWcuRFJBR0dJTkdfQ0xTKSwgJycpO1xuICAgIGlmICh0aGlzLl9wYXRoLl9wYXRoKSB7XG4gICAgICBMLkRvbVV0aWwucmVtb3ZlQ2xhc3ModGhpcy5fcGF0aC5fcGF0aCwgTC5IYW5kbGVyLlBhdGhEcmFnLkRSQUdHSU5HX0NMUyk7XG4gICAgfVxuICB9LFxuXG4gIC8qKlxuICAgKiBAcmV0dXJuIHtCb29sZWFufVxuICAgKi9cbiAgbW92ZWQ6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLl9wYXRoLl9kcmFnTW92ZWQ7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFN0YXJ0IGRyYWdcbiAgICogQHBhcmFtICB7TC5Nb3VzZUV2ZW50fSBldnRcbiAgICovXG4gIF9vbkRyYWdTdGFydDogZnVuY3Rpb24oZXZ0KSB7XG4gICAgdmFyIGV2ZW50VHlwZSA9IGV2dC5vcmlnaW5hbEV2ZW50Ll9zaW11bGF0ZWQgPyAndG91Y2hzdGFydCcgOiBldnQub3JpZ2luYWxFdmVudC50eXBlO1xuXG4gICAgdGhpcy5fbWFwRHJhZ2dpbmdXYXNFbmFibGVkID0gZmFsc2U7XG4gICAgdGhpcy5fc3RhcnRQb2ludCA9IGV2dC5jb250YWluZXJQb2ludC5jbG9uZSgpO1xuICAgIHRoaXMuX2RyYWdTdGFydFBvaW50ID0gZXZ0LmNvbnRhaW5lclBvaW50LmNsb25lKCk7XG4gICAgdGhpcy5fbWF0cml4ID0gWzEsIDAsIDAsIDEsIDAsIDBdO1xuICAgIEwuRG9tRXZlbnQuc3RvcChldnQub3JpZ2luYWxFdmVudCk7XG5cbiAgICBMLkRvbVV0aWwuYWRkQ2xhc3ModGhpcy5fcGF0aC5fcmVuZGVyZXIuX2NvbnRhaW5lciwgJ2xlYWZsZXQtaW50ZXJhY3RpdmUnKTtcbiAgICBMLkRvbUV2ZW50XG4gICAgICAub24oZG9jdW1lbnQsIEwuRHJhZ2dhYmxlLk1PVkVbZXZlbnRUeXBlXSwgdGhpcy5fb25EcmFnLCB0aGlzKVxuICAgICAgLm9uKGRvY3VtZW50LCBMLkRyYWdnYWJsZS5FTkRbZXZlbnRUeXBlXSwgdGhpcy5fb25EcmFnRW5kLCB0aGlzKTtcblxuICAgIGlmICh0aGlzLl9wYXRoLl9tYXAuZHJhZ2dpbmcuZW5hYmxlZCgpKSB7XG4gICAgICAvLyBJIGd1ZXNzIGl0J3MgcmVxdWlyZWQgYmVjYXVzZSBtb3VzZG93biBnZXRzIHNpbXVsYXRlZCB3aXRoIGEgZGVsYXlcbiAgICAgIHRoaXMuX3BhdGguX21hcC5kcmFnZ2luZy5fZHJhZ2dhYmxlLl9vblVwKCk7XG5cbiAgICAgIHRoaXMuX3BhdGguX21hcC5kcmFnZ2luZy5kaXNhYmxlKCk7XG4gICAgICB0aGlzLl9tYXBEcmFnZ2luZ1dhc0VuYWJsZWQgPSB0cnVlO1xuICAgIH1cbiAgICB0aGlzLl9wYXRoLl9kcmFnTW92ZWQgPSBmYWxzZTtcblxuICAgIGlmICh0aGlzLl9wYXRoLl9wb3B1cCkgeyAvLyB0aGF0IG1pZ2h0IGJlIGEgY2FzZSBvbiB0b3VjaCBkZXZpY2VzIGFzIHdlbGxcbiAgICAgIHRoaXMuX3BhdGguX3BvcHVwLl9jbG9zZSgpO1xuICAgIH1cblxuICAgIHRoaXMuX3JlcGxhY2VDb29yZEdldHRlcnMoZXZ0KTtcbiAgfSxcblxuICAvKipcbiAgICogRHJhZ2dpbmdcbiAgICogQHBhcmFtICB7TC5Nb3VzZUV2ZW50fSBldnRcbiAgICovXG4gIF9vbkRyYWc6IGZ1bmN0aW9uKGV2dCkge1xuICAgIEwuRG9tRXZlbnQuc3RvcChldnQpO1xuXG4gICAgdmFyIGZpcnN0ID0gKGV2dC50b3VjaGVzICYmIGV2dC50b3VjaGVzLmxlbmd0aCA+PSAxID8gZXZ0LnRvdWNoZXNbMF0gOiBldnQpO1xuICAgIHZhciBjb250YWluZXJQb2ludCA9IHRoaXMuX3BhdGguX21hcC5tb3VzZUV2ZW50VG9Db250YWluZXJQb2ludChmaXJzdCk7XG5cbiAgICB2YXIgeCA9IGNvbnRhaW5lclBvaW50Lng7XG4gICAgdmFyIHkgPSBjb250YWluZXJQb2ludC55O1xuXG4gICAgdmFyIGR4ID0geCAtIHRoaXMuX3N0YXJ0UG9pbnQueDtcbiAgICB2YXIgZHkgPSB5IC0gdGhpcy5fc3RhcnRQb2ludC55O1xuXG4gICAgaWYgKCF0aGlzLl9wYXRoLl9kcmFnTW92ZWQgJiYgKGR4IHx8IGR5KSkge1xuICAgICAgdGhpcy5fcGF0aC5fZHJhZ01vdmVkID0gdHJ1ZTtcbiAgICAgIHRoaXMuX3BhdGguZmlyZSgnZHJhZ3N0YXJ0JywgZXZ0KTtcbiAgICAgIC8vIHdlIGRvbid0IHdhbnQgdGhhdCB0byBoYXBwZW4gb24gY2xpY2tcbiAgICAgIHRoaXMuX3BhdGguYnJpbmdUb0Zyb250KCk7XG4gICAgfVxuXG4gICAgdGhpcy5fbWF0cml4WzRdICs9IGR4O1xuICAgIHRoaXMuX21hdHJpeFs1XSArPSBkeTtcblxuICAgIHRoaXMuX3N0YXJ0UG9pbnQueCA9IHg7XG4gICAgdGhpcy5fc3RhcnRQb2ludC55ID0geTtcblxuICAgIHRoaXMuX3BhdGguZmlyZSgncHJlZHJhZycsIGV2dCk7XG4gICAgdGhpcy5fcGF0aC5fdHJhbnNmb3JtKHRoaXMuX21hdHJpeCk7XG4gICAgdGhpcy5fcGF0aC5maXJlKCdkcmFnJywgZXZ0KTtcbiAgfSxcblxuICAvKipcbiAgICogRHJhZ2dpbmcgc3RvcHBlZCwgYXBwbHlcbiAgICogQHBhcmFtICB7TC5Nb3VzZUV2ZW50fSBldnRcbiAgICovXG4gIF9vbkRyYWdFbmQ6IGZ1bmN0aW9uKGV2dCkge1xuICAgIEwuRG9tRXZlbnQuc3RvcChldnQpO1xuICAgIEwuRG9tRXZlbnQuX2Zha2VTdG9wKHsgdHlwZTogJ2NsaWNrJyB9KTtcblxuICAgIHZhciBjb250YWluZXJQb2ludCA9IHRoaXMuX3BhdGguX21hcC5tb3VzZUV2ZW50VG9Db250YWluZXJQb2ludChldnQpO1xuXG4gICAgLy8gYXBwbHkgbWF0cml4XG4gICAgaWYgKHRoaXMubW92ZWQoKSkge1xuICAgICAgdGhpcy5fdHJhbnNmb3JtUG9pbnRzKHRoaXMuX21hdHJpeCk7XG4gICAgICB0aGlzLl9wYXRoLl91cGRhdGVQYXRoKCk7XG4gICAgICB0aGlzLl9wYXRoLl9wcm9qZWN0KCk7XG4gICAgICB0aGlzLl9wYXRoLl90cmFuc2Zvcm0obnVsbCk7XG4gICAgfVxuXG4gICAgTC5Eb21FdmVudFxuICAgICAgLm9mZihkb2N1bWVudCwgJ21vdXNlbW92ZSB0b3VjaG1vdmUnLCB0aGlzLl9vbkRyYWcsIHRoaXMpXG4gICAgICAub2ZmKGRvY3VtZW50LCAnbW91c2V1cCB0b3VjaGVuZCcsICAgIHRoaXMuX29uRHJhZ0VuZCwgdGhpcyk7XG5cbiAgICB0aGlzLl9yZXN0b3JlQ29vcmRHZXR0ZXJzKCk7XG4gICAgLy8gY29uc2lzdGVuY3lcbiAgICB0aGlzLl9wYXRoLmZpcmUoJ2RyYWdlbmQnLCB7XG4gICAgICBkaXN0YW5jZTogTWF0aC5zcXJ0KFxuICAgICAgICBMLkxpbmVVdGlsLl9zcURpc3QodGhpcy5fZHJhZ1N0YXJ0UG9pbnQsIGNvbnRhaW5lclBvaW50KVxuICAgICAgKVxuICAgIH0pO1xuXG4gICAgdGhpcy5fbWF0cml4ICAgICAgICAgPSBudWxsO1xuICAgIHRoaXMuX3N0YXJ0UG9pbnQgICAgID0gbnVsbDtcbiAgICB0aGlzLl9kcmFnU3RhcnRQb2ludCA9IG51bGw7XG5cbiAgICBpZiAodGhpcy5fbWFwRHJhZ2dpbmdXYXNFbmFibGVkKSB7XG4gICAgICB0aGlzLl9wYXRoLl9tYXAuZHJhZ2dpbmcuZW5hYmxlKCk7XG4gICAgfVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIEFwcGxpZXMgdHJhbnNmb3JtYXRpb24sIGRvZXMgaXQgaW4gb25lIHN3ZWVwIGZvciBwZXJmb3JtYW5jZSxcbiAgICogc28gZG9uJ3QgYmUgc3VycHJpc2VkIGFib3V0IHRoZSBjb2RlIHJlcGV0aXRpb24uXG4gICAqXG4gICAqIFsgeCBdICAgWyBhICBiICB0eCBdIFsgeCBdICAgWyBhICogeCArIGIgKiB5ICsgdHggXVxuICAgKiBbIHkgXSA9IFsgYyAgZCAgdHkgXSBbIHkgXSA9IFsgYyAqIHggKyBkICogeSArIHR5IF1cbiAgICpcbiAgICogQHBhcmFtIHtBcnJheS48TnVtYmVyPn0gbWF0cml4XG4gICAqL1xuICBfdHJhbnNmb3JtUG9pbnRzOiBmdW5jdGlvbihtYXRyaXgsIGRlc3QpIHtcbiAgICB2YXIgcGF0aCA9IHRoaXMuX3BhdGg7XG4gICAgdmFyIGksIGxlbiwgbGF0bG5nO1xuXG4gICAgdmFyIHB4ID0gTC5wb2ludChtYXRyaXhbNF0sIG1hdHJpeFs1XSk7XG5cbiAgICB2YXIgY3JzID0gcGF0aC5fbWFwLm9wdGlvbnMuY3JzO1xuICAgIHZhciB0cmFuc2Zvcm1hdGlvbiA9IGNycy50cmFuc2Zvcm1hdGlvbjtcbiAgICB2YXIgc2NhbGUgPSBjcnMuc2NhbGUocGF0aC5fbWFwLmdldFpvb20oKSk7XG4gICAgdmFyIHByb2plY3Rpb24gPSBjcnMucHJvamVjdGlvbjtcblxuICAgIHZhciBkaWZmID0gdHJhbnNmb3JtYXRpb24udW50cmFuc2Zvcm0ocHgsIHNjYWxlKVxuICAgICAgLnN1YnRyYWN0KHRyYW5zZm9ybWF0aW9uLnVudHJhbnNmb3JtKEwucG9pbnQoMCwgMCksIHNjYWxlKSk7XG4gICAgdmFyIGFwcGx5VHJhbnNmb3JtID0gIWRlc3Q7XG5cbiAgICBwYXRoLl9ib3VuZHMgPSBuZXcgTC5MYXRMbmdCb3VuZHMoKTtcblxuICAgIC8vIGNvbnNvbGUudGltZSgndHJhbnNmb3JtJyk7XG4gICAgLy8gYWxsIHNoaWZ0cyBhcmUgaW4tcGxhY2VcbiAgICBpZiAocGF0aC5fcG9pbnQpIHsgLy8gTC5DaXJjbGVcbiAgICAgIGRlc3QgPSBwcm9qZWN0aW9uLnVucHJvamVjdChcbiAgICAgICAgcHJvamVjdGlvbi5wcm9qZWN0KHBhdGguX2xhdGxuZykuX2FkZChkaWZmKSk7XG4gICAgICBpZiAoYXBwbHlUcmFuc2Zvcm0pIHtcbiAgICAgICAgcGF0aC5fbGF0bG5nID0gZGVzdDtcbiAgICAgICAgcGF0aC5fcG9pbnQuX2FkZChweCk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChwYXRoLl9yaW5ncyB8fCBwYXRoLl9wYXJ0cykgeyAvLyBldmVyeXRoaW5nIGVsc2VcbiAgICAgIHZhciByaW5ncyAgID0gcGF0aC5fcmluZ3MgfHwgcGF0aC5fcGFydHM7XG4gICAgICB2YXIgbGF0bG5ncyA9IHBhdGguX2xhdGxuZ3M7XG4gICAgICBkZXN0ID0gZGVzdCB8fCBsYXRsbmdzO1xuICAgICAgaWYgKCFMLlV0aWwuaXNBcnJheShsYXRsbmdzWzBdKSkgeyAvLyBwb2x5bGluZVxuICAgICAgICBsYXRsbmdzID0gW2xhdGxuZ3NdO1xuICAgICAgICBkZXN0ICAgID0gW2Rlc3RdO1xuICAgICAgfVxuICAgICAgZm9yIChpID0gMCwgbGVuID0gcmluZ3MubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgZGVzdFtpXSA9IGRlc3RbaV0gfHwgW107XG4gICAgICAgIGZvciAodmFyIGogPSAwLCBqaiA9IHJpbmdzW2ldLmxlbmd0aDsgaiA8IGpqOyBqKyspIHtcbiAgICAgICAgICBsYXRsbmcgICAgID0gbGF0bG5nc1tpXVtqXTtcbiAgICAgICAgICBkZXN0W2ldW2pdID0gcHJvamVjdGlvblxuICAgICAgICAgICAgLnVucHJvamVjdChwcm9qZWN0aW9uLnByb2plY3QobGF0bG5nKS5fYWRkKGRpZmYpKTtcbiAgICAgICAgICBpZiAoYXBwbHlUcmFuc2Zvcm0pIHtcbiAgICAgICAgICAgIHBhdGguX2JvdW5kcy5leHRlbmQobGF0bG5nc1tpXVtqXSk7XG4gICAgICAgICAgICByaW5nc1tpXVtqXS5fYWRkKHB4KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGRlc3Q7XG4gICAgLy8gY29uc29sZS50aW1lRW5kKCd0cmFuc2Zvcm0nKTtcbiAgfSxcblxuXG5cbiAgLyoqXG4gICAqIElmIHlvdSB3YW50IHRvIHJlYWQgdGhlIGxhdGxuZ3MgZHVyaW5nIHRoZSBkcmFnIC0geW91ciByaWdodCxcbiAgICogYnV0IHRoZXkgaGF2ZSB0byBiZSB0cmFuc2Zvcm1lZFxuICAgKi9cbiAgX3JlcGxhY2VDb29yZEdldHRlcnM6IGZ1bmN0aW9uKCkge1xuICAgIGlmICh0aGlzLl9wYXRoLmdldExhdExuZykgeyAvLyBDaXJjbGUsIENpcmNsZU1hcmtlclxuICAgICAgdGhpcy5fcGF0aC5nZXRMYXRMbmdfID0gdGhpcy5fcGF0aC5nZXRMYXRMbmc7XG4gICAgICB0aGlzLl9wYXRoLmdldExhdExuZyA9IEwuVXRpbC5iaW5kKGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5kcmFnZ2luZy5fdHJhbnNmb3JtUG9pbnRzKHRoaXMuZHJhZ2dpbmcuX21hdHJpeCwge30pO1xuICAgICAgfSwgdGhpcy5fcGF0aCk7XG4gICAgfSBlbHNlIGlmICh0aGlzLl9wYXRoLmdldExhdExuZ3MpIHtcbiAgICAgIHRoaXMuX3BhdGguZ2V0TGF0TG5nc18gPSB0aGlzLl9wYXRoLmdldExhdExuZ3M7XG4gICAgICB0aGlzLl9wYXRoLmdldExhdExuZ3MgPSBMLlV0aWwuYmluZChmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZHJhZ2dpbmcuX3RyYW5zZm9ybVBvaW50cyh0aGlzLmRyYWdnaW5nLl9tYXRyaXgsIFtdKTtcbiAgICAgIH0sIHRoaXMuX3BhdGgpO1xuICAgIH1cbiAgfSxcblxuXG4gIC8qKlxuICAgKiBQdXQgYmFjayB0aGUgZ2V0dGVyc1xuICAgKi9cbiAgX3Jlc3RvcmVDb29yZEdldHRlcnM6IGZ1bmN0aW9uKCkge1xuICAgIGlmICh0aGlzLl9wYXRoLmdldExhdExuZ18pIHtcbiAgICAgIHRoaXMuX3BhdGguZ2V0TGF0TG5nID0gdGhpcy5fcGF0aC5nZXRMYXRMbmdfO1xuICAgICAgZGVsZXRlIHRoaXMuX3BhdGguZ2V0TGF0TG5nXztcbiAgICB9IGVsc2UgaWYgKHRoaXMuX3BhdGguZ2V0TGF0TG5nc18pIHtcbiAgICAgIHRoaXMuX3BhdGguZ2V0TGF0TG5ncyA9IHRoaXMuX3BhdGguZ2V0TGF0TG5nc187XG4gICAgICBkZWxldGUgdGhpcy5fcGF0aC5nZXRMYXRMbmdzXztcbiAgICB9XG4gIH1cblxufSk7XG5cblxuLyoqXG4gKiBAcGFyYW0gIHtMLlBhdGh9IGxheWVyXG4gKiBAcmV0dXJuIHtMLlBhdGh9XG4gKi9cbkwuSGFuZGxlci5QYXRoRHJhZy5tYWtlRHJhZ2dhYmxlID0gZnVuY3Rpb24obGF5ZXIpIHtcbiAgbGF5ZXIuZHJhZ2dpbmcgPSBuZXcgTC5IYW5kbGVyLlBhdGhEcmFnKGxheWVyKTtcbiAgcmV0dXJuIGxheWVyO1xufTtcblxuXG4vKipcbiAqIEFsc28gZXhwb3NlIGFzIGEgbWV0aG9kXG4gKiBAcmV0dXJuIHtMLlBhdGh9XG4gKi9cbkwuUGF0aC5wcm90b3R5cGUubWFrZURyYWdnYWJsZSA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gTC5IYW5kbGVyLlBhdGhEcmFnLm1ha2VEcmFnZ2FibGUodGhpcyk7XG59O1xuXG5cbkwuUGF0aC5hZGRJbml0SG9vayhmdW5jdGlvbigpIHtcbiAgaWYgKHRoaXMub3B0aW9ucy5kcmFnZ2FibGUpIHtcbiAgICAvLyBlbnN1cmUgaW50ZXJhY3RpdmVcbiAgICB0aGlzLm9wdGlvbnMuaW50ZXJhY3RpdmUgPSB0cnVlO1xuXG4gICAgaWYgKHRoaXMuZHJhZ2dpbmcpIHtcbiAgICAgIHRoaXMuZHJhZ2dpbmcuZW5hYmxlKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIEwuSGFuZGxlci5QYXRoRHJhZy5tYWtlRHJhZ2dhYmxlKHRoaXMpO1xuICAgICAgdGhpcy5kcmFnZ2luZy5lbmFibGUoKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAodGhpcy5kcmFnZ2luZykge1xuICAgIHRoaXMuZHJhZ2dpbmcuZGlzYWJsZSgpO1xuICB9XG59KTtcbiIsIi8qKlxuICogTGVhZmxldCB2ZWN0b3IgZmVhdHVyZXMgZHJhZyBmdW5jdGlvbmFsaXR5XG4gKiBAYXV0aG9yIEFsZXhhbmRlciBNaWxldnNraSA8aW5mb0B3OHIubmFtZT5cbiAqIEBwcmVzZXJ2ZVxuICovXG5cbi8qKlxuICogTWF0cml4IHRyYW5zZm9ybSBwYXRoIGZvciBTVkcvVk1MXG4gKiBSZW5kZXJlci1pbmRlcGVuZGVudFxuICovXG5MLlBhdGguaW5jbHVkZSh7XG5cblx0LyoqXG5cdCAqIEFwcGxpZXMgbWF0cml4IHRyYW5zZm9ybWF0aW9uIHRvIFNWR1xuXHQgKiBAcGFyYW0ge0FycmF5LjxOdW1iZXI+P30gbWF0cml4XG5cdCAqL1xuXHRfdHJhbnNmb3JtOiBmdW5jdGlvbihtYXRyaXgpIHtcblx0XHRpZiAodGhpcy5fcmVuZGVyZXIpIHtcblx0XHRcdGlmIChtYXRyaXgpIHtcblx0XHRcdFx0dGhpcy5fcmVuZGVyZXIudHJhbnNmb3JtUGF0aCh0aGlzLCBtYXRyaXgpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gcmVzZXQgdHJhbnNmb3JtIG1hdHJpeFxuXHRcdFx0XHR0aGlzLl9yZW5kZXJlci5fcmVzZXRUcmFuc2Zvcm1QYXRoKHRoaXMpO1xuXHRcdFx0XHR0aGlzLl91cGRhdGUoKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblx0LyoqXG5cdCAqIENoZWNrIGlmIHRoZSBmZWF0dXJlIHdhcyBkcmFnZ2VkLCB0aGF0J2xsIHN1cHJlc3MgdGhlIGNsaWNrIGV2ZW50XG5cdCAqIG9uIG1vdXNldXAuIFRoYXQgZml4ZXMgcG9wdXBzIGZvciBleGFtcGxlXG5cdCAqXG5cdCAqIEBwYXJhbSAge01vdXNlRXZlbnR9IGVcblx0ICovXG5cdF9vbk1vdXNlQ2xpY2s6IGZ1bmN0aW9uKGUpIHtcblx0XHRpZiAoKHRoaXMuZHJhZ2dpbmcgJiYgdGhpcy5kcmFnZ2luZy5tb3ZlZCgpKSB8fFxuXHRcdFx0KHRoaXMuX21hcC5kcmFnZ2luZyAmJiB0aGlzLl9tYXAuZHJhZ2dpbmcubW92ZWQoKSkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9maXJlTW91c2VFdmVudChlKTtcblx0fVxuXG59KTtcbiIsIkwuU1ZHLmluY2x1ZGUoIUwuQnJvd3Nlci52bWwgPyB7fSA6IHtcblxuXHQvKipcblx0ICogUmVzZXQgdHJhbnNmb3JtIG1hdHJpeFxuXHQgKi9cblx0X3Jlc2V0VHJhbnNmb3JtUGF0aDogZnVuY3Rpb24obGF5ZXIpIHtcblx0XHRpZiAobGF5ZXIuX3NrZXcpIHtcblx0XHRcdC8vIHN1cGVyIGltcG9ydGFudCEgd29ya2Fyb3VuZCBmb3IgYSAnanVtcGluZycgZ2xpdGNoOlxuXHRcdFx0Ly8gZGlzYWJsZSB0cmFuc2Zvcm0gYmVmb3JlIHJlbW92aW5nIGl0XG5cdFx0XHRsYXllci5fc2tldy5vbiA9IGZhbHNlO1xuXHRcdFx0bGF5ZXIuX3BhdGgucmVtb3ZlQ2hpbGQobGF5ZXIuX3NrZXcpO1xuXHRcdFx0bGF5ZXIuX3NrZXcgPSBudWxsO1xuXHRcdH1cblx0fSxcblxuXHQvKipcblx0ICogQXBwbGllcyBtYXRyaXggdHJhbnNmb3JtYXRpb24gdG8gVk1MXG5cdCAqIEBwYXJhbSB7TC5QYXRofSAgICAgICAgIGxheWVyXG5cdCAqIEBwYXJhbSB7QXJyYXkuPE51bWJlcj59IG1hdHJpeFxuXHQgKi9cblx0dHJhbnNmb3JtUGF0aDogZnVuY3Rpb24obGF5ZXIsIG1hdHJpeCkge1xuXHRcdHZhciBza2V3ID0gbGF5ZXIuX3NrZXc7XG5cblx0XHRpZiAoIXNrZXcpIHtcblx0XHRcdHNrZXcgPSBMLlNWRy5jcmVhdGUoJ3NrZXcnKTtcblx0XHRcdGxheWVyLl9wYXRoLmFwcGVuZENoaWxkKHNrZXcpO1xuXHRcdFx0c2tldy5zdHlsZS5iZWhhdmlvciA9ICd1cmwoI2RlZmF1bHQjVk1MKSc7XG5cdFx0XHRsYXllci5fc2tldyA9IHNrZXc7XG5cdFx0fVxuXG5cdFx0Ly8gaGFuZGxlIHNrZXcvdHJhbnNsYXRlIHNlcGFyYXRlbHksIGNhdXNlIGl0J3MgYnJva2VuXG5cdFx0dmFyIG10ID0gbWF0cml4WzBdLnRvRml4ZWQoOCkgKyAnICcgKyBtYXRyaXhbMV0udG9GaXhlZCg4KSArICcgJyArXG5cdFx0XHRtYXRyaXhbMl0udG9GaXhlZCg4KSArICcgJyArIG1hdHJpeFszXS50b0ZpeGVkKDgpICsgJyAwIDAnO1xuXHRcdHZhciBvZmZzZXQgPSBNYXRoLmZsb29yKG1hdHJpeFs0XSkudG9GaXhlZCgpICsgJywgJyArXG5cdFx0XHRNYXRoLmZsb29yKG1hdHJpeFs1XSkudG9GaXhlZCgpICsgJyc7XG5cblx0XHR2YXIgcyA9IHRoaXMuX3BhdGguc3R5bGU7XG5cdFx0dmFyIGwgPSBwYXJzZUZsb2F0KHMubGVmdCk7XG5cdFx0dmFyIHQgPSBwYXJzZUZsb2F0KHMudG9wKTtcblx0XHR2YXIgdyA9IHBhcnNlRmxvYXQocy53aWR0aCk7XG5cdFx0dmFyIGggPSBwYXJzZUZsb2F0KHMuaGVpZ2h0KTtcblxuXHRcdGlmIChpc05hTihsKSkgeyBsID0gMDsgfVxuXHRcdGlmIChpc05hTih0KSkgeyB0ID0gMDsgfVxuXHRcdGlmIChpc05hTih3KSB8fCAhdykgeyB3ID0gMTsgfVxuXHRcdGlmIChpc05hTihoKSB8fCAhaCkgeyBoID0gMTsgfVxuXG5cdFx0dmFyIG9yaWdpbiA9ICgtbCAvIHcgLSAwLjUpLnRvRml4ZWQoOCkgKyAnICcgKyAoLXQgLyBoIC0gMC41KS50b0ZpeGVkKDgpO1xuXG5cdFx0c2tldy5vbiA9ICdmJztcblx0XHRza2V3Lm1hdHJpeCA9IG10O1xuXHRcdHNrZXcub3JpZ2luID0gb3JpZ2luO1xuXHRcdHNrZXcub2Zmc2V0ID0gb2Zmc2V0O1xuXHRcdHNrZXcub24gPSB0cnVlO1xuXHR9XG5cbn0pO1xuIiwiTC5TVkcuaW5jbHVkZSh7XG5cblx0LyoqXG5cdCAqIFJlc2V0IHRyYW5zZm9ybSBtYXRyaXhcblx0ICovXG5cdF9yZXNldFRyYW5zZm9ybVBhdGg6IGZ1bmN0aW9uKGxheWVyKSB7XG5cdFx0bGF5ZXIuX3BhdGguc2V0QXR0cmlidXRlTlMobnVsbCwgJ3RyYW5zZm9ybScsICcnKTtcblx0fSxcblxuXHQvKipcblx0ICogQXBwbGllcyBtYXRyaXggdHJhbnNmb3JtYXRpb24gdG8gU1ZHXG5cdCAqIEBwYXJhbSB7TC5QYXRofSAgICAgICAgIGxheWVyXG5cdCAqIEBwYXJhbSB7QXJyYXkuPE51bWJlcj59IG1hdHJpeFxuXHQgKi9cblx0dHJhbnNmb3JtUGF0aDogZnVuY3Rpb24obGF5ZXIsIG1hdHJpeCkge1xuXHRcdGxheWVyLl9wYXRoLnNldEF0dHJpYnV0ZU5TKG51bGwsICd0cmFuc2Zvcm0nLFxuXHRcdFx0J21hdHJpeCgnICsgbWF0cml4LmpvaW4oJyAnKSArICcpJyk7XG5cdH1cblxufSk7XG4iLCJ2YXIgTCA9IHJlcXVpcmUoJ2xlYWZsZXQnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBMLkNpcmNsZU1hcmtlci5leHRlbmQoe1xuXG4gIG9wdGlvbnM6IHtcbiAgICB0ZXh0U3R5bGU6IHtcbiAgICAgIGNvbG9yOiAnI2ZmZicsXG4gICAgICBmb250U2l6ZTogMTIsXG4gICAgICBmb250V2VpZ2h0OiAzMDBcbiAgICB9LFxuICAgIHNoaWZ0WTogNyxcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAY2xhc3MgTGFiZWxlZENpcmNsZVxuICAgKiBAY29uc3RydWN0b3JcbiAgICogQGV4dGVuZHMge0wuQ2lyY2xlTWFya2VyfVxuICAgKiBAcGFyYW0gIHtTdHJpbmd9ICAgdGV4dFxuICAgKiBAcGFyYW0gIHtMLkxhdExuZ30gbGF0bG5nXG4gICAqIEBwYXJhbSAge09iamVjdD19ICBvcHRpb25zXG4gICAqL1xuICBpbml0aWFsaXplOiBmdW5jdGlvbih0ZXh0LCBsYXRsbmcsIG9wdGlvbnMpIHtcbiAgICAvKipcbiAgICAgKiBAdHlwZSB7U3RyaW5nfVxuICAgICAqL1xuICAgIHRoaXMuX3RleHQgICAgICAgID0gdGV4dDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtTVkdUZXh0RWxlbWVudH1cbiAgICAgKi9cbiAgICB0aGlzLl90ZXh0RWxlbWVudCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7VGV4dE5vZGV9XG4gICAgICovXG4gICAgdGhpcy5fdGV4dE5vZGUgICAgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge09iamVjdHxOdWxsfVxuICAgICAqL1xuICAgIHRoaXMuX3RleHRMYXllciAgID0gbnVsbDtcblxuICAgIEwuQ2lyY2xlTWFya2VyLnByb3RvdHlwZS5pbml0aWFsaXplLmNhbGwodGhpcywgbGF0bG5nLCBvcHRpb25zKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0ge1N0cmluZ30gdGV4dFxuICAgKiBAcmV0dXJuIHtMYWJlbGVkQ2lyY2xlfVxuICAgKi9cbiAgc2V0VGV4dDogZnVuY3Rpb24odGV4dCkge1xuICAgIHRoaXMuX3RleHQgPSB0ZXh0O1xuICAgIGlmICh0aGlzLl90ZXh0Tm9kZSkge1xuICAgICAgdGhpcy5fdGV4dEVsZW1lbnQucmVtb3ZlQ2hpbGQodGhpcy5fdGV4dE5vZGUpO1xuICAgIH1cbiAgICB0aGlzLl90ZXh0Tm9kZSA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKHRoaXMuX3RleHQpO1xuICAgIHRoaXMuX3RleHRFbGVtZW50LmFwcGVuZENoaWxkKHRoaXMuX3RleHROb2RlKTtcblxuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEFsc28gYnJpbmcgdGV4dCB0byBmcm9udFxuICAgKiBAb3ZlcnJpZGVcbiAgICovXG4gIGJyaW5nVG9Gcm9udDogZnVuY3Rpb24oKSB7XG4gICAgTC5DaXJjbGVNYXJrZXIucHJvdG90eXBlLmJyaW5nVG9Gcm9udC5jYWxsKHRoaXMpO1xuICAgIHRoaXMuX2dyb3VwVGV4dFRvUGF0aCgpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBvdmVycmlkZVxuICAgKi9cbiAgYnJpbmdUb0JhY2s6IGZ1bmN0aW9uKCkge1xuICAgIEwuQ2lyY2xlTWFya2VyLnByb3RvdHlwZS5icmluZ1RvQmFjay5jYWxsKHRoaXMpO1xuICAgIHRoaXMuX2dyb3VwVGV4dFRvUGF0aCgpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIFB1dCB0ZXh0IGluIHRoZSByaWdodCBwb3NpdGlvbiBpbiB0aGUgZG9tXG4gICAqL1xuICBfZ3JvdXBUZXh0VG9QYXRoOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgcGF0aCAgICAgICAgPSB0aGlzLl9wYXRoO1xuICAgIHZhciB0ZXh0RWxlbWVudCA9IHRoaXMuX3RleHRFbGVtZW50O1xuICAgIHZhciBuZXh0ICAgICAgICA9IHBhdGgubmV4dFNpYmxpbmc7XG4gICAgdmFyIHBhcmVudCAgICAgID0gcGF0aC5wYXJlbnROb2RlO1xuXG5cbiAgICBpZiAodGV4dEVsZW1lbnQgJiYgcGFyZW50KSB7XG4gICAgICBpZiAobmV4dCAmJiBuZXh0ICE9PSB0ZXh0RWxlbWVudCkge1xuICAgICAgICBwYXJlbnQuaW5zZXJ0QmVmb3JlKHRleHRFbGVtZW50LCBuZXh0KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBhcmVudC5hcHBlbmRDaGlsZCh0ZXh0RWxlbWVudCk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIFBvc2l0aW9uIHRoZSB0ZXh0IGluIGNvbnRhaW5lclxuICAgKi9cbiAgX3VwZGF0ZVBhdGg6IGZ1bmN0aW9uKCkge1xuICAgIEwuQ2lyY2xlTWFya2VyLnByb3RvdHlwZS5fdXBkYXRlUGF0aC5jYWxsKHRoaXMpO1xuICAgIHRoaXMuX3VwZGF0ZVRleHRQb3NpdGlvbigpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBvdmVycmlkZVxuICAgKi9cbiAgX3RyYW5zZm9ybTogZnVuY3Rpb24obWF0cml4KSB7XG4gICAgTC5DaXJjbGVNYXJrZXIucHJvdG90eXBlLl90cmFuc2Zvcm0uY2FsbCh0aGlzLCBtYXRyaXgpO1xuXG4gICAgLy8gd3JhcCB0ZXh0RWxlbWVudCB3aXRoIGEgZmFrZSBsYXllciBmb3IgcmVuZGVyZXJcbiAgICAvLyB0byBiZSBhYmxlIHRvIHRyYW5zZm9ybSBpdFxuICAgIHRoaXMuX3RleHRMYXllciA9IHRoaXMuX3RleHRMYXllciB8fCB7IF9wYXRoOiB0aGlzLl90ZXh0RWxlbWVudCB9O1xuICAgIGlmIChtYXRyaXgpIHtcbiAgICAgIHRoaXMuX3JlbmRlcmVyLnRyYW5zZm9ybVBhdGgodGhpcy5fdGV4dExheWVyLCBtYXRyaXgpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9yZW5kZXJlci5fcmVzZXRUcmFuc2Zvcm1QYXRoKHRoaXMuX3RleHRMYXllcik7XG4gICAgICB0aGlzLl91cGRhdGVUZXh0UG9zaXRpb24oKTtcbiAgICAgIHRoaXMuX3RleHRMYXllciA9IG51bGw7XG4gICAgfVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSAge0wuTWFwfSBtYXBcbiAgICogQHJldHVybiB7TGFiZWxlZENpcmNsZX1cbiAgICovXG4gIG9uQWRkOiBmdW5jdGlvbihtYXApIHtcbiAgICBMLkNpcmNsZU1hcmtlci5wcm90b3R5cGUub25BZGQuY2FsbCh0aGlzLCBtYXApO1xuICAgIHRoaXMuX2luaXRUZXh0KCk7XG4gICAgdGhpcy5fdXBkYXRlVGV4dFBvc2l0aW9uKCk7XG4gICAgdGhpcy5zZXRTdHlsZSgpO1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhbmQgaW5zZXJ0IHRleHRcbiAgICovXG4gIF9pbml0VGV4dDogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5fdGV4dEVsZW1lbnQgPSBMLlNWRy5jcmVhdGUoJ3RleHQnKTtcbiAgICB0aGlzLnNldFRleHQodGhpcy5fdGV4dCk7XG4gICAgdGhpcy5fcmVuZGVyZXIuX3Jvb3RHcm91cC5hcHBlbmRDaGlsZCh0aGlzLl90ZXh0RWxlbWVudCk7XG4gIH0sXG5cblxuICAvKipcbiAgICogQ2FsY3VsYXRlIHBvc2l0aW9uIGZvciB0ZXh0XG4gICAqL1xuICBfdXBkYXRlVGV4dFBvc2l0aW9uOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgdGV4dEVsZW1lbnQgPSB0aGlzLl90ZXh0RWxlbWVudDtcbiAgICBpZiAodGV4dEVsZW1lbnQpIHtcbiAgICAgIHZhciBiYm94ID0gdGV4dEVsZW1lbnQuZ2V0QkJveCgpO1xuICAgICAgdmFyIHRleHRQb3NpdGlvbiA9IHRoaXMuX3BvaW50LnN1YnRyYWN0KFxuICAgICAgICBMLnBvaW50KGJib3gud2lkdGgsIC1iYm94LmhlaWdodCArIHRoaXMub3B0aW9ucy5zaGlmdFkpLmRpdmlkZUJ5KDIpKTtcblxuICAgICAgdGV4dEVsZW1lbnQuc2V0QXR0cmlidXRlKCd4JywgdGV4dFBvc2l0aW9uLngpO1xuICAgICAgdGV4dEVsZW1lbnQuc2V0QXR0cmlidXRlKCd5JywgdGV4dFBvc2l0aW9uLnkpO1xuICAgICAgdGhpcy5fZ3JvdXBUZXh0VG9QYXRoKCk7XG4gICAgfVxuICB9LFxuXG5cbiAgLyoqXG4gICAqIFNldCB0ZXh0IHN0eWxlXG4gICAqL1xuICBzZXRTdHlsZTogZnVuY3Rpb24oc3R5bGUpIHtcbiAgICBMLkNpcmNsZU1hcmtlci5wcm90b3R5cGUuc2V0U3R5bGUuY2FsbCh0aGlzLCBzdHlsZSk7XG4gICAgaWYgKHRoaXMuX3RleHRFbGVtZW50KSB7XG4gICAgICB2YXIgc3R5bGVzID0gdGhpcy5vcHRpb25zLnRleHRTdHlsZTtcbiAgICAgIGZvciAodmFyIHByb3AgaW4gc3R5bGVzKSB7XG4gICAgICAgIGlmIChzdHlsZXMuaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgICAgICB2YXIgc3R5bGVQcm9wID0gcHJvcDtcbiAgICAgICAgICBpZiAocHJvcCA9PT0gJ2NvbG9yJykge1xuICAgICAgICAgICAgc3R5bGVQcm9wID0gJ3N0cm9rZSc7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMuX3RleHRFbGVtZW50LnN0eWxlW3N0eWxlUHJvcF0gPSBzdHlsZXNbcHJvcF07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn0pO1xuIiwidmFyIEwgPSByZXF1aXJlKCdsZWFmbGV0Jyk7XG52YXIgQ2lyY2xlID0gcmVxdWlyZSgnLi9jaXJjbGUnKTtcbnJlcXVpcmUoJ2xlYWZsZXQtcGF0aC1kcmFnJyk7XG5cbnZhciBMYWJlbGVkTWFya2VyID0gTC5GZWF0dXJlR3JvdXAuZXh0ZW5kKHtcblxuICBvcHRpb25zOiB7XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0gIHtMYWJlbGVkTWFya2VyfSBtYXJrZXJcbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgICAgICBmZWF0dXJlXG4gICAgICogQHJldHVybiB7U3RyaW5nfVxuICAgICAqL1xuICAgIGdldExhYmVsVGV4dDogZnVuY3Rpb24obWFya2VyLCBmZWF0dXJlKSB7XG4gICAgICByZXR1cm4gZmVhdHVyZS5wcm9wZXJ0aWVzLnRleHQ7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSAge0xhYmVsZWRNYXJrZXJ9IG1hcmtlclxuICAgICAqIEBwYXJhbSAge09iamVjdH0gICAgICAgIGZlYXR1cmVcbiAgICAgKiBAcGFyYW0gIHtMLkxhdExuZ30gICAgICBsYXRsbmdcbiAgICAgKiBAcmV0dXJuIHtMLkxhdExuZ31cbiAgICAgKi9cbiAgICBnZXRMYWJlbFBvc2l0aW9uOiBmdW5jdGlvbihtYXJrZXIsIGZlYXR1cmUsIGxhdGxuZykge1xuICAgICAgcmV0dXJuIGZlYXR1cmUucHJvcGVydGllcy5sYWJlbFBvc2l0aW9uID9cbiAgICAgICAgTC5sYXRMbmcoZmVhdHVyZS5wcm9wZXJ0aWVzLmxhYmVsUG9zaXRpb24uc2xpY2UoKS5yZXZlcnNlKCkpIDpcbiAgICAgICAgbGF0bG5nO1xuICAgIH0sXG5cbiAgICBsYWJlbFBvc2l0aW9uS2V5OiAnbGFiZWxQb3NpdGlvbicsXG5cbiAgICBtYXJrZXJPcHRpb25zOiB7XG4gICAgICBjb2xvcjogJyNmMDAnLFxuICAgICAgZmlsbE9wYWNpdHk6IDAuNzUsXG4gICAgICBkcmFnZ2FibGU6IHRydWUsXG4gICAgICByYWRpdXM6IDE1XG4gICAgfSxcblxuICAgIGFuY2hvck9wdGlvbnM6IHtcbiAgICAgIGNvbG9yOiAnIzAwZicsXG4gICAgICByYWRpdXM6IDNcbiAgICB9LFxuXG4gICAgbGluZU9wdGlvbnM6IHtcbiAgICAgIGNvbG9yOiAnI2YwMCcsXG4gICAgICBkYXNoQXJyYXk6IFsyLCA2XSxcbiAgICAgIGxpbmVDYXA6ICdzcXVhcmUnLFxuICAgICAgd2VpZ2h0OiAyXG4gICAgfVxuXG4gIH0sXG5cblxuICAvKipcbiAgICogQGNsYXNzIExhYmVsZWRNYXJrZXJcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqIEBleHRlbmRzIHtMLkZlYXR1cmVHcm91cH1cbiAgICpcbiAgICogQHBhcmFtICB7TC5MYXRMbmd9IGxhdGxuZ1xuICAgKiBAcGFyYW0gIHtPYmplY3Q9fSAgZmVhdHVyZVxuICAgKiBAcGFyYW0gIHtPYmplY3Q9fSAgb3B0aW9uc1xuICAgKi9cbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24obGF0bG5nLCBmZWF0dXJlLCBvcHRpb25zKSB7XG4gICAgTC5VdGlsLnNldE9wdGlvbnModGhpcywgb3B0aW9ucyk7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7T2JqZWN0fVxuICAgICAqL1xuICAgIHRoaXMuZmVhdHVyZSA9IGZlYXR1cmUgfHwge1xuICAgICAgdHlwZTogJ0ZlYXR1cmUnLFxuICAgICAgcHJvcGVydGllczoge30sXG4gICAgICBnZW9tZXRyeToge1xuICAgICAgICAndHlwZSc6ICdQb2ludCdcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuTGF0TG5nfVxuICAgICAqL1xuICAgIHRoaXMuX2xhdGxuZyA9IGxhdGxuZztcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0NpcmNsZUxhYmVsfVxuICAgICAqL1xuICAgIHRoaXMuX21hcmtlciA9IG51bGw7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLkNpcmNsZU1hcmtlcn1cbiAgICAgKi9cbiAgICB0aGlzLl9hbmNob3IgPSBudWxsO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TC5Qb2x5bGluZX1cbiAgICAgKi9cbiAgICB0aGlzLl9saW5lID0gbnVsbDtcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuUG9pbnR9XG4gICAgICovXG4gICAgdGhpcy5faW5pdGlhbERpc3RhbmNlID0gbnVsbDtcblxuICAgIHRoaXMuX2NyZWF0ZUxheWVycygpO1xuICAgIEwuTGF5ZXJHcm91cC5wcm90b3R5cGUuaW5pdGlhbGl6ZS5jYWxsKHRoaXMsXG4gICAgICBbdGhpcy5fYW5jaG9yLCB0aGlzLl9saW5lLCB0aGlzLl9tYXJrZXJdKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcmV0dXJuIHtMLkxhdExuZ31cbiAgICovXG4gIGdldExhYmVsUG9zaXRpb246IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLl9tYXJrZXIuZ2V0TGF0TG5nKCk7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHJldHVybiB7TC5MYXRMbmd9XG4gICAqL1xuICBnZXRMYXRMbmc6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLl9sYXRsbmc7XG4gIH0sXG5cblxuICAvKipcbiAgICogU2VyaWFsaXplXG4gICAqIEByZXR1cm4ge09iamVjdH1cbiAgICovXG4gIHRvR2VvSlNPTjogZnVuY3Rpb24oKSB7XG4gICAgdmFyIGZlYXR1cmUgPSBMLkdlb0pTT04uZ2V0RmVhdHVyZSh0aGlzLCB7XG4gICAgICB0eXBlOiAnUG9pbnQnLFxuICAgICAgY29vcmRpbmF0ZXM6IEwuR2VvSlNPTi5sYXRMbmdUb0Nvb3Jkcyh0aGlzLl9hbmNob3IuZ2V0TGF0TG5nKCkpXG4gICAgfSk7XG4gICAgZmVhdHVyZS5wcm9wZXJ0aWVzW3RoaXMub3B0aW9ucy5sYWJlbFBvc2l0aW9uS2V5XSA9XG4gICAgICBMLkdlb0pTT04ubGF0TG5nVG9Db29yZHModGhpcy5fbWFya2VyLmdldExhdExuZygpKTtcbiAgICByZXR1cm4gZmVhdHVyZTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0ge1N0cmluZ30gdGV4dFxuICAgKiBAcmV0dXJuIHtMYWJlbGVkTWFya2VyfVxuICAgKi9cbiAgc2V0VGV4dDogZnVuY3Rpb24odGV4dCkge1xuICAgIHRoaXMuX21hcmtlci5zZXRUZXh0KHRleHQpO1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYW5jaG9yLCBsaW5lIGFuZCBsYWJlbFxuICAgKi9cbiAgX2NyZWF0ZUxheWVyczogZnVuY3Rpb24oKSB7XG4gICAgdmFyIG9wdHMgPSB0aGlzLm9wdGlvbnM7XG4gICAgdmFyIHBvcyAgPSBvcHRzLmdldExhYmVsUG9zaXRpb24odGhpcywgdGhpcy5mZWF0dXJlLCB0aGlzLl9sYXRsbmcpO1xuICAgIHZhciB0ZXh0ID0gb3B0cy5nZXRMYWJlbFRleHQodGhpcywgdGhpcy5mZWF0dXJlKTtcblxuICAgIHRoaXMuX21hcmtlciA9IG5ldyBDaXJjbGUodGV4dCwgcG9zLFxuICAgICAgTC5VdGlsLmV4dGVuZCh7fSxcbiAgICAgICAgTGFiZWxlZE1hcmtlci5wcm90b3R5cGUub3B0aW9ucy5tYXJrZXJPcHRpb25zLFxuICAgICAgICBvcHRzLm1hcmtlck9wdGlvbnMpXG4gICAgKS5vbignZHJhZycsICAgICAgdGhpcy5fb25NYXJrZXJEcmFnLCAgICAgIHRoaXMpXG4gICAgIC5vbignZHJhZ3N0YXJ0JywgdGhpcy5fb25NYXJrZXJEcmFnU3RhcnQsIHRoaXMpO1xuXG4gICAgdGhpcy5fYW5jaG9yID0gbmV3IEwuQ2lyY2xlTWFya2VyKHRoaXMuX2xhdGxuZyxcbiAgICAgIEwuVXRpbC5leHRlbmQoe30sIExhYmVsZWRNYXJrZXIucHJvdG90eXBlLm9wdGlvbnMuYW5jaG9yT3B0aW9ucyxcbiAgICAgICAgb3B0cy5hbmNob3JPcHRpb25zKSk7XG5cbiAgICB0aGlzLl9saW5lID0gbmV3IEwuUG9seWxpbmUoW3RoaXMuX2xhdGxuZywgdGhpcy5fbWFya2VyLmdldExhdExuZygpXSxcbiAgICAgIEwuVXRpbC5leHRlbmQoe30sIExhYmVsZWRNYXJrZXIucHJvdG90eXBlLm9wdGlvbnMubGluZU9wdGlvbnMsXG4gICAgICAgIG9wdHMubGluZU9wdGlvbnMpKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBTdG9yZSBzaGlmdCB0byBiZSBwcmVjaXNlIHdoaWxlIGRyYWdnaW5nXG4gICAqIEBwYXJhbSAge0V2ZW50fSBldnRcbiAgICovXG4gIF9vbk1hcmtlckRyYWdTdGFydDogZnVuY3Rpb24oZXZ0KSB7XG4gICAgdGhpcy5faW5pdGlhbERpc3RhbmNlID0gTC5Eb21FdmVudC5nZXRNb3VzZVBvc2l0aW9uKGV2dClcbiAgICAgIC5zdWJ0cmFjdCh0aGlzLl9tYXAubGF0TG5nVG9Db250YWluZXJQb2ludCh0aGlzLl9tYXJrZXIuZ2V0TGF0TG5nKCkpKTtcbiAgICAvL0wuVXRpbC5yZXF1ZXN0QW5pbUZyYW1lKHRoaXMuX21hcmtlci5icmluZ1RvRnJvbnQsIHRoaXMuX21hcmtlcik7XG4gIH0sXG5cblxuICAvKipcbiAgICogTGluZSBkcmFnZ2luZ1xuICAgKiBAcGFyYW0gIHtEcmFnRXZlbnR9IGV2dFxuICAgKi9cbiAgX29uTWFya2VyRHJhZzogZnVuY3Rpb24oZXZ0KSB7XG4gICAgdmFyIGxhdGxuZyA9IHRoaXMuX21hcC5jb250YWluZXJQb2ludFRvTGF0TG5nKFxuICAgICAgTC5Eb21FdmVudC5nZXRNb3VzZVBvc2l0aW9uKGV2dCkuX3N1YnRyYWN0KHRoaXMuX2luaXRpYWxEaXN0YW5jZSkpO1xuICAgIHRoaXMuX2xpbmUuc2V0TGF0TG5ncyhbbGF0bG5nLCB0aGlzLl9sYXRsbmddKTtcbiAgfVxuXG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBMLkxhYmVsZWRDaXJjbGVNYXJrZXIgPSBMYWJlbGVkTWFya2VyO1xuTC5sYWJlbGVkQ2lyY2xlTWFya2VyID0gZnVuY3Rpb24obGF0bG5nLCBmZWF0dXJlLCBvcHRpb25zKSB7XG4gIHJldHVybiBuZXcgTGFiZWxlZE1hcmtlcihsYXRsbmcsIGZlYXR1cmUsIG9wdGlvbnMpO1xufTtcbiJdfQ==
