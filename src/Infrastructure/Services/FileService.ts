import { inject, injectable } from "inversify";
import { UploadPurpose } from "@Core/Application/Interface/Entities/file-manager/IFileManager";
import { CreateFileManagerDTO } from "@Core/Application/DTOs/FileManagerDTO";
import { TransactionManager } from "peculiar-orm";
import { UtilityService } from "@Core/Services/UtilityService";
import { Console, LogLevel } from "../Utils/Console";
import { TYPES } from "@Core/Types/Constants";
import { FileManager } from "@Core/Application/Entities/FileManager";
import { FileManagerRepository } from "../Repository/SQL/files/FileManagerRepository";
import { AWSHelper } from "../Services/external-api-services/AWSHelper";
import { IFileService } from "@Core/Application/Interface/Services/IFileService";
import { Readable } from "stream";
import type { UploadedFile } from "@Core/Application/Types/UploadedFile";
import { DatabaseError, ValidationError } from "@Core/Application/Error/AppError";
import { BaseService } from "./base/BaseService";

@injectable()
export class FileService extends BaseService implements IFileService {
    constructor(
        @inject(TYPES.FileManagerRepository) private fileManagerRepository: FileManagerRepository,
        @inject(TYPES.AWSHelper) private awsHelper: AWSHelper,
        @inject(TYPES.TransactionManager) protected readonly transactionManager: TransactionManager
    ) {
        super(transactionManager);
    }
 
    async fileFormatter(Body: Readable, ContentType: string, fileKey: string): Promise<Readable> {
        try {
            Console.write('Formatting file', LogLevel.INFO, { ContentType, fileKey });
            
            // Different handling based on content type
            if (ContentType.startsWith('image/')) {
                // For images, we might resize or compress them
                // This is a placeholder - in a real implementation, you'd use a library like Sharp
                return Body;
            } else if (ContentType.startsWith('application/pdf')) {
                // For PDFs, we might validate them or extract metadata
                return Body;
            } else {
                // Default handling for other file types
                return Body;
            }
        } catch (error: any) {
            Console.write('File formatting error', LogLevel.ERROR, { error: error.message, stack: error.stack });
            throw error;
        }
    }

    validateFileType(fileType: string): void {
        const allowedFileTypes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'application/pdf',
            'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain', 'text/csv'
        ];
        
        if (!allowedFileTypes.includes(fileType.toLowerCase())) {
            Console.write('Invalid file type', LogLevel.WARNING, { fileType, allowedFileTypes });
            throw new ValidationError(`Invalid file type: ${fileType}. Allowed types: ${allowedFileTypes.join(', ')}`);
        }
    }

    validateImageType(fileType: string): void {
        const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        
        if (!allowedImageTypes.includes(fileType.toLowerCase())) {
            Console.write('Invalid image type', LogLevel.WARNING, { fileType, allowedImageTypes });
            throw new ValidationError(`Invalid image type: ${fileType}. Allowed types: ${allowedImageTypes.join(', ')}`);
        }
    }

    validateFileSize(fileSize: number, allowedFileSize?: number): void {
        // Default max file size: 10MB
        const maxFileSize = allowedFileSize || 10 * 1024 * 1024; 
        
        if (fileSize > maxFileSize) {
            const sizeInMB = (fileSize / (1024 * 1024)).toFixed(2);
            const maxSizeInMB = (maxFileSize / (1024 * 1024)).toFixed(2);
            
            Console.write('File size exceeds limit', LogLevel.WARNING, { fileSize: sizeInMB + 'MB', maxSize: maxSizeInMB + 'MB' });
            throw new ValidationError(`File size (${sizeInMB}MB) exceeds the maximum allowed size of ${maxSizeInMB}MB`);
        }
    }
    
    async uploadFile(userId: string, file: UploadedFile): Promise<FileManager> {
        try {
            const date = UtilityService.formatDateToUrlSafeISOFormat(new Date());
            const fileName = this.constructFileName(date, 'file', UploadPurpose.UserProfile);
            // Upload to S3 and get the URL
            const fileUrl = await this.awsHelper.profileImageUpload(file, fileName);
            Console.write('File uploaded to S3', LogLevel.INFO, { fileUrl });
            
            // Save metadata to database
            const fileManagerObject = await this.saveFileMetaDataToDatabaseAsync(
                userId,
                file.mimetype || 'image/jpeg',
                UploadPurpose.UserProfile,
                fileName,
                fileUrl
            );

            

            Console.write('File upload completed', LogLevel.INFO, {
                file_key: fileManagerObject.file_key,
                file_type: fileManagerObject.file_type,
                file_url: fileManagerObject.file_url,
                file_extension: fileManagerObject.file_extension
            });
            

            return fileManagerObject;
        } catch (error: any) {
            Console.write('File upload error', LogLevel.ERROR, { error: error.message, stack: error.stack });
            throw error;
        }
    }

    constructFileName(fileName: string, prefix: string, uploadPurpose: string): string {
        const extension = fileName.split('.').pop();
        const name = fileName.split('.').shift();
        const randomString = Math.random().toString(36).substring(2, 8);
        return `${prefix}-${uploadPurpose}-${name}-${randomString}.${extension}`;
    }

    async saveFileMetaDataToDatabaseAsync(userId: string, fileType: string, uploadPurpose: string, fileName: string, fileUrl: string): Promise<FileManager> {
        try {
            return await this.withTransaction(async () => {
                const fileManagerDTO: CreateFileManagerDTO = {
                    user_id: userId,
                    file_type: fileType,
                    upload_purpose: uploadPurpose,
                    file_name: fileName,
                    file_url: fileUrl
                };

                Console.write('Creating file manager from DTO', LogLevel.INFO, { fileManagerDTO });
                const fileManager = await FileManager.createFromDTO(fileManagerDTO);

                if (uploadPurpose === UploadPurpose.UserProfile) {
                    const existingFiles = await this.fileManagerRepository.findByUserId(userId);
                    const existingProfileImage = existingFiles.find(file => file.upload_purpose === UploadPurpose.UserProfile);

                    if (existingProfileImage) {
                        Console.write('Updating existing profile image record', LogLevel.INFO, {
                            existingFileId: existingProfileImage._id,
                            userId
                        });

                        await this.fileManagerRepository.update(existingProfileImage._id, {
                            file_key: fileManager.file_key,
                            file_type: fileManager.file_type,
                            file_url: fileManager.file_url,
                            file_extension: fileManager.file_extension
                        });

                        return fileManager;
                    }
                }

                Console.write('Saving new file manager to database', LogLevel.INFO, { fileManager });
                const fileManagerObject = await this.fileManagerRepository.create(fileManager);
                Console.write('File manager record created', LogLevel.INFO, { fileManagerObject });

                return fileManagerObject;
            });
        } catch (error: any) {
            Console.write('Error saving file metadata to database', LogLevel.ERROR, { 
                error: error.message, 
                stack: error.stack,
                metadata: { 
                    userId: userId, 
                    fileType: fileType, 
                    uploadPurpose: uploadPurpose, 
                    fileName: fileName, 
                    fileUrl: fileUrl 
                }
            });

            throw new DatabaseError(`Failed to save file metadata: ${error.message}`);
        }
    }
}
