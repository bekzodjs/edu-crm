import { Body, Controller, forwardRef, Get, Inject, Injectable, Module, Param, Post, Query, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Grade, Student, Group } from '../database/schemas';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TelegramModule, NotificationsService } from '../telegram/telegram.module';

export class CreateGradeDto {
  studentId: string;
  groupId: string;
  teacherId: string;
  lessonId?: string;
  score: number;
  comment?: string;
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

  async create(dto: CreateGradeDto) {
    const grade = await this.gradeModel.create(dto);

    // Baho qo'yilishi bilan darhol (izohi bilan birga, agar yozilgan bo'lsa) bog'langan
    // ota-onaga Telegram orqali xabar boradi.
    const student = await this.studentModel.findById(dto.studentId);
    if (student) {
      const group = await this.groupModel.findById(dto.groupId);
      let text = `⭐ Yangi baho: ${student.fullName}`;
      if (group?.name) text += ` (${group.name})`;
      text += ` — ${dto.score} baho oldi.`;
      if (dto.comment?.trim()) text += `\nO'qituvchi izohi: ${dto.comment.trim()}`;
      await this.notifications.notifyStudentParents(dto.studentId, 'GRADE', text);
    }

    return grade;
  }

  list(query: { studentId?: string; groupId?: string }) {
    const where: any = {};
    if (query.studentId) where.studentId = query.studentId;
    if (query.groupId) where.groupId = query.groupId;
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
  constructor(private gradesService: GradesService) {}

  @Get()
  list(@Query() query: { studentId?: string; groupId?: string }) {
    return this.gradesService.list(query);
  }

  @Get('summary/:studentId')
  summary(@Param('studentId') studentId: string) {
    return this.gradesService.summaryForStudent(studentId);
  }

  @Post()
  @Roles('SUPERADMIN', 'ADMIN', 'TEACHER')
  create(@Body() dto: CreateGradeDto) {
    return this.gradesService.create(dto);
  }
}

@Module({
  imports: [forwardRef(() => TelegramModule)],
  controllers: [GradesController],
  providers: [GradesService],
  exports: [GradesService],
})
export class GradesModule {}
