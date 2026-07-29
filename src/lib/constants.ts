export const ROLES = {
  NONE: 0,
  ADMIN: 1,
  RESPONSIBLE: 2,
  VIEWER: 3,
  SUPERADMIN: 4,
} as const;

export const SHIFTS = {
  A: 1,
  B: 2,
  C: 3,
  STAFF: 4,
} as const;

export const ORG_POSITIONS = {
  RAHBAR: 1,
  RESPONSIBLE: 2,
  ADMIN: 3,
  OTHER: 4,
  TECHNICIAN: 5,
  MANAGER: 6,
  HEAD: 7,
} as const;

export const PERSONNEL_TYPES = {
  MANEUVER: 1,
  TERMINAL: 2,
} as const;

export const TRAIN_TYPES = {
  AC: 0,
  DC: 1,
  DIESEL: 2,
} as const;

export const TRAIN_STATUS = {
  STANDBY: 1,
  MAINTENANCE: 2,
  DISPOSED: 3,
  DISPATCHING: 4,
} as const;

export const MANOVR_STATUS = {
  STARTED: 1,
  FINISHED: 2,
  DELETED: 3,
} as const;

export const CONFIRMATION_STATUS = {
  CONFIRMED: 1,
  REJECTED: 2,
  NONE: 3,
} as const;
