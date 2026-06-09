import { injectable } from "inversify";
import type { ITokenService } from "@Core/Application/Interface/Services/ITokenService";
import type { IUser } from "@Core/Application/Interface/Entities/auth-and-user/IUser";
import * as jwt from "jsonwebtoken";
import { UtilityService } from "@Core/Services/UtilityService";
import { AuthenticationError, ServiceError } from "@Core/Application/Error/AppError";
import { ResponseMessage } from "@Core/Application/Response/ResponseFormat";
import * as bcrypt from "bcryptjs";

/**
 * Service for handling JWT token generation and verification
 * Centralizes all token-related operations to avoid duplication
 */
@injectable()
export class TokenService implements ITokenService {
    /**
     * Generates JWT access and refresh tokens for a user
     * @param user User entity
     * @returns Object containing accessToken and refreshToken
     */
    public async generateTokens(user: IUser): Promise<{ accessToken: string; refreshToken: string }> {
        const payload = {
            sub: user._id,
            email: user.email,
            roles: user.roles,
            type: 'access',
        };

        const accessSecret = process.env.JWT_ACCESS_SECRET!;
        if (!accessSecret) {
            throw new ServiceError("Token generation failed due to missing configuration");
        }

        const refreshSecret = process.env.JWT_REFRESH_SECRET!;
        if (!refreshSecret) {
            throw new ServiceError("Token generation failed due to missing configuration");
        }

        const accessToken = jwt.sign(
            payload,
            accessSecret,
            {
                expiresIn: (process.env.JWT_ACCESS_EXPIRATION || '15m') as jwt.SignOptions['expiresIn'],
                jwtid: UtilityService.generateUUID(),
            }
        );

        const refreshToken = jwt.sign(
            { ...payload, type: 'refresh' },
            refreshSecret,
            {
                expiresIn: (process.env.JWT_REFRESH_EXPIRATION || '7d') as jwt.SignOptions['expiresIn'],
                jwtid: UtilityService.generateUUID(),
            }
        );

        return { accessToken, refreshToken };
    }

    public async hashRefreshToken(refreshToken: string): Promise<string> {
        return await bcrypt.hash(refreshToken, 12);
    }

    /**
     * Verifies a JWT token
     * @param token JWT token to verify
     * @returns Decoded token payload if valid
     * @throws AuthenticationError if token is invalid or expired
     */
    public async verifyToken(token: string): Promise<any> {
        try {
            const secret = process.env.JWT_ACCESS_SECRET;

            if (!secret) {
                throw new AuthenticationError(ResponseMessage.INVALID_TOKEN_MESSAGE);
            }

            const decoded = jwt.verify(token, secret);

            if (!decoded) {
                throw new AuthenticationError(ResponseMessage.INVALID_TOKEN_MESSAGE);
            }

            return decoded;
        } catch (error: any) {
            if (error.name === 'TokenExpiredError') {
                throw new AuthenticationError(ResponseMessage.INVALID_TOKEN_MESSAGE);
            }

            throw new AuthenticationError(error.message);
        }
    }

    /**
     * Generates a password reset token
     * @param userId User ID
     * @returns Reset token
     */
    public async generatePasswordResetToken(userId: string): Promise<string> {
        const payload = {
            sub: userId,
            purpose: 'password_reset',
            jti: UtilityService.generateUUID()
        };

        const secret = process.env.JWT_RESET_SECRET || process.env.JWT_ACCESS_SECRET!;
        if (!secret) {
            throw new ServiceError("Token generation failed due to missing configuration");
        }

        // Password reset tokens typically have a shorter expiration
        return jwt.sign(payload, secret, {
            expiresIn: (process.env.JWT_RESET_EXPIRATION || '1h') as jwt.SignOptions['expiresIn']
        });
    }

    /**
     * Verifies a password reset token against a hashed token
     * @param token Plain text token to verify
     * @param hashedToken Hashed token stored in the database
     * @returns True if token is valid
     */
    public async verifyPasswordResetToken(token: string, hashedToken: string): Promise<boolean> {
        try {
            // Compare the plain token with the hashed version stored in the database
            return await bcrypt.compare(token, hashedToken);
        } catch {
            return false;
        }
    }
}
