import { CircleMarkerOptions, FeatureGroup, PathOptions, type LatLng, LatLngTuple } from "leaflet";
import { Feature, Geometry, GeometryCollection } from "geojson";
import "leaflet-path-drag";
interface LabeledCircleMarkerClass extends FeatureGroup {
    toGeometryCollection: <P>(feature: Feature<AllowedGeometries, P>, key: string) => Feature<GeometryCollection, P>;
}
export interface LabeledCircleMarkerOptions extends CircleMarkerOptions {
    getLabelText: (marker: LabeledCircleMarkerClass, feature: Feature<Geometry>) => string;
    getLabelPosition: (marker: LabeledCircleMarkerClass, feature: Feature<Geometry, {
        labelPosition?: LatLngTuple;
    }>, latlng: LatLng) => LatLng;
    labelPositionKey: string;
    markerOptions: CircleMarkerOptions;
    anchorOptions: CircleMarkerOptions;
    lineOptions: PathOptions;
}
export declare const LabeledCircleMarker: new (latlng: LatLng | LatLngTuple, feature: Feature<Geometry>, options: Partial<LabeledCircleMarkerOptions>) => LabeledCircleMarkerClass;
type AllowedGeometries = Exclude<Geometry, GeometryCollection<Geometry>>;
/**
 * @param  {Object} feature
 * @param  {String=} key
 * @return {Object}
 */
export declare function toGeometryCollection<P>(feature: Feature<AllowedGeometries, P>, key: string): Feature<GeometryCollection, P>;
export declare const labeledCircleMarker: (latlng: LatLng, feature: Feature<Geometry>, options: LabeledCircleMarkerOptions) => LabeledCircleMarkerClass;
export {};
