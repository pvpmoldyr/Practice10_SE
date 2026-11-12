import { describe, expect, it } from 'vitest';
import { checkAvailability, parseTime } from './availability';
import { sampleRooms } from './sampleData';

// Derive types from the real function so the test does not depend on the path of './types'.
type Room = Parameters<typeof checkAvailability>[0];

const CURRENT_TIME = 540; // fixed time for every test

/** Builds a brand-new room (and a brand-new bookings array) on every call. */
function makeRoom(overrides: Partial<Room> = {}): Room {
  return {
    id: 'r1',
    name: 'Room 1',
    building: 'A',
    capacity: 20,
    blocked: false,
    bookings: [{ start: 600, end: 660, title: 'Existing', bookedBy: 'Tester' }],
    ...overrides,
  };
}

function expectAvailable(room: Room, start: number, end: number): void {
  const result = checkAvailability(room, start, end, CURRENT_TIME);
  expect(result.decision).toBe('available');
  expect(result.reasons).toEqual([]);
}

function expectUnavailable(room: Room, start: number, end: number): void {
  const result = checkAvailability(room, start, end, CURRENT_TIME);
  expect(result.decision).toBe('unavailable');
  expect(result.reasons.length).toBeGreaterThan(0);
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.values(value as object).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

describe('AC1 - time validity (start >= end, past, 0-1440)', () => {
  it('T02: 540-570 is unavailable (starts exactly now, start must be strictly after currentTime)', () => {
    expectUnavailable(makeRoom(), 540, 570);
  });

  it('T03: 720-720 is unavailable (zero duration)', () => {
    expectUnavailable(makeRoom(), 720, 720);
  });

  it('T04: 750-720 is unavailable (reversed interval)', () => {
    expectUnavailable(makeRoom(), 750, 720);
  });

  it('T05: 1380-1441 is unavailable (ends past day end)', () => {
    expectUnavailable(makeRoom(), 1380, 1441);
  });

  // Extra case E1
  it('E1: 1380-1440 is available (end exactly at 1440 is allowed)', () => {
    expectAvailable(makeRoom(), 1380, 1440);
  });

  // Extra case E2
  it.each([
    ['NaN start', NaN, 720],
    ['NaN end', 660, NaN],
  ])('E2: %s is unavailable with a reason and does not throw', (_label, start, end) => {
    expectUnavailable(makeRoom(), start, end);
  });
});

describe('AC2 - maximum duration of 120 minutes', () => {
  it('T06: 720-840 is available (exactly 120 min)', () => {
    expectAvailable(makeRoom(), 720, 840);
  });

  it('T07: 720-841 is unavailable (121 min)', () => {
    expectUnavailable(makeRoom(), 720, 841);
  });
});

describe('AC3 - blocked room', () => {
  it('T13: 660-720 is unavailable when room.blocked = true', () => {
    expectUnavailable(makeRoom({ blocked: true }), 660, 720);
  });
});

describe('AC4 - overlaps (touching endpoints allowed)', () => {
  it('T01: 660-720 is available (touches end of existing booking)', () => {
    expectAvailable(makeRoom(), 660, 720);
  });

  it('T08: 570-600 is available (touches start of existing booking)', () => {
    expectAvailable(makeRoom(), 570, 600);
  });

  it('T09: 630-690 is unavailable (partial overlap)', () => {
    expectUnavailable(makeRoom(), 630, 690);
  });

  it('T10: 570-690 is unavailable (contains existing booking)', () => {
    expectUnavailable(makeRoom(), 570, 690);
  });

  it('T11: 615-645 is unavailable (inside existing booking)', () => {
    expectUnavailable(makeRoom(), 615, 645);
  });

  it('T12: 600-660 is unavailable (identical interval)', () => {
    expectUnavailable(makeRoom(), 600, 660);
  });

  it('T14: 630-690 is available when bookings = []', () => {
    expectAvailable(makeRoom({ bookings: [] }), 630, 690);
  });
});

describe('AC5 - decision is returned without changing booking data', () => {
  const scenarios: Array<{ label: string; start: number; end: number; overrides: Partial<Room> }> = [
    { label: 'an available request (T01)', start: 660, end: 720, overrides: {} },
    { label: 'an overlap rejection (T09)', start: 630, end: 690, overrides: {} },
    { label: 'a past-start rejection (T02)', start: 540, end: 570, overrides: {} },
    { label: 'a blocked-room rejection (T13)', start: 660, end: 720, overrides: { blocked: true } },
  ];

  it.each(scenarios)('leaves room and bookings unchanged after $label', ({ start, end, overrides }) => {
    const room = makeRoom(overrides);
    const bookingsRef = room.bookings;
    const roomBefore = structuredClone(room);
    const bookingsBefore = structuredClone(room.bookings);

    checkAvailability(room, start, end, CURRENT_TIME);

    expect(room).toEqual(roomBefore);
    expect(room.bookings).toBe(bookingsRef); // same array object, not replaced
    expect(room.bookings).toEqual(bookingsBefore);
    expect(room.bookings).toHaveLength(1);
  });

  it.each([
    { label: 'available request (T01)', start: 660, end: 720, expected: 'available' },
    { label: 'overlap rejection (T09)', start: 630, end: 690, expected: 'unavailable' },
  ])('repeated calls with the same data give the same $expected result and change nothing: $label', ({ start, end, expected }) => {
    const room = makeRoom();
    const roomBefore = structuredClone(room);
    const bookingsBefore = structuredClone(room.bookings);

    const first = checkAvailability(room, start, end, CURRENT_TIME);
    expect(first.decision).toBe(expected);

    for (let i = 0; i < 5; i++) {
      const again = checkAvailability(room, start, end, CURRENT_TIME);
      expect(again.decision).toBe(expected);
      expect(again).toEqual(first);
      expect(room).toEqual(roomBefore);
      expect(room.bookings).toEqual(bookingsBefore);
    }
  });

  it.each([
    { label: 'available request', start: 660, end: 720, expected: 'available' },
    { label: 'overlap rejection', start: 630, end: 690, expected: 'unavailable' },
  ])('works on a deeply frozen room (any write would throw): $label', ({ start, end, expected }) => {
    const room = deepFreeze(makeRoom());

    const result = checkAvailability(room, start, end, CURRENT_TIME);

    expect(result.decision).toBe(expected);
  });
});

describe('regression - named cases with exact reasons', () => {
  it('past time (AC1): 480-510 at 09:00 is unavailable because the start is already past', () => {
    const result = checkAvailability(makeRoom(), 480, 510, CURRENT_TIME);
    expect(result.decision).toBe('unavailable');
    expect(result.reasons).toEqual(['Start time must be after the current time.']);
  });

  it('reversed interval (AC1): 750-720 is unavailable with only the ordering reason', () => {
    const result = checkAvailability(makeRoom(), 750, 720, CURRENT_TIME);
    expect(result.decision).toBe('unavailable');
    expect(result.reasons).toEqual(['Start time must be earlier than end time.']);
  });

  it('121-minute duration (AC2): 720-841 is unavailable with only the duration reason', () => {
    const result = checkAvailability(makeRoom(), 720, 841, CURRENT_TIME);
    expect(result.decision).toBe('unavailable');
    expect(result.reasons).toEqual([
      'Booking duration is 121 min — maximum allowed is 120 min.',
    ]);
  });

  it('blocked room (AC3): the room blocked reason is shown', () => {
    const room = makeRoom({ blocked: true, blockedReason: 'Under maintenance' });
    const result = checkAvailability(room, 660, 720, CURRENT_TIME);
    expect(result.decision).toBe('unavailable');
    expect(result.reasons).toEqual(['Under maintenance']);
  });

  it('blocked room without a reason (AC3): a generic blocked message is shown', () => {
    const result = checkAvailability(makeRoom({ blocked: true }), 660, 720, CURRENT_TIME);
    expect(result.decision).toBe('unavailable');
    expect(result.reasons).toEqual(['This room is currently blocked.']);
  });

  it('overlap (AC4): 630-690 is unavailable and names the existing booking and its times', () => {
    const result = checkAvailability(makeRoom(), 630, 690, CURRENT_TIME);
    expect(result.decision).toBe('unavailable');
    expect(result.reasons).toEqual([
      'Overlaps existing booking "Existing" (10:00–11:00).',
    ]);
  });

  it('touching endpoints (AC4): back-to-back bookings on both sides are available with no reasons', () => {
    const room = makeRoom();
    expect(checkAvailability(room, 570, 600, CURRENT_TIME).reasons).toEqual([]);
    expect(checkAvailability(room, 660, 720, CURRENT_TIME).reasons).toEqual([]);
    expect(checkAvailability(room, 570, 600, CURRENT_TIME).decision).toBe('available');
    expect(checkAvailability(room, 660, 720, CURRENT_TIME).decision).toBe('available');
  });

  it('fixtures (AC5): sample rooms are unchanged after checks, including a deeply frozen copy', () => {
    const snapshot = structuredClone(sampleRooms);
    const frozenRooms = deepFreeze(structuredClone(sampleRooms));
    const candidates: Array<[number, number]> = [
      [660, 720],
      [630, 690],
      [480, 510],
      [720, 841],
      [750, 720],
    ];

    for (const room of frozenRooms) {
      for (const [start, end] of candidates) {
        checkAvailability(room, start, end, CURRENT_TIME);
      }
    }

    expect(sampleRooms).toEqual(snapshot);
    expect(frozenRooms).toEqual(snapshot);
  });
});

describe('regression - invalid and out-of-range time input (risks C2, C3)', () => {
  it('C3: "25:00"-"26:00" parsed via parseTime is unavailable and never "available"', () => {
    const start = parseTime('25:00');
    const end = parseTime('26:00');
    const result = checkAvailability(makeRoom(), start, end, CURRENT_TIME);
    expect(result.decision).toBe('unavailable');
    expect(result.reasons).toEqual(['Times must fall within the same day (00:00–24:00).']);
  });

  it('C2: empty string start parsed via parseTime is NaN and reported as invalid input, not 00:00', () => {
    const start = parseTime('');
    expect(Number.isNaN(start)).toBe(true);
    const result = checkAvailability(makeRoom(), start, 720, CURRENT_TIME);
    expect(result.decision).toBe('unavailable');
    expect(result.reasons).toEqual(['Please enter a valid start time, end time and current time.']);
  });

  it('C2: empty string end parsed via parseTime is NaN and reported as invalid input, not 00:00', () => {
    const end = parseTime('');
    expect(Number.isNaN(end)).toBe(true);
    const result = checkAvailability(makeRoom(), 660, end, CURRENT_TIME);
    expect(result.decision).toBe('unavailable');
    expect(result.reasons).toEqual(['Please enter a valid start time, end time and current time.']);
  });
});