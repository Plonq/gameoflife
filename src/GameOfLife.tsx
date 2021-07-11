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
  static readonly size: number = 10;
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  get key() {
    return `${this.x}-${this.y}`;
  }

  toPixelPoint(): PixelPoint {
    return {
      x: this.x * Tile.size,
      y: this.y * Tile.size,
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

  static fromPixelPoint(pixelPoint: PixelPoint) {
    return new Tile(
      (Math.floor(pixelPoint.x / this.size) * this.size) / this.size,
      (Math.floor(pixelPoint.y / this.size) * this.size) / this.size
    );
  }
}

export const GameOfLife = () => {
  // Config
  const size = { width: 500, height: 500 };
  const [fps, setFps] = useState(60);

  // State
  const [cursor, setCursor] = useState("auto");
  const offsetRef = useRef<PixelPoint>({ x: 0, y: 0 });
  const activeTilesRef = useRef<Map<string, Tile>>(new Map());
  const isMouseDown = useRef<boolean>(false);
  const isSpaceDown = useRef<boolean>(false);
  const hasMovedGrid = useRef<boolean>(false);
  const clickedTile = useRef<Tile | null>(null);
  const [ticker, setTicker] = useState<number>(0);

  // Render state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestIdRef = useRef<number>(0);
  const previousTimeRef = useRef<number>(0);

  const canvasOffsetToTile = (offsetX: number, offsetY: number) => {
    return Tile.fromPixelPoint({
      x: offsetX - offsetRef.current.x,
      y: offsetY - offsetRef.current.y,
    });
  };

  const addTileAt = (x: number, y: number) => {
    const tile = new Tile(x, y);
    activeTilesRef.current.set(tile.key, tile);
  };

  const removeTileAt = (x: number, y: number) => {
    activeTilesRef.current.delete(new Tile(x, y).key);
  };

  const renderGame = useCallback(() => {
    const context = canvasRef.current?.getContext("2d");
    if (!context) {
      return;
    }

    const { current: offset } = offsetRef;
    const { current: tiles } = activeTilesRef;
    const { width, height } = context.canvas;

    // Clear canvas
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);

    // Draw grid lines
    context.lineWidth = 1;
    context.strokeStyle = "#ddd";
    context.beginPath();
    for (let x = offset.x % Tile.size; x < width; x += Tile.size) {
      context.moveTo(x, 0);
      context.lineTo(x, height);
    }
    context.stroke();
    context.beginPath();
    for (let y = offset.y % Tile.size; y < width; y += Tile.size) {
      context.moveTo(0, y);
      context.lineTo(width, y);
    }
    context.stroke();

    // Draw tiles
    context.fillStyle = "#000000";
    for (let [_key, tile] of tiles.entries()) {
      const origin = tile.toPixelPoint();
      const x = origin.x + offset.x;
      const y = origin.y + offset.y;
      context.fillRect(x, y, Tile.size, Tile.size);
    }
  }, []);

  // Render at speed of fps
  const animationFrame = useCallback(
    (time: number) => {
      const deltaTime = time - previousTimeRef.current;
      if (deltaTime >= 1000 / fps) {
        renderGame();
        previousTimeRef.current = time;
      }
      requestIdRef.current = requestAnimationFrame(animationFrame);
    },
    [fps, renderGame]
  );

  // Being animating
  useEffect(() => {
    requestIdRef.current = requestAnimationFrame(animationFrame);

    addTileAt(30, 29);
    addTileAt(30, 30);
    addTileAt(30, 31);

    // TEST CODE
    // const tileMap = new Map<string, Tile>();
    // const tile = new Tile(1, 1);
    // tileMap.set(tile.key, tile);
    // const tile2 = new Tile(0, 1);
    // tileMap.set(tile2.key, tile2);
    // const tile3 = new Tile(2, 1);
    // tileMap.set(tile3.key, tile3);
    // console.log(tile.countNeighbours(tileMap));
    // END TEST CODE

    return () => {
      cancelAnimationFrame(requestIdRef.current);
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

      if (activeTilesRef.current.has(tile.key)) {
        activeTilesRef.current.delete(tile.key);
      } else {
        activeTilesRef.current.set(tile.key, tile);
      }
    },
    []
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
            activeTilesRef.current.set(tile.key, tile);
          }
        }
      }
    },
    []
  );

  const mouseUp: MouseEventHandler<HTMLDivElement> = useCallback((event) => {
    isMouseDown.current = false;

    if (isSpaceDown.current) {
      setCursor("grab");
    }
  }, []);

  const tick = () => {
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
  };

  const playpause = useCallback(() => {
    if (ticker === 0) {
      tick();
      setTicker(window.setInterval(tick, 100));
    } else {
      window.clearInterval(ticker);
      setTicker(0);
    }
  }, [ticker]);

  const clear = useCallback(() => {
    activeTilesRef.current.clear();
  }, []);

  return (
    <div className="wrapper" onMouseUp={mouseUp}>
      <canvas
        className="canvas"
        style={{ cursor: cursor }}
        {...size}
        ref={canvasRef}
        onMouseDown={mouseDown}
        onMouseMove={mouseMove}
      />
      <div className="controls">
        <button type="button" onClick={playpause}>
          {ticker === 0 ? "Play" : "Pause"}
        </button>
        <button type="button" onClick={tick}>
          Step
        </button>
        <button type="button" onClick={clear}>
          Clear
        </button>
      </div>
    </div>
  );
};
