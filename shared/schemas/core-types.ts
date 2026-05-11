/**
 * WHAT: Defines the durable graph, runtime state, telemetry, and IO contracts shared by frontend and backend.
 * WHY: Both root blocks must execute against the same TypeScript truth instead of duplicating loose JSON shapes.
 */

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | readonly JsonValue[];
export type JsonObject = { readonly [key: string]: JsonValue };

export type ObjectKind = 'canvas' | 'card' | 'zone' | 'group' | 'relationship';
export type ThreadTargetKind = 'card' | 'zone' | 'group' | 'canvas';
export type ToolMode = 'select' | 'zone' | 'group' | 'relationship' | 'pan';
export type NotificationLevel = 'info' | 'success' | 'warning' | 'error';
export type RefreshMode = 'preserve-state' | 'reload-surface' | 'reload-all' | 'force-full-reload';
export type RecordingStatus = 'idle' | 'recording' | 'uploading' | 'transcribed' | 'failed';

export type Point = {
  readonly x: number;
  readonly y: number;
};

export type Rect = Point & {
  readonly width: number;
  readonly height: number;
};

export type Viewport = {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly scale: number;
};

export type Card = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly rect: Rect;
  readonly labels: readonly string[];
  readonly threadId: string;
  readonly tabs: readonly string[];
};

export type Zone = {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly rect: Rect;
  readonly threadId: string;
};

export type Group = {
  readonly id: string;
  readonly title: string;
  readonly rect: Rect;
};

export type Relationship = {
  readonly id: string;
  readonly sourceCardId: string;
  readonly targetCardId: string;
  readonly label: string;
  readonly showLabel: boolean;
};

export type Message = {
  readonly id: string;
  readonly author: 'operator' | 'assistant' | 'system';
  readonly body: string;
  readonly createdAt: string;
};

export type Thread = {
  readonly id: string;
  readonly targetKind: ThreadTargetKind;
  readonly targetId: string;
  readonly messages: readonly Message[];
};

export type CanvasLedger = {
  readonly ledgerId: string;
  readonly name: string;
  readonly slug: string;
  readonly canvasId: string;
  readonly updatedAt: string;
  readonly viewport: Viewport;
  readonly cards: readonly Card[];
  readonly zones: readonly Zone[];
  readonly groups: readonly Group[];
  readonly relationships: readonly Relationship[];
  readonly threads: readonly Thread[];
};

export type NavTab = {
  readonly id: string;
  readonly label: string;
  readonly slug: string;
  readonly ledgerId: string;
  readonly canvasId: string;
  readonly isDefault: boolean;
};

export type ServerEvent = {
  readonly id: string;
  readonly type: string;
  readonly surfaceId?: string;
  readonly source: 'client' | 'external' | 'server';
  readonly createdAt: string;
  readonly payload: JsonObject;
};

export type ServerState = {
  readonly tabs: readonly NavTab[];
  readonly defaultTabId: string;
  readonly ledgers: readonly CanvasLedger[];
  readonly events: readonly ServerEvent[];
};

export type SelectionState = {
  readonly cardIds: readonly string[];
  readonly zoneIds: readonly string[];
  readonly groupIds: readonly string[];
  readonly anchorId?: string;
  readonly selectionSource: 'none' | 'pointer' | 'keyboard' | 'marquee' | 'clipboard' | 'group' | 'refresh';
};

export type GestureState = {
  readonly intent: 'none' | 'pan' | 'drag-card' | 'drag-zone' | 'draw-zone' | 'draw-group' | 'resize-zone' | 'marquee';
  readonly targetId?: string;
  readonly targetKind?: ObjectKind;
  readonly pointerStart?: Point;
  readonly pointerCurrent?: Point;
  readonly marqueeRect?: Rect;
  readonly resizeHandle?: 'nw' | 'ne' | 'sw' | 'se';
};

export type RootRuntimeState = {
  readonly route: {
    readonly routePath: string;
    readonly activeNavTabId: string;
    readonly activeCanvasId: string;
    readonly availableNavTabIds: readonly string[];
    readonly pendingRoute?: string;
  };
  readonly canvas: {
    readonly canvasId: string;
    readonly cardIds: readonly string[];
    readonly zoneIds: readonly string[];
    readonly groupIds: readonly string[];
    readonly relationshipIds: readonly string[];
    readonly viewportId: string;
    readonly revision: number;
  };
  readonly selection: SelectionState;
  readonly gesture: GestureState;
  readonly hover: {
    readonly cardId?: string;
    readonly zoneId?: string;
    readonly groupId?: string;
    readonly relationshipId?: string;
  };
  readonly cardUi: {
    readonly openCardIds: readonly string[];
    readonly topCardId?: string;
    readonly activeTabByCardId: Readonly<Record<string, string>>;
    readonly hashIdVisibleCardId?: string;
  };
  readonly tool: {
    readonly activeTool: ToolMode;
    readonly zoneColor: string;
    readonly isColorPickerOpen: boolean;
  };
  readonly threadPanel: {
    readonly isOpen: boolean;
    readonly threadId?: string;
    readonly targetId?: string;
    readonly targetKind?: ThreadTargetKind;
  };
  readonly draft: {
    readonly threadId?: string;
    readonly body: string;
    readonly status: 'clean' | 'dirty' | 'saving' | 'error';
  };
  readonly voice: {
    readonly threadId?: string;
    readonly voiceFileRef?: string;
    readonly recordingStatus: RecordingStatus;
    readonly durationMs: number;
    readonly level: number;
    readonly uploadStatus: 'idle' | 'pending' | 'complete' | 'failed';
    readonly transcriptionStatus: 'disabled' | 'idle' | 'pending' | 'complete' | 'failed';
    readonly localMessageId?: string;
  };
  readonly modal: {
    readonly modalKind: 'none' | 'zone-edit' | 'confirm-delete-zone' | 'shortcut-help' | 'runbook';
    readonly targetId?: string;
    readonly draftValue?: string;
    readonly confirmAction?: string;
  };
  readonly notification: {
    readonly level: NotificationLevel;
    readonly message: string;
    readonly eventId?: string;
  };
  readonly refresh: {
    readonly surfaceId?: string;
    readonly mode: RefreshMode;
    readonly updatedAt?: string;
    readonly source?: 'client' | 'external' | 'server';
  };
  readonly persistence: {
    readonly pendingSaveReason?: string;
    readonly pendingSurfaceId?: string;
    readonly lastSavedAt?: string;
    readonly lastSaveError?: string;
  };
  readonly clipboard: {
    readonly cardIds: readonly string[];
    readonly zoneIds: readonly string[];
    readonly relationshipIds: readonly string[];
    readonly sourceCanvasId?: string;
    readonly payload: JsonObject;
    readonly copiedAt?: string;
  };
  readonly relationshipRender: readonly RelationshipRenderState[];
};

export type RelationshipRenderState = {
  readonly relationshipId: string;
  readonly sourceCardId?: string;
  readonly targetCardId?: string;
  readonly label?: string;
  readonly sourceSide: 'top' | 'right' | 'bottom' | 'left';
  readonly targetSide: 'top' | 'right' | 'bottom' | 'left';
  readonly sourcePortSlot: number;
  readonly targetPortSlot: number;
  readonly path: string;
  readonly labelPoint: Point;
  readonly selected: boolean;
};

export type RenderNode = {
  readonly id: string;
  readonly kind: ObjectKind;
  readonly rect: Rect;
  readonly zIndex: number;
  readonly selected: boolean;
  readonly label: string;
  readonly style: Readonly<Record<string, string | number>>;
};

export type CanvasRenderModel = {
  readonly canvasId: string;
  readonly background: 'dark-honeycomb';
  readonly viewport: Viewport;
  readonly nodes: readonly RenderNode[];
  readonly relationships: readonly RelationshipRenderState[];
};

export type HitTarget = {
  readonly kind: ObjectKind;
  readonly id?: string;
};

export type TelemetryEvent = {
  readonly name: string;
  readonly domain: string;
  readonly phase: 'input' | 'branch' | 'helper' | 'effect' | 'controller' | 'error';
  readonly at: string;
  readonly payload: JsonObject;
};

export type ControllerExecution<TState = RootRuntimeState> = {
  readonly ok: boolean;
  readonly controller: string;
  readonly domain: string;
  readonly state?: TState;
  readonly render?: JsonValue;
  readonly telemetry: readonly TelemetryEvent[];
  readonly errors: readonly string[];
};

export function nowIso(): string {
  return new Date().toISOString();
}

export function cloneLedger(ledger: CanvasLedger): CanvasLedger {
  return JSON.parse(JSON.stringify(ledger)) as CanvasLedger;
}

export function rectIntersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function pointInRect(point: Point, rect: Rect): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
}

export function center(rect: Rect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

export function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'canvas';
}

export function stableId(prefix: string, value: string): string {
  const sum = [...value].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return `${prefix}-${sum.toString(16).padStart(4, '0')}`;
}
