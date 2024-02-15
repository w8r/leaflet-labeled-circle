import * as L from "leaflet";
import { LabeledCircleMarker } from "./index";

const map = new L.Map("map", {}).setView([22.42658, 114.1952], 10);

L.tileLayer("http://{s}.tile.osm.org/{z}/{x}/{y}.png", {
  attribution:
    "&copy; " + '<a href="http://osm.org/copyright">OSM</a> contributors',
}).addTo(map);

const pos1 = [114.1952, 22.42658];
// @ts-expect-error
const marker1 = new LabeledCircleMarker(
  pos1.slice().reverse() as L.LatLngTuple,
  {
    type: "Feature",
    properties: {
      text: "yolo",
      labelPosition: [114.29819682617189, 22.477347822506356],
    },
    geometry: {
      type: "Point",
      coordinates: pos1,
    },
  },
  {
    markerOptions: { color: "#050" },
    interactive: true,
  }
).addTo(map);

const pos2 = [114.14657592773438, 22.33927931468312];
// @ts-expect-error
const marker2 = new LabeledCircleMarker(
  pos2.slice().reverse() as L.LatLngTuple,
  {
    type: "Feature",
    properties: {
      text: 12,
      labelPosition: [113.89719584960939, 22.413885141186906],
    },
    geometry: {
      type: "Point",
      coordinates: pos2,
    },
  },
  {
    interactive: true,
  }
).addTo(map);

const pos3 = [114.12872314453125, 22.395157990290755];
// @ts-expect-error
const marker3 = new LabeledCircleMarker(
  pos3.slice().reverse() as L.LatLngTuple,
  {
    type: "Feature",
    properties: {
      text: 1,
      labelPosition: [114.39295390625001, 22.314825463263595],
    },
    geometry: {
      type: "Point",
      coordinates: [114.12872314453125, 22.395157990290755],
    },
  },
  {
    markerOptions: {
      color: "#007",
    },
  }
).addTo(map);
