# Pixi.js DOM Node Anchoring

A proof-of-concept demonstrating how to overlay and anchor interactive HTML DOM elements onto a pannable Pixi.js canvas.

# About The Project

This project explores a hybrid approach to building interactive diagrams or node-based editors. It leverages the rendering power of Pixi.js for high-performance graphics (like backgrounds, connectors, or complex visual effects) while using standard HTML and CSS for the UI elements (the nodes themselves).

The core challenge this demo solves is synchronizing the screen position of DOM elements with their corresponding coordinates inside a transformed (panned) Pixi.js world container.

Key Features

- Pannable Canvas: The Pixi.js world container can be panned independently of the page.
- Draggable DOM Nodes: HTML elements can be freely dragged and repositioned.
- World & Screen Coordinate Sync: Each DOM node is anchored to a specific point in the Pixi world (visualized by a red dot). Its (x, y) text updates in real-time.
- Canvas Boundary Constraints:
  - Nodes cannot be dragged outside the visible canvas area.
  - Nodes are visually clipped by the canvas area to prevent canvas boundry overflow during canvas panning

# Prereqs/Deps

- Node.js and npm installed on machine.
- PixiJS is currently the only dependency.

# Installation & Running

1. Clone repo

```
git clone https://github.com/your-username/pixi-dom.git
cd pixi-dom
```

2. Install NPM packages:

```
npm install
```

3. Run the project:

This project is a set of static files. You can serve it with any local web server.

**Using VS Code:** The **Live Server** extension is a great choice.

**Using the command line:** You can use the serve package. `npx serve`

Then, open your browser to the provided local address.

# Controls

**Pan Canvas:** Hold Spacebar, then click and drag on the canvas background.
**Move Node:** Click and drag a node to reposition it.

# Next Steps

- Performance & Optimization:
  - [ ] Debounce position updates of DOM nodes.
- Improved Edge Handling:
  - [ ] Prevent nodes from resizing when dragged against the edge of the viewport.
- Configuration API:
  - [ ] Add a system for easily configuring node appearance, drag behavior, boundary rules, etc.
- Node Lifecycle Events:
  - [ ] Implement events like `onCreateNode`, `onRemoveNode`, `onDragStart`, `onMove`, `onDragEnd`, etc.
- Node Connectors:
  - [ ] Establish logical parent/child relationships between nodes.
  - [ ] Render connectors (lines/curves) between nodes using Pixi.js Graphics.
  - [ ] Dynamically update connector positions as nodes are moved.
- Portability:
  - Consider moving away from Pixi in favor of vanilla `canvas`.
