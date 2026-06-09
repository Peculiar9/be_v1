import { PaymentTransaction as IPaymentTransaction, PaymentTransactionStatus, PaymentTransactionType } from "../../Types/PaymentTransaction";
import { Column, CompositeIndex, ForeignKey, Index } from "peculiar-orm";
import { TableNames } from "../Enums/TableNames";
// import { CreatePaymentTransactionDTO, UpdatePaymentTransactionDTO } from "../DTOs/PaymentTransactionDTO";

@CompositeIndex(['user_id', 'session_id'])
export class PaymentTransaction implements IPaymentTransaction {
    @Column('UUID PRIMARY KEY DEFAULT gen_random_uuid()')
    public _id?: string;

    @Index({ unique: false })
    @ForeignKey({
        table: TableNames.USERS,
        field: '_id',
        constraint: 'fk_payment_transaction_user_id'
    })
    @Column('UUID NOT NULL')
    public user_id: string;

    @Column('BIGINT NOT NULL')
    public amountMinor: number;

    @Column('VARCHAR(3) NOT NULL')
    public currency: string;

    @Column('VARCHAR(50) NOT NULL')
    public status: PaymentTransactionStatus | string;

    @Column('VARCHAR(50) NOT NULL')
    public type: PaymentTransactionType | string;

    @Column('VARCHAR(50) NOT NULL')
    public provider: string;

    @Column('VARCHAR(255) DEFAULT NULL')
    public provider_transaction_id?: string;

    @Column('VARCHAR(255) DEFAULT NULL')
    public payment_reference?: string;

    @Column('TEXT DEFAULT NULL')
    public failure_reason?: string;

    @Column('JSONB DEFAULT NULL')
    public metadata?: Record<string, unknown>;

    @Index({ unique: false })
    @Column('TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP')
    public created_at: Date;

    @Index({ unique: false })
    @Column('TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP')
    public updated_at: Date;

    constructor(data?: Partial<IPaymentTransaction>) {
        Object.assign(this, data);
    }
}
