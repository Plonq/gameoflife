import React, {
  MouseEventHandler,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import "./GameOfLife.css";

type PixelPoint = { x: number; y: number };

class Tile {
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  get key() {
    return `${this.x}-${this.y}`;
  }

  toPixelPoint(scale: number): PixelPoint {
    return {
      x: this.x * scale,
      y: this.y * scale,
    };
  }

  getNeighbourCoords(): { x: number; y: number }[] {
    return [
      { x: this.x - 1, y: this.y - 1 },
      { x: this.x, y: this.y - 1 },
      { x: this.x + 1, y: this.y - 1 },
      { x: this.x - 1, y: this.y },
      { x: this.x + 1, y: this.y },
      { x: this.x - 1, y: this.y + 1 },
      { x: this.x, y: this.y + 1 },
      { x: this.x + 1, y: this.y + 1 },
    ];
  }

  countLiveNeighbours(tileMap: Map<string, Tile>) {
    const neighbourKeys = this.getNeighbourCoords().map(
      ({ x, y }) => `${x}-${y}`
    );

    let count = 0;
    for (let neighbourKey of neighbourKeys) {
      if (tileMap.has(neighbourKey)) {
        count += 1;
      }
    }

    return count;
  }

  static fromPixelPoint(pixelPoint: PixelPoint, scale: number) {
    return new Tile(
      (Math.floor(pixelPoint.x / scale) * scale) / scale,
      (Math.floor(pixelPoint.y / scale) * scale) / scale
    );
  }
}

export const GameOfLife = () => {
  //
  // CANVAS AND RENDERING
  //

  // Rendering state
  const [scale, setScale] = useState<number>(10);
  const [cursor, setCursor] = useState("auto");
  const offsetRef = useRef<PixelPoint>({ x: 0, y: 0 });
  const activeTilesRef = useRef<Map<string, Tile>>(new Map());
  const isMouseDown = useRef<boolean>(false);
  const isSpaceDown = useRef<boolean>(false);
  const hasMovedGrid = useRef<boolean>(false);
  const clickedTile = useRef<Tile | null>(null);
  const drawType = useRef<"draw" | "erase">("draw");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentFrameRef = useRef<number>(0);
  const previousFrameRef = useRef<number>(0);

  // Game state
  const [tps, setTps] = useState<number>(24);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [steps, setSteps] = useState<number>(0);
  const previousTickRef = useRef<number>(0);

  const canvasOffsetToTile = useCallback(
    (offsetX: number, offsetY: number) => {
      return Tile.fromPixelPoint(
        {
          x: offsetX - offsetRef.current.x,
          y: offsetY - offsetRef.current.y,
        },
        scale
      );
    },
    [scale]
  );

  const isTileActive = useCallback((tile: Tile) => {
    return activeTilesRef.current.has(tile.key);
  }, []);

  const deactivateTile = useCallback((tile: Tile) => {
    activeTilesRef.current.delete(tile.key);
  }, []);

  const activateTile = useCallback((tile: Tile) => {
    activeTilesRef.current.set(tile.key, tile);
    setSteps(0);
  }, []);

  const renderGame = useCallback(() => {
    const context = canvasRef.current?.getContext("2d");
    if (!context) {
      return;
    }

    // Responsive resizing
    context.canvas.width = window.innerWidth - 24;
    context.canvas.height = window.innerHeight - 200;

    const { current: offset } = offsetRef;
    const { current: tiles } = activeTilesRef;
    const { width, height } = context.canvas;

    // Clear canvas
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);

    // Draw tiles
    context.fillStyle = "#000000";
    for (let entry of tiles.entries()) {
      const tile = entry[1];
      const origin = tile.toPixelPoint(scale);
      const x = origin.x + offset.x;
      const y = origin.y + offset.y;
      context.fillRect(x, y, scale, scale);
    }

    // Draw grid lines
    context.lineWidth = 1;
    context.strokeStyle = "#ddd";
    context.beginPath();
    for (let x = offset.x % scale; x < width; x += scale) {
      context.moveTo(x, 0);
      context.lineTo(x, height);
    }
    context.stroke();
    context.beginPath();
    for (let y = offset.y % scale; y < height; y += scale) {
      context.moveTo(0, y);
      context.lineTo(width, y);
    }
    context.stroke();
  }, [scale]);

  const animationFrame = useCallback(
    (time: number) => {
      const frameDelta = time - previousFrameRef.current;
      if (frameDelta >= 1000 / 60) {
        renderGame();
        previousFrameRef.current = time;
      }

      currentFrameRef.current = requestAnimationFrame(animationFrame);
    },
    [renderGame]
  );

  // Being rendering
  useEffect(() => {
    currentFrameRef.current = requestAnimationFrame(animationFrame);

    return () => {
      cancelAnimationFrame(currentFrameRef.current);
    };
  }, [animationFrame]);

  // Keyboard event handlers
  useEffect(() => {
    const keyDownHandler = (event: KeyboardEvent) => {
      if (event.code === "Space" && !isSpaceDown.current) {
        isSpaceDown.current = true;
        setCursor("grab");
      }
    };
    window.addEventListener("keydown", keyDownHandler);

    const keyUpHandler = () => {
      isSpaceDown.current = false;
      setCursor("auto");
    };
    window.addEventListener("keyup", keyUpHandler);

    return () => {
      window.removeEventListener("keydown", keyDownHandler);
      window.removeEventListener("keyup", keyUpHandler);
    };
  }, []);

  const mouseDown: MouseEventHandler<HTMLCanvasElement> = useCallback(
    (event) => {
      // hasMovedGrid.current = false;
      isMouseDown.current = true;
      if (isSpaceDown.current) {
        setCursor("grabbing");
      }

      const tile = canvasOffsetToTile(
        event.nativeEvent.offsetX,
        event.nativeEvent.offsetY
      );

      clickedTile.current = tile;

      if (isSpaceDown.current) {
        return;
      }

      if (isTileActive(tile)) {
        drawType.current = "erase";
        deactivateTile(tile);
      } else {
        drawType.current = "draw";
        activateTile(tile);
      }
    },
    [canvasOffsetToTile, isTileActive, activateTile, deactivateTile]
  );

  const mouseMove: MouseEventHandler<HTMLCanvasElement> = useCallback(
    (event) => {
      if (isMouseDown.current) {
        if (isSpaceDown.current) {
          // Move grid
          offsetRef.current.x += event.movementX;
          offsetRef.current.y += event.movementY;
          hasMovedGrid.current = true;
        } else {
          // "Paint"
          const tile = canvasOffsetToTile(
            event.nativeEvent.offsetX,
            event.nativeEvent.offsetY
          );

          if (tile.key !== clickedTile.current?.key) {
            if (drawType.current === "draw") {
              activateTile(tile);
            }
            if (drawType.current === "erase") {
              deactivateTile(tile);
            }
          }
        }
      }
    },
    [canvasOffsetToTile, activateTile, deactivateTile]
  );

  const mouseUp: MouseEventHandler<HTMLDivElement> = useCallback(() => {
    isMouseDown.current = false;

    if (isSpaceDown.current) {
      setCursor("grab");
    }
  }, []);

  //
  // GAME LOGIC
  //

  const runGameRules = () => {
    const newTileMap = new Map<string, Tile>();

    for (let [key, tile] of activeTilesRef.current.entries()) {
      // Any live cell with two or three live neighbours survives.
      const neighbourCount = tile.countLiveNeighbours(activeTilesRef.current);
      if (neighbourCount >= 2 && neighbourCount <= 3) {
        newTileMap.set(key, tile);
      }

      // Any dead cell with three live neighbours becomes a live cell.
      for (let neighbour of tile.getNeighbourCoords()) {
        const neighbourTile = new Tile(neighbour.x, neighbour.y);
        // Is it dead?
        if (!activeTilesRef.current.has(neighbourTile.key)) {
          // Does it have 3 live neighbours?
          if (neighbourTile.countLiveNeighbours(activeTilesRef.current) === 3) {
            // Make it alive
            newTileMap.set(neighbourTile.key, neighbourTile);
          }
        }
      }
    }

    activeTilesRef.current = newTileMap;
    setSteps((steps) => steps + 1);
  };

  // Game ticks
  useEffect(() => {
    let interval = 0;
    if (isPlaying) {
      previousTickRef.current = Date.now();
      interval = window.setInterval(runGameRules, 1000 / tps);
    }

    return () => {
      window.clearInterval(interval);
    };
  }, [tps, isPlaying]);

  //
  // VIEW
  //
  return (
    <div className="wrapper" onMouseUp={mouseUp}>
      <h1 className="title">Conway's Game of Life - Plonq edition</h1>
      <canvas
        className="canvas"
        style={{ cursor: cursor }}
        ref={canvasRef}
        onMouseDown={mouseDown}
        onMouseMove={mouseMove}
      />
      <div className="controls">
        <button
          type="button"
          onClick={() => {
            setIsPlaying((isPlaying) => !isPlaying);
          }}
        >
          {isPlaying ? "Pause" : "Play"}
        </button>
        <button type="button" onClick={runGameRules}>
          Step
        </button>
        <button
          type="button"
          onClick={() => {
            activeTilesRef.current.clear();
            setSteps(0);
          }}
        >
          Clear
        </button>
      </div>
      <div className="controls">
        <label>
          Speed:
          <input
            type="range"
            min={1}
            max={200}
            step={1}
            value={tps}
            onChange={(event) => {
              setTps(Number(event.target.value));
            }}
          />
        </label>
        <label>
          Scale:
          <input
            type="range"
            min={2}
            max={30}
            step={1}
            value={scale}
            onChange={(event) => {
              setScale(Number(event.target.value));
            }}
          />
        </label>
        <div className="step-counter">Steps: {steps}</div>
      </div>
    </div>
  );
};
