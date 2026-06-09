import { inject, injectable } from 'inversify';
import { BaseRepository, TransactionManager } from 'peculiar-orm';
import type { IVerification } from '@Core/Application/Interface/Entities/auth-and-user/IVerification';
import { TableNames } from '@Core/Application/Enums/TableNames';
import { TYPES } from '@Core/Types/Constants';
import { DatabaseError } from '@Core/Application/Error/AppError';
import { VerificationStatus } from '@Core/Application/Interface/Entities/auth-and-user/IUser';
import type { OTP } from '@Core/Application/Types/OTP';

@injectable()
export class VerificationRepository extends BaseRepository<IVerification> {
    constructor(@inject(TYPES.TransactionManager) transactionManager: TransactionManager) {
        super(transactionManager, TableNames.VERIFICATIONS);
    }

    async create(data: IVerification): Promise<IVerification> {
        const { columns, values, placeholders } = this.getEntityColumns(data);
        const query = `
            INSERT INTO ${this.tableName} (${columns.join(', ')})
            VALUES (${placeholders.join(', ')})
            RETURNING *
        `;
        const result = await this.executeQuery<IVerification>(query, values);
        return result.rows[0] as unknown as IVerification;
    }

    async findById(id: string): Promise<IVerification | null> {
        const result = await this.executeQuery<IVerification>(
            `SELECT * FROM ${this.tableName} WHERE _id = $1`,
            [id]
        );
        return result.rows[0] as unknown as IVerification || null;
    }

    async countByCondition(condition: Partial<IVerification>): Promise<number> {
        return this.count(condition);
    }

    async findByReference(reference: string): Promise<IVerification | null> {
        const result = await this.executeQuery<IVerification>(
            `SELECT * FROM ${this.tableName} WHERE reference = $1`,
            [reference]
        );
        return result.rows[0] as unknown as IVerification || null;
    }

    async findByToken(token: string): Promise<IVerification | null> {
        return this.findByReference(token);
    }

    async updateVerification(id: string, data: Partial<IVerification>): Promise<IVerification | null> {
        return this.update(id, data);
    }

    async deleteExpired(): Promise<void> {
        await this.executeQuery(
            `DELETE FROM ${this.tableName} WHERE expiry IS NOT NULL AND expiry < $1`,
            [Date.now()]
        );
    }

    async findAll(): Promise<IVerification[]> {
        const result = await this.executeQuery<IVerification>(
            `SELECT * FROM ${this.tableName} ORDER BY created_at DESC`,
            []
        );
        return result.rows as unknown as IVerification[];
    }

    async findByCondition(condition: Partial<IVerification>): Promise<IVerification[]> {
        const { whereClause, values } = this.buildWhereClause(condition);
        const query = `SELECT * FROM ${this.tableName} ${whereClause} ORDER BY created_at DESC`;
        const result = await this.executeQuery<IVerification>(query, values);
        return result.rows as unknown as IVerification[];
    }

    async update(id: string, entity: Partial<IVerification>): Promise<IVerification | null> {
        const { setClause, values } = this.buildUpdateSet(entity);
        if (!setClause) {
            return this.findById(id);
        }
        const result = await this.executeQuery<IVerification>(
            `UPDATE ${this.tableName}
             SET ${setClause}, updated_at = NOW()
             WHERE _id = $${values.length + 1}
             RETURNING *`,
            [...values, id]
        );
        return result.rows[0] as unknown as IVerification || null;
    }

    async updateOtpInstance(verificationId: string, data: Partial<OTP>): Promise<IVerification | null> {
        const result = await this.executeQuery<IVerification>(
            `UPDATE ${this.tableName}
             SET otp = COALESCE(otp, '{}'::jsonb) || $1::jsonb,
                 updated_at = NOW()
             WHERE _id = $2
             RETURNING *`,
            [JSON.stringify(data), verificationId]
        );

        if (!result.rows[0]) {
            throw new DatabaseError('Failed to update OTP instance');
        }

        return result.rows[0] as unknown as IVerification;
    }

    async updateStatus(verificationId: string, status: VerificationStatus | string): Promise<IVerification> {
        const result = await this.executeQuery<IVerification>(
            `UPDATE ${this.tableName}
             SET status = $1, updated_at = NOW()
             WHERE _id = $2
             RETURNING *`,
            [status, verificationId]
        );
        return result.rows[0] as unknown as IVerification;
    }

    async updateStatusByReference(reference: string, status: VerificationStatus | string): Promise<IVerification> {
        const result = await this.executeQuery<IVerification>(
            `UPDATE ${this.tableName}
             SET status = $1, updated_at = NOW()
             WHERE reference = $2
             RETURNING *`,
            [status, reference]
        );
        return result.rows[0] as unknown as IVerification;
    }

    async incrementAttempts(verificationId: string): Promise<IVerification> {
        const result = await this.executeQuery<IVerification>(
            `UPDATE ${this.tableName}
             SET otp = jsonb_set(
                 COALESCE(otp, '{}'::jsonb),
                 '{attempts}',
                 (COALESCE((otp->>'attempts')::int, 0) + 1)::text::jsonb
             ),
             updated_at = NOW()
             WHERE _id = $1 OR reference = $1
             RETURNING *`,
            [verificationId]
        );
        return result.rows[0] as unknown as IVerification;
    }

    async delete(id: string): Promise<boolean> {
        const result = await this.executeQuery(
            `DELETE FROM ${this.tableName} WHERE _id = $1 RETURNING *`,
            [id]
        );
        return (result.rowCount ?? 0) > 0;
    }

    async count(condition?: Partial<IVerification>): Promise<number> {
        let query = `SELECT COUNT(*) as total FROM ${this.tableName}`;
        let values: unknown[] = [];

        if (condition) {
            const built = this.buildWhereClause(condition);
            query += ` ${built.whereClause}`;
            values = built.values;
        }

        const result = await this.executeQuery<{ total: string }>(query, values);
        return parseInt((result.rows[0] as { total?: string })?.total ?? '0', 10);
    }

    async bulkCreate(entities: IVerification[]): Promise<IVerification[]> {
        if (!entities.length) return [];

        const { valuesClause, values, columns } = this.buildBulkInsertClause(entities);
        const query = `
            INSERT INTO ${this.tableName} (${columns.join(', ')})
            VALUES ${valuesClause}
            RETURNING *
        `;

        const result = await this.executeQuery<IVerification>(query, values);
        return result.rows as unknown as IVerification[];
    }

    async bulkUpdate(entities: Partial<IVerification>[]): Promise<IVerification[]> {
        const updated: IVerification[] = [];
        for (const entity of entities) {
            if (!entity._id) continue;
            const result = await this.update(entity._id, entity);
            if (result) updated.push(result);
        }
        return updated;
    }

    async bulkDelete(ids: string[]): Promise<number> {
        if (!ids.length) return 0;

        const placeholders = ids.map((_, index) => `$${index + 1}`).join(', ');
        const result = await this.executeQuery(
            `DELETE FROM ${this.tableName}
             WHERE _id IN (${placeholders})
             RETURNING *`,
            ids
        );
        return result.rowCount ?? 0;
    }

}
