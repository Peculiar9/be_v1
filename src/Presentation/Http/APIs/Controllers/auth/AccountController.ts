import { controller, httpGet, httpPost, httpPut, ctx, body } from "hono-injector";
import { BaseController } from "../BaseController";
import { inject } from "inversify";
import { TYPES } from "@Core/Types/Constants";
import { IAccountUseCase } from "@Core/Application/Interface/UseCases/IAccountUseCase";
import { Context } from "hono";
import { CreateUserDTO, UpdateUserDTO } from "@Core/Application/DTOs/UserDTO";
import { validationMiddleware } from "../../Middleware/ValidationMiddleware";
import AuthMiddleware from "../../Middleware/AuthMiddleware";
import { uploadSingle } from "../../Middleware/MulterMiddleware";
import { IUser } from "@Core/Application/Interface/Entities/auth-and-user/IUser";
import { ResponseMessage } from "@Core/Application/Response/ResponseFormat";

@controller("/accounts")
export class AccountController extends BaseController {
  constructor(
    @inject(TYPES.AccountUseCase) private readonly accountUseCase: IAccountUseCase
  ) {
    super();
  }

  @httpPost("/admin/create", [AuthMiddleware.authenticate(), validationMiddleware(CreateUserDTO)])
  async createAdmin(@body() dto: CreateUserDTO, @ctx() c: Context) {
    try {
      const result = await this.accountUseCase.createAdmin(dto);
      return this.success(c, result, "Admin created successfully");
    } catch (error: any) {
      return this.error(c, error.message, error.statusCode);
    }
  }

  @httpPut("/profile", [AuthMiddleware.authenticate(), validationMiddleware(UpdateUserDTO)])
  async updateProfile(@body() dto: UpdateUserDTO, @ctx() c: Context) {
    try {
      const user = c.get('user') as IUser;
      const result = await this.accountUseCase.updateProfile(user._id as string, dto, user);
      return this.success(c, result, "Profile updated successfully");
    } catch (error: any) {
      return this.error(c, error.message, error.statusCode);
    }
  }

  @httpGet("/profile", [AuthMiddleware.authenticate()])
  async getUserProfile(@ctx() c: Context) {
    try {
      const user = c.get('user') as IUser;
      const result = await this.accountUseCase.getUserProfile(user._id as string);
      return this.success(c, result, ResponseMessage.SUCCESSFUL_REQUEST_MESSAGE);
    } catch (error: any) {
      return this.error(c, error.message, error.statusCode);
    }
  }

  @httpPost("/profile-image", [AuthMiddleware.authenticate(), uploadSingle('profile_image')])
  async updateProfileImage(@ctx() c: Context) {
    try {
      const file = c.get('file');
      if (!file) {
        return this.error(c, "No file uploaded", 400);
      }
      const user = c.get('user') as IUser;

      // Mock Multer file if needed
      const mockMulterFile: any = {
        buffer: Buffer.from(await file.arrayBuffer()),
        originalname: file.name,
        mimetype: file.type,
        size: file.size
      };

      const result = await this.accountUseCase.updateProfileImage(mockMulterFile, user);
      return this.success(c, result, "Profile image updated successfully");
    } catch (error: any) {
      return this.error(c, error.message, error.statusCode);
    }
  }
}
