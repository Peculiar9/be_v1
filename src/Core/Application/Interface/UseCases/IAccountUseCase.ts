import type { IUser } from '../Entities/auth-and-user/IUser';
import { UserResponseDTO, UpdateUserDTO, CreateUserDTO } from '../../DTOs/UserDTO';
import { VerifyEmailDTO, IEmailVerificationResponse, LoginResponseDTO } from '../../DTOs/AuthDTO';
import type { UploadedFile } from '../../Types/UploadedFile';

export interface IAccountUseCase {
  updateProfileImage(image: UploadedFile, user: IUser): Promise<UserResponseDTO>;
  resendEmailVerification(email: string, reference: string): Promise<IEmailVerificationResponse>;
  removeUser(email: string): Promise<UserResponseDTO | undefined>;
  verifyEmailCode(data: VerifyEmailDTO): Promise<LoginResponseDTO>;

  // Admin/User creation
  createAdmin(dto: CreateUserDTO): Promise<UserResponseDTO>;

  // Message profile
  updateProfile(userId: string, dto: UpdateUserDTO, existingUser: IUser): Promise<UserResponseDTO>;
  getUserProfile(userId: string): Promise<UserResponseDTO>;
}
