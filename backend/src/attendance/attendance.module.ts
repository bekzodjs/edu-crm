import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Attendance, Lesson, Student, Group } from '../database/schemas';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  assertStudentVisible,
  AuthUser,
  loadGroupForUser,
  teacherGroupIds,
  teacherScope,
} from '../common/utils/access';
import { TelegramModule, NotificationsService } from '../telegram/telegram.module';

const ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as const;
type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export class MarkAttendanceItemDto {
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @IsIn(ATTENDANCE_STATUSES, { message: "Davomat holati noto'g'ri" })
  status: AttendanceStatus;

  @IsOptional() @IsString() @MaxLength(500) note?: string;

  @IsOptional() @IsInt() @Min(0) @Max(600) lateMinutes?: number;
}

export class MarkAttendanceDto {
  @IsString()
  @IsNotEmpty()
  lessonId: string;

  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => MarkAttendanceItemDto)
  entries: MarkAttendanceItemDto[];
}

@Injectable()
export class AttendanceService {
  constructor(
    @InjectModel(Attendance.name) private attendanceModel: Model<Attendance>,
    @InjectModel(Lesson.name) private lessonModel: Model<Lesson>,
    @InjectModel(Student.name) private studentModel: Model<Student>,
    @InjectModel(Group.name) private groupModel: Model<Group>,
    private notifications: NotificationsService,
  ) {}

  /** Bir dars uchun bir nechta o'quvchining davomatini birdaniga belgilaydi. */
  async markBulk(dto: MarkAttendanceDto, user: AuthUser) {
    const lesson = await this.lessonModel.findById(dto.lessonId);
    if (!lesson) throw new NotFoundException('Dars topilmadi');
    if (lesson.status === 'CANCELLED') throw new BadRequestException('Bekor qilingan dars uchun davomat belgilanmaydi');
    // TEACHER faqat o'z guruhining darsiga davomat qo'ya oladi.
    const group = await loadGroupForUser(this.groupModel, lesson.groupId, user);

    const groupStudentIds = new Set(group.studentIds);
    const outsider = dto.entries.find((e) => !groupStudentIds.has(e.studentId));
    if (outsider) throw new BadRequestException("O'quvchi bu guruhga a'zo emas");

    // Avvalgi holatni bilish uchun: ota-onaga xabar faqat holat haqiqatan o'zgarganda yuboriladi
    // (davomatni qayta saqlash har safar takroriy xabar va fikr-so'rov yubormasligi uchun).
    const previous = await this.attendanceModel.find({ lessonId: dto.lessonId });
    const previousStatus = new Map(previous.map((a) => [a.studentId, a.status]));
    const students = await this.studentModel.find({ _id: { $in: dto.entries.map((e) => e.studentId) } });
    const studentMap = new Map(students.map((s) => [s.id, s]));
    const dateStr = lesson.date.toISOString().slice(0, 10);

    const results = [];
    for (const entry of dto.entries) {
      const record = await this.attendanceModel.findOneAndUpdate(
        { lessonId: dto.lessonId, studentId: entry.studentId },
        {
          status: entry.status,
          note: entry.note,
          markedAt: new Date(),
          lateMinutes: entry.status === 'LATE' ? entry.lateMinutes ?? undefined : undefined,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      results.push(record);

      if (previousStatus.get(entry.studentId) === entry.status) continue;

      // Kelmagan yoki kechikkan o'quvchi ota-onasiga avtomatik xabar
      if (entry.status === 'ABSENT' || entry.status === 'LATE') {
        const student = studentMap.get(entry.studentId);
        const lateText = entry.status === 'LATE' && entry.lateMinutes ? ` (${entry.lateMinutes} minut)` : '';
        const message =
          entry.status === 'ABSENT'
            ? `Assalomu alaykum! Farzandingiz ${student?.fullName} ${dateStr} sanadagi darsga kelmadi.`
            : `Assalomu alaykum! Farzandingiz ${student?.fullName} ${dateStr} sanadagi darsga kechikib keldi${lateText}.`;
        await this.notifications.notifyStudentParents(
          entry.studentId,
          entry.status === 'ABSENT' ? 'ABSENCE' : 'LATE',
          message,
        );
      }

      // Kelgan o'quvchi uchun: ota-onadan kunlik fikr-mulohaza (ijobiy/salbiy) so'raladi
      if (entry.status === 'PRESENT') {
        await this.notifications.requestLessonFeedback(entry.studentId, group.teacherId, group.id, dto.lessonId);
      }
    }

    lesson.status = 'COMPLETED';
    await lesson.save();

    return results;
  }

  async findByLesson(lessonId: string, user: AuthUser) {
    const lesson = await this.lessonModel.findById(lessonId);
    if (!lesson) throw new NotFoundException('Dars topilmadi');
    await loadGroupForUser(this.groupModel, lesson.groupId, user);
    return this.attendanceModel.find({ lessonId });
  }

  async findByStudent(studentId: string, user: AuthUser) {
    await assertStudentVisible(this.groupModel, studentId, user);
    return this.attendanceModel.find({ studentId }).sort({ markedAt: -1 });
  }

  /** Sanalar oralig'ida (va ixtiyoriy guruh bo'yicha) har bir o'quvchi uchun kelmadi/kechikdi/sababli hisobot. */
  async report(query: { from?: string; to?: string; groupId?: string }, user: AuthUser) {
    const lessonFilter: any = {};
    const scope = teacherScope(user);
    if (scope) {
      // TEACHER faqat o'z guruhlari bo'yicha hisobotni ko'radi.
      const ids = await teacherGroupIds(this.groupModel, scope);
      lessonFilter.groupId = query.groupId ? (ids.includes(query.groupId) ? query.groupId : '__none__') : { $in: ids };
    } else if (query.groupId) {
      lessonFilter.groupId = query.groupId;
    }
    if (query.from || query.to) {
      lessonFilter.date = {};
      if (query.from) lessonFilter.date.$gte = new Date(query.from);
      if (query.to) {
        const to = new Date(query.to);
        to.setDate(to.getDate() + 1); // 'to' sanasining oxirigacha (kun bo'yicha inklyuziv)
        lessonFilter.date.$lt = to;
      }
    }

    const lessons = await this.lessonModel.find(lessonFilter).select('_id');
    const lessonIds = lessons.map((l) => l.id);

    const attendances = lessonIds.length
      ? await this.attendanceModel.find({ lessonId: { $in: lessonIds } })
      : [];

    const byStudent = new Map<
      string,
      { present: number; absent: number; late: number; excused: number; lateMinutesTotal: number }
    >();
    for (const a of attendances) {
      const entry = byStudent.get(a.studentId) || { present: 0, absent: 0, late: 0, excused: 0, lateMinutesTotal: 0 };
      if (a.status === 'PRESENT') entry.present++;
      else if (a.status === 'ABSENT') entry.absent++;
      else if (a.status === 'LATE') {
        entry.late++;
        entry.lateMinutesTotal += a.lateMinutes || 0;
      } else if (a.status === 'EXCUSED') entry.excused++;
      byStudent.set(a.studentId, entry);
    }

    const studentIds = [...byStudent.keys()];
    const students = studentIds.length ? await this.studentModel.find({ _id: { $in: studentIds } }) : [];
    const studentMap = new Map(students.map((s) => [s.id, s]));

    return studentIds
      .map((studentId) => {
        const counts = byStudent.get(studentId)!;
        const student = studentMap.get(studentId);
        return {
          studentId,
          fullName: student?.fullName || "Noma'lum",
          parentPhone: student?.parentPhone,
          ...counts,
        };
      })
      .sort((a, b) => b.absent - a.absent || b.late - a.late);
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private attendanceService: AttendanceService) {}

  @Roles('SUPERADMIN', 'ADMIN', 'TEACHER')
  @Post()
  markBulk(@Body() dto: MarkAttendanceDto, @CurrentUser() user: AuthUser) {
    return this.attendanceService.markBulk(dto, user);
  }

  @Get('lesson/:lessonId')
  findByLesson(@Param('lessonId') lessonId: string, @CurrentUser() user: AuthUser) {
    return this.attendanceService.findByLesson(lessonId, user);
  }

  @Get('student/:studentId')
  findByStudent(@Param('studentId') studentId: string, @CurrentUser() user: AuthUser) {
    return this.attendanceService.findByStudent(studentId, user);
  }

  @Get('report')
  report(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('groupId') groupId?: string,
  ) {
    return this.attendanceService.report({ from, to, groupId }, user);
  }
}

@Module({
  imports: [TelegramModule],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
