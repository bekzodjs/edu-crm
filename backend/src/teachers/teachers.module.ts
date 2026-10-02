import {
  Body,
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
import { Model } from 'mongoose';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync, unlink } from 'fs';
import { join } from 'path';
import { Teacher, Group } from '../database/schemas';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

export class CreateTeacherDto {
  fullName: string;
  phone: string;
  subject?: string;
  salaryPct?: number;
}

export class UpdateTeacherDto {
  fullName?: string;
  phone?: string;
  subject?: string;
  salaryPct?: number;
  active?: boolean;
}

export class AddTeacherDocumentDto {
  title: string;
  type?: 'DIPLOM' | 'SERTIFIKAT' | 'MALAKA_KURSI' | 'BOSHQA';
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
    await teacher.deleteOne();
    return teacher;
  }

  async addDocument(id: string, dto: AddTeacherDocumentDto, file: UploadedFileLike) {
    const teacher = await this.teacherModel.findById(id);
    if (!teacher) throw new NotFoundException('O‘qituvchi topilmadi');
    if (!file) throw new NotFoundException('Fayl yuklanmadi');

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
          const dir = join(UPLOAD_ROOT, req.params.id);
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req: any, file: any, cb: any) => {
          const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
          cb(null, `${Date.now()}-${safe}`);
        },
      }),
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
