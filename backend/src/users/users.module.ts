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
  OnModuleInit,
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
import { Teacher, User } from '../database/schemas';
import { extensionFilter, IMAGE_EXTENSIONS, safeFilename } from '../common/utils/upload';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, AppRole } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

// ---------- DTO ----------
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
  @IsOptional()
  @IsString()
  currentPassword?: string;

  @IsOptional()
  @IsString()
  newPassword?: string;
}

export class ResetUserPasswordDto {
  @IsString()
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

// Parol (hatto hash ko'rinishida ham) hech qachon API orqali qaytarilmaydi.
// Ochiq matnli parollar umuman saqlanmaydi — unutilgan parol "Parolni almashtirish" orqali tiklanadi.
function toSafeUser(user: User) {
  const obj: any = user.toObject ? user.toObject() : user;
  delete obj.password;
  delete obj.plainPassword;
  return obj;
}

/**
 * Tizimga kiradigan hisoblarni (SUPERADMIN, ADMIN, RAHBAR, TEACHER) boshqarish.
 * Ro'yxatni ko'rish SUPERADMIN va ADMIN uchun ochiq; qo'shish/tahrirlash/o'chirish
 * faqat SUPERADMIN'ga tegishli. Bundan tashqari har bir foydalanuvchi o'zining
 * shaxsiy profilini (rasm, parol) /users/me orqali o'zi boshqaradi.
 */
@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Teacher.name) private teacherModel: Model<Teacher>,
  ) {}

  // Avvalgi versiyalar parollarning ochiq matnli nusxasini (plainPassword) saqlagan —
  // ilova ishga tushganda ular bazadan butunlay o'chiriladi.
  async onModuleInit() {
    await this.userModel.collection.updateMany(
      { plainPassword: { $exists: true } },
      { $unset: { plainPassword: '' } },
    );
  }

  async findAll() {
    const users = await this.userModel.find().sort({ name: 1 });
    return users.map((u) => toSafeUser(u));
  }

  async findOne(id: string) {
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    return toSafeUser(user);
  }

  /** Tizimda faqat bitta SUPERADMIN bo'ladi: yangisini yaratib ham, rol berib ham bo'lmaydi. */
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

  private async assertTeacherExists(teacherId?: string) {
    if (!teacherId) return;
    const teacher = await this.teacherModel.findById(teacherId);
    if (!teacher) throw new BadRequestException("Bog'lanadigan o'qituvchi topilmadi");
  }

  async create(dto: CreateUserDto) {
    this.assertNotSuperadminRole(dto.role);
    dto.phone = dto.phone.trim();
    await this.assertPhoneFree(dto.phone);
    await this.assertTeacherExists(dto.teacherId);

    const hashed = await bcrypt.hash(dto.password, 10);
    const user = await this.userModel.create({
      name: dto.name,
      phone: dto.phone,
      password: hashed,
      role: dto.role,
      teacherId: dto.teacherId,
    });
    return toSafeUser(user);
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');

    if (dto.role !== undefined && dto.role !== user.role) {
      // Superadmin roli na berilishi, na olib tashlanishi mumkin.
      if (user.role === 'SUPERADMIN') {
        throw new ForbiddenException('Superadminning rolini o‘zgartirib bo‘lmaydi');
      }
      this.assertNotSuperadminRole(dto.role);
    }
    if (dto.phone !== undefined) {
      dto.phone = dto.phone.trim();
      if (dto.phone !== user.phone) await this.assertPhoneFree(dto.phone, id);
    }

    if (dto.teacherId) await this.assertTeacherExists(dto.teacherId);

    if (dto.name !== undefined) user.name = dto.name;
    if (dto.phone !== undefined) user.phone = dto.phone;
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.teacherId !== undefined) user.teacherId = dto.teacherId;
    if (dto.password) {
      user.password = await bcrypt.hash(dto.password, 10);
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

  /**
   * Administrator (superadmin bo'lmasa ham) boshqa foydalanuvchining parolini
   * almashtirishi mumkin — lekin faqat "quyi" rollar uchun: o'qituvchi va rahbar.
   * Boshqa administrator yoki superadminning parolini faqat superadmin o'zi
   * ("Tahrirlash" formasi orqali) almashtira oladi — bu admin-vs-admin parol
   * o'zlashtirib olishning oldini oladi.
   */
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
    await user.save();
    return toSafeUser(user);
  }

  /** Har bir foydalanuvchi o'zining parolini o'zi almashtirishi (joriy parolni tasdiqlab). */
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
    await user.save();
    return toSafeUser(user);
  }

  async setOwnAvatar(userId: string, file: UploadedFileLike) {
    if (!file) throw new BadRequestException('Rasm fayli yuklanmadi');
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    if (user.avatarUrl) {
      unlink(join(process.cwd(), user.avatarUrl.replace(/^\//, '')), () => {
        /* eski fayl bo'lmasa ham muammo emas */
      });
    }
    user.avatarUrl = `/uploads/avatars/${userId}/${file.filename}`;
    await user.save();
    return toSafeUser(user);
  }

  async removeOwnAvatar(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    if (user.avatarUrl) {
      unlink(join(process.cwd(), user.avatarUrl.replace(/^\//, '')), () => {
        /* fayl allaqachon yo'q bo'lsa ham muammo emas */
      });
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

  // ---------- O'zining shaxsiy profili (har qanday tizimga kirgan foydalanuvchi) ----------
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
        filename: (_req: any, file: any, cb: any) => cb(null, safeFilename(file.originalname)),
      }),
      fileFilter: extensionFilter(IMAGE_EXTENSIONS),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    }),
  )
  uploadOwnAvatar(@CurrentUser() currentUser: { userId: string }, @UploadedFile() file: UploadedFileLike) {
    return this.usersService.setOwnAvatar(currentUser.userId, file);
  }

  @Delete('me/avatar')
  removeOwnAvatar(@CurrentUser() currentUser: { userId: string }) {
    return this.usersService.removeOwnAvatar(currentUser.userId);
  }

  // ---------- Foydalanuvchilarni boshqarish (SUPERADMIN/ADMIN) ----------
  @Roles('SUPERADMIN', 'ADMIN')
  @Get()
  findAll() {
    return this.usersService.findAll();
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

  // Adminlar ham (superadmin bo'lmasa-da) o'qituvchi/rahbar hisoblarining parolini
  // shu yerdan tezda almashtira oladi (masalan parolini unutgan o'qituvchiga).
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
