import { CircleMarker, type LatLng, CircleMarkerOptions } from "leaflet";
import "leaflet-path-drag";
type RGB = `rgb(${number}, ${number}, ${number})`;
type RGBA = `rgba(${number}, ${number}, ${number}, ${number})`;
type HEX = `#${string}`;
type Color = RGB | RGBA | HEX | string;
interface TextStyle {
    color: Color;
    fontSize: number;
    fontWeight: "normal" | "bold" | "bolder" | "lighter" | 900 | 800 | 700 | 600 | 500 | 400 | 300 | 200 | 100;
}
export interface LabeledCircleMarkerOptions extends CircleMarkerOptions {
    textStyle?: Partial<TextStyle>;
    shiftY?: number;
}
interface CircleClass extends CircleMarker {
}
export declare const Circle: new (text: string, latlng: LatLng, options: LabeledCircleMarkerOptions) => CircleClass;
export declare const textCircle: (text: string, latlng: LatLng, options: LabeledCircleMarkerOptions) => CircleClass;
export {};
