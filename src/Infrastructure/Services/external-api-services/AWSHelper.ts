import { injectable } from "inversify";
import { EmailData } from "../data/EmailData";
import { EmailType } from "@Core/Application/Enums/EmailType";
import { SMSData } from "../data/SMSData";
import { BucketName } from "@Core/Application/Enums/BucketName";
import { AWSBaseServices } from "./AWSBaseServices";
import { PublishCommand } from "@aws-sdk/client-sns";
import type { IAWSHelper } from "@Core/Application/Interface/Services/IAWSHelper";
import { ComparedFace, CompareFacesCommandOutput } from "@aws-sdk/client-rekognition";
import { FileFormat } from "@Core/Application/Enums/FileFormat";
import type { UploadedFile } from "@Core/Application/Types/UploadedFile";
import { ServiceError } from "@Core/Application/Error/AppError";
import { Console, LogLevel } from "../../Utils/Console";

@injectable()
export class AWSHelper extends AWSBaseServices implements IAWSHelper {
    constructor() {
        super();
    }

    async sendVerificationEmail(to: string, data: EmailData): Promise<boolean> {
        const template = await this.getEmailTemplate(EmailType.VERIFICATION, data);
        return await this.sendEmail(
            to,
            'Verify Your Email Address',
            template
        );
    }

    async sendWaitlistEmail(to: string, data: EmailData): Promise<boolean> {
        const template = await this.getEmailTemplate(EmailType.WAITLIST, data);
        return await this.sendEmail(
            to,
            'Welcome to Our Waitlist',
            template
        );
    }

    async sendSubscriptionEmail(to: string, data: EmailData): Promise<boolean> {
        const template = await this.getEmailTemplate(EmailType.SUBSCRIPTION, data);
        return await this.sendEmail(
            to,
            'Subscription Confirmation',
            template
        );
    }

    async sendForgotPasswordEmail(to: string, data: EmailData): Promise<boolean> {
        const template = await this.getEmailTemplate(EmailType.FORGOT_PASSWORD, data);
        return await this.sendEmail(
            to,
            'Password Reset Request',
            template
        );
    }

    async sendProfileUpdateEmail(to: string, data: EmailData): Promise<boolean> {
        const template = await this.getEmailTemplate(EmailType.PROFILE_UPDATE, data);
        return await this.sendEmail(
            to,
            'Profile Update Verification',
            template
        );
    }

    async sendOTPEmail(to: string, data: EmailData): Promise<boolean> {
        const template = await this.getEmailTemplate(EmailType.OTP, data);
        return await this.sendEmail(
            to,
            'Your Verification Code',
            template
        );
    }

    async sendPasswordResetOTPEmail(to: string, data: EmailData): Promise<boolean> {
        const template = await this.getEmailTemplate(EmailType.PASSWORD_RESET_OTP, data);
        return await this.sendEmail(
            to,
            'Your Password Reset Code',
            template
        );
    }

    async sendSMS(data: SMSData, smsType: string): Promise<any> {
        try {
            // Sanitize message and attributes
            const sanitizedMessage = this.sanitizeMessage(data.message);
            const sanitizedPhone = this.sanitizePhoneNumber(data.recipient);

            const params = {
                Message: sanitizedMessage,
                PhoneNumber: sanitizedPhone,
                MessageAttributes: {
                    'AWS.SNS.SMS.SMSType': {
                        DataType: 'String',
                        StringValue: smsType === 'SINGLE' ? 'Transactional' : 'Promotional'
                    },
                    'AWS.SNS.SMS.SenderID': {
                        DataType: 'String',
                        StringValue: process.env.AWS_SNS_SENDER_ID || 'GRWLZ'
                    }
                }
            };

            return await this.snsClient.send(new PublishCommand(params));
        } catch (error: any) {
            throw new ServiceError(`Failed to send SMS: ${error.message}`);
        }
    }

    private sanitizeMessage(message: string): string {
        // Remove or replace problematic characters
        return message
            .replace(/[^\w\s.,!?@#$%&*()-]/g, '') // Keep only alphanumeric and common punctuation
            .trim();
    }

    private sanitizePhoneNumber(phone: string): string {
        // Ensure phone number is in E.164 format
        return phone.replace(/[^\d+]/g, '');
    }

    async licenseDetailsUpload(file: UploadedFile | Buffer | string, fileKey: string): Promise<void> {
        const uploadData = {
            bucketName: BucketName.VERIFICATION,
            directoryPath: `license/`,
            fileName: fileKey,
            fileBody: this.toFileBody(file),
            contentType: this.toContentType(file),
        };
        await this.uploadFile(uploadData);
    }

    async carImageUpload(file: UploadedFile, fileKey: string): Promise<string> {
        const uploadData = {
            bucketName: BucketName.VERIFICATION,
            directoryPath: `carImage/`,
            fileName: fileKey,
            fileBody: file.buffer,
            contentType: file.mimetype,
        };
        await this.uploadFile(uploadData);
        return this.toPublicS3Url(BucketName.VERIFICATION, `${uploadData.directoryPath}${fileKey}`);
    }

    async profileImageUpload(file: UploadedFile, fileKey: string): Promise<string> {
        // Get file extension from mimetype or default to jpg
        const extension = file.mimetype ? file.mimetype.split('/')[1] || 'jpg' : 'jpg';
        const fileKeyWithExt = `${fileKey}.${extension}`;

        const uploadData = {
            bucketName: BucketName.MEDIA_ARCHIVE,
            directoryPath: `profileImage/`,
            fileName: fileKeyWithExt,
            fileBody: file.buffer,
            contentType: file.mimetype || 'image/jpeg',
        };

        await this.uploadFile(uploadData);

        // Construct and return the full URL
        const region = process.env.AWS_REGION || 'us-east-1';
        return `https://${BucketName.MEDIA_ARCHIVE}.s3.${region}.amazonaws.com/${uploadData.directoryPath}${fileKeyWithExt}`;
    }

    async batchImageUpload(
        files: Array<UploadedFile | Buffer | string>,
        fileKey: string[],
        bucketName: BucketName,
        directoryPath: string = ''
    ): Promise<string[]> {
        const urls: string[] = [];
        await Promise.all(files.map(async (file, index: number) => {
            const uploadData = {
                bucketName,
                directoryPath: `${directoryPath}/`,
                fileName: fileKey[index],
                fileBody: this.toFileBody(file),
                contentType: this.toContentType(file) || FileFormat.JPEG,
            };

            await this.uploadFile(uploadData);
            const fileUrl = `https://${bucketName}.s3.amazonaws.com/${fileKey[index]}`;
            urls.push(fileUrl);
        }));

        return urls;
    }

    async batchImageDelete(
        fileKeys: string[],
        bucketName: BucketName,
        directoryPath: string = ''
    ): Promise<string[]> {
        const deletedKeys: string[] = [];

        await Promise.all(fileKeys.map(async (fileKey: string) => {
            const fullPath = `${directoryPath}/${fileKey}`.replace(/^\/+/, '');
            try {
                await this.removeFile({
                    bucketName,
                    fileName: fullPath,
                });
                deletedKeys.push(fullPath);
            } catch (error) {
                Console.write('Failed to delete batch image', LogLevel.WARNING, {
                    fileKey: fullPath,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }));

        return deletedKeys;
    }

    async selfieUpload(file: UploadedFile, fileKey: string): Promise<string> {
        const uploadData = {
            bucketName: BucketName.VERIFICATION,
            directoryPath: `selfie/`,
            fileName: fileKey,
            fileBody: file.buffer,
            contentType: file.mimetype,
        };

        await this.uploadFile(uploadData);
        return this.toPublicS3Url(BucketName.VERIFICATION, `${uploadData.directoryPath}${fileKey}`);
    }
    /**
     * Generate a presigned upload URL for a given bucket/key/contentType
     */
    async generatePresignedUploadUrl(bucketName: string, key: string, contentType: string, expiresIn: number = 300): Promise<string> {
        const { PutObjectCommand } = await import("@aws-sdk/client-s3");
        const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            ContentType: contentType,
        });
        return await getSignedUrl(this.s3KYCClient, command, { expiresIn });
    }

    /**
     * Delete a file from a given bucket/key
     */
    async deleteFile(bucketName: string, key: string): Promise<void> {
        await this.removeFile({ bucketName, fileName: key });
    }

    /**
     * Extract text from a document in S3 using Rekognition DetectText
     */
    async extractDocumentText(fileKey: string): Promise<string[]> {
        const { DetectTextCommand } = await import("@aws-sdk/client-rekognition");
        const command = new DetectTextCommand({
            Image: {
                S3Object: {
                    Bucket: BucketName.VERIFICATION,
                    Name: fileKey,
                },
            },
        });
        const response = await this.rekognitionClient.send(command);
        return (response.TextDetections || []).map(d => d.DetectedText || '').filter(Boolean);
    }

    /**
     * Detect if an image contains valid vehicle labels using Rekognition DetectLabels
     */
    async detectImageObject(fileKey: string, validLabels: string[]): Promise<boolean> {
        const { DetectLabelsCommand } = await import("@aws-sdk/client-rekognition");
        const command = new DetectLabelsCommand({
            Image: {
                S3Object: {
                    Bucket: BucketName.VERIFICATION,
                    Name: fileKey,
                },
            },
            MaxLabels: 20,
            MinConfidence: 70,
        });
        const response = await this.rekognitionClient.send(command);
        const labels = response.Labels || [];
        return labels.some(label => label.Name && validLabels.includes(label.Name));
    }
    extractLicenseDocumentText(fileKey: string): Promise<string[]> {
        return this.extractDocumentText(fileKey);
    }
    async analyzeDocuments(documentKeyTarget: string, documentKeySource: string): Promise<[number, ComparedFace]> {
        const output = await this.compareFaces(documentKeySource, documentKeyTarget);
        const bestMatch = output?.FaceMatches?.[0]?.Face;
        const similarity = output?.FaceMatches?.[0]?.Similarity ?? 0;

        return [similarity, bestMatch ?? {} as ComparedFace];
    }
    async compareFaces(sourceImage: string, targetImage: string): Promise<CompareFacesCommandOutput | void> {
        const { CompareFacesCommand } = await import("@aws-sdk/client-rekognition");
        const command = new CompareFacesCommand({
            SourceImage: {
                S3Object: {
                    Bucket: BucketName.VERIFICATION,
                    Name: sourceImage,
                },
            },
            TargetImage: {
                S3Object: {
                    Bucket: BucketName.VERIFICATION,
                    Name: targetImage,
                },
            },
            SimilarityThreshold: 80,
        });

        return await this.rekognitionClient.send(command);
    }

    private toFileBody(file: UploadedFile | Buffer | string): Buffer | string {
        if (Buffer.isBuffer(file) || typeof file === 'string') {
            return file;
        }

        return file.buffer;
    }

    private toContentType(file: UploadedFile | Buffer | string): string | undefined {
        if (Buffer.isBuffer(file) || typeof file === 'string') {
            return undefined;
        }

        return file.mimetype;
    }

    private toPublicS3Url(bucketName: BucketName, key: string): string {
        return `https://${bucketName}.s3.amazonaws.com/${key}`;
    }
}
