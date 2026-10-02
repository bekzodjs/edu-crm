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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { diskStorage } from 'multer';
import { IsBoolean, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { existsSync, mkdirSync, unlink } from 'fs';
import { join } from 'path';
import { Teacher, Group, User } from '../database/schemas';
import { DOCUMENT_EXTENSIONS, extensionFilter, safeFilename } from '../common/utils/upload';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

export class CreateTeacherDto {
  @IsString()
  @IsNotEmpty({ message: 'F.I.Sh. kiritilishi shart' })
  @MaxLength(200)
  fullName: string;

  @IsString()
  @IsNotEmpty({ message: 'Telefon kiritilishi shart' })
  @MaxLength(50)
  phone: string;

  @IsOptional() @IsString() @MaxLength(100) subject?: string;

  @IsOptional()
  @IsNumber({}, { message: "Maosh foizi son bo'lishi kerak" })
  @Min(0)
  @Max(100)
  salaryPct?: number;
}

export class UpdateTeacherDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200) fullName?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(50) phone?: string;
  @IsOptional() @IsString() @MaxLength(100) subject?: string;

  @IsOptional()
  @IsNumber({}, { message: "Maosh foizi son bo'lishi kerak" })
  @Min(0)
  @Max(100)
  salaryPct?: number;

  @IsOptional() @IsBoolean() active?: boolean;
}

const DOCUMENT_TYPES = ['DIPLOM', 'SERTIFIKAT', 'MALAKA_KURSI', 'BOSHQA'] as const;

export class AddTeacherDocumentDto {
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsIn(DOCUMENT_TYPES) type?: (typeof DOCUMENT_TYPES)[number];
}

// multer/@types paketisiz ham TypeScript xato bermasligi uchun soddalashtirilgan tur.
interface UploadedFileLike {
  originalname: string;
  filename: string;
  path: string;
  size: number;
  mimetype: string;
}

const UPLOAD_ROOT = join(process.cwd(), 'uploads', 'teachers');

@Injectable()
export class TeachersService {
  constructor(
    @InjectModel(Teacher.name) private teacherModel: Model<Teacher>,
    @InjectModel(Group.name) private groupModel: Model<Group>,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  create(dto: CreateTeacherDto) {
    return this.teacherModel.create(dto);
  }

  findAll() {
    return this.teacherModel.find().sort({ fullName: 1 });
  }

  async findOne(id: string) {
    const teacher = await this.teacherModel.findById(id);
    if (!teacher) throw new NotFoundException('O‘qituvchi topilmadi');
    const groups = await this.groupModel.find({ teacherId: id });
    return { ...teacher.toObject(), groups };
  }

  async update(id: string, dto: UpdateTeacherDto) {
    const teacher = await this.teacherModel.findById(id);
    if (!teacher) throw new NotFoundException('O‘qituvchi topilmadi');
    Object.assign(teacher, dto);
    await teacher.save();
    return teacher;
  }

  async remove(id: string) {
    const teacher = await this.teacherModel.findById(id);
    if (!teacher) throw new NotFoundException('O‘qituvchi topilmadi');
    // Guruhlari bor o'qituvchi o'chirilsa, guruhlar "egasiz" qolib, daromad/davomat hisoblari buziladi.
    const groupCount = await this.groupModel.countDocuments({ teacherId: id });
    if (groupCount > 0) {
      throw new ConflictException(
        `Bu o'qituvchiga ${groupCount} ta guruh biriktirilgan. Avval guruhlarni boshqa o'qituvchiga o'tkazing yoki o'qituvchini nofaol qiling.`,
      );
    }
    await teacher.deleteOne();
    // Shu o'qituvchiga bog'langan login hisoblari endi hech kimga tegishli emas.
    await this.userModel.updateMany({ teacherId: id }, { $unset: { teacherId: '' } });
    return teacher;
  }

  async addDocument(id: string, dto: AddTeacherDocumentDto, file: UploadedFileLike) {
    const teacher = await this.teacherModel.findById(id);
    if (!file) throw new BadRequestException('Fayl yuklanmadi');
    if (!teacher) {
      unlink(file.path, () => undefined);
      throw new NotFoundException('O‘qituvchi topilmadi');
    }

    teacher.documents.push({
      _id: undefined,
      title: dto.title || file.originalname,
      type: dto.type || 'BOSHQA',
      fileUrl: `/uploads/teachers/${id}/${file.filename}`,
      fileName: file.originalname,
      fileSize: file.size,
      uploadedAt: new Date(),
    } as any);
    await teacher.save();
    return teacher;
  }

  async removeDocument(id: string, docId: string) {
    const teacher = await this.teacherModel.findById(id);
    if (!teacher) throw new NotFoundException('O‘qituvchi topilmadi');

    const doc = teacher.documents.find((d: any) => String(d._id) === docId);
    if (doc) {
      const filePath = join(process.cwd(), doc.fileUrl.replace(/^\//, ''));
      unlink(filePath, () => {
        /* fayl allaqachon yo'q bo'lsa ham muammo emas */
      });
    }
    teacher.documents = teacher.documents.filter((d: any) => String(d._id) !== docId) as any;
    await teacher.save();
    return teacher;
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('teachers')
export class TeachersController {
  constructor(private teachersService: TeachersService) {}

  @Post()
  @Roles('SUPERADMIN', 'ADMIN')
  create(@Body() dto: CreateTeacherDto) {
    return this.teachersService.create(dto);
  }

  // Ro'yxatni ko'rish faqat rahbariyat uchun (SUPERADMIN/ADMIN/RAHBAR) — TEACHER
  // boshqa o'qituvchilarni ko'rmasligi, faqat o'zining profilini ko'rishi kerak.
  @Roles('SUPERADMIN', 'ADMIN', 'RAHBAR')
  @Get()
  findAll() {
    return this.teachersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() currentUser: { role: string; teacherId?: string }) {
    if (currentUser.role === 'TEACHER' && currentUser.teacherId !== id) {
      throw new ForbiddenException("Faqat o'zingizning profilingizni ko'rishingiz mumkin");
    }
    return this.teachersService.findOne(id);
  }

  @Patch(':id')
  @Roles('SUPERADMIN', 'ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateTeacherDto) {
    return this.teachersService.update(id, dto);
  }

  @Delete(':id')
  @Roles('SUPERADMIN', 'ADMIN')
  remove(@Param('id') id: string) {
    return this.teachersService.remove(id);
  }

  @Post(':id/documents')
  @Roles('SUPERADMIN', 'ADMIN')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req: any, _file: any, cb: any) => {
          // ID papka nomi sifatida ishlatiladi — "../" kabi qiymatlar bilan boshqa joyga yozib
          // yuborishning oldini olish uchun faqat haqiqiy ObjectId qabul qilinadi.
          if (!isValidObjectId(req.params.id)) return cb(new BadRequestException("Noto'g'ri ID"), '');
          const dir = join(UPLOAD_ROOT, req.params.id);
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req: any, file: any, cb: any) => cb(null, safeFilename(file.originalname)),
      }),
      fileFilter: extensionFilter(DOCUMENT_EXTENSIONS),
      limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
    }),
  )
  addDocument(
    @Param('id') id: string,
    @Body() dto: AddTeacherDocumentDto,
    @UploadedFile() file: UploadedFileLike,
  ) {
    return this.teachersService.addDocument(id, dto, file);
  }

  @Delete(':id/documents/:docId')
  @Roles('SUPERADMIN', 'ADMIN')
  removeDocument(@Param('id') id: string, @Param('docId') docId: string) {
    return this.teachersService.removeDocument(id, docId);
  }
}

@Module({
  controllers: [TeachersController],
  providers: [TeachersService],
  exports: [TeachersService],
})
export class TeachersModule {}
