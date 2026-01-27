import type { Context, Next } from 'hono';

export enum ErrorCode {
    FILE_TOO_LARGE = 'FILE_TOO_LARGE',
    UPLOAD_ERROR = 'UPLOAD_ERROR',
    INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
    NO_VALID_FILES = 'NO_VALID_FILES',
    TOO_MANY_FILES = 'TOO_MANY_FILES'
}

export enum UploadFileType {
    IMAGE = 'image',
    PDF = 'pdf',
    VIDEO = 'video',
    DOCUMENT = 'document'
}

export enum FieldName {
    FILE = 'file',
    FILES = 'files'
}

type File = Blob & { name: string; lastModified: number };

// Helper to validate file
const validateFile = (file: File) => {
    const MAX_SIZE = 1024 * 1024 * 5; // 5MB
    if (file.size > MAX_SIZE) {
        return { valid: false, error: ErrorCode.FILE_TOO_LARGE, message: 'File size exceeds the 5MB limit' };
    }
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
        return { valid: false, error: ErrorCode.INVALID_FILE_TYPE, message: 'Invalid file type. Only JPEG and PNG images are allowed' };
    }
    return { valid: true };
}

// Single file upload middleware
export const uploadSingle = (fieldName: string = FieldName.FILE) => {
    return async (c: Context, next: Next) => {
        try {
            const body = await c.req.parseBody();
            const file = body[fieldName];

            if (!file) {
                return c.json({
                    success: false,
                    message: 'No file uploaded',
                    errorCode: ErrorCode.NO_VALID_FILES
                }, 400);
            }

            if (!(file instanceof Blob)) { // Hono returns Blob/File or string
                return c.json({
                    success: false,
                    message: 'Invalid input',
                    errorCode: ErrorCode.UPLOAD_ERROR
                }, 400);
            }

            const validation = validateFile(file as File);
            if (!validation.valid) {
                return c.json({
                    success: false,
                    message: validation.message,
                    errorCode: validation.error
                }, 400);
            }

            // console.log("File uploaded successfully!!!");
            c.set('file', file); // Store for controller

            await next();
        } catch (err: any) {
            return c.json({
                success: false,
                message: err.message || 'Error uploading file',
                errorCode: ErrorCode.UPLOAD_ERROR
            }, 400);
        }
    };
};

export const uploadMultiple = (fieldName: string = FieldName.FILES, maxCount: number = 10) => {
    return async (c: Context, next: Next) => {
        // Hono parseBody handles multiple files with same key as Array?
        // Let's verify Hono behavior. parseBody returns { key: File | string | (File | string)[] }
        try {
            const body = await c.req.parseBody({ all: true }); // ensure all values are arrays if needed, or check type
            const files = body[fieldName];

            if (!files) {
                return c.json({
                    success: false,
                    message: 'No files uploaded',
                    errorCode: ErrorCode.NO_VALID_FILES
                }, 400);
            }

            const fileList = Array.isArray(files) ? files : [files];

            if (fileList.length > maxCount) {
                return c.json({
                    success: false,
                    message: `Too many files. Maximum is ${maxCount} files`,
                    errorCode: ErrorCode.TOO_MANY_FILES
                }, 400);
            }

            const validFiles: File[] = [];

            for (const f of fileList) {
                if (f instanceof Blob) {
                    const validation = validateFile(f as File);
                    if (!validation.valid) {
                        return c.json({
                            success: false,
                            message: validation.message,
                            errorCode: validation.error
                        }, 400);
                    }
                    validFiles.push(f as File);
                }
            }

            if (validFiles.length === 0) {
                return c.json({
                    success: false,
                    message: 'No valid files uploaded',
                    errorCode: ErrorCode.NO_VALID_FILES
                }, 400);
            }

            c.set('files', validFiles);
            await next();
        } catch (err: any) {
            return c.json({
                success: false,
                message: err.message || 'Error uploading files',
                errorCode: ErrorCode.UPLOAD_ERROR
            }, 400);
        }
    };
};

export const uploadFields = (fields: { name: string; maxCount: number }[]) => {
    // Implement if needed, similar logic
    return async (c: Context, next: Next) => {
        await next();
    }
};