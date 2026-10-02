import {
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Post,
  Query,
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
import { Homework, Group, Student } from '../database/schemas';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TelegramModule, NotificationsService } from '../telegram/telegram.module';

export class CreateHomeworkDto {
  groupId: string;
  teacherId: string;
  title: string;
  description?: string;
  videoUrl?: string;
  dueDate?: string;
}

interface UploadedFileLike {
  originalname: string;
  filename: string;
  path: string;
  size: number;
  mimetype: string;
}

const UPLOAD_ROOT = join(process.cwd(), 'uploads', 'homework');

@Injectable()
export class HomeworkService {
  constructor(
    @InjectModel(Homework.name) private homeworkModel: Model<Homework>,
    @InjectModel(Group.name) private groupModel: Model<Group>,
    @InjectModel(Student.name) private studentModel: Model<Student>,
    private notifications: NotificationsService,
  ) {}

  async create(dto: CreateHomeworkDto, file?: UploadedFileLike) {
    const homework = await this.homeworkModel.create({
      groupId: dto.groupId,
      teacherId: dto.teacherId,
      title: dto.title,
      description: dto.description,
      videoUrl: dto.videoUrl || undefined,
      fileUrl: file ? `/uploads/homework/${dto.groupId}/${file.filename}` : undefined,
      fileName: file?.originalname,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
    });

    // Guruhdagi barcha o'quvchilarning ota-onalariga yangi uyga vazifa haqida xabar.
    const group = await this.groupModel.findById(dto.groupId);
    if (group?.studentIds?.length) {
      const dueText = homework.dueDate ? `\nMuddat: ${homework.dueDate.toISOString().slice(0, 10)}` : '';
      const linkText = homework.videoUrl ? `\nVideo: ${homework.videoUrl}` : homework.fileUrl ? '\n(Fayl ilova qilingan — tizimda ko\'ring)' : '';
      for (const studentId of group.studentIds) {
        await this.notifications.notifyStudentParents(
          studentId,
          'HOMEWORK',
          `📚 Yangi uyga vazifa: "${homework.title}"${homework.description ? `\n${homework.description}` : ''}${dueText}${linkText}`,
        );
      }
    }

    return homework;
  }

  list(groupId?: string) {
    return this.homeworkModel.find(groupId ? { groupId } : {}).sort({ createdAt: -1 });
  }

  async remove(id: string) {
    const homework = await this.homeworkModel.findById(id);
    if (!homework) throw new NotFoundException('Vazifa topilmadi');
    if (homework.fileUrl) {
      unlink(join(process.cwd(), homework.fileUrl.replace(/^\//, '')), () => {
        /* fayl allaqachon yo'q bo'lsa ham muammo emas */
      });
    }
    await homework.deleteOne();
    return homework;
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('homework')
export class HomeworkController {
  constructor(private homeworkService: HomeworkService) {}

  @Get()
  list(@Query('groupId') groupId?: string) {
    return this.homeworkService.list(groupId);
  }

  @Post()
  @Roles('SUPERADMIN', 'ADMIN', 'TEACHER')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req: any, _file: any, cb: any) => {
          const dir = join(UPLOAD_ROOT, req.body.groupId || 'misc');
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req: any, file: any, cb: any) => {
          const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
          cb(null, `${Date.now()}-${safe}`);
        },
      }),
      limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB (video/hujjat uchun)
    }),
  )
  create(@Body() dto: CreateHomeworkDto, @UploadedFile() file: UploadedFileLike) {
    return this.homeworkService.create(dto, file);
  }

  @Delete(':id')
  @Roles('SUPERADMIN', 'ADMIN', 'TEACHER')
  remove(@Param('id') id: string) {
    return this.homeworkService.remove(id);
  }
}

@Module({
  imports: [TelegramModule],
  controllers: [HomeworkController],
  providers: [HomeworkService],
  exports: [HomeworkService],
})
export class HomeworkModule {}
