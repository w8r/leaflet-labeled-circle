import {
  CircleMarker,
  point,
  type LatLng,
  type Map,
  SVG,
  CircleMarkerOptions,
} from "leaflet";
import "leaflet-path-drag";

type RGB = `rgb(${number}, ${number}, ${number})`;
type RGBA = `rgba(${number}, ${number}, ${number}, ${number})`;
type HEX = `#${string}`;

type Color = RGB | RGBA | HEX | string;

interface TextStyle {
  color: Color;
  fontSize: number;
  fontWeight:
    | "normal"
    | "bold"
    | "bolder"
    | "lighter"
    | 900
    | 800
    | 700
    | 600
    | 500
    | 400
    | 300
    | 200
    | 100;
}

export interface LabeledCircleMarkerOptions extends CircleMarkerOptions {
  textStyle?: Partial<TextStyle>;
  shiftY?: number;
}

interface CircleClass extends CircleMarker {}

export const Circle: new (
  text: string,
  latlng: LatLng,
  options: LabeledCircleMarkerOptions
) => CircleClass = CircleMarker.extend({
  options: {
    textStyle: {
      color: "#fff",
      fontSize: 12,
      fontWeight: 300,
    },
    shiftY: 7,
  },

  initialize(
    text: string,
    latlng: LatLng,
    options: LabeledCircleMarkerOptions
  ) {
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

    // @ts-expect-error
    CircleMarker.prototype.initialize.call(this, latlng, options);
  },

  setText(text: string) {
    this._text = text;
    if (this._textNode) {
      this._textElement.removeChild(this._textNode);
    }
    this._textNode = document.createTextNode(this._text);
    this._textElement.appendChild(this._textNode);

    return this;
  },

  getText() {
    return this._text;
  },

  /**
   * Also bring text to front
   * @override
   */
  bringToFront() {
    CircleMarker.prototype.bringToFront.call(this);
    this._groupTextToPath();
    return this;
  },

  /**
   * @override
   */
  bringToBack() {
    CircleMarker.prototype.bringToBack.call(this);
    this._groupTextToPath();
    return this;
  },

  /**
   * Put text in the right position in the dom
   */
  _groupTextToPath() {
    const path = this._path;
    const textElement = this._textElement;
    const next = path.nextSibling;
    const parent = path.parentNode;

    if (textElement && parent) {
      if (parent.insertAfter) {
        parent.insertAfter(path, textElement);
      } else {
        parent.insertBefore(textElement, next);
      }
    }
  },

  /**
   * Position the text in container
   */
  _updatePath() {
    // @ts-expect-error
    CircleMarker.prototype._updatePath.call(this);
    this._updateTextPosition();
  },

  /**
   * @override
   */
  _transform(matrix: [number, number, number, number, number, number]) {
    // @ts-expect-error
    CircleMarker.prototype._transform.call(this, matrix);

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
  onAdd(map: Map) {
    CircleMarker.prototype.onAdd.call(this, map);
    this._initText();
    this._updateTextPosition();
    this.setStyle({});
    return this;
  },

  /**
   * Create and insert text
   */
  _initText() {
    this._textElement = SVG.create("text");
    this.setText(this._text);
    this._renderer._rootGroup.appendChild(this._textElement);
  },

  /**
   * Calculate position for text
   */
  _updateTextPosition() {
    const textElement = this._textElement;
    if (textElement) {
      const bbox = textElement.getBBox({ stroke: true, markers: true });
      const textPosition = this._point.subtract(
        point(bbox.width, -bbox.height + this.options.shiftY).divideBy(2)
      );

      textElement.setAttribute("x", textPosition.x);
      textElement.setAttribute("y", textPosition.y);
      this._groupTextToPath();
    }
  },

  /**
   * Set text style
   */
  setStyle(style: TextStyle) {
    CircleMarker.prototype.setStyle.call(this, style);
    if (this._textElement) {
      const styles = this.options.textStyle;
      for (let prop in styles) {
        if (styles.hasOwnProperty(prop)) {
          let styleProp = prop;
          if (prop === "color") {
            styleProp = "stroke";
          }
          this._textElement.style[styleProp] = styles[prop];
        }
      }
    }
  },

  /**
   * Remove text
   */
  onRemove(map: Map) {
    if (this._textElement) {
      if (this._textElement.parentNode) {
        this._textElement.parentNode.removeChild(this._textElement);
      }
      this._textElement = null;
      this._textNode = null;
      this._textLayer = null;
    }

    return CircleMarker.prototype.onRemove.call(this, map);
  },
});

export const textCircle = (
  text: string,
  latlng: LatLng,
  options: LabeledCircleMarkerOptions
) => new Circle(text, latlng, options);
