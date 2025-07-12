import {
  Application,
  Graphics,
  Container,
  Point,
} from "./node_modules/pixi.js/dist/pixi.mjs";

/**
 * Represents a single draggable DOM element linked to a position in the Pixi.js world.
 * It consists of an HTML `div` for user interaction and a Pixi.js `Graphics` object
 * as a visual anchor in the world space.
 */
class DraggableNode {
  /**
   * Initializes a new node.
   * @param {number} x - The initial world x-coordinate.
   * @param {number} y - The initial world y-coordinate.
   * @param {string} text - The initial text content for the node.
   * @param {PannableCanvas} canvas - A reference to the main canvas controller.
   */
  constructor(x, y, text, canvas) {
    this.canvas = canvas;
    this.worldPosition = new Point(x, y);
    this.dragOffset = new Point(); // Stores the mouse offset within the node during a drag.

    this._setupDOM(text);
    this._setupAnchor();
    this._attachEventListeners();
  }

  /**
   * Creates and styles the HTML `div` element for the node.
   * It's appended to a special container to ensure it's positioned and
   * clipped correctly relative to the canvas.
   * @param {string} text - The text to display in the element.
   */
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
    // Allow this element (and not its container) to receive mouse events.
    this.domElement.style.pointerEvents = "auto";
    // Append to the canvas's dedicated DOM container, not the body.
    this.canvas.domContainer.appendChild(this.domElement);
  }

  /** Creates a visual marker (a red circle) in the Pixi world at the node's position. */
  _setupAnchor() {
    this.anchorMarker = new Graphics();
    this.anchorMarker.circle(0, 0, 5).fill(0xe74c3c);
    this.anchorMarker.position.copyFrom(this.worldPosition);
    this.canvas.worldContainer.addChild(this.anchorMarker);
  }

  /**
   * Sets up the mouse events to handle dragging.
   * This logic calculates the new world position based on mouse movement
   * and clamps it to ensure the node stays within the visible canvas area.
   */
  _attachEventListeners() {
    let isDragging = false;

    // Handles moving the node while the mouse button is down.
    const onDragMove = (event) => {
      if (!isDragging) return;

      // Convert mouse screen coordinates to Pixi world coordinates.
      const mouseWorldPos = this.canvas.worldContainer.toLocal(
        new Point(event.clientX, event.clientY)
      );

      // Calculate the proposed new world position.
      const proposedWorldPos = new Point(
        mouseWorldPos.x - this.dragOffset.x,
        mouseWorldPos.y - this.dragOffset.y
      );

      // --- Boundary Clamping Logic ---
      // Convert the proposed world position back to screen coordinates.
      const proposedScreenPos =
        this.canvas.worldContainer.toGlobal(proposedWorldPos);
      const nodeWidth = this.domElement.clientWidth;
      const nodeHeight = this.domElement.clientHeight;
      const canvasBounds = this.canvas.app.screen;

      // Clamp the screen coordinates to the canvas bounds.
      const clampedScreenX = Math.max(
        canvasBounds.x,
        Math.min(proposedScreenPos.x, canvasBounds.width - nodeWidth)
      );
      const clampedScreenY = Math.max(
        canvasBounds.y,
        Math.min(proposedScreenPos.y, canvasBounds.height - nodeHeight)
      );

      // Convert the final clamped screen point back to a world position.
      const finalWorldPos = this.canvas.worldContainer.toLocal(
        new Point(clampedScreenX, clampedScreenY)
      );

      // Update the node's position.
      this.worldPosition.copyFrom(finalWorldPos);
      this.anchorMarker.position.copyFrom(this.worldPosition);
    };

    // Cleans up drag-related event listeners and state.
    const onDragEnd = () => {
      isDragging = false;
      document.body.style.userSelect = ""; // Re-enable text selection.
      window.removeEventListener("mousemove", onDragMove);
      window.removeEventListener("mouseup", onDragEnd);
    };

    // Initiates a drag operation.
    this.domElement.addEventListener("mousedown", (event) => {
      event.stopPropagation(); // Prevent triggering canvas panning.
      isDragging = true;
      document.body.style.userSelect = "none"; // Prevent text selection during drag.

      // Calculate the initial offset between the mouse and the node's origin.
      const mouseScreenPos = new Point(event.clientX, event.clientY);
      const mouseWorldPos = this.canvas.worldContainer.toLocal(mouseScreenPos);
      this.dragOffset.set(
        mouseWorldPos.x - this.worldPosition.x,
        mouseWorldPos.y - this.worldPosition.y
      );

      // Listen for move and release events globally.
      window.addEventListener("mousemove", onDragMove);
      window.addEventListener("mouseup", onDragEnd);
    });
  }

  /**
   * Called every frame. Synchronizes the DOM element's screen position
   * with its underlying world position and updates its text content.
   */
  update() {
    // Convert the world position to a global (screen) position.
    const screenPos = this.canvas.worldContainer.toGlobal(this.worldPosition);

    // Position the DOM element relative to its clipping container.
    const containerRect = this.canvas.domContainer.getBoundingClientRect();
    this.domElement.style.left = `${screenPos.x - containerRect.left}px`;
    this.domElement.style.top = `${screenPos.y - containerRect.top}px`;

    // Update the text to show the current world coordinates.
    this.domElement.innerText = `World X: ${Math.round(
      this.worldPosition.x
    )}, Y: ${Math.round(this.worldPosition.y)}`;
  }

  /** Removes the node's DOM element and Pixi graphics from the scene. */
  destroy() {
    this.canvas.domContainer.removeChild(this.domElement);
    this.canvas.worldContainer.removeChild(this.anchorMarker);
  }
}

/**
 * Manages the main Pixi.js application, the pannable world container,
 * the DOM overlay, and all associated `DraggableNode` instances.
 */
class PannableCanvas {
  /**
   * Initializes the canvas manager.
   * @param {HTMLElement} domTarget - The element to append the canvas to.
   */
  constructor(domTarget) {
    this.domTarget = domTarget;
    this.app = new Application();
    this.worldContainer = new Container(); // The pannable container for all Pixi objects.
    this.nodes = [];

    // A dedicated container for all DOM nodes that overlays the canvas.
    this.domContainer = document.createElement("div");

    this.isPanning = false;
    this.isSpacebarDown = false;
    this.lastPosition = new Point(); // Last known mouse position for panning.
  }

  /** Asynchronously sets up the Pixi application and all necessary components. */
  async init() {
    await this.app.init({ background: "#fff", width: 600, height: 700 });
    this.app.canvas.style.border = "2px solid #333";
    this.domTarget.appendChild(this.app.canvas);

    this._setupDOMContainer();
    this.domTarget.appendChild(this.domContainer);

    this.app.stage.addChild(this.worldContainer);
    this._setupPanning();
    this._startTicker();

    // Re-align the DOM container if the window is resized.
    window.addEventListener("resize", () => this._setupDOMContainer());
  }

  /**
   * Creates an HTML container that perfectly overlays the Pixi canvas.
   * This container holds all the DOM-based nodes, ensuring they are clipped
   * by the canvas bounds. `pointer-events: none` allows mouse events to
   * "pass through" to the Pixi canvas below.
   */
  _setupDOMContainer() {
    const canvasEl = this.app.canvas;
    this.domContainer.style.position = "absolute";
    this.domContainer.style.left = `${canvasEl.offsetLeft}px`;
    this.domContainer.style.top = `${canvasEl.offsetTop}px`;
    this.domContainer.style.width = `${canvasEl.clientWidth}px`;
    this.domContainer.style.height = `${canvasEl.clientHeight}px`;
    this.domContainer.style.overflow = "hidden";
    this.domContainer.style.pointerEvents = "none";
  }

  /**
   * Configures event listeners on the Pixi stage to handle panning.
   * The world can be panned by holding the Spacebar and dragging the mouse.
   */
  _setupPanning() {
    this.app.stage.eventMode = "static";
    this.app.stage.hitArea = this.app.screen; // Makes the whole stage interactive.

    const stopPanning = () => {
      this.isPanning = false;
      this._updateCursor();
    };

    // Starts panning if the spacebar is held down.
    this.app.stage.on("pointerdown", (event) => {
      if (this.isSpacebarDown) {
        this.isPanning = true;
        this.lastPosition.copyFrom(event.global);
        this._updateCursor();
      }
    });

    // Moves the world container based on mouse movement.
    this.app.stage.on("pointermove", (event) => {
      if (this.isPanning) {
        const dx = event.global.x - this.lastPosition.x;
        const dy = event.global.y - this.lastPosition.y;
        this.worldContainer.x += dx;
        this.worldContainer.y += dy;
        this.lastPosition.copyFrom(event.global);
      }
    });

    // Stops panning when the mouse is released.
    this.app.stage.on("pointerup", stopPanning);
    this.app.stage.on("pointerupoutside", stopPanning);

    // Listens for spacebar key presses to enable/disable panning mode.
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

  /** Starts the main application loop, which calls `update` on all nodes. */
  _startTicker() {
    this.app.ticker.add(() => {
      for (const node of this.nodes) {
        node.update();
      }
    });
  }

  /** Changes the mouse cursor to provide visual feedback for panning. */
  _updateCursor() {
    if (this.isPanning) this.app.canvas.style.cursor = "grabbing";
    else if (this.isSpacebarDown) this.app.canvas.style.cursor = "grab";
    else this.app.canvas.style.cursor = "default";
  }

  /**
   * A factory method to create a new `DraggableNode` and add it to the canvas.
   * @param {number} x - The world x-coordinate.
   * @param {number} y - The world y-coordinate.
   * @param {string} text - The text for the node.
   * @returns {DraggableNode} The created node.
   */
  createNode(x, y, text) {
    const node = new DraggableNode(x, y, text, this);
    this.nodes.push(node);
    return node;
  }

  /**
   * A utility method to add any Pixi.js display object to the main pannable world.
   * @param {import("./node_modules/pixi.js/dist/pixi.mjs").DisplayObject} pixiObject
   */
  add(pixiObject) {
    this.worldContainer.addChild(pixiObject);
  }
}

/** Application Entry Point */
(async () => {
  // Initialize the main canvas controller and append it to the document body.
  const canvas = new PannableCanvas(document.body);
  await canvas.init();

  // Add a static blue circle at the world origin (0,0) for reference.
  const circle = new Graphics().circle(0, 0, 10).fill(0x3498db);
  canvas.add(circle);

  // Create several draggable nodes at different world positions.
  canvas.createNode(100, 75, "Node A");
  canvas.createNode(50, 150, "Node B");
  canvas.createNode(200, 250, "Another Node");
})();
