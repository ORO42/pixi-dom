import {
  Application,
  Graphics,
  Container,
  Point,
} from "./node_modules/pixi.js/dist/pixi.mjs";

/**
 * Represents a single draggable DOM element linked to a position in the pixi world.
 */
class DraggableNode {
  constructor(x, y, text, canvas) {
    this.canvas = canvas;
    this.worldPosition = new Point(x, y);
    this.dragOffset = new Point();

    this._setupDOM(text);
    this._setupAnchor();
    this._attachEventListeners();
  }

  /** Creates and styles the HTML element. */
  _setupDOM(text) {
    this.domElement = document.createElement("div");
    this.domElement.innerText = text;
    this.domElement.style.position = "absolute";
    this.domElement.style.background = "rgba(238, 238, 238, 0.9)";
    this.domElement.style.padding = "8px 12px";
    this.domElement.style.borderRadius = "4px";
    this.domElement.style.fontFamily = "monospace";
    this.domElement.style.cursor = "move";
    this.domElement.style.zIndex = "1000";
    // Allow this element to receive mouse events
    this.domElement.style.pointerEvents = "auto";
    // Append to the canvas's dedicated DOM container, not the body
    this.canvas.domContainer.appendChild(this.domElement);
  }

  /** Creates the red anchor marker in the pixi world. */
  _setupAnchor() {
    this.anchorMarker = new Graphics();
    this.anchorMarker.circle(0, 0, 5).fill(0xe74c3c);
    this.anchorMarker.position.copyFrom(this.worldPosition);
    this.canvas.worldContainer.addChild(this.anchorMarker);
  }

  _attachEventListeners() {
    let isDragging = false;

    const onDragMove = (event) => {
      if (!isDragging) return;

      const mouseWorldPos = this.canvas.worldContainer.toLocal(
        new Point(event.clientX, event.clientY)
      );

      const proposedWorldPos = new Point(
        mouseWorldPos.x - this.dragOffset.x,
        mouseWorldPos.y - this.dragOffset.y
      );

      const proposedScreenPos =
        this.canvas.worldContainer.toGlobal(proposedWorldPos);
      const nodeWidth = this.domElement.clientWidth;
      const nodeHeight = this.domElement.clientHeight;
      const canvasBounds = this.canvas.app.screen;
      const clampedScreenX = Math.max(
        canvasBounds.x,
        Math.min(proposedScreenPos.x, canvasBounds.width - nodeWidth)
      );

      const clampedScreenY = Math.max(
        canvasBounds.y,
        Math.min(proposedScreenPos.y, canvasBounds.height - nodeHeight)
      );

      const clampedScreenPoint = new Point(clampedScreenX, clampedScreenY);

      const finalWorldPos =
        this.canvas.worldContainer.toLocal(clampedScreenPoint);
      this.worldPosition.copyFrom(finalWorldPos);
      this.anchorMarker.position.copyFrom(this.worldPosition);
    };

    const onDragEnd = () => {
      isDragging = false;
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onDragMove);
      window.removeEventListener("mouseup", onDragEnd);
    };

    this.domElement.addEventListener("mousedown", (event) => {
      event.stopPropagation();
      isDragging = true;
      document.body.style.userSelect = "none";
      const mouseScreenPos = new Point(event.clientX, event.clientY);
      const mouseWorldPos = this.canvas.worldContainer.toLocal(mouseScreenPos);
      this.dragOffset.set(
        mouseWorldPos.x - this.worldPosition.x,
        mouseWorldPos.y - this.worldPosition.y
      );
      window.addEventListener("mousemove", onDragMove);
      window.addEventListener("mouseup", onDragEnd);
    });
  }

  update() {
    // Position relative to the clipping container, not the whole screen
    const screenPos = this.canvas.worldContainer.toGlobal(this.worldPosition);
    const containerRect = this.canvas.domContainer.getBoundingClientRect();

    this.domElement.style.left = `${screenPos.x - containerRect.left}px`;
    this.domElement.style.top = `${screenPos.y - containerRect.top}px`;

    this.domElement.innerText = `World X: ${Math.round(
      this.worldPosition.x
    )}, Y: ${Math.round(this.worldPosition.y)}`;
  }

  destroy() {
    this.canvas.domContainer.removeChild(this.domElement);
    this.canvas.worldContainer.removeChild(this.anchorMarker);
  }
}

/**
 * Manages the main pixi application, the pannable container, and all nodes.
 */
class PannableCanvas {
  constructor(domTarget) {
    this.domTarget = domTarget;
    this.app = new Application();
    this.worldContainer = new Container();
    this.nodes = [];

    // Container for all DOM nodes
    this.domContainer = document.createElement("div");

    this.isPanning = false;
    this.isSpacebarDown = false;
    this.lastPosition = new Point();
  }

  async init() {
    // await this.app.init({ background: "#fff", resizeTo: window });
    await this.app.init({ background: "#fff", width: 600, height: 700 });
    this.app.canvas.style.border = "2px solid #333";
    this.domTarget.appendChild(this.app.canvas);

    this._setupDOMContainer();
    this.domTarget.appendChild(this.domContainer);

    this.app.stage.addChild(this.worldContainer);
    this._setupPanning();
    this._startTicker();

    // Add a resize listener to keep the clipping container in sync
    window.addEventListener("resize", () => this._setupDOMContainer());
  }

  /** Sets up a container to hold all DOM nodes and clip them. */
  _setupDOMContainer() {
    const canvasEl = this.app.canvas;
    this.domContainer.style.position = "absolute";
    this.domContainer.style.left = `${canvasEl.offsetLeft}px`;
    this.domContainer.style.top = `${canvasEl.offsetTop}px`;
    this.domContainer.style.width = `${canvasEl.clientWidth}px`;
    this.domContainer.style.height = `${canvasEl.clientHeight}px`;
    this.domContainer.style.overflow = "hidden";
    // Lets mouse events pass through to the PIXI canvas below
    this.domContainer.style.pointerEvents = "none";
  }

  _setupPanning() {
    this.app.stage.eventMode = "static";
    this.app.stage.hitArea = this.app.screen;

    const stopPanning = () => {
      this.isPanning = false;
      this._updateCursor();
    };

    this.app.stage.on("pointerdown", (event) => {
      if (this.isSpacebarDown) {
        this.isPanning = true;
        this.lastPosition.copyFrom(event.global);
        this._updateCursor();
      }
    });

    this.app.stage.on("pointermove", (event) => {
      if (this.isPanning) {
        const dx = event.global.x - this.lastPosition.x;
        const dy = event.global.y - this.lastPosition.y;
        this.worldContainer.x += dx;
        this.worldContainer.y += dy;
        this.lastPosition.copyFrom(event.global);
      }
    });

    this.app.stage.on("pointerup", stopPanning);
    this.app.stage.on("pointerupoutside", stopPanning);

    window.addEventListener("keydown", (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (!this.isSpacebarDown) {
          this.isSpacebarDown = true;
          this._updateCursor();
        }
      }
    });

    window.addEventListener("keyup", (e) => {
      if (e.code === "Space") {
        this.isSpacebarDown = false;
        this._updateCursor();
      }
    });
  }

  _startTicker() {
    this.app.ticker.add(() => {
      for (const node of this.nodes) {
        node.update();
      }
    });
  }

  _updateCursor() {
    if (this.isPanning) this.app.canvas.style.cursor = "grabbing";
    else if (this.isSpacebarDown) this.app.canvas.style.cursor = "grab";
    else this.app.canvas.style.cursor = "default";
  }

  createNode(x, y, text) {
    const node = new DraggableNode(x, y, text, this);
    this.nodes.push(node);
    return node;
  }

  add(pixiObject) {
    this.worldContainer.addChild(pixiObject);
  }
}

(async () => {
  const canvas = new PannableCanvas(document.body);
  await canvas.init();
  const circle = new Graphics().circle(0, 0, 10).fill(0x3498db);
  canvas.add(circle);
  canvas.createNode(100, 75, "Node A");
  canvas.createNode(50, 150, "Node B");
  canvas.createNode(200, 250, "Another Node");
})();
