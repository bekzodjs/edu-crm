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
import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { existsSync, mkdirSync, unlink } from 'fs';
import { join } from 'path';
import { Homework, Group, Student } from '../database/schemas';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser, loadGroupForUser, teacherGroupIds, teacherScope } from '../common/utils/access';
import { extensionFilter, HOMEWORK_EXTENSIONS, safeFilename } from '../common/utils/upload';
import { TelegramModule, NotificationsService } from '../telegram/telegram.module';

export class CreateHomeworkDto {
  @IsString()
  @IsNotEmpty({ message: 'Guruh tanlanishi shart' })
  groupId: string;

  // Eski mijozlar bilan moslik uchun qabul qilinadi, lekin e'tiborga olinmaydi —
  // vazifa har doim guruhning haqiqiy o'qituvchisi nomidan yoziladi.
  @IsOptional() @IsString() teacherId?: string;

  @IsString()
  @IsNotEmpty({ message: 'Sarlavha kiritilishi shart' })
  @MaxLength(200)
  title: string;

  @IsOptional() @IsString() @MaxLength(5000) description?: string;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true }, { message: "Video havolasi noto'g'ri" })
  videoUrl?: string;

  @IsOptional()
  @IsDateString({}, { message: "Muddat sanasi noto'g'ri" })
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

  async create(dto: CreateHomeworkDto, user: AuthUser, file?: UploadedFileLike) {
    let group: Group;
    try {
      group = await loadGroupForUser(this.groupModel, dto.groupId, user);
    } catch (e) {
      if (file) unlink(file.path, () => undefined); // ruxsatsiz so'rovda yuklangan faylni saqlab qolmaymiz
      throw e;
    }

    const homework = await this.homeworkModel.create({
      groupId: group.id,
      teacherId: group.teacherId,
      title: dto.title.trim(),
      description: dto.description,
      videoUrl: dto.videoUrl || undefined,
      fileUrl: file ? `/uploads/homework/${file.filename}` : undefined,
      fileName: file?.originalname,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
    });

    // Guruhdagi barcha o'quvchilarning ota-onalariga yangi uyga vazifa haqida xabar.
    if (group.studentIds?.length) {
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

  async list(groupId: string | undefined, user: AuthUser) {
    const where: any = {};
    const scope = teacherScope(user);
    if (scope) {
      const ids = await teacherGroupIds(this.groupModel, scope);
      where.groupId = groupId ? (ids.includes(groupId) ? groupId : '__none__') : { $in: ids };
    } else if (groupId) {
      where.groupId = groupId;
    }
    return this.homeworkModel.find(where).sort({ createdAt: -1 });
  }

  async remove(id: string, user: AuthUser) {
    const homework = await this.homeworkModel.findById(id);
    if (!homework) throw new NotFoundException('Vazifa topilmadi');
    // TEACHER faqat o'z guruhidagi vazifani o'chira oladi.
    if (teacherScope(user)) await loadGroupForUser(this.groupModel, homework.groupId, user);
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
  list(@CurrentUser() user: AuthUser, @Query('groupId') groupId?: string) {
    return this.homeworkService.list(groupId, user);
  }

  @Post()
  @Roles('SUPERADMIN', 'ADMIN', 'TEACHER')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        // Avval so'rov tanasidagi groupId papka nomi sifatida ishlatilardi — "../.." kabi
        // qiymat bilan diskning ixtiyoriy joyiga fayl yozish mumkin edi. Endi bitta umumiy papka.
        destination: (_req: any, _file: any, cb: any) => {
          if (!existsSync(UPLOAD_ROOT)) mkdirSync(UPLOAD_ROOT, { recursive: true });
          cb(null, UPLOAD_ROOT);
        },
        filename: (_req: any, file: any, cb: any) => cb(null, safeFilename(file.originalname)),
      }),
      fileFilter: extensionFilter(HOMEWORK_EXTENSIONS),
      limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB (video/hujjat uchun)
    }),
  )
  create(@Body() dto: CreateHomeworkDto, @UploadedFile() file: UploadedFileLike, @CurrentUser() user: AuthUser) {
    return this.homeworkService.create(dto, user, file);
  }

  @Delete(':id')
  @Roles('SUPERADMIN', 'ADMIN', 'TEACHER')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.homeworkService.remove(id, user);
  }
}

@Module({
  imports: [TelegramModule],
  controllers: [HomeworkController],
  providers: [HomeworkService],
  exports: [HomeworkService],
})
export class HomeworkModule {}
