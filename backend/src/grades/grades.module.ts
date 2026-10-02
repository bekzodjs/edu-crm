import {
  BadRequestException,
  Body,
  Controller,
  forwardRef,
  Get,
  Inject,
  Injectable,
  Module,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Grade, Student, Group } from '../database/schemas';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { assertStudentVisible, AuthUser, loadGroupForUser, teacherGroupIds, teacherScope } from '../common/utils/access';
import { TelegramModule, NotificationsService } from '../telegram/telegram.module';

export class CreateGradeDto {
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @IsString()
  @IsNotEmpty()
  groupId: string;

  // Eski mijozlar bilan moslik uchun qabul qilinadi, lekin e'tiborga olinmaydi —
  // baho har doim guruhning haqiqiy o'qituvchisi nomidan yoziladi.
  @IsOptional() @IsString() teacherId?: string;

  @IsOptional() @IsString() lessonId?: string;

  @IsInt({ message: "Baho butun son bo'lishi kerak" })
  @Min(1, { message: 'Baho 1 dan 10 gacha bo‘lishi kerak' })
  @Max(10, { message: 'Baho 1 dan 10 gacha bo‘lishi kerak' })
  score: number;

  @IsOptional() @IsString() @MaxLength(500) comment?: string;
}

function startOfWeek(d: Date) {
  const day = d.getDay(); // 0=Yakshanba
  const diff = day === 0 ? 6 : day - 1; // Dushanbadan boshlanadi
  const monday = new Date(d);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(d.getDate() - diff);
  return monday;
}

@Injectable()
export class GradesService {
  constructor(
    @InjectModel(Grade.name) private gradeModel: Model<Grade>,
    @InjectModel(Student.name) private studentModel: Model<Student>,
    @InjectModel(Group.name) private groupModel: Model<Group>,
    @Inject(forwardRef(() => NotificationsService)) private notifications: NotificationsService,
  ) {}

  async create(dto: CreateGradeDto, user: AuthUser) {
    // TEACHER faqat o'z guruhidagi o'quvchiga baho qo'ya oladi.
    const group = await loadGroupForUser(this.groupModel, dto.groupId, user);
    if (!group.studentIds.includes(dto.studentId)) {
      throw new BadRequestException("O'quvchi bu guruhga a'zo emas");
    }

    const grade = await this.gradeModel.create({
      studentId: dto.studentId,
      groupId: group.id,
      teacherId: group.teacherId,
      lessonId: dto.lessonId || undefined,
      score: dto.score,
      comment: dto.comment?.trim() || undefined,
    });

    // Baho qo'yilishi bilan darhol (izohi bilan birga, agar yozilgan bo'lsa) bog'langan
    // ota-onaga Telegram orqali xabar boradi.
    const student = await this.studentModel.findById(dto.studentId);
    if (student) {
      let text = `⭐ Yangi baho: ${student.fullName}`;
      if (group.name) text += ` (${group.name})`;
      text += ` — ${dto.score} baho oldi.`;
      if (dto.comment?.trim()) text += `\nO'qituvchi izohi: ${dto.comment.trim()}`;
      await this.notifications.notifyStudentParents(dto.studentId, 'GRADE', text);
    }

    return grade;
  }

  async list(query: { studentId?: string; groupId?: string }, user: AuthUser) {
    const where: any = {};
    if (query.studentId) where.studentId = query.studentId;
    const scope = teacherScope(user);
    if (scope) {
      const ids = await teacherGroupIds(this.groupModel, scope);
      where.groupId = query.groupId ? (ids.includes(query.groupId) ? query.groupId : '__none__') : { $in: ids };
    } else if (query.groupId) {
      where.groupId = query.groupId;
    }
    return this.gradeModel.find(where).sort({ createdAt: -1 }).limit(200);
  }

  /** Ota-onalar botida va StudentDetail sahifasida ko'rsatiladigan chiroyli xulosa. */
  async summaryForStudent(studentId: string) {
    const now = new Date();
    const weekStart = startOfWeek(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [recent, weekGrades, monthGrades] = await Promise.all([
      this.gradeModel.find({ studentId }).sort({ createdAt: -1 }).limit(10),
      this.gradeModel.find({ studentId, createdAt: { $gte: weekStart } }),
      this.gradeModel.find({ studentId, createdAt: { $gte: monthStart } }),
    ]);

    const avg = (arr: Grade[]) => (arr.length ? arr.reduce((s, g) => s + g.score, 0) / arr.length : 0);

    return {
      recent,
      week: { count: weekGrades.length, average: Math.round(avg(weekGrades) * 10) / 10 },
      month: { count: monthGrades.length, average: Math.round(avg(monthGrades) * 10) / 10 },
    };
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('grades')
export class GradesController {
  constructor(
    private gradesService: GradesService,
    @InjectModel(Group.name) private groupModel: Model<Group>,
  ) {}

  @Get()
  list(@Query() query: { studentId?: string; groupId?: string }, @CurrentUser() user: AuthUser) {
    return this.gradesService.list(query, user);
  }

  @Get('summary/:studentId')
  async summary(@Param('studentId') studentId: string, @CurrentUser() user: AuthUser) {
    await assertStudentVisible(this.groupModel, studentId, user);
    return this.gradesService.summaryForStudent(studentId);
  }

  @Post()
  @Roles('SUPERADMIN', 'ADMIN', 'TEACHER')
  create(@Body() dto: CreateGradeDto, @CurrentUser() user: AuthUser) {
    return this.gradesService.create(dto, user);
  }
}

@Module({
  imports: [forwardRef(() => TelegramModule)],
  controllers: [GradesController],
  providers: [GradesService],
  exports: [GradesService],
})
export class GradesModule {}
