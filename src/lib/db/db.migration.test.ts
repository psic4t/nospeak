import { describe, it, expect, vi, beforeEach } from 'vitest';
import { migrateCallHistoryKindToV14 } from './db';

/**
 * Unit tests for the Dexie v14 upgrade body. We don't run a real
 * IndexedDB upgrade (jsdom doesn't ship indexedDB and we don't want to
 * pull in fake-indexeddb just for one migration). Instead we exercise
 * the upgrade callback against a faithful in-memory mock of the Dexie
 * `Transaction.table(...).filter(...).modify(...)` shape it actually
 * uses, asserting both the predicate and the mutator behave correctly.
 *
 * See openspec/changes/move-call-history-to-kind-1405.
 */
describe('Dexie v14 call-history kind migration', () => {
    interface Row {
        id: number;
        rumorKind?: number;
        callEventType?: string;
        message?: string;
        eventId: string;
    }

    function makeMockTrans(rows: Row[]) {
        return {
            table: (name: string) => {
                expect(name).toBe('messages');
                return {
                    filter: (predicate: (row: Row) => boolean) => ({
                        modify: async (mutator: (row: Row) => void) => {
                            for (const row of rows) {
                                if (predicate(row)) mutator(row);
                            }
                        }
                    })
                };
            }
        };
    }

    let consoleLog: ReturnType<typeof vi.spyOn>;
    let consoleError: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
        consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('rewrites rumorKind 16 → 1405 for rows with callEventType set', async () => {
        const rows: Row[] = [
            { id: 1, rumorKind: 16, callEventType: 'ended', message: '', eventId: 'a' },
            { id: 2, rumorKind: 16, callEventType: 'missed', message: '', eventId: 'b' },
            { id: 3, rumorKind: 16, callEventType: 'declined', message: '', eventId: 'c' },
        ];

        await migrateCallHistoryKindToV14(makeMockTrans(rows));

        expect(rows[0].rumorKind).toBe(1405);
        expect(rows[1].rumorKind).toBe(1405);
        expect(rows[2].rumorKind).toBe(1405);
        // Other fields preserved.
        expect(rows[0].callEventType).toBe('ended');
        expect(rows[1].callEventType).toBe('missed');
        expect(rows[2].eventId).toBe('c');
    });

    it('leaves Kind-14 chat rows untouched', async () => {
        const rows: Row[] = [
            { id: 1, rumorKind: 14, message: 'hello', eventId: 'x' },
            { id: 2, rumorKind: 14, message: 'world', eventId: 'y' },
        ];

        await migrateCallHistoryKindToV14(makeMockTrans(rows));

        expect(rows[0].rumorKind).toBe(14);
        expect(rows[1].rumorKind).toBe(14);
    });

    it('leaves rows with rumorKind=16 but NO callEventType untouched (defensive)', async () => {
        // Such rows should not exist, but if they do they are malformed
        // and we must not corrupt them by giving them the call-history kind.
        const rows: Row[] = [
            { id: 1, rumorKind: 16, message: 'orphan-16-row', eventId: 'o' },
        ];

        await migrateCallHistoryKindToV14(makeMockTrans(rows));

        expect(rows[0].rumorKind).toBe(16);
    });

    it('leaves rumorKind=1405 rows untouched (idempotent)', async () => {
        // After one migration pass, re-running the upgrade must be a no-op.
        const rows: Row[] = [
            { id: 1, rumorKind: 1405, callEventType: 'ended', message: '', eventId: 'a' },
        ];

        await migrateCallHistoryKindToV14(makeMockTrans(rows));

        expect(rows[0].rumorKind).toBe(1405);
    });

    it('handles a mix of legacy, current, and unrelated rows in one pass', async () => {
        const rows: Row[] = [
            { id: 1, rumorKind: 14, message: 'chat', eventId: 'a' },
            { id: 2, rumorKind: 16, callEventType: 'ended', message: '', eventId: 'b' },
            { id: 3, rumorKind: 1405, callEventType: 'missed', message: '', eventId: 'c' },
            { id: 4, rumorKind: 16, callEventType: 'busy', message: '', eventId: 'd' },
            { id: 5, rumorKind: 15, message: 'file', eventId: 'e' },
        ];

        await migrateCallHistoryKindToV14(makeMockTrans(rows));

        expect(rows.map(r => r.rumorKind)).toEqual([14, 1405, 1405, 1405, 15]);
    });

    it('does not throw if the underlying table operation rejects (logged instead)', async () => {
        const failingTrans = {
            table: () => ({
                filter: () => ({
                    modify: async () => {
                        throw new Error('simulated Dexie failure');
                    }
                })
            })
        };

        // Must resolve, not reject — migration is best-effort.
        await expect(migrateCallHistoryKindToV14(failingTrans as any)).resolves.toBeUndefined();
        expect(consoleError).toHaveBeenCalledWith(
            '[Dexie v14] call-history kind migration failed',
            expect.any(Error)
        );
    });
});
