import {
  CircleMarkerOptions,
  FeatureGroup,
  PathOptions,
  latLng,
  DomEvent,
  Polyline,
  GeoJSON,
  Util,
  LayerGroup,
  type LatLng,
  CircleMarker,
  LatLngTuple,
} from "leaflet";
import {
  Feature,
  Geometry,
  LineString,
  GeometryCollection,
  Point as GeoJSONPoint,
} from "geojson";
import { Circle } from "./circle";
import "leaflet-path-drag";

interface LabeledCircleMarkerClass extends FeatureGroup {
  toGeometryCollection: <P>(
    feature: Feature<AllowedGeometries, P>,
    key: string
  ) => Feature<GeometryCollection, P>;
}

export interface LabeledCircleMarkerOptions extends CircleMarkerOptions {
  getLabelText: (
    marker: LabeledCircleMarkerClass,
    feature: Feature<Geometry>
  ) => string;
  getLabelPosition: (
    marker: LabeledCircleMarkerClass,
    feature: Feature<Geometry, { labelPosition?: LatLngTuple }>,
    latlng: LatLng
  ) => LatLng;
  labelPositionKey: string;
  markerOptions: CircleMarkerOptions;
  anchorOptions: CircleMarkerOptions;
  lineOptions: PathOptions;
}

export const LabeledCircleMarker: new (
  latlng: LatLng | LatLngTuple,
  feature: Feature<Geometry>,
  options: Partial<LabeledCircleMarkerOptions>
) => LabeledCircleMarkerClass = FeatureGroup.extend({
  options: {
    /**
     * @param  {LabeledCircleMarker} marker
     * @param  {Object}        feature
     * @return {String}
     */
    getLabelText: (_, feature) => feature.properties!.text,

    /**
     * @param  {LabeledCircleMarker} marker
     * @param  {Object}        feature
     * @param  {L.LatLng}      latlng
     * @return {L.LatLng}
     */
    getLabelPosition: (
      _,
      feature: Feature<Geometry, { labelPosition?: LatLngTuple }>,
      latlng: LatLng
    ) => {
      if (feature.properties.labelPosition) {
        const position = feature.properties
          .labelPosition!.slice()
          .reverse() as [number, number];
        return latLng(position);
      }
      return latlng;
    },

    labelPositionKey: "labelPosition",

    markerOptions: {
      color: "#f00",
      fillOpacity: 0.75,
      draggable: true,
      radius: 15,
    },

    anchorOptions: {
      color: "#00f",
      radius: 3,
    },

    lineOptions: {
      color: "#f00",
      dashArray: [2, 6],
      lineCap: "square",
      weight: 2,
    },
  } as LabeledCircleMarkerOptions,

  /**
   * @class LabeledCircleMarker
   * @constructor
   * @extends {L.FeatureGroup}
   *
   * @param  {L.LatLng} latlng
   * @param  {Object=}  feature
   * @param  {Object=}  options
   */
  initialize(
    latlng: LatLng,
    feature: Feature<Geometry>,
    options: LabeledCircleMarkerOptions
  ) {
    Util.setOptions(this, options);

    /**
     * @type {Object}
     */
    this.feature = feature || {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Point",
      },
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
    // @ts-expect-error
    LayerGroup.prototype.initialize.call(this, [
      this._anchor,
      this._line,
      this._marker,
    ]);
  },

  getLabelPosition() {
    return this._marker.getLatLng();
  },

  getLatLng() {
    return this._latlng;
  },

  /** Serialize */
  toGeoJSON(geometryCollection: GeometryCollection) {
    const feature = GeoJSON.getFeature(this, {
      type: "Point",
      coordinates: GeoJSON.latLngToCoords(this._anchor.getLatLng()),
    });
    feature.properties[this.options.labelPositionKey] = GeoJSON.latLngToCoords(
      this._marker.getLatLng()
    );
    feature.properties.text = this._marker.getText();
    return geometryCollection
      ? toGeometryCollection(feature, this.options.labelPositionKey)
      : feature;
  },

  setText(text: string) {
    this._marker.setText(text);
    return this;
  },

  /**
   * Creates anchor, line and label
   */
  _createLayers() {
    const opts = this.options;
    const pos = opts.getLabelPosition(this, this.feature, this._latlng);
    const text = opts.getLabelText(this, this.feature);

    if ("draggable" in opts) {
      opts.markerOptions.draggable = opts.draggable;
    }

    this._marker = new Circle(text, pos, {
      interactive: this.options.interactive,
      ...LabeledCircleMarker.prototype.options.markerOptions,
      ...opts.markerOptions,
    })
      .on("drag", this._onMarkerDrag, this)
      .on("dragstart", this._onMarkerDragStart, this)
      .on("dragend", this._onMarkerDragEnd, this);

    this._anchor = new CircleMarker(
      this._latlng,
      Util.extend(
        {},
        LabeledCircleMarker.prototype.options.anchorOptions,
        opts.anchorOptions
      )
    );

    this._line = new Polyline(
      [this._latlng, this._marker.getLatLng()],
      Util.extend(
        {},
        LabeledCircleMarker.prototype.options.lineOptions,
        opts.lineOptions
      )
    );
  },

  /**
   * Store shift to be precise while dragging
   * @param  {Event} evt
   */
  _onMarkerDragStart(evt: MouseEvent) {
    this._initialDistance = DomEvent.getMousePosition(evt).subtract(
      this._map.latLngToContainerPoint(this._marker.getLatLng())
    );
    this.fire("label:" + evt.type, evt);
    //L.Util.requestAnimFrame(this._marker.bringToFront, this._marker);
  },

  /**
   * Line dragging
   * @param  {DragEvent} evt
   */
  _onMarkerDrag(evt: MouseEvent) {
    const latlng = this._map.containerPointToLatLng(
      // @ts-expect-error
      DomEvent.getMousePosition(evt)._subtract(this._initialDistance)
    );
    this._line.setLatLngs([latlng, this._latlng]);
    this.fire("label:" + evt.type, evt);
  },

  _onMarkerDragEnd(evt: MouseEvent) {
    this._line.setLatLngs([this._marker.getLatLng(), this._latlng]);
    this.fire("label:" + evt.type, evt);
  },

  enableDragging() {
    if (this._marker.dragging) this._marker.dragging.enable();
    return this;
  },

  disableDragging() {
    if (this._marker.dragging) this._marker.dragging.disable();
    return this;
  },
});

type AllowedGeometries = Exclude<Geometry, GeometryCollection<Geometry>>;

/**
 * @param  {Object} feature
 * @param  {String=} key
 * @return {Object}
 */
export function toGeometryCollection<P>(
  feature: Feature<AllowedGeometries, P>,
  key: string
): Feature<GeometryCollection, P> {
  key = key || "labelPosition";
  const anchorPos = feature.geometry.coordinates.slice();
  // @ts-expect-error
  let labelPos = feature.properties[key];

  if (!labelPos) throw new Error("No label position set");

  labelPos = labelPos.slice();
  const geometries = [
    {
      type: "Point",
      coordinates: anchorPos,
    } as GeoJSONPoint,
    {
      type: "LineString",
      coordinates: [anchorPos.slice(), labelPos],
    } as LineString,
    {
      type: "Point",
      coordinates: labelPos.slice(),
    } as GeoJSONPoint,
    {
      type: "Point",
      coordinates: labelPos.slice(),
    } as GeoJSONPoint,
  ];

  return {
    type: "Feature",
    properties: {
      ...feature.properties,
      geometriesTypes: ["anchor", "connection", "label", "textbox"],
    },
    bbox: feature.bbox,
    geometry: {
      type: "GeometryCollection",
      geometries: geometries,
    },
  };
}

export const labeledCircleMarker = (
  latlng: LatLng,
  feature: Feature<Geometry>,
  options: LabeledCircleMarkerOptions
) => new LabeledCircleMarker(latlng, feature, options);
