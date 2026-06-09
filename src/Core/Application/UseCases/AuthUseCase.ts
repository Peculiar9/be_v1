import type { IAuthUseCase } from "../Interface/UseCases/IAuthUseCase";
import { UserRegistrationDTO } from "../DTOs/AuthDTOV2";
import { ChangePasswordDTO, ForgotPasswordDTO, IEmailVerificationResponse, RefreshTokenDTO, ResetPasswordDTO, VerifyEmailDTO } from "../DTOs/AuthDTO";
import { LoginDTO } from "../DTOs/AuthDTO";
import { TYPES } from "../../Types/Constants";
import { inject, injectable } from "inversify";
import type { IRegistrationService } from "../Interface/Services/IRegistrationService";
import { UserResponseDTO } from "../DTOs/UserDTO";
import type { IUser } from "../Interface/Entities/auth-and-user/IUser";
import type { IUserProfileService } from "../Interface/Services/IUserProfileService";
import type { IAuthenticationService } from "../Interface/Services/IAuthenticationService";
import { AuthHelpers } from "@Infrastructure/Services/helpers/AuthHelpers";
import type { ITwilioEmailService } from "../Interface/Services/ITwilioEmailService";
import { AuthenticationError, ValidationError } from "../Error/AppError";
import type { UploadedFile } from "../Types/UploadedFile";

@injectable()
export class AuthUseCase implements IAuthUseCase {
    constructor(
        @inject(TYPES.RegistrationService) private readonly _registrationService: IRegistrationService,
        @inject(TYPES.UserProfileService) private readonly _userProfileService: IUserProfileService,
        @inject(TYPES.AuthenticationService) private readonly _authenticationService: IAuthenticationService,
        @inject(TYPES.AuthHelpers) private readonly _authHelpers: AuthHelpers,
        @inject(TYPES.TwilioEmailService) private readonly _twilioEmailService: ITwilioEmailService,
    ) { }

    async forgotPassword(dto: ForgotPasswordDTO): Promise<{ message: string; email: string; }> {
        await this._authenticationService.requestPasswordReset(dto.email);
        return { message: "Password reset instructions sent", email: dto.email };
    }
    async resetPassword(dto: ResetPasswordDTO): Promise<{ message: string; }> {
        if (dto.password !== dto.confirmPassword) {
            throw new ValidationError("Password confirmation does not match");
        }
        await this._authenticationService.resetPassword(dto.token, dto.password);
        return { message: "Password reset successfully" };
    }
    async changePassword(dto: ChangePasswordDTO, user: IUser): Promise<{ message: string; }> {
        if (dto.newPassword !== dto.confirmPassword) {
            throw new ValidationError("Password confirmation does not match");
        }
        await this._authenticationService.changePassword(user._id as string, dto.currentPassword, dto.newPassword);
        return { message: "Password changed successfully" };
    }
    getCurrentUser(user: IUser): Promise<UserResponseDTO> {
        return Promise.resolve(this._authHelpers.constructUserObject(user));
    }

    async register(dto: UserRegistrationDTO): Promise<UserResponseDTO> {
        const result = await this._registrationService.initRegistration(dto);
        return result;
    }

    async verifyEmail(dto: VerifyEmailDTO): Promise<{ accessToken: string, refreshToken: string, user: UserResponseDTO }> {
        const response = await this._registrationService.verifyEmailCode(dto);
        return {
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            user: response.user as UserResponseDTO
        };
    }

    async resendEmailVerification(dto: VerifyEmailDTO): Promise<IEmailVerificationResponse> {
        const response = await this._registrationService.resendVerification(dto.email, dto.reference);
        return response;
    }

    async refresh(dto: RefreshTokenDTO): Promise<{ accessToken: string; refreshToken: string; user: UserResponseDTO; }> {
        const response = await this._authenticationService.refreshAccessToken(dto.refresh_token);
        const user = this._authHelpers.constructUserObject(response.user);
        return { accessToken: response.accessToken, refreshToken: response.refreshToken, user };
    }

    async login(dto: LoginDTO): Promise<{ accessToken: string; refreshToken: string; user: Partial<UserResponseDTO>; }> {

        const response = await this._authenticationService.authenticate(dto.identifier, dto.password);

        if (!response) {
            throw new AuthenticationError('Authentication failed');
        }
        return { accessToken: response.accessToken, refreshToken: response.refreshToken, user: response.user };
    }

    async updateProfileImage(image: UploadedFile, user: IUser): Promise<UserResponseDTO> {
        return await this._userProfileService.updateProfileImage(image, user);
    }

    async logout(user: IUser): Promise<{ message: string }> {
        await this._authenticationService.revokeRefreshToken(user._id as string);
        return { message: "Logged out successfully" };
    }
}
