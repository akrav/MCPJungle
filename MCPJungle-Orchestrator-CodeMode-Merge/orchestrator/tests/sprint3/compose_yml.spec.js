import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
describe('Sprint3 Ticket-304 compose YAML', () => {
    it('contains jungle service and healthcheck', () => {
        const s = fs.readFileSync(path.join(__dirname, '../../docker-compose.yml'), 'utf8');
        expect(s).toContain('jungle:');
        expect(s).toContain('healthcheck:');
    });
    it('root compose postgres has PGDATA and volume mount', () => {
        const rootCompose = fs.readFileSync(path.join(__dirname, '../../../docker-compose.yaml'), 'utf8');
        expect(rootCompose).toContain('db:');
        expect(rootCompose).toMatch(/image:\s*postgres:(16|latest)/);
        expect(rootCompose).toMatch(/PGDATA:\s*\/var\/lib\/postgresql\/data/);
        expect(rootCompose).toMatch(/volumes:[\s\S]*- db_data:\/var\/lib\/postgresql\/data/);
    });
});
