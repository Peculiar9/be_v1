import { injectable, inject } from 'inversify';
import { TYPES } from '@Core/Types/Constants';
import { PaymentTransaction, PaymentTransactionStatus, PaymentTransactionType } from '@Core/Types/PaymentTransaction';
import { BaseRepository, TransactionManager } from 'peculiar-orm';
import { TableNames } from '@Core/Application/Enums/TableNames';

@injectable()
export class PaymentTransactionRepository extends BaseRepository<PaymentTransaction> {
    constructor(
        @inject(TYPES.TransactionManager) transactionManager: TransactionManager
    ) {
        super(transactionManager, TableNames.PAYMENT_TRANSACTIONS);
    }

    async findById(id: string): Promise<PaymentTransaction | null> {
        const result = await this.executeQuery<PaymentTransaction>(
            `SELECT * FROM ${this.tableName} WHERE _id = $1`,
            [id]
        );
        return result.rows[0] as unknown as PaymentTransaction || null;
    }

    async findAll(): Promise<PaymentTransaction[]> {
        const result = await this.executeQuery<PaymentTransaction>(
            `SELECT * FROM ${this.tableName} ORDER BY created_at DESC`
        );
        return result.rows as unknown as PaymentTransaction[];
    }

    async findByCondition(condition: Partial<PaymentTransaction>): Promise<PaymentTransaction[]> {
        const { whereClause, values } = this.buildWhereClause(condition);
        const result = await this.executeQuery<PaymentTransaction>(
            `SELECT * FROM ${this.tableName} ${whereClause} ORDER BY created_at DESC`,
            values
        );
        return result.rows as unknown as PaymentTransaction[];
    }

    async count(condition?: Partial<PaymentTransaction>): Promise<number> {
        let query = `SELECT COUNT(*) as count FROM ${this.tableName}`;
        let values: unknown[] = [];

        if (condition) {
            const built = this.buildWhereClause(condition);
            query += ` ${built.whereClause}`;
            values = built.values;
        }

        const result = await this.executeQuery<{ count: string }>(query, values);
        return parseInt((result.rows[0] as { count?: string })?.count ?? '0', 10);
    }

    async findByUserId(userId: string, limit?: number, offset?: number): Promise<PaymentTransaction[]> {
        const pagination = this.paginationClause(limit, offset, 2);
        const result = await this.executeQuery<PaymentTransaction>(
            `SELECT * FROM ${this.tableName}
             WHERE user_id = $1
             ORDER BY created_at DESC
             ${pagination.clause}`,
            [userId, ...pagination.values]
        );
        return result.rows as unknown as PaymentTransaction[];
    }

    async findByReference(reference: string): Promise<PaymentTransaction | null> {
        const result = await this.executeQuery<PaymentTransaction>(
            `SELECT * FROM ${this.tableName} WHERE payment_reference = $1`,
            [reference]
        );
        return result.rows[0] as unknown as PaymentTransaction || null;
    }

    async findByType(type: PaymentTransactionType, limit?: number, offset?: number): Promise<PaymentTransaction[]> {
        const pagination = this.paginationClause(limit, offset, 2);
        const result = await this.executeQuery<PaymentTransaction>(
            `SELECT * FROM ${this.tableName}
             WHERE type = $1
             ORDER BY created_at DESC
             ${pagination.clause}`,
            [type, ...pagination.values]
        );
        return result.rows as unknown as PaymentTransaction[];
    }

    async findByStatus(status: PaymentTransactionStatus, limit?: number, offset?: number): Promise<PaymentTransaction[]> {
        const pagination = this.paginationClause(limit, offset, 2);
        const result = await this.executeQuery<PaymentTransaction>(
            `SELECT * FROM ${this.tableName}
             WHERE status = $1
             ORDER BY created_at DESC
             ${pagination.clause}`,
            [status, ...pagination.values]
        );
        return result.rows as unknown as PaymentTransaction[];
    }

    async create(transaction: PaymentTransaction): Promise<PaymentTransaction> {
        const { columns, values, placeholders } = this.getEntityColumns(transaction);
        const result = await this.executeQuery<PaymentTransaction>(
            `INSERT INTO ${this.tableName} (${columns.join(', ')})
             VALUES (${placeholders.join(', ')})
             RETURNING *`,
            values
        );
        return result.rows[0] as unknown as PaymentTransaction;
    }

    async update(id: string, data: Partial<PaymentTransaction>): Promise<PaymentTransaction | null> {
        const { setClause, values } = this.buildUpdateSet(data);
        if (!setClause) return this.findById(id);

        const result = await this.executeQuery<PaymentTransaction>(
            `UPDATE ${this.tableName}
             SET ${setClause}, updated_at = NOW()
             WHERE _id = $${values.length + 1}
             RETURNING *`,
            [...values, id]
        );
        return result.rows[0] as unknown as PaymentTransaction || null;
    }

    async delete(id: string): Promise<boolean> {
        const result = await this.executeQuery(
            `DELETE FROM ${this.tableName} WHERE _id = $1`,
            [id]
        );
        return (result.rowCount ?? 0) > 0;
    }

    async bulkCreate(entities: PaymentTransaction[]): Promise<PaymentTransaction[]> {
        if (!entities.length) return [];
        const { valuesClause, values, columns } = this.buildBulkInsertClause(entities);
        const result = await this.executeQuery<PaymentTransaction>(
            `INSERT INTO ${this.tableName} (${columns.join(', ')})
             VALUES ${valuesClause}
             RETURNING *`,
            values
        );
        return result.rows as unknown as PaymentTransaction[];
    }

    async bulkUpdate(entities: Partial<PaymentTransaction>[]): Promise<PaymentTransaction[]> {
        const updated: PaymentTransaction[] = [];
        for (const entity of entities) {
            if (!entity._id) continue;
            const result = await this.update(entity._id, entity);
            if (result) updated.push(result);
        }
        return updated;
    }

    async bulkDelete(ids: string[]): Promise<number> {
        if (!ids.length) return 0;
        const result = await this.executeQuery(
            `DELETE FROM ${this.tableName} WHERE _id = ANY($1::uuid[])`,
            [ids]
        );
        return result.rowCount ?? 0;
    }

    private paginationClause(limit?: number, offset?: number, startIndex = 1): { clause: string; values: number[] } {
        const values: number[] = [];
        let clause = '';

        if (limit !== undefined) {
            values.push(limit);
            clause += ` LIMIT $${startIndex}`;
        }

        if (offset !== undefined) {
            values.push(offset);
            clause += ` OFFSET $${startIndex + values.length - 1}`;
        }

        return { clause, values };
    }
}
