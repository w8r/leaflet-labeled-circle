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
    getLabelText: function(marker, feature) {
      return feature.properties.text;
    },

    /**
     * @param  {LabeledMarker} marker
     * @param  {Object}        feature
     * @param  {L.LatLng}      latlng
     * @return {L.LatLng}
     */
    getLabelPosition: function(marker, feature, latlng) {
      return feature.properties.labelPosition ?
        L.latLng(feature.properties.labelPosition.slice().reverse()) :
        latlng;
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
  initialize: function(latlng, feature, options) {
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
    L.LayerGroup.prototype.initialize.call(this,
      [this._anchor, this._line, this._marker]);
  },


  /**
   * @return {L.LatLng}
   */
  getLabelPosition: function() {
    return this._marker.getLatLng();
  },


  /**
   * @return {L.LatLng}
   */
  getLatLng: function() {
    return this._latlng;
  },


  /**
   * Serialize
   * @return {Object}
   */
  toGeoJSON: function(geometryCollection) {
    var feature = L.GeoJSON.getFeature(this, {
      type: 'Point',
      coordinates: L.GeoJSON.latLngToCoords(this._anchor.getLatLng())
    });
    feature.properties[this.options.labelPositionKey] =
      L.GeoJSON.latLngToCoords(this._marker.getLatLng());
    return geometryCollection ?
      L.LabeledCircleMarker.toGeometryCollection(feature, this.options.labelPositionKey) : feature;
  },


  /**
   * @param {String} text
   * @return {LabeledMarker}
   */
  setText: function(text) {
    this._marker.setText(text);
    return this;
  },


  /**
   * Creates anchor, line and label
   */
  _createLayers: function() {
    var opts = this.options;
    var pos  = opts.getLabelPosition(this, this.feature, this._latlng);
    var text = opts.getLabelText(this, this.feature);

    this._marker = new Circle(text, pos,
      L.Util.extend({
        interactive: this.options.interactive
      },
        LabeledMarker.prototype.options.markerOptions,
        opts.markerOptions)
    ).on('drag',      this._onMarkerDrag,      this)
     .on('dragstart', this._onMarkerDragStart, this)
     .on('dragend',   this._onMarkerDragEnd,   this);

    this._anchor = new L.CircleMarker(this._latlng,
      L.Util.extend({}, LabeledMarker.prototype.options.anchorOptions,
        opts.anchorOptions));

    this._line = new L.Polyline([this._latlng, this._marker.getLatLng()],
      L.Util.extend({}, LabeledMarker.prototype.options.lineOptions,
        opts.lineOptions));
  },


  /**
   * Store shift to be precise while dragging
   * @param  {Event} evt
   */
  _onMarkerDragStart: function(evt) {
    this._initialDistance = L.DomEvent.getMousePosition(evt)
      .subtract(this._map.latLngToContainerPoint(this._marker.getLatLng()));
    this.fire('label:' + evt.type, evt);
    //L.Util.requestAnimFrame(this._marker.bringToFront, this._marker);
  },


  /**
   * Line dragging
   * @param  {DragEvent} evt
   */
  _onMarkerDrag: function(evt) {
    var latlng = this._map.containerPointToLatLng(
      L.DomEvent.getMousePosition(evt)._subtract(this._initialDistance));
    this._line.setLatLngs([latlng, this._latlng]);
    this.fire('label:' + evt.type, evt);
  },


  _onMarkerDragEnd: function(evt) {
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
  var labelPos  = feature.properties[key];

  if (!labelPos) throw new Error('No label position set');

  labelPos = labelPos.slice();
  var geometries = [{
    type: 'Point',
    coordinates: anchorPos
  }, {
    type: 'LineString',
    coordinates: [
      anchorPos.slice(),
      labelPos
    ]
  }, {
    type: 'Point',
    coordinates: labelPos.slice()
  }];

  return {
    type: 'Feature',
    properties: feature.properties,
    bbox: feature.bbox,
    geometry: {
      type: 'GeometryCollection',
      geometries: geometries
    }
  };
}

LabeledMarker.toGeometryCollection = toGeometryCollection;

module.exports = L.LabeledCircleMarker = LabeledMarker;
L.labeledCircleMarker = function(latlng, feature, options) {
  return new LabeledMarker(latlng, feature, options);
};
