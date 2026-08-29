import {
    resolveGroupExit,
    type FocusGroupDescriptor,
} from './tv-focus-graph';
import type { FocusDirection } from './tv-focus-geometry';

function group(
    overrides: Partial<FocusGroupDescriptor> & Pick<FocusGroupDescriptor, 'id'>
): FocusGroupDescriptor {
    return {
        orientation: 'row',
        itemCount: 5,
        neighbours: {},
        ...overrides,
    };
}

describe('resolveGroupExit', () => {
    it('returns null when no destination is declared (focus stays put)', () => {
        const source = group({ id: 'a', orientation: 'row', itemCount: 3 });

        expect(resolveGroupExit(source, 1, 'up', undefined)).toBeNull();
    });

    it('returns null when the destination group has no items', () => {
        const source = group({ id: 'a', orientation: 'row', itemCount: 3 });
        const destination = group({ id: 'b', orientation: 'row', itemCount: 0 });

        expect(resolveGroupExit(source, 1, 'up', destination)).toBeNull();
    });

    describe('row exiting vertically into a row (rail-to-rail)', () => {
        const source = group({ id: 'source', orientation: 'row', itemCount: 6 });
        const destination = group({
            id: 'dest',
            orientation: 'row',
            itemCount: 4,
        });

        it('preserves the horizontal position when it fits', () => {
            expect(resolveGroupExit(source, 2, 'up', destination)).toEqual({
                groupId: 'dest',
                index: 2,
            });
        });

        it('clamps the horizontal position when the destination is narrower', () => {
            expect(resolveGroupExit(source, 5, 'down', destination)).toEqual({
                groupId: 'dest',
                index: 3,
            });
        });
    });

    describe('column exiting horizontally into a column', () => {
        const source = group({
            id: 'source',
            orientation: 'column',
            itemCount: 6,
        });
        const destination = group({
            id: 'dest',
            orientation: 'column',
            itemCount: 3,
        });

        it('preserves the vertical position when it fits', () => {
            expect(resolveGroupExit(source, 1, 'left', destination)).toEqual({
                groupId: 'dest',
                index: 1,
            });
        });

        it('clamps the vertical position when the destination is shorter', () => {
            expect(resolveGroupExit(source, 5, 'right', destination)).toEqual({
                groupId: 'dest',
                index: 2,
            });
        });
    });

    describe('column entering a row / row entering a column (edge entry)', () => {
        it('exiting left into a row enters at the last item', () => {
            const source = group({
                id: 'source',
                orientation: 'column',
                itemCount: 4,
            });
            const destination = group({
                id: 'dest',
                orientation: 'row',
                itemCount: 5,
            });
            expect(resolveGroupExit(source, 2, 'left', destination)).toEqual({
                groupId: 'dest',
                index: 4,
            });
        });

        it('exiting right into a row enters at index 0', () => {
            const source = group({
                id: 'source',
                orientation: 'column',
                itemCount: 4,
            });
            const destination = group({
                id: 'dest',
                orientation: 'row',
                itemCount: 5,
            });
            expect(resolveGroupExit(source, 2, 'right', destination)).toEqual({
                groupId: 'dest',
                index: 0,
            });
        });

        it('exiting up into a column enters at the last item', () => {
            const source = group({ id: 'source', orientation: 'row', itemCount: 4 });
            const destination = group({
                id: 'dest',
                orientation: 'column',
                itemCount: 5,
            });
            expect(resolveGroupExit(source, 1, 'up', destination)).toEqual({
                groupId: 'dest',
                index: 4,
            });
        });

        it('exiting down into a column enters at index 0', () => {
            const source = group({ id: 'source', orientation: 'row', itemCount: 4 });
            const destination = group({
                id: 'dest',
                orientation: 'column',
                itemCount: 5,
            });
            expect(resolveGroupExit(source, 1, 'down', destination)).toEqual({
                groupId: 'dest',
                index: 0,
            });
        });
    });

    describe('grid exiting upward into a rail (perpendicular position preserved)', () => {
        // Source grid: columnCount 3, itemCount 9 -> exiting index 1 (row0/col1) up.
        const source = group({
            id: 'grid',
            orientation: 'grid',
            itemCount: 9,
            columnCount: 3,
        });
        const rail = group({ id: 'rail', orientation: 'row', itemCount: 6 });

        it('does not always land on index 0 — it keeps the column position', () => {
            expect(resolveGroupExit(source, 1, 'up', rail)).toEqual({
                groupId: 'rail',
                index: 1,
            });
        });

        it('keeps the column position for a different column too', () => {
            expect(resolveGroupExit(source, 2, 'up', rail)).toEqual({
                groupId: 'rail',
                index: 2,
            });
        });

        it('clamps when the rail is narrower than the grid', () => {
            const narrowRail = group({
                id: 'narrow-rail',
                orientation: 'row',
                itemCount: 2,
            });
            expect(resolveGroupExit(source, 2, 'up', narrowRail)).toEqual({
                groupId: 'narrow-rail',
                index: 1,
            });
        });
    });

    describe('rail entering a grid vertically', () => {
        const rail = group({ id: 'rail', orientation: 'row', itemCount: 6 });
        const gridDown = group({
            id: 'grid',
            orientation: 'grid',
            itemCount: 8, // rows [0,1,2] [3,4,5] [6,7]
            columnCount: 3,
        });

        it('exiting down from the rail enters the grid top row at the matching column', () => {
            expect(resolveGroupExit(rail, 1, 'down', gridDown)).toEqual({
                groupId: 'grid',
                index: 1,
            });
        });

        it('exiting down and entering a grid whose last row is the only row clamps into it', () => {
            const shortGrid = group({
                id: 'grid',
                orientation: 'grid',
                itemCount: 2,
                columnCount: 3,
            });
            expect(resolveGroupExit(rail, 2, 'down', shortGrid)).toEqual({
                groupId: 'grid',
                index: 1,
            });
        });

        it('exiting up from a rail below enters the grid bottom row at the matching column, clamped into a partial row', () => {
            // gridDown's last row [6,7] only has columns 0 and 1.
            expect(resolveGroupExit(rail, 2, 'up', gridDown)).toEqual({
                groupId: 'grid',
                index: 7,
            });
            expect(resolveGroupExit(rail, 0, 'up', gridDown)).toEqual({
                groupId: 'grid',
                index: 6,
            });
        });
    });

    describe('grid exiting horizontally into a rail/column, preserving row position', () => {
        // Grid: columnCount 3, itemCount 8 -> rows [0,1,2] [3,4,5] [6,7].
        const grid = group({
            id: 'grid',
            orientation: 'grid',
            itemCount: 8,
            columnCount: 3,
        });

        it('exiting right preserves the row position into a column', () => {
            const column = group({ id: 'col', orientation: 'column', itemCount: 5 });
            // Index 4 is row 1 -> row position 1.
            expect(resolveGroupExit(grid, 4, 'right', column)).toEqual({
                groupId: 'col',
                index: 1,
            });
        });

        it('exiting left preserves the row position into a column, clamped', () => {
            const shortColumn = group({
                id: 'col',
                orientation: 'column',
                itemCount: 2,
            });
            // Index 7 is row 2 -> row position 2, clamped to the last index (1).
            expect(resolveGroupExit(grid, 7, 'left', shortColumn)).toEqual({
                groupId: 'col',
                index: 1,
            });
        });
    });

    describe('grid exiting into another grid, preserving both a row and an edge column', () => {
        const source = group({
            id: 'source',
            orientation: 'grid',
            itemCount: 9,
            columnCount: 3,
        });
        // Destination rows [0,1] [2,3] [4] — partial last row.
        const destination = group({
            id: 'dest',
            orientation: 'grid',
            itemCount: 5,
            columnCount: 2,
        });

        it('exiting right enters the destination at column 0 of the matching row', () => {
            // Source index 3 is row 1 -> enters destination row 1, column 0 -> index 2.
            expect(resolveGroupExit(source, 3, 'right', destination)).toEqual({
                groupId: 'dest',
                index: 2,
            });
        });

        it('exiting left enters the destination at the last column of the matching row, clamped into a partial row', () => {
            // Source index 7 is row 2 -> destination row 2 only has column 0 (index 4).
            expect(resolveGroupExit(source, 7, 'left', destination)).toEqual({
                groupId: 'dest',
                index: 4,
            });
        });

        it('row position beyond the destination is clamped to its last row', () => {
            const tallSource = group({
                id: 'tall',
                orientation: 'grid',
                itemCount: 20,
                columnCount: 2,
            });
            // Row 9 (index 18) has no counterpart in the 3-row destination.
            expect(resolveGroupExit(tallSource, 18, 'right', destination)).toEqual(
                {
                    groupId: 'dest',
                    index: 4,
                }
            );
        });
    });

    describe('non-grid source treated as a single-row/column for cross-position purposes', () => {
        it('row source exiting up uses its own index directly (no columnCount involved)', () => {
            const source = group({ id: 'source', orientation: 'row', itemCount: 5 });
            const destination = group({
                id: 'dest',
                orientation: 'grid',
                itemCount: 9,
                columnCount: 3,
            });
            // Index 4 as a cross position enters the destination's LAST row
            // (exiting "up"), clamped to that row's last column (index 8).
            expect(resolveGroupExit(source, 4, 'up', destination)).toEqual({
                groupId: 'dest',
                index: 8,
            });
        });
    });

    describe('every direction is handled for a full grid <-> grid matrix', () => {
        const a = group({ id: 'a', orientation: 'grid', itemCount: 9, columnCount: 3 });
        const b = group({ id: 'b', orientation: 'grid', itemCount: 9, columnCount: 3 });

        const directions: FocusDirection[] = ['up', 'down', 'left', 'right'];
        for (const direction of directions) {
            it(`resolves a target for direction ${direction}`, () => {
                const result = resolveGroupExit(a, 4, direction, b);
                expect(result).not.toBeNull();
                expect(result?.groupId).toBe('b');
                expect(result?.index).toBeGreaterThanOrEqual(0);
                expect(result?.index).toBeLessThan(9);
            });
        }
    });
});
