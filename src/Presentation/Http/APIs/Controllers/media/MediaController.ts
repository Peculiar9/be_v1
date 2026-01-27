import type { Context } from 'hono';
import { injectable, inject } from 'inversify';
import { controller, httpPost, httpDelete, httpGet, ctx } from 'hono-injector';
import { BaseController } from '../BaseController';
import { TYPES } from '@Core/Types/Constants';
import type { IMediaService, ImageTransformation } from '@Core/Application/Interface/Services/IMediaService';
import { AuthMiddleware } from '../../Middleware/AuthMiddleware';
import { uploadSingle, uploadMultiple, FieldName } from '../../Middleware/MulterMiddleware';

@controller('/media')
export class MediaController extends BaseController {
    constructor(
        @inject(TYPES.MediaService) private readonly mediaService: IMediaService,
        @inject(TYPES.AuthMiddleware) private readonly authMiddleware: AuthMiddleware
    ) {
        super();
    }

    /**
     * Upload a single file
     * @route POST /api/v1/media/upload
     */
    @httpPost('/upload', [uploadSingle(FieldName.FILE)])
    async uploadFile(@ctx() c: Context) {
        try {
            const file = c.get('file');
            if (!file) {
                return this.error(c, 'No file provided', 400);
            }

            // Get folder from query params or use default
            const folder = c.req.query('folder') || 'uploads';

            // Get public_id from query params if available
            const publicId = c.req.query('public_id');

            // Extract file type from mimetype
            const resourceType = file.type.startsWith('image/') ? 'image' as const :
                file.type.startsWith('video/') ? 'video' as const : 'raw' as const;

            const uploadOptions = {
                folder,
                publicId,
                resourceType
            };

            const result = await this.mediaService.uploadFile(await file.arrayBuffer(), uploadOptions);

            return this.success(c, {
                url: result.url,
                secureUrl: result.secureUrl,
                publicId: result.publicId,
                format: result.format,
                size: result.bytes,
                resourceType: result.resourceType
            }, 'File uploaded successfully');
        } catch (error: any) {
            console.error('Error uploading file:', error);
            return this.error(c, `Failed to upload file: ${error.message}`, 500, error);
        }
    }

    /**
     * Upload multiple files
     * @route POST /api/v1/media/upload/multiple
     */
    @httpPost('/upload/multiple', [uploadMultiple(FieldName.FILES)])
    async uploadMultipleFiles(@ctx() c: Context) {
        try {
            const files = c.get('files') as any[]; // From Hono Context
            if (!files || files.length === 0) {
                return this.error(c, 'No files provided', 400);
            }

            // Get folder from query params or use default
            const folder = c.req.query('folder') || 'uploads';

            // Process files one by one
            const uploadPromises = files.map(async file => {
                const buffer = await file.arrayBuffer();
                return this.mediaService.uploadFile(buffer, {
                    folder,
                    resourceType: file.type.startsWith('image/') ? 'image' as const :
                        file.type.startsWith('video/') ? 'video' as const : 'raw' as const
                });
            });

            const results = await Promise.all(uploadPromises);

            const responseData = results.map(result => ({
                url: result.url,
                secureUrl: result.secureUrl,
                publicId: result.publicId,
                format: result.format,
                size: result.bytes,
                resourceType: result.resourceType
            }));

            return this.success(c, responseData, 'Files uploaded successfully');
        } catch (error: any) {
            console.error('Error uploading multiple files:', error);
            return this.error(c, `Failed to upload files: ${error.message}`, 500, error);
        }
    }

    /**
     * Delete a file by public ID
     * @route DELETE /api/v1/media/:publicId
     */
    @httpDelete('/:publicId')
    async deleteFile(@ctx() c: Context) {
        try {
            const publicId = c.req.param('publicId');
            if (!publicId) {
                return this.error(c, 'Public ID is required', 400);
            }

            const result = await this.mediaService.deleteFile(publicId);

            if (!result.success) {
                return this.error(c, result.message || 'Failed to delete file', result.statusCode || 400);
            }

            return this.success(c, result, 'File deleted successfully');
        } catch (error: any) {
            console.error('Error deleting file:', error);
            return this.error(c, `Failed to delete file: ${error.message}`, 500, error);
        }
    }

    /**
     * Get transformation URL for an image
     * @route GET /api/v1/media/transform/:publicId
     */
    @httpGet('/transform/:publicId')
    async getTransformedUrl(@ctx() c: Context) {
        try {
            const publicId = c.req.param('publicId');
            if (!publicId) {
                return this.error(c, 'Public ID is required', 400);
            }

            // Parse transformation options from query params
            const transformations: ImageTransformation = {
                width: c.req.query('width') ? parseInt(c.req.query('width') as string) : undefined,
                height: c.req.query('height') ? parseInt(c.req.query('height') as string) : undefined,
                crop: c.req.query('crop') as "fill" | "scale" | "fit" | "thumb" | "crop" | undefined,
                gravity: c.req.query('gravity') as "auto" | "face" | "center" | "north" | "south" | "east" | "west" | undefined,
                quality: c.req.query('quality') ? parseInt(c.req.query('quality') as string) : undefined,
                format: c.req.query('format') as "auto" | "jpg" | "png" | "webp" | "gif" | undefined,
                effect: c.req.query('effect') as string,
                angle: c.req.query('angle') ? parseInt(c.req.query('angle') as string) : undefined,
                radius: c.req.query('radius') ? parseInt(c.req.query('radius') as string) : undefined,
                background: c.req.query('background') as string,
            };

            const url = await this.mediaService.getTransformedUrl(publicId, transformations);

            return this.success(c, { url }, 'Transformation URL generated successfully');
        } catch (error: any) {
            console.error('Error generating transformation URL:', error);
            return this.error(c, `Failed to generate transformation URL: ${error.message}`, 500, error);
        }
    }

    /**
     * Get file details by public ID
     * @route GET /api/v1/media/:publicId
     */
    @httpGet('/:publicId')
    async getFileDetails(@ctx() c: Context) {
        try {
            const publicId = c.req.param('publicId');
            if (!publicId) {
                return this.error(c, 'Public ID is required', 400);
            }

            const details = await this.mediaService.getFileDetails(publicId);

            return this.success(c, details, 'File details retrieved successfully');
        } catch (error: any) {
            console.error('Error retrieving file details:', error);
            return this.error(c, `Failed to retrieve file details: ${error.message}`, 500, error);
        }
    }
}
