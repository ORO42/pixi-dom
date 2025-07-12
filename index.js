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
  /**
   * @param {number} x - The initial X position in the world.
   * @param {number} y - The initial Y position in the world.
   * @param {string} text - The initial text content.
   * @param {PannableCanvas} canvas - The parent canvas controller.
   */
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
    document.body.appendChild(this.domElement);
  }

  /** Creates the red anchor marker in the pixi world. */
  _setupAnchor() {
    this.anchorMarker = new Graphics();
    this.anchorMarker.circle(0, 0, 5).fill(0xe74c3c);
    this.anchorMarker.position.copyFrom(this.worldPosition);
    this.canvas.worldContainer.addChild(this.anchorMarker);
  }

  /** Attaches mousedown listener to handle dragging. */
  _attachEventListeners() {
    let isDragging = false;

    const onDragMove = (event) => {
      if (isDragging) {
        const screenPoint = new Point(event.clientX, event.clientY);
        const mouseWorldPos = this.canvas.worldContainer.toLocal(screenPoint);

        this.worldPosition.set(
          mouseWorldPos.x - this.dragOffset.x,
          mouseWorldPos.y - this.dragOffset.y
        );
        this.anchorMarker.position.copyFrom(this.worldPosition);
      }
    };

    const onDragEnd = () => {
      isDragging = false;
      // Re-enable text selection on the page
      document.body.style.userSelect = "";

      window.removeEventListener("mousemove", onDragMove);
      window.removeEventListener("mouseup", onDragEnd);
    };

    this.domElement.addEventListener("mousedown", (event) => {
      event.stopPropagation();
      isDragging = true;

      // Disable text selection on the entire page to prevent highlighting
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

  /**
   * Called by the main canvas ticker to update the screen position.
   */
  update() {
    const screenPos = this.canvas.worldContainer.toGlobal(this.worldPosition);

    this.domElement.style.left = `${screenPos.x}px`;
    this.domElement.style.top = `${screenPos.y}px`;

    this.domElement.innerText = `World X: ${Math.round(
      this.worldPosition.x
    )}, Y: ${Math.round(this.worldPosition.y)}`;
  }

  /** Clean up resources. */
  destroy() {
    document.body.removeChild(this.domElement);
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

    // Panning state
    this.isPanning = false;
    this.isSpacebarDown = false;
    this.lastPosition = new Point();
  }

  /** Initializes the pixi app and sets up all event listeners. */
  async init() {
    await this.app.init({ background: "#fff", resizeTo: window });
    this.domTarget.appendChild(this.app.canvas);
    this.app.stage.addChild(this.worldContainer);

    this._setupPanning();
    this._startTicker();
  }

  /** Attaches all listeners required for panning the world container. */
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

  /** Starts the main animation loop. */
  _startTicker() {
    this.app.ticker.add(() => {
      // On every frame, tell each node to update its position
      for (const node of this.nodes) {
        node.update();
      }
    });
  }

  /** Helper to manage cursor style changes. */
  _updateCursor() {
    if (this.isPanning) this.app.canvas.style.cursor = "grabbing";
    else if (this.isSpacebarDown) this.app.canvas.style.cursor = "grab";
    else this.app.canvas.style.cursor = "default";
  }

  /** Factory method to create and add a new DraggableNode. */
  createNode(x, y, text) {
    const node = new DraggableNode(x, y, text, this);
    this.nodes.push(node);
    return node;
  }

  /** Adds any pixi DisplayObject to the pannable world. */
  add(pixiObject) {
    this.worldContainer.addChild(pixiObject);
  }
}

// --- Main execution ---
(async () => {
  // Create main canvas controller
  const canvas = new PannableCanvas(document.body);
  await canvas.init();

  // Add pixi origin marker
  const circle = new Graphics().circle(0, 0, 10).fill(0x3498db);
  canvas.add(circle);

  // Create and add nodes
  canvas.createNode(100, 75, "Node A");
  canvas.createNode(-50, 150, "Node B");
  canvas.createNode(200, 250, "Another Node");
})();
