import CryptoJS from "crypto-js";
import bcrypt from "bcryptjs";

export class CryptoService {
    constructor() {

    }

    public static hashString(password: string, salt?: string): string {
        void salt;
        return bcrypt.hashSync(password, 12);
    }
    
    public static generateValidSalt(): string {
        return bcrypt.genSaltSync(16);
    }    
    
    public static verifyHash(input: string, hashedValue: string, salt?: string): boolean {
        if (hashedValue.startsWith('$2a$') || hashedValue.startsWith('$2b$') || hashedValue.startsWith('$2y$')) {
            return bcrypt.compareSync(input, hashedValue);
        }

        if (!salt) {
            return false;
        }

        const legacyHash = CryptoJS.HmacSHA256(input, salt).toString();
        return legacyHash === hashedValue;
    }
    
    public static generateRandomString(length: number): string {
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += charset.charAt(Math.floor(Math.random() * charset.length));
        }
        return result;
    }
}

export default CryptoService;
