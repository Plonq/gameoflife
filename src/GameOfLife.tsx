import React, {
  MouseEventHandler,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import "./GameOfLife.css";

type PixelPoint = { x: number; y: number };
type GridPoint = { gridX: number; gridY: number };

export const GameOfLife = () => {
  const size = { width: 500, height: 500 };
  const tileSize = 10;
  const [fps, setFps] = useState(60);
  const offsetRef = useRef<PixelPoint>({ x: 0, y: 0 });
  const tilesRef = useRef<Map<string, GridPoint>>(
    new Map([["1-1", { gridX: 1, gridY: 1 }]])
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestIdRef = useRef<number>(0);
  const previousTimeRef = useRef<number>(0);
  const isMouseDown = useRef<boolean>(false);
  const isSpaceDown = useRef<boolean>(false);
  const hasMovedGrid = useRef<boolean>(false);

  const gridPointToPixelPoint = (gridPoint: GridPoint): PixelPoint => {
    return {
      x: gridPoint.gridX * tileSize,
      y: gridPoint.gridY * tileSize,
    };
  };

  const renderFrame = useCallback(() => {
    if (canvasRef.current) {
      const context = canvasRef.current.getContext("2d");
      if (context) {
        const { current: offset } = offsetRef;
        const { current: tiles } = tilesRef;
        const { width, height } = context.canvas;

        // Clear canvas
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, width, height);

        // Draw grid lines
        context.lineWidth = 1;
        context.strokeStyle = "#ddd";
        context.beginPath();
        for (let x = offset.x % tileSize; x < width; x += tileSize) {
          context.moveTo(x, 0);
          context.lineTo(x, height);
        }
        context.stroke();
        context.beginPath();
        for (let y = offset.y % tileSize; y < width; y += tileSize) {
          context.moveTo(0, y);
          context.lineTo(width, y);
        }
        context.stroke();

        // Draw tiles
        context.fillStyle = "#000000";
        for (let [_key, tile] of tiles.entries()) {
          const origin = gridPointToPixelPoint(tile);
          const x = origin.x + offset.x;
          const y = origin.y + offset.y;
          context.fillRect(x, y, tileSize, tileSize);
        }
      }
    }
  }, []);

  const tick = useCallback(
    (time: number) => {
      const deltaTime = time - previousTimeRef.current;
      if (deltaTime >= 1000 / fps) {
        renderFrame();
        previousTimeRef.current = time;
      }
      requestIdRef.current = requestAnimationFrame(tick);
    },
    [fps, renderFrame]
  );

  useEffect(() => {
    requestIdRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(requestIdRef.current);
    };
  }, [tick]);

  useEffect(() => {
    const keyDownHandler = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        isSpaceDown.current = true;
      }
    };
    window.addEventListener("keydown", keyDownHandler);

    const keyUpHandler = () => {
      isSpaceDown.current = false;
    };
    window.addEventListener("keyup", keyUpHandler);

    const mouseUpHandler = () => {
      isMouseDown.current = false;
    };
    window.addEventListener("mouseup", mouseUpHandler);

    return () => {
      window.removeEventListener("keydown", keyDownHandler);
      window.removeEventListener("keyup", keyUpHandler);
      window.removeEventListener("mouseup", mouseUpHandler);
    };
  }, []);

  const canvasClick: MouseEventHandler<HTMLCanvasElement> = useCallback(
    (event) => {
      if (!hasMovedGrid.current) {
        const pixelX = event.nativeEvent.offsetX - offsetRef.current.x;
        const pixelY = event.nativeEvent.offsetY - offsetRef.current.y;

        const newTile = {
          gridX: (Math.floor(pixelX / tileSize) * tileSize) / tileSize,
          gridY: (Math.floor(pixelY / tileSize) * tileSize) / tileSize,
        };
        tilesRef.current.set(`${newTile.gridX}-${newTile.gridY}`, newTile);
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
          const pixelX = event.nativeEvent.offsetX - offsetRef.current.x;
          const pixelY = event.nativeEvent.offsetY - offsetRef.current.y;

          const newTile = {
            gridX: (Math.floor(pixelX / tileSize) * tileSize) / tileSize,
            gridY: (Math.floor(pixelY / tileSize) * tileSize) / tileSize,
          };
          tilesRef.current.set(`${newTile.gridX}-${newTile.gridY}`, newTile);
        }
      }
    },
    []
  );

  return (
    <div className="wrapper">
      <canvas
        className="canvas"
        {...size}
        ref={canvasRef}
        onClick={canvasClick}
        onMouseDown={() => {
          hasMovedGrid.current = false;
          isMouseDown.current = true;
        }}
        onMouseMove={mouseMove}
      />
    </div>
  );
};
