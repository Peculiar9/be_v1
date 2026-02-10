import { BASE_PATH } from "@Core/Types/Constants";
import { controller, httpGet, httpPost, httpPut, ctx, body } from "hono-injector";
import { BaseController } from "../BaseController";
import { ResponseMessage } from "@Core/Application/Response/ResponseFormat";
import type { Context } from "hono";
import { UserRegistrationDTO } from "@Core/Application/DTOs/AuthDTOV2";
import { inject } from "inversify";
import { TYPES } from "@Core/Types/Constants";
import type { IAuthUseCase } from "@Core/Application/Interface/UseCases/IAuthUseCase";
import { ForgotPasswordDTO, ResetPasswordDTO, ChangePasswordDTO, RefreshTokenDTO, VerifyEmailDTO, LoginDTO } from "@Core/Application/DTOs/AuthDTO";
import AuthMiddleware from "../../Middleware/AuthMiddleware";
import type { IUser } from "@Core/Application/Interface/Entities/auth-and-user/IUser";
import { uploadSingle } from "../../Middleware/MulterMiddleware";
import { validationMiddleware } from "../../Middleware/ValidationMiddleware";

@controller(`/auth`)
export class AuthController extends BaseController {
    constructor(
        @inject(TYPES.AuthUseCase) private readonly authUseCase: IAuthUseCase
    ) {
        super();
    }

    @httpGet("")
    async base(@ctx() c: Context) {
        try {
            return this.success(c, {}, ResponseMessage.SUCCESSFUL_REQUEST_MESSAGE);
        } catch (error: any) {
            return this.error(c, error.message, error.statusCode);
        }
    }

    @httpPost("/register", [validationMiddleware(UserRegistrationDTO)])
    async register(@body() dto: UserRegistrationDTO, @ctx() c: Context) {
        try {
            console.log('AuthController::register -> ', dto);
            const result = await this.authUseCase.register(dto);
            return this.success(c, result, ResponseMessage.SUCCESSFUL_REGISTRATION);
        } catch (error: any) {
            return this.error(c, error.message, error.statusCode);
        }
    }

    @httpPost("/resend-email-verification", [validationMiddleware(VerifyEmailDTO)])
    async resendEmailVerification(@body() dto: VerifyEmailDTO, @ctx() c: Context) {
        try {
            console.log('AuthController::resendEmailVerification -> ', dto);
            const result = await this.authUseCase.resendEmailVerification(dto);
            return this.success(c, result, ResponseMessage.SUCCESSFUL_REQUEST_MESSAGE);
        } catch (error: any) {
            return this.error(c, error.message, error.statusCode);
        }
    }

    @httpPost("/login", [validationMiddleware(LoginDTO)])
    async login(@body() dto: LoginDTO, @ctx() c: Context) {
        try {
            console.log('AuthController::login -> ', dto);
            const result = await this.authUseCase.login({
                identifier: dto.identifier,
                password: dto.password,
                loginType: dto.loginType
            });
            return this.success(c, result, ResponseMessage.SUCCESSFUL_REQUEST_MESSAGE);
        } catch (error: any) {
            return this.error(c, error.message, error.statusCode);
        }
    }

    @httpPost("/profile-image-upload", [AuthMiddleware.authenticate(), uploadSingle('profile_image')])
    async profileImageUpload(@ctx() c: Context) {
        try {
            const user = c.get('user') as IUser;
            const file = c.get('file');

            if (!file) {
                return this.error(c, "No file uploaded", 400);
            }

            // Mock Multer file to satisfy service interface if needed, or pass file directly if service updated
            // For now, providing a best-effort mock
            const mockMulterFile: any = {
                buffer: Buffer.from(await file.arrayBuffer()),
                originalname: file.name,
                mimetype: file.type,
                size: file.size,
            };

            const result = await this.authUseCase.updateProfileImage(mockMulterFile, user);
            return this.success(c, result, ResponseMessage.SUCCESSFUL_REQUEST_MESSAGE);
        } catch (error: any) {
            return this.error(c, error.message, error.statusCode);
        }
    }

    @httpPost("/refresh", [AuthMiddleware.authenticate(), validationMiddleware(RefreshTokenDTO)])
    async refresh(@body() dto: RefreshTokenDTO, @ctx() c: Context) {
        try {
            const result = await this.authUseCase.refresh(dto);
            return this.success(c, result, ResponseMessage.SUCCESSFUL_REQUEST_MESSAGE);
        } catch (error: any) {
            return this.error(c, error.message, error.statusCode);
        }
    }

    @httpPost("/logout", [AuthMiddleware.initializeContext()])
    async logout(@ctx() c: Context) {
        try {
            const result = await this.authUseCase.logout();
            return this.success(c, result, ResponseMessage.SUCCESSFUL_REQUEST_MESSAGE);
        } catch (error: any) {
            return this.error(c, error.message, error.statusCode);
        }
    }

    /**
     * Request a password reset link
     * @route POST /api/v1/auth/forgot-password
     */
    @httpPost("/forgot-password", [validationMiddleware(ForgotPasswordDTO)])
    async forgotPassword(@body() dto: ForgotPasswordDTO, @ctx() c: Context) {
        try {
            console.log('AuthController::forgotPassword -> ', dto.email);
            const result = await this.authUseCase.forgotPassword(dto);
            return this.success(c, result, "Password reset link has been sent to your email");
        } catch (error: any) {
            return this.error(c, error.message, error.statusCode);
        }
    }

    /**
     * Reset password using token
     * @route POST /api/v1/auth/reset-password
     */
    @httpPost("/reset-password", [validationMiddleware(ResetPasswordDTO)])
    async resetPassword(@body() dto: ResetPasswordDTO, @ctx() c: Context) {
        try {
            console.log('AuthController::resetPassword -> token provided');
            const result = await this.authUseCase.resetPassword(dto);
            return this.success(c, result, "Password has been reset successfully");
        } catch (error: any) {
            return this.error(c, error.message, error.statusCode);
        }
    }

    /**
     * Change password for authenticated user
     * @route PUT /api/v1/auth/change-password
     */
    @httpPut("/change-password", [AuthMiddleware.authenticate(), validationMiddleware(ChangePasswordDTO)])
    async changePassword(@body() dto: ChangePasswordDTO, @ctx() c: Context) {
        try {
            console.log('AuthController::changePassword -> request received');
            const user = c.get('user') as IUser;
            const result = await this.authUseCase.changePassword(dto, user);
            return this.success(c, result, "Password has been changed successfully");
        } catch (error: any) {
            return this.error(c, error.message, error.statusCode);
        }
    }

    /**
     * Get current user profile
     * @route GET /api/v1/auth/me
     */
    @httpGet("/me", [AuthMiddleware.authenticate()])
    async getCurrentUser(@ctx() c: Context) {
        try {
            console.log('AuthController::getCurrentUser -> request received');
            const user = c.get('user') as IUser;
            const result = await this.authUseCase.getCurrentUser(user);
            return this.success(c, result, ResponseMessage.SUCCESSFUL_REQUEST_MESSAGE);
        } catch (error: any) {
            return this.error(c, error.message, error.statusCode);
        }
    }
}
