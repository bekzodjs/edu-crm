import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { IsIn, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync, unlink } from 'fs';
import { join } from 'path';
import { User } from '../database/schemas';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, AppRole } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

const ALL_ROLES: AppRole[] = ['SUPERADMIN', 'ADMIN', 'RAHBAR', 'TEACHER'];

export class CreateUserDto {
  @IsString()
  @IsNotEmpty({ message: 'Ism kiritilishi shart' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Telefon kiritilishi shart' })
  phone: string;

  @IsString()
  @MinLength(4, { message: "Parol kamida 4 ta belgidan iborat bo'lishi kerak" })
  password: string;

  @IsIn(ALL_ROLES, { message: "Rol noto'g'ri" })
  role: AppRole;

  @IsOptional()
  @IsString()
  teacherId?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: "Ism bo'sh bo'lmasligi kerak" })
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: "Telefon bo'sh bo'lmasligi kerak" })
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(4, { message: "Parol kamida 4 ta belgidan iborat bo'lishi kerak" })
  password?: string;

  @IsOptional()
  @IsIn(ALL_ROLES, { message: "Rol noto'g'ri" })
  role?: AppRole;

  @IsOptional()
  @IsString()
  teacherId?: string;
}

export class UpdateOwnProfileDto {
  currentPassword?: string;
  newPassword?: string;
}

export class ResetUserPasswordDto {
  newPassword: string;
}

interface UploadedFileLike {
  originalname: string;
  filename: string;
  path: string;
  size: number;
  mimetype: string;
}

const AVATAR_UPLOAD_ROOT = join(process.cwd(), 'uploads', 'avatars');

function toSafeUser(user: User, includePlain = false) {
  const obj: any = user.toObject ? user.toObject() : user;
  delete obj.password;
  if (!includePlain) delete obj.plainPassword;
  return obj;
}

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async findAll(requesterRole: string) {
    const users = await this.userModel.find().sort({ name: 1 });
    const includePlain = requesterRole === 'SUPERADMIN';
    return users.map((u) => toSafeUser(u, includePlain));
  }

  async findOne(id: string) {
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    return toSafeUser(user);
  }

  private assertNotSuperadminRole(role?: string) {
    if (role === 'SUPERADMIN') {
      throw new ForbiddenException('Tizimda faqat bitta superadmin bo‘lishi mumkin');
    }
  }

  private async assertPhoneFree(phone: string, exceptId?: string) {
    const exists = await this.userModel.findOne({ phone });
    if (exists && exists.id !== exceptId) {
      throw new ConflictException('Bu telefon raqam bilan foydalanuvchi allaqachon mavjud');
    }
  }

  async create(dto: CreateUserDto) {
    this.assertNotSuperadminRole(dto.role);
    dto.phone = dto.phone.trim();
    await this.assertPhoneFree(dto.phone);

    const hashed = await bcrypt.hash(dto.password, 10);
    const user = await this.userModel.create({
      name: dto.name,
      phone: dto.phone,
      password: hashed,
      plainPassword: dto.password,
      role: dto.role,
      teacherId: dto.teacherId,
    });
    return toSafeUser(user);
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');

    if (dto.role !== undefined && dto.role !== user.role) {
      if (user.role === 'SUPERADMIN') {
        throw new ForbiddenException('Superadminning rolini o‘zgartirib bo‘lmaydi');
      }
      this.assertNotSuperadminRole(dto.role);
    }
    if (dto.phone !== undefined) {
      dto.phone = dto.phone.trim();
      if (dto.phone !== user.phone) await this.assertPhoneFree(dto.phone, id);
    }

    if (dto.name !== undefined) user.name = dto.name;
    if (dto.phone !== undefined) user.phone = dto.phone;
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.teacherId !== undefined) user.teacherId = dto.teacherId;
    if (dto.password) {
      user.password = await bcrypt.hash(dto.password, 10);
      user.plainPassword = dto.password;
    }

    await user.save();
    return toSafeUser(user);
  }

  async remove(id: string, currentUserId: string) {
    if (id === currentUserId) {
      throw new ForbiddenException("O'zingizning hisobingizni bu yerdan o'chira olmaysiz");
    }
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    if (user.role === 'SUPERADMIN') {
      throw new ForbiddenException('Superadmin hisobini o‘chirib bo‘lmaydi');
    }
    await user.deleteOne();
    return { ok: true };
  }

  async resetPassword(id: string, dto: ResetUserPasswordDto, currentUser: { role: string }) {
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    if (currentUser.role === 'ADMIN' && (user.role === 'SUPERADMIN' || user.role === 'ADMIN')) {
      throw new ForbiddenException(
        "Faqat superadmin boshqa administrator yoki superadminning parolini almashtira oladi",
      );
    }
    if (!dto.newPassword || dto.newPassword.length < 4) {
      throw new BadRequestException("Yangi parol kamida 4 ta belgidan iborat bo'lishi kerak");
    }
    user.password = await bcrypt.hash(dto.newPassword, 10);
    user.plainPassword = dto.newPassword;
    await user.save();
    return toSafeUser(user);
  }

  async updateOwnPassword(userId: string, dto: UpdateOwnProfileDto) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    if (!dto.newPassword || dto.newPassword.length < 4) {
      throw new BadRequestException("Yangi parol kamida 4 ta belgidan iborat bo'lishi kerak");
    }
    if (!dto.currentPassword) {
      throw new BadRequestException('Joriy parolni kiriting');
    }
    const ok = await bcrypt.compare(dto.currentPassword, user.password);
    if (!ok) throw new UnauthorizedException("Joriy parol noto'g'ri");

    user.password = await bcrypt.hash(dto.newPassword, 10);
    user.plainPassword = dto.newPassword;
    await user.save();
    return toSafeUser(user);
  }

  async setOwnAvatar(userId: string, file: UploadedFileLike) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    if (user.avatarUrl) {
      unlink(join(process.cwd(), user.avatarUrl.replace(/^\//, '')), () => {});
    }
    user.avatarUrl = `/uploads/avatars/${userId}/${file.filename}`;
    await user.save();
    return toSafeUser(user);
  }

  async removeOwnAvatar(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    if (user.avatarUrl) {
      unlink(join(process.cwd(), user.avatarUrl.replace(/^\//, '')), () => {});
    }
    user.avatarUrl = undefined;
    await user.save();
    return toSafeUser(user);
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() currentUser: { userId: string }) {
    return this.usersService.findOne(currentUser.userId);
  }

  @Patch('me/password')
  updateOwnPassword(@CurrentUser() currentUser: { userId: string }, @Body() dto: UpdateOwnProfileDto) {
    return this.usersService.updateOwnPassword(currentUser.userId, dto);
  }

  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req: any, _file: any, cb: any) => {
          const userId = req.user?.userId || 'misc';
          const dir = join(AVATAR_UPLOAD_ROOT, userId);
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req: any, file: any, cb: any) => {
          const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
          cb(null, `${Date.now()}-${safe}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadOwnAvatar(@CurrentUser() currentUser: { userId: string }, @UploadedFile() file: UploadedFileLike) {
    return this.usersService.setOwnAvatar(currentUser.userId, file);
  }

  @Delete('me/avatar')
  removeOwnAvatar(@CurrentUser() currentUser: { userId: string }) {
    return this.usersService.removeOwnAvatar(currentUser.userId);
  }

  @Roles('SUPERADMIN', 'ADMIN')
  @Get()
  findAll(@CurrentUser() currentUser: { role: string }) {
    return this.usersService.findAll(currentUser.role);
  }

  @Roles('SUPERADMIN')
  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Roles('SUPERADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Roles('SUPERADMIN')
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() currentUser: { userId: string }) {
    return this.usersService.remove(id, currentUser.userId);
  }

  @Roles('SUPERADMIN', 'ADMIN')
  @Patch(':id/password')
  resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetUserPasswordDto,
    @CurrentUser() currentUser: { role: string },
  ) {
    return this.usersService.resetPassword(id, dto, currentUser);
  }
}

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
