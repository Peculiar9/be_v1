import { controller, httpPost, ctx } from "hono-injector";
import { BaseController } from "./BaseController";
import { Context } from "hono";
import { inject } from "inversify";
import { TYPES } from "@Core/Types/Constants";
import AuthMiddleware from "../Middleware/AuthMiddleware";
import { uploadSingle } from "../Middleware/MulterMiddleware";
import { ValidationError } from "@Core/Application/Error/AppError";
import { IUser } from "@Core/Application/Interface/Entities/auth-and-user/IUser";
import { IFileUseCase } from "@Core/Application/Interface/UseCases/IFileUseCase";

@controller(`/files`)
export class FileController extends BaseController {
    constructor(
        @inject(TYPES.FileUseCase) private readonly fileUseCase: IFileUseCase
    ) {
        super();
    }

    /**
     * Upload single file/image/document utility endpoint
     * POST /files/upload
     */
    @httpPost("/upload", [AuthMiddleware.authenticate(), uploadSingle('file')])
    async uploadFile(@ctx() c: Context) {
        try {
            const user = c.get('user') as IUser;
            const userId = user?._id;

            if (!userId) {
                return this.error(c, 'User authentication required', 401);
            }

            const file = c.get('file') as File; // from FileUploadMiddleware
            if (!file) {
                throw new ValidationError('File is required');
            }

            // Get upload purpose and file category from form data
            const body = await c.req.parseBody();
            const uploadPurpose = body['upload_purpose'] as string;
            const fileCategory = (body['file_category'] as string) || 'general';

            if (!uploadPurpose) {
                throw new ValidationError('Upload purpose is required (e.g., profile_image, certificate, license_document, etc.)');
            }

            // console.log('FileController::uploadFile -> ', {
            //     userId,
            //     uploadPurpose,
            //     fileCategory,
            //     fileSize: file.size,
            //     mimeType: file.type
            // });

            // Mock multer file for use case
            const mockMulterFile: any = {
                buffer: Buffer.from(await file.arrayBuffer()),
                originalname: file.name,
                mimetype: file.type,
                size: file.size,
            };

            // Use FileUseCase for proper abstraction
            const result = await this.fileUseCase.uploadFile(userId, mockMulterFile, uploadPurpose, fileCategory);

            return this.success(c, result, 'File uploaded successfully');
        } catch (error: any) {
            console.error('FileController::uploadFile error:', error);
            return this.error(c, error.message, error.statusCode || 500, error);
        }
    }
}
