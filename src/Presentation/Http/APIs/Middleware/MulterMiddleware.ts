import type { Context, Next } from 'hono';

export enum ErrorCode {
    FILE_TOO_LARGE = 1301,
    UPLOAD_ERROR = 1302,
    INVALID_FILE_TYPE = 1303,
    NO_VALID_FILES = 1304,
    TOO_MANY_FILES = 1305
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

const uploadError = (c: Context, message: string, errorCode: ErrorCode, status = 400) => {
    return c.json({
        success: false,
        message,
        error_code: errorCode,
        data: null,
    }, status as 400);
};

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
                return uploadError(c, 'No file uploaded', ErrorCode.NO_VALID_FILES);
            }

            if (!(file instanceof Blob)) { // Hono returns Blob/File or string
                return uploadError(c, 'Invalid input', ErrorCode.UPLOAD_ERROR);
            }

            const validation = validateFile(file as File);
            if (!validation.valid) {
                return uploadError(c, validation.message ?? 'Invalid file upload', validation.error as ErrorCode);
            }

            c.set('file', file); // Store for controller

            await next();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error uploading file';
            return uploadError(c, message, ErrorCode.UPLOAD_ERROR);
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
                return uploadError(c, 'No files uploaded', ErrorCode.NO_VALID_FILES);
            }

            const fileList = Array.isArray(files) ? files : [files];

            if (fileList.length > maxCount) {
                return uploadError(c, `Too many files. Maximum is ${maxCount} files`, ErrorCode.TOO_MANY_FILES);
            }

            const validFiles: File[] = [];

            for (const f of fileList) {
                if (f instanceof Blob) {
                    const validation = validateFile(f as File);
                    if (!validation.valid) {
                        return c.json({
                            success: false,
                            message: validation.message,
                            error_code: validation.error,
                            data: null,
                        }, 400);
                    }
                    validFiles.push(f as File);
                }
            }

            if (validFiles.length === 0) {
                return uploadError(c, 'No valid files uploaded', ErrorCode.NO_VALID_FILES);
            }

            c.set('files', validFiles);
            await next();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error uploading files';
            return uploadError(c, message, ErrorCode.UPLOAD_ERROR);
        }
    };
};

export const uploadFields = (fields: { name: string; maxCount: number }[]) => {
    void fields;
    // Implement if needed, similar logic
    return async (c: Context, next: Next) => {
        await next();
    }
};
