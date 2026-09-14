/**
 * Global declarations for Manovr V2 depot drag-and-drop operations
 */
declare global {
  var globalDraggedTrainId: number | null | undefined;
  interface Window {
    __depotDraggedTrainId?: number | null;
  }
}

export {};
