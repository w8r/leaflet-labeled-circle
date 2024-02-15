import { CircleMarker as _, SVG as y, point as D, FeatureGroup as k, latLng as E, Util as m, LayerGroup as T, GeoJSON as f, Polyline as C, DomEvent as v } from "leaflet";
L.SVG.include({
  /**
   * Reset transform matrix
   */
  _resetTransformPath: function(t) {
    t._path.setAttributeNS(null, "transform", "");
  },
  /**
   * Applies matrix transformation to SVG
   * @param {L.Path}         layer
   * @param {Array.<Number>} matrix
   */
  transformPath: function(t, e) {
    t._path.setAttributeNS(
      null,
      "transform",
      "matrix(" + e.join(" ") + ")"
    );
  }
});
L.SVG.include(L.Browser.vml ? {
  /**
   * Reset transform matrix
   */
  _resetTransformPath: function(t) {
    t._skew && (t._skew.on = !1, t._path.removeChild(t._skew), t._skew = null);
  },
  /**
   * Applies matrix transformation to VML
   * @param {L.Path}         layer
   * @param {Array.<Number>} matrix
   */
  transformPath: function(t, e) {
    var i = t._skew;
    i || (i = L.SVG.create("skew"), t._path.appendChild(i), i.style.behavior = "url(#default#VML)", t._skew = i);
    var n = e[0].toFixed(8) + " " + e[1].toFixed(8) + " " + e[2].toFixed(8) + " " + e[3].toFixed(8) + " 0 0", s = Math.floor(e[4]).toFixed() + ", " + Math.floor(e[5]).toFixed(), a = this._path.style, o = parseFloat(a.left), r = parseFloat(a.top), h = parseFloat(a.width), l = parseFloat(a.height);
    isNaN(o) && (o = 0), isNaN(r) && (r = 0), (isNaN(h) || !h) && (h = 1), (isNaN(l) || !l) && (l = 1);
    var p = (-o / h - 0.5).toFixed(8) + " " + (-r / l - 0.5).toFixed(8);
    i.on = "f", i.matrix = n, i.origin = p, i.offset = s, i.on = !0;
  }
} : {});
function w() {
  return !0;
}
L.Canvas.include({
  /**
   * Do nothing
   * @param  {L.Path} layer
   */
  _resetTransformPath: function(t) {
    this._containerCopy && (delete this._containerCopy, t._containsPoint_ && (t._containsPoint = t._containsPoint_, delete t._containsPoint_, this._requestRedraw(t)));
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
  transformPath: function(t, e) {
    var i = this._containerCopy, n = this._ctx, s, a = L.Browser.retina ? 2 : 1, o = this._bounds, r = o.getSize(), h = o.min;
    i || (i = this._containerCopy = document.createElement("canvas"), s = i.getContext("2d"), i.width = a * r.x, i.height = a * r.y, this._removePath(t), this._redraw(), s.translate(a * o.min.x, a * o.min.y), s.drawImage(this._container, 0, 0), this._initPath(t), t._containsPoint_ = t._containsPoint, t._containsPoint = w), n.save(), n.clearRect(h.x, h.y, r.x * a, r.y * a), n.setTransform(1, 0, 0, 1, 0, 0), n.restore(), n.save(), n.drawImage(this._containerCopy, 0, 0, r.x, r.y), n.transform.apply(n, e), this._drawing = !0, t._updatePath(), this._drawing = !1, n.restore();
  }
});
/**
 * Leaflet vector features drag functionality
 * @author Alexander Milevski <info@w8r.name>
 * @preserve
 */
L.Path.include({
  /**
   * Applies matrix transformation to SVG
   * @param {Array.<Number>?} matrix
   */
  _transform: function(t) {
    return this._renderer && (t ? this._renderer.transformPath(this, t) : (this._renderer._resetTransformPath(this), this._update())), this;
  },
  /**
   * Check if the feature was dragged, that'll supress the click event
   * on mouseup. That fixes popups for example
   *
   * @param  {MouseEvent} e
   */
  _onMouseClick: function(t) {
    this.dragging && this.dragging.moved() || this._map.dragging && this._map.dragging.moved() || this._fireMouseEvent(t);
  }
});
var N = {
  mousedown: "mouseup",
  touchstart: "touchend",
  pointerdown: "touchend",
  MSPointerDown: "touchend"
}, S = {
  mousedown: "mousemove",
  touchstart: "touchmove",
  pointerdown: "touchmove",
  MSPointerDown: "touchmove"
};
function G(t, e) {
  var i = t.x - e.x, n = t.y - e.y;
  return Math.sqrt(i * i + n * n);
}
L.Handler.PathDrag = L.Handler.extend(
  /** @lends  L.Path.Drag.prototype */
  {
    statics: {
      DRAGGING_CLS: "leaflet-path-draggable"
    },
    /**
     * @param  {L.Path} path
     * @constructor
     */
    initialize: function(t) {
      this._path = t, this._matrix = null, this._startPoint = null, this._dragStartPoint = null, this._mapDraggingWasEnabled = !1;
    },
    /**
     * Enable dragging
     */
    addHooks: function() {
      this._path.on("mousedown", this._onDragStart, this), this._path.options.className = this._path.options.className ? this._path.options.className + " " + L.Handler.PathDrag.DRAGGING_CLS : L.Handler.PathDrag.DRAGGING_CLS, this._path._path && L.DomUtil.addClass(this._path._path, L.Handler.PathDrag.DRAGGING_CLS);
    },
    /**
     * Disable dragging
     */
    removeHooks: function() {
      this._path.off("mousedown", this._onDragStart, this), this._path.options.className = this._path.options.className.replace(new RegExp("\\s+" + L.Handler.PathDrag.DRAGGING_CLS), ""), this._path._path && L.DomUtil.removeClass(this._path._path, L.Handler.PathDrag.DRAGGING_CLS);
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
    _onDragStart: function(t) {
      var e = t.originalEvent._simulated ? "touchstart" : t.originalEvent.type;
      this._mapDraggingWasEnabled = !1, this._startPoint = t.containerPoint.clone(), this._dragStartPoint = t.containerPoint.clone(), this._matrix = [1, 0, 0, 1, 0, 0], L.DomEvent.stop(t.originalEvent), L.DomUtil.addClass(this._path._renderer._container, "leaflet-interactive"), L.DomEvent.on(document, S[e], this._onDrag, this).on(document, N[e], this._onDragEnd, this), this._path._map.dragging.enabled() && (this._path._map.dragging.disable(), this._mapDraggingWasEnabled = !0), this._path._dragMoved = !1, this._path._popup && this._path._popup._close(), this._replaceCoordGetters(t);
    },
    /**
     * Dragging
     * @param  {L.MouseEvent} evt
     */
    _onDrag: function(t) {
      L.DomEvent.stop(t);
      var e = t.touches && t.touches.length >= 1 ? t.touches[0] : t, i = this._path._map.mouseEventToContainerPoint(e);
      if (t.type === "touchmove" && !this._path._dragMoved) {
        var n = this._dragStartPoint.distanceTo(i);
        if (n <= this._path._map.options.tapTolerance)
          return;
      }
      var s = i.x, a = i.y, o = s - this._startPoint.x, r = a - this._startPoint.y;
      (o || r) && (this._path._dragMoved || (this._path._dragMoved = !0, this._path.fire("dragstart", t), this._path.bringToFront()), this._matrix[4] += o, this._matrix[5] += r, this._startPoint.x = s, this._startPoint.y = a, this._path.fire("predrag", t), this._path._transform(this._matrix), this._path.fire("drag", t));
    },
    /**
     * Dragging stopped, apply
     * @param  {L.MouseEvent} evt
     */
    _onDragEnd: function(t) {
      var e = this._path._map.mouseEventToContainerPoint(t), i = this.moved();
      if (i && (this._transformPoints(this._matrix), this._path._updatePath(), this._path._project(), this._path._transform(null), L.DomEvent.stop(t)), L.DomEvent.off(document, "mousemove touchmove", this._onDrag, this), L.DomEvent.off(document, "mouseup touchend", this._onDragEnd, this), this._restoreCoordGetters(), i) {
        this._path.fire("dragend", {
          distance: G(this._dragStartPoint, e)
        });
        var n = this._path._containsPoint;
        this._path._containsPoint = L.Util.falseFn, L.Util.requestAnimFrame(function() {
          L.DomEvent.skipped({ type: "click" }), this._path._containsPoint = n;
        }, this);
      }
      this._matrix = null, this._startPoint = null, this._dragStartPoint = null, this._path._dragMoved = !1, this._mapDraggingWasEnabled && (i && L.DomEvent.fakeStop({ type: "click" }), this._path._map.dragging.enable());
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
    _transformPoints: function(t, e) {
      var i = this._path, n, s, a, o = L.point(t[4], t[5]), r = i._map.options.crs, h = r.transformation, l = r.scale(i._map.getZoom()), p = r.projection, x = h.untransform(o, l).subtract(h.untransform(L.point(0, 0), l)), P = !e;
      if (i._bounds = new L.LatLngBounds(), i._point)
        e = p.unproject(
          p.project(i._latlng)._add(x)
        ), P && (i._latlng = e, i._point._add(o));
      else if (i._rings || i._parts) {
        var u = i._rings || i._parts, g = i._latlngs;
        for (e = e || g, L.Util.isArray(g[0]) || (g = [g], e = [e]), n = 0, s = u.length; n < s; n++) {
          e[n] = e[n] || [];
          for (var d = 0, b = u[n].length; d < b; d++)
            a = g[n][d], e[n][d] = p.unproject(p.project(a)._add(x)), P && (i._bounds.extend(g[n][d]), u[n][d]._add(o));
        }
      }
      return e;
    },
    /**
     * If you want to read the latlngs during the drag - your right,
     * but they have to be transformed
     */
    _replaceCoordGetters: function() {
      this._path.getLatLng ? (this._path.getLatLng_ = this._path.getLatLng, this._path.getLatLng = L.Util.bind(function() {
        return this.dragging._transformPoints(this.dragging._matrix, {});
      }, this._path)) : this._path.getLatLngs && (this._path.getLatLngs_ = this._path.getLatLngs, this._path.getLatLngs = L.Util.bind(function() {
        return this.dragging._transformPoints(this.dragging._matrix, []);
      }, this._path));
    },
    /**
     * Put back the getters
     */
    _restoreCoordGetters: function() {
      this._path.getLatLng_ ? (this._path.getLatLng = this._path.getLatLng_, delete this._path.getLatLng_) : this._path.getLatLngs_ && (this._path.getLatLngs = this._path.getLatLngs_, delete this._path.getLatLngs_);
    }
  }
);
L.Handler.PathDrag.makeDraggable = function(t) {
  return t.dragging = new L.Handler.PathDrag(t), t;
};
L.Path.prototype.makeDraggable = function() {
  return L.Handler.PathDrag.makeDraggable(this);
};
L.Path.addInitHook(function() {
  this.options.draggable ? (this.options.interactive = !0, this.dragging ? this.dragging.enable() : (L.Handler.PathDrag.makeDraggable(this), this.dragging.enable())) : this.dragging && this.dragging.disable();
});
L.Path.Drag;
const M = _.extend({
  options: {
    textStyle: {
      color: "#fff",
      fontSize: 12,
      fontWeight: 300
    },
    shiftY: 7
  },
  initialize(t, e, i) {
    this._text = t, this._textElement = null, this._textNode = null, this._textLayer = null, _.prototype.initialize.call(this, e, i);
  },
  setText(t) {
    return this._text = t, this._textNode && this._textElement.removeChild(this._textNode), this._textNode = document.createTextNode(this._text), this._textElement.appendChild(this._textNode), this;
  },
  getText() {
    return this._text;
  },
  /**
   * Also bring text to front
   * @override
   */
  bringToFront() {
    return _.prototype.bringToFront.call(this), this._groupTextToPath(), this;
  },
  /**
   * @override
   */
  bringToBack() {
    return _.prototype.bringToBack.call(this), this._groupTextToPath(), this;
  },
  /**
   * Put text in the right position in the dom
   */
  _groupTextToPath() {
    const t = this._path, e = this._textElement, i = t.nextSibling, n = t.parentNode;
    e && n && (n.insertAfter ? n.insertAfter(t, e) : n.insertBefore(e, i));
  },
  /**
   * Position the text in container
   */
  _updatePath() {
    _.prototype._updatePath.call(this), this._updateTextPosition();
  },
  /**
   * @override
   */
  _transform(t) {
    _.prototype._transform.call(this, t), this._textLayer = this._textLayer || { _path: this._textElement }, t ? this._renderer.transformPath(this._textLayer, t) : (this._renderer._resetTransformPath(this._textLayer), this._updateTextPosition(), this._textLayer = null);
  },
  /**
   * @param  {L.Map} map
   * @return {LabeledCircle}
   */
  onAdd(t) {
    return _.prototype.onAdd.call(this, t), this._initText(), this._updateTextPosition(), this.setStyle({}), this;
  },
  /**
   * Create and insert text
   */
  _initText() {
    this._textElement = y.create("text"), this.setText(this._text), this._renderer._rootGroup.appendChild(this._textElement);
  },
  /**
   * Calculate position for text
   */
  _updateTextPosition() {
    const t = this._textElement;
    if (t) {
      const e = t.getBBox({ stroke: !0, markers: !0 }), i = this._point.subtract(
        D(e.width, -e.height + this.options.shiftY).divideBy(2)
      );
      t.setAttribute("x", i.x), t.setAttribute("y", i.y), this._groupTextToPath();
    }
  },
  /**
   * Set text style
   */
  setStyle(t) {
    if (_.prototype.setStyle.call(this, t), this._textElement) {
      const e = this.options.textStyle;
      for (let i in e)
        if (e.hasOwnProperty(i)) {
          let n = i;
          i === "color" && (n = "stroke"), this._textElement.style[n] = e[i];
        }
    }
  },
  /**
   * Remove text
   */
  onRemove(t) {
    return this._textElement && (this._textElement.parentNode && this._textElement.parentNode.removeChild(this._textElement), this._textElement = null, this._textNode = null, this._textLayer = null), _.prototype.onRemove.call(this, t);
  }
}), c = k.extend({
  options: {
    /**
     * @param  {LabeledCircleMarker} marker
     * @param  {Object}        feature
     * @return {String}
     */
    getLabelText: (t, e) => e.properties.text,
    /**
     * @param  {LabeledCircleMarker} marker
     * @param  {Object}        feature
     * @param  {L.LatLng}      latlng
     * @return {L.LatLng}
     */
    getLabelPosition: (t, e, i) => {
      if (e.properties.labelPosition) {
        const n = e.properties.labelPosition.slice().reverse();
        return E(n);
      }
      return i;
    },
    labelPositionKey: "labelPosition",
    markerOptions: {
      color: "#f00",
      fillOpacity: 0.75,
      draggable: !0,
      radius: 15
    },
    anchorOptions: {
      color: "#00f",
      radius: 3
    },
    lineOptions: {
      color: "#f00",
      dashArray: [2, 6],
      lineCap: "square",
      weight: 2
    }
  },
  /**
   * @class LabeledCircleMarker
   * @constructor
   * @extends {L.FeatureGroup}
   *
   * @param  {L.LatLng} latlng
   * @param  {Object=}  feature
   * @param  {Object=}  options
   */
  initialize(t, e, i) {
    m.setOptions(this, i), this.feature = e || {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Point"
      }
    }, this._latlng = t, this._marker = null, this._anchor = null, this._line = null, this._initialDistance = null, this._createLayers(), T.prototype.initialize.call(this, [
      this._anchor,
      this._line,
      this._marker
    ]);
  },
  getLabelPosition() {
    return this._marker.getLatLng();
  },
  getLatLng() {
    return this._latlng;
  },
  /** Serialize */
  toGeoJSON(t) {
    const e = f.getFeature(this, {
      type: "Point",
      coordinates: f.latLngToCoords(this._anchor.getLatLng())
    });
    return e.properties[this.options.labelPositionKey] = f.latLngToCoords(
      this._marker.getLatLng()
    ), e.properties.text = this._marker.getText(), t ? F(e, this.options.labelPositionKey) : e;
  },
  setText(t) {
    return this._marker.setText(t), this;
  },
  /**
   * Creates anchor, line and label
   */
  _createLayers() {
    const t = this.options, e = t.getLabelPosition(this, this.feature, this._latlng), i = t.getLabelText(this, this.feature);
    "draggable" in t && (t.markerOptions.draggable = t.draggable), this._marker = new M(i, e, {
      interactive: this.options.interactive,
      ...c.prototype.options.markerOptions,
      ...t.markerOptions
    }).on("drag", this._onMarkerDrag, this).on("dragstart", this._onMarkerDragStart, this).on("dragend", this._onMarkerDragEnd, this), this._anchor = new _(
      this._latlng,
      m.extend(
        {},
        c.prototype.options.anchorOptions,
        t.anchorOptions
      )
    ), this._line = new C(
      [this._latlng, this._marker.getLatLng()],
      m.extend(
        {},
        c.prototype.options.lineOptions,
        t.lineOptions
      )
    );
  },
  /**
   * Store shift to be precise while dragging
   * @param  {Event} evt
   */
  _onMarkerDragStart(t) {
    this._initialDistance = v.getMousePosition(t).subtract(
      this._map.latLngToContainerPoint(this._marker.getLatLng())
    ), this.fire("label:" + t.type, t);
  },
  /**
   * Line dragging
   * @param  {DragEvent} evt
   */
  _onMarkerDrag(t) {
    const e = this._map.containerPointToLatLng(
      // @ts-expect-error
      v.getMousePosition(t)._subtract(this._initialDistance)
    );
    this._line.setLatLngs([e, this._latlng]), this.fire("label:" + t.type, t);
  },
  _onMarkerDragEnd(t) {
    this._line.setLatLngs([this._marker.getLatLng(), this._latlng]), this.fire("label:" + t.type, t);
  },
  enableDragging() {
    return this._marker.dragging && this._marker.dragging.enable(), this;
  },
  disableDragging() {
    return this._marker.dragging && this._marker.dragging.disable(), this;
  }
});
function F(t, e) {
  e = e || "labelPosition";
  const i = t.geometry.coordinates.slice();
  let n = t.properties[e];
  if (!n)
    throw new Error("No label position set");
  n = n.slice();
  const s = [
    {
      type: "Point",
      coordinates: i
    },
    {
      type: "LineString",
      coordinates: [i.slice(), n]
    },
    {
      type: "Point",
      coordinates: n.slice()
    },
    {
      type: "Point",
      coordinates: n.slice()
    }
  ];
  return {
    type: "Feature",
    properties: {
      ...t.properties,
      geometriesTypes: ["anchor", "connection", "label", "textbox"]
    },
    bbox: t.bbox,
    geometry: {
      type: "GeometryCollection",
      geometries: s
    }
  };
}
const O = (t, e, i) => new c(t, e, i);
export {
  c as LabeledCircleMarker,
  O as labeledCircleMarker
};
