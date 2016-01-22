(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}(g.L || (g.L = {})).LabeledCircleMarker = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

module.exports = require('./src/marker');

},{"./src/marker":7}],2:[function(require,module,exports){
require('./src/Path.Transform');
require('./src/Path.Drag');
require('./src/MultiPoly.Drag');

module.exports = L.Path.Drag;

},{"./src/MultiPoly.Drag":3,"./src/Path.Drag":4,"./src/Path.Transform":5}],3:[function(require,module,exports){
(function() {

  // listen and propagate dragstart on sub-layers
  L.FeatureGroup.EVENTS += ' dragstart';

  function wrapMethod(klasses, methodName, method) {
    for (var i = 0, len = klasses.length; i < len; i++) {
      var klass = klasses[i];
      klass.prototype['_' + methodName] = klass.prototype[methodName];
      klass.prototype[methodName] = method;
    }
  }

  /**
   * @param {L.Polygon|L.Polyline} layer
   * @return {L.MultiPolygon|L.MultiPolyline}
   */
  function addLayer(layer) {
    if (this.hasLayer(layer)) {
      return this;
    }
    layer
      .on('drag', this._onDrag, this)
      .on('dragend', this._onDragEnd, this);
    return this._addLayer.call(this, layer);
  }

  /**
   * @param  {L.Polygon|L.Polyline} layer
   * @return {L.MultiPolygon|L.MultiPolyline}
   */
  function removeLayer(layer) {
    if (!this.hasLayer(layer)) {
      return this;
    }
    layer
      .off('drag', this._onDrag, this)
      .off('dragend', this._onDragEnd, this);
    return this._removeLayer.call(this, layer);
  }

  // duck-type methods to listen to the drag events
  wrapMethod([L.MultiPolygon, L.MultiPolyline], 'addLayer', addLayer);
  wrapMethod([L.MultiPolygon, L.MultiPolyline], 'removeLayer', removeLayer);

  var dragMethods = {
    _onDrag: function(evt) {
      var layer = evt.target;
      this.eachLayer(function(otherLayer) {
        if (otherLayer !== layer) {
          otherLayer._applyTransform(layer.dragging._matrix);
        }
      });

      this._propagateEvent(evt);
    },

    _onDragEnd: function(evt) {
      var layer = evt.target;

      this.eachLayer(function(otherLayer) {
        if (otherLayer !== layer) {
          otherLayer._resetTransform();
          otherLayer.dragging._transformPoints(layer.dragging._matrix);
        }
      });

      this._propagateEvent(evt);
    }
  };

  L.MultiPolygon.include(dragMethods);
  L.MultiPolyline.include(dragMethods);

})();

},{}],4:[function(require,module,exports){
/**
 * Leaflet vector features drag functionality
 * @preserve
 */

"use strict";

/**
 * Drag handler
 * @class L.Path.Drag
 * @extends {L.Handler}
 */
L.Handler.PathDrag = L.Handler.extend( /** @lends  L.Path.Drag.prototype */ {

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
    this._dragInProgress = false;

  },

  /**
   * Enable dragging
   */
  addHooks: function() {
    this._path.on('mousedown', this._onDragStart, this);
    if (!L.Path.CANVAS) {
      L.DomUtil.addClass(this._path._container, 'leaflet-path-draggable');
    }
  },

  /**
   * Disable dragging
   */
  removeHooks: function() {
    this._path.off('mousedown', this._onDragStart, this);
    if (!L.Path.CANVAS) {
      L.DomUtil.removeClass(this._path._container, 'leaflet-path-draggable');
    }
  },

  /**
   * @return {Boolean}
   */
  moved: function() {
    return this._path._dragMoved;
  },

  /**
   * If dragging currently in progress.
   *
   * @return {Boolean}
   */
  inProgress: function() {
    return this._dragInProgress;
  },

  /**
   * Start drag
   * @param  {L.MouseEvent} evt
   */
  _onDragStart: function(evt) {
    this._dragInProgress = true;
    this._startPoint = evt.containerPoint.clone();
    this._dragStartPoint = evt.containerPoint.clone();
    this._matrix = [1, 0, 0, 1, 0, 0];

    this._path._map
      .on('mousemove', this._onDrag, this)
      .on('mouseup', this._onDragEnd, this)
    this._path._dragMoved = false;
  },

  /**
   * Dragging
   * @param  {L.MouseEvent} evt
   */
  _onDrag: function(evt) {
    var x = evt.containerPoint.x;
    var y = evt.containerPoint.y;

    var dx = x - this._startPoint.x;
    var dy = y - this._startPoint.y;

    if (!this._path._dragMoved && (dx || dy)) {
      this._path._dragMoved = true;
      this._path.fire('dragstart');

      if (this._path._popup) {
        this._path._popup._close();
        this._path.off('click', this._path._openPopup, this._path);
      }
    }

    this._matrix[4] += dx;
    this._matrix[5] += dy;

    this._startPoint.x = x;
    this._startPoint.y = y;

    this._path._applyTransform(this._matrix);
    this._path.fire('drag');
    L.DomEvent.stop(evt.originalEvent);
  },

  /**
   * Dragging stopped, apply
   * @param  {L.MouseEvent} evt
   */
  _onDragEnd: function(evt) {
    L.DomEvent.stop(evt);
    this._dragInProgress = false;
    // undo container transform
    this._path._resetTransform();
    // apply matrix
    this._transformPoints(this._matrix);

    this._path._map
      .off('mousemove', this._onDrag, this)
      .off('mouseup', this._onDragEnd, this);

    // consistency
    this._path.fire('dragend', {
      distance: Math.sqrt(
        L.LineUtil._sqDist(this._dragStartPoint, evt.containerPoint)
      )
    });

    if (this._path._popup) {
      L.Util.requestAnimFrame(function() {
        this._path.on('click', this._path._openPopup, this._path);
      }, this);
    }

    this._matrix = null;
    this._startPoint = null;
    this._dragStartPoint = null;
    this._path._dragMoved = false;
  },

  /**
   * Transforms point according to the provided transformation matrix.
   *
   *  @param {Array.<Number>} matrix
   *  @param {L.LatLng} point
   */
  _transformPoint: function(point, matrix) {
    var path = this._path;

    var px = L.point(matrix[4], matrix[5]);

    var crs = path._map.options.crs;
    var transformation = crs.transformation;
    var scale = crs.scale(path._map.getZoom());
    var projection = crs.projection;

    var diff = transformation.untransform(px, scale)
      .subtract(transformation.untransform(L.point(0, 0), scale));

    return projection.unproject(projection.project(point)._add(diff));
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
  _transformPoints: function(matrix) {
    var path = this._path;
    var i, len, latlng;

    var px = L.point(matrix[4], matrix[5]);

    var crs = path._map.options.crs;
    var transformation = crs.transformation;
    var scale = crs.scale(path._map.getZoom());
    var projection = crs.projection;

    var diff = transformation.untransform(px, scale)
      .subtract(transformation.untransform(L.point(0, 0), scale));

    // console.time('transform');

    // all shifts are in-place
    if (path._point) { // L.Circle
      path._latlng = projection.unproject(
        projection.project(path._latlng)._add(diff));
      path._point._add(px);
    } else if (path._originalPoints) { // everything else
      for (i = 0, len = path._originalPoints.length; i < len; i++) {
        latlng = path._latlngs[i];
        path._latlngs[i] = projection
          .unproject(projection.project(latlng)._add(diff));
        path._originalPoints[i]._add(px);
      }
    }

    // holes operations
    if (path._holes) {
      for (i = 0, len = path._holes.length; i < len; i++) {
        for (var j = 0, len2 = path._holes[i].length; j < len2; j++) {
          latlng = path._holes[i][j];
          path._holes[i][j] = projection
            .unproject(projection.project(latlng)._add(diff));
          path._holePoints[i][j]._add(px);
        }
      }
    }

    // console.timeEnd('transform');

    path._updatePath();
  }

});

L.Path.prototype.__initEvents = L.Path.prototype._initEvents;
L.Path.prototype._initEvents = function() {
  this.__initEvents();

  if (this.options.draggable) {
    if (this.dragging) {
      this.dragging.enable();
    } else {
      this.dragging = new L.Handler.PathDrag(this);
      this.dragging.enable();
    }
  } else if (this.dragging) {
    this.dragging.disable();
  }
};

/*
 * Return transformed points in case if dragging is enabled and in progress,
 * otherwise - call original method.
 *
 * For L.Circle and L.Polyline
 */

L.Circle.prototype._getLatLng = L.Circle.prototype.getLatLng;
L.Circle.prototype.getLatLng = function() {
  if (this.dragging && this.dragging.inProgress()) {
    return this.dragging._transformPoint(this._latlng, this.dragging._matrix);
  } else {
    return this._getLatLng();
  }
};

L.Polyline.prototype._getLatLngs = L.Polyline.prototype.getLatLngs;
L.Polyline.prototype.getLatLngs = function() {
  if (this.dragging && this.dragging.inProgress()) {
    var matrix = this.dragging._matrix;
    var points = this._getLatLngs();
    for (var i = 0, len = points.length; i < len; i++) {
      points[i] = this.dragging._transformPoint(points[i], matrix);
    }
    return points;
  } else {
    return this._getLatLngs();
  }
};


},{}],5:[function(require,module,exports){
/**
 * Matrix transform path for SVG/VML
 * TODO: adapt to Leaflet 0.8 upon release
 */

"use strict";

if (L.Browser.svg) { // SVG transformation

  L.Path.include({

    /**
     * Reset transform matrix
     */
    _resetTransform: function() {
      this._container.setAttributeNS(null, 'transform', '');
    },

    /**
     * Applies matrix transformation to SVG
     * @param {Array.<Number>} matrix
     */
    _applyTransform: function(matrix) {
      this._container.setAttributeNS(null, "transform",
        'matrix(' + matrix.join(' ') + ')');
    }

  });

} else { // VML transform routines

  L.Path.include({

    /**
     * Reset transform matrix
     */
    _resetTransform: function() {
      if (this._skew) {
        // super important! workaround for a 'jumping' glitch:
        // disable transform before removing it
        this._skew.on = false;
        this._container.removeChild(this._skew);
        this._skew = null;
      }
    },

    /**
     * Applies matrix transformation to VML
     * @param {Array.<Number>} matrix
     */
    _applyTransform: function(matrix) {
      var skew = this._skew;

      if (!skew) {
        skew = this._createElement('skew');
        this._container.appendChild(skew);
        skew.style.behavior = 'url(#default#VML)';
        this._skew = skew;
      }

      // handle skew/translate separately, cause it's broken
      var mt = matrix[0].toFixed(8) + " " + matrix[1].toFixed(8) + " " +
        matrix[2].toFixed(8) + " " + matrix[3].toFixed(8) + " 0 0";
      var offset = Math.floor(matrix[4]).toFixed() + ", " +
        Math.floor(matrix[5]).toFixed() + "";

      var s = this._container.style;
      var l = parseFloat(s.left);
      var t = parseFloat(s.top);
      var w = parseFloat(s.width);
      var h = parseFloat(s.height);

      if (isNaN(l)) l = 0;
      if (isNaN(t)) t = 0;
      if (isNaN(w) || !w) w = 1;
      if (isNaN(h) || !h) h = 1;

      var origin = (-l / w - 0.5).toFixed(8) + " " + (-t / h - 0.5).toFixed(8);

      skew.on = "f";
      skew.matrix = mt;
      skew.origin = origin;
      skew.offset = offset;
      skew.on = true;
    }

  });
}

// Renderer-independent
L.Path.include({

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
'use strict';

var L = require('leaflet');

module.exports = L.CircleMarker.extend({

  options: {
    textStyle: {
      color: '#fff',
      fontSize: 12
    },
    shiftY: 6
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
    this._text = text;
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
   * Create text node in container
   */
  _initPath: function _initPath() {
    L.CircleMarker.prototype._initPath.call(this);
    this._textElement = this._createElement('text');
    this.setText(this._text);
    this._container.appendChild(this._textElement);
  },

  /**
   * Position the text in container
   */
  _updatePath: function _updatePath() {
    L.CircleMarker.prototype._updatePath.call(this);

    this._updateTextPosition();
  },

  /**
   * @param  {L.Map} map
   * @return {LabeledCircle}
   */
  onAdd: function onAdd(map) {
    L.CircleMarker.prototype.onAdd.call(this, map);
    this._updateTextPosition();
    return this;
  },

  /**
   * Calculate position for text
   */
  _updateTextPosition: function _updateTextPosition() {
    var textElement = this._textElement;
    var bbox = textElement.getBBox();
    var textPosition = this._point.subtract(L.point(bbox.width, -bbox.height + this.options.shiftY).divideBy(2));

    textElement.setAttribute('x', textPosition.x);
    textElement.setAttribute('y', textPosition.y);
  },

  /**
   * Set text style
   */
  _updateStyle: function _updateStyle() {
    L.CircleMarker.prototype._updateStyle.call(this);

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
});

},{"leaflet":undefined}],7:[function(require,module,exports){
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
      fillOpacity: 0.8,
      draggable: true,
      radius: 15
    },

    anchorOptions: {
      color: '#00f',
      radius: 3
    },

    lineOptions: {
      color: '#f00',
      dashArray: [5, 15],
      lineCap: 'square'
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

    this._marker = new Circle(text, pos, L.Util.extend({}, LabeledMarker.prototype.options.markerOptions, opts.markerOptions)).on('drag', this._onMarkerDrag, this);

    this._anchor = new L.CircleMarker(this._latlng, L.Util.extend({}, LabeledMarker.prototype.options.anchorOptions, opts.anchorOptions));

    this._line = new L.Polyline([this._latlng, this._marker.getLatLng()], L.Util.extend({}, LabeledMarker.prototype.options.lineOptions, opts.lineOptions));
  },

  /**
   * Line dragging
   * @param  {DragEvent} evt
   */
  _onMarkerDrag: function _onMarkerDrag(evt) {
    this._line.setLatLngs([evt.target.getLatLng(), this._latlng]);
  }

});

module.exports = L.LabeledCircleMarker = LabeledMarker;
L.labeledCircleMarker = function (latlng, feature, options) {
  return new LabeledMarker(latlng, feature, options);
};

},{"./circle":6,"leaflet":undefined,"leaflet-path-drag":2}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9sZWFmbGV0LXBhdGgtZHJhZy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9sZWFmbGV0LXBhdGgtZHJhZy9zcmMvTXVsdGlQb2x5LkRyYWcuanMiLCJub2RlX21vZHVsZXMvbGVhZmxldC1wYXRoLWRyYWcvc3JjL1BhdGguRHJhZy5qcyIsIm5vZGVfbW9kdWxlcy9sZWFmbGV0LXBhdGgtZHJhZy9zcmMvUGF0aC5UcmFuc2Zvcm0uanMiLCJzcmMvY2lyY2xlLmpzIiwic3JjL21hcmtlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O0FDQUEsT0FBTyxPQUFQLEdBQWlCLFFBQVEsY0FBUixDQUFqQjs7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BTQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FB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QixDQUFnQyxXQUFoQyxFQUNoQixLQUFLLFdBQUwsQ0FGUyxDQUFiLENBZndCO0dBQVg7Ozs7OztBQXlCZixpQkFBZSx1QkFBUyxHQUFULEVBQWM7QUFDM0IsU0FBSyxLQUFMLENBQVcsVUFBWCxDQUFzQixDQUFDLElBQUksTUFBSixDQUFXLFNBQVgsRUFBRCxFQUF5QixLQUFLLE9BQUwsQ0FBL0MsRUFEMkI7R0FBZDs7Q0F6S0csQ0FBaEI7O0FBK0tKLE9BQU8sT0FBUCxHQUFpQixFQUFFLG1CQUFGLEdBQXdCLGFBQXhCO0FBQ2pCLEVBQUUsbUJBQUYsR0FBd0IsVUFBUyxNQUFULEVBQWlCLE9BQWpCLEVBQTBCLE9BQTFCLEVBQW1DO0FBQ3pELFNBQU8sSUFBSSxhQUFKLENBQWtCLE1BQWxCLEVBQTBCLE9BQTFCLEVBQW1DLE9BQW5DLENBQVAsQ0FEeUQ7Q0FBbkMiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL3NyYy9tYXJrZXInKTtcbiIsInJlcXVpcmUoJy4vc3JjL1BhdGguVHJhbnNmb3JtJyk7XG5yZXF1aXJlKCcuL3NyYy9QYXRoLkRyYWcnKTtcbnJlcXVpcmUoJy4vc3JjL011bHRpUG9seS5EcmFnJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gTC5QYXRoLkRyYWc7XG4iLCIoZnVuY3Rpb24oKSB7XG5cbiAgLy8gbGlzdGVuIGFuZCBwcm9wYWdhdGUgZHJhZ3N0YXJ0IG9uIHN1Yi1sYXllcnNcbiAgTC5GZWF0dXJlR3JvdXAuRVZFTlRTICs9ICcgZHJhZ3N0YXJ0JztcblxuICBmdW5jdGlvbiB3cmFwTWV0aG9kKGtsYXNzZXMsIG1ldGhvZE5hbWUsIG1ldGhvZCkge1xuICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBrbGFzc2VzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICB2YXIga2xhc3MgPSBrbGFzc2VzW2ldO1xuICAgICAga2xhc3MucHJvdG90eXBlWydfJyArIG1ldGhvZE5hbWVdID0ga2xhc3MucHJvdG90eXBlW21ldGhvZE5hbWVdO1xuICAgICAga2xhc3MucHJvdG90eXBlW21ldGhvZE5hbWVdID0gbWV0aG9kO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBAcGFyYW0ge0wuUG9seWdvbnxMLlBvbHlsaW5lfSBsYXllclxuICAgKiBAcmV0dXJuIHtMLk11bHRpUG9seWdvbnxMLk11bHRpUG9seWxpbmV9XG4gICAqL1xuICBmdW5jdGlvbiBhZGRMYXllcihsYXllcikge1xuICAgIGlmICh0aGlzLmhhc0xheWVyKGxheWVyKSkge1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICAgIGxheWVyXG4gICAgICAub24oJ2RyYWcnLCB0aGlzLl9vbkRyYWcsIHRoaXMpXG4gICAgICAub24oJ2RyYWdlbmQnLCB0aGlzLl9vbkRyYWdFbmQsIHRoaXMpO1xuICAgIHJldHVybiB0aGlzLl9hZGRMYXllci5jYWxsKHRoaXMsIGxheWVyKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAcGFyYW0gIHtMLlBvbHlnb258TC5Qb2x5bGluZX0gbGF5ZXJcbiAgICogQHJldHVybiB7TC5NdWx0aVBvbHlnb258TC5NdWx0aVBvbHlsaW5lfVxuICAgKi9cbiAgZnVuY3Rpb24gcmVtb3ZlTGF5ZXIobGF5ZXIpIHtcbiAgICBpZiAoIXRoaXMuaGFzTGF5ZXIobGF5ZXIpKSB7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gICAgbGF5ZXJcbiAgICAgIC5vZmYoJ2RyYWcnLCB0aGlzLl9vbkRyYWcsIHRoaXMpXG4gICAgICAub2ZmKCdkcmFnZW5kJywgdGhpcy5fb25EcmFnRW5kLCB0aGlzKTtcbiAgICByZXR1cm4gdGhpcy5fcmVtb3ZlTGF5ZXIuY2FsbCh0aGlzLCBsYXllcik7XG4gIH1cblxuICAvLyBkdWNrLXR5cGUgbWV0aG9kcyB0byBsaXN0ZW4gdG8gdGhlIGRyYWcgZXZlbnRzXG4gIHdyYXBNZXRob2QoW0wuTXVsdGlQb2x5Z29uLCBMLk11bHRpUG9seWxpbmVdLCAnYWRkTGF5ZXInLCBhZGRMYXllcik7XG4gIHdyYXBNZXRob2QoW0wuTXVsdGlQb2x5Z29uLCBMLk11bHRpUG9seWxpbmVdLCAncmVtb3ZlTGF5ZXInLCByZW1vdmVMYXllcik7XG5cbiAgdmFyIGRyYWdNZXRob2RzID0ge1xuICAgIF9vbkRyYWc6IGZ1bmN0aW9uKGV2dCkge1xuICAgICAgdmFyIGxheWVyID0gZXZ0LnRhcmdldDtcbiAgICAgIHRoaXMuZWFjaExheWVyKGZ1bmN0aW9uKG90aGVyTGF5ZXIpIHtcbiAgICAgICAgaWYgKG90aGVyTGF5ZXIgIT09IGxheWVyKSB7XG4gICAgICAgICAgb3RoZXJMYXllci5fYXBwbHlUcmFuc2Zvcm0obGF5ZXIuZHJhZ2dpbmcuX21hdHJpeCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLl9wcm9wYWdhdGVFdmVudChldnQpO1xuICAgIH0sXG5cbiAgICBfb25EcmFnRW5kOiBmdW5jdGlvbihldnQpIHtcbiAgICAgIHZhciBsYXllciA9IGV2dC50YXJnZXQ7XG5cbiAgICAgIHRoaXMuZWFjaExheWVyKGZ1bmN0aW9uKG90aGVyTGF5ZXIpIHtcbiAgICAgICAgaWYgKG90aGVyTGF5ZXIgIT09IGxheWVyKSB7XG4gICAgICAgICAgb3RoZXJMYXllci5fcmVzZXRUcmFuc2Zvcm0oKTtcbiAgICAgICAgICBvdGhlckxheWVyLmRyYWdnaW5nLl90cmFuc2Zvcm1Qb2ludHMobGF5ZXIuZHJhZ2dpbmcuX21hdHJpeCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLl9wcm9wYWdhdGVFdmVudChldnQpO1xuICAgIH1cbiAgfTtcblxuICBMLk11bHRpUG9seWdvbi5pbmNsdWRlKGRyYWdNZXRob2RzKTtcbiAgTC5NdWx0aVBvbHlsaW5lLmluY2x1ZGUoZHJhZ01ldGhvZHMpO1xuXG59KSgpO1xuIiwiLyoqXG4gKiBMZWFmbGV0IHZlY3RvciBmZWF0dXJlcyBkcmFnIGZ1bmN0aW9uYWxpdHlcbiAqIEBwcmVzZXJ2ZVxuICovXG5cblwidXNlIHN0cmljdFwiO1xuXG4vKipcbiAqIERyYWcgaGFuZGxlclxuICogQGNsYXNzIEwuUGF0aC5EcmFnXG4gKiBAZXh0ZW5kcyB7TC5IYW5kbGVyfVxuICovXG5MLkhhbmRsZXIuUGF0aERyYWcgPSBMLkhhbmRsZXIuZXh0ZW5kKCAvKiogQGxlbmRzICBMLlBhdGguRHJhZy5wcm90b3R5cGUgKi8ge1xuXG4gIC8qKlxuICAgKiBAcGFyYW0gIHtMLlBhdGh9IHBhdGhcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqL1xuICBpbml0aWFsaXplOiBmdW5jdGlvbihwYXRoKSB7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TC5QYXRofVxuICAgICAqL1xuICAgIHRoaXMuX3BhdGggPSBwYXRoO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0FycmF5LjxOdW1iZXI+fVxuICAgICAqL1xuICAgIHRoaXMuX21hdHJpeCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TC5Qb2ludH1cbiAgICAgKi9cbiAgICB0aGlzLl9zdGFydFBvaW50ID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLlBvaW50fVxuICAgICAqL1xuICAgIHRoaXMuX2RyYWdTdGFydFBvaW50ID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtCb29sZWFufVxuICAgICAqL1xuICAgIHRoaXMuX2RyYWdJblByb2dyZXNzID0gZmFsc2U7XG5cbiAgfSxcblxuICAvKipcbiAgICogRW5hYmxlIGRyYWdnaW5nXG4gICAqL1xuICBhZGRIb29rczogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5fcGF0aC5vbignbW91c2Vkb3duJywgdGhpcy5fb25EcmFnU3RhcnQsIHRoaXMpO1xuICAgIGlmICghTC5QYXRoLkNBTlZBUykge1xuICAgICAgTC5Eb21VdGlsLmFkZENsYXNzKHRoaXMuX3BhdGguX2NvbnRhaW5lciwgJ2xlYWZsZXQtcGF0aC1kcmFnZ2FibGUnKTtcbiAgICB9XG4gIH0sXG5cbiAgLyoqXG4gICAqIERpc2FibGUgZHJhZ2dpbmdcbiAgICovXG4gIHJlbW92ZUhvb2tzOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLl9wYXRoLm9mZignbW91c2Vkb3duJywgdGhpcy5fb25EcmFnU3RhcnQsIHRoaXMpO1xuICAgIGlmICghTC5QYXRoLkNBTlZBUykge1xuICAgICAgTC5Eb21VdGlsLnJlbW92ZUNsYXNzKHRoaXMuX3BhdGguX2NvbnRhaW5lciwgJ2xlYWZsZXQtcGF0aC1kcmFnZ2FibGUnKTtcbiAgICB9XG4gIH0sXG5cbiAgLyoqXG4gICAqIEByZXR1cm4ge0Jvb2xlYW59XG4gICAqL1xuICBtb3ZlZDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuX3BhdGguX2RyYWdNb3ZlZDtcbiAgfSxcblxuICAvKipcbiAgICogSWYgZHJhZ2dpbmcgY3VycmVudGx5IGluIHByb2dyZXNzLlxuICAgKlxuICAgKiBAcmV0dXJuIHtCb29sZWFufVxuICAgKi9cbiAgaW5Qcm9ncmVzczogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuX2RyYWdJblByb2dyZXNzO1xuICB9LFxuXG4gIC8qKlxuICAgKiBTdGFydCBkcmFnXG4gICAqIEBwYXJhbSAge0wuTW91c2VFdmVudH0gZXZ0XG4gICAqL1xuICBfb25EcmFnU3RhcnQ6IGZ1bmN0aW9uKGV2dCkge1xuICAgIHRoaXMuX2RyYWdJblByb2dyZXNzID0gdHJ1ZTtcbiAgICB0aGlzLl9zdGFydFBvaW50ID0gZXZ0LmNvbnRhaW5lclBvaW50LmNsb25lKCk7XG4gICAgdGhpcy5fZHJhZ1N0YXJ0UG9pbnQgPSBldnQuY29udGFpbmVyUG9pbnQuY2xvbmUoKTtcbiAgICB0aGlzLl9tYXRyaXggPSBbMSwgMCwgMCwgMSwgMCwgMF07XG5cbiAgICB0aGlzLl9wYXRoLl9tYXBcbiAgICAgIC5vbignbW91c2Vtb3ZlJywgdGhpcy5fb25EcmFnLCB0aGlzKVxuICAgICAgLm9uKCdtb3VzZXVwJywgdGhpcy5fb25EcmFnRW5kLCB0aGlzKVxuICAgIHRoaXMuX3BhdGguX2RyYWdNb3ZlZCA9IGZhbHNlO1xuICB9LFxuXG4gIC8qKlxuICAgKiBEcmFnZ2luZ1xuICAgKiBAcGFyYW0gIHtMLk1vdXNlRXZlbnR9IGV2dFxuICAgKi9cbiAgX29uRHJhZzogZnVuY3Rpb24oZXZ0KSB7XG4gICAgdmFyIHggPSBldnQuY29udGFpbmVyUG9pbnQueDtcbiAgICB2YXIgeSA9IGV2dC5jb250YWluZXJQb2ludC55O1xuXG4gICAgdmFyIGR4ID0geCAtIHRoaXMuX3N0YXJ0UG9pbnQueDtcbiAgICB2YXIgZHkgPSB5IC0gdGhpcy5fc3RhcnRQb2ludC55O1xuXG4gICAgaWYgKCF0aGlzLl9wYXRoLl9kcmFnTW92ZWQgJiYgKGR4IHx8IGR5KSkge1xuICAgICAgdGhpcy5fcGF0aC5fZHJhZ01vdmVkID0gdHJ1ZTtcbiAgICAgIHRoaXMuX3BhdGguZmlyZSgnZHJhZ3N0YXJ0Jyk7XG5cbiAgICAgIGlmICh0aGlzLl9wYXRoLl9wb3B1cCkge1xuICAgICAgICB0aGlzLl9wYXRoLl9wb3B1cC5fY2xvc2UoKTtcbiAgICAgICAgdGhpcy5fcGF0aC5vZmYoJ2NsaWNrJywgdGhpcy5fcGF0aC5fb3BlblBvcHVwLCB0aGlzLl9wYXRoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLl9tYXRyaXhbNF0gKz0gZHg7XG4gICAgdGhpcy5fbWF0cml4WzVdICs9IGR5O1xuXG4gICAgdGhpcy5fc3RhcnRQb2ludC54ID0geDtcbiAgICB0aGlzLl9zdGFydFBvaW50LnkgPSB5O1xuXG4gICAgdGhpcy5fcGF0aC5fYXBwbHlUcmFuc2Zvcm0odGhpcy5fbWF0cml4KTtcbiAgICB0aGlzLl9wYXRoLmZpcmUoJ2RyYWcnKTtcbiAgICBMLkRvbUV2ZW50LnN0b3AoZXZ0Lm9yaWdpbmFsRXZlbnQpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBEcmFnZ2luZyBzdG9wcGVkLCBhcHBseVxuICAgKiBAcGFyYW0gIHtMLk1vdXNlRXZlbnR9IGV2dFxuICAgKi9cbiAgX29uRHJhZ0VuZDogZnVuY3Rpb24oZXZ0KSB7XG4gICAgTC5Eb21FdmVudC5zdG9wKGV2dCk7XG4gICAgdGhpcy5fZHJhZ0luUHJvZ3Jlc3MgPSBmYWxzZTtcbiAgICAvLyB1bmRvIGNvbnRhaW5lciB0cmFuc2Zvcm1cbiAgICB0aGlzLl9wYXRoLl9yZXNldFRyYW5zZm9ybSgpO1xuICAgIC8vIGFwcGx5IG1hdHJpeFxuICAgIHRoaXMuX3RyYW5zZm9ybVBvaW50cyh0aGlzLl9tYXRyaXgpO1xuXG4gICAgdGhpcy5fcGF0aC5fbWFwXG4gICAgICAub2ZmKCdtb3VzZW1vdmUnLCB0aGlzLl9vbkRyYWcsIHRoaXMpXG4gICAgICAub2ZmKCdtb3VzZXVwJywgdGhpcy5fb25EcmFnRW5kLCB0aGlzKTtcblxuICAgIC8vIGNvbnNpc3RlbmN5XG4gICAgdGhpcy5fcGF0aC5maXJlKCdkcmFnZW5kJywge1xuICAgICAgZGlzdGFuY2U6IE1hdGguc3FydChcbiAgICAgICAgTC5MaW5lVXRpbC5fc3FEaXN0KHRoaXMuX2RyYWdTdGFydFBvaW50LCBldnQuY29udGFpbmVyUG9pbnQpXG4gICAgICApXG4gICAgfSk7XG5cbiAgICBpZiAodGhpcy5fcGF0aC5fcG9wdXApIHtcbiAgICAgIEwuVXRpbC5yZXF1ZXN0QW5pbUZyYW1lKGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLl9wYXRoLm9uKCdjbGljaycsIHRoaXMuX3BhdGguX29wZW5Qb3B1cCwgdGhpcy5fcGF0aCk7XG4gICAgICB9LCB0aGlzKTtcbiAgICB9XG5cbiAgICB0aGlzLl9tYXRyaXggPSBudWxsO1xuICAgIHRoaXMuX3N0YXJ0UG9pbnQgPSBudWxsO1xuICAgIHRoaXMuX2RyYWdTdGFydFBvaW50ID0gbnVsbDtcbiAgICB0aGlzLl9wYXRoLl9kcmFnTW92ZWQgPSBmYWxzZTtcbiAgfSxcblxuICAvKipcbiAgICogVHJhbnNmb3JtcyBwb2ludCBhY2NvcmRpbmcgdG8gdGhlIHByb3ZpZGVkIHRyYW5zZm9ybWF0aW9uIG1hdHJpeC5cbiAgICpcbiAgICogIEBwYXJhbSB7QXJyYXkuPE51bWJlcj59IG1hdHJpeFxuICAgKiAgQHBhcmFtIHtMLkxhdExuZ30gcG9pbnRcbiAgICovXG4gIF90cmFuc2Zvcm1Qb2ludDogZnVuY3Rpb24ocG9pbnQsIG1hdHJpeCkge1xuICAgIHZhciBwYXRoID0gdGhpcy5fcGF0aDtcblxuICAgIHZhciBweCA9IEwucG9pbnQobWF0cml4WzRdLCBtYXRyaXhbNV0pO1xuXG4gICAgdmFyIGNycyA9IHBhdGguX21hcC5vcHRpb25zLmNycztcbiAgICB2YXIgdHJhbnNmb3JtYXRpb24gPSBjcnMudHJhbnNmb3JtYXRpb247XG4gICAgdmFyIHNjYWxlID0gY3JzLnNjYWxlKHBhdGguX21hcC5nZXRab29tKCkpO1xuICAgIHZhciBwcm9qZWN0aW9uID0gY3JzLnByb2plY3Rpb247XG5cbiAgICB2YXIgZGlmZiA9IHRyYW5zZm9ybWF0aW9uLnVudHJhbnNmb3JtKHB4LCBzY2FsZSlcbiAgICAgIC5zdWJ0cmFjdCh0cmFuc2Zvcm1hdGlvbi51bnRyYW5zZm9ybShMLnBvaW50KDAsIDApLCBzY2FsZSkpO1xuXG4gICAgcmV0dXJuIHByb2plY3Rpb24udW5wcm9qZWN0KHByb2plY3Rpb24ucHJvamVjdChwb2ludCkuX2FkZChkaWZmKSk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEFwcGxpZXMgdHJhbnNmb3JtYXRpb24sIGRvZXMgaXQgaW4gb25lIHN3ZWVwIGZvciBwZXJmb3JtYW5jZSxcbiAgICogc28gZG9uJ3QgYmUgc3VycHJpc2VkIGFib3V0IHRoZSBjb2RlIHJlcGV0aXRpb24uXG4gICAqXG4gICAqIFsgeCBdICAgWyBhICBiICB0eCBdIFsgeCBdICAgWyBhICogeCArIGIgKiB5ICsgdHggXVxuICAgKiBbIHkgXSA9IFsgYyAgZCAgdHkgXSBbIHkgXSA9IFsgYyAqIHggKyBkICogeSArIHR5IF1cbiAgICpcbiAgICogQHBhcmFtIHtBcnJheS48TnVtYmVyPn0gbWF0cml4XG4gICAqL1xuICBfdHJhbnNmb3JtUG9pbnRzOiBmdW5jdGlvbihtYXRyaXgpIHtcbiAgICB2YXIgcGF0aCA9IHRoaXMuX3BhdGg7XG4gICAgdmFyIGksIGxlbiwgbGF0bG5nO1xuXG4gICAgdmFyIHB4ID0gTC5wb2ludChtYXRyaXhbNF0sIG1hdHJpeFs1XSk7XG5cbiAgICB2YXIgY3JzID0gcGF0aC5fbWFwLm9wdGlvbnMuY3JzO1xuICAgIHZhciB0cmFuc2Zvcm1hdGlvbiA9IGNycy50cmFuc2Zvcm1hdGlvbjtcbiAgICB2YXIgc2NhbGUgPSBjcnMuc2NhbGUocGF0aC5fbWFwLmdldFpvb20oKSk7XG4gICAgdmFyIHByb2plY3Rpb24gPSBjcnMucHJvamVjdGlvbjtcblxuICAgIHZhciBkaWZmID0gdHJhbnNmb3JtYXRpb24udW50cmFuc2Zvcm0ocHgsIHNjYWxlKVxuICAgICAgLnN1YnRyYWN0KHRyYW5zZm9ybWF0aW9uLnVudHJhbnNmb3JtKEwucG9pbnQoMCwgMCksIHNjYWxlKSk7XG5cbiAgICAvLyBjb25zb2xlLnRpbWUoJ3RyYW5zZm9ybScpO1xuXG4gICAgLy8gYWxsIHNoaWZ0cyBhcmUgaW4tcGxhY2VcbiAgICBpZiAocGF0aC5fcG9pbnQpIHsgLy8gTC5DaXJjbGVcbiAgICAgIHBhdGguX2xhdGxuZyA9IHByb2plY3Rpb24udW5wcm9qZWN0KFxuICAgICAgICBwcm9qZWN0aW9uLnByb2plY3QocGF0aC5fbGF0bG5nKS5fYWRkKGRpZmYpKTtcbiAgICAgIHBhdGguX3BvaW50Ll9hZGQocHgpO1xuICAgIH0gZWxzZSBpZiAocGF0aC5fb3JpZ2luYWxQb2ludHMpIHsgLy8gZXZlcnl0aGluZyBlbHNlXG4gICAgICBmb3IgKGkgPSAwLCBsZW4gPSBwYXRoLl9vcmlnaW5hbFBvaW50cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICBsYXRsbmcgPSBwYXRoLl9sYXRsbmdzW2ldO1xuICAgICAgICBwYXRoLl9sYXRsbmdzW2ldID0gcHJvamVjdGlvblxuICAgICAgICAgIC51bnByb2plY3QocHJvamVjdGlvbi5wcm9qZWN0KGxhdGxuZykuX2FkZChkaWZmKSk7XG4gICAgICAgIHBhdGguX29yaWdpbmFsUG9pbnRzW2ldLl9hZGQocHgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIGhvbGVzIG9wZXJhdGlvbnNcbiAgICBpZiAocGF0aC5faG9sZXMpIHtcbiAgICAgIGZvciAoaSA9IDAsIGxlbiA9IHBhdGguX2hvbGVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgIGZvciAodmFyIGogPSAwLCBsZW4yID0gcGF0aC5faG9sZXNbaV0ubGVuZ3RoOyBqIDwgbGVuMjsgaisrKSB7XG4gICAgICAgICAgbGF0bG5nID0gcGF0aC5faG9sZXNbaV1bal07XG4gICAgICAgICAgcGF0aC5faG9sZXNbaV1bal0gPSBwcm9qZWN0aW9uXG4gICAgICAgICAgICAudW5wcm9qZWN0KHByb2plY3Rpb24ucHJvamVjdChsYXRsbmcpLl9hZGQoZGlmZikpO1xuICAgICAgICAgIHBhdGguX2hvbGVQb2ludHNbaV1bal0uX2FkZChweCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBjb25zb2xlLnRpbWVFbmQoJ3RyYW5zZm9ybScpO1xuXG4gICAgcGF0aC5fdXBkYXRlUGF0aCgpO1xuICB9XG5cbn0pO1xuXG5MLlBhdGgucHJvdG90eXBlLl9faW5pdEV2ZW50cyA9IEwuUGF0aC5wcm90b3R5cGUuX2luaXRFdmVudHM7XG5MLlBhdGgucHJvdG90eXBlLl9pbml0RXZlbnRzID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMuX19pbml0RXZlbnRzKCk7XG5cbiAgaWYgKHRoaXMub3B0aW9ucy5kcmFnZ2FibGUpIHtcbiAgICBpZiAodGhpcy5kcmFnZ2luZykge1xuICAgICAgdGhpcy5kcmFnZ2luZy5lbmFibGUoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5kcmFnZ2luZyA9IG5ldyBMLkhhbmRsZXIuUGF0aERyYWcodGhpcyk7XG4gICAgICB0aGlzLmRyYWdnaW5nLmVuYWJsZSgpO1xuICAgIH1cbiAgfSBlbHNlIGlmICh0aGlzLmRyYWdnaW5nKSB7XG4gICAgdGhpcy5kcmFnZ2luZy5kaXNhYmxlKCk7XG4gIH1cbn07XG5cbi8qXG4gKiBSZXR1cm4gdHJhbnNmb3JtZWQgcG9pbnRzIGluIGNhc2UgaWYgZHJhZ2dpbmcgaXMgZW5hYmxlZCBhbmQgaW4gcHJvZ3Jlc3MsXG4gKiBvdGhlcndpc2UgLSBjYWxsIG9yaWdpbmFsIG1ldGhvZC5cbiAqXG4gKiBGb3IgTC5DaXJjbGUgYW5kIEwuUG9seWxpbmVcbiAqL1xuXG5MLkNpcmNsZS5wcm90b3R5cGUuX2dldExhdExuZyA9IEwuQ2lyY2xlLnByb3RvdHlwZS5nZXRMYXRMbmc7XG5MLkNpcmNsZS5wcm90b3R5cGUuZ2V0TGF0TG5nID0gZnVuY3Rpb24oKSB7XG4gIGlmICh0aGlzLmRyYWdnaW5nICYmIHRoaXMuZHJhZ2dpbmcuaW5Qcm9ncmVzcygpKSB7XG4gICAgcmV0dXJuIHRoaXMuZHJhZ2dpbmcuX3RyYW5zZm9ybVBvaW50KHRoaXMuX2xhdGxuZywgdGhpcy5kcmFnZ2luZy5fbWF0cml4KTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gdGhpcy5fZ2V0TGF0TG5nKCk7XG4gIH1cbn07XG5cbkwuUG9seWxpbmUucHJvdG90eXBlLl9nZXRMYXRMbmdzID0gTC5Qb2x5bGluZS5wcm90b3R5cGUuZ2V0TGF0TG5ncztcbkwuUG9seWxpbmUucHJvdG90eXBlLmdldExhdExuZ3MgPSBmdW5jdGlvbigpIHtcbiAgaWYgKHRoaXMuZHJhZ2dpbmcgJiYgdGhpcy5kcmFnZ2luZy5pblByb2dyZXNzKCkpIHtcbiAgICB2YXIgbWF0cml4ID0gdGhpcy5kcmFnZ2luZy5fbWF0cml4O1xuICAgIHZhciBwb2ludHMgPSB0aGlzLl9nZXRMYXRMbmdzKCk7XG4gICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHBvaW50cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgcG9pbnRzW2ldID0gdGhpcy5kcmFnZ2luZy5fdHJhbnNmb3JtUG9pbnQocG9pbnRzW2ldLCBtYXRyaXgpO1xuICAgIH1cbiAgICByZXR1cm4gcG9pbnRzO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiB0aGlzLl9nZXRMYXRMbmdzKCk7XG4gIH1cbn07XG5cbiIsIi8qKlxuICogTWF0cml4IHRyYW5zZm9ybSBwYXRoIGZvciBTVkcvVk1MXG4gKiBUT0RPOiBhZGFwdCB0byBMZWFmbGV0IDAuOCB1cG9uIHJlbGVhc2VcbiAqL1xuXG5cInVzZSBzdHJpY3RcIjtcblxuaWYgKEwuQnJvd3Nlci5zdmcpIHsgLy8gU1ZHIHRyYW5zZm9ybWF0aW9uXG5cbiAgTC5QYXRoLmluY2x1ZGUoe1xuXG4gICAgLyoqXG4gICAgICogUmVzZXQgdHJhbnNmb3JtIG1hdHJpeFxuICAgICAqL1xuICAgIF9yZXNldFRyYW5zZm9ybTogZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLl9jb250YWluZXIuc2V0QXR0cmlidXRlTlMobnVsbCwgJ3RyYW5zZm9ybScsICcnKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQXBwbGllcyBtYXRyaXggdHJhbnNmb3JtYXRpb24gdG8gU1ZHXG4gICAgICogQHBhcmFtIHtBcnJheS48TnVtYmVyPn0gbWF0cml4XG4gICAgICovXG4gICAgX2FwcGx5VHJhbnNmb3JtOiBmdW5jdGlvbihtYXRyaXgpIHtcbiAgICAgIHRoaXMuX2NvbnRhaW5lci5zZXRBdHRyaWJ1dGVOUyhudWxsLCBcInRyYW5zZm9ybVwiLFxuICAgICAgICAnbWF0cml4KCcgKyBtYXRyaXguam9pbignICcpICsgJyknKTtcbiAgICB9XG5cbiAgfSk7XG5cbn0gZWxzZSB7IC8vIFZNTCB0cmFuc2Zvcm0gcm91dGluZXNcblxuICBMLlBhdGguaW5jbHVkZSh7XG5cbiAgICAvKipcbiAgICAgKiBSZXNldCB0cmFuc2Zvcm0gbWF0cml4XG4gICAgICovXG4gICAgX3Jlc2V0VHJhbnNmb3JtOiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICh0aGlzLl9za2V3KSB7XG4gICAgICAgIC8vIHN1cGVyIGltcG9ydGFudCEgd29ya2Fyb3VuZCBmb3IgYSAnanVtcGluZycgZ2xpdGNoOlxuICAgICAgICAvLyBkaXNhYmxlIHRyYW5zZm9ybSBiZWZvcmUgcmVtb3ZpbmcgaXRcbiAgICAgICAgdGhpcy5fc2tldy5vbiA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9jb250YWluZXIucmVtb3ZlQ2hpbGQodGhpcy5fc2tldyk7XG4gICAgICAgIHRoaXMuX3NrZXcgPSBudWxsO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBBcHBsaWVzIG1hdHJpeCB0cmFuc2Zvcm1hdGlvbiB0byBWTUxcbiAgICAgKiBAcGFyYW0ge0FycmF5LjxOdW1iZXI+fSBtYXRyaXhcbiAgICAgKi9cbiAgICBfYXBwbHlUcmFuc2Zvcm06IGZ1bmN0aW9uKG1hdHJpeCkge1xuICAgICAgdmFyIHNrZXcgPSB0aGlzLl9za2V3O1xuXG4gICAgICBpZiAoIXNrZXcpIHtcbiAgICAgICAgc2tldyA9IHRoaXMuX2NyZWF0ZUVsZW1lbnQoJ3NrZXcnKTtcbiAgICAgICAgdGhpcy5fY29udGFpbmVyLmFwcGVuZENoaWxkKHNrZXcpO1xuICAgICAgICBza2V3LnN0eWxlLmJlaGF2aW9yID0gJ3VybCgjZGVmYXVsdCNWTUwpJztcbiAgICAgICAgdGhpcy5fc2tldyA9IHNrZXc7XG4gICAgICB9XG5cbiAgICAgIC8vIGhhbmRsZSBza2V3L3RyYW5zbGF0ZSBzZXBhcmF0ZWx5LCBjYXVzZSBpdCdzIGJyb2tlblxuICAgICAgdmFyIG10ID0gbWF0cml4WzBdLnRvRml4ZWQoOCkgKyBcIiBcIiArIG1hdHJpeFsxXS50b0ZpeGVkKDgpICsgXCIgXCIgK1xuICAgICAgICBtYXRyaXhbMl0udG9GaXhlZCg4KSArIFwiIFwiICsgbWF0cml4WzNdLnRvRml4ZWQoOCkgKyBcIiAwIDBcIjtcbiAgICAgIHZhciBvZmZzZXQgPSBNYXRoLmZsb29yKG1hdHJpeFs0XSkudG9GaXhlZCgpICsgXCIsIFwiICtcbiAgICAgICAgTWF0aC5mbG9vcihtYXRyaXhbNV0pLnRvRml4ZWQoKSArIFwiXCI7XG5cbiAgICAgIHZhciBzID0gdGhpcy5fY29udGFpbmVyLnN0eWxlO1xuICAgICAgdmFyIGwgPSBwYXJzZUZsb2F0KHMubGVmdCk7XG4gICAgICB2YXIgdCA9IHBhcnNlRmxvYXQocy50b3ApO1xuICAgICAgdmFyIHcgPSBwYXJzZUZsb2F0KHMud2lkdGgpO1xuICAgICAgdmFyIGggPSBwYXJzZUZsb2F0KHMuaGVpZ2h0KTtcblxuICAgICAgaWYgKGlzTmFOKGwpKSBsID0gMDtcbiAgICAgIGlmIChpc05hTih0KSkgdCA9IDA7XG4gICAgICBpZiAoaXNOYU4odykgfHwgIXcpIHcgPSAxO1xuICAgICAgaWYgKGlzTmFOKGgpIHx8ICFoKSBoID0gMTtcblxuICAgICAgdmFyIG9yaWdpbiA9ICgtbCAvIHcgLSAwLjUpLnRvRml4ZWQoOCkgKyBcIiBcIiArICgtdCAvIGggLSAwLjUpLnRvRml4ZWQoOCk7XG5cbiAgICAgIHNrZXcub24gPSBcImZcIjtcbiAgICAgIHNrZXcubWF0cml4ID0gbXQ7XG4gICAgICBza2V3Lm9yaWdpbiA9IG9yaWdpbjtcbiAgICAgIHNrZXcub2Zmc2V0ID0gb2Zmc2V0O1xuICAgICAgc2tldy5vbiA9IHRydWU7XG4gICAgfVxuXG4gIH0pO1xufVxuXG4vLyBSZW5kZXJlci1pbmRlcGVuZGVudFxuTC5QYXRoLmluY2x1ZGUoe1xuXG4gIC8qKlxuICAgKiBDaGVjayBpZiB0aGUgZmVhdHVyZSB3YXMgZHJhZ2dlZCwgdGhhdCdsbCBzdXByZXNzIHRoZSBjbGljayBldmVudFxuICAgKiBvbiBtb3VzZXVwLiBUaGF0IGZpeGVzIHBvcHVwcyBmb3IgZXhhbXBsZVxuICAgKlxuICAgKiBAcGFyYW0gIHtNb3VzZUV2ZW50fSBlXG4gICAqL1xuICBfb25Nb3VzZUNsaWNrOiBmdW5jdGlvbihlKSB7XG4gICAgaWYgKCh0aGlzLmRyYWdnaW5nICYmIHRoaXMuZHJhZ2dpbmcubW92ZWQoKSkgfHxcbiAgICAgICh0aGlzLl9tYXAuZHJhZ2dpbmcgJiYgdGhpcy5fbWFwLmRyYWdnaW5nLm1vdmVkKCkpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5fZmlyZU1vdXNlRXZlbnQoZSk7XG4gIH1cbn0pO1xuIiwidmFyIEwgPSByZXF1aXJlKCdsZWFmbGV0Jyk7XG5cbm1vZHVsZS5leHBvcnRzID0gTC5DaXJjbGVNYXJrZXIuZXh0ZW5kKHtcblxuICBvcHRpb25zOiB7XG4gICAgdGV4dFN0eWxlOiB7XG4gICAgICBjb2xvcjogJyNmZmYnLFxuICAgICAgZm9udFNpemU6IDEyXG4gICAgfSxcbiAgICBzaGlmdFk6IDYsXG4gIH0sXG5cblxuICAvKipcbiAgICogQGNsYXNzIExhYmVsZWRDaXJjbGVcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqIEBleHRlbmRzIHtMLkNpcmNsZU1hcmtlcn1cbiAgICogQHBhcmFtICB7U3RyaW5nfSAgIHRleHRcbiAgICogQHBhcmFtICB7TC5MYXRMbmd9IGxhdGxuZ1xuICAgKiBAcGFyYW0gIHtPYmplY3Q9fSAgb3B0aW9uc1xuICAgKi9cbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24odGV4dCwgbGF0bG5nLCBvcHRpb25zKSB7XG4gICAgdGhpcy5fdGV4dCA9IHRleHQ7XG4gICAgTC5DaXJjbGVNYXJrZXIucHJvdG90eXBlLmluaXRpYWxpemUuY2FsbCh0aGlzLCBsYXRsbmcsIG9wdGlvbnMpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIEBwYXJhbSB7U3RyaW5nfSB0ZXh0XG4gICAqIEByZXR1cm4ge0xhYmVsZWRDaXJjbGV9XG4gICAqL1xuICBzZXRUZXh0OiBmdW5jdGlvbih0ZXh0KSB7XG4gICAgdGhpcy5fdGV4dCA9IHRleHQ7XG4gICAgaWYgKHRoaXMuX3RleHROb2RlKSB7XG4gICAgICB0aGlzLl90ZXh0RWxlbWVudC5yZW1vdmVDaGlsZCh0aGlzLl90ZXh0Tm9kZSk7XG4gICAgfVxuICAgIHRoaXMuX3RleHROb2RlID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUodGhpcy5fdGV4dCk7XG4gICAgdGhpcy5fdGV4dEVsZW1lbnQuYXBwZW5kQ2hpbGQodGhpcy5fdGV4dE5vZGUpO1xuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cblxuICAvKipcbiAgICogQ3JlYXRlIHRleHQgbm9kZSBpbiBjb250YWluZXJcbiAgICovXG4gIF9pbml0UGF0aDogZnVuY3Rpb24oKSB7XG4gICAgTC5DaXJjbGVNYXJrZXIucHJvdG90eXBlLl9pbml0UGF0aC5jYWxsKHRoaXMpO1xuICAgIHRoaXMuX3RleHRFbGVtZW50ID0gdGhpcy5fY3JlYXRlRWxlbWVudCgndGV4dCcpO1xuICAgIHRoaXMuc2V0VGV4dCh0aGlzLl90ZXh0KTtcbiAgICB0aGlzLl9jb250YWluZXIuYXBwZW5kQ2hpbGQodGhpcy5fdGV4dEVsZW1lbnQpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIFBvc2l0aW9uIHRoZSB0ZXh0IGluIGNvbnRhaW5lclxuICAgKi9cbiAgX3VwZGF0ZVBhdGg6IGZ1bmN0aW9uKCkge1xuICAgIEwuQ2lyY2xlTWFya2VyLnByb3RvdHlwZS5fdXBkYXRlUGF0aC5jYWxsKHRoaXMpO1xuXG4gICAgdGhpcy5fdXBkYXRlVGV4dFBvc2l0aW9uKCk7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHBhcmFtICB7TC5NYXB9IG1hcFxuICAgKiBAcmV0dXJuIHtMYWJlbGVkQ2lyY2xlfVxuICAgKi9cbiAgb25BZGQ6IGZ1bmN0aW9uKG1hcCkge1xuICAgIEwuQ2lyY2xlTWFya2VyLnByb3RvdHlwZS5vbkFkZC5jYWxsKHRoaXMsIG1hcCk7XG4gICAgdGhpcy5fdXBkYXRlVGV4dFBvc2l0aW9uKCk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cblxuICAvKipcbiAgICogQ2FsY3VsYXRlIHBvc2l0aW9uIGZvciB0ZXh0XG4gICAqL1xuICBfdXBkYXRlVGV4dFBvc2l0aW9uOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgdGV4dEVsZW1lbnQgPSB0aGlzLl90ZXh0RWxlbWVudDtcbiAgICB2YXIgYmJveCA9IHRleHRFbGVtZW50LmdldEJCb3goKTtcbiAgICB2YXIgdGV4dFBvc2l0aW9uID0gdGhpcy5fcG9pbnQuc3VidHJhY3QoXG4gICAgICBMLnBvaW50KGJib3gud2lkdGgsIC1iYm94LmhlaWdodCArIHRoaXMub3B0aW9ucy5zaGlmdFkpLmRpdmlkZUJ5KDIpKTtcblxuICAgIHRleHRFbGVtZW50LnNldEF0dHJpYnV0ZSgneCcsIHRleHRQb3NpdGlvbi54KTtcbiAgICB0ZXh0RWxlbWVudC5zZXRBdHRyaWJ1dGUoJ3knLCB0ZXh0UG9zaXRpb24ueSk7XG4gIH0sXG5cblxuICAvKipcbiAgICogU2V0IHRleHQgc3R5bGVcbiAgICovXG4gIF91cGRhdGVTdHlsZTogZnVuY3Rpb24oKSB7XG4gICAgTC5DaXJjbGVNYXJrZXIucHJvdG90eXBlLl91cGRhdGVTdHlsZS5jYWxsKHRoaXMpO1xuXG4gICAgdmFyIHN0eWxlcyA9IHRoaXMub3B0aW9ucy50ZXh0U3R5bGU7XG4gICAgZm9yICh2YXIgcHJvcCBpbiBzdHlsZXMpIHtcbiAgICAgIGlmIChzdHlsZXMuaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgICAgdmFyIHN0eWxlUHJvcCA9IHByb3A7XG4gICAgICAgIGlmIChwcm9wID09PSAnY29sb3InKSB7XG4gICAgICAgICAgc3R5bGVQcm9wID0gJ3N0cm9rZSc7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fdGV4dEVsZW1lbnQuc3R5bGVbc3R5bGVQcm9wXSA9IHN0eWxlc1twcm9wXTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn0pO1xuIiwidmFyIEwgPSByZXF1aXJlKCdsZWFmbGV0Jyk7XG52YXIgQ2lyY2xlID0gcmVxdWlyZSgnLi9jaXJjbGUnKTtcbnJlcXVpcmUoJ2xlYWZsZXQtcGF0aC1kcmFnJyk7XG5cbnZhciBMYWJlbGVkTWFya2VyID0gTC5GZWF0dXJlR3JvdXAuZXh0ZW5kKHtcblxuICBvcHRpb25zOiB7XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0gIHtMYWJlbGVkTWFya2VyfSBtYXJrZXJcbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9ICAgICAgICBmZWF0dXJlXG4gICAgICogQHJldHVybiB7U3RyaW5nfVxuICAgICAqL1xuICAgIGdldExhYmVsVGV4dDogZnVuY3Rpb24obWFya2VyLCBmZWF0dXJlKSB7XG4gICAgICByZXR1cm4gZmVhdHVyZS5wcm9wZXJ0aWVzLnRleHQ7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSAge0xhYmVsZWRNYXJrZXJ9IG1hcmtlclxuICAgICAqIEBwYXJhbSAge09iamVjdH0gICAgICAgIGZlYXR1cmVcbiAgICAgKiBAcGFyYW0gIHtMLkxhdExuZ30gICAgICBsYXRsbmdcbiAgICAgKiBAcmV0dXJuIHtMLkxhdExuZ31cbiAgICAgKi9cbiAgICBnZXRMYWJlbFBvc2l0aW9uOiBmdW5jdGlvbihtYXJrZXIsIGZlYXR1cmUsIGxhdGxuZykge1xuICAgICAgcmV0dXJuIGZlYXR1cmUucHJvcGVydGllcy5sYWJlbFBvc2l0aW9uID9cbiAgICAgICAgTC5sYXRMbmcoZmVhdHVyZS5wcm9wZXJ0aWVzLmxhYmVsUG9zaXRpb24uc2xpY2UoKS5yZXZlcnNlKCkpIDpcbiAgICAgICAgbGF0bG5nO1xuICAgIH0sXG5cbiAgICBsYWJlbFBvc2l0aW9uS2V5OiAnbGFiZWxQb3NpdGlvbicsXG5cbiAgICBtYXJrZXJPcHRpb25zOiB7XG4gICAgICBjb2xvcjogJyNmMDAnLFxuICAgICAgZmlsbE9wYWNpdHk6IDAuOCxcbiAgICAgIGRyYWdnYWJsZTogdHJ1ZSxcbiAgICAgIHJhZGl1czogMTVcbiAgICB9LFxuXG4gICAgYW5jaG9yT3B0aW9uczoge1xuICAgICAgY29sb3I6ICcjMDBmJyxcbiAgICAgIHJhZGl1czogM1xuICAgIH0sXG5cbiAgICBsaW5lT3B0aW9uczoge1xuICAgICAgY29sb3I6ICcjZjAwJyxcbiAgICAgIGRhc2hBcnJheTogWzUsIDE1XSxcbiAgICAgIGxpbmVDYXA6ICdzcXVhcmUnXG4gICAgfVxuXG4gIH0sXG5cblxuICAvKipcbiAgICogQGNsYXNzIExhYmVsZWRNYXJrZXJcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqIEBleHRlbmRzIHtMLkZlYXR1cmVHcm91cH1cbiAgICpcbiAgICogQHBhcmFtICB7TC5MYXRMbmd9IGxhdGxuZ1xuICAgKiBAcGFyYW0gIHtPYmplY3Q9fSAgZmVhdHVyZVxuICAgKiBAcGFyYW0gIHtPYmplY3Q9fSAgb3B0aW9uc1xuICAgKi9cbiAgaW5pdGlhbGl6ZTogZnVuY3Rpb24obGF0bG5nLCBmZWF0dXJlLCBvcHRpb25zKSB7XG4gICAgTC5VdGlsLnNldE9wdGlvbnModGhpcywgb3B0aW9ucyk7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7T2JqZWN0fVxuICAgICAqL1xuICAgIHRoaXMuZmVhdHVyZSA9IGZlYXR1cmUgfHwge1xuICAgICAgdHlwZTogJ0ZlYXR1cmUnLFxuICAgICAgcHJvcGVydGllczoge30sXG4gICAgICBnZW9tZXRyeToge1xuICAgICAgICAndHlwZSc6ICdQb2ludCdcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0wuTGF0TG5nfVxuICAgICAqL1xuICAgIHRoaXMuX2xhdGxuZyA9IGxhdGxuZztcblxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0NpcmNsZUxhYmVsfVxuICAgICAqL1xuICAgIHRoaXMuX21hcmtlciA9IG51bGw7XG5cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtMLkNpcmNsZU1hcmtlcn1cbiAgICAgKi9cbiAgICB0aGlzLl9hbmNob3IgPSBudWxsO1xuXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TC5Qb2x5bGluZX1cbiAgICAgKi9cbiAgICB0aGlzLl9saW5lID0gbnVsbDtcblxuICAgIHRoaXMuX2NyZWF0ZUxheWVycygpO1xuICAgIEwuTGF5ZXJHcm91cC5wcm90b3R5cGUuaW5pdGlhbGl6ZS5jYWxsKHRoaXMsXG4gICAgICBbdGhpcy5fYW5jaG9yLCB0aGlzLl9saW5lLCB0aGlzLl9tYXJrZXJdKTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcmV0dXJuIHtMLkxhdExuZ31cbiAgICovXG4gIGdldExhYmVsUG9zaXRpb246IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLl9tYXJrZXIuZ2V0TGF0TG5nKCk7XG4gIH0sXG5cblxuICAvKipcbiAgICogQHJldHVybiB7TC5MYXRMbmd9XG4gICAqL1xuICBnZXRMYXRMbmc6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLl9sYXRsbmc7XG4gIH0sXG5cblxuICAvKipcbiAgICogU2VyaWFsaXplXG4gICAqIEByZXR1cm4ge09iamVjdH1cbiAgICovXG4gIHRvR2VvSlNPTjogZnVuY3Rpb24oKSB7XG4gICAgdmFyIGZlYXR1cmUgPSBMLkdlb0pTT04uZ2V0RmVhdHVyZSh0aGlzLCB7XG4gICAgICB0eXBlOiAnUG9pbnQnLFxuICAgICAgY29vcmRpbmF0ZXM6IEwuR2VvSlNPTi5sYXRMbmdUb0Nvb3Jkcyh0aGlzLl9hbmNob3IuZ2V0TGF0TG5nKCkpXG4gICAgfSk7XG4gICAgZmVhdHVyZS5wcm9wZXJ0aWVzW3RoaXMub3B0aW9ucy5sYWJlbFBvc2l0aW9uS2V5XSA9XG4gICAgICBMLkdlb0pTT04ubGF0TG5nVG9Db29yZHModGhpcy5fbWFya2VyLmdldExhdExuZygpKTtcbiAgICByZXR1cm4gZmVhdHVyZTtcbiAgfSxcblxuXG4gIC8qKlxuICAgKiBAcGFyYW0ge1N0cmluZ30gdGV4dFxuICAgKiBAcmV0dXJuIHtMYWJlbGVkTWFya2VyfVxuICAgKi9cbiAgc2V0VGV4dDogZnVuY3Rpb24odGV4dCkge1xuICAgIHRoaXMuX21hcmtlci5zZXRUZXh0KHRleHQpO1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYW5jaG9yLCBsaW5lIGFuZCBsYWJlbFxuICAgKi9cbiAgX2NyZWF0ZUxheWVyczogZnVuY3Rpb24oKSB7XG4gICAgdmFyIG9wdHMgPSB0aGlzLm9wdGlvbnM7XG4gICAgdmFyIHBvcyAgPSBvcHRzLmdldExhYmVsUG9zaXRpb24odGhpcywgdGhpcy5mZWF0dXJlLCB0aGlzLl9sYXRsbmcpO1xuICAgIHZhciB0ZXh0ID0gb3B0cy5nZXRMYWJlbFRleHQodGhpcywgdGhpcy5mZWF0dXJlKTtcblxuICAgIHRoaXMuX21hcmtlciA9IG5ldyBDaXJjbGUodGV4dCwgcG9zLFxuICAgICAgTC5VdGlsLmV4dGVuZCh7fSxcbiAgICAgICAgTGFiZWxlZE1hcmtlci5wcm90b3R5cGUub3B0aW9ucy5tYXJrZXJPcHRpb25zLFxuICAgICAgICBvcHRzLm1hcmtlck9wdGlvbnMpXG4gICAgKS5vbignZHJhZycsIHRoaXMuX29uTWFya2VyRHJhZywgdGhpcyk7XG5cbiAgICB0aGlzLl9hbmNob3IgPSBuZXcgTC5DaXJjbGVNYXJrZXIodGhpcy5fbGF0bG5nLFxuICAgICAgTC5VdGlsLmV4dGVuZCh7fSwgTGFiZWxlZE1hcmtlci5wcm90b3R5cGUub3B0aW9ucy5hbmNob3JPcHRpb25zLFxuICAgICAgICBvcHRzLmFuY2hvck9wdGlvbnMpKTtcblxuICAgIHRoaXMuX2xpbmUgPSBuZXcgTC5Qb2x5bGluZShbdGhpcy5fbGF0bG5nLCB0aGlzLl9tYXJrZXIuZ2V0TGF0TG5nKCldLFxuICAgICAgTC5VdGlsLmV4dGVuZCh7fSwgTGFiZWxlZE1hcmtlci5wcm90b3R5cGUub3B0aW9ucy5saW5lT3B0aW9ucyxcbiAgICAgICAgb3B0cy5saW5lT3B0aW9ucykpO1xuICB9LFxuXG5cbiAgLyoqXG4gICAqIExpbmUgZHJhZ2dpbmdcbiAgICogQHBhcmFtICB7RHJhZ0V2ZW50fSBldnRcbiAgICovXG4gIF9vbk1hcmtlckRyYWc6IGZ1bmN0aW9uKGV2dCkge1xuICAgIHRoaXMuX2xpbmUuc2V0TGF0TG5ncyhbZXZ0LnRhcmdldC5nZXRMYXRMbmcoKSwgdGhpcy5fbGF0bG5nXSk7XG4gIH1cblxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gTC5MYWJlbGVkQ2lyY2xlTWFya2VyID0gTGFiZWxlZE1hcmtlcjtcbkwubGFiZWxlZENpcmNsZU1hcmtlciA9IGZ1bmN0aW9uKGxhdGxuZywgZmVhdHVyZSwgb3B0aW9ucykge1xuICByZXR1cm4gbmV3IExhYmVsZWRNYXJrZXIobGF0bG5nLCBmZWF0dXJlLCBvcHRpb25zKTtcbn1cbiJdfQ==
