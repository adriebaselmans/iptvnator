import {
    computeNextFocusIndex,
    type FocusDirection,
    type FocusOrientation,
} from './tv-focus-geometry';

function moved(index: number) {
    return { kind: 'moved', index };
}

function exit(direction: FocusDirection) {
    return { kind: 'exit', direction };
}

describe('computeNextFocusIndex', () => {
    describe('empty group', () => {
        const orientations: FocusOrientation[] = ['row', 'column', 'grid'];
        const directions: FocusDirection[] = ['up', 'down', 'left', 'right'];

        for (const orientation of orientations) {
            for (const direction of directions) {
                it(`exits for ${orientation}/${direction} when itemCount is 0`, () => {
                    expect(
                        computeNextFocusIndex({
                            currentIndex: 0,
                            itemCount: 0,
                            orientation,
                            direction,
                            columnCount: 3,
                        })
                    ).toEqual(exit(direction));
                });
            }
        }
    });

    describe('row orientation', () => {
        it('moves right within bounds', () => {
            expect(
                computeNextFocusIndex({
                    currentIndex: 1,
                    itemCount: 5,
                    orientation: 'row',
                    direction: 'right',
                })
            ).toEqual(moved(2));
        });

        it('moves left within bounds', () => {
            expect(
                computeNextFocusIndex({
                    currentIndex: 1,
                    itemCount: 5,
                    orientation: 'row',
                    direction: 'left',
                })
            ).toEqual(moved(0));
        });

        it('exits left at the first index', () => {
            expect(
                computeNextFocusIndex({
                    currentIndex: 0,
                    itemCount: 5,
                    orientation: 'row',
                    direction: 'left',
                })
            ).toEqual(exit('left'));
        });

        it('exits right at the last index', () => {
            expect(
                computeNextFocusIndex({
                    currentIndex: 4,
                    itemCount: 5,
                    orientation: 'row',
                    direction: 'right',
                })
            ).toEqual(exit('right'));
        });

        it('always exits up', () => {
            expect(
                computeNextFocusIndex({
                    currentIndex: 2,
                    itemCount: 5,
                    orientation: 'row',
                    direction: 'up',
                })
            ).toEqual(exit('up'));
        });

        it('always exits down', () => {
            expect(
                computeNextFocusIndex({
                    currentIndex: 2,
                    itemCount: 5,
                    orientation: 'row',
                    direction: 'down',
                })
            ).toEqual(exit('down'));
        });

        it('single-item group exits both left and right', () => {
            expect(
                computeNextFocusIndex({
                    currentIndex: 0,
                    itemCount: 1,
                    orientation: 'row',
                    direction: 'left',
                })
            ).toEqual(exit('left'));
            expect(
                computeNextFocusIndex({
                    currentIndex: 0,
                    itemCount: 1,
                    orientation: 'row',
                    direction: 'right',
                })
            ).toEqual(exit('right'));
        });
    });

    describe('column orientation', () => {
        it('moves down within bounds', () => {
            expect(
                computeNextFocusIndex({
                    currentIndex: 1,
                    itemCount: 5,
                    orientation: 'column',
                    direction: 'down',
                })
            ).toEqual(moved(2));
        });

        it('moves up within bounds', () => {
            expect(
                computeNextFocusIndex({
                    currentIndex: 1,
                    itemCount: 5,
                    orientation: 'column',
                    direction: 'up',
                })
            ).toEqual(moved(0));
        });

        it('exits up at the first index', () => {
            expect(
                computeNextFocusIndex({
                    currentIndex: 0,
                    itemCount: 5,
                    orientation: 'column',
                    direction: 'up',
                })
            ).toEqual(exit('up'));
        });

        it('exits down at the last index', () => {
            expect(
                computeNextFocusIndex({
                    currentIndex: 4,
                    itemCount: 5,
                    orientation: 'column',
                    direction: 'down',
                })
            ).toEqual(exit('down'));
        });

        it('always exits left', () => {
            expect(
                computeNextFocusIndex({
                    currentIndex: 2,
                    itemCount: 5,
                    orientation: 'column',
                    direction: 'left',
                })
            ).toEqual(exit('left'));
        });

        it('always exits right', () => {
            expect(
                computeNextFocusIndex({
                    currentIndex: 2,
                    itemCount: 5,
                    orientation: 'column',
                    direction: 'right',
                })
            ).toEqual(exit('right'));
        });

        it('single-item group exits both up and down', () => {
            expect(
                computeNextFocusIndex({
                    currentIndex: 0,
                    itemCount: 1,
                    orientation: 'column',
                    direction: 'up',
                })
            ).toEqual(exit('up'));
            expect(
                computeNextFocusIndex({
                    currentIndex: 0,
                    itemCount: 1,
                    orientation: 'column',
                    direction: 'down',
                })
            ).toEqual(exit('down'));
        });
    });

    describe('grid orientation — full 3x3 grid (indices 0..8, columnCount 3)', () => {
        const columnCount = 3;
        const itemCount = 9;

        it.each([
            [0, 1],
            [1, 2],
            [3, 4],
            [7, 8],
        ])('moves right from %i to %i', (from, to) => {
            expect(
                computeNextFocusIndex({
                    currentIndex: from,
                    itemCount,
                    orientation: 'grid',
                    direction: 'right',
                    columnCount,
                })
            ).toEqual(moved(to));
        });

        it.each([2, 5, 8])(
            'exits right at the last column of a row (index %i), never wrapping',
            (index) => {
                expect(
                    computeNextFocusIndex({
                        currentIndex: index,
                        itemCount,
                        orientation: 'grid',
                        direction: 'right',
                        columnCount,
                    })
                ).toEqual(exit('right'));
            }
        );

        it.each([0, 3, 6])(
            'exits left at the first column of a row (index %i), never wrapping',
            (index) => {
                expect(
                    computeNextFocusIndex({
                        currentIndex: index,
                        itemCount,
                        orientation: 'grid',
                        direction: 'left',
                        columnCount,
                    })
                ).toEqual(exit('left'));
            }
        );

        it.each([
            [4, 3],
            [8, 7],
            [1, 0],
        ])('moves left from %i to %i', (from, to) => {
            expect(
                computeNextFocusIndex({
                    currentIndex: from,
                    itemCount,
                    orientation: 'grid',
                    direction: 'left',
                    columnCount,
                })
            ).toEqual(moved(to));
        });

        it.each([0, 1, 2])('exits up from the first row (index %i)', (index) => {
            expect(
                computeNextFocusIndex({
                    currentIndex: index,
                    itemCount,
                    orientation: 'grid',
                    direction: 'up',
                    columnCount,
                })
            ).toEqual(exit('up'));
        });

        it.each([
            [3, 0],
            [4, 1],
            [8, 5],
        ])('moves up from %i to %i, preserving column', (from, to) => {
            expect(
                computeNextFocusIndex({
                    currentIndex: from,
                    itemCount,
                    orientation: 'grid',
                    direction: 'up',
                    columnCount,
                })
            ).toEqual(moved(to));
        });

        it.each([6, 7, 8])(
            'exits down from the last row (index %i)',
            (index) => {
                expect(
                    computeNextFocusIndex({
                        currentIndex: index,
                        itemCount,
                        orientation: 'grid',
                        direction: 'down',
                        columnCount,
                    })
                ).toEqual(exit('down'));
            }
        );

        it.each([
            [0, 3],
            [1, 4],
            [5, 8],
        ])('moves down from %i to %i, preserving column', (from, to) => {
            expect(
                computeNextFocusIndex({
                    currentIndex: from,
                    itemCount,
                    orientation: 'grid',
                    direction: 'down',
                    columnCount,
                })
            ).toEqual(moved(to));
        });
    });

    describe('grid orientation — partial final row (itemCount 8, columnCount 3)', () => {
        // Rows: [0,1,2] [3,4,5] [6,7] — the last row is short by one item.
        const columnCount = 3;
        const itemCount = 8;

        it('moving down from the last full row into the short row lands on the last existing item', () => {
            // Index 5 is directly above index 8, which does not exist.
            expect(
                computeNextFocusIndex({
                    currentIndex: 5,
                    itemCount,
                    orientation: 'grid',
                    direction: 'down',
                    columnCount,
                })
            ).toEqual(moved(7));
        });

        it('moving down from a column that does exist in the short row lands on it directly', () => {
            // Index 4 is row 1 / column 1; row 2's column 1 is index 7 and exists.
            expect(
                computeNextFocusIndex({
                    currentIndex: 4,
                    itemCount,
                    orientation: 'grid',
                    direction: 'down',
                    columnCount,
                })
            ).toEqual(moved(7));
        });

        it('moving down from the short row itself exits (no further row exists)', () => {
            expect(
                computeNextFocusIndex({
                    currentIndex: 6,
                    itemCount,
                    orientation: 'grid',
                    direction: 'down',
                    columnCount,
                })
            ).toEqual(exit('down'));
            expect(
                computeNextFocusIndex({
                    currentIndex: 7,
                    itemCount,
                    orientation: 'grid',
                    direction: 'down',
                    columnCount,
                })
            ).toEqual(exit('down'));
        });

        it('moving up from the short row lands on the item directly above', () => {
            expect(
                computeNextFocusIndex({
                    currentIndex: 6,
                    itemCount,
                    orientation: 'grid',
                    direction: 'up',
                    columnCount,
                })
            ).toEqual(moved(3));
            expect(
                computeNextFocusIndex({
                    currentIndex: 7,
                    itemCount,
                    orientation: 'grid',
                    direction: 'up',
                    columnCount,
                })
            ).toEqual(moved(4));
        });

        it('moving right within the short row stops before the missing item', () => {
            expect(
                computeNextFocusIndex({
                    currentIndex: 6,
                    itemCount,
                    orientation: 'grid',
                    direction: 'right',
                    columnCount,
                })
            ).toEqual(moved(7));
            expect(
                computeNextFocusIndex({
                    currentIndex: 7,
                    itemCount,
                    orientation: 'grid',
                    direction: 'right',
                    columnCount,
                })
            ).toEqual(exit('right'));
        });
    });

    describe('grid orientation — single row (itemCount less than columnCount)', () => {
        it('behaves like a row for left/right and always exits up/down', () => {
            const request = {
                itemCount: 3,
                orientation: 'grid' as const,
                columnCount: 6,
            };

            expect(
                computeNextFocusIndex({ ...request, currentIndex: 0, direction: 'left' })
            ).toEqual(exit('left'));
            expect(
                computeNextFocusIndex({ ...request, currentIndex: 0, direction: 'right' })
            ).toEqual(moved(1));
            expect(
                computeNextFocusIndex({ ...request, currentIndex: 2, direction: 'right' })
            ).toEqual(exit('right'));
            expect(
                computeNextFocusIndex({ ...request, currentIndex: 1, direction: 'up' })
            ).toEqual(exit('up'));
            expect(
                computeNextFocusIndex({ ...request, currentIndex: 1, direction: 'down' })
            ).toEqual(exit('down'));
        });
    });

    describe('grid orientation — single item', () => {
        it('exits in every direction', () => {
            const directions: FocusDirection[] = ['up', 'down', 'left', 'right'];
            for (const direction of directions) {
                expect(
                    computeNextFocusIndex({
                        currentIndex: 0,
                        itemCount: 1,
                        orientation: 'grid',
                        direction,
                        columnCount: 4,
                    })
                ).toEqual(exit(direction));
            }
        });
    });

    describe('grid orientation — column count changes at runtime', () => {
        it('the same index/itemCount pair moves differently under a new column count', () => {
            // 6 items, columnCount 3: rows [0,1,2] [3,4,5]. Index 1 down -> 4.
            expect(
                computeNextFocusIndex({
                    currentIndex: 1,
                    itemCount: 6,
                    orientation: 'grid',
                    direction: 'down',
                    columnCount: 3,
                })
            ).toEqual(moved(4));

            // Same index/itemCount, columnCount now 2: rows [0,1] [2,3] [4,5].
            // Index 1 is column 1 of row 0; down -> column 1 of row 1 -> index 3.
            expect(
                computeNextFocusIndex({
                    currentIndex: 1,
                    itemCount: 6,
                    orientation: 'grid',
                    direction: 'down',
                    columnCount: 2,
                })
            ).toEqual(moved(3));
        });
    });

    describe('grid orientation — missing/invalid column count', () => {
        it('falls back to single-row behaviour when columnCount is undefined', () => {
            expect(
                computeNextFocusIndex({
                    currentIndex: 0,
                    itemCount: 3,
                    orientation: 'grid',
                    direction: 'right',
                })
            ).toEqual(moved(1));
            expect(
                computeNextFocusIndex({
                    currentIndex: 0,
                    itemCount: 3,
                    orientation: 'grid',
                    direction: 'down',
                })
            ).toEqual(exit('down'));
        });

        it('falls back to single-row behaviour when columnCount is 0 or negative', () => {
            expect(
                computeNextFocusIndex({
                    currentIndex: 1,
                    itemCount: 3,
                    orientation: 'grid',
                    direction: 'right',
                    columnCount: 0,
                })
            ).toEqual(moved(2));
            expect(
                computeNextFocusIndex({
                    currentIndex: 1,
                    itemCount: 3,
                    orientation: 'grid',
                    direction: 'right',
                    columnCount: -2,
                })
            ).toEqual(moved(2));
        });
    });
});
