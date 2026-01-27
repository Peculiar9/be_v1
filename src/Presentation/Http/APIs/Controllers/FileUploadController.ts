import { controller, httpGet, httpPost, ctx } from 'hono-injector';
import { Context } from 'hono';
import { BaseController } from './BaseController';
import { ResponseMessage } from '@Core/Application/Response/ResponseFormat';
import { AuthMiddleware } from '../Middleware/AuthMiddleware';
import { uploadSingle } from '../Middleware/MulterMiddleware';

interface FileUploadResponseDTO {
    file_id: string;
    file_url: string;
    file_name: string;
    file_size: number;
    mime_type: string;
}

@controller(`/files-mock`) // Renamed to avoid current conflict if both registered
export class FileUploadController extends BaseController {
    constructor() {
        super();
    }

    @httpGet("/")
    async base(@ctx() c: Context) {
        try {
            return this.success(c, {}, ResponseMessage.SUCCESSFUL_REQUEST_MESSAGE);
        } catch (error: any) {
            return this.error(c, error.message, error.statusCode);
        }
    }

    @httpPost("/upload", [AuthMiddleware.authenticate(), uploadSingle('file')])
    async uploadFile(@ctx() c: Context) {
        try {
            const file = c.get('file');

            if (!file) {
                return this.error(c, "No file provided", 400);
            }

            // Mock file upload response
            const mockResponse: FileUploadResponseDTO = {
                file_id: `file-${Date.now()}`,
                file_url: `https://example.com/uploads/${file.name}`,
                file_name: file.name,
                file_size: file.size,
                mime_type: file.type
            };

            return this.success(c, mockResponse, ResponseMessage.SUCCESSFUL_REQUEST_MESSAGE);
        } catch (error: any) {
            return this.error(c, error.message, error.statusCode);
        }
    }
}
